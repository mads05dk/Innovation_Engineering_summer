import type { GridDataPoint, Scenario } from "../types";

const SLOT_COUNT = 96;

const pad = (n: number): string => n.toString().padStart(2, "0");

const toTimestamp = (index: number): string => {
  const hour = Math.floor(index / 4);
  const minuteValue = (index % 4) * 15;
  const minute = pad(minuteValue);
  return `${pad(hour)}:${minute}`;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const priceFromHour = (hour: number): number => {
  if (hour >= 0 && hour < 6) return 0.9;
  if (hour >= 6 && hour < 9) return 2.6;
  if (hour >= 9 && hour < 15) return 1.6;
  if (hour >= 15 && hour < 18) return 2.1;
  if (hour >= 18 && hour < 21) return 3.0;
  return 1.25;
};

const dsoFromHour = (hour: number): number => {
  if (hour >= 17 && hour < 21) return 0.88;
  if (hour >= 6 && hour < 8) return 0.6;
  if (hour >= 21 && hour < 23) return 0.45;
  return 0.2;
};

const tsoFromHour = (hour: number): number => {
  if (hour >= 18 && hour < 20) return 0.7;
  if (hour >= 2 && hour < 5) return 0.25;
  if (hour >= 11 && hour < 15) return 0.35;
  return 0.5;
};

const solarFromHour = (hour: number): number => {
  // Winter profile: low output and narrow daylight window.
  const sunrise = 7;
  const sunset = 16;
  if (hour < sunrise || hour > sunset) return 0;
  const dayProgress = (hour - sunrise) / (sunset - sunrise);
  return Math.max(0, Math.sin(dayProgress * Math.PI)) * 420;
};

const windFromHour = (hour: number): number => {
  // Windier nights, moderate daytime with deterministic oscillation.
  const base = hour >= 20 || hour <= 5 ? 980 : 760;
  const oscillation = Math.sin((hour / 24) * Math.PI * 3) * 140;
  return Math.max(300, base + oscillation);
};

const makeWinterWeekday = (): GridDataPoint[] => {
  const data: GridDataPoint[] = [];

  for (let i = 0; i < SLOT_COUNT; i += 1) {
    const hour = i / 4;
    const modulation = Math.sin((i / SLOT_COUNT) * Math.PI * 4) * 0.08;

    const electricityPrice = Number((priceFromHour(hour) + modulation).toFixed(2));
    const priceScore = clamp01((electricityPrice - 0.8) / 2.5);
    const dsoScore = clamp01(dsoFromHour(hour) + modulation / 2);
    const tsoScore = clamp01(tsoFromHour(hour) - modulation / 3);
    const windGenerationMw = Number((windFromHour(hour) + modulation * 120).toFixed(1));
    const solarGenerationMw = Number((solarFromHour(hour) + Math.max(0, modulation) * 45).toFixed(1));

    data.push({
      timestamp: toTimestamp(i),
      hour,
      electricityPrice,
      priceScore: Number(priceScore.toFixed(3)),
      dsoScore: Number(dsoScore.toFixed(3)),
      tsoScore: Number(tsoScore.toFixed(3)),
      windGenerationMw,
      solarGenerationMw,
    });
  }

  return data;
};

export const winterWeekdayScenario: Scenario = {
  id: "winter-weekday",
  name: "Winter weekday",
  arrivalTime: "17:30",
  departureTime: "07:30",
  initialSoc: 35,
  batteryKWh: 75,
  maxChargingPowerKw: 11,
  targetSoc: 80,
  points: makeWinterWeekday(),
};
