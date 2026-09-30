import os
import httpx
from datetime import datetime, timedelta, timezone
from groq import Groq

try:
    from backend.constants import (
        CRACK_GAP_LIMIT_MM,
        CRACK_GAP_WARN_MM,
        WATER_LEVEL_LIMIT_M,
        WATER_LEVEL_WARN_M,
        VIBRATION_LIMIT_G,
        VIBRATION_WARN_G,
        STRAIN_LIMIT_MPA,
        STRAIN_WARN_MPA,
        get_bridge_condition,
    )
except ImportError:
    from constants import (
        CRACK_GAP_LIMIT_MM,
        CRACK_GAP_WARN_MM,
        WATER_LEVEL_LIMIT_M,
        WATER_LEVEL_WARN_M,
        VIBRATION_LIMIT_G,
        VIBRATION_WARN_G,
        STRAIN_LIMIT_MPA,
        STRAIN_WARN_MPA,
        get_bridge_condition,
    )

GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

AGENT_SYSTEM_PROMPT = """You write concise, professional bridge inspection reports.
Use only the bridge details, current sensor readings, health score, inspection date, and project thresholds supplied in the user message. Do not infer historical trends, causes, damage, or maintenance facts without supporting data.
Call the supplied limits "project thresholds"; do not attribute them to IRC clauses or other standards.
Use only Healthy, Monitor, and Critical for condition labels. Never use NORMAL or WARNING.
Never mention dataset row indices, ML false-positives, anomaly-model internals, or model scores.
Use sentence case for every heading and section title. Write valid Markdown with blank lines around headings, lists, and tables. Do not use emojis."""

async def fetch_all_bridge_data(bridge_id: int, base_url: str = "http://localhost:8000") -> dict:
    if base_url == "http://localhost:8000":
        base_url = os.getenv("BRIDGEIQ_INTERNAL_API_BASE_URL", "http://localhost:8000")
        
    endpoints = {"live": f"/api/live?bridge_id={bridge_id}"}
    results = {}
    async with httpx.AsyncClient(timeout=10.0) as client:
        for name, path in endpoints.items():
            try:
                r = await client.get(f"{base_url}{path}")
                results[name] = r.json()
            except Exception as e:
                results[name] = {"error": str(e)}
    return results

def analyze_sensors(live_data: dict) -> dict:
    issues = []
    recommendations = []
    severity = "Healthy"

    vibration = live_data.get("vibration", 0)
    strain = live_data.get("strain", 0)
    crack_gap = live_data.get("crack_gap", 0)
    water_level = live_data.get("water_level", 0)
    health_score = live_data.get("health_score", 100)
    if vibration >= VIBRATION_LIMIT_G:
        issues.append(f"Critical: Vibration {vibration:.3f} g meets or exceeds the project threshold of {VIBRATION_LIMIT_G:.2f} g")
        recommendations.append("Arrange an immediate on-site vibration assessment and consider load restrictions")
        severity = "Critical"
    elif vibration >= VIBRATION_WARN_G:
        issues.append(f"Monitor: Vibration {vibration:.3f} g meets or exceeds the project warning threshold of {VIBRATION_WARN_G:.2f} g")
        recommendations.append("Monitor vibration every 30 minutes")
        if severity != "Critical":
            severity = "Monitor"

    if strain >= STRAIN_LIMIT_MPA:
        issues.append(f"Critical: Strain {strain:.1f} MPa meets or exceeds the project threshold of {STRAIN_LIMIT_MPA:.1f} MPa")
        recommendations.append("Structural assessment required within 24 hours")
        severity = "Critical"
    elif strain >= STRAIN_WARN_MPA:
        issues.append(f"Monitor: Strain {strain:.1f} MPa meets or exceeds the project warning threshold of {STRAIN_WARN_MPA:.1f} MPa")
        recommendations.append("Schedule structural inspection within 7 days")
        if severity != "Critical":
            severity = "Monitor"

    if crack_gap >= CRACK_GAP_LIMIT_MM:
        issues.append(f"Critical: Crack gap {crack_gap:.3f} mm meets or exceeds the project threshold of {CRACK_GAP_LIMIT_MM:.2f} mm")
        recommendations.append("Arrange an urgent crack inspection and assess the need for repair")
        severity = "Critical"
    elif crack_gap >= CRACK_GAP_WARN_MM:
        issues.append(f"Monitor: Crack gap {crack_gap:.3f} mm meets or exceeds the project warning threshold of {CRACK_GAP_WARN_MM:.2f} mm")
        recommendations.append("Schedule crack repair within 30 days")
        if severity != "Critical":
            severity = "Monitor"

    if water_level >= WATER_LEVEL_LIMIT_M:
        issues.append(f"Critical: Water level {water_level:.2f} m meets or exceeds the project threshold of {WATER_LEVEL_LIMIT_M:.2f} m")
        recommendations.append("Arrange an urgent water-level and scour assessment; consider bridge closure")
        severity = "Critical"
    elif water_level >= WATER_LEVEL_WARN_M:
        issues.append(f"Monitor: Water level {water_level:.2f} m meets or exceeds the project warning threshold of {WATER_LEVEL_WARN_M:.2f} m")
        recommendations.append("Activate flood monitoring protocol and monitor pier scour daily")
        if severity != "Critical":
            severity = "Monitor"

    severity = get_bridge_condition(health_score, live_data)

    return {
        "issues": issues,
        "recommendations": recommendations,
        "severity": severity,
        "sensor_summary": {
            "vibration": vibration,
            "strain": strain,
            "crack_gap": crack_gap,
            "water_level": water_level,
            "health_score": health_score,
            "status": severity
        }
    }

async def run_inspection_agent(bridge_id: int, bridge_name: str) -> dict:
    # Step 1: Fetch all data
    all_data = await fetch_all_bridge_data(bridge_id)
    live_data = all_data.get("live", {})
    if not isinstance(live_data, dict) or "error" in live_data or not all(
        key in live_data for key in ("vibration", "strain", "crack_gap", "water_level", "health_score")
    ):
        raise ValueError("Current bridge sensor data is unavailable")
    
    # Step 2: Analyze sensors
    sensor_analysis = analyze_sensors(live_data)
    
    # Build the report solely from this bridge's live data and shared project thresholds.
    inspection_date = datetime.now(timezone(timedelta(hours=5, minutes=30))).date().isoformat()
    agent_prompt = f"""
Inspection date: {inspection_date}
Bridge: {bridge_name} (ID: {bridge_id})
Health score: {live_data.get('health_score', 'N/A')}/100
Overall condition: {sensor_analysis['severity']}

Current readings and project thresholds (Monitor / Critical):
- Vibration: {live_data.get('vibration', 'N/A')} g; {VIBRATION_WARN_G:.2f} / {VIBRATION_LIMIT_G:.2f} g
- Strain: {live_data.get('strain', 'N/A')} MPa; {STRAIN_WARN_MPA:.1f} / {STRAIN_LIMIT_MPA:.1f} MPa
- Crack gap: {live_data.get('crack_gap', 'N/A')} mm; {CRACK_GAP_WARN_MM:.2f} / {CRACK_GAP_LIMIT_MM:.2f} mm
- Water level: {live_data.get('water_level', 'N/A')} m; {WATER_LEVEL_WARN_M:.2f} / {WATER_LEVEL_LIMIT_M:.2f} m

Observed threshold findings:
{chr(10).join(sensor_analysis['issues']) if sensor_analysis['issues'] else 'No project thresholds are breached.'}

Write a Markdown report with these sentence-case sections:
### Executive summary
### Findings
### Sensor analysis
### Risk assessment
### Recommended actions
### Next inspection date

Explain each reading against the supplied project thresholds. Distinguish a suggested follow-up date from an observed fact. If a fact is unavailable, say so briefly. Do not invent data or cite standards.
"""

    # Step 5: Generate report with Groq
    api_key = os.getenv("GROQ_API_KEY")
    client = Groq(api_key=api_key)
    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": AGENT_SYSTEM_PROMPT},
            {"role": "user", "content": agent_prompt}
        ],
        max_tokens=2048,
        temperature=0.3,
    )
    
    report_text = completion.choices[0].message.content
    if not report_text and hasattr(completion.choices[0].message, "reasoning"):
        report_text = completion.choices[0].message.reasoning

    return {
        "bridge_id": bridge_id,
        "bridge_name": bridge_name,
        "severity": sensor_analysis["severity"],
        "health_score": live_data.get("health_score", 0),
        "inspection_date": inspection_date,
        "alert_level": sensor_analysis["severity"],
        "sensor_summary": sensor_analysis["sensor_summary"],
        "issues_detected": sensor_analysis["issues"],
        "recommendations": sensor_analysis["recommendations"],
        "full_report": report_text,
        "data_sources_used": list(all_data.keys()),
    }
