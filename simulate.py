import os
import json
from datetime import datetime, timedelta

import numpy as np
import pandas as pd


# CONFIG
SEED = 42
SAMPLE_RATE = 60
DAYS = 14
N = int(DAYS * 24 * 60 * 60 / SAMPLE_RATE)

BASELINE = {
    "water_level": 2.0,
    "vibration": 0.30,
    "strain": 145.0,
    "crack_gap": 0.20,
}

try:
    from backend.constants import WATER_LEVEL_THRESHOLD, VIBRATION_LIMIT_G, STRAIN_LIMIT_MPA, CRACK_GAP_LIMIT_MM
except ImportError:
    try:
        from constants import WATER_LEVEL_THRESHOLD, VIBRATION_LIMIT_G, STRAIN_LIMIT_MPA, CRACK_GAP_LIMIT_MM
    except ImportError:
        WATER_LEVEL_THRESHOLD = 4.5
        VIBRATION_LIMIT_G = 1.2
        STRAIN_LIMIT_MPA = 210.0
        CRACK_GAP_LIMIT_MM = 0.30

THRESHOLDS = {
    "water_level": WATER_LEVEL_THRESHOLD,
    "vibration": VIBRATION_LIMIT_G,
    "strain": STRAIN_LIMIT_MPA,
    "crack_gap": CRACK_GAP_LIMIT_MM,
}


# Generates baseline bridge sensor readings with daily cycles, slow drift cycles, and Gaussian noise.
def generate_base_signals(n, seed):
    rng = np.random.default_rng(seed)
    samples_per_day = int(24 * 60 * 60 / SAMPLE_RATE)
    t = np.arange(n)
    start_time = datetime(2024, 6, 1)
    timestamps = [start_time + timedelta(seconds=int(i * SAMPLE_RATE)) for i in range(n)]

    daily = 2 * np.pi * t / samples_per_day
    slow = 2 * np.pi * t / (3 * samples_per_day)

    water_level = (
        BASELINE["water_level"]
        + 0.24 * np.sin(daily)
        + 0.36 * np.sin(slow + 0.4)
        + rng.normal(0.0, 0.05, n)
    )
    vibration = (
        BASELINE["vibration"]
        + 0.05 * np.sin(daily + 1.3)
        + 0.03 * np.sin(slow + 0.8)
        + rng.normal(0.0, 0.025, n)
    )
    strain = (
        BASELINE["strain"]
        + 6.0 * np.sin(daily + 0.6)
        + 4.0 * np.sin(slow + 1.1)
        + rng.normal(0.0, 1.2, n)
    )
    crack_gap = (
        BASELINE["crack_gap"]
        + 0.015 * np.sin(daily + 2.0)
        + 0.012 * np.sin(slow + 0.5)
        + rng.normal(0.0, 0.003, n)
    )

    return pd.DataFrame(
        {
            "timestamp": timestamps,
            "water_level": np.clip(water_level, 0.0, None),
            "vibration": np.clip(vibration, 0.0, None),
            "strain": np.clip(strain, 0.0, None),
            "crack_gap": np.clip(crack_gap, 0.0, None),
        }
    )


# Injects a flood event with ramp-up, plateau, and ramp-down water rise plus correlated strain increase.
def inject_flood_spike(df, start_idx, duration=180, peak_rise=4.2):
    start = max(0, int(start_idx))
    duration = max(1, int(duration))
    end = min(len(df), start + duration)

    if start >= len(df) or start >= end:
        return df

    actual_duration = end - start
    position = np.linspace(0.0, 1.0, actual_duration)
    profile = np.where(
        position < 0.25,
        position / 0.25,
        np.where(position > 0.75, (1.0 - position) / 0.25, 1.0),
    )
    profile = np.clip(profile, 0.0, 1.0) * peak_rise

    water_col = df.columns.get_loc("water_level")
    strain_col = df.columns.get_loc("strain")
    df.iloc[start:end, water_col] = df.iloc[start:end, water_col].values + profile
    df.iloc[start:end, strain_col] = df.iloc[start:end, strain_col].values + profile * 10.0
    return df


# Injects a short sine-shaped vibration impulse with a related strain impulse.
def inject_vibration_surge(df, start_idx, duration=30, peak=1.4):
    start = max(0, int(start_idx))
    duration = max(1, int(duration))
    end = min(len(df), start + duration)

    if start >= len(df) or start >= end:
        return df

    actual_duration = end - start
    profile = np.sin(np.linspace(0.0, np.pi, actual_duration)) * peak

    vibration_col = df.columns.get_loc("vibration")
    strain_col = df.columns.get_loc("strain")
    df.iloc[start:end, vibration_col] = df.iloc[start:end, vibration_col].values + profile
    df.iloc[start:end, strain_col] = df.iloc[start:end, strain_col].values + profile * 22.0
    return df


# Injects permanent cumulative crack-gap growth from the selected sample onward.
def inject_crack_growth(df, start_idx, rate_per_sample=0.0003):
    start = max(0, int(start_idx))

    if start >= len(df):
        return df

    drift = np.arange(len(df) - start) * rate_per_sample
    crack_col = df.columns.get_loc("crack_gap")
    df.iloc[start:, crack_col] = df.iloc[start:, crack_col].values + drift
    return df


# Injects a sensor dropout by replacing a chosen sensor's values with NaN for a duration.
def inject_sensor_dropout(df, sensor, start_idx, duration=10):
    if sensor not in BASELINE:
        raise ValueError("Unknown sensor: " + str(sensor))

    start = max(0, int(start_idx))
    duration = max(1, int(duration))
    end = min(len(df), start + duration)

    if start >= len(df) or start >= end:
        return df

    sensor_col = df.columns.get_loc(sensor)
    df.iloc[start:end, sensor_col] = np.nan
    return df


FAULT_SCHEDULE = [
    {"type": "flood_spike", "start_day": 1.5, "kwargs": {"duration": 180, "peak_rise": 4.2}},
    {"type": "vibration_surge", "start_day": 2.25, "kwargs": {"duration": 30, "peak": 1.4}},
    {"type": "flood_spike", "start_day": 4.1, "kwargs": {"duration": 240, "peak_rise": 4.7}},
    {"type": "vibration_surge", "start_day": 6.0, "kwargs": {"duration": 36, "peak": 1.6}},
    {"type": "crack_growth", "start_day": 9, "kwargs": {"rate_per_sample": 0.0003}},
    {"type": "sensor_dropout", "start_day": 10.5, "kwargs": {"sensor": "strain", "duration": 10}},
    {"type": "flood_spike", "start_day": 11.75, "kwargs": {"duration": 150, "peak_rise": 3.9}},
    {"type": "vibration_surge", "start_day": 13.0, "kwargs": {"duration": 24, "peak": 1.5}},
]


# Applies every scheduled fault by converting each start_day offset into a sample index.
def apply_fault_schedule(df):
    samples_per_day = int(24 * 60 * 60 / SAMPLE_RATE)

    for fault in FAULT_SCHEDULE:
        start_idx = int(fault["start_day"] * samples_per_day)
        kw = fault["kwargs"]

        if fault["type"] == "flood_spike":
            df = inject_flood_spike(df, start_idx, **kw)
        elif fault["type"] == "vibration_surge":
            df = inject_vibration_surge(df, start_idx, **kw)
        elif fault["type"] == "crack_growth":
            df = inject_crack_growth(df, start_idx, **kw)
        elif fault["type"] == "sensor_dropout":
            df = inject_sensor_dropout(df, start_idx=start_idx, **kw)
        else:
            raise ValueError("Unknown fault type: " + str(fault["type"]))

    return df


# Adds a binary label showing whether any sensor will cross its threshold in the next 30 minutes.
def attach_labels(df):
    LABEL_HORIZON = 30
    horizon_samples = int(LABEL_HORIZON * 60 / SAMPLE_RATE)
    labeled_df = df.copy()
    sensors = list(THRESHOLDS.keys())
    labels = np.zeros(len(labeled_df), dtype=int)
    nan_rows = labeled_df[sensors].isna().any(axis=1).to_numpy()

    breaches = np.zeros(len(labeled_df), dtype=bool)
    for sensor, threshold in THRESHOLDS.items():
        breaches = breaches | (labeled_df[sensor] > threshold).fillna(False).to_numpy()

    for i in range(len(labeled_df)):
        if nan_rows[i]:
            labels[i] = -1
        else:
            lookahead_end = min(len(labeled_df), i + horizon_samples + 1)
            labels[i] = 1 if breaches[i:lookahead_end].any() else 0

    labeled_df["label_failure_30min"] = labels
    return labeled_df


# Streams rows from a completed dataset and can apply short live event overrides while streaming.
class LiveSensorStream:
    # Stores the dataset, stream index, and optional active live event state.
    def __init__(self, df):
        self.df = df.reset_index(drop=True)
        self.index = 0
        self.event = None

    # Starts a short live event override with a countdown measured in stream ticks.
    def inject_event(self, event_type):
        ticks_by_event = {
            "flood_spike": 20,
            "flood": 20,
            "vibration_surge": 10,
            "vibration": 10,
            "crack_growth": 30,
            "crack": 30,
            "sensor_dropout": 10,
            "dropout": 10,
        }
        ticks = ticks_by_event.get(event_type, 10)
        self.event = {"type": event_type, "ticks": ticks, "total": ticks}

    # Returns the next sensor reading as a rounded dictionary and advances the stream index.
    def next_reading(self):
        row = self.df.iloc[self.index].copy()

        if self.event is not None:
            position = self.event["total"] - self.event["ticks"]
            shape = np.sin(np.pi * (position + 1) / self.event["total"])
            event_type = self.event["type"]

            if event_type in ("flood_spike", "flood"):
                row["water_level"] += 4.2 * shape
                row["strain"] += 42.0 * shape
            elif event_type in ("vibration_surge", "vibration"):
                row["vibration"] += 1.4 * shape
                row["strain"] += 30.0 * shape
            elif event_type in ("crack_growth", "crack"):
                row["crack_gap"] += 0.003 * (position + 1)
            elif event_type in ("sensor_dropout", "dropout"):
                row["strain"] = np.nan

            self.event["ticks"] -= 1
            if self.event["ticks"] <= 0:
                self.event = None

        reading = {"timestamp": row["timestamp"].isoformat()}
        for sensor in BASELINE:
            value = row[sensor]
            reading[sensor] = None if pd.isna(value) else round(float(value), 4)

        label = row.get("label_failure_30min", None)
        reading["label_failure_30min"] = None if pd.isna(label) else int(label)

        self.index = (self.index + 1) % len(self.df)
        return reading


# Builds the full simulated dataset, writes optional exports, and returns the labeled DataFrame.
def build_dataset(export_csv=True, export_json_meta=True):
    print("Building base sensor signals...")
    df = generate_base_signals(N, SEED)

    print("Applying fault schedule...")
    df = apply_fault_schedule(df)

    print("Attaching 30-minute failure labels...")
    df = attach_labels(df)

    print("Creating data folder...")
    data_dir = "data"
    os.makedirs(data_dir, exist_ok=True)

    label_counts = df["label_failure_30min"].value_counts().sort_index()
    label_balance = {str(int(label)): int(count) for label, count in label_counts.items()}
    meta = {
        "n_samples": int(len(df)),
        "days": DAYS,
        "sample_rate": SAMPLE_RATE,
        "fault_count": len(FAULT_SCHEDULE),
        "label_balance": label_balance,
        "thresholds": THRESHOLDS,
    }

    if export_csv:
        csv_path = os.path.join(data_dir, "bridge_sensor_data.csv")
        print("Saving " + csv_path + "...")
        df.to_csv(csv_path, index=False)

    if export_json_meta:
        meta_path = os.path.join(data_dir, "dataset_meta.json")
        print("Saving " + meta_path + "...")
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

    print("Dataset build complete.")
    return df


if __name__ == "__main__":
    dataset = build_dataset()
    stream = LiveSensorStream(dataset)

    print("\nFive test readings from LiveSensorStream:")
    for _ in range(5):
        print(stream.next_reading())
