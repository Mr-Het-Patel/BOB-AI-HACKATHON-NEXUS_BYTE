# Setup Guide

> **Follow these step-by-step instructions to run the ML pipeline and start the frontend dashboard locally.**

---

## Prerequisites

Ensure you have the following installed on your system:

- [x] **Python 3.10+** (tested on Python 3.11 & 3.14)
- [x] **Node.js 18+** (tested on Node.js 20 & 24)
- [x] **Git**

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/mr-het-patel/bob-ai-hackathon-NEXUS_BYTE.git
cd bob-ai-hackathon-NEXUS_BYTE
```

### 2. Set Up Python Machine Learning Environment

```bash
# Install required Python ML packages
pip install lightgbm shap numpy pandas pyarrow scikit-learn
```

### 3. Set Up Frontend Web Dashboard

```bash
# Navigate to frontend directory and install dependencies
cd src/fab-dashboard
npm install
cd ../..
```

---

## Running the Project

### Step 1: (Optional) Re-generate Dataset & Train ML Model

The repository already includes pre-trained model artifacts and dataset files in `src/data/` and `src/ml/`. To retrain from scratch:

```bash
# 1. Generate synthetic wafer lot data, sensor parquet traces, and defect maps
python src/ml/generate_data.py

# 2. Train LightGBM model and compute TreeSHAP feature attributions
python src/ml/train_model.py

# 3. Export defect maps for frontend heatmap visualization
python src/ml/defect_to_json.py
```

### Step 2: Start the Web Dashboard

```bash
# Navigate to the frontend directory
cd src/fab-dashboard

# Start the local development server
npm run dev
```

Open your browser and navigate to: **[http://localhost:3000](http://localhost:3000)** (or [http://localhost:3000/dashboard](http://localhost:3000/dashboard)).

---

## Running Production Build & Verification

```bash
cd src/fab-dashboard
npm run build
npm run start
```

---

## Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| `ModuleNotFoundError: No module named 'lightgbm'` | Python dependencies not installed | Run `pip install lightgbm shap numpy pandas pyarrow scikit-learn` |
| `npm : File npm.ps1 cannot be loaded` (Windows PowerShell) | Execution policy restriction | Use `npm.cmd run dev` or `npm.cmd run build` in PowerShell |
| Port 3000 in use | Another service is using port 3000 | Run `npm run dev -- -p 3001` to start on port 3001 |
