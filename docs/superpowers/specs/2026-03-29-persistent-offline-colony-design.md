# Persistent Offline Colony

## Overview

The colony runs continuously via analytical offline catch-up. The player is an on-call operator who gets paged (push notifications) when something needs attention, and reads a shift report when they return to the console.

## 1. Analytical Offline Engine

Replace the current `processOfflineTime()` in `gameStore.ts` (which calls `tick(capped)` with a 5-minute ceiling) with a phase-based analytical engine that resolves any duration in one pass.

### Multi-Phase Simulation

The offline period is divided into **phases**. A new phase begins whenever the colony state changes discontinuously:
- A resource (power or air) hits zero or recovers from zero
- A hazard damages a building (changes production rates)
- A hazard instantly deducts resources (power surge, gas pocket)
- The directive auto-switches due to emergency thresholds
- A shipment arrives (may add buildings that change rates)

**Algorithm (pseudocode):**

```
function processOfflineTime(elapsedMs):
  remaining = elapsedMs
  events = []
  snapshot resources before catch-up (for delta display)

  while remaining > 0:
    rates = computeCurrentRates()  // based on current buildings, colonists, directive

    // Find the next event that would interrupt the current phase
    nextEvent = earliest of:
      - time until power hits 0 (if powerNet < 0): power / abs(powerNet)
      - time until air hits 0 (if airNet < 0 AND power > 0): air / abs(airNet)
      - time until next hazard check (15s intervals from last check)
      - time until next shipment arrival
      - remaining time

    phaseDt = min(nextEvent.time, remaining)

    // Apply rates for this phase
    applyResourceRates(rates, phaseDt)
    applyDrilling(phaseDt)
    applyHealing(phaseDt)  // only if power > 0 and medbays > 0
    applyHealthDrain(phaseDt)  // only if air <= 0 or power <= 0, floor at 10%

    // Process the event that ended this phase
    if nextEvent is hazardCheck:
      maybeApplyHazard(events)  // may damage building, deduct resources
    if nextEvent is shipmentArrival:
      landShipment(events)  // auto-unpack, apply contents

    // Check for emergency directive switch
    if air < airMax * 0.2 or power < powerMax * 0.2:
      if directive != 'emergency':
        directive = 'emergency'
        events.push(autoDirectiveEvent)

    remaining -= phaseDt

  return events
```

### Resource Accumulation

Each phase computes net rates from current colony state:

```
powerNet = (undamagedSolars * POWER_PRODUCTION_PER_SOLAR * engineerBonus) - (activeBuildings * POWER_CONSUMPTION_PER_BUILDING)
airNet = power > 0
  ? (undamagedGenerators * O2_PRODUCTION_PER_GENERATOR * engineerBonus) - (aliveColonists * AIR_CONSUMPTION_PER_COLONIST)
  : -(aliveColonists * AIR_CONSUMPTION_PER_COLONIST)  // no production when power is zero
```

Apply: `resource = clamp(resource + netRate * phaseDt, 0, max)`

**Key coupling:** Air production depends on power. When power hits zero, airNet must be recalculated with production = 0. This is handled automatically by the phase-splitting algorithm.

### Drilling, Metals, Credits

Per phase:

```
depthGain = drillRate * phaseDt
metalGain = depthGain * METALS_PER_DEPTH
iceGain = ICE_CHANCE_PER_TICK * phaseDt * ICE_PER_FIND  // expected value, no floor
creditGain = (BASE_CREDITS_PER_TICK + metalGain * CREDITS_PER_METAL_MINED + iceGain * CREDITS_PER_ICE_FOUND) * phaseDt
```

Note: `drillRate` depends on the number of drillers, which changes if the directive changes. Recalculated at each phase boundary.

Also update `maxDepth = max(maxDepth, depth)` after each phase.

### Shipments

Advance `totalPlaytimeMs` by elapsed time. Any `InTransitShipment` with `arrivalAt <= totalPlaytimeMs` triggers a phase boundary. Auto-unpack applies the same effects as manual unpacking:
- `supplyCrate`: +15 metals, +5 ice
- `equipment`: place building (update rates for subsequent phases)
- `newColonist`: add colonist (update rates)
- `repairKit`: repair one damaged building (update rates)
- `emergencyO2`: instant air boost
- `emergencyPower`: instant power boost

### Healing

Per phase, only when `power > 0` and `medbays > 0`:

```
healPerColonist = undamagedMedbays * MEDBAY_HEAL_PER_SEC * engineerBonus * phaseDt
```

Clamp each colonist's health to 100.

### Health Drain

Per phase, when `air <= 0` or `power <= 0`:

```
drainPerColonist = HEALTH_DRAIN_PER_SEC * phaseDt
```

**Health floor of 10%** — colonists cannot die offline. The `gameOver` flag is never set during offline catch-up.

### No Time Cap

Remove the 5-minute ceiling. The phase-based approach handles any duration.

## 2. Offline Hazards

### Hazard Rolling

During offline catch-up, check hazards at the same cadence as online: once per `HAZARD_CHECK_INTERVAL_MS` (15s) of elapsed time. Each check is a phase boundary.

Roll against `HAZARD_BASE_CHANCE + depth * HAZARD_DEPTH_SCALE`, adjusted by directive's `hazardResist`. Use a simple mulberry32 PRNG seeded with `lastTickAt` for all random decisions during offline catch-up (hazard rolls, hazard type selection, building targeting).

### Hazard Types and Effects

All three hazard types are modeled:

- **Meteor** (40% chance): Damages a random undamaged building. Changes production rates for all subsequent phases.
- **Power surge** (30% chance): Instantly deducts 30% of `powerMax` from current power. May push power to zero, which kills air production and triggers a new phase.
- **Gas pocket** (30% chance): Instantly deducts 25% of `airMax` from current air. May trigger emergency directive auto-switch.

Each hazard creates an `OfflineEvent` and triggers rate recalculation for the remaining offline period.

### Emergency Auto-Response

If air or power drops below 20% of max during offline simulation, the colony auto-switches to emergency directive. This changes role assignments (more engineers, fewer drillers), which changes drill rate, engineer bonus, and all derived rates. Logged as an offline event.

### Hazard Cooldown

After offline catch-up, update `hazardCooldownUntil` to reflect how much time remains until the next check. If the last hazard check occurred at offset T within the offline period, and the offline period ends at T_end, set the cooldown so that `T_end - T` seconds of the 15s interval have already elapsed.

## 3. Push Notifications

### Eager Simulation Strategy

When the app backgrounds:

1. Run the full offline simulation immediately (same algorithm as catch-up).
2. Store the simulation result (final state + events timeline) for instant application on resume.
3. Schedule `LocalNotifications` at wall-clock times corresponding to actual events from the simulation.

When the app resumes:

1. Cancel all pending offline notifications.
2. Apply the stored simulation result (no re-simulation needed).
3. If the stored result is stale (app was backgrounded longer than the simulation covered, e.g., the simulation assumed a certain duration but more time passed), run a delta catch-up for the additional time.

This avoids simulating twice and makes notifications accurate (not probabilistic).

### Notification Tiers

**Immediate (critical)** — scheduled at the event's wall-clock time:
- Hazard strike: "HAZARD: [Meteor Strike] — [Solar Panel] damaged"
- Resource emergency: "ALERT: [O2] critical — below 15%"
- Colonist health critical: "ALERT: Crew health critical — intervention needed"

**Batched (every 30 min)** — single summary notification aggregating:
- Shipments that arrived in the window
- Depth milestones (every 50m crossed)
- Credit milestones (every 500 credits)
- Suppress the batch notification if no events occurred in the window

### Notification IDs

Use reserved ID range 10000–10099 for offline notifications. Remove the old `OFFLINE_CAP_NOTIFICATION_ID` (9001) since the time cap is being removed.

### Notification Text Format

Critical: `"COLONY ALERT: {event.message}"` — one notification per critical event.
Batched: `"Colony Report: {n} events — {summary}"` where summary is a comma-separated list like "+340 credits, shipment arrived, 50m depth milestone".

## 4. Shift Report (Welcome Back Screen)

### OfflineEvent Interface

```ts
interface OfflineEvent {
  type: 'hazard' | 'shipment' | 'resource_critical' | 'auto_directive' | 'milestone'
  message: string
  severity: 'info' | 'warning' | 'critical'
  offsetMs: number // ms into the offline period when this happened
}
```

### Report Content

The shift report modal displays:
- **Duration**: "You were away for 4h 23m"
- **Events timeline**: Chronological list of offline events with severity indicators
- **Resource deltas**: Net change for each resource (credits, metals, ice, depth)
- **Colony status**: Current status after catch-up (nominal / warning / critical)
- **"Resume Operations" button**: Dismisses the modal and starts the tick loop

### Display Logic

- Only show if offline duration > 60 seconds
- Show before the tick loop resumes (player reads the report, then the colony goes live)
- Clear `offlineEvents` array after display

## 5. State Changes

### ColonyState Additions

```ts
interface ColonyState {
  // ... existing fields ...
  offlineEvents: OfflineEvent[]
}
```

### Files Modified

- `src/stores/gameStore.ts` — new `processOfflineTime()` with phase-based analytical engine, `OfflineEvent` type, state field, mulberry32 PRNG
- `src/composables/useGameLoop.ts` — visibility handler triggers catch-up and debrief flow
- `src/services/notifications.ts` — expand with eager simulation, offline notification scheduling/cancellation, remove old cap notification
- `src/components/ShiftReport.vue` — new modal component for the debrief screen
- `src/App.vue` — mount `ShiftReport` overlay (alongside existing `HazardAlert` and `GameOverModal`)

### Files NOT Modified

- `ColonyMap.vue`, `CommandConsole.vue`, visual layer — offline catch-up is invisible to the rendering layer; it just patches state before the tick loop starts.

## 6. Edge Cases

- **Game over offline**: If air/power hits zero and all colonists reach 10% health, the colony is in critical state but NOT game over. The `gameOver` flag is never set during offline. The shift report shows a critical warning. The player must act quickly once they resume.
- **Multiple hazards in sequence**: Each hazard triggers a phase boundary and rate recalculation. A cascade of damage is possible and intentional — this is what makes you want to check in.
- **Power → air cascade**: Power depletion stops air production. Air depletion triggers health drain. This cascade is fully modeled by the phase-splitting algorithm.
- **Very long absences (days)**: Resources clamp at 0/max. Credits and depth accumulate (drill rate may be reduced if directive auto-switched to emergency). Multiple hazards may have fired. The shift report summarizes everything.
- **App killed vs backgrounded**: Both save `lastTickAt`. On next launch, `load()` restores state and `processOfflineTime()` catches up from `lastTickAt`. For killed apps, the eager simulation result is stale — a fresh simulation runs on resume.
- **Directive changes during offline**: When the directive auto-switches, all derived rates (drillRate, engineerBonus, powerNet, airNet) are recalculated for the remaining duration.
