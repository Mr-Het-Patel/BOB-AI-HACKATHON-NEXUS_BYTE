# Problem Statement

## Background

In semiconductor manufacturing (wafer fabrication), yields directly dictate fab profitability. A single advanced node wafer lot can represent over $50,000 to $100,000 in manufacturing value. Fabrication involves hundreds of sequential steps—including plasma etching, chemical vapor deposition (CVD), and photolithography—where microscopic excursions in chamber conditions cause catastrophic yield loss and defect formation.

## The Problem

Fab engineers currently face three major bottlenecks:
1. **Siloed Multi-Modal Data**: Process recipe parameters, high-frequency equipment sensor telemetry (e.g. pressure, RF power, gas flow), and spatial wafer defect maps (SEM/optical inspection) reside in disparate systems, preventing integrated cross-modal root-cause analysis.
2. **Reactive Failure Triage**: Root-cause analysis happens *post-mortem* after entire wafer lots have already been processed and scrapped.
3. **Lack of Probabilistic Attribution & Actionable Guidance**: Standard fault detection systems raise binary alarms without ranking root causes by mathematical probability or offering specific, closed-loop recipe adjustments.

## Who is Affected

- **Fab Process & Yield Engineers**: Tasked with debugging yield excursions and tuning process recipes under tight production deadlines.
- **Equipment Maintenance Technicians**: Needing rapid root-cause isolation (e.g. distinguishing MFC gas flow blockage from RF matching network drift).
- **Fab Operations Managers**: Responsible for minimizing wafer scrap costs, scrap risk, and equipment downtime.

## Why It Matters

- **Massive Scrap Costs**: A single unrecognized process drift across a 25-wafer lot can result in over $50,000 in immediate scrap loss.
- **Downtime & Investigation Delays**: Manual log inspection and defect map triage often takes hours to days per incident.
- **Predictive Advantage**: Accurately flagging planned, pre-run batch recipes *before execution* prevents faulty wafers from ever entering the chamber.

## Why Existing Solutions Fall Short

Traditional Statistical Process Control (SPC) and isolated sensor thresholding only trigger alerts after run completion, treat equipment telemetry in isolation from spatial wafer defect maps, and offer zero probabilistic root-cause explanations or actionable parameter corrections.
