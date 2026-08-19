import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { winterWeekdayScenario } from "./data/scenarios";
import {
  buildPlan,
  buildSessionResult,
  explainCurrentPlan,
  normalizeWeights,
  timeToIndex,
} from "./logic/scheduler";
import type { Preferences, SessionResult, Weights } from "./types";

type View = "preferences" | "charging" | "results" | "lab";

const STORAGE_KEY = "flex-prototype-preferences";

const defaultPreferences: Preferences = {
  departureTime: "07:30",
  targetSoc: 80,
  chargingPreference: 0.5,
  automaticOptimization: true,
  allowPause: true,
  allowV2G: false,
};

const defaultWeights: Weights = {
  price: 40,
  dso: 35,
  tso: 25,
};

const demoSlots = {
  evening: timeToIndex("17:30"),
  gridEvent: timeToIndex("22:00"),
  morning: timeToIndex("07:30"),
};

const hourLabel = (slotIdx: number): string => winterWeekdayScenario.points[slotIdx]?.timestamp ?? "00:00";

function App() {
  const [view, setView] = useState<View>("preferences");
  const [preferences, setPreferences] = useState<Preferences>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPreferences;

    try {
      return { ...defaultPreferences, ...(JSON.parse(raw) as Partial<Preferences>) };
    } catch {
      return defaultPreferences;
    }
  });
  const [weights, setWeights] = useState<Weights>(defaultWeights);
  const [simulatedSlot, setSimulatedSlot] = useState<number>(demoSlots.evening);
  const [isWhyOpen, setIsWhyOpen] = useState(false);
  const [forceChargeNow, setForceChargeNow] = useState(false);
  const [pauseAutomationTonight, setPauseAutomationTonight] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const optimizedPlan = useMemo(
    () =>
      buildPlan({
        scenario: winterWeekdayScenario,
        preferences,
        weights,
        mode: pauseAutomationTonight || !preferences.automaticOptimization ? "fallbackNow" : "combined",
        currentSlot: simulatedSlot,
        forceCurrentCharge: forceChargeNow,
      }),
    [preferences, weights, pauseAutomationTonight, simulatedSlot, forceChargeNow],
  );

  const priceOnlyPlan = useMemo(
    () =>
      buildPlan({
        scenario: winterWeekdayScenario,
        preferences,
        weights,
        mode: "priceOnly",
        currentSlot: simulatedSlot,
        forceCurrentCharge: false,
      }),
    [preferences, weights, simulatedSlot],
  );

  const immediatePlan = useMemo(
    () =>
      buildPlan({
        scenario: winterWeekdayScenario,
        preferences,
        weights,
        mode: "fallbackNow",
        currentSlot: demoSlots.evening,
        forceCurrentCharge: false,
      }),
    [preferences, weights],
  );

  const sessionResult: SessionResult = useMemo(
    () => buildSessionResult(optimizedPlan, immediatePlan, preferences.targetSoc),
    [optimizedPlan, immediatePlan, preferences.targetSoc],
  );

  const explanationPoints = useMemo(
    () => explainCurrentPlan(optimizedPlan, simulatedSlot),
    [optimizedPlan, simulatedSlot],
  );

  const normalized = normalizeWeights(weights);

  const timelineData = optimizedPlan.slots.map((slot, index) => ({
    ...slot,
    isCurrent: index === simulatedSlot ? 1 : 0,
    label: slot.timestamp,
    chargingKw: slot.chargingPowerKw,
  }));

  const compareData = optimizedPlan.slots.map((slot, index) => ({
    label: slot.timestamp,
    optimizedKw: optimizedPlan.slots[index]?.chargingPowerKw ?? 0,
    priceOnlyKw: priceOnlyPlan.slots[index]?.chargingPowerKw ?? 0,
    combinedScore: slot.combinedScore,
  }));

  const currentSignals = timelineData[simulatedSlot] ?? timelineData[0];

  const resetDemo = () => {
    setSimulatedSlot(demoSlots.evening);
    setForceChargeNow(false);
    setPauseAutomationTonight(false);
    setIsWhyOpen(false);
    setView("charging");
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 text-ink sm:px-6">
      <header className="mb-6 animate-rise rounded-3xl border border-teal-200/70 bg-white/85 p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-teal-700">Flexibility Platform Prototype</p>
            <h1 className="mt-2 text-2xl font-bold md:text-3xl">Household Flexibility: EV Charging Automation Demo</h1>
          </div>
          <div className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">
            Demo time: {hourLabel(simulatedSlot)}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { label: "Reset", action: resetDemo },
            { label: "Evening", action: () => setSimulatedSlot(demoSlots.evening) },
            { label: "Grid Event", action: () => setSimulatedSlot(demoSlots.gridEvent) },
            { label: "Morning", action: () => setSimulatedSlot(demoSlots.morning) },
          ].map((item) => (
            <button
              type="button"
              key={item.label}
              onClick={item.action}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium transition hover:border-teal-500 hover:text-teal-700"
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        {[
          ["preferences", "Preferences"],
          ["charging", "Charging Plan"],
          ["results", "Session Results"],
          ["lab", "Signal Lab"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key as View)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              view === key
                ? "bg-ink text-white"
                : "bg-white/75 text-slate-700 ring-1 ring-slate-300 hover:bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {view === "preferences" && (
        <section className="card animate-rise space-y-5">
          <h2 className="text-xl font-bold">Preferences</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold">Departure time</span>
              <input
                type="time"
                value={preferences.departureTime}
                onChange={(e) => setPreferences((prev) => ({ ...prev, departureTime: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 p-2"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold">Target state of charge: {preferences.targetSoc}%</span>
              <input
                type="range"
                min={50}
                max={100}
                step={1}
                value={preferences.targetSoc}
                onChange={(e) => setPreferences((prev) => ({ ...prev, targetSoc: Number(e.target.value) }))}
                className="w-full accent-teal-700"
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-semibold">
              Charging preference: {preferences.chargingPreference.toFixed(2)}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={preferences.chargingPreference}
              onChange={(e) => setPreferences((prev) => ({ ...prev, chargingPreference: Number(e.target.value) }))}
              className="w-full accent-teal-700"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>Cheapest</span>
              <span>Grid supportive</span>
            </div>
          </label>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                label: "Automatic charging optimization",
                checked: preferences.automaticOptimization,
                onChange: (checked: boolean) => setPreferences((prev) => ({ ...prev, automaticOptimization: checked })),
              },
              {
                label: "Allow charging pause",
                checked: preferences.allowPause,
                onChange: (checked: boolean) => setPreferences((prev) => ({ ...prev, allowPause: checked })),
              },
              {
                label: "Allow power export / V2G",
                checked: preferences.allowV2G,
                onChange: (checked: boolean) => setPreferences((prev) => ({ ...prev, allowV2G: checked })),
              },
            ].map((toggle) => (
              <label key={toggle.label} className="rounded-xl border border-slate-300 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{toggle.label}</span>
                  <input
                    type="checkbox"
                    checked={toggle.checked}
                    onChange={(e) => toggle.onChange(e.target.checked)}
                    className="h-4 w-4 accent-teal-700"
                  />
                </div>
              </label>
            ))}
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm font-medium text-teal-900">
            Your departure time and required charge level will always take priority.
          </div>

          <button
            type="button"
            className="rounded-xl bg-ink px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
            onClick={() => setView("charging")}
          >
            Save preferences
          </button>
        </section>
      )}

      {view === "charging" && (
        <section className="space-y-4 animate-rise">
          <div className="card">
            <h2 className="text-xl font-bold">Charging Plan</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric title="Current charge" value={`${winterWeekdayScenario.initialSoc}%`} />
              <Metric title="Target" value={`${preferences.targetSoc}%`} />
              <Metric title="Ready by" value={preferences.departureTime} />
              <Metric title="Estimated completion" value={optimizedPlan.estimatedCompletionTime} />
              <Metric
                title="Status"
                value={pauseAutomationTonight ? "Fallback charging active" : "Automatic optimization active"}
              />
              <Metric title="Projected final SOC" value={`${optimizedPlan.finalSoc}%`} />
            </div>

            <div className="mt-5 h-72 w-full">
              <ResponsiveContainer>
                <ComposedChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" interval={5} />
                  <YAxis yAxisId="left" domain={[0, 1]} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 12]} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" dataKey="combinedScore" name="Combined score" stroke="#0f766e" dot={false} />
                  <Line yAxisId="left" dataKey="priceScore" name="Price score" stroke="#1d4ed8" dot={false} />
                  <Bar yAxisId="right" dataKey="chargingKw" name="Charging kW" fill="#f97316" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => setForceChargeNow(true)}
              >
                Charge now
              </button>
              <button
                type="button"
                className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => setPauseAutomationTonight(true)}
              >
                Pause automation tonight
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
                onClick={() => setView("preferences")}
              >
                Edit limits
              </button>
              <button
                type="button"
                className="rounded-lg border border-teal-600 px-3 py-2 text-sm font-semibold text-teal-700"
                onClick={() => setIsWhyOpen((v) => !v)}
              >
                Why this schedule?
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-900 px-3 py-2 text-sm font-semibold"
                onClick={() => {
                  setSimulatedSlot(demoSlots.morning);
                  setView("results");
                }}
              >
                Simulate morning
              </button>
            </div>
          </div>

          {isWhyOpen && (
            <div className="card">
              <h3 className="text-lg font-bold">Schedule Explanation</h3>
              <p className="mt-2 text-sm text-slate-600">
                Electricity price: {scoreLevel(currentSignals?.priceScore ?? 0)} | Local grid demand: {scoreLevel(currentSignals?.dsoScore ?? 0)} | System flexibility need: {scoreLevel(currentSignals?.tsoScore ?? 0)}
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {explanationPoints.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {view === "results" && (
        <section className="card animate-rise space-y-4">
          <h2 className="text-xl font-bold">Session Results</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Metric title="Final SOC" value={`${sessionResult.finalSoc}%`} />
            <Metric title="Required SOC" value={`${sessionResult.requiredSoc}%`} />
            <Metric title="Status" value={sessionResult.readyOnTime ? "Ready on time" : "Below target"} />
            <Metric title="Charging cost" value={`${sessionResult.chargingCostDkk.toFixed(2)} DKK`} />
            <Metric title="Saved vs immediate" value={`${sessionResult.savedVsImmediateDkk.toFixed(2)} DKK`} />
            <Metric title="Charging during local peak" value={`${sessionResult.localPeakChargingKWh.toFixed(1)} kWh`} />
            <Metric title="Avoided peak-period charging" value={`${sessionResult.avoidedPeakChargingKWh.toFixed(1)} kWh`} />
            <Metric
              title="System alignment"
              value={`${sessionResult.favorableAlignmentPercent}% of charging in favorable conditions`}
            />
          </div>
          <p className="text-xs text-slate-500">
            Metrics are deterministic simulation outputs for prototype validation and presentation.
          </p>
        </section>
      )}

      {view === "lab" && (
        <section className="space-y-4 animate-rise">
          <div className="card space-y-3">
            <h2 className="text-xl font-bold">Signal Lab</h2>
            <p className="text-sm text-slate-600">Scenario: {winterWeekdayScenario.name}</p>
            <div className="grid gap-2 text-sm md:grid-cols-3">
              <ScenarioField label="EV arrival" value={winterWeekdayScenario.arrivalTime} />
              <ScenarioField label="Initial SOC" value={`${winterWeekdayScenario.initialSoc}%`} />
              <ScenarioField label="Battery" value={`${winterWeekdayScenario.batteryKWh} kWh`} />
              <ScenarioField label="Max AC charging" value={`${winterWeekdayScenario.maxChargingPowerKw} kW`} />
              <ScenarioField label="Target SOC" value={`${preferences.targetSoc}%`} />
              <ScenarioField label="Departure" value={preferences.departureTime} />
              <ScenarioField label="Time granularity" value="15 minutes" />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <WeightSlider label="Price" value={weights.price} onChange={(v) => setWeights((w) => ({ ...w, price: v }))} />
              <WeightSlider label="DSO" value={weights.dso} onChange={(v) => setWeights((w) => ({ ...w, dso: v }))} />
              <WeightSlider label="TSO" value={weights.tso} onChange={(v) => setWeights((w) => ({ ...w, tso: v }))} />
            </div>
            <p className="text-xs text-slate-600">
              Effective normalized weights: Price {(normalized.price * 100).toFixed(0)}% | DSO {(normalized.dso * 100).toFixed(0)}% | TSO {(normalized.tso * 100).toFixed(0)}%
            </p>
          </div>

          <div className="card h-80">
            <ResponsiveContainer>
              <ComposedChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" interval={11} />
                <YAxis domain={[0, 1]} />
                <Tooltip />
                <Legend />
                <Line dataKey="priceScore" name="Price signal" stroke="#1d4ed8" dot={false} />
                <Line dataKey="dsoScore" name="DSO signal" stroke="#dc2626" dot={false} />
                <Line dataKey="tsoScore" name="TSO signal" stroke="#7c3aed" dot={false} />
                <Line dataKey="combinedScore" name="Combined signal" stroke="#0f766e" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="card h-80">
            <ResponsiveContainer>
              <ComposedChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" interval={11} />
                <YAxis yAxisId="left" domain={[0, 1200]} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" dataKey="windGenerationMw" name="Wind (mock MW)" stroke="#0ea5e9" dot={false} />
                <Line yAxisId="left" dataKey="solarGenerationMw" name="Solar (mock MW)" stroke="#f59e0b" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="card h-80">
            <ResponsiveContainer>
              <ComposedChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" interval={11} />
                <YAxis yAxisId="left" domain={[0, 12]} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 1]} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="optimizedKw" name="Combined signal schedule" fill="#0f766e" />
                <Bar yAxisId="left" dataKey="priceOnlyKw" name="Price-only schedule" fill="#1d4ed8" />
                <Line yAxisId="right" dataKey="combinedScore" name="Combined score" stroke="#334155" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}

function ScenarioField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white/80 p-2">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function WeightSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1 rounded-lg border border-slate-300 bg-white p-3">
      <span className="text-sm font-semibold">{label} {value.toFixed(0)}%</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-teal-700"
      />
    </label>
  );
}

function scoreLevel(value: number): string {
  if (value < 0.35) return "LOW";
  if (value < 0.7) return "MEDIUM";
  return "HIGH";
}

export default App;
