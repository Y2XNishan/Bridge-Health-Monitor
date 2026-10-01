import asyncio
import json
import os
import time
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import APIRouter, HTTPException
from groq import Groq
from pydantic import BaseModel, Field

try:
    from backend.chat_alerts import sensor_breaches
    from backend.constants import HEALTH_BOUNDARIES, SENSOR_THRESHOLDS, get_bridge_condition
except ImportError:
    from chat_alerts import sensor_breaches
    from constants import HEALTH_BOUNDARIES, SENSOR_THRESHOLDS, get_bridge_condition

router = APIRouter()
_last_inference_timestamp = time.time()

PROJECT_LIMITS = "\n".join(
    f"- {name.replace('_', ' ').title()}: Monitor {values['warn']} {values['unit']}; Critical {values['crit']} {values['unit']}"
    for name, values in SENSOR_THRESHOLDS.items()
)

SYSTEM_PROMPT = (
    "You are BridgeIQ Assistant, an AI for structural health monitoring of Indian bridges.\n"
    "Use only the supplied bridge context and these project sensor thresholds:\n"
    f"{PROJECT_LIMITS}\n\n"
    "The supplied condition uses shared backend health-score and sensor logic. "
    "Name the actual cause of each alert and every breached sensor with its unit. "
    "Do not attribute a Critical condition to a normal reading or infer a crew assignment. "
    "Do not invent measurements, standards citations, dispatches, or completed inspections.\n"
    "Answer engineers' questions concisely and technically.\n"
    "Always reference actual numbers from the provided data.\n"
    "If something is critical, say so clearly.\n"
    "Use short markdown paragraphs or lists, not tables or raw JSON. Never output feature names or technical data dumps.\n"
    "Never include emojis or emoticons in responses. Always maintain a formal, concise, and professional tone."
)

DEFAULT_BRIDGEIQ_REPLY = "Assistant response unavailable. Review the current bridge readings and project thresholds directly."

GROQ_MODEL_NAME = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
LORA_MODEL_PATH = Path(__file__).resolve().parent / "models" / "bridgeiq_lora"
INTERNAL_API_BASE_URL = os.getenv("BRIDGEIQ_INTERNAL_API_BASE_URL", "http://localhost:8000")
INTERNAL_ENDPOINTS = {
    "live": "/api/live",
    "anomaly": "/api/anomaly",
    "predict": "/api/predict",
    "traffic": "/api/traffic",
}

CLEAN_LIVE_FIELDS = {
    "water_level",
    "vibration",
    "strain",
    "crack_gap",
    "health_score",
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
    models_loaded: bool = True
    last_inference_time: str = "Just now"
    last_inference_timestamp: float = 0.0
    status: str = "operational"


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
    except Exception:
        return name, {"error": f"{name} data unavailable"}


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
    cleaned = {
        key: live_data[key]
        for key in CLEAN_LIVE_FIELDS
        if key in live_data and not _is_feature_engineered_key(key)
    }
    cleaned["condition"] = get_bridge_condition(live_data.get("health_score"), live_data)
    cleaned["breached_sensors"] = sensor_breaches(live_data)
    return cleaned


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
    global _last_inference_timestamp
    has_groq = bool(os.getenv("GROQ_API_KEY") and os.getenv("GROQ_API_KEY") != "your_groq_key_here")
    models_loaded = bool(_use_local_model or has_groq)

    now = time.time()
    time_since_inference = now - _last_inference_timestamp
    inference_within_window = time_since_inference <= 180.0

    is_operational = models_loaded and inference_within_window
    status_str = "operational" if is_operational else "degraded"
    time_str = "Just now" if time_since_inference < 60 else f"{int(time_since_inference)}s ago"

    if _use_local_model:
        return ModelInfoResponse(
            active_model="BridgeIQ Fine-tuned (LLaMA 3.2 3B + LoRA)",
            model_type="local",
            local_model_path=str(LORA_MODEL_PATH),
            local_model_available=True,
            models_loaded=models_loaded,
            last_inference_time=time_str,
            last_inference_timestamp=_last_inference_timestamp,
            status=status_str,
        )
    return ModelInfoResponse(
        active_model=f"Groq API ({GROQ_MODEL_NAME})",
        model_type="groq",
        local_model_path=str(LORA_MODEL_PATH),
        local_model_available=LORA_MODEL_PATH.exists(),
        models_loaded=models_loaded,
        last_inference_time=time_str,
        last_inference_timestamp=_last_inference_timestamp,
        status=status_str,
    )


@router.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    try:
        from backend.main import _INDIA_BRIDGES
    except ImportError:
        from main import _INDIA_BRIDGES
    if not any(bridge["id"] == request.bridge_id for bridge in _INDIA_BRIDGES):
        raise HTTPException(status_code=404, detail="Bridge not found")
    global _last_inference_timestamp
    _last_inference_timestamp = time.time()
    context = await _fetch_bridge_context(request.bridge_id)
    clean_context = _clean_bridge_context(context)
    system_prompt = SYSTEM_PROMPT

    # Use local fine-tuned model if available
    if _use_local_model:
        try:
            live = clean_context.get("live", {})
            mini_context = (
                f"Bridge: {live.get('bridge_name', 'Unknown')}\n"
                f"Health Score: {live.get('health_score', 'N/A')}/100\n"
                f"Condition: {live.get('condition', 'Unavailable')}\n"
                f"Vibration: {live.get('vibration', 'N/A')} g\n"
                f"Strain: {live.get('strain', 'N/A')} MPa\n"
                f"Water Level: {live.get('water_level', 'N/A')} m\n"
                f"Crack Gap: {live.get('crack_gap', 'N/A')} mm\n"
                f"Anomaly Score: {live.get('anomaly_score', 'N/A')}\n"
                f"Breached sensors: {json.dumps(live.get('breached_sensors', []))}\n"
            )
            prompt = (
                "### Instruction:\nYou are BridgeIQ Assistant. Answer in 2-3 sentences using only the data below. "
                "If Critical, name its actual health-score or sensor trigger and all breached sensors with units. "
                "Never blame a normal sensor, invent a crew or dispatch, or cite a standard.\n"
                f"Project sensor thresholds:\n{PROJECT_LIMITS}\n"
                f"Health-score Critical boundary: {HEALTH_BOUNDARIES['critical']:.0f}/100\n\n"
                f"Sensor Data:\n{mini_context}\n"
                f"Question: {request.message.strip()}\n\n"
                f"### Response:"
            )

            
            reply = await asyncio.get_event_loop().run_in_executor(
                None, _generate_local_reply, prompt
            )
            return ChatResponse(reply=_ensure_reply(reply))
        except Exception as e:
            print(f"Local chat model failed ({type(e).__name__}); trying the configured provider")

    # Fallback to Groq API
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return ChatResponse(
            reply=(
                "AI chat is unavailable because no model provider is configured. "
                "No answer was generated; review current bridge readings directly."
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
    except httpx.HTTPError:
        return ChatResponse(reply="Assistant provider unavailable. No answer was generated; check current bridge readings directly.")
    except Exception:
        return ChatResponse(reply="Assistant response unavailable. No answer was generated; check current bridge readings directly.")
