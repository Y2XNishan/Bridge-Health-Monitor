import os
import sys

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


plt.style.use("dark_background")

INPUT_PATH = "data/bridge_features.csv"
PLOTS_DIR = "plots"

SENSORS = ["water_level", "vibration", "strain", "crack_gap"]
UNITS = {
    "water_level": "metres",
    "vibration": "g",
    "strain": "MPa",
    "crack_gap": "mm",
}
try:
    from backend.constants import WATER_LEVEL_THRESHOLD, VIBRATION_LIMIT_G, CRACK_GAP_LIMIT_MM
except ImportError:
    try:
        from constants import WATER_LEVEL_THRESHOLD, VIBRATION_LIMIT_G, CRACK_GAP_LIMIT_MM
    except ImportError:
        WATER_LEVEL_THRESHOLD = 4.5
        VIBRATION_LIMIT_G = 1.2
        CRACK_GAP_LIMIT_MM = 0.30

THRESHOLDS = {
    "water_level": WATER_LEVEL_THRESHOLD,
    "vibration": VIBRATION_LIMIT_G,
    "crack_gap": CRACK_GAP_LIMIT_MM,
}


def _ensure_plots_dir():
    os.makedirs(PLOTS_DIR, exist_ok=True)


def _prefailure_start_indices(df):
    labels = df["label_failure_30min"]
    starts = labels.eq(1) & labels.shift(1).eq(0)
    return np.flatnonzero(starts.to_numpy())


def plot_raw_sensors(df):
    _ensure_plots_dir()
    x = np.arange(len(df))
    starts = _prefailure_start_indices(df)

    fig, axes = plt.subplots(4, 1, figsize=(14, 10), sharex=True)
    for ax, sensor in zip(axes, SENSORS):
        ax.plot(x, df[sensor], linewidth=0.8)
        for start in starts:
            ax.axvline(start, color="red", linestyle="--", linewidth=0.8, alpha=0.6)
        ax.set_title(sensor)
        ax.set_ylabel(UNITS[sensor])
        ax.grid(True, alpha=0.2)

    axes[-1].set_xlabel("row index")
    fig.tight_layout()
    output_path = os.path.join(PLOTS_DIR, "01_raw_sensors.png")
    fig.savefig(output_path, dpi=150)
    plt.close(fig)
    print("[eda] Saved → plots/01_raw_sensors.png")


def plot_label_dist(df):
    _ensure_plots_dir()
    labels = df["label_failure_30min"]
    counts = labels.value_counts().reindex([-1, 0, 1], fill_value=0)
    colors = ["gray", "green", "red"]
    x = np.arange(len(df))

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    bars = axes[0].bar(counts.index.astype(str), counts.values, color=colors)
    axes[0].set_title("Label value counts")
    axes[0].set_xlabel("label_failure_30min")
    axes[0].set_ylabel("count")
    axes[0].grid(True, axis="y", alpha=0.2)
    for bar, count in zip(bars, counts.values):
        axes[0].text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height(),
            str(int(count)),
            ha="center",
            va="bottom",
        )

    axes[1].step(x, labels, where="post", color="gray", linewidth=0.8, alpha=0.45)
    axes[1].step(
        x,
        labels.where(labels == 0, np.nan),
        where="post",
        color="green",
        linewidth=1.0,
    )
    axes[1].step(
        x,
        labels.where(labels == 1, np.nan),
        where="post",
        color="red",
        linewidth=1.0,
    )
    axes[1].set_title("Label over time")
    axes[1].set_xlabel("row index")
    axes[1].set_ylabel("label_failure_30min")
    axes[1].set_yticks([-1, 0, 1])
    axes[1].grid(True, alpha=0.2)

    fig.tight_layout()
    output_path = os.path.join(PLOTS_DIR, "02_label_distribution.png")
    fig.savefig(output_path, dpi=150)
    plt.close(fig)
    print("[eda] Saved → plots/02_label_distribution.png")


def plot_correlation(df):
    _ensure_plots_dir()
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    feature_cols = [col for col in numeric_cols if col != "label_failure_30min"]
    corr = df.loc[:, feature_cols].corr().fillna(0)
    np.fill_diagonal(corr.values, 1.0)

    fig, ax = plt.subplots(figsize=(12, 10))
    image = ax.imshow(corr, cmap="RdBu_r", vmin=-1, vmax=1, aspect="auto")
    fig.colorbar(image, ax=ax)
    ax.set_xticks([])
    ax.set_yticks([])
    ax.set_title("Feature correlation matrix (63 features)")

    fig.tight_layout()
    output_path = os.path.join(PLOTS_DIR, "03_feature_correlation.png")
    fig.savefig(output_path, dpi=150)
    plt.close(fig)
    print("[eda] Saved → plots/03_feature_correlation.png")


def plot_fault_zoom(df):
    _ensure_plots_dir()
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    flood1_peak = 6040
    flood1_start = 5880
    flood1_end = 6200

    vib1_peak = 3254
    vib1_start = 3180
    vib1_end = 3340

    crack_start = 12900
    crack_end = 14200

    flood3_peak = 17021
    flood3_start = 16860
    flood3_end = 17180

    water_flood_1 = df.iloc[flood1_start:flood1_end]
    x1 = water_flood_1.index.to_numpy()
    axes[0, 0].plot(x1, water_flood_1["water_level"], label="water_level", linewidth=1.0)
    axes[0, 0].plot(
        x1,
        water_flood_1["water_level_mean_1h"],
        label="mean_1h",
        color="orange",
        linewidth=1.2,
    )
    axes[0, 0].axhline(THRESHOLDS["water_level"], color="red", linestyle="--", linewidth=1.0)
    axes[0, 0].set_title(f"water_level rows {flood1_start}-{flood1_end}")
    axes[0, 0].set_ylabel("metres")
    axes[0, 0].legend(loc="upper left")
    axes[0, 0].grid(True, alpha=0.2)

    vibration_zoom = df.iloc[vib1_start:vib1_end]
    x2 = vibration_zoom.index.to_numpy()
    axes[0, 1].plot(x2, vibration_zoom["vibration"], label="vibration", linewidth=1.0)
    axes[0, 1].plot(
        x2,
        vibration_zoom["vibration_mean_1h"],
        label="mean_1h",
        color="orange",
        linewidth=1.2,
    )
    axes[0, 1].axhline(THRESHOLDS["vibration"], color="red", linestyle="--", linewidth=1.0)
    axes[0, 1].set_title(f"vibration rows {vib1_start}-{vib1_end}")
    axes[0, 1].set_ylabel("g")
    axes[0, 1].legend(loc="upper left")
    axes[0, 1].grid(True, alpha=0.2)

    crack_zoom = df.iloc[crack_start:crack_end]
    x3 = crack_zoom.index.to_numpy()
    axes[1, 0].plot(x3, crack_zoom["crack_gap"], label="crack_gap", linewidth=1.0)
    axes[1, 0].axhline(THRESHOLDS["crack_gap"], color="red", linestyle="--", linewidth=1.0)
    axes[1, 0].set_title(f"crack_gap rows {crack_start}-{crack_end}")
    axes[1, 0].set_xlabel("row index")
    axes[1, 0].set_ylabel("mm")
    axes[1, 0].grid(True, alpha=0.2)
    crack_delta_ax = axes[1, 0].twinx()
    crack_delta_ax.plot(
        x3,
        crack_zoom["crack_gap_delta"],
        label="delta",
        color="orange",
        linewidth=0.9,
        alpha=0.8,
    )
    crack_delta_ax.set_ylabel("delta")

    water_flood_2 = df.iloc[flood3_start:flood3_end]
    x4 = water_flood_2.index.to_numpy()
    axes[1, 1].plot(x4, water_flood_2["water_level"], label="water_level", linewidth=1.0)
    axes[1, 1].axhline(THRESHOLDS["water_level"], color="red", linestyle="--", linewidth=1.0)
    axes[1, 1].set_title(f"water_level rows {flood3_start}-{flood3_end}")
    axes[1, 1].set_xlabel("row index")
    axes[1, 1].set_ylabel("metres")
    axes[1, 1].legend(loc="upper left")
    axes[1, 1].grid(True, alpha=0.2)

    fig.tight_layout()
    output_path = os.path.join(PLOTS_DIR, "04_fault_event_zoom.png")
    fig.savefig(output_path, dpi=150)
    plt.close(fig)
    print("[eda] Saved → plots/04_fault_event_zoom.png")


def main():
    print("[eda] Loading data/bridge_features.csv")
    df = pd.read_csv(INPUT_PATH)
    print(f"[eda] Loaded shape: {df.shape}")

    plot_raw_sensors(df)
    plot_label_dist(df)
    plot_correlation(df)
    plot_fault_zoom(df)

    print("[eda] All 4 plots saved. EDA complete.")


if __name__ == "__main__":
    main()
