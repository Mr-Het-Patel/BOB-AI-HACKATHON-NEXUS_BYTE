"""
generate_data.py – Synthetic semiconductor fab data generator.

Produces:
  ../data/lots.json          500 wafer-lot records (process params, yield, fault label)
  ../data/sensors.parquet    20-step sensor time-series per lot (10 000 rows)
  ../data/defect_maps.npy    32×32 procedural defect maps per lot (500, 32, 32)

Fault scenarios injected into ~25 % of lots:
  1. chamber_pressure_drift   – pressure ramps over steps, yield drops
  2. particle_spike           – sudden particle count burst mid-run
  3. rf_power_instability     – RF power oscillates, yield degrades
  4. gas_flow_blockage        – gas flow drops sharply, yield tanks

Seeded (SEED = 42) for full reproducibility.  No plots, no extra files.
"""

import json
import os
import pathlib

import numpy as np
import pandas as pd

# ── Reproducibility ──────────────────────────────────────────────────────────
SEED = 42
rng = np.random.default_rng(SEED)

# ── Constants ────────────────────────────────────────────────────────────────
N_LOTS = 500
N_STEPS = 20
MAP_SIZE = 32

DATA_DIR = pathlib.Path(__file__).resolve().parent.parent / "data"

FAULT_TYPES = [
    "chamber_pressure_drift",
    "particle_spike",
    "rf_power_instability",
    "gas_flow_blockage",
]

# Nominal process-parameter ranges (uniform draws)
PARAM_RANGES = {
    "temperature_C":   (350.0, 450.0),
    "pressure_mTorr":  (15.0,  60.0),
    "rf_power_W":      (200.0, 800.0),
    "gas_flow_sccm":   (50.0,  200.0),
    "etch_time_s":      (30.0, 120.0),
}

# Sensor channels recorded at each step
SENSOR_CHANNELS = [
    "temperature",
    "pressure",
    "rf_power",
    "gas_flow",
    "particle_count",
]


# ── Helpers ──────────────────────────────────────────────────────────────────
def _nominal_params() -> dict:
    """Draw one set of nominal process parameters."""
    return {
        k: round(float(rng.uniform(*v)), 2)
        for k, v in PARAM_RANGES.items()
    }


def _nominal_sensor_trace(params: dict) -> np.ndarray:
    """Return (N_STEPS, 5) nominal sensor readings with light noise."""
    base = np.array([
        params["temperature_C"],
        params["pressure_mTorr"],
        params["rf_power_W"],
        params["gas_flow_sccm"],
        5.0,  # baseline particle count
    ])
    noise_scale = base * 0.01  # 1 % Gaussian noise
    trace = np.tile(base, (N_STEPS, 1)) + rng.normal(0, noise_scale, (N_STEPS, len(base)))
    trace = np.clip(trace, 0, None)
    return trace


def _apply_fault(trace: np.ndarray, fault: str) -> np.ndarray:
    """Mutate *trace* in-place to inject a fault signature."""
    t = np.copy(trace)
    steps = np.arange(N_STEPS)

    if fault == "chamber_pressure_drift":
        # Pressure ramps linearly upward over the run
        drift = np.linspace(0, t[0, 1] * 0.6, N_STEPS)
        t[:, 1] += drift

    elif fault == "particle_spike":
        # Sudden burst of particles from step 8–12
        spike_start = 8
        spike_end = 13
        t[spike_start:spike_end, 4] += rng.uniform(80, 200, spike_end - spike_start)

    elif fault == "rf_power_instability":
        # Oscillating RF power with increasing amplitude
        amplitude = np.linspace(0, t[0, 2] * 0.25, N_STEPS)
        t[:, 2] += amplitude * np.sin(steps * 1.5)

    elif fault == "gas_flow_blockage":
        # Gas flow drops abruptly at step 5 and stays low
        t[5:, 3] *= rng.uniform(0.15, 0.35)

    return t


def _yield_from_trace(trace: np.ndarray, fault: str | None) -> float:
    """Compute a yield percentage from sensor trace + fault status."""
    # Start with a high base yield
    base = rng.uniform(88.0, 99.0)

    if fault is None:
        return round(float(base + rng.normal(0, 1.5)), 2)

    # Fault-specific yield penalty
    penalties = {
        "chamber_pressure_drift": rng.uniform(15, 30),
        "particle_spike":         rng.uniform(20, 40),
        "rf_power_instability":   rng.uniform(10, 25),
        "gas_flow_blockage":      rng.uniform(25, 45),
    }
    degraded = base - penalties[fault] + rng.normal(0, 2)
    return round(float(np.clip(degraded, 5.0, 100.0)), 2)


# ── Defect-map generators ───────────────────────────────────────────────────
def _defect_map_scratch() -> np.ndarray:
    """Diagonal scratch pattern."""
    m = rng.uniform(0, 0.05, (MAP_SIZE, MAP_SIZE)).astype(np.float32)
    length = rng.integers(10, MAP_SIZE - 2)
    start_r = rng.integers(0, MAP_SIZE - length)
    start_c = rng.integers(0, MAP_SIZE - length)
    width = rng.integers(1, 3)
    for i in range(length):
        r = start_r + i
        c = start_c + i + rng.integers(-1, 2)
        c = np.clip(c, 0, MAP_SIZE - 1)
        r0, r1 = max(r - width, 0), min(r + width + 1, MAP_SIZE)
        m[r0:r1, c] = rng.uniform(0.6, 1.0)
    return m


def _defect_map_edge_loss() -> np.ndarray:
    """Ring of defects along the wafer edge."""
    m = rng.uniform(0, 0.05, (MAP_SIZE, MAP_SIZE)).astype(np.float32)
    cy, cx = MAP_SIZE / 2, MAP_SIZE / 2
    for r in range(MAP_SIZE):
        for c in range(MAP_SIZE):
            dist = np.sqrt((r - cy) ** 2 + (c - cx) ** 2)
            if dist > MAP_SIZE * 0.4:
                m[r, c] = rng.uniform(0.5, 1.0)
    return m


def _defect_map_center_cluster() -> np.ndarray:
    """Gaussian cluster of defects near the wafer center."""
    m = rng.uniform(0, 0.05, (MAP_SIZE, MAP_SIZE)).astype(np.float32)
    cy = MAP_SIZE // 2 + rng.integers(-3, 4)
    cx = MAP_SIZE // 2 + rng.integers(-3, 4)
    sigma = rng.uniform(2.5, 5.0)
    for r in range(MAP_SIZE):
        for c in range(MAP_SIZE):
            d2 = (r - cy) ** 2 + (c - cx) ** 2
            val = np.exp(-d2 / (2 * sigma ** 2))
            if val > 0.15:
                m[r, c] = float(val * rng.uniform(0.7, 1.0))
    return m


def _defect_map_random() -> np.ndarray:
    """Sparse random defects (background-level)."""
    m = rng.uniform(0, 0.05, (MAP_SIZE, MAP_SIZE)).astype(np.float32)
    n_defects = rng.integers(3, 20)
    rows = rng.integers(0, MAP_SIZE, n_defects)
    cols = rng.integers(0, MAP_SIZE, n_defects)
    m[rows, cols] = rng.uniform(0.4, 1.0, n_defects).astype(np.float32)
    return m


DEFECT_MAP_FNS = {
    "scratch":        _defect_map_scratch,
    "edge_loss":      _defect_map_edge_loss,
    "center_cluster": _defect_map_center_cluster,
    "random":         _defect_map_random,
}

DEFECT_TYPES = list(DEFECT_MAP_FNS.keys())


# ── Main generation ─────────────────────────────────────────────────────────
def generate():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Decide which lots are faulty (~25 % → 125 lots, ~31 per fault type)
    n_faulty = N_LOTS // 4
    fault_indices = set(rng.choice(N_LOTS, size=n_faulty, replace=False).tolist())
    fault_cycle = list(rng.permutation(
        [f for f in FAULT_TYPES for _ in range(n_faulty // len(FAULT_TYPES))]
    ))
    # Pad if not evenly divisible
    while len(fault_cycle) < n_faulty:
        fault_cycle.append(rng.choice(FAULT_TYPES))
    fault_iter = iter(fault_cycle)

    lots: list[dict] = []
    sensor_rows: list[dict] = []
    defect_maps = np.zeros((N_LOTS, MAP_SIZE, MAP_SIZE), dtype=np.float32)

    for i in range(N_LOTS):
        lot_id = f"LOT-{i:04d}"
        params = _nominal_params()

        # Fault assignment
        fault: str | None = None
        if i in fault_indices:
            fault = next(fault_iter)

        # Sensor trace
        trace = _nominal_sensor_trace(params)
        if fault is not None:
            trace = _apply_fault(trace, fault)

        # Yield
        yield_pct = _yield_from_trace(trace, fault)

        # Defect map – faulty lots get a matching pattern; normal lots get random
        if fault is not None:
            pattern = rng.choice(["scratch", "edge_loss", "center_cluster"])
        else:
            pattern = "random"
        defect_maps[i] = DEFECT_MAP_FNS[pattern]()

        # Lot record
        lot_record = {
            "lot_id": lot_id,
            **params,
            "yield_pct": yield_pct,
            "defect_pattern": pattern,
            "true_cause": fault,  # None for healthy lots
        }
        lots.append(lot_record)

        # Sensor rows (long format)
        for step in range(N_STEPS):
            row = {"lot_id": lot_id, "step": step}
            for ch_idx, ch_name in enumerate(SENSOR_CHANNELS):
                row[ch_name] = round(float(trace[step, ch_idx]), 4)
            sensor_rows.append(row)

    # ── Write outputs ────────────────────────────────────────────────────────
    # lots.json
    lots_path = DATA_DIR / "lots.json"
    with open(lots_path, "w") as f:
        json.dump(lots, f, indent=2)
    print(f"[OK] {lots_path}  ({len(lots)} lots)")

    # sensors.parquet
    sensors_path = DATA_DIR / "sensors.parquet"
    df = pd.DataFrame(sensor_rows)
    df.to_parquet(sensors_path, index=False, engine="pyarrow")
    print(f"[OK] {sensors_path}  ({len(df)} rows)")

    # defect_maps.npy
    maps_path = DATA_DIR / "defect_maps.npy"
    np.save(maps_path, defect_maps)
    print(f"[OK] {maps_path}  {defect_maps.shape}")

    # Summary
    fault_counts = {}
    for lot in lots:
        cause = lot["true_cause"] or "healthy"
        fault_counts[cause] = fault_counts.get(cause, 0) + 1
    print("\nFault distribution:")
    for cause, count in sorted(fault_counts.items()):
        print(f"  {cause:30s} {count}")


if __name__ == "__main__":
    generate()
