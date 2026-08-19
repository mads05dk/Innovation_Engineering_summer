import type {
  ChargingPlan,
  GridDataPoint,
  PlannedSlot,
  Preferences,
  Scenario,
  SessionResult,
  Weights,
} from "../types";

const SLOT_HOURS = 0.25;

type PlanMode = "combined" | "priceOnly" | "fallbackNow";

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

export const timeToIndex = (time: string): number => {
  const [rawH, rawM] = time.split(":").map(Number);
  const h = typeof rawH === "number" && Number.isFinite(rawH) ? rawH : 0;
  const m = typeof rawM === "number" && Number.isFinite(rawM) ? rawM : 0;
  const normalized = ((h * 60 + m) % (24 * 60) + 24 * 60) % (24 * 60);
  return Math.floor(normalized / 15);
};

export const normalizeWeights = (weights: Weights): Weights => {
  const total = weights.price + weights.dso + weights.tso;
  if (total <= 0) {
    return { price: 0.4, dso: 0.35, tso: 0.25 };
  }

  return {
    price: weights.price / total,
    dso: weights.dso / total,
    tso: weights.tso / total,
  };
};

export const combinedScore = (point: GridDataPoint, weights: Weights): number => {
  const normalized = normalizeWeights(weights);
  return Number(
    (
      point.priceScore * normalized.price +
      point.dsoScore * normalized.dso +
      point.tsoScore * normalized.tso
    ).toFixed(3),
  );
};

const scheduleWindow = (startIdx: number, endIdx: number, size: number): number[] => {
  const indices: number[] = [];
  let cursor = startIdx;

  while (cursor !== endIdx) {
    indices.push(cursor);
    cursor = (cursor + 1) % size;

    if (indices.length > size) break;
  }

  return indices;
};

const emptyPlanSlots = (points: GridDataPoint[], weights: Weights): PlannedSlot[] =>
  points.map((point) => ({
    ...point,
    combinedScore: combinedScore(point, weights),
    shouldCharge: false,
    chargingPowerKw: 0,
    deliveredKWh: 0,
  }));

interface PlanOptions {
  scenario: Scenario;
  preferences: Preferences;
  weights: Weights;
  mode: PlanMode;
  currentSlot: number;
  forceCurrentCharge: boolean;
}

export const buildPlan = ({
  scenario,
  preferences,
  weights,
  mode,
  currentSlot,
  forceCurrentCharge,
}: PlanOptions): ChargingPlan => {
  const slots = emptyPlanSlots(scenario.points, weights);
  const departureIdx = timeToIndex(preferences.departureTime);
  const arrivalIdx = timeToIndex(scenario.arrivalTime);
  const indices = scheduleWindow(arrivalIdx, departureIdx, slots.length);

  const maxKWhPerSlot = scenario.maxChargingPowerKw * SLOT_HOURS;
  const requiredSoc = clamp(preferences.targetSoc, 50, 100);
  const requiredKWh = Math.max(0, ((requiredSoc - scenario.initialSoc) / 100) * scenario.batteryKWh);

  let remaining = requiredKWh;

  if (mode === "fallbackNow") {
    const ordered = [...indices].sort((a, b) => {
      const da = (a - currentSlot + slots.length) % slots.length;
      const db = (b - currentSlot + slots.length) % slots.length;
      return da - db;
    });

    for (const idx of ordered) {
      if (remaining <= 0) break;
      const slot = slots[idx];
      if (!slot) continue;
      const energy = Math.min(maxKWhPerSlot, remaining);
      slot.shouldCharge = true;
      slot.chargingPowerKw = scenario.maxChargingPowerKw;
      slot.deliveredKWh = Number(energy.toFixed(2));
      remaining -= energy;
    }
  } else {
    const candidates = [...indices].sort((a, b) => {
      const slotA = slots[a];
      const slotB = slots[b];
      if (!slotA || !slotB) return a - b;
      const scoreA = mode === "priceOnly" ? slotA.priceScore : slotA.combinedScore;
      const scoreB = mode === "priceOnly" ? slotB.priceScore : slotB.combinedScore;
      if (scoreA === scoreB) return a - b;
      return scoreA - scoreB;
    });

    if (forceCurrentCharge && indices.includes(currentSlot) && remaining > 0) {
      const current = slots[currentSlot];
      if (current) {
        const energy = Math.min(maxKWhPerSlot, remaining);
        current.shouldCharge = true;
        current.chargingPowerKw = scenario.maxChargingPowerKw;
        current.deliveredKWh = Number(energy.toFixed(2));
        remaining -= energy;
      }
    }

    for (const idx of candidates) {
      if (remaining <= 0) break;
      const slot = slots[idx];
      if (!slot || slot.shouldCharge) continue;
      const energy = Math.min(maxKWhPerSlot, remaining);
      slot.shouldCharge = true;
      slot.chargingPowerKw = scenario.maxChargingPowerKw;
      slot.deliveredKWh = Number(energy.toFixed(2));
      remaining -= energy;
    }
  }

  const chargedKWh = slots.reduce((sum, slot) => sum + slot.deliveredKWh, 0);
  const finalSoc = clamp(
    scenario.initialSoc + (chargedKWh / scenario.batteryKWh) * 100,
    scenario.initialSoc,
    100,
  );

  const chargedSlots = indices.filter((idx) => slots[idx]?.shouldCharge);
  const completionIndex = chargedSlots.at(-1) ?? arrivalIdx;
  const estimatedCompletionTime = slots[completionIndex]?.timestamp ?? slots[arrivalIdx]?.timestamp ?? "00:00";

  const totalCostDkk = Number(
    slots
      .reduce((sum, slot) => sum + slot.deliveredKWh * slot.electricityPrice, 0)
      .toFixed(2),
  );

  return {
    slots,
    finalSoc: Number(finalSoc.toFixed(1)),
    estimatedCompletionTime,
    totalCostDkk,
    chargedKWh: Number(chargedKWh.toFixed(2)),
  };
};

export const buildSessionResult = (
  optimized: ChargingPlan,
  immediate: ChargingPlan,
  requiredSoc: number,
): SessionResult => {
  const localPeakChargingKWh = optimized.slots
    .filter((slot) => slot.dsoScore >= 0.7)
    .reduce((sum, slot) => sum + slot.deliveredKWh, 0);

  const immediatePeakChargingKWh = immediate.slots
    .filter((slot) => slot.dsoScore >= 0.7)
    .reduce((sum, slot) => sum + slot.deliveredKWh, 0);

  const favorableKWh = optimized.slots
    .filter((slot) => slot.combinedScore <= 0.45)
    .reduce((sum, slot) => sum + slot.deliveredKWh, 0);

  const favorableAlignmentPercent = optimized.chargedKWh
    ? (favorableKWh / optimized.chargedKWh) * 100
    : 0;

  return {
    finalSoc: optimized.finalSoc,
    requiredSoc,
    readyOnTime: optimized.finalSoc >= requiredSoc,
    chargingCostDkk: optimized.totalCostDkk,
    savedVsImmediateDkk: Number((immediate.totalCostDkk - optimized.totalCostDkk).toFixed(2)),
    localPeakChargingKWh: Number(localPeakChargingKWh.toFixed(2)),
    avoidedPeakChargingKWh: Number((immediatePeakChargingKWh - localPeakChargingKWh).toFixed(2)),
    favorableAlignmentPercent: Number(favorableAlignmentPercent.toFixed(0)),
  };
};

export const explainCurrentPlan = (plan: ChargingPlan, currentSlot: number): string[] => {
  const current = plan.slots[currentSlot] ?? plan.slots[0];
  if (!current) return ["No schedule data available."];

  const nextCharge = plan.slots
    .map((slot, idx) => ({ slot, idx }))
    .find(({ slot, idx }) => slot.shouldCharge && ((idx - currentSlot + plan.slots.length) % plan.slots.length) > 0);

  const points: string[] = [];

  if (current.dsoScore > 0.7 && !current.shouldCharge) {
    points.push(`Charging is reduced at ${current.timestamp} due to high local grid demand.`);
  }

  if (current.priceScore > 0.7 && !current.shouldCharge) {
    points.push(`Electricity is relatively expensive at ${current.timestamp}, so charging is shifted.`);
  }

  if (nextCharge) {
    points.push(
      `Charging resumes at ${nextCharge.slot.timestamp} when the combined flexibility score is more favorable.`
    );
  }

  if (points.length === 0) {
    points.push("Charging is active now because this slot ranks as favorable against your selected limits.");
  }

  return points;
};
