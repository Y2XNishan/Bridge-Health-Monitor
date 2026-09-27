import numpy as np
import pandas as pd


SENSORS = ["water_level", "vibration", "strain", "crack_gap"]
SAMPLE_RATE = 60

INPUT_PATH = "data/bridge_sensor_data.csv"
OUTPUT_PATH = "data/bridge_features.csv"

ROLLING_WINDOWS = {
    "1h": 60,
    "6h": 360,
    "24h": 1440,
}

LAGS = {
    "lag5": 5,
    "lag15": 15,
    "lag30": 30,
}

try:
    from backend.constants import SENSOR_THRESHOLDS
    ALERT_THRESHOLDS = {
        "water_level": SENSOR_THRESHOLDS["water_level"]["warn"],
        "vibration": SENSOR_THRESHOLDS["vibration"]["warn"],
        "strain": SENSOR_THRESHOLDS["strain"]["warn"],
        "crack_gap": SENSOR_THRESHOLDS["crack_gap"]["warn"],
    }
except ImportError:
    ALERT_THRESHOLDS = {
        "water_level": 4.0,
        "vibration": 0.8,
        "strain": 180.0,
        "crack_gap": 0.20,
    }

try:
    __import__("sys").stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def engineer_features(df):
    featured = df.copy()
    featured = featured.assign(timestamp=pd.to_datetime(featured["timestamp"]))

    featured.loc[:, "nan_row_flag"] = (featured["label_failure_30min"] == -1).astype(int)

    for sensor in SENSORS:
        featured.loc[:, sensor] = pd.to_numeric(featured[sensor], errors="coerce")
        featured.loc[:, sensor] = featured[sensor].ffill().bfill().fillna(0)

    for sensor in SENSORS:
        for suffix, window in ROLLING_WINDOWS.items():
            col = f"{sensor}_mean_{suffix}"
            featured.loc[:, col] = featured[sensor].rolling(window=window, min_periods=1).mean()

    for sensor in SENSORS:
        for suffix, window in ROLLING_WINDOWS.items():
            col = f"{sensor}_std_{suffix}"
            featured.loc[:, col] = (
                featured[sensor]
                .rolling(window=window, min_periods=1)
                .std()
                .fillna(0)
            )

    for sensor in SENSORS:
        mean_col = f"{sensor}_mean_1h"
        std_col = f"{sensor}_std_1h"
        zscore_col = f"{sensor}_zscore_1h"
        featured.loc[:, zscore_col] = (
            (featured[sensor] - featured[mean_col]) / (featured[std_col] + 1e-8)
        )

    for sensor in SENSORS:
        delta_col = f"{sensor}_delta"
        featured.loc[:, delta_col] = featured[sensor].diff().fillna(0)

    for sensor in SENSORS:
        for suffix, lag in LAGS.items():
            col = f"{sensor}_{suffix}"
            featured.loc[:, col] = featured[sensor].shift(lag).ffill().fillna(0)

    for sensor in SENSORS:
        col = f"{sensor}_max_1h"
        featured.loc[:, col] = featured[sensor].rolling(window=60, min_periods=1).max()

    for sensor in SENSORS:
        delta_col = f"{sensor}_delta"
        delta2_col = f"{sensor}_delta2"
        featured.loc[:, delta2_col] = featured[delta_col].diff().fillna(0)

    featured.loc[:, "hour_of_day"] = featured["timestamp"].dt.hour
    featured.loc[:, "day_of_week"] = featured["timestamp"].dt.dayofweek
    featured.loc[:, "is_night"] = (
        (featured["hour_of_day"] >= 22) | (featured["hour_of_day"] <= 6)
    ).astype(int)

    alert_frame = pd.DataFrame(index=featured.index)
    for sensor, threshold in ALERT_THRESHOLDS.items():
        alert_frame.loc[:, sensor] = featured[sensor] > threshold
    featured.loc[:, "sensor_alert_count"] = alert_frame.sum(axis=1).astype(int)

    numeric_cols = featured.select_dtypes(include=[np.number]).columns
    featured.loc[:, numeric_cols] = featured[numeric_cols].ffill().bfill().fillna(0)

    float_cols = featured.select_dtypes(include=["float"]).columns
    featured.loc[:, float_cols] = featured[float_cols].round(6)

    return featured


def engineer_features_last_row(df):
    sub_df = df.tail(1445)
    last_row = sub_df.iloc[-1]
    
    ts = last_row["timestamp"]
    if not isinstance(ts, pd.Timestamp):
        dt = pd.to_datetime(ts)
    else:
        dt = ts
        
    features = {
        "timestamp": dt,
        "nan_row_flag": int(last_row.get("label_failure_30min", 0) == -1),
        "label_failure_30min": int(last_row.get("label_failure_30min", 0) or 0),
        "is_fault": int(last_row.get("is_fault", 0) or 0)
    }
    
    for sensor in SENSORS:
        series = sub_df[sensor].to_numpy(dtype=float)
        
        if np.isnan(series).any():
            series = pd.Series(series).ffill().bfill().fillna(0.0).to_numpy()
            
        features[sensor] = float(series[-1])
        
        # Mean rolling
        for suffix, window in ROLLING_WINDOWS.items():
            w_series = series[-window:]
            features[f"{sensor}_mean_{suffix}"] = float(np.mean(w_series))
            
        # Std rolling
        for suffix, window in ROLLING_WINDOWS.items():
            w_series = series[-window:]
            if len(w_series) > 1:
                std_val = np.std(w_series, ddof=1)
            else:
                std_val = 0.0
            features[f"{sensor}_std_{suffix}"] = float(np.nan_to_num(std_val))
            
        # Z-score 1h
        mean_1h = features[f"{sensor}_mean_1h"]
        std_1h = features[f"{sensor}_std_1h"]
        features[f"{sensor}_zscore_1h"] = float((features[sensor] - mean_1h) / (std_1h + 1e-8))
        
        # Delta
        if len(series) > 1:
            delta = series[-1] - series[-2]
        else:
            delta = 0.0
        features[f"{sensor}_delta"] = float(delta)
        
        # Lags
        for suffix, lag in LAGS.items():
            idx = -1 - lag
            val = series[idx] if len(series) > abs(idx) else series[0]
            features[f"{sensor}_{suffix}"] = float(val)
            
        # Max 1h
        w_60 = series[-60:]
        features[f"{sensor}_max_1h"] = float(np.max(w_60))
        
        # Delta2
        if len(series) > 2:
            delta2 = series[-1] - 2 * series[-2] + series[-3]
        else:
            delta2 = 0.0
        features[f"{sensor}_delta2"] = float(delta2)
        
    features["hour_of_day"] = dt.hour
    features["day_of_week"] = dt.dayofweek
    features["is_night"] = int(dt.hour >= 22 or dt.hour <= 6)
    
    alert_count = 0
    for sensor, threshold in ALERT_THRESHOLDS.items():
        if features[sensor] > threshold:
            alert_count += 1
    features["sensor_alert_count"] = alert_count
    
    featured_row = pd.DataFrame([features])
    float_cols = featured_row.select_dtypes(include=["float"]).columns
    featured_row[float_cols] = featured_row[float_cols].round(6)
    
    return featured_row
 
 
def load_and_engineer(path):
    df = pd.read_csv(path)
    return engineer_features(df)


def save_features(df, path):
    df.to_csv(path, index=False)


if __name__ == "__main__":
    raw_df = pd.read_csv(INPUT_PATH)
    input_shape = raw_df.shape

    features_df = engineer_features(raw_df)

    print("[features] Checking NaN columns...")
    nan_counts = features_df.isna().sum()
    nan_columns = nan_counts[nan_counts > 0]
    if len(nan_columns) > 0:
        print(nan_columns.to_string())
    else:
        print("[features] Columns with NaN: none")

    print(f"[features] Total columns: {features_df.shape[1]}")
    print(f"[features] Feature shape: {features_df.shape}")
    print(
        "[features] Label column preserved: "
        + str("label_failure_30min" in features_df.columns)
    )

    save_features(features_df, OUTPUT_PATH)

    print(f"[features] Input shape : {input_shape}")
    print(f"[features] Output shape: {features_df.shape}")
    print(f"[features] NaN count   : {int(features_df.isna().sum().sum())}")
    print(f"[features] Saved → {OUTPUT_PATH}")
