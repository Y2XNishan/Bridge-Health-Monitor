"""
Single source of truth for bridge sensor thresholds, engineering standards,
units, and status evaluation across the backend.

Standards Reference:
- Vibration: IRC:6-2017 Clause 204 / 219 (Dynamic allowance and vibration limits) -> 1.20 g
- Strain: IRC:112-2011 Section 12 (Serviceability Limit State tensile strain) -> 210.0 MPa
- Crack Gap: IRC:112-2011 Table 12.1 / IRC:SP:44-1996 (Crack control in RC structures) -> Safe limit: 0.30 mm, Watch: 0.20 mm
- Water Level: IRC:6-2017 Clause 213 / CWC Flood Standards -> Flood Danger limit: 5.50 m, Watch: 4.00 m
"""

SENSOR_THRESHOLDS = {
    "water_level": {
        "warn": 4.0,
        "crit": 5.5,
        "flood": 5.5,
        "unit": "m",
        "standard": "IRC:6-2017 Cl. 213 / CWC",
    },
    "vibration": {
        "warn": 0.8,
        "crit": 1.2,
        "unit": "g",
        "standard": "IRC:6-2017",
    },
    "strain": {
        "warn": 180.0,
        "crit": 210.0,
        "unit": "MPa",
        "standard": "IRC:112-2011",
    },
    "crack_gap": {
        "warn": 0.20,
        "crit": 0.30,
        "unit": "mm",
        "standard": "IRC:112-2011",
    },
}

CRACK_GAP_LIMIT_MM = SENSOR_THRESHOLDS["crack_gap"]["crit"]  # 0.30 mm
CRACK_GAP_WARN_MM = SENSOR_THRESHOLDS["crack_gap"]["warn"]   # 0.20 mm

WATER_LEVEL_LIMIT_M = SENSOR_THRESHOLDS["water_level"]["crit"]  # 5.50 m
WATER_LEVEL_WARN_M = SENSOR_THRESHOLDS["water_level"]["warn"]   # 4.00 m


def get_sensor_status_label(sensor_name: str, value: float) -> str:
    """Returns 'CRITICAL', 'WARNING', or 'NORMAL' based on standardized thresholds."""
    if sensor_name not in SENSOR_THRESHOLDS or value is None:
        return "NORMAL"
    t = SENSOR_THRESHOLDS[sensor_name]
    if value >= t["crit"]:
        return "CRITICAL"
    if value >= t["warn"]:
        return "WARNING"
    return "NORMAL"


def get_sensor_status_color(label: str) -> str:
    """Standardized badge hex colors."""
    if label == "CRITICAL":
        return "#DC2626"
    if label in ["WARNING", "ELEVATED", "MONITOR"]:
        return "#EA580C"
    return "#16A34A"
