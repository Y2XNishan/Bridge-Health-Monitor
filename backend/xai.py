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
CRITICAL MANDATE: Every sensor listed under TRIGGERED SENSORS must be explicitly analyzed and mentioned with its actual value in the ROOT CAUSE narrative. Never omit or drop any triggered sensor from the root cause explanation.
Be concise and direct — keep explanations professional, factual, and strictly aligned with all triggered sensors.
Never say "I think" or "possibly" — be direct and confident.
Never include emojis or emoticons in responses. Always maintain a formal, concise, and professional tone."""


def reconcile_explanation_with_triggered_sensors(
    explanation: str,
    triggered_sensors: list,
    sensor_data: dict,
    anomaly_score: float,
    alert_level: str,
    bridge_name: str
) -> str:
    """Ensures every triggered sensor is present in the ROOT CAUSE section of the explanation.
    If an LLM omitted any triggered sensor, this injects the missing sensor's finding."""
    if not explanation or not triggered_sensors:
        return explanation

    vibration = sensor_data.get("vibration", 0)
    strain = sensor_data.get("strain", 0)
    crack_gap = sensor_data.get("crack_gap", 0)
    water_level = sensor_data.get("water_level", 0)

    vib_warn = SENSOR_THRESHOLDS["vibration"]["warn"]
    vib_crit = SENSOR_THRESHOLDS["vibration"]["crit"]
    str_warn = SENSOR_THRESHOLDS["strain"]["warn"]
    str_crit = SENSOR_THRESHOLDS["strain"]["crit"]
    crk_warn = CRACK_GAP_WARN_MM
    crk_crit = CRACK_GAP_LIMIT_MM
    wat_warn = WATER_LEVEL_WARN_M
    wat_crit = WATER_LEVEL_LIMIT_M

    rc_idx = explanation.upper().find("ROOT CAUSE")
    if rc_idx == -1:
        return explanation

    next_headers = ["SENSOR CORRELATION", "IRC STANDARD REFERENCE", "ENGINEER ACTION"]
    next_idx = len(explanation)
    for h in next_headers:
        pos = explanation.upper().find(h, rc_idx + 10)
        if pos != -1:
            header_start = pos
            if header_start >= 2 and explanation[header_start-2:header_start] == "**":
                header_start -= 2
            elif header_start >= 1 and explanation[header_start-1] in ["#", "*"]:
                header_start -= 1
            if header_start < next_idx:
                next_idx = header_start

    rc_block = explanation[rc_idx:next_idx]
    rc_block_lower = rc_block.lower()

    missing_parts = []
    if vibration > vib_warn and not any(term in rc_block_lower for term in ["vibrat", "dynamic", "oscillation"]):
        if vibration > vib_crit:
            missing_parts.append(f"Vibration levels have reached {vibration:.3f}g, exceeding the IRC:6-2017 critical limit of {vib_crit}g.")
        else:
            missing_parts.append(f"Vibration levels are elevated at {vibration:.3f}g, approaching critical safety limits.")

    if strain > str_warn and "strain" not in rc_block_lower:
        if strain > str_crit:
            missing_parts.append(f"Strain readings have breached the IRC:112-2011 limit at {strain:.1f} MPa (limit: {str_crit:.0f} MPa).")
        else:
            missing_parts.append(f"Strain readings are elevated at {strain:.1f} MPa.")

    if crack_gap > crk_warn and not any(term in rc_block_lower for term in ["crack", "fracture"]):
        if crack_gap > crk_crit:
            missing_parts.append(f"Crack gap sensor reports critical widening of {crack_gap:.3f}mm exceeding the IRC:112-2011 limit of {crk_crit:.2f}mm.")
        else:
            missing_parts.append(f"Crack gap sensor shows progressive widening at {crack_gap:.3f}mm.")

    if water_level > wat_warn and not any(term in rc_block_lower for term in ["water", "flood", "scour", "hydraulic"]):
        if water_level > wat_crit:
            missing_parts.append(f"Water level has breached the IRC:6-2017 flood danger threshold at {water_level:.2f}m (critical limit: {wat_crit:.2f}m).")
        else:
            missing_parts.append(f"Water level is elevated at {water_level:.2f}m, approaching the flood danger limit of {wat_crit:.2f}m.")

    if not missing_parts:
        return explanation

    missing_text = " " + " ".join(missing_parts)
    before_next = explanation[:next_idx].rstrip()
    after_next = explanation[next_idx:]
    return f"{before_next}{missing_text}\n\n{after_next.lstrip()}"


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
    
    # Determine root cause indicators for every triggered sensor
    root_cause_hints = []
    if vibration > vib_crit:
        root_cause_hints.append(f"vibration at {vibration:.3f}g breaches critical threshold ({vib_crit}g), indicating severe dynamic oscillation or heavy vehicle impact")
    elif vibration > vib_warn:
        root_cause_hints.append(f"vibration at {vibration:.3f}g is elevated above warning threshold ({vib_warn}g)")

    if strain > str_crit:
        root_cause_hints.append(f"strain at {strain:.1f} MPa breaches critical limit ({str_crit:.0f} MPa), indicating severe tensile stress")
    elif strain > str_warn:
        root_cause_hints.append(f"strain at {strain:.1f} MPa is elevated above serviceability limits")

    if crack_gap > crk_crit:
        root_cause_hints.append(f"crack gap at {crack_gap:.3f}mm breaches permissible limit ({crk_crit:.2f}mm), indicating structural crack expansion")
    elif crack_gap > crk_warn:
        root_cause_hints.append(f"crack gap at {crack_gap:.3f}mm is widening above warning limit ({crk_warn:.2f}mm)")

    if water_level > wat_crit:
        root_cause_hints.append(f"water level at {water_level:.2f}m breaches flood danger limit ({wat_crit:.2f}m), indicating severe hydrodynamic pressure and scour threat")
    elif water_level > wat_warn:
        root_cause_hints.append(f"water level at {water_level:.2f}m is elevated above flood warning threshold ({wat_warn:.2f}m)")

    # Compound interactions
    if vibration > vib_warn and strain > str_warn:
        root_cause_hints.append("simultaneous high vibration and strain indicates heavy vehicle overloading")
    if crack_gap > crk_warn and strain > str_warn:
        root_cause_hints.append("crack growth correlating with high strain indicates progressive structural fatigue under load")
    if water_level > wat_warn and vibration > vib_warn:
        root_cause_hints.append("elevated water level combined with vibration suggests hydrodynamic scour and fluid-structure excitation")
    if water_level > wat_warn and crack_gap > crk_warn:
        root_cause_hints.append("elevated water level combined with crack widening suggests substructure hydraulic settlement and scour")
    if vibration > vib_warn and crack_gap > crk_warn and not (water_level > wat_warn):
        root_cause_hints.append("elevated vibration is accelerating structural crack propagation")
    if water_level > wat_warn and vibration > vib_warn and crack_gap > crk_warn:
        root_cause_hints.append("concurrent flood loading, dynamic vibration, and crack widening indicate multi-hazard substructure and superstructure distress")
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

CRITICAL INSTRUCTION:
Every sensor listed under TRIGGERED SENSORS must be explicitly analyzed and mentioned with its actual value in the ROOT CAUSE narrative. Do NOT omit or drop any sensor listed under TRIGGERED SENSORS.

Generate an XAI explanation with exactly these 4 sections:

**ROOT CAUSE**: (Synthesize and cite every sensor listed in TRIGGERED SENSORS with its actual value, explaining how each contributes to the anomaly)
**SENSOR CORRELATION**: (1-2 sentences — how the triggered sensors relate to each other or compounding physical effects)
**IRC STANDARD REFERENCE**: (Cite the specific IRC standards corresponding to all triggered sensors)
**ENGINEER ACTION**: (1-2 sentences — immediate actionable directives for the field engineer)
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
            raw_explanation = completion.choices[0].message.content
            if raw_explanation and raw_explanation.strip():
                explanation = reconcile_explanation_with_triggered_sensors(
                    raw_explanation,
                    triggered_sensors,
                    sensor_data,
                    anomaly_score,
                    alert_level,
                    bridge_name
                )
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

        # Include all triggered sensors in the root cause narrative (no truncation)
        root_cause = " ".join(rc_parts)

        correlations = []
        if vibration > vib_warn and strain > str_warn:
            correlations.append(f"High vibration ({vibration:.3f}g) and high strain ({strain:.1f} MPa) correlate directly, suggesting heavy overloading.")
        if crack_gap > crk_warn and strain > str_warn:
            correlations.append(f"Crack widening ({crack_gap:.3f}mm) correlating with high strain ({strain:.1f} MPa) indicates progressive structural fatigue under load.")
        if water_level > wat_warn and vibration > vib_warn:
            correlations.append(f"Elevated water level ({water_level:.2f}m) combined with increased vibrations ({vibration:.3f}g) suggests hydrodynamic scour and fluid-structure interaction.")
        if water_level > wat_warn and crack_gap > crk_warn:
            correlations.append(f"Elevated water level ({water_level:.2f}m) alongside crack expansion ({crack_gap:.3f}mm) suggests potential substructure hydraulic displacement or scour.")
        if vibration > vib_warn and crack_gap > crk_warn and not (water_level > wat_warn):
            correlations.append(f"Dynamic oscillation ({vibration:.3f}g) is directly exacerbating crack gap displacement ({crack_gap:.3f}mm).")

        if not correlations:
            if len(triggered_sensors) > 1:
                correlations.append(f"Telemetry channels ({len(triggered_sensors)} triggered) confirm compounding operational stress exceeding design baselines.")
            elif len(triggered_sensors) == 1:
                correlations.append("Isolated sensor threshold breach with localized stress concentration.")
            else:
                correlations.append(f"Sensor correlation confirms an anomaly deviation score of {anomaly_score:.2f} compared to historical baseline signatures.")
        correlation = " ".join(correlations)

        # IRC references for all triggered sensors
        irc_refs = []
        if vibration > vib_warn:
            irc_refs.append(f"IRC:6-2017 Clause 204 (dynamic vibration limit: {vib_crit}g)")
        if strain > str_warn:
            irc_refs.append(f"IRC:112-2011 Section 12 (tensile strain limit: {str_crit:.0f} MPa)")
        if crack_gap > crk_warn:
            irc_refs.append(f"IRC:112-2011 Table 12.1 / IRC:SP:44-1996 (crack width limit: {crk_crit:.2f}mm)")
        if water_level > wat_warn:
            irc_refs.append(f"IRC:6-2017 Clause 213 (flood danger limit: {wat_crit:.2f}m)")

        if irc_refs:
            irc_ref = f"Applicable engineering standards violated or approached: {'; '.join(irc_refs)}."
        else:
            irc_ref = "IRC:SP:51-2015 guidelines specify structural health monitoring systems and sensor deployment."

        # Engineer action tailored to triggered conditions
        action_parts = []
        if water_level > wat_crit:
            action_parts.append(f"Inspect bridge piers and abutments for scour and monitor river discharge at {bridge_name}.")
        elif water_level > wat_warn:
            action_parts.append(f"Monitor river stage and check pier scour sensors at {bridge_name}.")
            
        if crack_gap > crk_crit:
            action_parts.append("Install displacement gauges and conduct immediate crack depth inspection.")
        elif crack_gap > crk_warn:
            action_parts.append("Schedule visual inspection of crack progression within 48 hours.")
            
        if vibration > vib_crit or strain > str_crit:
            action_parts.append(f"Enforce speed restrictions and suspend heavy vehicle transit across {bridge_name}.")
        elif vibration > vib_warn or strain > str_warn:
            action_parts.append("Verify axle weigh-in-motion calibration and inspect deck expansion joints.")
            
        if alert_level == "CRITICAL":
            base_action = f"Immediately deploy an emergency structural response team to {bridge_name}."
        elif alert_level == "WARNING":
            base_action = f"Deploy a maintenance crew to perform local inspection and structural checks within 48 hours."
        else:
            base_action = "Increase telemetry polling frequency and verify sensor telemetry calibrations."
            
        if action_parts:
            action = f"{base_action} {' '.join(action_parts)}"
        else:
            action = base_action

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
