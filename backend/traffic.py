import random
from datetime import datetime, date
from collections import deque

VEHICLE_TYPES = [
    {
        "type": "Motorcycle",
        "min_vib": 0.30, "max_vib": 0.50,
        "min_dur": 1.0,  "max_dur": 2.5,
        "min_strain_delta": 2,  "max_strain_delta": 8,
        "typical_tonnes": 0.3,
        "overload_threshold": None,
        "icon": ""
    },
    {
        "type": "Car / SUV",
        "min_vib": 0.45, "max_vib": 0.75,
        "min_dur": 2.0,  "max_dur": 4.5,
        "min_strain_delta": 5,  "max_strain_delta": 18,
        "typical_tonnes": 1.8,
        "overload_threshold": None,
        "icon": ""
    },
    {
        "type": "Bus",
        "min_vib": 0.75, "max_vib": 1.15,
        "min_dur": 3.0,  "max_dur": 7.0,
        "min_strain_delta": 15, "max_strain_delta": 32,
        "typical_tonnes": 12.0,
        "overload_threshold": None,
        "icon": ""
    },
    {
        "type": "Light Truck",
        "min_vib": 0.95, "max_vib": 1.35,
        "min_dur": 4.0,  "max_dur": 8.0,
        "min_strain_delta": 25, "max_strain_delta": 42,
        "typical_tonnes": 8.0,
        "overload_threshold": 10.0,
        "icon": ""
    },
    {
        "type": "Heavy Truck",
        "min_vib": 1.30, "max_vib": 1.75,
        "min_dur": 5.0,  "max_dur": 11.0,
        "min_strain_delta": 35, "max_strain_delta": 58,
        "typical_tonnes": 25.0,
        "overload_threshold": 40.0,
        "icon": ""
    },
    {
        "type": "Overloaded Truck",
        "min_vib": 1.70, "max_vib": 2.50,
        "min_dur": 6.0,  "max_dur": 14.0,
        "min_strain_delta": 55, "max_strain_delta": 95,
        "typical_tonnes": 55.0,
        "overload_threshold": 40.0,
        "icon": ""
    },
]

HOURLY_TRAFFIC_PATTERN = [
    3, 2, 1, 1, 2, 5, 18, 45, 62, 48, 35, 40,
    52, 44, 38, 42, 55, 68, 58, 35, 22, 15, 8, 4
]

def classify_vehicle(peak_vib, strain_delta, duration):
    """
    Classify a vehicle crossing event based on peak vibration, strain delta, and duration.
    Returns a dict with type, load_estimate_tonnes, overloaded, and confidence.
    """
    def get_param_score(val, low, high):
        if low <= val <= high:
            return 1.0
        width = high - low
        if width <= 0.0:
            width = 1.0
        dist = min(abs(val - low), abs(val - high))
        return max(0.0, 1.0 - dist / width)

    if peak_vib > 1.70:
        matched_type = next((v for v in VEHICLE_TYPES if v["type"] == "Overloaded Truck"), None)
    else:
        best_score = -1.0
        matched_type = None
        for vt in VEHICLE_TYPES:
            score = (
                get_param_score(peak_vib, vt["min_vib"], vt["max_vib"]) +
                get_param_score(duration, vt["min_dur"], vt["max_dur"]) +
                get_param_score(strain_delta, vt["min_strain_delta"], vt["max_strain_delta"])
            ) / 3.0
            if score > best_score:
                best_score = score
                matched_type = vt
        
        if matched_type is None or best_score <= 0.0:
            matched_type = next((v for v in VEHICLE_TYPES if v["type"] == "Car / SUV"), None)

    vt = matched_type
    
    # Calculate confidence based on matched type
    vib_score = get_param_score(peak_vib, vt["min_vib"], vt["max_vib"])
    dur_score = get_param_score(duration, vt["min_dur"], vt["max_dur"])
    str_score = get_param_score(strain_delta, vt["min_strain_delta"], vt["max_strain_delta"])
    confidence = (vib_score + dur_score + str_score) / 3.0

    # Add load estimate (typical tonnes ±20%)
    load = vt["typical_tonnes"] * (1.0 + random.uniform(-0.20, 0.20))

    # Overload detection
    overloaded = False
    if vt["overload_threshold"] is not None:
        overloaded = load > vt["overload_threshold"]

    return {
        "type": vt["type"],
        "load_estimate_tonnes": load,
        "overloaded": overloaded,
        "confidence": confidence,
        "icon": vt["icon"]
    }

def generate_crossing_event(bridge_id, current_vib=None, current_strain=None, baseline_strain=145.0, timestamp=None):
    """
    Attempt to generate a crossing event based on current telemetry and traffic probability.
    """
    if timestamp is None:
        timestamp = datetime.now()

    # If parameters are not provided, we generate a random event directly (useful for seeding/demo)
    if current_vib is None or current_strain is None:
        vt = random.choice(VEHICLE_TYPES)
        peak_vib = random.uniform(vt["min_vib"], vt["max_vib"])
        duration = random.uniform(vt["min_dur"], vt["max_dur"])
        strain_delta = random.uniform(vt["min_strain_delta"], vt["max_strain_delta"])
    else:
        if current_vib <= 0.42:
            return None

        hour = timestamp.hour
        base_prob = HOURLY_TRAFFIC_PATTERN[hour] / 100.0
        if random.random() >= base_prob:
            return None

        # Generate realistic crossing parameters
        peak_vib = current_vib + random.uniform(0.0, 0.15)
        
        # Scale duration between 1.5s and 12.0s based on vibration level
        ratio = min(1.0, max(0.0, (peak_vib - 0.30) / 2.2))
        duration = 1.5 + ratio * 10.5 + random.uniform(-0.5, 0.5)
        duration = min(12.0, max(1.5, duration))

        strain_delta = current_strain - baseline_strain + random.uniform(2.0, 15.0)
        strain_delta = max(1.0, strain_delta)

    classified = classify_vehicle(peak_vib, strain_delta, duration)

    # Determine alert level based on status
    overloaded = classified["overloaded"]
    vtype = classified["type"]
    if overloaded:
        alert_level = "CRITICAL"
    elif vtype == "Heavy Truck":
        alert_level = "WARNING"
    elif vtype in ["Light Truck", "Bus"]:
        alert_level = "WATCH"
    else:
        alert_level = "NORMAL"

    return {
        "bridge_id": bridge_id,
        "timestamp": timestamp.strftime("%Y-%m-%d %H:%M:%S") if isinstance(timestamp, datetime) else str(timestamp),
        "vehicle_type": vtype,
        "icon": classified["icon"],
        "peak_vibration": round(peak_vib, 2),
        "strain_delta": round(strain_delta, 1),
        "duration_sec": round(duration, 1),
        "load_estimate_tonnes": round(classified["load_estimate_tonnes"], 1),
        "weight_estimate_tonnes": round(classified["load_estimate_tonnes"], 1),
        "overloaded": overloaded,
        "is_overloaded": overloaded,
        "confidence": round(classified["confidence"], 2),
        "alert": "OVERLOAD" if overloaded else "NORMAL",
        "alert_level": alert_level
    }

class TrafficMonitor:
    def __init__(self, bridge_id):
        self.bridge_id = bridge_id
        self.crossings = deque(maxlen=500)
        self.today_date = date.today()
        self.hourly_counts = [0] * 24
        self.fatigue_score = 0.0
        self.total_tonnage = 0.0
        self.daily_overload_count = 0
        self.vehicle_breakdown = {
            "Motorcycle": 0,
            "Car / SUV": 0,
            "Bus": 0,
            "Light Truck": 0,
            "Heavy Truck": 0,
            "Overloaded Truck": 0
        }

    def add_crossing(self, event: dict):
        try:
            dt = datetime.strptime(event["timestamp"], "%Y-%m-%d %H:%M:%S")
        except Exception:
            try:
                dt = datetime.fromisoformat(event["timestamp"])
            except Exception:
                dt = datetime.now()

        event_date = dt.date()
        event_hour = dt.hour

        if event_date != self.today_date:
            self.reset_daily()
            self.today_date = event_date

        self.hourly_counts[event_hour] += 1
        load = event.get("load_estimate_tonnes", event.get("weight_estimate_tonnes", 1.8))
        self.total_tonnage += load

        # Update breakdown
        vtype = event.get("vehicle_type", "Car / SUV")
        if vtype in self.vehicle_breakdown:
            self.vehicle_breakdown[vtype] += 1

        # Update fatigue score
        is_overloaded = event.get("is_overloaded", event.get("overloaded", False))
        if is_overloaded:
            self.daily_overload_count += 1
            self.fatigue_score += 0.065
        else:
            if load < 5.0:
                self.fatigue_score += 0.001
            elif load <= 20.0:
                self.fatigue_score += 0.008
            else:
                self.fatigue_score += 0.025

        self.fatigue_score = min(100.0, self.fatigue_score)
        self.crossings.append(event)

    def get_stats(self) -> dict:
        total_vehicles = sum(self.hourly_counts)
        overloads = self.daily_overload_count
        overload_rate = round((overloads / total_vehicles * 100), 1) if total_vehicles > 0 else 0.0

        # Calculate peak hour
        max_val = max(self.hourly_counts)
        peak_idx = self.hourly_counts.index(max_val) if total_vehicles > 0 else 0
        peak_hour = f"{peak_idx:02d}:00-{(peak_idx + 1) % 24:02d}:00"

        # Determine fatigue status
        fatigue = self.fatigue_score
        if fatigue <= 25.0:
            status = "LOW"
        elif fatigue <= 50.0:
            status = "MODERATE"
        elif fatigue <= 75.0:
            status = "HIGH"
        else:
            status = "CRITICAL"

        # Get last 20 crossings, most recent first
        recent = list(self.crossings)[-20:][::-1]

        return {
            "bridge_id": self.bridge_id,
            "today": {
                "total_vehicles": total_vehicles,
                "total_tonnage": round(self.total_tonnage, 1),
                "total_tonnage_estimate": round(self.total_tonnage, 1),
                "overload_events": overloads,
                "peak_hour": peak_hour,
                "fatigue_score": round(fatigue, 1),
                "fatigue_status": status,
                "vehicle_breakdown": dict(self.vehicle_breakdown)
            },
            "recent_crossings": recent,
            "hourly_counts": list(self.hourly_counts),
            "overload_rate": overload_rate,
            "last_updated": datetime.now().isoformat()
        }

    def reset_daily(self):
        self.hourly_counts = [0] * 24
        self.total_tonnage = 0.0
        self.daily_overload_count = 0
        self.today_date = date.today()
        self.vehicle_breakdown = {
            "Motorcycle": 0,
            "Car / SUV": 0,
            "Bus": 0,
            "Light Truck": 0,
            "Heavy Truck": 0,
            "Overloaded Truck": 0
        }

    def reset(self):
        self.crossings.clear()
        self.reset_daily()
        self.fatigue_score = 0.0
