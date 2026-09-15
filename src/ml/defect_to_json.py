"""
defect_to_json.py – Convert defect_maps.npy to public/data/defect_maps.json
for wafer defect heatmap rendering on the dashboard.
"""

import json
import pathlib
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DASHBOARD_DATA_DIR = ROOT / "ml" / "fab-dashboard" / "public" / "data"

LOTS_PATH = DATA_DIR / "lots.json"
DEFECT_MAPS_PATH = DATA_DIR / "defect_maps.npy"
OUTPUT_PATH = DASHBOARD_DATA_DIR / "defect_maps.json"


def main():
    print(f"Loading lots from {LOTS_PATH}...")
    with open(LOTS_PATH, "r") as f:
        lots = json.load(f)

    print(f"Loading defect maps from {DEFECT_MAPS_PATH}...")
    maps = np.load(DEFECT_MAPS_PATH)
    print(f"  Maps shape: {maps.shape}")

    DASHBOARD_DATA_DIR.mkdir(parents=True, exist_ok=True)

    records = []
    # Include all lots with faults (~125) plus first 10 healthy lots as baseline
    for i, lot in enumerate(lots):
        has_fault = lot.get("true_cause") is not None
        if has_fault or i < 10:
            m = maps[i]
            # Round to 1 decimal place (0.0 to 1.0) for fast client-side rendering & small payload
            rounded_map = np.round(m, 1).tolist()
            density = float(np.mean(m > 0.20))
            records.append({
                "lot_id": lot["lot_id"],
                "defect_pattern": lot.get("defect_pattern", "random"),
                "true_cause": lot.get("true_cause"),
                "defect_density": round(density, 3),
                "map": rounded_map,
            })

    with open(OUTPUT_PATH, "w") as f:
        json.dump(records, f, separators=(",", ":"))

    file_size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"[OK] Wrote {len(records)} defect maps to {OUTPUT_PATH} ({file_size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
