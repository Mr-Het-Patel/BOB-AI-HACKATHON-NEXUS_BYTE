"""
train_model.py – Train a LightGBM yield regressor with SHAP explanations.

Inputs:
  ../data/lots.json          Lot records (process params, yield, true_cause)
  ../data/sensors.parquet    20-step sensor time-series per lot

Outputs:
  model.pkl                  Trained LightGBM model (pickle)
  ../data/shap_results.json  Per-lot top-5 SHAP feature attributions

Prints fault-attribution accuracy: for each lot with a known `true_cause`,
checks whether the top SHAP feature corresponds to the expected sensor.
"""

import json
import pathlib
import pickle

import lightgbm as lgb
import numpy as np
import pandas as pd
import shap
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score

# ── Paths ────────────────────────────────────────────────────────────────────
ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
ML_DIR = pathlib.Path(__file__).resolve().parent

LOTS_PATH = DATA_DIR / "lots.json"
SENSORS_PATH = DATA_DIR / "sensors.parquet"
DEFECT_MAPS_PATH = DATA_DIR / "defect_maps.npy"
MODEL_PATH = ML_DIR / "model.pkl"
SHAP_PATH = DATA_DIR / "shap_results.json"

# ── Fault → expected sensor mapping ──────────────────────────────────────────
# Each fault type should be most strongly attributed to features derived from
# the corresponding sensor channel.
FAULT_SENSOR_MAP = {
    "chamber_pressure_drift": "pressure",
    "particle_spike":         "particle_count",
    "rf_power_instability":   "rf_power",
    "gas_flow_blockage":      "gas_flow",
}

SENSOR_CHANNELS = ["temperature", "pressure", "rf_power", "gas_flow", "particle_count"]
DEFECT_FEATURE_NAMES = [
    "defect_density", "defect_max", "defect_mean",
    "defect_edge_ratio", "defect_cluster_score"
]


# ── Feature engineering ──────────────────────────────────────────────────────
def build_sensor_features(sensors_df: pd.DataFrame) -> pd.DataFrame:
    """Compute summary statistics per lot from the sensor time-series.

    For each sensor channel, computes: mean, std, max, min, range,
    and the slope of a simple linear trend (OLS over step index).
    """
    agg_dict = {}
    for ch in SENSOR_CHANNELS:
        agg_dict[f"{ch}_mean"] = (ch, "mean")
        agg_dict[f"{ch}_std"]  = (ch, "std")
        agg_dict[f"{ch}_max"]  = (ch, "max")
        agg_dict[f"{ch}_min"]  = (ch, "min")

    stats = sensors_df.groupby("lot_id").agg(**agg_dict).reset_index()

    # Add range (max - min)
    for ch in SENSOR_CHANNELS:
        stats[f"{ch}_range"] = stats[f"{ch}_max"] - stats[f"{ch}_min"]

    # Add linear trend slope per channel
    def _slope(group: pd.DataFrame, col: str) -> float:
        steps = group["step"].values.astype(float)
        vals = group[col].values.astype(float)
        if len(steps) < 2:
            return 0.0
        # Simple OLS: slope = cov(x,y) / var(x)
        x_mean = steps.mean()
        y_mean = vals.mean()
        num = ((steps - x_mean) * (vals - y_mean)).sum()
        den = ((steps - x_mean) ** 2).sum()
        return float(num / den) if den > 0 else 0.0

    slopes = []
    for lot_id, group in sensors_df.groupby("lot_id"):
        row = {"lot_id": lot_id}
        for ch in SENSOR_CHANNELS:
            row[f"{ch}_slope"] = _slope(group, ch)
        slopes.append(row)
    slopes_df = pd.DataFrame(slopes)
    stats = stats.merge(slopes_df, on="lot_id")

    return stats


def build_defect_features(defect_maps: np.ndarray, lots_df: pd.DataFrame) -> pd.DataFrame:
    """Extract spatial summary statistics per lot from the 32x32 defect maps.

    Computes:
    - defect_density: fraction of cells above noise threshold (> 0.20)
    - defect_max: maximum defect intensity on the wafer
    - defect_mean: average defect intensity across all cells
    - defect_edge_ratio: fraction of defect energy located in the outer ring (>40% radius)
    - defect_cluster_score: peak defect intensity in the wafer center region (16x16 window)
    """
    cy, cx = 15.5, 15.5
    Y, X_grid = np.ogrid[:32, :32]
    dist = np.sqrt((Y - cy) ** 2 + (X_grid - cx) ** 2)
    outer_mask = dist > 12.8  # > 40% wafer radius (MAP_SIZE * 0.4)

    rows = []
    for i in range(len(lots_df)):
        m = defect_maps[i]
        density = float(np.mean(m > 0.20))
        d_max = float(np.max(m))
        d_mean = float(np.mean(m))
        total_energy = float(np.sum(m))
        edge_ratio = float(np.sum(m[outer_mask]) / (total_energy + 1e-6))
        cluster_score = float(np.max(m[8:24, 8:24]))

        rows.append({
            "lot_id": lots_df.iloc[i]["lot_id"],
            "defect_density": density,
            "defect_max": d_max,
            "defect_mean": d_mean,
            "defect_edge_ratio": edge_ratio,
            "defect_cluster_score": cluster_score,
        })

    return pd.DataFrame(rows)


def build_feature_matrix(lots_df: pd.DataFrame, sensors_df: pd.DataFrame, defect_maps: np.ndarray):
    """Merge process params, sensor summary stats, and defect map features into (X, y, meta)."""
    sensor_feats = build_sensor_features(sensors_df)
    defect_feats = build_defect_features(defect_maps, lots_df)

    merged = lots_df.merge(sensor_feats, on="lot_id").merge(defect_feats, on="lot_id")

    # Process-parameter columns (from lots.json)
    param_cols = [
        "temperature_C", "pressure_mTorr", "rf_power_W",
        "gas_flow_sccm", "etch_time_s",
    ]

    # Sensor summary columns
    sensor_cols = [c for c in sensor_feats.columns if c != "lot_id"]

    # Defect map summary columns
    defect_cols = [c for c in defect_feats.columns if c != "lot_id"]

    feature_cols = param_cols + sensor_cols + defect_cols
    X = merged[feature_cols].copy()
    y = merged["yield_pct"].values

    meta = merged[["lot_id", "true_cause", "defect_pattern"]].copy()

    return X, y, meta, feature_cols


# ── Training ─────────────────────────────────────────────────────────────────
def train(X: pd.DataFrame, y: np.ndarray, feature_cols: list[str]):
    """Train a LightGBM regressor and return the model + evaluation metrics."""
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42,
    )

    params = {
        "objective": "regression",
        "metric": "mae",
        "learning_rate": 0.05,
        "num_leaves": 20,
        "max_depth": 5,
        "min_child_samples": 10,
        "subsample": 0.8,
        "colsample_bytree": 0.4,
        "reg_alpha": 0.2,
        "reg_lambda": 0.2,
        "n_estimators": 350,
        "random_state": 42,
        "verbosity": -1,
    }

    model = lgb.LGBMRegressor(**params)
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        callbacks=[lgb.log_evaluation(period=0)],  # suppress per-round logs
    )

    y_pred_test = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred_test)
    r2 = r2_score(y_test, y_pred_test)

    print(f"Model performance (test set):")
    print(f"  MAE  = {mae:.3f}")
    print(f"  R2   = {r2:.4f}")
    print(f"  Rows = {len(X_train)} train / {len(X_test)} test")
    print()

    return model


# ── SHAP analysis ────────────────────────────────────────────────────────────
def compute_shap(model, X: pd.DataFrame, meta: pd.DataFrame, feature_cols: list[str]):
    """Compute TreeSHAP values and return per-lot top-5 feature attributions."""
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)

    results = []
    for i in range(len(X)):
        sv = shap_values[i]
        # Sort features by absolute SHAP value (descending)
        order = np.argsort(-np.abs(sv))
        top5 = []
        for j in order[:5]:
            top5.append({
                "feature": feature_cols[j],
                "shap_value": round(float(sv[j]), 4),
            })
        true_cause = meta.iloc[i]["true_cause"]
        if isinstance(true_cause, float) and np.isnan(true_cause):
            true_cause = None
        results.append({
            "lot_id": str(meta.iloc[i]["lot_id"]),
            "true_cause": true_cause,
            "top5_features": top5,
        })

    return results, shap_values


def _feature_matches_fault(feature_name: str, fault: str) -> bool:
    """Check if a SHAP feature name corresponds to the expected sensor for a fault."""
    expected_sensor = FAULT_SENSOR_MAP.get(fault, "")
    if not expected_sensor:
        return False
    # The feature name should start with or contain the sensor channel name
    # e.g. "pressure_mean", "pressure_slope", "pressure_mTorr" all match "pressure"
    return feature_name.startswith(expected_sensor) or expected_sensor in feature_name


def evaluate_fault_attribution(shap_results: list[dict]):
    """Print accuracy of SHAP root-cause feature vs known true_cause, and defect feature usage."""
    print("=" * 70)
    print("FAULT ATTRIBUTION & MULTI-MODAL FEATURE ANALYSIS")
    print("=" * 70)

    # Per-fault-type stats
    fault_stats: dict[str, dict] = {
        f: {"correct": 0, "total": 0, "defect_in_top5": 0, "examples": []}
        for f in FAULT_SENSOR_MAP
    }
    overall_correct = 0
    overall_total = 0
    overall_defect_in_top5 = 0

    for entry in shap_results:
        fault = entry["true_cause"]
        if fault is None or (isinstance(fault, float) and np.isnan(fault)):
            continue

        # Top equipment sensor/param feature
        eq_feats = [f for f in entry["top5_features"] if not f["feature"].startswith("defect_")]
        top_eq = eq_feats[0] if eq_feats else entry["top5_features"][0]
        match = _feature_matches_fault(top_eq["feature"], fault)

        has_defect = any(f["feature"].startswith("defect_") for f in entry["top5_features"])

        fault_stats[fault]["total"] += 1
        overall_total += 1
        if match:
            fault_stats[fault]["correct"] += 1
            overall_correct += 1
        if has_defect:
            fault_stats[fault]["defect_in_top5"] += 1
            overall_defect_in_top5 += 1

        # Keep first 3 examples per fault for display
        if len(fault_stats[fault]["examples"]) < 3:
            fault_stats[fault]["examples"].append({
                "lot": entry["lot_id"],
                "top_feat": entry["top5_features"][0]["feature"],
                "top_eq": top_eq["feature"],
                "shap_val": top_eq["shap_value"],
                "match": match,
            })

    print()
    for fault, stats in sorted(fault_stats.items()):
        total = stats["total"]
        correct = stats["correct"]
        pct = (correct / total * 100) if total > 0 else 0
        expected = FAULT_SENSOR_MAP[fault]
        print(f"  {fault}")
        print(f"    Expected root cause sensor : {expected}")
        print(f"    Root Cause Attribution Acc : {correct}/{total} ({pct:.1f}%)")
        print(f"    Defect map in top-5 SHAP   : {stats['defect_in_top5']}/{total}")
        for ex in stats["examples"]:
            tag = "OK" if ex["match"] else "MISS"
            print(f"    [{tag}] {ex['lot']:>8s}  top_shap={ex['top_feat']:<20s}  root_cause={ex['top_eq']:<20s}  shap={ex['shap_val']:+.4f}")
        print()

    overall_pct = (overall_correct / overall_total * 100) if overall_total > 0 else 0
    print(f"  ROOT-CAUSE ACCURACY: {overall_correct}/{overall_total} ({overall_pct:.1f}%)")
    print(f"  DEFECT FEATURES IN TOP-5: {overall_defect_in_top5}/{overall_total} ({overall_defect_in_top5/overall_total*100:.1f}%)")
    print("=" * 70)


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    # Load data
    print("Loading data...")
    with open(LOTS_PATH) as f:
        lots_raw = json.load(f)
    lots_df = pd.DataFrame(lots_raw)
    sensors_df = pd.read_parquet(SENSORS_PATH)
    defect_maps = np.load(DEFECT_MAPS_PATH)
    print(f"  Lots: {len(lots_df)}, Sensor rows: {len(sensors_df)}, Defect maps: {defect_maps.shape}")

    # Build features
    print("Building feature matrix (process params + sensors + defect maps)...")
    X, y, meta, feature_cols = build_feature_matrix(lots_df, sensors_df, defect_maps)
    print(f"  Features: {len(feature_cols)} columns")
    print(f"  Feature names: {feature_cols}")
    print()

    # Train
    print("Training LightGBM regressor...")
    model = train(X, y, feature_cols)

    # Save model
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    print(f"[OK] Model saved to {MODEL_PATH}")
    print()

    # SHAP
    print("Computing SHAP values (TreeExplainer)...")
    shap_results, shap_values = compute_shap(model, X, meta, feature_cols)

    # Save SHAP results
    with open(SHAP_PATH, "w") as f:
        json.dump(shap_results, f, indent=2)
    print(f"[OK] SHAP results saved to {SHAP_PATH}")
    print(f"     {len(shap_results)} lots, top-5 features each")
    print()

    # Fault attribution accuracy
    evaluate_fault_attribution(shap_results)


if __name__ == "__main__":
    main()
