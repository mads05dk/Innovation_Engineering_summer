# Flexibility Platform Prototype — Coding Plan

## 1. Project Goal

Build an interactive web prototype of the household flexibility concept.

The prototype is intended for:

1. User testing
   - Trust in automated EV charging
   - Ease of use
   - User preferences and boundaries
   - User understanding of automated decisions
   - User willingness to retain automation when override controls exist

2. Scientific/concept testing
   - Demonstrate a combined flexibility signal using:
     - Electricity price
     - DSO/local-grid conditions
     - TSO/system conditions
   - Compare the combined signal against price-only EV charging.

This is a presentation and validation prototype.

It is NOT a production system.

---

# 2. Core Prototype Question

The prototype should demonstrate:

> A household specifies what it needs from its EV.  
> The platform automatically schedules charging based on electricity price and wider grid conditions while respecting the user's limits.  
> The user can understand and override the platform's decisions.  
> The same scenario can then be compared against ordinary price-only optimisation.

---

# 3. Scope

The prototype contains two connected areas.

## User App

Used to test:

- trust
- ease of use
- automation
- user-defined limits
- transparency
- override behaviour

User flow:

Preferences
→ Charging Plan
→ Explanation
→ Accept or Override
→ Session Results

## Signal Lab

Used to test:

- combined flexibility signals
- conflicting grid signals
- charging optimisation
- comparison with price-only optimisation

Scientific flow:

Price ─┐
DSO ───┼── Combined Signal ── Charging Scheduler
TSO ───┘                         │
                                 ↓
                         Compare against
                           Price Only

---

# 4. Technology Stack

Use:

- React
- TypeScript
- Vite
- Tailwind CSS
- Recharts

State management:

- React useState / useReducer
- No Redux
- No Zustand

Data:

- Local TypeScript objects / JSON
- No database

Optional:

- localStorage for preserving preferences during page refresh

Do not add infrastructure unless required by the prototype.

---

# 5. Explicit Non-Goals

DO NOT implement:

- backend
- database
- user accounts
- authentication
- authorization
- payments
- billing
- real charger communication
- OCPP
- ISO 15118
- actual V2G communication
- Energinet APIs
- Radius APIs
- real-time market APIs
- calendar integration
- location tracking
- push notifications
- mobile native application
- production security infrastructure
- production deployment architecture
- installer workflow
- physical plug-and-play hardware communication

These can be represented conceptually in the interface but do not need to function.

---

# 6. Main Application Views

The application should contain four primary views:

1. Preferences
2. Charging Plan
3. Session Results
4. Signal Lab

A lightweight welcome screen is optional.

---

# 7. View 1 — Preferences

## Purpose

Allow the user to tell the system what outcome is required while retaining control over automation.

## Required controls

### Departure time

Example:

07:30

Use a normal time input.

### Target state of charge

Example:

80%

Use a slider or number control.

Suggested range:

50–100%

### Charging preference

Use a slider.

Example:

Cheapest
────────────●────────────
Grid supportive

Internally represent this as a value between 0 and 1.

Example:

0 = primarily lowest cost  
1 = primarily grid supportive

### Automatic optimisation

Toggle:

Automatic charging optimisation

Default:

ON

### Allow charging pause

Toggle:

Allow the system to temporarily pause charging

Default:

ON

### V2G

Toggle:

Allow power export / V2G

Default:

OFF

V2G does not need to actually be simulated in the MVP unless time permits.

### User assurance

Display prominently:

> Your departure time and required charge level will always take priority.

### Primary action

Button:

Save preferences

Navigate to Charging Plan.

---

# 8. View 2 — Charging Plan

## Purpose

Show how the system intends to charge the vehicle.

This should be the central user-facing screen.

## Required information

Display:

- Current battery SOC
- Target SOC
- Required departure time
- Estimated completion time
- Planned charging periods
- Current automation status

Example:

Current charge: 42%

Target: 80%

Ready by: 07:30

Status: Automatic optimisation active

---

# 9. Charging Timeline

Create a 24-hour timeline.

Recommended interval:

30 minutes

This produces:

48 time slots

Each time slot should contain:

- timestamp
- electricity price
- DSO congestion signal
- TSO/system signal
- combined flexibility score
- whether EV charging occurs
- charging power

The chart should visually indicate:

- charging
- no charging
- high-price periods
- local congestion
- system conditions

Do not overload the initial user view.

The detailed signal information can be exposed through the explanation panel.

---

# 10. "Why This Schedule?" Explanation

Include a visible button:

Why this schedule?

Open a modal, drawer, or expandable panel.

Example explanation:

> Charging was delayed between 18:00 and 21:00 because local grid demand was high.

> Charging begins at 00:30 because electricity prices are lower and local grid demand has fallen.

> Your EV will still reach 80% before 07:30.

Represent the three signals separately:

Electricity price:
HIGH

Local grid demand:
HIGH

System flexibility need:
LOW

The explanation should be generated from the scenario data rather than hard-coded for one exact time if reasonably possible.

---

# 11. Override Controls

Provide clear user control.

Required:

Charge now

Pause automation tonight

Edit limits

Expected behaviour:

### Charge now

Switch the current charging period to immediate charging.

The prototype may recompute future charging around this decision.

### Pause automation tonight

Change the schedule to a simple fallback behaviour.

For MVP this can mean:

Charge immediately until the target SOC is reached.

### Edit limits

Return to Preferences.

---

# 12. Simulated Time

Do not use real-world time.

The application should operate on simulated scenario time.

Create a small demo/development toolbar.

Example:

DEMO

[ Reset ] [ Evening ] [ Grid Event ] [ Morning ]

Suggested predefined times:

Evening:
17:30

Grid Event:
22:00

Morning:
07:30 next day

This makes presentations deterministic.

---

# 13. View 3 — Session Results

## Purpose

Show the user what happened after automatic optimisation.

Trigger using:

Simulate morning

or the demo toolbar.

## Required metrics

Display:

Final SOC

Example:

82%

Required SOC:

80%

Status:

Ready on time

### Financial result

Example:

Charging cost:
31.40 DKK

Saved vs immediate charging:
8.20 DKK

### Grid result

Example:

Charging during local peak:
0.4 kWh

Avoided peak-period charging:
6.8 kWh

### System alignment

Example:

64% of charging occurred during favourable grid conditions.

These values are simulation outputs.

Do not present them as experimentally validated real-world results.

---

# 14. Signal Lab

The Signal Lab can be reached through:

Open Signal Lab

This view is intended primarily for:

- presentation
- experimentation
- scientific validation
- comparing algorithms

It does not need to look like a polished consumer application.

---

# 15. Signal Lab Inputs

Display the selected test scenario.

Example:

Scenario:
Winter weekday

EV arrival:
17:30

Initial SOC:
35%

Battery:
75 kWh

Maximum AC charging:
11 kW

Target SOC:
80%

Departure:
07:30

---

# 16. Input Signals

Display three 24-hour signals.

## Price signal

Represents relative electricity cost.

Normalise internally to:

0–1

Where:

0 = favourable / cheap  
1 = unfavourable / expensive

## DSO signal

Represents local distribution-grid congestion.

0 = low congestion  
1 = severe congestion

## TSO signal

Represents wider electricity-system conditions.

Define one consistent interpretation.

Recommended:

0 = favourable time to consume electricity  
1 = system prefers electricity consumption to be reduced

Keep this direction consistent across all signals.

---

# 17. Combined Flexibility Signal

For the first prototype use a deliberately simple weighted model.

Example:

combinedScore =
    priceScore * priceWeight
    + dsoScore * dsoWeight
    + tsoScore * tsoWeight

Default weights:

Price:
0.40

DSO:
0.35

TSO:
0.25

The combined score should normally remain between 0 and 1.

Interpretation:

Lower score:
Better time to charge

Higher score:
Worse time to charge

IMPORTANT:

These weights are prototype parameters.

They are NOT claimed to be scientifically optimal.

---

# 18. Adjustable Signal Weights

In Signal Lab, provide sliders:

Price       40%
DSO         35%
TSO         25%

Require:

Price + DSO + TSO = 100%

Possible implementation:

If one slider changes, either:

A. automatically proportionally adjust the others

or

B. allow arbitrary values and normalise them before calculation

Option B is simpler.

Example:

effectivePriceWeight =
priceWeight / totalWeight

Do the same for DSO and TSO.

Recalculate the combined signal immediately.

---

# 19. Scenario Dataset

Create deterministic local scenario data.

Suggested file:

src/data/scenarios.ts

Use 30-minute resolution.

Each data point:

```ts
interface GridDataPoint {
    timestamp: string;
    hour: number;

    electricityPrice: number;

    priceScore: number;
    dsoScore: number;
    tsoScore: number;
}