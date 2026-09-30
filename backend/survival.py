"""Simulated bridge health forecasts for the predictive maintenance tab.

Health-score boundaries here are separate from the shared sensor thresholds.
All rates and repair outcomes are illustrative estimates, not guarantees.
"""

from datetime import date, datetime, timedelta, timezone
import math

try:
    from backend.constants import HEALTH_BOUNDARIES, SENSOR_THRESHOLDS, get_bridge_condition, get_sensor_status
except ImportError:
    from constants import HEALTH_BOUNDARIES, SENSOR_THRESHOLDS, get_bridge_condition, get_sensor_status


SENSOR_LABELS = {
    "vibration": "Vibration",
    "strain": "Strain",
    "crack_gap": "Crack gap",
    "water_level": "Water level",
}


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _analysis_date(value=None):
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    return datetime.now(timezone(timedelta(hours=5, minutes=30))).date()


def health_condition(health_score):
    score = _number(health_score)
    if score is None or not 0 <= score <= 100:
        return "Unavailable"
    if score <= HEALTH_BOUNDARIES["critical"]:
        return "Critical"
    if score <= HEALTH_BOUNDARIES["monitor"]:
        return "Monitor"
    return "Healthy"


def sensor_readings(sensor_data):
    readings = []
    for key, label in SENSOR_LABELS.items():
        value = _number(sensor_data.get(key))
        threshold = SENSOR_THRESHOLDS[key]
        ratio = value / threshold["crit"] if value is not None else None
        readings.append({
            "key": key,
            "sensor": label,
            "reading": value,
            "unit": threshold["unit"],
            "critical_threshold": threshold["crit"],
            "ratio_pct": round(ratio * 100, 1) if ratio is not None else None,
            "condition": get_sensor_status(key, value) if value is not None else "Unavailable",
        })
    return readings


def calculate_degradation_rate(health_score: float, anomaly_score: float,
                               alert_level: str, bridge_id: int,
                               risk_score: float = 0.0, sensor_overload: float = 1.0) -> dict:
    """Return one rounded daily rate and every factor used to calculate it.

    The legacy arguments remain for other callers; bridge ID and alert level
    are not used as proxies for physical age or structural condition.
    """
    _ = (alert_level, bridge_id)
    score = _number(health_score)
    if score is None or not 0 <= score <= 100:
        return {"daily_degradation_rate": None, "unavailable_reason": "Health score is unavailable"}

    if score >= 80:
        base_rate = 0.05
    elif score >= HEALTH_BOUNDARIES["monitor"]:
        base_rate = 0.15
    elif score >= HEALTH_BOUNDARIES["critical"]:
        base_rate = 0.4
    else:
        base_rate = 0.7

    anomaly = _number(anomaly_score)
    risk = _number(risk_score)
    sensor_ratio = _number(sensor_overload)
    anomaly_multiplier = 1 + max(0, min(1, anomaly)) * 0.8 if anomaly is not None else 1.0
    risk_multiplier = 1 + max(0, min(1, risk)) * 1.5 if risk is not None else 1.0
    sensor_multiplier = max(1.0, sensor_ratio) if sensor_ratio is not None else 1.0
    condition = health_condition(score)
    minimum_rate = {"Critical": 1.8, "Monitor": 0.5, "Healthy": 0.05}[condition]
    raw_rate = base_rate * anomaly_multiplier * risk_multiplier * sensor_multiplier
    rate = round(max(raw_rate, minimum_rate), 3)

    return {
        "daily_degradation_rate": rate,
        "base_rate": base_rate,
        "anomaly_multiplier": round(anomaly_multiplier, 3),
        "risk_multiplier": round(risk_multiplier, 3),
        "sensor_multiplier": round(sensor_multiplier, 3),
        "minimum_rate": minimum_rate,
        "raw_rate": round(raw_rate, 3),
        "anomaly_available": anomaly is not None,
        "risk_available": risk is not None,
        "sensor_available": sensor_ratio is not None,
        "formula": "max(base rate × anomaly factor × risk factor × sensor factor, condition floor)",
    }


def predict_time_to_threshold(health_score: float, degradation_rate: float,
                              threshold: float) -> int | None:
    """First whole day on which projected health reaches a boundary."""
    score = _number(health_score)
    rate = _number(degradation_rate)
    if score is None or rate is None or rate <= 0:
        return None
    if score <= threshold:
        return 0
    return max(0, math.ceil((score - threshold) / rate - 1e-10))


def _forecast(bridge_id, bridge_name, sensor_data, as_of=None):
    score = _number(sensor_data.get("health_score"))
    readings = sensor_readings(sensor_data)
    available_ratios = [item["reading"] / item["critical_threshold"] for item in readings if item["reading"] is not None]
    overload = max(1.0, *available_ratios) if available_ratios else None
    degradation = calculate_degradation_rate(
        score, sensor_data.get("anomaly_score"), sensor_data.get("alert_level"), bridge_id,
        risk_score=sensor_data.get("risk_score"), sensor_overload=overload,
    )
    rate = degradation["daily_degradation_rate"]
    predictions = {
        "days_to_warning": predict_time_to_threshold(score, rate, HEALTH_BOUNDARIES["monitor"]),
        "days_to_critical": predict_time_to_threshold(score, rate, HEALTH_BOUNDARIES["critical"]),
        "days_to_failure": predict_time_to_threshold(score, rate, HEALTH_BOUNDARIES["failure"]),
    }
    condition = get_bridge_condition(score, sensor_data)
    critical_days = predictions["days_to_critical"]
    if condition == "Critical":
        urgency = "CRITICAL"
    elif critical_days is None:
        urgency = "MEDIUM" if condition == "Monitor" else "UNAVAILABLE"
    elif condition == "Monitor" and critical_days > 30:
        urgency = "MEDIUM"
    elif critical_days == 0:
        urgency = "CRITICAL"
    elif critical_days <= 7:
        urgency = "HIGH"
    elif critical_days <= 30:
        urgency = "MEDIUM"
    else:
        urgency = "LOW"
    today = _analysis_date(as_of)
    return {
        "bridge_id": bridge_id,
        "bridge_name": bridge_name,
        "health_score": score,
        "health_condition": condition,
        "alert_level": condition,
        "urgency": urgency,
        "analysis_date": today.isoformat(),
        "health_boundaries": HEALTH_BOUNDARIES.copy(),
        "degradation_rate": rate,
        "degradation_breakdown": degradation,
        "survival_predictions": predictions,
        "forecast_dates": {
            name: (today + timedelta(days=days)).isoformat() if days is not None else None
            for name, days in predictions.items()
        },
        "sensor_readings": readings,
        "estimate_note": "Simulated estimates from current readings and project thresholds; actual condition requires inspection.",
    }


def build_survival_overview(bridge_id, bridge_name, sensor_data, as_of=None):
    """The network and detail views use the same forecast calculation."""
    return _forecast(bridge_id, bridge_name, sensor_data, as_of)


def generate_maintenance_schedule(health_score, readings):
    """Return grounded actions in separate sections, without invented work."""
    condition = get_bridge_condition(
        health_score, {item["key"]: item["reading"] for item in readings}
    )
    critical = [item for item in readings if item["condition"] == "Critical"]
    monitor = [item for item in readings if item["condition"] == "Monitor"]
    immediate = []
    scheduled = []
    long_term = []

    if condition == "Critical":
        immediate.append("Arrange a qualified on-site structural assessment before deciding on restrictions or repairs.")
    elif condition == "Unavailable":
        immediate.append("Confirm the current health score before using this forecast.")

    for item in critical:
        immediate.append(
            f"Verify the {item['sensor'].lower()} reading against its project critical threshold and inspect the associated bridge condition."
        )
    for item in monitor:
        scheduled.append(
            f"Repeat the {item['sensor'].lower()} reading and inspect the associated bridge condition before planning work."
        )
    if not immediate:
        immediate.append("No immediate action is indicated by the available readings.")
    if not scheduled:
        scheduled.append("Continue routine visual inspection and review readings for changes.")
    long_term.append("Track health score and sensor readings against project thresholds as new data arrives.")
    long_term.append("Recalculate this simulated forecast after an inspection or a material change in readings.")
    return {"immediate": immediate, "scheduled": scheduled, "long_term": long_term}


def run_survival_analysis(bridge_id: int, bridge_name: str, sensor_data: dict) -> dict:
    result = _forecast(bridge_id, bridge_name, sensor_data)
    result["maintenance_schedule"] = generate_maintenance_schedule(
        result["health_score"], result["sensor_readings"]
    )
    return result


def _repair_scenario(score, rate, failure_day, repair_day, post_health, today):
    if failure_day is None:
        return {"available": False, "reason": "A baseline forecast is unavailable"}
    if repair_day >= failure_day:
        return {"available": False, "reason": "The simulated failure boundary was reached on or before the selected repair day"}
    health_at_repair = max(HEALTH_BOUNDARIES["failure"], score - rate * repair_day)
    if post_health < health_at_repair:
        return {"available": False, "reason": "Assumed post-repair health is below health at repair"}
    if post_health <= HEALTH_BOUNDARIES["failure"]:
        return {"available": False, "reason": "Assumed post-repair health is at the failure boundary"}
    days_after = predict_time_to_threshold(post_health, rate, HEALTH_BOUNDARIES["failure"])
    total = repair_day + days_after
    return {
        "available": True,
        "health_at_repair": round(health_at_repair, 1),
        "post_repair_health": round(post_health, 1),
        "days_after_repair": days_after,
        "total_days_from_today": total,
        "additional_days_gained": total - failure_day,
        "repaired_failure_date": (today + timedelta(days=total)).isoformat(),
    }


def simulate_repair(health_score, degradation_rate, repair_day, post_repair_health, analysis_date=None):
    """Compare the baseline and a user-assumed repair outcome at the same boundary."""
    score = _number(health_score)
    rate = _number(degradation_rate)
    post_health = _number(post_repair_health)
    day = int(repair_day)
    if day < 0 or post_health is None or not 0 <= post_health <= 100:
        raise ValueError("Repair day and assumed post-repair health must be valid")
    today = _analysis_date(analysis_date)
    baseline_days = predict_time_to_threshold(score, rate, HEALTH_BOUNDARIES["failure"])
    selected = _repair_scenario(score, rate, baseline_days, day, post_health, today)
    comparison_days = sorted({0, 7, 15, day})
    comparison = [{"repair_day": candidate, **_repair_scenario(score, rate, baseline_days, candidate, post_health, today)}
                  for candidate in comparison_days]

    horizon = max(30, day, baseline_days or 0, selected.get("total_days_from_today") or 0)
    step = max(1, math.ceil(horizon / 120))
    sample_days = sorted(set(range(0, horizon + 1, step)) | {
        0, day, horizon, baseline_days or 0, selected.get("total_days_from_today") or 0
    })
    chart = []
    for sample_day in sample_days:
        baseline = (round(max(HEALTH_BOUNDARIES["failure"], score - rate * sample_day), 1)
                    if baseline_days is not None and sample_day <= baseline_days else None)
        repaired = None
        if selected["available"]:
            if sample_day < day:
                repaired = baseline
            elif sample_day <= selected["total_days_from_today"]:
                repaired = round(max(HEALTH_BOUNDARIES["failure"], post_health - rate * (sample_day - day)), 1)
        if selected["available"] and sample_day == day:
            chart.append({"day": sample_day, "without_repair": baseline, "with_repair": selected["health_at_repair"]})
        chart.append({"day": sample_day, "without_repair": baseline, "with_repair": repaired})

    return {
        "analysis_date": today.isoformat(),
        "failure_boundary": HEALTH_BOUNDARIES["failure"],
        "baseline_days": baseline_days,
        "baseline_failure_date": (today + timedelta(days=baseline_days)).isoformat() if baseline_days is not None else None,
        "repair_day": day,
        "repair_date": (today + timedelta(days=day)).isoformat(),
        "assumed_post_repair_health": post_health,
        "scenario": selected,
        "comparison": comparison,
        "chart_data": chart,
        "estimate_note": "Simulated estimate using an assumed post-repair health score; no repair outcome is guaranteed.",
    }
