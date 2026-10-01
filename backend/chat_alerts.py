"""Evidence-based network alerts for the Bridge Assistant."""

import math

try:
    from backend.constants import HEALTH_BOUNDARIES, SENSOR_THRESHOLDS, get_bridge_condition, get_sensor_status
except ImportError:
    from constants import HEALTH_BOUNDARIES, SENSOR_THRESHOLDS, get_bridge_condition, get_sensor_status


SENSOR_NAMES = {
    "water_level": "Water level",
    "vibration": "Vibration",
    "strain": "Strain",
    "crack_gap": "Crack gap",
}


def _number(value):
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def sensor_breaches(readings: dict) -> list[dict]:
    """List every project Monitor or Critical sensor breach with its unit."""
    breaches = []
    for sensor, threshold in SENSOR_THRESHOLDS.items():
        value = _number(readings.get(sensor))
        if value is None:
            continue
        status = get_sensor_status(sensor, value)
        if status == "Healthy":
            continue
        breaches.append({
            "sensor": sensor,
            "label": SENSOR_NAMES[sensor],
            "reading": value,
            "unit": threshold["unit"],
            "status": status,
            "threshold": threshold["crit"] if status == "Critical" else threshold["warn"],
        })
    return breaches


def build_critical_alert(bridge: dict, readings: dict) -> dict | None:
    """Return a Critical alert only when a recorded score or sensor caused it."""
    score = _number(readings.get("health_score"))
    condition = get_bridge_condition(score, readings)
    if condition != "Critical":
        return None

    breaches = sensor_breaches(readings)

    triggers = []
    if score is not None and score <= HEALTH_BOUNDARIES["critical"]:
        triggers.append(f"Health score {score:.1f}/100 reached the Critical boundary ({HEALTH_BOUNDARIES['critical']:.0f}/100)")
    for breach in breaches:
        if breach["status"] == "Critical":
            triggers.append(
                f"{breach['label']} {breach['reading']:.3f} {breach['unit']} reached the project Critical threshold "
                f"({breach['threshold']:.3f} {breach['unit']})"
            )
    if not triggers:
        return None

    return {
        "bridge_id": bridge["id"],
        "bridge_name": bridge["name"],
        "condition": condition,
        "health_score": score,
        "triggers": triggers,
        "breaches": breaches,
    }
