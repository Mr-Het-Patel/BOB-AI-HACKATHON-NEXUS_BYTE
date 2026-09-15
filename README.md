# 🚀 WaferGuard: Semiconductor Fab Yield Risk & Root-Cause Prediction System

> **A pre-run yield forecasting, multi-modal defect analysis, and probabilistic root-cause prevention platform for semiconductor manufacturing.**

---

## 👥 Team

| Field | Value |
|---|---|
| **Team Name** | NEXUS_BYTE |
| **Track** | AI (Semiconductor Manufacturing) |
| **Team Lead** | Archi Bhatt — 25dce009@charusat.edu.in |
| **Members** | Het Patel (25dce082@charusat.edu.in), Vatsal Makwana (25dce050@charusat.edu.in), Gehna Patel (25dce080@charusat.edu.in) |

---

## 🎯 Problem Statement

In semiconductor manufacturing, microscopic deviations in process parameters, equipment sensor telemetry, and spatial wafer defect patterns cause catastrophic yield excursions exceeding $50,000 per lot. Existing Statistical Process Control (SPC) systems are reactive post-run alarms that lack multi-modal data fusion, probabilistic root-cause attribution, and predictive pre-run recipe intervention.

---

## 💡 Solution

**WaferGuard** unifies 5 recipe parameters, 20-step high-frequency sensor traces (10,000 telemetry points), and 32×32 spatial wafer defect maps into a multi-modal LightGBM yield regressor and TreeSHAP attribution engine. It predicts upcoming batch yields before execution, isolates root causes with **99.2% attribution accuracy**, renders live circular silicon wafer defect heatmaps, and prescribes actionable corrective engineering adjustments.

---

## ✨ Key Features

- **Pre-Run Predictive Batch Flagging**: Predicts expected yield for upcoming scheduled batches using strictly planned recipe parameters before wafers enter the chamber (zero post-run data leakage).
- **Multi-Modal Data Fusion**: Merges continuous physics recipe parameters, 20-step multi-channel sensor statistics, and 32×32 spatial wafer defect maps into a unified 40-feature representation.
- **Probabilistic Root-Cause Attribution (TreeSHAP)**: Ranks underlying failure mechanisms by mathematical contribution with 99.2% fault isolation accuracy across pressure drift, particle bursts, RF instability, and gas flow blockage.
- **Interactive Wafer Defect Heatmap Canvas**: Hardware-accelerated HTML5 `<canvas>` rendering of 32×32 wafer defect maps with orientation notch, multi-tier color scaling, and an interactive Defect Pattern Library (`Edge Ring`, `Center Cluster`, `Scratch Line`, `Clean Baseline`).
- **Actionable Corrective Guidance**: Automatically pairs diagnosed root causes with specific SOP corrective actions for fab operators to recover yield before execution.

---

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| **Languages** | Python 3.10+, TypeScript, JavaScript, HTML5, CSS3 |
| **Machine Learning** | LightGBM, TreeSHAP, scikit-learn, NumPy, SciPy, Pandas, PyArrow |
| **Frontend Framework** | Next.js 16 (App Router), React 19, Zustand |
| **Styling & Visualization** | HTML5 Canvas API, Vanilla CSS (Clean Enterprise Theme) |
| **Deployment & DevOps** | Vercel (Production Deployed), GitHub Actions |

---

## 📁 Repository Structure

```
├── src/
│   ├── ml/                     # Machine learning pipeline (training, data gen, defect exporter)
│   ├── data/                   # 500-lot wafer manufacturing dataset (sensors, maps, SHAP)
│   └── fab-dashboard/          # Next.js 16 enterprise web dashboard
├── docs/
│   ├── problem-statement.md    # In-depth problem statement and domain impact
│   ├── solution-overview.md    # Detailed technical solution overview
│   ├── architecture.md         # Component diagrams & data flow (Mermaid)
│   └── setup-guide.md          # Tested step-by-step local setup instructions
├── demo/
│   ├── live-demo-url.txt       # Production Vercel deployment link
│   ├── demo-video-link.txt     # Video walkthrough URL
│   └── screenshots/            # High-resolution UI screenshots
├── presentation/               # Slide deck / presentation materials
└── submission.yaml             # Structured submission metadata
```

---

## ⚡ How to Run

### 1. Clone the repository
```bash
git clone https://github.com/mr-het-patel/bob-ai-hackathon-NEXUS_BYTE.git
cd bob-ai-hackathon-NEXUS_BYTE
```

### 2. Install ML Dependencies & Run Pipeline (Optional)
```bash
pip install lightgbm shap numpy pandas pyarrow scikit-learn
python src/ml/train_model.py
```

### 3. Run the Frontend Dashboard
```bash
cd src/fab-dashboard
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🖥️ Demo

| Artifact | Link |
|---|---|
| 🌐 Live Production Demo | [https://fab-dashboard-wine.vercel.app](https://fab-dashboard-wine.vercel.app) (also in [`demo/live-demo-url.txt`](demo/live-demo-url.txt)) |
| 📹 Demo Video | [See demo/demo-video-link.txt](demo/demo-video-link.txt) |
| 🖼️ UI Screenshots | [See demo/screenshots/](demo/screenshots/) |
| 📊 Presentation Deck | [See presentation/](presentation/) |

---

## ⚠️ Known Limitations

- Sensor time-series and wafer defect maps are procedurally synthesized using fab semiconductor physics models rather than live factory SECS/GEM equipment streaming.
- Model trained on 4 primary etch/chamber failure modes; expanding to wider deposition and photolithography excursion types is planned for future work.

---

## 🏅 What We're Most Proud Of

Our multi-modal ML pipeline genuinely fuses continuous process parameters, high-frequency sensor time-series, and 2D spatial defect maps to achieve **99.2% root-cause attribution accuracy** and pre-run yield forecasting on a clean, human-crafted enterprise quality dashboard deployed live on Vercel.
