import type { GridDataPoint, Scenario } from "../types";

const SLOT_COUNT = 96;
const MINUTES_PER_SLOT = 15;
const DAY_MINUTES = 24 * 60;

interface ProfilePoint {
  time: string;
  value: number;
}

const pad = (n: number): string => n.toString().padStart(2, "0");

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const parseTimeToMinutes = (time: string): number => {
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  if (h === 24 && m === 0) return DAY_MINUTES;
  return Math.max(0, Math.min(DAY_MINUTES, h * 60 + m));
};

const sortProfile = (points: ProfilePoint[]): Array<{ minute: number; value: number }> => {
  const ordered = points
    .map((point) => ({ minute: parseTimeToMinutes(point.time), value: point.value }))
    .sort((a, b) => a.minute - b.minute);

  if (ordered.length === 0) {
    return [
      { minute: 0, value: 0 },
      { minute: DAY_MINUTES, value: 0 },
    ];
  }

  const withStart = ordered[0]?.minute === 0 ? ordered : [{ minute: 0, value: ordered[0]?.value ?? 0 }, ...ordered];
  const withEnd = withStart.at(-1)?.minute === DAY_MINUTES
    ? withStart
    : [...withStart, { minute: DAY_MINUTES, value: withStart[0]?.value ?? 0 }];

  return withEnd;
};

const interpolateProfile = (anchors: ProfilePoint[]): number[] => {
  const sorted = sortProfile(anchors);
  const values: number[] = [];

  for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
    const minute = slot * MINUTES_PER_SLOT;
    let left = sorted[0]!;
    let right = sorted[1] ?? sorted[0]!;

    for (let i = 1; i < sorted.length; i += 1) {
      const current = sorted[i] ?? right;
      if (minute <= current.minute) {
        left = sorted[i - 1] ?? left;
        right = current;
        break;
      }
    }

    const range = right.minute - left.minute;
    const ratio = range === 0 ? 0 : (minute - left.minute) / range;
    values.push(left.value + (right.value - left.value) * ratio);
  }

  return values;
};

const toTimestamp = (index: number): string => {
  const hour = Math.floor(index / 4);
  const minuteValue = (index % 4) * 15;
  const minute = pad(minuteValue);
  return `${pad(hour)}:${minute}`;
};

interface ScenarioProfiles {
  priceAnchors: ProfilePoint[];
  dsoAnchors: ProfilePoint[];
  tsoAnchors: ProfilePoint[];
  windAnchors: ProfilePoint[];
  solarAnchors: ProfilePoint[];
}

const buildPoints = (profiles: ScenarioProfiles): GridDataPoint[] => {
  const data: GridDataPoint[] = [];
  const prices = interpolateProfile(profiles.priceAnchors);
  const dso = interpolateProfile(profiles.dsoAnchors).map((v) => clamp01(v));
  const tso = interpolateProfile(profiles.tsoAnchors).map((v) => clamp01(v));
  const wind = interpolateProfile(profiles.windAnchors).map((v) => Math.max(0, v));
  const solar = interpolateProfile(profiles.solarAnchors).map((v) => Math.max(0, v));

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = Math.max(0.01, maxPrice - minPrice);

  for (let i = 0; i < SLOT_COUNT; i += 1) {
    const hour = i / 4;
    const price = prices[i] ?? minPrice;
    const dsoScore = dso[i] ?? 0;
    const tsoScore = tso[i] ?? 0;
    const windValue = wind[i] ?? 0;
    const solarValue = solar[i] ?? 0;

    const electricityPrice = Number(price.toFixed(2));
    const priceScore = clamp01((price - minPrice) / priceRange);
    const windGenerationMw = Number(windValue.toFixed(1));
    const solarGenerationMw = Number(solarValue.toFixed(1));

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
  points: buildPoints({
    priceAnchors: [
      { time: "00:00", value: 0.85 },
      { time: "02:00", value: 0.7 },
      { time: "04:00", value: 0.8 },
      { time: "06:00", value: 1.6 },
      { time: "07:30", value: 2.5 },
      { time: "10:00", value: 1.7 },
      { time: "14:00", value: 1.45 },
      { time: "16:00", value: 2.2 },
      { time: "18:00", value: 3.4 },
      { time: "19:30", value: 3.75 },
      { time: "21:00", value: 2.1 },
      { time: "22:00", value: 1.2 },
      { time: "24:00", value: 0.85 },
    ],
    windAnchors: [
      { time: "00:00", value: 1050 },
      { time: "04:00", value: 1150 },
      { time: "08:00", value: 850 },
      { time: "12:00", value: 700 },
      { time: "16:00", value: 650 },
      { time: "20:00", value: 800 },
      { time: "24:00", value: 1050 },
    ],
    solarAnchors: [
      { time: "00:00", value: 0 },
      { time: "07:30", value: 0 },
      { time: "09:00", value: 60 },
      { time: "11:00", value: 250 },
      { time: "13:00", value: 400 },
      { time: "14:00", value: 300 },
      { time: "16:00", value: 30 },
      { time: "17:00", value: 0 },
      { time: "24:00", value: 0 },
    ],
    dsoAnchors: [
      { time: "00:00", value: 0.18 },
      { time: "03:00", value: 0.15 },
      { time: "06:00", value: 0.25 },
      { time: "07:00", value: 0.55 },
      { time: "08:00", value: 0.32 },
      { time: "16:30", value: 0.8 },
      { time: "19:00", value: 0.95 },
      { time: "21:00", value: 0.65 },
      { time: "23:00", value: 0.3 },
      { time: "24:00", value: 0.2 },
    ],
    tsoAnchors: [
      { time: "00:00", value: 0.35 },
      { time: "01:00", value: 0.25 },
      { time: "04:00", value: 0.22 },
      { time: "08:00", value: 0.45 },
      { time: "14:00", value: 0.42 },
      { time: "18:00", value: 0.65 },
      { time: "20:00", value: 0.75 },
      { time: "23:00", value: 0.48 },
      { time: "24:00", value: 0.4 },
    ],
  }),
};

export const coldStillWinterScenario: Scenario = {
  id: "cold-still-winter",
  name: "Cold, still winter day",
  arrivalTime: "16:30",
  departureTime: "07:00",
  initialSoc: 25,
  batteryKWh: 75,
  maxChargingPowerKw: 11,
  targetSoc: 85,
  points: buildPoints({
    priceAnchors: [
      { time: "00:00", value: 1.8 },
      { time: "04:00", value: 1.65 },
      { time: "06:00", value: 2.6 },
      { time: "08:00", value: 3.4 },
      { time: "12:00", value: 2.8 },
      { time: "15:00", value: 3.2 },
      { time: "17:00", value: 4.2 },
      { time: "18:30", value: 4.8 },
      { time: "20:00", value: 4.1 },
      { time: "22:00", value: 2.8 },
      { time: "24:00", value: 2.0 },
    ],
    windAnchors: [
      { time: "00:00", value: 350 },
      { time: "06:00", value: 280 },
      { time: "12:00", value: 320 },
      { time: "18:00", value: 220 },
      { time: "24:00", value: 300 },
    ],
    solarAnchors: [
      { time: "00:00", value: 0 },
      { time: "08:00", value: 0 },
      { time: "10:00", value: 80 },
      { time: "12:00", value: 180 },
      { time: "14:00", value: 100 },
      { time: "16:00", value: 0 },
      { time: "24:00", value: 0 },
    ],
    dsoAnchors: [
      { time: "00:00", value: 0.35 },
      { time: "05:30", value: 0.3 },
      { time: "07:30", value: 0.7 },
      { time: "10:00", value: 0.45 },
      { time: "16:00", value: 0.85 },
      { time: "19:00", value: 1.0 },
      { time: "21:00", value: 0.65 },
      { time: "23:00", value: 0.4 },
      { time: "24:00", value: 0.35 },
    ],
    tsoAnchors: [
      { time: "00:00", value: 0.55 },
      { time: "04:00", value: 0.5 },
      { time: "10:00", value: 0.6 },
      { time: "16:00", value: 0.8 },
      { time: "19:00", value: 0.95 },
      { time: "21:00", value: 0.8 },
      { time: "24:00", value: 0.6 },
    ],
  }),
};

export const sunnySpringScenario: Scenario = {
  id: "sunny-spring",
  name: "Sunny spring weekend",
  arrivalTime: "09:00",
  departureTime: "18:00",
  initialSoc: 30,
  batteryKWh: 75,
  maxChargingPowerKw: 11,
  targetSoc: 80,
  points: buildPoints({
    priceAnchors: [
      { time: "00:00", value: 1.1 },
      { time: "06:00", value: 1.2 },
      { time: "08:00", value: 1.45 },
      { time: "10:00", value: 0.9 },
      { time: "11:30", value: 0.55 },
      { time: "13:00", value: 0.35 },
      { time: "14:00", value: 0.45 },
      { time: "15:30", value: 0.8 },
      { time: "17:00", value: 1.7 },
      { time: "19:00", value: 2.4 },
      { time: "22:00", value: 1.35 },
      { time: "24:00", value: 1.1 },
    ],
    windAnchors: [
      { time: "00:00", value: 600 },
      { time: "06:00", value: 550 },
      { time: "12:00", value: 500 },
      { time: "18:00", value: 650 },
      { time: "24:00", value: 700 },
    ],
    solarAnchors: [
      { time: "00:00", value: 0 },
      { time: "06:00", value: 0 },
      { time: "07:00", value: 100 },
      { time: "08:00", value: 350 },
      { time: "09:00", value: 700 },
      { time: "10:00", value: 1200 },
      { time: "11:00", value: 1650 },
      { time: "12:30", value: 1900 },
      { time: "14:00", value: 1700 },
      { time: "15:00", value: 1250 },
      { time: "16:00", value: 700 },
      { time: "17:00", value: 250 },
      { time: "18:00", value: 0 },
      { time: "24:00", value: 0 },
    ],
    dsoAnchors: [
      { time: "00:00", value: 0.28 },
      { time: "06:30", value: 0.45 },
      { time: "09:00", value: 0.3 },
      { time: "13:00", value: 0.15 },
      { time: "16:00", value: 0.25 },
      { time: "17:00", value: 0.4 },
      { time: "20:00", value: 0.55 },
      { time: "24:00", value: 0.32 },
    ],
    tsoAnchors: [
      { time: "00:00", value: 0.45 },
      { time: "08:00", value: 0.4 },
      { time: "11:00", value: 0.2 },
      { time: "13:00", value: 0.1 },
      { time: "15:00", value: 0.2 },
      { time: "18:00", value: 0.55 },
      { time: "21:00", value: 0.7 },
      { time: "24:00", value: 0.5 },
    ],
  }),
};

export const localCongestionConflictScenario: Scenario = {
  id: "local-congestion-conflict",
  name: "Cheap power, local grid congestion",
  arrivalTime: "17:00",
  departureTime: "07:30",
  initialSoc: 40,
  batteryKWh: 75,
  maxChargingPowerKw: 11,
  targetSoc: 80,
  points: buildPoints({
    priceAnchors: [
      { time: "00:00", value: 0.9 },
      { time: "01:00", value: 0.95 },
      { time: "02:00", value: 1.0 },
      { time: "04:00", value: 1.1 },
      { time: "06:00", value: 1.3 },
      { time: "17:00", value: 2.4 },
      { time: "18:00", value: 2.0 },
      { time: "19:00", value: 1.6 },
      { time: "20:00", value: 1.25 },
      { time: "21:00", value: 0.8 },
      { time: "22:00", value: 0.55 },
      { time: "23:00", value: 0.65 },
      { time: "24:00", value: 0.9 },
    ],
    windAnchors: [
      { time: "00:00", value: 1450 },
      { time: "03:00", value: 1200 },
      { time: "06:00", value: 1000 },
      { time: "17:00", value: 700 },
      { time: "19:00", value: 900 },
      { time: "21:00", value: 1300 },
      { time: "22:00", value: 1550 },
      { time: "24:00", value: 1450 },
    ],
    solarAnchors: [
      { time: "00:00", value: 0 },
      { time: "07:00", value: 0 },
      { time: "11:00", value: 700 },
      { time: "13:00", value: 950 },
      { time: "15:00", value: 450 },
      { time: "17:00", value: 0 },
      { time: "24:00", value: 0 },
    ],
    dsoAnchors: [
      { time: "00:00", value: 0.4 },
      { time: "01:00", value: 0.25 },
      { time: "02:00", value: 0.2 },
      { time: "17:00", value: 0.7 },
      { time: "18:00", value: 0.8 },
      { time: "19:00", value: 0.88 },
      { time: "20:00", value: 0.94 },
      { time: "21:00", value: 0.98 },
      { time: "22:00", value: 0.95 },
      { time: "23:00", value: 0.75 },
      { time: "24:00", value: 0.4 },
    ],
    tsoAnchors: [
      { time: "00:00", value: 0.35 },
      { time: "04:00", value: 0.4 },
      { time: "17:00", value: 0.55 },
      { time: "20:00", value: 0.3 },
      { time: "22:00", value: 0.15 },
      { time: "24:00", value: 0.3 },
    ],
  }),
};

export const windyNightScenario: Scenario = {
  id: "windy-night",
  name: "Wind surplus overnight",
  arrivalTime: "18:00",
  departureTime: "08:00",
  initialSoc: 20,
  batteryKWh: 75,
  maxChargingPowerKw: 11,
  targetSoc: 90,
  points: buildPoints({
    priceAnchors: [
      { time: "00:00", value: 0.4 },
      { time: "01:00", value: 0.35 },
      { time: "02:00", value: 0.4 },
      { time: "03:00", value: 0.5 },
      { time: "04:00", value: 0.65 },
      { time: "05:00", value: 0.9 },
      { time: "06:00", value: 1.5 },
      { time: "08:00", value: 2.2 },
      { time: "18:00", value: 2.2 },
      { time: "20:00", value: 1.6 },
      { time: "21:00", value: 1.1 },
      { time: "22:00", value: 0.75 },
      { time: "23:00", value: 0.5 },
      { time: "24:00", value: 0.4 },
    ],
    windAnchors: [
      { time: "00:00", value: 1900 },
      { time: "02:00", value: 2100 },
      { time: "04:00", value: 1800 },
      { time: "06:00", value: 1300 },
      { time: "08:00", value: 1000 },
      { time: "18:00", value: 850 },
      { time: "20:00", value: 1100 },
      { time: "22:00", value: 1500 },
      { time: "24:00", value: 1900 },
    ],
    solarAnchors: [
      { time: "00:00", value: 0 },
      { time: "07:00", value: 0 },
      { time: "11:00", value: 600 },
      { time: "13:00", value: 900 },
      { time: "16:00", value: 250 },
      { time: "18:00", value: 0 },
      { time: "24:00", value: 0 },
    ],
    dsoAnchors: [
      { time: "00:00", value: 0.15 },
      { time: "02:00", value: 0.1 },
      { time: "05:00", value: 0.25 },
      { time: "18:00", value: 0.6 },
      { time: "20:00", value: 0.75 },
      { time: "22:00", value: 0.45 },
      { time: "24:00", value: 0.15 },
    ],
    tsoAnchors: [
      { time: "00:00", value: 0.1 },
      { time: "02:00", value: 0.05 },
      { time: "04:00", value: 0.2 },
      { time: "08:00", value: 0.45 },
      { time: "18:00", value: 0.55 },
      { time: "22:00", value: 0.2 },
      { time: "24:00", value: 0.1 },
    ],
  }),
};

export const allScenarios: Scenario[] = [
  winterWeekdayScenario,
  coldStillWinterScenario,
  sunnySpringScenario,
  localCongestionConflictScenario,
  windyNightScenario,
];

export const scenarioById: Record<string, Scenario> = allScenarios.reduce<Record<string, Scenario>>(
  (acc, scenario) => {
    acc[scenario.id] = scenario;
    return acc;
  },
  {},
);
