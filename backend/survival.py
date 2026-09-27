import os
import json
import numpy as np
from groq import Groq

try:
    from backend.constants import SENSOR_THRESHOLDS, CRACK_GAP_LIMIT_MM, WATER_LEVEL_LIMIT_M
except ImportError:
    from constants import SENSOR_THRESHOLDS, CRACK_GAP_LIMIT_MM, WATER_LEVEL_LIMIT_M

GROQ_MODEL = "llama-3.3-70b-versatile"

def calculate_degradation_rate(health_score: float, anomaly_score: float, 
                               alert_level: str, bridge_id: int,
                               risk_score: float = 0.0, sensor_overload: float = 1.0) -> dict:
    if health_score >= 80:
        base_rate = 0.05
    elif health_score >= 60:
        base_rate = 0.15
    elif health_score >= 40:
        base_rate = 0.4
    else:
        base_rate = 0.7
    
    anomaly_multiplier = 1.0 + (anomaly_score * 0.8)
    alert_multipliers = {"NORMAL": 1.0, "WATCH": 1.2, "WARNING": 1.5, "CRITICAL": 2.0}
    alert_mult = alert_multipliers.get(alert_level, 1.0)
    age_factor = 1.0 + (bridge_id / 400)
    risk_multiplier = 1.0 + (max(0.0, min(1.0, float(risk_score))) * 1.5)
    overload_multiplier = max(1.0, float(sensor_overload))
    
    final_rate = base_rate * anomaly_multiplier * alert_mult * age_factor * risk_multiplier * overload_multiplier
    
    if alert_level == "CRITICAL" or health_score < 50.0:
        final_rate = max(1.8, final_rate)
    elif alert_level == "WARNING" or health_score <= 74.0:
        final_rate = max(0.5, final_rate)
    else:
        final_rate = max(0.05, final_rate)
    
    return {
        "daily_degradation_rate": round(final_rate, 3),
        "base_rate": base_rate,
        "anomaly_multiplier": round(anomaly_multiplier, 2),
        "alert_multiplier": alert_mult,
        "age_factor": round(age_factor, 2),
        "risk_multiplier": round(risk_multiplier, 2),
        "overload_multiplier": round(overload_multiplier, 2),
    }

def predict_time_to_threshold(health_score: float, degradation_rate: float, 
                               threshold: float) -> int:
    """Predict days until health score reaches a threshold."""
    if health_score <= threshold:
        return 0
    if degradation_rate <= 0:
        return 999
    days = (health_score - threshold) / degradation_rate
    return max(0, round(days))

def predict_sensor_failure(sensor_data: dict, bridge_id: int) -> list:
    """Predict which sensors are at risk of failure."""
    at_risk = []
    
    vibration = sensor_data.get("vibration", 0)
    strain = sensor_data.get("strain", 0)
    crack_gap = sensor_data.get("crack_gap", 0)
    water_level = sensor_data.get("water_level", 0)
    
    # Vibration sensor — at risk if > 50% of threshold
    vib_pct = vibration / 1.2
    if vib_pct > 0.5:
        days = round(max(3, (1.0 - vib_pct) * 30 * (200 / (bridge_id + 1))))
        at_risk.append({
            "sensor": "Vibration Sensor",
            "current": f"{vibration:.3f}g",
            "threshold": "1.2g",
            "usage_pct": round(vib_pct * 100, 1),
            "days_to_failure": days,
            "priority": "HIGH" if vib_pct > 0.8 else "MEDIUM"
        })
    
    # Strain sensor — at risk if > 50% of threshold
    strain_pct = strain / 210
    if strain_pct > 0.5:
        days = round(max(5, (1.0 - strain_pct) * 45 * (200 / (bridge_id + 1))))
        at_risk.append({
            "sensor": "Strain Gauge",
            "current": f"{strain:.1f} MPa",
            "threshold": "210 MPa",
            "usage_pct": round(strain_pct * 100, 1),
            "days_to_failure": days,
            "priority": "HIGH" if strain_pct > 0.8 else "MEDIUM"
        })
    
    # Crack gap — at risk if > 60% of threshold
    crack_pct = crack_gap / CRACK_GAP_LIMIT_MM
    if crack_pct > 0.6:
        days = round(max(2, (1.0 - crack_pct) * 20 * (200 / (bridge_id + 1))))
        at_risk.append({
            "sensor": "Crack Gap Monitor",
            "current": f"{crack_gap:.3f}mm",
            "threshold": f"{CRACK_GAP_LIMIT_MM:.2f}mm",
            "usage_pct": round(crack_pct * 100, 1),
            "days_to_failure": days,
            "priority": "CRITICAL" if crack_pct > 0.9 else "HIGH"
        })
    
    # Water level — at risk if > 70% of critical flood limit
    water_pct = water_level / WATER_LEVEL_LIMIT_M
    if water_pct > 0.7:
        days = round(max(1, (1.0 - water_pct) * 25 * (200 / (bridge_id + 1))))
        at_risk.append({
            "sensor": "Water Level / Flood Gauge",
            "current": f"{water_level:.2f}m",
            "threshold": f"{WATER_LEVEL_LIMIT_M:.2f}m",
            "usage_pct": round(water_pct * 100, 1),
            "days_to_failure": days,
            "priority": "CRITICAL" if water_pct >= 1.0 else "HIGH" if water_pct > 0.85 else "MEDIUM"
        })
    
    return at_risk

def generate_maintenance_schedule(bridge_name: str, health_score: float,
                                   days_to_warning: int, days_to_critical: int,
                                   days_to_failure: int, sensor_risks: list,
                                   degradation: dict) -> str:
    """Use Groq LLM to generate a natural language maintenance schedule, falling back to rules if API key is missing/fails."""
    
    api_key = os.getenv("GROQ_API_KEY")
    if api_key:
        try:
            client = Groq(api_key=api_key)
            
            sensor_risk_text = ""
            for s in sensor_risks:
                sensor_risk_text += f"- {s['sensor']}: {s['current']} ({s['usage_pct']}% of limit), failure in ~{s['days_to_failure']} days [{s['priority']}]\n"
            
            prompt = f"""
Bridge: {bridge_name}
Current Health Score: {health_score}/100
Daily Degradation Rate: {degradation['daily_degradation_rate']} points/day

SURVIVAL PREDICTIONS:
- Days to WARNING zone (health < 60): {days_to_warning} days
- Days to CRITICAL zone (health < 40): {days_to_critical} days  
- Days to FAILURE zone (health < 20): {days_to_failure} days

SENSOR RISKS:
{sensor_risk_text if sensor_risk_text else "No sensors at immediate risk"}

Generate a maintenance schedule with exactly these 3 sections:

**IMMEDIATE ACTIONS** (within 7 days):
List 2-3 specific actions needed now based on sensor risks and degradation rate.

**SCHEDULED MAINTENANCE** (7-30 days):
List 2-3 preventive maintenance tasks to slow degradation.

**LONG-TERM MONITORING** (30+ days):
List 2 monitoring recommendations to track bridge health trajectory.

Be specific with sensor names, IRC standards, and timeframes. Keep each point to 1 sentence.
"""
            
            completion = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": "You are a structural engineering maintenance planner for Indian bridges. Be specific, technical, and actionable. Never include emojis or emoticons in responses. Always maintain a formal, concise, and professional tone."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=600,
                temperature=0.2,
            )
            
            res = completion.choices[0].message.content
            if res and res.strip():
                return res
        except Exception as e:
            print(f"[SurvivalAnalysis] Groq API failed for maintenance schedule generation, falling back to rule-based generation: {e}")

    # Fallback rule-based maintenance generator
    immediate_items = []
    scheduled_items = []
    long_term_items = []

    # 1. Immediate Actions (within 7 days)
    if sensor_risks:
        for r in sensor_risks:
            sensor = r["sensor"]
            current = r["current"]
            usage = r["usage_pct"]
            days = r["days_to_failure"]
            if r["priority"] in ["CRITICAL", "HIGH"]:
                immediate_items.append(f"Deploy structural team to inspect {sensor} showing {usage}% usage of limits ({current}).")
            else:
                scheduled_items.append(f"Recalibrate and check electrical integrity of {sensor} showing elevated readings.")
    
    if health_score < 40:
        immediate_items.append(f"Impose immediate load/traffic restrictions on {bridge_name} per IRC:6 code guidelines.")
        immediate_items.append(f"Install emergency shoring and auxiliary structural support structures at critical piers.")
        scheduled_items.append("Repair cracked concrete sections using high-performance epoxy injection compounds.")
    elif health_score < 60:
        immediate_items.append(f"Schedule a visual crack inspection and displacement measurement on {bridge_name} within 7 days.")
        scheduled_items.append("Clean debris from deck drainage channels and lubricate expansion joint bearings.")
    else:
        immediate_items.append(f"Perform routine visual sensor check on {bridge_name} to confirm alignment.")
        scheduled_items.append("Execute standard electrical check on local signal logging and telemetry hardware.")

    # Fill defaults if empty
    if not immediate_items:
        immediate_items.append("Verify integrity of external sensor wiring connections and solar power backup.")
        immediate_items.append("Execute localized visual inspection of main steel girders and bearings.")
    if not scheduled_items:
        scheduled_items.append("Conduct calibration validation checks on all active strain gauges.")
        scheduled_items.append("Clean deck joints and ensure clear flow in bridge drainage spouts.")

    # 2. Long-term monitoring
    long_term_items.append(f"Monitor the daily health degradation rate of {degradation['daily_degradation_rate']} points/day closely.")
    long_term_items.append(f"Plan next comprehensive non-destructive testing (NDT) and ultrasonic mapping session.")
    long_term_items.append("Maintain weekly review of traffic count datasets against design bearing capacities.")

    fallback_text = f"""**IMMEDIATE ACTIONS** (within 7 days):
"""
    for item in immediate_items[:3]:
        fallback_text += f"- {item}\n"
    
    fallback_text += f"\n**SCHEDULED MAINTENANCE** (7-30 days):\n"
    for item in scheduled_items[:3]:
        fallback_text += f"- {item}\n"
    
    fallback_text += f"\n**LONG-TERM MONITORING** (30+ days):\n"
    for item in long_term_items[:3]:
        fallback_text += f"- {item}\n"

    return fallback_text

def run_survival_analysis(bridge_id: int, bridge_name: str, sensor_data: dict) -> dict:
    health_score = sensor_data.get("health_score", 100)
    anomaly_score = sensor_data.get("anomaly_score", 0)
    alert_level = sensor_data.get("alert_level", "NORMAL")
    
    risk_score = sensor_data.get("risk_score", 0.0)
    crack_gap = sensor_data.get("crack_gap", 0.0)
    vibration = sensor_data.get("vibration", 0.0)
    strain = sensor_data.get("strain", 0.0)
    water_level = sensor_data.get("water_level", 0.0)
    sensor_overload = max(
        1.0,
        crack_gap / CRACK_GAP_LIMIT_MM if CRACK_GAP_LIMIT_MM else 1.0,
        water_level / WATER_LEVEL_LIMIT_M if WATER_LEVEL_LIMIT_M else 1.0,
        vibration / 1.2,
        strain / 210.0,
    )

    # Calculate degradation
    degradation = calculate_degradation_rate(
        health_score, anomaly_score, alert_level, bridge_id,
        risk_score=risk_score, sensor_overload=sensor_overload
    )
    rate = degradation["daily_degradation_rate"]
    
    # Predict time to thresholds
    days_to_warning = predict_time_to_threshold(health_score, rate, 60)
    days_to_critical = predict_time_to_threshold(health_score, rate, 40)
    days_to_failure = predict_time_to_threshold(health_score, rate, 20)
    
    # Sensor failure predictions
    sensor_risks = predict_sensor_failure(sensor_data, bridge_id)
    
    # Generate maintenance schedule
    maintenance_text = generate_maintenance_schedule(
        bridge_name, health_score, days_to_warning, 
        days_to_critical, days_to_failure, sensor_risks, degradation
    )
    
    # Overall urgency
    if days_to_critical <= 0:
        urgency = "CRITICAL"
    elif days_to_critical <= 7:
        urgency = "HIGH"
    elif days_to_critical <= 30:
        urgency = "MEDIUM"
    else:
        urgency = "LOW"
    
    return {
        "bridge_id": bridge_id,
        "bridge_name": bridge_name,
        "health_score": health_score,
        "alert_level": alert_level,
        "urgency": urgency,
        "degradation_rate": degradation["daily_degradation_rate"],
        "survival_predictions": {
            "days_to_warning": days_to_warning,
            "days_to_critical": days_to_critical,
            "days_to_failure": days_to_failure
        },
        "sensor_risks": sensor_risks,
        "maintenance_schedule": maintenance_text,
        "degradation_breakdown": degradation
    }
