# Persistent Offline Colony Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the colony run persistently while the app is closed, with push notifications for critical events and a shift report debrief on return.

**Architecture:** Replace the single-pass `processOfflineTime()` with a phase-based analytical engine that splits elapsed time at discontinuities (resource depletion, hazards, shipments, directive changes). Schedule local notifications eagerly when backgrounding. Show a shift report modal on resume.

**Tech Stack:** Vue 3, Pinia, TypeScript, @capacitor/local-notifications

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/stores/offlineEngine.ts` | Create | Pure-function analytical engine: `simulateOffline(state, elapsedMs) → { newState, events }`. Contains mulberry32 PRNG, phase-splitting loop, rate computation. No Pinia dependency. |
| `src/stores/gameStore.ts` | Modify | Add `offlineEvents: OfflineEvent[]` to state. Replace `processOfflineTime()` to call the offline engine. Add `dismissShiftReport()` action. |
| `src/services/notifications.ts` | Modify | Add `scheduleOfflineNotifications(events, backgroundedAt)` and `cancelAllOfflineNotifications()`. Remove old cap notification. |
| `src/composables/useGameLoop.ts` | Modify | On visibility change: run eager sim when backgrounding, apply stored result + show report when resuming. |
| `src/components/ShiftReport.vue` | Create | Modal overlay showing offline debrief (duration, events, deltas, status). |
| `src/App.vue` | Modify | Mount `ShiftReport` alongside existing overlays. |

---

## Task 1: Mulberry32 PRNG and Rate Computation Helpers

**Files:**
- Create: `src/stores/offlineEngine.ts`

These are the pure utility functions the simulation loop depends on.

- [ ] **Step 1: Create offlineEngine.ts with PRNG and types**

```ts
// src/stores/offlineEngine.ts

export interface OfflineEvent {
  type: 'hazard' | 'shipment' | 'resource_critical' | 'auto_directive' | 'milestone'
  message: string
  severity: 'info' | 'warning' | 'critical'
  offsetMs: number // ms into the offline period when this happened
}

export interface OfflineResult {
  events: OfflineEvent[]
  deltaCredits: number
  deltaMetals: number
  deltaIce: number
  deltaDepth: number
  durationMs: number
}

// Mulberry32: deterministic 32-bit PRNG
export function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

- [ ] **Step 2: Add rate computation helper**

Still in `offlineEngine.ts`, add a function that computes all net rates from a state snapshot. This mirrors the Pinia getters but works on plain data:

```ts
import type { ColonyState, Directive } from './gameStore'

// Re-export constants needed (or import from gameStore if they're exported)
// For now, define them locally to keep this file pure. We'll reconcile in Task 2.

interface Rates {
  powerNet: number
  airNet: number
  drillRate: number
  creditRate: number
  healRate: number
  healthDrain: number
  engineerBonus: number
}

export function computeRates(state: ColonyState): Rates {
  const alive = state.colonists.filter(c => c.health > 0)
  const engineers = alive.filter(c => c.role === 'engineer').length
  const drillers = alive.filter(c => c.role === 'driller').length
  const mod = DIRECTIVE_MODIFIERS[state.activeDirective]
  const engBonus = (1 + engineers * ENGINEER_EFFICIENCY_BONUS) * mod.prodMult

  const undamagedSolars = state.buildings.filter(b => b.type === 'solar' && !b.damaged).length
  const undamagedGenerators = state.buildings.filter(b => b.type === 'o2generator' && !b.damaged).length
  const undamagedMedbays = state.buildings.filter(b => b.type === 'medbay' && !b.damaged).length
  const activeBuildings = state.buildings.filter(b => !b.damaged).length
  const undamagedRigs = state.buildings.filter(b => b.type === 'drillrig' && !b.damaged).length

  const powerProd = undamagedSolars * POWER_PRODUCTION_PER_SOLAR * engBonus
  const powerCons = activeBuildings * POWER_CONSUMPTION_PER_BUILDING
  const powerNet = powerProd - powerCons

  const airProd = state.power > 0
    ? undamagedGenerators * O2_PRODUCTION_PER_GENERATOR * engBonus
    : 0
  const airCons = alive.length * AIR_CONSUMPTION_PER_COLONIST
  const airNet = airProd - airCons

  const drillMult = DIRECTIVE_MODIFIERS[state.activeDirective].drillMult
  const drillEngBonus = 1 + engineers * ENGINEER_EFFICIENCY_BONUS
  const drillRate = (drillers * DRILL_SPEED_PER_DRILLER + undamagedRigs * DRILL_SPEED_PER_RIG) * drillEngBonus * drillMult

  const creditRate = BASE_CREDITS_PER_TICK + drillRate * METALS_PER_DEPTH * CREDITS_PER_METAL_MINED

  const healRate = (state.power > 0 && undamagedMedbays > 0)
    ? undamagedMedbays * MEDBAY_HEAL_PER_SEC * engBonus
    : 0

  const healthDrain = (state.air <= 0 || state.power <= 0) ? HEALTH_DRAIN_PER_SEC : 0

  return { powerNet, airNet, drillRate, creditRate, healRate, healthDrain, engineerBonus: engBonus }
}
```

- [ ] **Step 3: Export constants from gameStore.ts**

In `src/stores/gameStore.ts`, export the constants that `offlineEngine.ts` needs. Add `export` to the constant declarations:

```ts
// In gameStore.ts, change from:
const AIR_CONSUMPTION_PER_COLONIST = 0.5
// To:
export const AIR_CONSUMPTION_PER_COLONIST = 0.5
```

Export these constants:
- `AIR_CONSUMPTION_PER_COLONIST`, `O2_PRODUCTION_PER_GENERATOR`
- `POWER_PRODUCTION_PER_SOLAR`, `POWER_CONSUMPTION_PER_BUILDING`
- `DRILL_SPEED_PER_DRILLER`, `DRILL_SPEED_PER_RIG`
- `METALS_PER_DEPTH`, `ICE_CHANCE_PER_TICK`, `ICE_PER_FIND`
- `ENGINEER_EFFICIENCY_BONUS`, `MEDBAY_HEAL_PER_SEC`, `HEALTH_DRAIN_PER_SEC`
- `HAZARD_CHECK_INTERVAL_MS`, `HAZARD_BASE_CHANCE`, `HAZARD_DEPTH_SCALE`
- `BASE_CREDITS_PER_TICK`, `CREDITS_PER_METAL_MINED`, `CREDITS_PER_ICE_FOUND`
- `DIRECTIVE_MODIFIERS`, `DIRECTIVE_RATIOS`
- `STARTING_AIR_MAX`, `STARTING_POWER_MAX`
- `COLONIST_NAMES`, `BLUEPRINTS`
- `uid`, `getBuildingPosition`

Then update `offlineEngine.ts` imports to use them.

- [ ] **Step 4: Verify build**

Run: `bun run build`
Expected: No type errors, clean build.

- [ ] **Step 5: Commit**

```bash
git add src/stores/offlineEngine.ts src/stores/gameStore.ts
git commit -m "feat: add offline engine PRNG and rate computation helpers"
```

---

## Task 2: Phase-Based Simulation Loop

**Files:**
- Modify: `src/stores/offlineEngine.ts`

The core algorithm: split elapsed time at discontinuities and advance state phase by phase.

- [ ] **Step 1: Add role reassignment helper**

The offline engine needs to reassign colonist roles when the directive changes (mirrors `reassignRoles()` in `gameStore.ts`). Add to `offlineEngine.ts`:

```ts
function reassignRoles(state: ColonyState): void {
  const alive = state.colonists.filter(c => c.health > 0)
  if (alive.length === 0) return

  const ratio = DIRECTIVE_RATIOS[state.activeDirective]
  let targetDrillers = Math.round(alive.length * ratio.driller)
  let targetEngineers = Math.round(alive.length * ratio.engineer)

  // Emergency overrides
  if (state.air < state.airMax * 0.2 && state.buildings.some(b => b.type === 'o2generator' && !b.damaged)) {
    targetEngineers = Math.min(alive.length, targetEngineers + 1)
    targetDrillers = Math.max(0, targetDrillers - 1)
  }
  if (state.power < state.powerMax * 0.2) {
    targetEngineers = Math.min(alive.length, targetEngineers + 1)
    targetDrillers = Math.max(0, targetDrillers - 1)
  }
  if (state.buildings.some(b => b.damaged) && alive.filter(c => c.role === 'engineer').length === 0) {
    targetEngineers = Math.max(1, targetEngineers)
  }
  if (targetDrillers + targetEngineers > alive.length) {
    targetEngineers = Math.min(targetEngineers, alive.length)
    targetDrillers = Math.min(targetDrillers, alive.length - targetEngineers)
  }

  let drillerSlots = targetDrillers
  let engineerSlots = targetEngineers
  for (const c of alive) {
    if (drillerSlots > 0) { c.role = 'driller'; drillerSlots-- }
    else if (engineerSlots > 0) { c.role = 'engineer'; engineerSlots-- }
    else { c.role = 'idle' }
  }
}
```

- [ ] **Step 2: Add hazard application helper**

```ts
function applyHazard(state: ColonyState, rand: () => number, events: OfflineEvent[], offsetMs: number): void {
  const mod = DIRECTIVE_MODIFIERS[state.activeDirective]
  const chance = (HAZARD_BASE_CHANCE + state.depth * HAZARD_DEPTH_SCALE) * (1 - mod.hazardResist)
  if (rand() > chance) return

  const roll = rand()
  if (roll < 0.4) {
    // Meteor
    const undamaged = state.buildings.filter(b => !b.damaged)
    if (undamaged.length > 0) {
      const target = undamaged[Math.floor(rand() * undamaged.length)]
      target.damaged = true
      const label = BLUEPRINTS.find(bp => bp.type === target.type)?.label || target.type
      events.push({
        type: 'hazard', severity: 'critical', offsetMs,
        message: `Micro-meteor struck a ${label}!`
      })
    }
  } else if (roll < 0.7) {
    // Power surge
    state.power = Math.max(0, state.power - state.powerMax * 0.3)
    events.push({
      type: 'hazard', severity: 'critical', offsetMs,
      message: 'Power surge! 30% power lost.'
    })
  } else {
    // Gas pocket
    state.air = Math.max(0, state.air - state.airMax * 0.25)
    events.push({
      type: 'hazard', severity: 'critical', offsetMs,
      message: 'Hit a gas pocket! Air venting!'
    })
  }
}
```

- [ ] **Step 3: Add shipment landing helper**

```ts
function landShipments(state: ColonyState, rand: () => number, events: OfflineEvent[], offsetMs: number): void {
  const arrived = state.inTransitShipments.filter(s => state.totalPlaytimeMs >= s.arrivalAt)
  if (arrived.length === 0) return

  state.inTransitShipments = state.inTransitShipments.filter(s => state.totalPlaytimeMs < s.arrivalAt)

  for (const pkg of arrived) {
    for (const item of pkg.contents) {
      switch (item.type) {
        case 'emergencyO2':
          state.air = Math.min(state.airMax, state.air + 30)
          break
        case 'emergencyPower':
          state.power = Math.min(state.powerMax, state.power + 30)
          break
        case 'supplyCrate':
          state.metals += 15
          state.ice += 5
          break
        case 'equipment':
          if (item.buildingType) {
            // Simplified placement — getBuildingPosition will be called, import it
            const pos = getBuildingPosition(item.buildingType, state.buildings)
            state.buildings.push({
              id: uid(), type: item.buildingType, damaged: false, x: pos.x, y: pos.y
            })
            // Update capacities
            if (item.buildingType === 'o2generator') state.airMax += 25
            if (item.buildingType === 'solar') state.powerMax += 25
          }
          break
        case 'newColonist': {
          const usedNames = new Set(state.colonists.map(c => c.name))
          const available = COLONIST_NAMES.filter(n => !usedNames.has(n))
          const name = available.length > 0
            ? available[Math.floor(rand() * available.length)]
            : `Crew-${state.colonists.length + 1}`
          state.colonists.push({ id: uid(), name, role: 'idle', health: 100 })
          break
        }
        case 'repairKit': {
          const damaged = state.buildings.find(b => b.damaged)
          if (damaged) damaged.damaged = false
          break
        }
      }
    }
    const itemNames = pkg.contents.map(o => o.label).join(', ')
    events.push({
      type: 'shipment', severity: 'info', offsetMs,
      message: `Shipment arrived: ${itemNames}`
    })
  }
}
```

Note: Import `uid` and `getBuildingPosition` from `gameStore.ts` (they'll need to be exported in Task 1 step 3 — add them to the export list).

- [ ] **Step 4: Implement the main simulation loop**

```ts
export function simulateOffline(inputState: ColonyState, elapsedMs: number): OfflineResult {
  // Deep clone state so we don't mutate the original
  const state: ColonyState = JSON.parse(JSON.stringify(inputState))
  const rand = mulberry32(state.lastTickAt)
  const events: OfflineEvent[] = []

  // Snapshot for deltas
  const before = {
    credits: state.credits,
    metals: state.metals,
    ice: state.ice,
    depth: state.depth,
  }

  let remaining = elapsedMs / 1000 // work in seconds
  let elapsedSoFar = 0 // track ms offset for events
  let timeSinceHazardCheck = 0
  const HAZARD_INTERVAL_S = HAZARD_CHECK_INTERVAL_MS / 1000

  while (remaining > 0.01) { // epsilon to avoid float drift
    const rates = computeRates(state)

    // Find next phase boundary (seconds from now)
    let nextPhase = remaining
    let phaseReason: 'end' | 'power_zero' | 'air_zero' | 'hazard' | 'shipment' = 'end'

    // Time until power hits 0
    if (rates.powerNet < 0 && state.power > 0) {
      const t = state.power / Math.abs(rates.powerNet)
      if (t < nextPhase) { nextPhase = t; phaseReason = 'power_zero' }
    }

    // Time until air hits 0 (only matters if power > 0, otherwise air is already draining)
    if (rates.airNet < 0 && state.air > 0) {
      const t = state.air / Math.abs(rates.airNet)
      if (t < nextPhase) { nextPhase = t; phaseReason = 'air_zero' }
    }

    // Time until next hazard check
    const timeToHazard = HAZARD_INTERVAL_S - timeSinceHazardCheck
    if (timeToHazard > 0 && timeToHazard < nextPhase) {
      nextPhase = timeToHazard
      phaseReason = 'hazard'
    }

    // Time until next shipment
    for (const s of state.inTransitShipments) {
      const arrivalIn = (s.arrivalAt - state.totalPlaytimeMs) / 1000
      if (arrivalIn > 0 && arrivalIn < nextPhase) {
        nextPhase = arrivalIn
        phaseReason = 'shipment'
      }
    }

    const phaseDt = Math.max(nextPhase, 0.001) // minimum step

    // --- Apply rates for this phase ---

    // Power
    state.power = Math.min(state.powerMax, Math.max(0, state.power + rates.powerNet * phaseDt))

    // Air
    state.air = Math.min(state.airMax, Math.max(0, state.air + rates.airNet * phaseDt))

    // Drilling
    if (rates.drillRate > 0) {
      const depthGain = rates.drillRate * phaseDt
      state.depth += depthGain
      if (state.depth > state.maxDepth) state.maxDepth = state.depth

      const metalGain = depthGain * METALS_PER_DEPTH
      state.metals += metalGain

      const iceGain = ICE_CHANCE_PER_TICK * phaseDt * ICE_PER_FIND
      state.ice += iceGain

      // creditRate already includes base + metal credits per second.
      // iceGain already incorporates phaseDt, so don't multiply again.
      const creditGain = rates.creditRate * phaseDt + iceGain * CREDITS_PER_ICE_FOUND
      state.credits += creditGain
      state.totalCreditsEarned += creditGain
    } else {
      const creditGain = BASE_CREDITS_PER_TICK * phaseDt
      state.credits += creditGain
      state.totalCreditsEarned += creditGain
    }

    // Healing
    if (rates.healRate > 0) {
      for (const c of state.colonists) {
        if (c.health > 0 && c.health < 100) {
          c.health = Math.min(100, c.health + rates.healRate * phaseDt)
        }
      }
    }

    // Health drain (floor at 10%)
    if (rates.healthDrain > 0) {
      for (const c of state.colonists) {
        if (c.health > 10) {
          c.health = Math.max(10, c.health - rates.healthDrain * phaseDt)
        }
      }
    }

    // Advance time
    state.totalPlaytimeMs += phaseDt * 1000
    remaining -= phaseDt
    elapsedSoFar += phaseDt * 1000
    timeSinceHazardCheck += phaseDt

    // --- Process phase boundary event ---

    if (phaseReason === 'power_zero') {
      state.power = 0
      events.push({
        type: 'resource_critical', severity: 'critical', offsetMs: elapsedSoFar,
        message: 'Power depleted! Air production offline.'
      })
    }

    if (phaseReason === 'air_zero') {
      state.air = 0
      events.push({
        type: 'resource_critical', severity: 'critical', offsetMs: elapsedSoFar,
        message: 'Air reserves depleted! Crew health declining.'
      })
    }

    if (phaseReason === 'hazard') {
      timeSinceHazardCheck = 0
      applyHazard(state, rand, events, elapsedSoFar)
    }

    if (phaseReason === 'shipment') {
      landShipments(state, rand, events, elapsedSoFar)
      // Reassign roles in case new colonist or new building changed things
      reassignRoles(state)
    }

    // Emergency directive auto-switch
    if (state.activeDirective !== 'emergency') {
      if (state.air < state.airMax * 0.2 || state.power < state.powerMax * 0.2) {
        state.activeDirective = 'emergency'
        reassignRoles(state)
        events.push({
          type: 'auto_directive', severity: 'warning', offsetMs: elapsedSoFar,
          message: 'Auto-switched to Emergency Protocol — resources critical.'
        })
      }
    }

    // Depth milestones (every 50m)
    const beforeMilestone = Math.floor(before.depth / 50)
    const afterMilestone = Math.floor(state.depth / 50)
    if (afterMilestone > beforeMilestone) {
      events.push({
        type: 'milestone', severity: 'info', offsetMs: elapsedSoFar,
        message: `Reached ${afterMilestone * 50}m depth.`
      })
    }
  }

  // Update capacities at end
  const generators = state.buildings.filter(b => b.type === 'o2generator' && !b.damaged).length
  const solars = state.buildings.filter(b => b.type === 'solar' && !b.damaged).length
  state.airMax = STARTING_AIR_MAX + generators * 25
  state.powerMax = STARTING_POWER_MAX + solars * 25

  // Clear supply drops (all auto-unpacked offline)
  state.supplyDrops = []

  return {
    events,
    deltaCredits: state.credits - before.credits,
    deltaMetals: state.metals - before.metals,
    deltaIce: state.ice - before.ice,
    deltaDepth: state.depth - before.depth,
    durationMs: elapsedMs,
    // Attach the mutated state so the store can apply it
    finalState: state,
  }
}
```

Update the `OfflineResult` interface to include `finalState: ColonyState`.

- [ ] **Step 5: Verify build**

Run: `bun run build`
Expected: Clean build, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/stores/offlineEngine.ts
git commit -m "feat: implement phase-based offline simulation loop"
```

---

## Task 3: Integrate Offline Engine into Game Store

**Files:**
- Modify: `src/stores/gameStore.ts`

Wire the analytical engine into the store, replacing the old `processOfflineTime()`.

- [ ] **Step 1: Add `offlineEvents` to ColonyState**

In `gameStore.ts`, add to the `ColonyState` interface:

```ts
offlineEvents: OfflineEvent[]
```

Import `OfflineEvent` from `./offlineEngine`. Add to `freshState()`:

```ts
offlineEvents: [],
```

- [ ] **Step 2: Replace `processOfflineTime()`**

Replace the existing `processOfflineTime()` action (lines 902-909) with:

```ts
processOfflineTime(): OfflineResult | null {
  const now = Date.now()
  const elapsed = now - this.lastTickAt
  if (elapsed < 2000) return null // less than 2s, not worth catching up

  const result = simulateOffline(this.$state, elapsed)
  const fs = result.finalState

  // Selectively patch only the fields the offline engine modifies.
  // Avoids overwriting messages, manifest, and other UI-driven state.
  this.$patch({
    air: fs.air,
    airMax: fs.airMax,
    power: fs.power,
    powerMax: fs.powerMax,
    metals: fs.metals,
    ice: fs.ice,
    credits: fs.credits,
    totalCreditsEarned: fs.totalCreditsEarned,
    depth: fs.depth,
    maxDepth: fs.maxDepth,
    colonists: fs.colonists,
    buildings: fs.buildings,
    activeDirective: fs.activeDirective,
    inTransitShipments: fs.inTransitShipments,
    supplyDrops: fs.supplyDrops,
    totalPlaytimeMs: fs.totalPlaytimeMs,
    hazardCooldownUntil: fs.hazardCooldownUntil,
    offlineEvents: result.events,
  })

  this.lastTickAt = now
  this.lastSavedAt = now

  return result
},
```

Import `simulateOffline` and `OfflineResult` from `./offlineEngine`.

- [ ] **Step 3: Add `dismissShiftReport()` action**

```ts
dismissShiftReport() {
  this.offlineEvents = []
},
```

- [ ] **Step 4: Verify build**

Run: `bun run build`
Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat: integrate offline engine into game store"
```

---

## Task 4: Notification Scheduling

**Files:**
- Modify: `src/services/notifications.ts`

Replace the old cap notification with tiered offline notification scheduling.

- [ ] **Step 1: Rewrite notifications.ts**

```ts
import { LocalNotifications } from '@capacitor/local-notifications'
import type { OfflineEvent } from '@/stores/offlineEngine'

const OFFLINE_NOTIFICATION_ID_BASE = 10000
const OFFLINE_NOTIFICATION_ID_MAX = 10099
const BATCH_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

async function ensurePermissions(): Promise<boolean> {
  try {
    const permission = await LocalNotifications.requestPermissions()
    return permission.display === 'granted'
  } catch {
    return false
  }
}

export async function scheduleOfflineNotifications(
  events: OfflineEvent[],
  backgroundedAt: number,
): Promise<void> {
  if (!(await ensurePermissions())) return

  await cancelAllOfflineNotifications()

  const notifications: Array<{
    id: number
    title: string
    body: string
    schedule: { at: Date }
  }> = []

  let nextId = OFFLINE_NOTIFICATION_ID_BASE

  // Critical events get immediate notifications
  const criticalEvents = events.filter(e => e.severity === 'critical')
  for (const event of criticalEvents) {
    if (nextId > OFFLINE_NOTIFICATION_ID_MAX) break
    notifications.push({
      id: nextId++,
      title: 'Colony Alert',
      body: event.message,
      schedule: { at: new Date(backgroundedAt + event.offsetMs) },
    })
  }

  // Batch non-critical events into 30-min windows
  const nonCritical = events.filter(e => e.severity !== 'critical')
  if (nonCritical.length > 0) {
    const maxOffset = Math.max(...events.map(e => e.offsetMs))
    const numBatches = Math.ceil(maxOffset / BATCH_INTERVAL_MS)

    for (let i = 0; i < numBatches && nextId <= OFFLINE_NOTIFICATION_ID_MAX; i++) {
      const windowStart = i * BATCH_INTERVAL_MS
      const windowEnd = (i + 1) * BATCH_INTERVAL_MS
      const batchEvents = nonCritical.filter(
        e => e.offsetMs >= windowStart && e.offsetMs < windowEnd,
      )
      if (batchEvents.length === 0) continue

      const summary = batchEvents.map(e => e.message).join(', ')
      notifications.push({
        id: nextId++,
        title: 'Colony Report',
        body: `${batchEvents.length} update${batchEvents.length > 1 ? 's' : ''}: ${summary}`,
        schedule: { at: new Date(backgroundedAt + windowEnd) },
      })
    }
  }

  if (notifications.length === 0) return

  try {
    await LocalNotifications.schedule({
      notifications: notifications.map(n => ({
        ...n,
        smallIcon: 'ic_stat_icon',
        iconColor: '#f59e0b',
      })),
    })
  } catch (e) {
    console.warn('[Notifications] Failed to schedule:', e)
  }
}

export async function cancelAllOfflineNotifications(): Promise<void> {
  try {
    const ids = Array.from(
      { length: OFFLINE_NOTIFICATION_ID_MAX - OFFLINE_NOTIFICATION_ID_BASE + 1 },
      (_, i) => ({ id: OFFLINE_NOTIFICATION_ID_BASE + i }),
    )
    await LocalNotifications.cancel({ notifications: ids })
  } catch {
    // Ignore — notifications may not exist
  }
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/services/notifications.ts
git commit -m "feat: add tiered offline notification scheduling"
```

---

## Task 5: Update Game Loop for Offline Flow

**Files:**
- Modify: `src/composables/useGameLoop.ts`

Change the visibility handler to run the offline engine and control when the tick loop resumes (after the shift report is dismissed). Includes `reportData` for the shift report component.

- [ ] **Step 1: Rewrite useGameLoop.ts**

```ts
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { scheduleOfflineNotifications, cancelAllOfflineNotifications } from '@/services/notifications'
import { simulateOffline } from '@/stores/offlineEngine'
import type { OfflineResult } from '@/stores/offlineEngine'

const TICK_MS = 1000
const SAVE_EVERY_N_TICKS = 30
const EAGER_SIM_WINDOW_MS = 4 * 60 * 60 * 1000 // 4 hours max for notification scheduling

export function useGameLoop() {
  const game = useGameStore()
  const showShiftReport = ref(false)
  const reportData = reactive({
    durationMs: 0,
    deltaCredits: 0,
    deltaMetals: 0,
    deltaIce: 0,
    deltaDepth: 0,
  })

  let tickInterval: ReturnType<typeof setInterval> | null = null
  let tickCount = 0

  function startLoop() {
    if (tickInterval) return
    tickInterval = setInterval(() => {
      game.tick(TICK_MS)
      tickCount++
      if (tickCount % SAVE_EVERY_N_TICKS === 0) {
        game.save()
      }
    }, TICK_MS)
  }

  function stopLoop() {
    if (tickInterval) {
      clearInterval(tickInterval)
      tickInterval = null
    }
  }

  function applyReportData(result: OfflineResult) {
    reportData.durationMs = result.durationMs
    reportData.deltaCredits = result.deltaCredits
    reportData.deltaMetals = result.deltaMetals
    reportData.deltaIce = result.deltaIce
    reportData.deltaDepth = result.deltaDepth
  }

  function dismissReport() {
    showShiftReport.value = false
    game.dismissShiftReport()
    startLoop()
  }

  function handleOfflineResult(result: OfflineResult | null) {
    if (result && result.events.length > 0 && result.durationMs > 60_000) {
      applyReportData(result)
      showShiftReport.value = true
      // Don't start the loop — wait for dismissReport()
    } else {
      startLoop()
    }
  }

  async function onVisibilityChange() {
    if (document.hidden) {
      // Backgrounding: stop loop, save, schedule notifications
      stopLoop()
      await game.save()

      // Eager simulation for notification scheduling (capped at 4h)
      const eagerResult = simulateOffline(game.$state, EAGER_SIM_WINDOW_MS)
      await scheduleOfflineNotifications(eagerResult.events, Date.now())
    } else {
      // Resuming: cancel notifications, run catch-up
      await cancelAllOfflineNotifications()
      handleOfflineResult(game.processOfflineTime())
    }
  }

  onMounted(async () => {
    await game.load()
    // Check for offline time accumulated before mount (app was killed)
    handleOfflineResult(game.processOfflineTime())
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onUnmounted(() => {
    stopLoop()
    game.save()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return { startLoop, stopLoop, showShiftReport, dismissReport, reportData }
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/composables/useGameLoop.ts
git commit -m "feat: update game loop for offline catch-up and shift report flow"
```

---

## Task 6: Shift Report UI Component

**Files:**
- Create: `src/components/ShiftReport.vue`

Modal overlay showing the offline debrief. Follows the existing modal pattern from `GameOverModal.vue`.

- [ ] **Step 1: Create ShiftReport.vue**

```vue
<template>
  <Transition name="modal">
    <div v-if="visible" class="modal-overlay">
      <div class="report-card">
        <h2 class="report-title">Shift Report</h2>
        <p class="report-duration mono">{{ fmtDuration(game.offlineEvents.length > 0 ? durationMs : 0) }} offline</p>

        <div v-if="events.length > 0" class="report-events">
          <div
            v-for="(event, i) in events"
            :key="i"
            class="report-event"
            :class="'severity-' + event.severity"
          >
            <span class="event-time mono">{{ fmtOffsetTime(event.offsetMs) }}</span>
            <span class="event-message">{{ event.message }}</span>
          </div>
        </div>
        <div v-else class="report-quiet">
          All systems nominal. No incidents while you were away.
        </div>

        <div class="report-deltas">
          <div class="delta">
            <span class="delta-label">CREDITS</span>
            <span class="delta-value mono" :class="deltaCredits >= 0 ? 'positive' : 'negative'">
              {{ deltaCredits >= 0 ? '+' : '' }}{{ Math.floor(deltaCredits) }}
            </span>
          </div>
          <div class="delta">
            <span class="delta-label">METALS</span>
            <span class="delta-value mono positive">+{{ Math.floor(deltaMetals) }}</span>
          </div>
          <div class="delta">
            <span class="delta-label">ICE</span>
            <span class="delta-value mono positive">+{{ Math.floor(deltaIce) }}</span>
          </div>
          <div class="delta">
            <span class="delta-label">DEPTH</span>
            <span class="delta-value mono positive">+{{ fmtDepth(deltaDepth) }}</span>
          </div>
        </div>

        <div class="report-status" :class="'status-' + colonyStatus">
          Colony Status: {{ colonyStatus.toUpperCase() }}
        </div>

        <button class="resume-btn" @click="$emit('dismiss')">Resume Operations</button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { fmtDepth, fmtDuration } from '@/utils/format'

defineProps<{
  visible: boolean
  durationMs: number
  deltaCredits: number
  deltaMetals: number
  deltaIce: number
  deltaDepth: number
}>()

defineEmits<{
  dismiss: []
}>()

const game = useGameStore()

const events = computed(() => game.offlineEvents)

const colonyStatus = computed(() => {
  if (game.air <= game.airMax * 0.15 || game.power <= game.powerMax * 0.15) return 'critical'
  if (game.air <= game.airMax * 0.3 || game.power <= game.powerMax * 0.3) return 'warning'
  return 'nominal'
})

function fmtOffsetTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `+${h}h${String(m).padStart(2, '0')}m`
  if (m > 0) return `+${m}m${String(s).padStart(2, '0')}s`
  return `+${s}s`
}
</script>
```

- [ ] **Step 2: Add styles**

Add `<style scoped>` following the existing modal pattern (dark card, CRT aesthetic, monospace values):

```vue
<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.report-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 28px 22px;
  text-align: center;
  max-width: 360px;
  width: 100%;
  animation: slide-up 0.3s ease;
  border: 1px solid var(--cyan-glow);
  max-height: 80vh;
  overflow-y: auto;
}

.report-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--cyan);
  margin-bottom: 4px;
}

.report-duration {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.report-events {
  text-align: left;
  margin-bottom: 16px;
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.report-event {
  font-size: 12px;
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.03);
}

.event-time {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
  min-width: 52px;
}

.event-message {
  color: var(--text-secondary);
}

.severity-critical .event-message {
  color: var(--red);
  font-weight: 600;
}

.severity-warning .event-message {
  color: var(--amber);
}

.report-quiet {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 16px;
  font-style: italic;
}

.report-deltas {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.delta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.delta-label {
  font-size: 9px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.delta-value {
  font-size: 15px;
  font-weight: 600;
}

.positive {
  color: var(--green);
}

.negative {
  color: var(--red);
}

.report-status {
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 8px;
  border-radius: var(--radius-sm);
  margin-bottom: 20px;
}

.status-nominal {
  color: var(--green);
  background: rgba(39, 174, 96, 0.1);
}

.status-warning {
  color: var(--amber);
  background: rgba(243, 156, 18, 0.1);
}

.status-critical {
  color: var(--red);
  background: rgba(233, 69, 96, 0.1);
  animation: pulse 1.5s ease infinite;
}

.resume-btn {
  width: 100%;
  padding: 14px;
  font-size: 16px;
  font-weight: 700;
  background: var(--cyan);
  color: var(--bg-deep);
  border-radius: var(--radius-md);
}

.modal-enter-active {
  animation: slide-up 0.3s ease;
}
.modal-leave-active {
  animation: slide-up 0.3s ease reverse forwards;
}
</style>
```

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/ShiftReport.vue
git commit -m "feat: add ShiftReport modal component"
```

---

## Task 7: Wire Everything Together in App.vue

**Files:**
- Modify: `src/App.vue`

Mount the ShiftReport component and connect it to `useGameLoop`'s reactive state (which already includes `reportData` from Task 5).

- [ ] **Step 1: Update App.vue**

```vue
<template>
  <div id="app">
    <ShiftReport
      :visible="showShiftReport"
      :duration-ms="reportData.durationMs"
      :delta-credits="reportData.deltaCredits"
      :delta-metals="reportData.deltaMetals"
      :delta-ice="reportData.deltaIce"
      :delta-depth="reportData.deltaDepth"
      @dismiss="dismissReport"
    />
    <GameOverModal />
    <GameView />
  </div>
</template>

<script setup lang="ts">
import { useGameLoop } from '@/composables/useGameLoop'
import GameOverModal from '@/components/GameOverModal.vue'
import GameView from '@/components/GameView.vue'
import ShiftReport from '@/components/ShiftReport.vue'

const { showShiftReport, dismissReport, reportData } = useGameLoop()
</script>
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Clean build.

- [ ] **Step 3: Manual test**

Run: `bun run dev`

Test flow:
1. Open the app, let the colony run for 30s
2. Switch to another tab (triggers background)
3. Wait 10-15 seconds
4. Switch back — should see the shift report modal (if enough time passed) or the colony resumes normally
5. For a longer test: stop the dev server, wait 2 minutes, restart — the shift report should show accumulated offline progress

- [ ] **Step 4: Commit**

```bash
git add src/App.vue
git commit -m "feat: wire shift report into App.vue"
```

---

## Task 8: Final Polish and Edge Cases

**Files:**
- Modify: `src/stores/offlineEngine.ts`

Handle remaining edge cases.

- [ ] **Step 1: Add safety cap to simulation loop**

In `simulateOffline()`, add a maximum iteration count to prevent infinite loops from float precision issues:

```ts
const MAX_ITERATIONS = 100_000
let iterations = 0

while (remaining > 0.01 && iterations < MAX_ITERATIONS) {
  iterations++
  // ... existing loop body
}
```

- [ ] **Step 2: Ensure hazardCooldownUntil is updated**

At the end of `simulateOffline()`, set the hazard cooldown so online ticks continue correctly:

```ts
// At end of simulateOffline, before return:
state.hazardCooldownUntil = Date.now() + (HAZARD_CHECK_INTERVAL_MS - timeSinceHazardCheck * 1000)
```

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/stores/offlineEngine.ts
git commit -m "fix: offline engine edge cases — iteration cap, hazard cooldown"
```
