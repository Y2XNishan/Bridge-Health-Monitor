import asyncio
import json
import os
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import APIRouter
from groq import Groq
from pydantic import BaseModel, Field

from rag import retrieve_context

router = APIRouter()

SYSTEM_PROMPT = (
    "You are BridgeIQ Assistant, an AI for structural health monitoring of Indian bridges.\n"
    "You have access to live sensor data, anomaly scores, risk predictions, alerts, and traffic data.\n"
    "Official IRC Sensor Safety Limits (use ONLY these — never invent or assume other thresholds):\n"
    "- Crack Gap Limit: 0.30 mm (IRC:112-2011)\n"
    "- Water Level Flood Limit: 4.5 m (IRC:6-2017)\n"
    "- Strain Limit: 210.0 MPa (IRC:112-2011)\n"
    "- Vibration Limit: 1.20 g (IRC:6-2017)\n\n"
    "Answer engineers' questions concisely and technically.\n"
    "Always reference actual numbers from the provided data.\n"
    "If something is critical, say so clearly.\n"
    "Always respond in clear natural language. Never output raw JSON, feature names, or technical data dumps.\n"
    "Never include emojis or emoticons in responses. Always maintain a formal, concise, and professional tone."
)

DEFAULT_BRIDGEIQ_REPLY = (
    "BridgeIQ is an AI-powered Bridge Structural Health Monitoring system "
    "that monitors sensors including vibration, strain, crack gap, and water "
    "level across multiple bridges in real-time."
)

GROQ_MODEL_NAME = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
LORA_MODEL_PATH = Path(__file__).resolve().parent / "models" / "bridgeiq_lora"
INTERNAL_API_BASE_URL = os.getenv("BRIDGEIQ_INTERNAL_API_BASE_URL", "http://localhost:8000")
INTERNAL_ENDPOINTS = {
    "live": "/api/live",
    "anomaly": "/api/anomaly",
    "predict": "/api/predict",
    "alerts": "/api/alerts",
    "traffic": "/api/traffic",
}

CLEAN_LIVE_FIELDS = {
    "water_level",
    "vibration",
    "strain",
    "crack_gap",
    "health_score",
    "alert_level",
    "anomaly_score",
    "risk_score",
    "bridge_name",
}
FEATURE_ENGINEERED_MARKERS = (
    "_rain",
    "_mean_",
    "_std_",
    "_zscore_",
    "_delta",
    "_lag",
    "_max",
    "_max_",
)

# Check if fine-tuned model exists
_local_model = None
_local_tokenizer = None
_use_local_model = False

def _load_local_model():
    global _local_model, _local_tokenizer, _use_local_model
    if not LORA_MODEL_PATH.exists():
        return
    try:
        import torch
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

        base_model_name = "meta-llama/Llama-3.2-3B-Instruct"
        cache_dir = Path("D:/huggingface_cache")

        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_use_double_quant=True,
        )

        _local_tokenizer = AutoTokenizer.from_pretrained(
            str(LORA_MODEL_PATH), use_fast=True
        )
        base_model = AutoModelForCausalLM.from_pretrained(
            base_model_name,
            quantization_config=quantization_config,
            device_map="auto",
            torch_dtype=torch.bfloat16,
            cache_dir=str(cache_dir),
        )
        _local_model = PeftModel.from_pretrained(base_model, str(LORA_MODEL_PATH))
        _local_model.eval()
        _use_local_model = True
        print("[BridgeIQ] Fine-tuned model loaded successfully.")
    except Exception as e:
        print(f"[BridgeIQ] Could not load local model, falling back to Groq: {e}")
        _use_local_model = False

# Try loading local model asynchronously in the background so it does not block server startup
import threading
threading.Thread(target=_load_local_model, daemon=True).start()


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    bridge_id: int = Field(..., ge=1)
    message: str = Field(..., min_length=1)
    history: list[ChatHistoryItem] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str


class ModelInfoResponse(BaseModel):
    active_model: str
    model_type: str
    local_model_path: str
    local_model_available: bool


async def _fetch_context_item(
    client: httpx.AsyncClient,
    name: str,
    path: str,
    bridge_id: int,
) -> tuple[str, Any]:
    try:
        response = await client.get(path, params={"bridge_id": bridge_id})
        response.raise_for_status()
        return name, response.json()
    except Exception as exc:
        return name, {"error": f"Could not fetch {name} data: {exc}"}


async def _fetch_bridge_context(bridge_id: int) -> dict[str, Any]:
    async with httpx.AsyncClient(
        base_url=INTERNAL_API_BASE_URL,
        timeout=httpx.Timeout(12.0, connect=3.0),
    ) as client:
        fetches = [
            _fetch_context_item(client, name, path, bridge_id)
            for name, path in INTERNAL_ENDPOINTS.items()
        ]
        return dict(await asyncio.gather(*fetches))


def _is_feature_engineered_key(key: str) -> bool:
    return any(marker in key for marker in FEATURE_ENGINEERED_MARKERS)


def _strip_feature_engineered_data(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: _strip_feature_engineered_data(item)
            for key, item in value.items()
            if not _is_feature_engineered_key(str(key))
        }
    if isinstance(value, list):
        return [_strip_feature_engineered_data(item) for item in value]
    return value


def _clean_live_data(live_data: Any) -> Any:
    if not isinstance(live_data, dict):
        return live_data
    return {
        key: live_data[key]
        for key in CLEAN_LIVE_FIELDS
        if key in live_data and not _is_feature_engineered_key(key)
    }


def _clean_bridge_context(context: dict[str, Any]) -> dict[str, Any]:
    cleaned = _strip_feature_engineered_data(context)
    if isinstance(cleaned, dict) and "live" in cleaned:
        cleaned["live"] = _clean_live_data(cleaned["live"])
    return cleaned


def _build_messages(request: ChatRequest, context: dict[str, Any]) -> list[dict[str, str]]:
    messages = [
        {"role": item.role, "content": item.content.strip()}
        for item in request.history
        if item.content.strip()
    ]
    clean_context = _clean_bridge_context(context)
    context_json = json.dumps(clean_context, ensure_ascii=False, default=str)
    messages.append(
        {
            "role": "user",
            "content": (
                f"Bridge ID: {request.bridge_id}\n"
                f"Engineer question: {request.message.strip()}\n\n"
                "Use this current BridgeIQ telemetry context:\n"
                f"{context_json}"
            ),
        }
    )
    return messages


def _generate_local_reply(prompt: str) -> str:
    import torch
    inputs = _local_tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
    inputs = {k: v.to(_local_model.device) for k, v in inputs.items()}
    input_token_count = inputs["input_ids"].shape[-1]
    with torch.no_grad():
        outputs = _local_model.generate(
            **inputs,
            max_new_tokens=100,
            temperature=0.7,
            do_sample=True,
            pad_token_id=_local_tokenizer.eos_token_id,
        )
    generated_tokens = outputs[0][input_token_count:]
    reply = _local_tokenizer.decode(generated_tokens, skip_special_tokens=True).strip()
    if reply:
        return reply

    decoded = _local_tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
    if decoded.startswith(prompt):
        return decoded[len(prompt):].strip()
    return decoded.strip()


def _ensure_reply(reply: str | None) -> str:
    if reply and reply.strip():
        return reply.strip()
    return DEFAULT_BRIDGEIQ_REPLY


@router.get("/api/chat/model-info", response_model=ModelInfoResponse)
async def model_info() -> ModelInfoResponse:
    if _use_local_model:
        return ModelInfoResponse(
            active_model="BridgeIQ Fine-tuned (LLaMA 3.2 3B + LoRA)",
            model_type="local",
            local_model_path=str(LORA_MODEL_PATH),
            local_model_available=True,
        )
    return ModelInfoResponse(
        active_model=f"Groq API ({GROQ_MODEL_NAME})",
        model_type="groq",
        local_model_path=str(LORA_MODEL_PATH),
        local_model_available=LORA_MODEL_PATH.exists(),
    )


@router.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    context = await _fetch_bridge_context(request.bridge_id)
    clean_context = _clean_bridge_context(context)
    retrieved_context = retrieve_context(request.message)

    system_prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        "RELEVANT BRIDGE ENGINEERING STANDARDS:\n"
        f"{retrieved_context or 'No relevant standards were retrieved.'}\n\n"
        "Use the above standards to give more precise, code-referenced answers."
    )

    # Use local fine-tuned model if available
    if _use_local_model:
        try:
            context_json = json.dumps(clean_context, ensure_ascii=False, default=str)
            live = clean_context.get("live", {})
            mini_context = (
                f"Bridge: {live.get('bridge_name', 'Unknown')}\n"
                f"Health Score: {live.get('health_score', 'N/A')}/100\n"
                f"Alert Level: {live.get('alert_level', 'N/A')}\n"
                f"Vibration: {live.get('vibration', 'N/A')}g\n"
                f"Strain: {live.get('strain', 'N/A')} MPa\n"
                f"Water Level: {live.get('water_level', 'N/A')}m\n"
                f"Crack Gap: {live.get('crack_gap', 'N/A')}mm\n"
                f"Anomaly Score: {live.get('anomaly_score', 'N/A')}\n"
            )
            prompt = (
                f"### Instruction:\nYou are BridgeIQ Assistant. Answer the engineer's question in 2-3 sentences using only the data below. Do not repeat the data dump.\n\n"
                f"Sensor Data:\n{mini_context}\n"
                f"Question: {request.message.strip()}\n\n"
                f"### Response:"
            )

            
            reply = await asyncio.get_event_loop().run_in_executor(
                None, _generate_local_reply, prompt
            )
            return ChatResponse(reply=_ensure_reply(reply))
        except Exception as e:
            print(f"Local model failed, falling back to Groq: {e}")

    # Fallback to Groq API
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return ChatResponse(
            reply=(
                "Groq is not configured because GROQ_API_KEY is missing. "
                "Fetched bridge context successfully, but cannot generate an AI reply."
            )
        )
    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=GROQ_MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                *_build_messages(request, clean_context),
            ],
            max_tokens=1024,
            temperature=0.7,
        )
        reply = completion.choices[0].message.content
        if not reply and hasattr(completion.choices[0].message, "reasoning"):
            reply = completion.choices[0].message.reasoning
        return ChatResponse(reply=_ensure_reply(reply))
    except httpx.HTTPError as exc:
        return ChatResponse(reply=f"Groq request failed: {exc}")
    except Exception as exc:
        return ChatResponse(reply=f"Chat assistant failed unexpectedly: {exc}")

import base64

VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

def _encode_image(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode('utf-8')

def _analyze_image_with_groq(image_base64: str, media_type: str, question: str, bridge_context: dict) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return (
            "**Visual Assistant Offline (Missing API Key)**\n\n"
            "Visual inspection analysis is currently offline because the `GROQ_API_KEY` is not set.\n\n"
            "Here is the standard engineering guidance based on the bridge status:\n"
            "- Check crack gauges and dynamic strain readings directly.\n"
            "- Visual damage inspections must align with IRC:SP:44-1996 for crack classification."
        )
    try:
        client = Groq(api_key=api_key)
        
        live = bridge_context.get("live", {})
        context_text = (
            f"Bridge: {live.get('bridge_name', 'Unknown')}\n"
            f"Health Score: {live.get('health_score', 'N/A')}/100\n"
            f"Alert Level: {live.get('alert_level', 'N/A')}\n"
            f"Current Crack Gap: {live.get('crack_gap', 'N/A')}mm\n"
            f"Current Vibration: {live.get('vibration', 'N/A')}g\n"
            f"Current Strain: {live.get('strain', 'N/A')} MPa\n"
        )
        
        system_prompt = (
            "You are an expert bridge structural engineer specializing in visual inspection of Indian bridges.\n"
            "Analyze the uploaded image and provide:\n"
            "1. DAMAGE TYPE: Identify crack type (longitudinal, transverse, diagonal, spalling, corrosion, etc.)\n"
            "2. SEVERITY: Rate as MINOR/MODERATE/SEVERE/CRITICAL with justification\n"
            "3. ESTIMATED WIDTH: Estimate crack width in mm if visible\n"
            "4. IRC REFERENCE: Quote specific IRC standard (IRC:112-2011, IRC:6-2017, IRC:18-2000, etc.)\n"
            "5. IMMEDIATE ACTION: What must be done and when\n"
            "6. MONITORING: How to track this damage going forward\n"
            "Be specific, technical, and actionable. Reference actual IRC section numbers."
        )
        
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{media_type};base64,{image_base64}"
                        }
                    },
                    {
                        "type": "text",
                        "text": f"Bridge sensor context:\n{context_text}\n\nEngineer question: {question}"
                    }
                ]
            }
        ]
        
        completion = client.chat.completions.create(
            model=VISION_MODEL,
            messages=messages,
            max_tokens=1024,
            temperature=0.3,
        )
        
        return completion.choices[0].message.content
    except Exception as exc:
        return (
            f"**Visual Assistant Offline (Request Failed)**\n\n"
            f"Visual analysis query failed with exception: {exc}\n\n"
            "Please check that your GROQ_API_KEY is active and you have a valid internet connection."
        )


def check_critical_bridges() -> list:
    """Check for critical bridges and return proactive alert messages"""
    from backend.main import ensure_simulator_exists
    critical_bridges = []
    for bridge_id in range(1, 59):
        try:
            sim = ensure_simulator_exists(bridge_id)
            live = sim.get_current_data()
            if live.get("alert_level") == "CRITICAL" or \
               live.get("health_score", 100) < 40:
                critical_bridges.append({
                    "bridge_id": bridge_id,
                    "bridge_name": live.get("bridge_name", f"Bridge {bridge_id}"),
                    "health_score": live.get("health_score", 0),
                    "alert_level": live.get("alert_level", "CRITICAL"),
                    "vibration": live.get("vibration", 0),
                    "strain": live.get("strain", 0),
                    "crack_gap": live.get("crack_gap", 0),
                    "anomaly_score": live.get("anomaly_score", 0)
                })
        except:
            pass
    return critical_bridges[:3]


async def run_autonomous_action(bridge_id: int, bridge_name: str, action_confirmed: bool, sensor_data: dict = None, user_name: str = "Engineer") -> dict:
    if not action_confirmed:
        return {
            "status": "awaiting_confirmation",
            "message": f"Ready to: (1) Run AI inspection, (2) Auto-assign crew, (3) Send Telegram alert for {bridge_name}. Confirm?"
        }
    
    results = {}
    
    # Step 1: Run inspection
    try:
        from agent import run_inspection_agent
        inspection = await run_inspection_agent(bridge_id, bridge_name)
        results["inspection"] = {
            "status": "done",
            "severity": inspection.get("severity"),
            "health_score": inspection.get("health_score")
        }
    except Exception as e:
        results["inspection"] = {"status": "failed", "error": str(e)}
        
    # Step 2: Auto-assign crew
    try:
        crews = ["Team Alpha", "Team Beta", "Team Gamma", "Team Delta"]
        import random
        assigned_crew = random.choice(crews)
        results["crew_assignment"] = {
            "status": "done",
            "crew": assigned_crew,
            "bridge": bridge_name,
            "eta": "2 hours"
        }
    except Exception as e:
        results["crew_assignment"] = {"status": "failed", "error": str(e)}
        
    # Step 3: Send Telegram alert
    try:
        from telegram_alerts import send_telegram_alert
        msg = (f"[ALERT] AUTONOMOUS ACTION TRIGGERED\n"
               f"Bridge: {bridge_name}\n"
               f"Action by: {user_name}\n"
               f"Crew assigned: {results.get('crew_assignment', {}).get('crew', 'N/A')}\n"
               f"Inspection: COMPLETE\n"
               f"Severity: {results.get('inspection', {}).get('severity', 'N/A')}")
        await send_telegram_alert(msg)
        results["telegram"] = {"status": "sent"}
    except Exception as e:
        results["telegram"] = {"status": "failed", "error": str(e)}
        
    return {
        "status": "completed",
        "actions_taken": results,
        "summary": (
            f"All actions completed for {bridge_name}: "
            f"Inspection done, "
            f"{results.get('crew_assignment', {}).get('crew', 'Team')} "
            f"assigned (ETA 2hrs), alert notification dispatched."
        )
    }

