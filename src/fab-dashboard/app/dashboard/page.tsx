"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardStore } from "@/lib/store";
import type { UpcomingLot, Recommendation, DefectMap } from "@/lib/types";

const COST_PER_LOT = 50000;

// ── Human-friendly label helper ───────────────────────────────────────────────

function friendlyFeatureName(name: string): string {
  const map: Record<string, string> = {
    pressure: "Chamber Pressure Drift",
    pressure_mTorr: "Chamber Pressure",
    pressure_std: "Pressure Fluctuations",
    pressure_slope: "Pressure Upward Drift",
    temperature: "Temperature Excursion",
    temperature_C: "Process Temperature",
    temperature_std: "Temperature Instability",
    sensor_std: "Sensor Telemetry Variance",
    sensor_max: "Peak Sensor Spike",
    particle_spike: "Particle Burst Event",
    particle_count_mean: "High Particle Count",
    particle_count_max: "Particle Spike",
    rf_power: "RF Power Mismatch",
    rf_power_range: "RF Power Oscillation",
    rf_power_W: "RF Power Level",
    gas_flow: "Gas Flow Restriction",
    gas_flow_slope: "Gas Flow Drop",
    gas_flow_sccm: "Gas Flow Rate",
    defect_density: "Surface Defect Density",
    defect_edge_ratio: "Edge Defect Concentration",
    defect_cluster_score: "Center Defect Cluster",
  };
  return map[name] || name.replace(/_/g, " ");
}

// ── Clean Wafer Heatmap Canvas ───────────────────────────────────────────────

function WaferHeatmap({
  mapData,
  size = 160,
  patternName,
  density,
}: {
  mapData?: number[][];
  size?: number;
  patternName?: string;
  density?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData || !mapData.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const radius = size / 2;
    const cx = radius;
    const cy = radius;
    const waferR = radius - 8;

    ctx.clearRect(0, 0, size, size);

    // Silicon wafer base
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, waferR, 0, Math.PI * 2);
    ctx.fillStyle = "#1e293b"; // Clean slate substrate
    ctx.fill();
    ctx.clip();

    const rows = mapData.length;
    const cols = mapData[0].length;
    const cellW = (waferR * 2) / cols;
    const cellH = (waferR * 2) / rows;
    const startX = cx - waferR;
    const startY = cy - waferR;

    // Draw defect heatmap
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = mapData[r][c];
        const cellX = startX + c * cellW;
        const cellY = startY + r * cellH;

        const dX = cellX + cellW / 2 - cx;
        const dY = cellY + cellH / 2 - cy;
        if (dX * dX + dY * dY > waferR * waferR) continue;

        if (val > 0.12) {
          let color = "#10b981"; // Normal/low
          if (val > 0.65) {
            color = `rgba(239, 68, 68, ${Math.min(1, 0.5 + val * 0.5)})`; // Red
          } else if (val > 0.35) {
            color = `rgba(245, 158, 11, ${Math.min(1, 0.45 + val * 0.55)})`; // Amber
          } else {
            color = `rgba(16, 185, 129, ${Math.min(1, 0.4 + val * 0.5)})`; // Green
          }
          ctx.fillStyle = color;
          ctx.fillRect(cellX, cellY, cellW + 0.5, cellH + 0.5);
        }
      }
    }

    // Subtle wafer grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(startX + i * 4 * cellW, startY);
      ctx.lineTo(startX + i * 4 * cellW, startY + waferR * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(startX, startY + i * 4 * cellH);
      ctx.lineTo(startX + waferR * 2, startY + i * 4 * cellH);
      ctx.stroke();
    }

    ctx.restore();

    // Outer wafer ring
    ctx.beginPath();
    ctx.arc(cx, cy, waferR, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#475569";
    ctx.stroke();

    // Orientation flat / notch at bottom
    ctx.beginPath();
    ctx.arc(cx, cy + waferR, 4, Math.PI, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.stroke();
  }, [mapData, size]);

  if (!mapData || !mapData.length) {
    return (
      <div style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "1px dashed #cbd5e1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#94a3b8",
        fontSize: 12,
      }}>
        No Map
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
        }}
      />
      {(patternName || density !== undefined) && (
        <div style={{
          marginTop: 10,
          display: "flex",
          gap: 8,
          alignItems: "center",
          fontSize: 12,
        }}>
          {patternName && (
            <span style={{
              fontWeight: 600,
              color: "#0f172a",
              background: "#f1f5f9",
              padding: "2px 8px",
              borderRadius: 4,
              border: "1px solid #e2e8f0",
              textTransform: "capitalize",
            }}>
              {patternName.replace(/_/g, " ")} Pattern
            </span>
          )}
          {density !== undefined && (
            <span style={{ color: "#64748b" }}>
              {(density * 100).toFixed(1)}% Defect Rate
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Feature Impact Bar ────────────────────────────────────────────────────────

function FeatureBar({ name, value, maxAbs }: { name: string; value: number; maxAbs: number }) {
  const pct = maxAbs > 0 ? (Math.abs(value) / maxAbs) * 100 : 0;
  const isLoss = value < 0; // In yield modeling, negative SHAP = drags yield down

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: "#334155", fontWeight: 500 }}>
          {friendlyFeatureName(name)}
        </span>
        <span style={{
          color: isLoss ? "#dc2626" : "#16a34a",
          fontWeight: 600,
        }}>
          {value > 0 ? "+" : ""}{value.toFixed(1)}% yield impact
        </span>
      </div>
      <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: isLoss ? "#ef4444" : "#10b981",
          borderRadius: 4,
          transition: "width 0.3s ease",
        }} />
      </div>
    </div>
  );
}

// ── Main Dashboard Component ──────────────────────────────────────────────────

export default function DashboardPage() {
  const { upcomingLots, recommendations, historicalLots, defectMaps, selectedLotId, loaded, setData, selectLot } =
    useDashboardStore();

  const [filterTier, setFilterTier] = useState<"all" | "high" | "medium" | "low">("all");
  const [activePatternTab, setActivePatternTab] = useState<string>("edge_loss");

  useEffect(() => {
    if (loaded) return;
    Promise.all([
      fetch("/data/upcoming_risk.json").then((r) => r.json()),
      fetch("/data/recommendations.json").then((r) => r.json()),
      fetch("/data/lots.json").then((r) => r.json()),
      fetch("/data/defect_maps.json").then((r) => r.json()).catch(() => []),
    ]).then(([upcoming, recs, lots, defMaps]) => {
      const sorted = [...upcoming].sort(
        (a: UpcomingLot, b: UpcomingLot) => a.predicted_yield - b.predicted_yield
      );
      setData(sorted, recs, lots, defMaps || []);
      if (sorted.length > 0) {
        selectLot(sorted[0].upcoming_lot_id);
      }
    });
  }, [loaded, setData, selectLot]);

  const selectedLot = upcomingLots.find((l) => l.upcoming_lot_id === selectedLotId) ?? upcomingLots[0] ?? null;
  const selectedRec = recommendations.find((r) => r.lot_id === selectedLot?.upcoming_lot_id);

  // Link selected lot to matching reference defect map
  const selectedDefectMap = useMemo(() => {
    if (!selectedLot || !defectMaps.length) return undefined;
    const hint = selectedLot.fault_hint;
    if (hint === "pressure_drift") {
      return defectMaps.find((d) => d.defect_pattern === "edge_loss") || defectMaps[0];
    }
    if (hint === "temp_excursion") {
      return defectMaps.find((d) => d.defect_pattern === "center_cluster") || defectMaps[0];
    }
    if (hint === "particle_spike") {
      return defectMaps.find((d) => d.defect_pattern === "scratch" || d.true_cause === "particle_spike") || defectMaps[0];
    }
    if (hint === "pressure_drift+temp_excursion") {
      return defectMaps.find((d) => d.defect_pattern === "edge_loss") || defectMaps[0];
    }
    return defectMaps.find((d) => d.defect_pattern === "random") || defectMaps[0];
  }, [selectedLot, defectMaps]);

  // Gallery reference map
  const galleryDefectMap = useMemo(() => {
    if (!defectMaps.length) return undefined;
    return defectMaps.find((d) => d.defect_pattern === activePatternTab) || defectMaps[0];
  }, [defectMaps, activePatternTab]);

  // Key metrics
  const highRiskLots = upcomingLots.filter((l) => l.risk_tier === "high");
  const medRiskLots = upcomingLots.filter((l) => l.risk_tier === "medium");
  const normalLots = upcomingLots.filter((l) => l.risk_tier === "low");

  const totalAtRiskCost = highRiskLots.reduce(
    (sum, l) => sum + ((100 - l.predicted_yield) / 100) * COST_PER_LOT,
    0
  );

  const avgPredictedYield = upcomingLots.length
    ? upcomingLots.reduce((sum, l) => sum + l.predicted_yield, 0) / upcomingLots.length
    : 0;

  // Filtered rows
  const displayedLots = upcomingLots.filter((lot) => {
    if (filterTier === "all") return true;
    return lot.risk_tier === filterTier;
  });

  const maxAbsShap = selectedLot
    ? Math.max(...selectedLot.top_3_features.map((f) => Math.abs(f.shap_value)), 0.1)
    : 1;

  if (!loaded) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        color: "#64748b",
        fontFamily: "sans-serif",
      }}>
        Loading batch predictions…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      {/* ── Simple Top Header ── */}
      <header className="header-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            background: "#2563eb",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 16,
          }}>
            W
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2, color: "#0f172a" }}>
              WaferGuard · Fab Yield Predictor
            </h1>
            <p style={{ fontSize: 11, color: "#64748b" }}>
              Pre-run Risk & Quality Control for Semiconductor Lots
            </p>
          </div>
        </div>

        <div className="header-meta" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#16a34a",
            background: "#f0fdf4",
            padding: "4px 10px",
            borderRadius: 20,
            border: "1px solid #bbf7d0",
            fontWeight: 500,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />
            Fab Line 4 Active
          </div>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            20 Batches Queued
          </span>
        </div>
      </header>

      <main className="dashboard-container">
        {/* ── 4 Clean Summary Cards ── */}
        <section className="stat-grid">
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
              High Risk Batches
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#991b1b", lineHeight: 1.1 }}>
              {highRiskLots.length}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              Require recipe adjustment before run
            </div>
          </div>

          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
              Moderate Warning
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#92400e", lineHeight: 1.1 }}>
              {medRiskLots.length}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              Yield between 80% – 90% (monitoring)
            </div>
          </div>

          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
              Avg Expected Yield
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#1e3a8a", lineHeight: 1.1 }}>
              {avgPredictedYield.toFixed(1)}%
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              Target benchmark: &gt;90.0%
            </div>
          </div>

          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
              Estimated Scrap Risk
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", lineHeight: 1.1 }}>
              ${(totalAtRiskCost / 1000).toFixed(0)}k
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              Potential loss across flagged batches
            </div>
          </div>
        </section>

        {/* ── Main Two-Column View ── */}
        <div className="main-grid">
          {/* Left Column: Table & Defect Reference */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Table Card */}
            <div className="card" style={{ overflow: "hidden" }}>
              {/* Table Toolbar */}
              <div style={{
                padding: "14px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>
                    Upcoming Scheduled Batches
                  </h2>
                  <p style={{ fontSize: 12, color: "#64748b" }}>
                    Select a batch to inspect root causes, recipe parameters, and corrective actions
                  </p>
                </div>

                {/* Filter tabs */}
                <div style={{
                  display: "flex",
                  background: "#f1f5f9",
                  padding: 3,
                  borderRadius: 6,
                  gap: 2,
                }}>
                  {[
                    { id: "all", label: `All (${upcomingLots.length})` },
                    { id: "high", label: `High Risk (${highRiskLots.length})` },
                    { id: "medium", label: `Moderate (${medRiskLots.length})` },
                    { id: "low", label: `Normal (${normalLots.length})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFilterTier(tab.id as any)}
                      style={{
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: 500,
                        borderRadius: 4,
                        border: "none",
                        cursor: "pointer",
                        background: filterTier === tab.id ? "#ffffff" : "transparent",
                        color: filterTier === tab.id ? "#0f172a" : "#64748b",
                        boxShadow: filterTier === tab.id ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="table-scroll-container">
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: 600 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "#475569" }}>Batch ID</th>
                      <th style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "#475569" }}>Expected Yield</th>
                      <th style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "#475569" }}>Risk Level</th>
                      <th style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "#475569" }}>Primary Concern</th>
                      <th style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "#475569" }}>Pressure</th>
                      <th style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "#475569" }}>Temp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedLots.map((lot) => {
                      const isSelected = selectedLot?.upcoming_lot_id === lot.upcoming_lot_id;
                      const isHigh = lot.risk_tier === "high";
                      const isMed = lot.risk_tier === "medium";

                      return (
                        <tr
                          key={lot.upcoming_lot_id}
                          onClick={() => selectLot(lot.upcoming_lot_id)}
                          style={{
                            cursor: "pointer",
                            borderBottom: "1px solid #e2e8f0",
                            background: isSelected ? "#eff6ff" : "transparent",
                            transition: "background 0.12s ease",
                          }}
                        >
                          <td style={{ padding: "12px 16px", fontWeight: 600, color: isSelected ? "#2563eb" : "#0f172a" }}>
                            {lot.upcoming_lot_id}
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: isHigh ? "#dc2626" : isMed ? "#d97706" : "#16a34a" }}>
                            {lot.predicted_yield.toFixed(1)}%
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 600,
                              background: isHigh ? "#fee2e2" : isMed ? "#fef3c7" : "#dcfce7",
                              color: isHigh ? "#991b1b" : isMed ? "#92400e" : "#166534",
                              border: `1px solid ${isHigh ? "#fecaca" : isMed ? "#fde68a" : "#bbf7d0"}`,
                            }}>
                              {isHigh ? "High Risk" : isMed ? "Warning" : "Normal"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", color: "#475569", fontSize: 13 }}>
                            {lot.fault_hint ? friendlyFeatureName(lot.fault_hint) : "Nominal recipe"}
                          </td>
                          <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 13 }}>
                            {lot.planned_params.pressure.toFixed(1)} Torr
                          </td>
                          <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 13 }}>
                            {lot.planned_params.temperature.toFixed(0)} °C
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Common Wafer Defect Patterns Card */}
            <div className="card" style={{ padding: "18px 20px" }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
                flexWrap: "wrap",
                gap: 10,
              }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                    Wafer Defect Pattern Guide
                  </h3>
                  <p style={{ fontSize: 12, color: "#64748b" }}>
                    Visual reference of common defect distributions and equipment causes
                  </p>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { id: "edge_loss", label: "Edge Ring" },
                    { id: "center_cluster", label: "Center Cluster" },
                    { id: "scratch", label: "Scratch Line" },
                    { id: "random", label: "Clean Baseline" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActivePatternTab(tab.id)}
                      style={{
                        padding: "4px 10px",
                        fontSize: 12,
                        borderRadius: 4,
                        border: `1px solid ${activePatternTab === tab.id ? "#2563eb" : "#e2e8f0"}`,
                        background: activePatternTab === tab.id ? "#eff6ff" : "#ffffff",
                        color: activePatternTab === tab.id ? "#2563eb" : "#475569",
                        fontWeight: activePatternTab === tab.id ? 600 : 400,
                        cursor: "pointer",
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {galleryDefectMap && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: 16,
                  flexWrap: "wrap",
                }}>
                  <WaferHeatmap
                    mapData={galleryDefectMap.map}
                    size={120}
                    patternName={galleryDefectMap.defect_pattern}
                    density={galleryDefectMap.defect_density}
                  />

                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>
                      {galleryDefectMap.defect_pattern === "edge_loss" && "Edge Ring Pattern (Chamber Pressure Drift)"}
                      {galleryDefectMap.defect_pattern === "center_cluster" && "Center Cluster Pattern (Thermal / RF Instability)"}
                      {galleryDefectMap.defect_pattern === "scratch" && "Scratch Trajectory (Particle Flaking / Handler Friction)"}
                      {galleryDefectMap.defect_pattern === "random" && "Nominal Baseline (Standard Clean Wafer)"}
                    </div>
                    <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                      {galleryDefectMap.defect_pattern === "edge_loss" &&
                        "Defects cluster around the wafer perimeter. Typically caused when chamber pressure drifts high (>9 Torr), creating plasma density variations between the edge and center."}
                      {galleryDefectMap.defect_pattern === "center_cluster" &&
                        "Defects concentrate in the central 16×16 wafer core. Caused by localized overheating or RF power impedance mismatch leading to center-peaked etch rates."}
                      {galleryDefectMap.defect_pattern === "scratch" &&
                        "A distinct diagonal defect trace across the surface. Caused by chamber deposition flaking, loose particle bursts, or robotic wafer handling friction."}
                      {galleryDefectMap.defect_pattern === "random" &&
                        "Sparse background particles (<1.5% defect rate). Represents a healthy wafer manufactured under nominal recipe specifications."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Selected Batch Details Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {selectedLot ? (
              <div className="card" style={{ padding: "20px" }}>
                {/* Batch Header */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: 14,
                  borderBottom: "1px solid #e2e8f0",
                  marginBottom: 16,
                }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Batch Details
                    </span>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                      {selectedLot.upcoming_lot_id}
                    </h3>
                  </div>

                  <span style={{
                    padding: "4px 10px",
                    borderRadius: 14,
                    fontSize: 12,
                    fontWeight: 600,
                    background: selectedLot.risk_tier === "high" ? "#fee2e2" : selectedLot.risk_tier === "medium" ? "#fef3c7" : "#dcfce7",
                    color: selectedLot.risk_tier === "high" ? "#991b1b" : selectedLot.risk_tier === "medium" ? "#92400e" : "#166534",
                    border: `1px solid ${selectedLot.risk_tier === "high" ? "#fecaca" : selectedLot.risk_tier === "medium" ? "#fde68a" : "#bbf7d0"}`,
                  }}>
                    {selectedLot.risk_tier === "high" ? "High Risk Batch" : selectedLot.risk_tier === "medium" ? "Moderate Warning" : "Ready to Run"}
                  </span>
                </div>

                {/* Expected Yield Box */}
                <div style={{
                  background: selectedLot.risk_tier === "high" ? "#fef2f2" : "#f8fafc",
                  border: `1px solid ${selectedLot.risk_tier === "high" ? "#fecaca" : "#e2e8f0"}`,
                  borderRadius: 6,
                  padding: "14px 16px",
                  marginBottom: 18,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
                    Predicted Yield
                  </div>
                  <div style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: selectedLot.risk_tier === "high" ? "#dc2626" : selectedLot.risk_tier === "medium" ? "#d97706" : "#16a34a",
                    lineHeight: 1.1,
                    marginTop: 2,
                  }}>
                    {selectedLot.predicted_yield.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                    Estimated value at risk:{" "}
                    <strong>
                      ${(((100 - selectedLot.predicted_yield) / 100) * COST_PER_LOT).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </strong>{" "}
                    (based on $50k batch cost)
                  </div>
                </div>

                {/* Key Drivers (Feature Importance) */}
                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 10 }}>
                    Main Factors Affecting Yield
                  </h4>
                  {selectedLot.top_3_features.map((f) => (
                    <FeatureBar
                      key={f.feature_name}
                      name={f.feature_name}
                      value={f.shap_value}
                      maxAbs={maxAbsShap}
                    />
                  ))}
                </div>

                {/* Wafer Defect Signature */}
                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 10 }}>
                    Predicted Wafer Defect Map
                  </h4>
                  <div style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}>
                    <WaferHeatmap
                      mapData={selectedDefectMap?.map}
                      size={130}
                      patternName={selectedDefectMap?.defect_pattern}
                      density={selectedDefectMap?.defect_density}
                    />
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, textAlign: "center" }}>
                      {selectedLot.risk_tier === "high"
                        ? `Historical signature: ${selectedDefectMap?.defect_pattern ?? "defect"} pattern`
                        : "Nominal recipe: clean surface inspection profile"}
                    </div>
                  </div>
                </div>

                {/* Planned Recipe Parameters */}
                <div style={{ marginBottom: 18 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 10 }}>
                    Planned Machine Parameters
                  </h4>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px 12px",
                    background: "#f8fafc",
                    padding: 12,
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Pressure:</span>
                      <strong style={{ color: "#0f172a" }}>{selectedLot.planned_params.pressure.toFixed(1)} Torr</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Temperature:</span>
                      <strong style={{ color: "#0f172a" }}>{selectedLot.planned_params.temperature.toFixed(0)} °C</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>RF Power:</span>
                      <strong style={{ color: "#0f172a" }}>{selectedLot.planned_params.rf_power.toFixed(0)} W</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Gas Flow:</span>
                      <strong style={{ color: "#0f172a" }}>{selectedLot.planned_params.gas_flow.toFixed(0)} sccm</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gridColumn: "span 2" }}>
                      <span style={{ color: "#64748b" }}>Etch Duration:</span>
                      <strong style={{ color: "#0f172a" }}>{selectedLot.planned_params.etch_time.toFixed(0)} seconds</strong>
                    </div>
                  </div>
                </div>

                {/* Recommended Corrective Action */}
                {selectedRec && (
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>
                      Recommended Action
                    </h4>
                    <div style={{
                      padding: "12px 14px",
                      background: selectedLot.risk_tier === "high" ? "#fef2f2" : "#f0fdf4",
                      border: `1px solid ${selectedLot.risk_tier === "high" ? "#fecaca" : "#bbf7d0"}`,
                      borderRadius: 6,
                      fontSize: 13,
                      color: selectedLot.risk_tier === "high" ? "#991b1b" : "#166534",
                      lineHeight: 1.5,
                    }}>
                      {selectedRec.recommendation}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="card" style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
                Select a batch from the table to view details
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
