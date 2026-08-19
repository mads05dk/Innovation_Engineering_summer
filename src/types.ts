export interface GridDataPoint {
  timestamp: string;
  hour: number;
  electricityPrice: number;
  priceScore: number;
  dsoScore: number;
  tsoScore: number;
  windGenerationMw: number;
  solarGenerationMw: number;
}

export interface Scenario {
  id: string;
  name: string;
  arrivalTime: string;
  departureTime: string;
  initialSoc: number;
  batteryKWh: number;
  maxChargingPowerKw: number;
  targetSoc: number;
  points: GridDataPoint[];
}

export interface Preferences {
  departureTime: string;
  targetSoc: number;
  chargingPreference: number;
  automaticOptimization: boolean;
  allowPause: boolean;
  allowV2G: boolean;
}

export interface Weights {
  price: number;
  dso: number;
  tso: number;
}

export interface PlannedSlot extends GridDataPoint {
  combinedScore: number;
  shouldCharge: boolean;
  chargingPowerKw: number;
  deliveredKWh: number;
}

export interface ChargingPlan {
  slots: PlannedSlot[];
  finalSoc: number;
  estimatedCompletionTime: string;
  totalCostDkk: number;
  chargedKWh: number;
}

export interface SessionResult {
  finalSoc: number;
  requiredSoc: number;
  readyOnTime: boolean;
  chargingCostDkk: number;
  savedVsImmediateDkk: number;
  localPeakChargingKWh: number;
  avoidedPeakChargingKWh: number;
  favorableAlignmentPercent: number;
}
