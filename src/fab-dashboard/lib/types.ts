export interface ShapFeature {
  feature_name: string;
  shap_value: number;
}

export interface PlannedParams {
  temperature: number;
  pressure: number;
  rf_power: number;
  gas_flow: number;
  etch_time: number;
}

export interface UpcomingLot {
  upcoming_lot_id: string;
  predicted_yield: number;
  risk_tier: "high" | "medium" | "low";
  top_3_features: ShapFeature[];
  planned_params: PlannedParams;
  fault_hint: string | null;
}

export interface Recommendation {
  lot_id: string;
  source: "historical" | "upcoming";
  true_cause: string | null;
  recommendation: string;
  top_features: ShapFeature[];
}

export interface HistoricalLot {
  lot_id: string;
  temperature: number;
  pressure: number;
  rf_power: number;
  gas_flow: number;
  etch_time: number;
  yield_pct: number;
  true_cause: string | null;
}

export interface DefectMap {
  lot_id: string;
  defect_pattern: string;
  true_cause: string | null;
  defect_density: number;
  map: number[][]; // 32x32 array
}

