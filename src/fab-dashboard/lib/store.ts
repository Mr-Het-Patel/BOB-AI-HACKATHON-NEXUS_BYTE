import { create } from "zustand";
import type { UpcomingLot, Recommendation, HistoricalLot, DefectMap } from "./types";

interface DashboardState {
  upcomingLots: UpcomingLot[];
  recommendations: Recommendation[];
  historicalLots: HistoricalLot[];
  defectMaps: DefectMap[];
  selectedLotId: string | null;
  loaded: boolean;

  setData: (
    upcoming: UpcomingLot[],
    recs: Recommendation[],
    historical: HistoricalLot[],
    defectMaps: DefectMap[]
  ) => void;
  selectLot: (id: string | null) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  upcomingLots: [],
  recommendations: [],
  historicalLots: [],
  defectMaps: [],
  selectedLotId: null,
  loaded: false,

  setData: (upcoming, recs, historical, defectMaps) =>
    set({
      upcomingLots: upcoming,
      recommendations: recs,
      historicalLots: historical,
      defectMaps,
      loaded: true,
    }),

  selectLot: (id) => set({ selectedLotId: id }),
}));
