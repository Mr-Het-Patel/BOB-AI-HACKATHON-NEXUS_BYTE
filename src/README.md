# Source Code Structure

This directory contains the complete source code for **WaferGuard** (Semiconductor Fab Yield Risk & Root-Cause Prediction System).

---

## Directory Overview

```
src/
├── ml/                     # Machine Learning & Multi-Modal Analysis Pipeline
│   ├── generate_data.py    # Synthetic wafer lot & sensor time-series data generator
│   ├── train_model.py      # LightGBM regressor training & TreeSHAP root-cause attribution
│   ├── defect_to_json.py   # Wafer 32x32 defect map exporter for frontend heatmap
│   └── model.pkl           # Trained LightGBM model artifact (MAE: 3.53%, R²: 0.881)
│
├── data/                   # Wafer Manufacturing Dataset (500 Lots)
│   ├── lots.json           # Lot process parameters, yield, and true cause labels
│   ├── sensors.parquet     # 20-step high-frequency sensor telemetry (10,000 rows)
│   ├── defect_maps.npy     # 32×32 spatial procedural defect maps (500, 32, 32)
│   └── shap_results.json   # Per-lot top-5 SHAP feature attribution vectors
│
└── fab-dashboard/          # Next.js 16 (React 19) Frontend Web Application
    ├── app/
    │   ├── dashboard/page.tsx # Main dashboard page (stats, table, detail panel, wafer heatmap)
    │   ├── globals.css        # Clean enterprise styling, responsive layout utilities
    │   ├── layout.tsx         # Root layout and metadata configuration
    │   └── page.tsx           # Entry redirect to dashboard
    ├── lib/
    │   ├── store.ts           # Zustand global state management
    │   └── types.ts           # TypeScript interfaces for Lots, Recommendations, DefectMaps
    ├── public/
    │   └── data/              # Static JSON datasets consumed by the client
    ├── package.json           # Frontend dependencies & scripts
    └── tsconfig.json          # TypeScript compiler configuration
```

---

## Architecture Flow

1. **Data Generation & Feature Engineering**:
   - `generate_data.py` simulates wafer lots with process parameters, 20-step sensor traces (temperature, chamber pressure, RF power, gas flow, particle counts), and 32×32 spatial defect maps.
2. **Model Training & SHAP Attribution**:
   - `train_model.py` extracts 40 multi-modal features (5 process params + 30 sensor summary stats + 5 spatial defect metrics) and trains a LightGBM regressor.
   - Computes TreeSHAP attributions per lot, achieving **99.2% root-cause attribution accuracy**.
3. **Frontend Dashboard**:
   - `fab-dashboard` renders upcoming pre-run batches ranked by risk, providing plain-English root causes, interactive 32×32 wafer defect heatmaps, and actionable corrective recommendations.
