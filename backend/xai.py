import os
import json
from groq import Groq

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

XAI_SYSTEM_PROMPT = """You are an expert structural engineering AI for Indian bridges.
Your job is to explain anomalies in plain, technical language that a field engineer can act on.
Always cite specific sensor values, thresholds, and IRC standard numbers.
Be concise — max 4-5 sentences per explanation.
Never say "I think" or "possibly" — be direct and confident.
Never include emojis or emoticons in responses. Always maintain a formal, concise, and professional tone."""

def explain_anomaly(bridge_name: str, sensor_data: dict, anomaly_data: dict, alert_level: str) -> dict:
    vibration = sensor_data.get("vibration", 0)
    strain = sensor_data.get("strain", 0)
    crack_gap = sensor_data.get("crack_gap", 0)
    water_level = sensor_data.get("water_level", 0)
    health_score = sensor_data.get("health_score", 100)
    anomaly_score = sensor_data.get("anomaly_score", 0)
    
    # Identify which sensors are breaching thresholds per IRC standards
    vib_crit = SENSOR_THRESHOLDS["vibration"]["crit"]
    vib_warn = SENSOR_THRESHOLDS["vibration"]["warn"]
    str_crit = SENSOR_THRESHOLDS["strain"]["crit"]
    str_warn = SENSOR_THRESHOLDS["strain"]["warn"]
    crk_crit = CRACK_GAP_LIMIT_MM
    crk_warn = CRACK_GAP_WARN_MM
    wat_crit = WATER_LEVEL_LIMIT_M
    wat_warn = WATER_LEVEL_WARN_M

    triggered_sensors = []
    if vibration > vib_crit:
        triggered_sensors.append(f"Vibration {vibration:.3f}g (IRC:6-2017 threshold: {vib_crit}g) — CRITICAL breach")
    elif vibration > vib_warn:
        triggered_sensors.append(f"Vibration {vibration:.3f}g (approaching threshold of {vib_crit}g)")
    
    if strain > str_crit:
        triggered_sensors.append(f"Strain {strain:.1f} MPa (IRC:112-2011 limit: {str_crit:.0f} MPa) — CRITICAL breach")
    elif strain > str_warn:
        triggered_sensors.append(f"Strain {strain:.1f} MPa (approaching IRC:112 limit of {str_crit:.0f} MPa)")
    
    if crack_gap > crk_crit:
        triggered_sensors.append(f"Crack gap {crack_gap:.3f}mm (IRC:112-2011 limit: {crk_crit:.2f}mm) — CRITICAL breach")
    elif crack_gap > crk_warn:
        triggered_sensors.append(f"Crack gap {crack_gap:.3f}mm (approaching safe limit of {crk_crit:.2f}mm)")
    
    if water_level > wat_crit:
        triggered_sensors.append(f"Water level {water_level:.2f}m (IRC:6-2017 flood danger limit: {wat_crit:.2f}m) — CRITICAL breach")
    elif water_level > wat_warn:
        triggered_sensors.append(f"Water level {water_level:.2f}m (approaching flood danger limit of {wat_crit:.2f}m)")
    
    # Determine root cause context
    root_cause_hints = []
    if vibration > 0.8 and strain > 180:
        root_cause_hints.append("simultaneous high vibration and strain suggests heavy vehicle overloading")
    if crack_gap > 0.2 and strain > 170:
        root_cause_hints.append("crack growth correlating with high strain indicates progressive structural fatigue")
    if water_level > 3.5 and vibration > 0.6:
        root_cause_hints.append("elevated water level combined with vibration suggests scour or flood loading")
    if anomaly_score > 0.7:
        root_cause_hints.append(f"ML anomaly score of {anomaly_score:.2f} indicates pattern deviation from historical baseline")
    
    prompt = f"""
Bridge: {bridge_name}
Alert Level: {alert_level}
Health Score: {health_score}/100
Anomaly Score: {anomaly_score}

TRIGGERED SENSORS:
{chr(10).join(triggered_sensors) if triggered_sensors else 'No direct threshold breaches — anomaly detected by ML pattern recognition'}

ROOT CAUSE INDICATORS:
{chr(10).join(root_cause_hints) if root_cause_hints else 'Single-sensor anomaly — no compound cause detected'}

FULL SENSOR READINGS:
- Vibration: {vibration:.3f}g (IRC:6-2017 threshold: {vib_crit}g)
- Strain: {strain:.1f} MPa (IRC:112-2011 limit: {str_crit:.0f} MPa)  
- Crack Gap: {crack_gap:.3f}mm (IRC:112-2011 limit: {crk_crit:.2f}mm)
- Water Level: {water_level:.2f}m (IRC:6-2017 flood danger limit: {wat_crit:.2f}m)

Generate an XAI explanation with exactly these 4 sections:

**ROOT CAUSE**: (1-2 sentences — what is causing this anomaly, cite actual values)
**SENSOR CORRELATION**: (1-2 sentences — how the sensors relate to each other and confirm the issue)
**IRC STANDARD REFERENCE**: (1 sentence — which specific IRC standard is being violated or approached)
**ENGINEER ACTION**: (1-2 sentences — what the field engineer must do right now)
"""

    api_key = os.getenv("GROQ_API_KEY")
    explanation = None
    if api_key:
        try:
            client = Groq(api_key=api_key)
            completion = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": XAI_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=512,
                temperature=0.2,
            )
            explanation = completion.choices[0].message.content
        except Exception as e:
            print(f"[XAI] Groq API failed for anomaly explanation, falling back to rule-based generation: {e}")

    if not explanation or not explanation.strip():
        # Fallback explanation generator
        rc_parts = []
        if vibration > vib_crit:
            rc_parts.append(f"Vibration levels have reached {vibration:.3f}g, exceeding the IRC:6-2017 critical limit of {vib_crit}g.")
        elif vibration > vib_warn:
            rc_parts.append(f"Vibration levels are elevated at {vibration:.3f}g, approaching critical safety limits.")
            
        if strain > str_crit:
            rc_parts.append(f"Strain readings have breached the IRC:112-2011 ultimate limit state at {strain:.1f} MPa (limit: {str_crit:.0f} MPa).")
        elif strain > str_warn:
            rc_parts.append(f"Strain readings are highly elevated at {strain:.1f} MPa.")
            
        if crack_gap > crk_crit:
            rc_parts.append(f"Crack gap sensor reports critical widening of {crack_gap:.3f}mm exceeding the IRC:112-2011 limit of {crk_crit:.2f}mm.")
        elif crack_gap > crk_warn:
            rc_parts.append(f"Crack gap sensor shows progressive widening at {crack_gap:.3f}mm approaching the {crk_crit:.2f}mm limit.")
            
        if water_level > wat_crit:
            rc_parts.append(f"Water level has breached the IRC:6-2017 flood danger threshold at {water_level:.2f}m (critical limit: {wat_crit:.2f}m).")
        elif water_level > wat_warn:
            rc_parts.append(f"Water level is elevated at {water_level:.2f}m, approaching the flood danger limit of {wat_crit:.2f}m.")

        if not rc_parts:
            rc_parts.append(f"An anomaly was detected by the ML models due to pattern deviations in sensor correlations (Anomaly Score: {anomaly_score:.2f}).")

        root_cause = " ".join(rc_parts[:2])

        if vibration > vib_warn and strain > str_warn:
            correlation = f"High vibration ({vibration:.3f}g) and high strain ({strain:.1f} MPa) correlate directly, suggesting heavy overloading."
        elif crack_gap > crk_warn and strain > 170:
            correlation = f"Crack widening ({crack_gap:.3f}mm) correlating with high strain ({strain:.1f} MPa) indicates structural fatigue under load."
        elif water_level > 3.5 and vibration > 0.6:
            correlation = f"Elevated water level ({water_level:.2f}m) combined with increased vibrations suggests fluid-structure interaction or scour."
        else:
            correlation = f"Sensor correlation confirms an anomaly deviation score of {anomaly_score:.2f} compared to historical baseline signatures."

        # IRC reference
        if strain > str_warn:
            irc_ref = f"IRC:112-2011 limits concrete tensile strain ({str_crit:.0f} MPa) and dictates maximum allowable stress values."
        elif vibration > vib_warn:
            irc_ref = f"IRC:6-2017 establishes live load vibration and dynamic allowance factor thresholds ({vib_crit}g)."
        elif crack_gap > crk_warn:
            irc_ref = f"IRC:112-2011 Table 12.1 and IRC:SP:44-1996 establish maximum crack width limits ({crk_crit:.2f}mm) for concrete bridges."
        elif water_level > wat_warn:
            irc_ref = f"IRC:6-2017 Clause 213 specifies design flood discharge and High Flood Level (HFL) safety limits ({wat_crit:.2f}m)."
        else:
            irc_ref = "IRC:SP:51-2015 guidelines specify structural health monitoring systems and sensor deployment."

        # Engineer action
        if alert_level == "CRITICAL":
            action = f"Immediately suspend heavy traffic crossings and deploy a structural response team to inspect {bridge_name} bearings and girders."
        elif alert_level == "WARNING":
            action = "Deploy a maintenance crew to perform local inspection, sensor calibration, and structural checks within 48 hours."
        else:
            action = "Increase telemetry polling frequency and verify sensor battery levels and transmission logs."

        explanation = f"""**ROOT CAUSE**: {root_cause}
**SENSOR CORRELATION**: {correlation}
**IRC STANDARD REFERENCE**: {irc_ref}
**ENGINEER ACTION**: {action}"""
    
    return {
        "bridge_name": bridge_name,
        "alert_level": alert_level,
        "health_score": health_score,
        "anomaly_score": anomaly_score,
        "triggered_sensors": triggered_sensors,
        "root_cause_hints": root_cause_hints,
        "explanation": explanation,
        "sensor_data": sensor_data
    }
