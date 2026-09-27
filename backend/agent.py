import os
import json
import httpx
import asyncio
from pathlib import Path
from groq import Groq
try:
    from backend.rag import retrieve_context
except ImportError:
    from rag import retrieve_context

try:
    from backend.constants import (
        SENSOR_THRESHOLDS,
        CRACK_GAP_LIMIT_MM,
        CRACK_GAP_WARN_MM,
        WATER_LEVEL_LIMIT_M,
        WATER_LEVEL_WARN_M,
    )
except ImportError:
    from constants import (
        SENSOR_THRESHOLDS,
        CRACK_GAP_LIMIT_MM,
        CRACK_GAP_WARN_MM,
        WATER_LEVEL_LIMIT_M,
        WATER_LEVEL_WARN_M,
    )

GROQ_MODEL = "llama-3.3-70b-versatile"

AGENT_SYSTEM_PROMPT = """You are an expert Bridge Inspection AI Agent for Indian bridges.
You have access to live sensor data, anomaly scores, IRC standards, and maintenance history.
Your job is to analyze ALL available data and generate a comprehensive inspection report.
Always reference actual sensor values and IRC standards by number.
Be specific, technical, and actionable.
Format your response as a structured inspection report.
Never include emojis or emoticons in responses. Always maintain a formal, concise, and professional tone."""

async def fetch_all_bridge_data(bridge_id: int, base_url: str = "http://localhost:8000") -> dict:
    if base_url == "http://localhost:8000":
        base_url = os.getenv("BRIDGEIQ_INTERNAL_API_BASE_URL", "http://localhost:8000")
        
    endpoints = {
        "live": f"/api/live?bridge_id={bridge_id}",
        "anomaly": f"/api/anomaly?bridge_id={bridge_id}",
        "predict": f"/api/predict?bridge_id={bridge_id}",
        "alerts": f"/api/alerts?bridge_id={bridge_id}",
        "traffic": f"/api/traffic?bridge_id={bridge_id}",
        "maintenance": f"/api/maintenance/assignments",
    }
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
    severity = "NORMAL"

    vibration = live_data.get("vibration", 0)
    strain = live_data.get("strain", 0)
    crack_gap = live_data.get("crack_gap", 0)
    water_level = live_data.get("water_level", 0)
    health_score = live_data.get("health_score", 100)
    alert_level = live_data.get("alert_level", "NORMAL")

    if vibration > 1.2:
        issues.append(f"CRITICAL: Vibration {vibration:.3f}g exceeds IRC threshold of 1.2g")
        recommendations.append("Immediate load restriction required per IRC:6-2017 Section 4")
        severity = "CRITICAL"
    elif vibration > 0.8:
        issues.append(f"WARNING: Vibration {vibration:.3f}g approaching threshold")
        recommendations.append("Monitor vibration every 30 minutes")
        if severity != "CRITICAL":
            severity = "WARNING"

    if strain > 210:
        issues.append(f"CRITICAL: Strain {strain:.1f} MPa exceeds IRC:112-2011 limit of 210 MPa")
        recommendations.append("Structural assessment required within 24 hours")
        severity = "CRITICAL"
    elif strain > 180:
        issues.append(f"WARNING: Strain {strain:.1f} MPa approaching design limit")
        recommendations.append("Schedule structural inspection within 7 days")

    if crack_gap > CRACK_GAP_LIMIT_MM:
        issues.append(f"CRITICAL: Crack gap {crack_gap:.3f}mm exceeds IRC:112-2011 safe limit of {CRACK_GAP_LIMIT_MM:.2f}mm")
        recommendations.append("Emergency crack sealing required per IRC:112-2011 and NHAI inspection manual")
        severity = "CRITICAL"
    elif crack_gap > CRACK_GAP_WARN_MM:
        issues.append(f"WARNING: Crack gap {crack_gap:.3f}mm requires monitoring (approaching {CRACK_GAP_LIMIT_MM:.2f}mm limit)")
        recommendations.append("Schedule crack repair within 30 days")

    if water_level > WATER_LEVEL_LIMIT_M:
        issues.append(f"CRITICAL: Water level {water_level:.2f}m exceeds IRC:6-2017 flood danger limit of {WATER_LEVEL_LIMIT_M:.2f}m")
        recommendations.append("Emergency bridge closure and scour assessment required per IRC:6-2017")
        severity = "CRITICAL"
    elif water_level > WATER_LEVEL_WARN_M:
        issues.append(f"WARNING: Water level {water_level:.2f}m approaching flood danger limit of {WATER_LEVEL_LIMIT_M:.2f}m")
        recommendations.append("Activate flood monitoring protocol and monitor pier scour daily")
        if severity != "CRITICAL":
            severity = "WARNING"

    if health_score < 40:
        severity = "CRITICAL"
    elif health_score < 60 and severity == "NORMAL":
        severity = "WARNING"

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
            "alert_level": alert_level
        }
    }

async def run_inspection_agent(bridge_id: int, bridge_name: str) -> dict:
    # Step 1: Fetch all data
    all_data = await fetch_all_bridge_data(bridge_id)
    live_data = all_data.get("live", {})
    
    # Step 2: Analyze sensors
    sensor_analysis = analyze_sensors(live_data)
    
    # Step 3: Get relevant IRC standards
    query = f"bridge inspection {sensor_analysis['severity']} vibration strain crack"
    rag_context = retrieve_context(query)
    
    # Step 4: Build agent prompt
    agent_prompt = f"""
Bridge Inspection Request:
- Bridge: {bridge_name} (ID: {bridge_id})
- Health Score: {live_data.get('health_score', 'N/A')}/100
- Alert Level: {live_data.get('alert_level', 'N/A')}

SENSOR READINGS:
- Vibration: {live_data.get('vibration', 'N/A')}g (threshold: 1.2g)
- Strain: {live_data.get('strain', 'N/A')} MPa (limit: 210 MPa)  
- Crack Gap: {live_data.get('crack_gap', 'N/A')}mm (IRC:112-2011 limit: {CRACK_GAP_LIMIT_MM:.2f}mm)
- Water Level: {live_data.get('water_level', 'N/A')}m
- Anomaly Score: {live_data.get('anomaly_score', 'N/A')}

ML ANALYSIS:
- Anomaly Detection: {json.dumps(all_data.get('anomaly', {}), default=str)[:300]}
- Risk Prediction: {json.dumps(all_data.get('predict', {}), default=str)[:300]}

AUTOMATED ISSUE DETECTION:
{chr(10).join(sensor_analysis['issues']) if sensor_analysis['issues'] else 'No critical issues detected'}

IRC STANDARDS CONTEXT:
{rag_context}

Generate a complete bridge inspection report with:
1. EXECUTIVE SUMMARY (2-3 sentences)
2. CRITICAL FINDINGS (list each issue with IRC reference)
3. SENSOR ANALYSIS (interpret each reading)
4. RISK ASSESSMENT (overall risk level and reasoning)
5. IMMEDIATE ACTIONS REQUIRED (if any)
6. MAINTENANCE RECOMMENDATIONS (prioritized list)
7. NEXT INSPECTION DATE (recommend based on condition)
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

    return {
        "bridge_id": bridge_id,
        "bridge_name": bridge_name,
        "severity": sensor_analysis["severity"],
        "health_score": live_data.get("health_score", 0),
        "alert_level": live_data.get("alert_level", "NORMAL"),
        "sensor_summary": sensor_analysis["sensor_summary"],
        "issues_detected": sensor_analysis["issues"],
        "recommendations": sensor_analysis["recommendations"],
        "full_report": report_text,
        "data_sources_used": list(all_data.keys()),
    }
