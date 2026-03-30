# Persistent Offline Colony

## Overview

The colony runs continuously via analytical offline catch-up. The player is an on-call operator who gets paged (push notifications) when something needs attention, and reads a shift report when they return to the console.

## 1. Analytical Offline Engine

Replace the current `processOfflineTime()` in `gameStore.ts` (which calls `tick(capped)` with a 5-minute ceiling) with a pure-math catch-up that resolves any duration in a single pass.

### Resource Accumulation

Compute net rates at the moment the app was backgrounded and apply them over elapsed time:

```
powerNet = (solars * POWER_PRODUCTION_PER_SOLAR * engineerBonus) - (activeBuildings * POWER_CONSUMPTION_PER_BUILDING)
airNet = (generators * O2_PRODUCTION_PER_GENERATOR * engineerBonus) - (aliveColonists * AIR_CONSUMPTION_PER_COLONIST)
```

Apply: `resource = clamp(resource + netRate * dt, 0, max)`

If a resource hits zero partway through the offline period, compute when that happens (`timeToZero = currentAmount / abs(netRate)`) and split the offline period into segments (before depletion and after) to correctly model health drain.

### Drilling, Metals, Credits

```
depthGain = drillRate * dt
metalGain = depthGain * METALS_PER_DEPTH
iceGain = floor(ICE_CHANCE_PER_TICK * dt) * ICE_PER_FIND
creditGain = (BASE_CREDITS_PER_TICK + drillRate * METALS_PER_DEPTH * CREDITS_PER_METAL_MINED) * dt + iceGain * CREDITS_PER_ICE_FOUND
```

### Shipments

Advance `totalPlaytimeMs` by elapsed time. Any `InTransitShipment` with `arrivalAt <= totalPlaytimeMs` is landed. Emergency items apply instantly; equipment/crates spawn supply drops (auto-unpacked for offline arrivals since colonists would have unpacked them).

### Healing

```
healPerColonist = medbays * MEDBAY_HEAL_PER_SEC * engineerBonus * dt
```

Clamp each colonist's health to 100.

### No Time Cap

Remove the 5-minute ceiling. The analytical approach handles any duration.

## 2. Offline Hazards

### Hazard Rolling

During offline catch-up, roll hazards at the same cadence as online play: one check per `HAZARD_CHECK_INTERVAL_MS` (15s) of elapsed time.

```
numChecks = floor(elapsedMs / HAZARD_CHECK_INTERVAL_MS)
```

For each check, roll against `HAZARD_BASE_CHANCE + depth * HAZARD_DEPTH_SCALE` (adjusted by directive's `hazardResist`). Use a seeded PRNG (seed = `lastTickAt`) for deterministic offline results.

### Hazard Effects

Same as online: damage a random undamaged building. After each hazard, recalculate net resource rates for subsequent time segments (a damaged solar panel changes power production for the rest of the offline period).

### Emergency Auto-Response

If air or power drops below 20% during offline simulation, the colony auto-switches to emergency directive (same as the online emergency override logic). This is logged as an offline event.

### Health Floor

Colonists cannot die while offline. Health drains normally when resources are zero, but floors at 10%. This ensures the player always has a chance to respond.

## 3. Push Notifications

### Notification Tiers

**Immediate (critical)** — scheduled at the predicted wall-clock time:
- Hazard strike: "HAZARD: [Meteor Strike] — [Solar Panel] damaged"
- Resource emergency: "ALERT: [O2] critical — below 15%"
- Colonist critical: "ALERT: Crew health critical — intervention needed"

**Batched (every 30 min)** — summary notification:
- Shipments that arrived in the batch window
- Depth milestones (every 50m crossed)
- Credit milestones (every 500 credits)

### Scheduling Strategy

When the app backgrounds:

1. Pre-calculate the timeline of all predictable events (resource depletion times, shipment arrivals, hazard roll times with expected probability).
2. Schedule `LocalNotifications` at the corresponding wall-clock times for critical events.
3. Schedule batch summary notifications at 30-min intervals.
4. Cap total scheduled notifications at ~20 to stay within OS limits.

When the app resumes:

1. Cancel all pending scheduled notifications.
2. Run the actual offline catch-up.
3. Re-schedule on next background.

### Notification IDs

Use a reserved ID range (10000–10099) for offline notifications. This makes bulk cancellation straightforward.

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

- Only show if offline duration > 30 seconds
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

- `src/stores/gameStore.ts` — new `processOfflineTime()` with analytical engine, `OfflineEvent` type, state field
- `src/composables/useGameLoop.ts` — visibility handler triggers catch-up and debrief flow
- `src/services/notifications.ts` — expand with offline notification scheduling/cancellation
- `src/components/ShiftReport.vue` — new modal component for the debrief screen
- `src/App.vue` — mount `ShiftReport` overlay (alongside existing `HazardAlert` and `GameOverModal`)

### Files NOT Modified

- `ColonyMap.vue`, `CommandConsole.vue`, visual layer — offline catch-up is invisible to the rendering layer; it just patches state before the tick loop starts.

## 6. Edge Cases

- **Game over offline**: If air/power hits zero and all colonists reach 10% health, the colony is in critical state but NOT game over. The shift report shows a critical warning. The player must act quickly once they resume.
- **Multiple hazards in sequence**: Each hazard recalculates rates for subsequent simulation. A cascade of damage is possible and intentional — this is what makes you want to check in.
- **Very long absences (days)**: Resources clamp at 0/max. Credits and depth accumulate without bound. Multiple hazards may have fired. The shift report summarizes everything.
- **App killed vs backgrounded**: Both save `lastTickAt`. On next launch, `load()` restores state and `processOfflineTime()` catches up from `lastTickAt`.
