# Economy & Trading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the colony economy so credits are earned primarily through resource exports to HQ, with fluctuating HQ rates, storage caps, and rebalanced pricing.

**Architecture:** Add `economy.ts` system module for HQ rate bulletins. Extend `ColonyState` with export platform and storage cap state. Add `load` action type so colonists haul resources to the platform. New `ExportPanel.vue` component for the command console. Price constants scaled 10x across the board.

**Tech Stack:** Vue 3, Pinia, TypeScript (existing stack, no new dependencies)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/systems/economy.ts` | Create | HQ rate bulletin logic: base rates, event generation, current rate calculation |
| `src/types/colonist.ts` | Modify | Add `load` to `ActionType` |
| `src/stores/gameStore.ts` | Modify | 10x price constants, export platform state, storage caps, `storageSilo` + `launchplatform` building types, silo auto-build, overflow checks |
| `src/systems/colonistAI.ts` | Modify | Add `load` action scoring and duration |
| `src/systems/mapLayout.ts` | Modify | Add `launchplatform` and `storageSilo` to zone building types |
| `src/components/ExportPanel.vue` | Create | Export platform UI: cargo status, reserves, launch controls, HQ rates display |
| `src/components/CommandConsole.vue` | Modify | Add "EXPORT" tab for close lens |
| `src/components/ShipmentPanel.vue` | Modify | Updated to reflect new prices (automatic from constants) |
| `src/systems/radioChatter.ts` | Modify | Add loading, overflow, rate bulletin messages |
| `src/stores/offlineEngine.ts` | Modify | Offline export simulation, updated constants, storage caps |
| `src/stores/moonStore.ts` | Modify | Updated outpost establishment cost (10x) |

---

### Task 1: Price Rebalance (10x Scale)

**Files:**
- Modify: `src/stores/gameStore.ts`
- Modify: `src/stores/moonStore.ts`

- [ ] **Step 1: Update credit economy constants**

In `src/stores/gameStore.ts`, update the credit economy constants (lines 188-197):

```typescript
// Credit economy (10x scale)
export const BASE_CREDITS_PER_TICK = 2.0
export const CREDITS_PER_METAL_MINED = 1.0
export const CREDITS_PER_ICE_FOUND = 20.0
```

- [ ] **Step 2: Update shipment option costs**

Update `SHIPMENT_OPTIONS` array (lines 217-293). Replace all cost values:

```typescript
export const SHIPMENT_OPTIONS: ShipmentOption[] = [
  {
    type: 'supplyCrate',
    label: 'Supply Crate',
    description: '+15 metals, +5 ice',
    cost: 600,
    weight: 20,
  },
  {
    type: 'equipment',
    label: 'Solar Panel',
    description: 'Generates power for the colony',
    cost: 800,
    weight: 18,
    buildingType: 'solar',
  },
  {
    type: 'equipment',
    label: 'O2 Generator',
    description: 'Produces breathable air',
    cost: 1000,
    weight: 32,
    buildingType: 'o2generator',
  },
  {
    type: 'equipment',
    label: 'Extraction Rig',
    description: 'Automated resource extraction',
    cost: 1300,
    weight: 55,
    buildingType: 'extractionrig',
  },
  {
    type: 'equipment',
    label: 'Med Bay',
    description: 'Heals injured crew over time',
    cost: 1500,
    weight: 40,
    buildingType: 'medbay',
  },
  {
    type: 'equipment',
    label: 'Parts Factory',
    description: 'Produces repair kits (requires operator)',
    cost: 800,
    weight: 30,
    buildingType: 'partsfactory',
  },
  {
    type: 'newColonist',
    label: 'New Colonist',
    description: 'Recruit crew member',
    cost: 1750,
    weight: 35,
  },
  {
    type: 'repairKit',
    label: 'Repair Kit',
    description: 'Fix one damaged building',
    cost: 250,
    weight: 5,
  },
  {
    type: 'emergencyO2',
    label: 'Emergency O2',
    description: '+30 air (fast delivery)',
    cost: 350,
    weight: 25,
  },
  {
    type: 'emergencyPower',
    label: 'Emergency Power',
    description: '+30 power (fast delivery)',
    cost: 350,
    weight: 15,
  },
]
```

- [ ] **Step 3: Update starting credits**

In `freshState()` (around line 376-377), update:

```typescript
    credits: 1000,
    totalCreditsEarned: 1000,
```

- [ ] **Step 4: Update outpost establishment cost**

In `src/stores/moonStore.ts`, update:

```typescript
export const OUTPOST_ESTABLISH_COST_CREDITS = 500
```

- [ ] **Step 5: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/stores/gameStore.ts src/stores/moonStore.ts
git commit -m "feat(economy): rebalance prices to 10x scale"
```

---

### Task 2: Economy System Module (HQ Rates)

**Files:**
- Create: `src/systems/economy.ts`

- [ ] **Step 1: Create the economy module**

Create `src/systems/economy.ts`:

```typescript
// ── HQ Rate Bulletin System ──
// HQ sets resource purchase rates. Events shift rates periodically.
// The operator cannot control rates — only react by timing exports.

export interface RateEvent {
  type: string
  multipliers: { metals: number; ice: number; rareMinerals: number }
  message: string
  expiresAt: number // totalPlaytimeMs
}

// Base rates (credits per unit)
const BASE_RATES = {
  metals: 15,
  ice: 40,
  rareMinerals: 100,
}

// Rate event definitions
const RATE_EVENTS = [
  {
    type: 'metalDemand',
    weight: 25,
    multipliers: { metals: 2, ice: 1, rareMinerals: 1 },
    message: 'HQ: Metal reserves low. Premium rates authorized.',
  },
  {
    type: 'iceShortage',
    weight: 25,
    multipliers: { metals: 1, ice: 2, rareMinerals: 1 },
    message: 'HQ: Coolant shortage reported. Ice at premium.',
  },
  {
    type: 'rareMineralRush',
    weight: 15,
    multipliers: { metals: 1, ice: 1, rareMinerals: 2.5 },
    message: 'HQ: Research division requesting rare minerals. Top rates.',
  },
  {
    type: 'supplyGlut',
    weight: 15,
    multipliers: { metals: 1, ice: 1, rareMinerals: 1 }, // one resource set to 0.5 at runtime
    message: 'HQ: {resource} surplus on station. Rates adjusted down.',
  },
  {
    type: 'quarterlyPush',
    weight: 10,
    multipliers: { metals: 1.5, ice: 1.5, rareMinerals: 1.5 },
    message: 'HQ: Quarterly push. All export rates boosted.',
  },
  {
    type: 'normalization',
    weight: 10,
    multipliers: { metals: 1, ice: 1, rareMinerals: 1 },
    message: 'HQ: Market stabilized. Standard rates in effect.',
  },
]

const RATE_EVENT_MIN_INTERVAL_MS = 600_000 // 10 minutes
const RATE_EVENT_MAX_INTERVAL_MS = 900_000 // 15 minutes
const RATE_EVENT_DURATION_MIN_MS = 90_000  // 90 seconds
const RATE_EVENT_DURATION_MAX_MS = 120_000 // 120 seconds

// ── State ──

let activeEvent: RateEvent | null = null
let nextEventAt = 0

export function initEconomy(nowMs: number): void {
  activeEvent = null
  nextEventAt = nowMs + randomBetween(RATE_EVENT_MIN_INTERVAL_MS, RATE_EVENT_MAX_INTERVAL_MS)
}

export function getActiveEvent(): RateEvent | null {
  return activeEvent
}

export function getCurrentRates(nowMs: number): { metals: number; ice: number; rareMinerals: number } {
  if (activeEvent && nowMs < activeEvent.expiresAt) {
    return {
      metals: BASE_RATES.metals * activeEvent.multipliers.metals,
      ice: BASE_RATES.ice * activeEvent.multipliers.ice,
      rareMinerals: BASE_RATES.rareMinerals * activeEvent.multipliers.rareMinerals,
    }
  }
  // Event expired
  if (activeEvent && nowMs >= activeEvent.expiresAt) {
    activeEvent = null
  }
  return { ...BASE_RATES }
}

export function getBaseRates(): { metals: number; ice: number; rareMinerals: number } {
  return { ...BASE_RATES }
}

export function tickEconomy(
  nowMs: number,
  emit: (text: string, severity: 'info' | 'event') => void,
): void {
  // Check if active event expired
  if (activeEvent && nowMs >= activeEvent.expiresAt) {
    activeEvent = null
  }

  // Check if it's time for a new event
  if (nowMs >= nextEventAt && !activeEvent) {
    const event = pickWeightedEvent()
    const duration = randomBetween(RATE_EVENT_DURATION_MIN_MS, RATE_EVENT_DURATION_MAX_MS)

    activeEvent = {
      type: event.type,
      multipliers: { ...event.multipliers },
      message: event.message,
      expiresAt: nowMs + duration,
    }

    // Special handling for supply glut — pick a random resource to halve
    if (event.type === 'supplyGlut') {
      const resources = ['metals', 'ice', 'rareMinerals'] as const
      const target = resources[Math.floor(Math.random() * resources.length)]
      activeEvent.multipliers[target] = 0.5
      const labels: Record<string, string> = { metals: 'Metals', ice: 'Ice', rareMinerals: 'Rare minerals' }
      activeEvent.message = event.message.replace('{resource}', labels[target])
    }

    emit(activeEvent.message, 'event')
    nextEventAt = nowMs + duration + randomBetween(RATE_EVENT_MIN_INTERVAL_MS, RATE_EVENT_MAX_INTERVAL_MS)
  }
}

export function calculatePayoutEstimate(
  cargo: { metals: number; ice: number; rareMinerals: number },
  nowMs: number,
): number {
  const rates = getCurrentRates(nowMs)
  return Math.round(
    cargo.metals * rates.metals +
    cargo.ice * rates.ice +
    cargo.rareMinerals * rates.rareMinerals
  )
}

// Save/restore for persistence
export function getEconomyState(): { activeEvent: RateEvent | null; nextEventAt: number } {
  return { activeEvent, nextEventAt }
}

export function restoreEconomyState(state: { activeEvent: RateEvent | null; nextEventAt: number }): void {
  activeEvent = state.activeEvent
  nextEventAt = state.nextEventAt
}

// ── Helpers ──

function randomBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function pickWeightedEvent(): typeof RATE_EVENTS[number] {
  const totalWeight = RATE_EVENTS.reduce((sum, e) => sum + e.weight, 0)
  let roll = Math.random() * totalWeight
  for (const event of RATE_EVENTS) {
    roll -= event.weight
    if (roll <= 0) return event
  }
  return RATE_EVENTS[0]
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/systems/economy.ts
git commit -m "feat(economy): add HQ rate bulletin system"
```

---

### Task 3: Storage Caps & Silo Building Type

**Files:**
- Modify: `src/stores/gameStore.ts`
- Modify: `src/systems/mapLayout.ts`

- [ ] **Step 1: Add storageSilo building type**

In `src/stores/gameStore.ts`, update `BuildingType` (line 41):

```typescript
export type BuildingType = 'o2generator' | 'solar' | 'extractionrig' | 'medbay' | 'partsfactory' | 'storageSilo' | 'launchplatform'
```

Add storage silo to `BLUEPRINTS` array (after the partsfactory entry):

```typescript
  {
    type: 'storageSilo',
    label: 'Storage Silo',
    description: 'Increases resource storage capacity',
    costMetals: 20,
    costIce: 0,
  },
  {
    type: 'launchplatform',
    label: 'Launch Platform',
    description: 'Export resources to HQ for credits',
    costMetals: 30,
    costIce: 0,
  },
```

- [ ] **Step 2: Add storage constants and cap calculation**

Add after the existing economy constants (around line 197):

```typescript
// Storage caps
const BASE_STORAGE_METALS = 50
const BASE_STORAGE_ICE = 25
const BASE_STORAGE_RARE_MINERALS = 10
const SILO_BONUS_METALS = 100
const SILO_BONUS_ICE = 50
const SILO_BONUS_RARE_MINERALS = 25
const SILO_AUTO_BUILD_THRESHOLD = 0.8 // auto-build when >80% full
```

- [ ] **Step 3: Add storage cap getters**

In the store getters section, add:

```typescript
    storageCap(s): { metals: number; ice: number; rareMinerals: number } {
      const siloCount = s.buildings.filter(b => b.type === 'storageSilo' && !b.damaged).length
      return {
        metals: BASE_STORAGE_METALS + siloCount * SILO_BONUS_METALS,
        ice: BASE_STORAGE_ICE + siloCount * SILO_BONUS_ICE,
        rareMinerals: BASE_STORAGE_RARE_MINERALS + siloCount * SILO_BONUS_RARE_MINERALS,
      }
    },
```

- [ ] **Step 4: Add rareMinerals to ColonyState**

In the `ColonyState` interface (around line 114), add after `ice`:

```typescript
  rareMinerals: number
```

In `freshState()`, add after `ice: STARTING_ICE`:

```typescript
    rareMinerals: 0,
```

- [ ] **Step 5: Add overflow clamping in tick**

In the `tick()` action, after the resource extraction/accumulation block (after metals and ice are incremented), add:

```typescript
      // Clamp resources to storage caps
      const caps = this.storageCap
      if (this.metals > caps.metals) {
        this.metals = caps.metals
      }
      if (this.ice > caps.ice) {
        this.ice = caps.ice
      }
      if (this.rareMinerals > caps.rareMinerals) {
        this.rareMinerals = caps.rareMinerals
      }
```

- [ ] **Step 6: Add silo auto-build in tick**

After the overflow clamping, add:

```typescript
      // Auto-build storage silo when nearing capacity
      const metalPct = caps.metals > 0 ? this.metals / caps.metals : 0
      const icePct = caps.ice > 0 ? this.ice / caps.ice : 0
      if ((metalPct > SILO_AUTO_BUILD_THRESHOLD || icePct > SILO_AUTO_BUILD_THRESHOLD) && this.metals >= 20) {
        // Check if any engineer is available (not already building)
        const hasEngineer = alive.some(c => c.currentAction?.type === 'engineer' || c.currentAction?.type === 'wander' || !c.currentAction)
        if (hasEngineer) {
          this.metals -= 20
          const pos = getBuildingPosition('storageSilo', this.buildings)
          this.buildings.push({ id: uid(), type: 'storageSilo', damaged: false, x: pos.x, y: pos.y, rotation: pos.rotation })
          this.pushMessage('Engineers constructing additional storage.', 'event')
        }
      }
```

- [ ] **Step 7: Update mapLayout.ts**

In `src/systems/mapLayout.ts`, update the extraction zone to include storageSilo (line 10):

```typescript
  { id: 'extraction', x: 50, y: 65, radius: 10, label: 'SEC-D EXTRACT', color: '#0f8', buildingTypes: ['extractionrig', 'storageSilo'] },
```

Update the landing zone to include launchplatform (line 13):

```typescript
  { id: 'landing',  x: 25, y: 50, radius: 7,  label: 'LZ-1',          color: '#f80', buildingTypes: ['launchplatform'] },
```

Add to `ZONE_FOR_BUILDING` (lines 18-24):

```typescript
  storageSilo: 'extraction',
  launchplatform: 'landing',
```

- [ ] **Step 8: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 9: Commit**

```bash
git add src/stores/gameStore.ts src/systems/mapLayout.ts
git commit -m "feat(economy): add storage caps, silo auto-build, and launch platform building types"
```

---

### Task 4: Export Platform State & Data Model

**Files:**
- Modify: `src/stores/gameStore.ts`

- [ ] **Step 1: Add ExportPlatform interface**

After the `SupplyDrop` interface (around line 109), add:

```typescript
export interface ExportPlatform {
  built: boolean
  status: 'docked' | 'in_transit' | 'returning'
  cargo: { metals: number; ice: number; rareMinerals: number }
  capacity: number
  launchTime: number | null
  returnTime: number | null
  estimatedCredits: number | null
  autoLaunch: boolean
  forceLaunched: boolean
  reserves: { metals: number | null; ice: number | null; rareMinerals: number | null }
}
```

- [ ] **Step 2: Add export platform to ColonyState**

In the `ColonyState` interface, add after `offlineEvents`:

```typescript
  exportPlatform: ExportPlatform
```

- [ ] **Step 3: Add export platform constants**

After the storage constants, add:

```typescript
// Export platform
const EXPORT_PLATFORM_BASE_CAPACITY = 100
const EXPORT_TRANSIT_MS = 120_000     // 120s to HQ
const EXPORT_RETURN_MS = 180_000      // 180s return
const EXPORT_FORCE_RETURN_MS = 270_000 // 270s return if force-launched (50% penalty)
const LOAD_UNITS_PER_TRIP = 2
```

- [ ] **Step 4: Add default export platform to freshState**

In `freshState()`, add after `offlineEvents: []`:

```typescript
    exportPlatform: {
      built: false,
      status: 'docked',
      cargo: { metals: 0, ice: 0, rareMinerals: 0 },
      capacity: EXPORT_PLATFORM_BASE_CAPACITY,
      launchTime: null,
      returnTime: null,
      estimatedCredits: null,
      autoLaunch: false,
      forceLaunched: false,
      reserves: { metals: null, ice: null, rareMinerals: null },
    },
```

- [ ] **Step 5: Add export platform getters**

In the getters section, add:

```typescript
    exportPlatformLoaded(s): number {
      const c = s.exportPlatform.cargo
      return c.metals + c.ice + c.rareMinerals
    },

    exportAutoReserves(s): { metals: number; ice: number; rareMinerals: number } {
      // Auto-calculate: parts factory consumption + cheapest building cost
      const factoryCount = s.buildings.filter(b => b.type === 'partsfactory' && !b.damaged).length
      const factoryReserve = factoryCount * PARTS_FACTORY_METAL_COST * 5
      // Reserve enough for a silo (cheapest local build = 20 metals)
      const buildReserve = 20
      return {
        metals: factoryReserve + buildReserve,
        ice: 0,
        rareMinerals: 0,
      }
    },

    effectiveReserves(s): { metals: number; ice: number; rareMinerals: number } {
      const auto = (this as any).exportAutoReserves
      return {
        metals: s.exportPlatform.reserves.metals ?? auto.metals,
        ice: s.exportPlatform.reserves.ice ?? auto.ice,
        rareMinerals: s.exportPlatform.reserves.rareMinerals ?? auto.rareMinerals,
      }
    },
```

- [ ] **Step 6: Add export platform actions**

In the actions section, add:

```typescript
    launchExport(force: boolean = false) {
      const ep = this.exportPlatform
      if (ep.status !== 'docked') return
      if (ep.cargo.metals + ep.cargo.ice + ep.cargo.rareMinerals === 0) return

      ep.status = 'in_transit'
      ep.launchTime = this.totalPlaytimeMs
      ep.forceLaunched = force
      ep.estimatedCredits = null // will be calculated on arrival

      const loaded = ep.cargo.metals + ep.cargo.ice + ep.cargo.rareMinerals
      if (force) {
        this.pushMessage(
          `Emergency export — platform launching at ${loaded}/${ep.capacity} capacity. Extended return time.`,
          'event',
        )
      } else {
        this.pushMessage(
          `Payload en route to HQ — ${ep.cargo.metals} metals, ${ep.cargo.ice} ice. Estimated ${this.estimateExportCredits()}cr at current rates.`,
          'event',
        )
      }
    },

    estimateExportCredits(): number {
      // Inline estimate using current rates — avoids circular import
      // Actual payout calculated in tick when payload arrives
      const c = this.exportPlatform.cargo
      // Use base rates for estimate (actual may differ due to rate events)
      return Math.round(c.metals * 15 + c.ice * 40 + c.rareMinerals * 100)
    },

    setExportReserve(resource: 'metals' | 'ice' | 'rareMinerals', value: number | null) {
      this.exportPlatform.reserves[resource] = value
    },

    toggleAutoLaunch() {
      this.exportPlatform.autoLaunch = !this.exportPlatform.autoLaunch
    },
```

- [ ] **Step 7: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 8: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat(economy): add export platform state, getters, and actions"
```

---

### Task 5: Load Action Type & AI Scoring

**Files:**
- Modify: `src/types/colonist.ts`
- Modify: `src/systems/colonistAI.ts`

- [ ] **Step 1: Add load action type**

In `src/types/colonist.ts`, add `'load'` to `ActionType` (after `'wander'`):

```typescript
export type ActionType =
  | 'extract'
  | 'engineer'
  | 'repair'
  | 'unpack'
  | 'rest'
  | 'socialize'
  | 'seek_medical'
  | 'wander'
  | 'load'
```

- [ ] **Step 2: Add load duration to colonistAI**

In `src/systems/colonistAI.ts`, add `load` to the `DURATION` record (after `wander`):

```typescript
  load:         [8, 15],
```

- [ ] **Step 3: Add load action scoring in selectAction**

In `selectAction`, after the UNPACK block (after the `activeDrops` section), add:

```typescript
  // LOAD — haul resources to export platform
  if (colonist.energy > 20) {
    const ep = state.exportPlatform
    if (ep && ep.built && ep.status === 'docked') {
      const loaded = ep.cargo.metals + ep.cargo.ice + ep.cargo.rareMinerals
      if (loaded < ep.capacity) {
        // Check if there's anything above reserves to load
        const reserves = state.exportPlatform.reserves
        const autoReserves = { metals: 30, ice: 0, rareMinerals: 0 } // rough default
        const effectiveMetals = reserves.metals ?? autoReserves.metals
        const effectiveIce = reserves.ice ?? autoReserves.ice
        const effectiveRare = reserves.rareMinerals ?? autoReserves.rareMinerals
        const hasExportable = state.metals > effectiveMetals || state.ice > effectiveIce || (state as any).rareMinerals > effectiveRare

        if (hasExportable) {
          const loaders = countWorkers(state, 'load')
          // Diminishing returns — 2-3 loaders is plenty
          const loaderDiscount = loaders === 0 ? 1.0 : loaders === 1 ? 0.5 : loaders === 2 ? 0.15 : 0.05
          candidates.push({
            type: 'load',
            targetZone: 'landing',
            score: 40 * mod.workUtilityMult * loaderDiscount,
          })
        }
      }
    }
  }
```

- [ ] **Step 4: Add load to XP tracking**

In `src/systems/colonistIdentity.ts`, the `ACTION_TO_XP_TRACK` does not map `load` — this is correct, loading shouldn't give XP. No change needed.

- [ ] **Step 5: Add load visual state mapping**

In `src/composables/useColonistMovement.ts`, find the `visualState` mapping function. Add load → working:

```typescript
    case 'load': return 'working'
```

- [ ] **Step 6: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/types/colonist.ts src/systems/colonistAI.ts src/composables/useColonistMovement.ts
git commit -m "feat(economy): add load action type with AI scoring"
```

---

### Task 6: Export Platform Tick Logic

**Files:**
- Modify: `src/stores/gameStore.ts`

- [ ] **Step 1: Import economy functions**

Add to imports at top of gameStore.ts:

```typescript
import {
  initEconomy,
  tickEconomy,
  getCurrentRates,
  calculatePayoutEstimate,
  getEconomyState,
  restoreEconomyState,
} from '@/systems/economy'
```

- [ ] **Step 2: Wire economy tick and export platform logic into tick()**

In the `tick()` action, after the bond updates and idle morale drain block, add:

```typescript
      // Economy — HQ rate bulletins
      tickEconomy(this.totalPlaytimeMs, (text, sev) => this.pushMessage(text, sev))

      // Export platform tick
      const ep = this.exportPlatform
      if (ep.built) {
        // Loading — colonists with 'load' action transfer resources
        if (ep.status === 'docked') {
          const loaders = alive.filter(
            c => c.currentAction?.type === 'load' && !c.currentAction?.walkPath?.length
          )
          const reserves = this.effectiveReserves
          for (const _loader of loaders) {
            const loaded = ep.cargo.metals + ep.cargo.ice + ep.cargo.rareMinerals
            if (loaded >= ep.capacity) break

            const space = ep.capacity - loaded
            const toLoad = Math.min(LOAD_UNITS_PER_TRIP, space)
            let remaining = toLoad

            // Load metals first (above reserve), then ice, then rare minerals
            if (remaining > 0 && this.metals > reserves.metals) {
              const take = Math.min(remaining, this.metals - reserves.metals)
              this.metals -= take
              ep.cargo.metals += take
              remaining -= take
            }
            if (remaining > 0 && this.ice > reserves.ice) {
              const take = Math.min(remaining, this.ice - reserves.ice)
              this.ice -= take
              ep.cargo.ice += take
              remaining -= take
            }
            if (remaining > 0 && this.rareMinerals > reserves.rareMinerals) {
              const take = Math.min(remaining, this.rareMinerals - reserves.rareMinerals)
              this.rareMinerals -= take
              ep.cargo.rareMinerals += take
              remaining -= take
            }
          }

          // Auto-launch when full
          const totalLoaded = ep.cargo.metals + ep.cargo.ice + ep.cargo.rareMinerals
          if (ep.autoLaunch && totalLoaded >= ep.capacity) {
            this.launchExport(false)
          }
        }

        // Transit — check if payload arrived at HQ
        if (ep.status === 'in_transit' && ep.launchTime) {
          if (this.totalPlaytimeMs >= ep.launchTime + EXPORT_TRANSIT_MS) {
            // Payload arrived — credit account at current rates
            const rates = getCurrentRates(this.totalPlaytimeMs)
            const payout = Math.round(
              ep.cargo.metals * rates.metals +
              ep.cargo.ice * rates.ice +
              ep.cargo.rareMinerals * rates.rareMinerals
            )
            this.credits += payout
            this.totalCreditsEarned += payout
            this.pushMessage(`HQ confirms receipt. ${payout}cr credited to account.`, 'event')

            // Start return trip
            ep.status = 'returning'
            const returnDuration = ep.forceLaunched ? EXPORT_FORCE_RETURN_MS : EXPORT_RETURN_MS
            ep.returnTime = this.totalPlaytimeMs + returnDuration
            ep.cargo = { metals: 0, ice: 0, rareMinerals: 0 }
          }
        }

        // Returning — check if platform is back
        if (ep.status === 'returning' && ep.returnTime) {
          if (this.totalPlaytimeMs >= ep.returnTime) {
            ep.status = 'docked'
            ep.launchTime = null
            ep.returnTime = null
            ep.forceLaunched = false
            this.pushMessage('Export platform has docked. Ready for loading.', 'event')
          }
        }
      }
```

- [ ] **Step 3: Initialize economy on new game**

In `freshState()`, at the end before the return, or after the store is created, call `initEconomy`. The simplest place: in the `load()` action, after state is loaded/initialized:

Find the `load()` action (around line 1100) and add after the state is set up:

```typescript
      initEconomy(this.totalPlaytimeMs)
```

Also add it in the `else` branch (new game):

```typescript
      initEconomy(0)
```

- [ ] **Step 4: Save/restore economy state**

In the `save()` action, include economy state:

```typescript
      const econState = getEconomyState()
      const saveData = { colony: this.$state, moon: moon.$state, economy: econState }
```

In the `load()` action, restore economy state:

```typescript
      if (parsed.economy) {
        restoreEconomyState(parsed.economy)
      }
```

- [ ] **Step 5: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat(economy): wire export platform and HQ rate ticks into game loop"
```

---

### Task 7: Export Panel UI

**Files:**
- Create: `src/components/ExportPanel.vue`
- Modify: `src/components/CommandConsole.vue`

- [ ] **Step 1: Create ExportPanel component**

Create `src/components/ExportPanel.vue`:

```vue
<template>
  <div class="export-panel">
    <!-- Not built yet -->
    <div v-if="!game.exportPlatform.built" class="not-built">
      <div class="section-label">LAUNCH PLATFORM</div>
      <p class="mono dim">No launch platform constructed.</p>
      <p class="mono dim">Engineers will build one when 30 metals are available.</p>
    </div>

    <!-- Platform status -->
    <template v-else>
      <div class="section-label">LAUNCH PLATFORM</div>

      <!-- HQ Rates -->
      <div class="rates-row mono">
        <span class="rate-label">HQ RATES:</span>
        <span class="rate" :class="{ boosted: rates.metals !== 15 }">
          Metals {{ rates.metals }}cr
        </span>
        <span class="rate" :class="{ boosted: rates.ice !== 40 }">
          Ice {{ rates.ice }}cr
        </span>
        <span class="rate" :class="{ boosted: rates.rareMinerals !== 100 }">
          Rare {{ rates.rareMinerals }}cr
        </span>
      </div>

      <!-- Platform away -->
      <div v-if="game.exportPlatform.status !== 'docked'" class="transit-status mono">
        <span v-if="game.exportPlatform.status === 'in_transit'" class="status-transit">
          EN ROUTE TO HQ — {{ transitEta }}
        </span>
        <span v-else class="status-returning">
          RETURNING — {{ returnEta }}
        </span>
      </div>

      <!-- Docked — show cargo and controls -->
      <template v-if="game.exportPlatform.status === 'docked'">
        <div class="cargo-row mono">
          <span>CARGO: {{ loaded }}/{{ game.exportPlatform.capacity }}</span>
          <span v-if="game.exportPlatform.cargo.metals > 0"> · {{ game.exportPlatform.cargo.metals }}m</span>
          <span v-if="game.exportPlatform.cargo.ice > 0"> · {{ game.exportPlatform.cargo.ice }}i</span>
          <span v-if="game.exportPlatform.cargo.rareMinerals > 0"> · {{ game.exportPlatform.cargo.rareMinerals }}r</span>
        </div>

        <div v-if="loaded > 0" class="estimate mono dim">
          EST. {{ estimate }}cr at current rates
        </div>

        <div class="controls">
          <button
            class="action-btn green"
            :disabled="loaded === 0"
            @click="game.launchExport(false)"
          >
            LAUNCH
          </button>
          <button
            class="action-btn amber"
            :disabled="loaded === 0"
            @click="game.launchExport(true)"
          >
            FORCE LAUNCH
          </button>
          <button
            class="action-btn dim"
            :class="{ active: game.exportPlatform.autoLaunch }"
            @click="game.toggleAutoLaunch()"
          >
            {{ game.exportPlatform.autoLaunch ? 'AUTO ●' : 'AUTO' }}
          </button>
        </div>

        <!-- Reserves -->
        <div class="reserves mono dim">
          <span class="reserve-label">RESERVES:</span>
          <span>M:{{ effectiveReserves.metals }}</span>
          <span>I:{{ effectiveReserves.ice }}</span>
          <span>R:{{ effectiveReserves.rareMinerals }}</span>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { getCurrentRates, calculatePayoutEstimate } from '@/systems/economy'

const game = useGameStore()

const rates = computed(() => getCurrentRates(game.totalPlaytimeMs))

const loaded = computed(() => game.exportPlatformLoaded)

const estimate = computed(() => calculatePayoutEstimate(game.exportPlatform.cargo, game.totalPlaytimeMs))

const effectiveReserves = computed(() => game.effectiveReserves)

const transitEta = computed(() => {
  if (!game.exportPlatform.launchTime) return '--'
  const arrival = game.exportPlatform.launchTime + 120_000
  const remaining = Math.max(0, arrival - game.totalPlaytimeMs)
  return `${Math.ceil(remaining / 1000)}s`
})

const returnEta = computed(() => {
  if (!game.exportPlatform.returnTime) return '--'
  const remaining = Math.max(0, game.exportPlatform.returnTime - game.totalPlaytimeMs)
  return `${Math.ceil(remaining / 1000)}s`
})
</script>

<style scoped>
.export-panel {
  padding: 0.5rem;
}

.section-label {
  font-size: 0.7rem;
  color: var(--amber, #f5a623);
  margin-bottom: 0.5rem;
  letter-spacing: 0.05em;
}

.rates-row {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.rate-label {
  color: var(--dim, #666);
}

.rate {
  color: var(--text, #ccc);
}

.rate.boosted {
  color: var(--green, #4caf50);
  text-shadow: 0 0 4px var(--green, #4caf50);
}

.transit-status {
  font-size: 0.75rem;
  padding: 0.3rem 0;
}

.status-transit {
  color: var(--amber, #f5a623);
}

.status-returning {
  color: var(--dim, #666);
}

.cargo-row {
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}

.estimate {
  font-size: 0.7rem;
  margin-bottom: 0.5rem;
}

.controls {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.reserves {
  font-size: 0.65rem;
  display: flex;
  gap: 0.4rem;
}

.reserve-label {
  color: var(--dim, #666);
}

.not-built {
  opacity: 0.6;
}

.not-built p {
  font-size: 0.75rem;
  margin: 0.25rem 0;
}

.dim {
  opacity: 0.6;
}

.mono {
  font-family: 'JetBrains Mono', monospace;
}

.action-btn {
  font-size: 0.7rem;
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--dim, #444);
  background: transparent;
  color: var(--text, #ccc);
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
}

.action-btn.green {
  border-color: var(--green, #4caf50);
  color: var(--green, #4caf50);
}

.action-btn.amber {
  border-color: var(--amber, #f5a623);
  color: var(--amber, #f5a623);
}

.action-btn.active {
  background: rgba(255, 255, 255, 0.1);
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 2: Add export tab to CommandConsole**

In `src/components/CommandConsole.vue`, add the import:

```typescript
import ExportPanel from '@/components/ExportPanel.vue'
```

Update the tab type and tabs array (around line 274-278):

```typescript
const tab = ref<'log' | 'shipments' | 'directives' | 'export'>('log')

const tabs = [
  { id: 'log' as const, label: 'COMMS' },
  { id: 'shipments' as const, label: 'SHIPMENTS' },
  { id: 'export' as const, label: 'EXPORT' },
  { id: 'directives' as const, label: 'DIRECTIVES' },
]
```

In the template, after the `<DirectivePanel>` line, add:

```html
        <ExportPanel v-if="tab === 'export'" />
```

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/ExportPanel.vue src/components/CommandConsole.vue
git commit -m "feat(economy): add export panel UI with HQ rates, cargo status, and launch controls"
```

---

### Task 8: Radio Chatter — Economy Messages

**Files:**
- Modify: `src/systems/radioChatter.ts`

- [ ] **Step 1: Add economy message templates**

After the existing identity message templates (after the `SPECIALIZATION_UNLOCK` array), add:

```typescript
const LOADING_START: string[] = [
  '{name}: Hauling cargo to the platform.',
  '{name}: Loading up the export platform.',
  '{name}: Moving materials to the LZ.',
]

const STORAGE_FULL: string[] = [
  '{name}: Storage full — we\'re losing metals out here.',
  '{name}: No room for more. We need another silo.',
  '{name}: Overflow — materials going to waste.',
]
```

- [ ] **Step 2: Add load action check-in to generateChatter**

In the `generateChatter` function, in the arrival/start messages block (where `currType` is checked), add after the `seek_medical` case:

```typescript
      } else if (currType === 'load') {
        emitMessage(c.id, now, emit, fill(pick(LOADING_START), { name: c.name }))
```

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/systems/radioChatter.ts
git commit -m "feat(economy): add loading and storage overflow radio chatter"
```

---

### Task 9: Overflow Warning Messages

**Files:**
- Modify: `src/stores/gameStore.ts`

- [ ] **Step 1: Add overflow warning in tick**

In the `tick()` action, update the overflow clamping block to emit warnings:

```typescript
      // Clamp resources to storage caps — warn on overflow
      const caps = this.storageCap
      if (this.metals > caps.metals) {
        if (this.ticksSinceLastReport % 60 === 0) {
          const overflowColonist = alive.find(c => c.currentAction?.type === 'extract')
          const name = overflowColonist?.name ?? 'Colony'
          this.pushMessage(`${name}: Storage full — we're losing metals out here.`, 'warning')
        }
        this.metals = caps.metals
      }
      if (this.ice > caps.ice) {
        if (this.ticksSinceLastReport % 60 === 0) {
          this.pushMessage('Ice storage at capacity. Excess discarded.', 'warning')
        }
        this.ice = caps.ice
      }
      if (this.rareMinerals > caps.rareMinerals) {
        this.rareMinerals = caps.rareMinerals
      }
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat(economy): add storage overflow warnings"
```

---

### Task 10: Offline Engine Updates

**Files:**
- Modify: `src/stores/offlineEngine.ts`

- [ ] **Step 1: Update offline credit constants**

The offline engine imports credit constants from gameStore. Since we changed `BASE_CREDITS_PER_TICK` from 1.0 to 2.0 and `CREDITS_PER_METAL_MINED` from 0.1 to 1.0, the imports will pick up the new values automatically.

Verify these imports exist at top of offlineEngine.ts:

```typescript
  BASE_CREDITS_PER_TICK,
  CREDITS_PER_METAL_MINED,
  CREDITS_PER_ICE_FOUND,
```

If they do, no changes needed for constants.

- [ ] **Step 2: Add rareMinerals handling**

In the offline simulation, ensure `rareMinerals` is handled. In the `simulateOffline` function, add after the ice calculation (where metals and ice are accumulated):

```typescript
    // Rare minerals aren't extracted at colony — only at outposts (handled separately)
```

No actual code needed since colony extraction doesn't produce rare minerals. This is documentation only.

- [ ] **Step 3: Add offline export simulation**

In the main simulation loop (inside the `while` loop), after the auto-relaunch block, add:

```typescript
    // Offline export — if platform was in transit, check arrival
    if (state.exportPlatform?.built) {
      const ep = state.exportPlatform
      if (ep.status === 'in_transit' && ep.launchTime && state.totalPlaytimeMs >= ep.launchTime + 120_000) {
        // Use base rates for offline payouts
        const payout = Math.round(ep.cargo.metals * 15 + ep.cargo.ice * 40 + ep.cargo.rareMinerals * 100)
        state.credits += payout
        state.totalCreditsEarned += payout
        const returnMs = ep.forceLaunched ? 270_000 : 180_000
        ep.status = 'returning'
        ep.returnTime = state.totalPlaytimeMs + returnMs
        ep.cargo = { metals: 0, ice: 0, rareMinerals: 0 }
        events.push({ type: 'shipment', severity: 'info', offsetMs: elapsedSoFar, message: `HQ confirms receipt. ${payout}cr credited.` })
      }
      if (ep.status === 'returning' && ep.returnTime && state.totalPlaytimeMs >= ep.returnTime) {
        ep.status = 'docked'
        ep.launchTime = null
        ep.returnTime = null
        ep.forceLaunched = false
      }
    }

    // Offline storage clamping
    const siloCount = state.buildings.filter(b => b.type === 'storageSilo' && !b.damaged).length
    const offlineCaps = {
      metals: 50 + siloCount * 100,
      ice: 25 + siloCount * 50,
    }
    state.metals = Math.min(state.metals, offlineCaps.metals)
    state.ice = Math.min(state.ice, offlineCaps.ice)
```

- [ ] **Step 4: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/stores/offlineEngine.ts
git commit -m "feat(economy): add offline export simulation and storage capping"
```

---

### Task 11: Save Migration

**Files:**
- Modify: `src/stores/gameStore.ts`

- [ ] **Step 1: Add migration for economy fields**

In `migrateState()`, add after the existing colonist migrations:

```typescript
      // v5→v6: Economy rework
      // Scale existing credits 10x
      if (this.credits < 500 && this.totalCreditsEarned < 500) {
        // Heuristic: if values are small, they're pre-10x
        this.credits = Math.round(this.credits * 10)
        this.totalCreditsEarned = Math.round(this.totalCreditsEarned * 10)
      }

      // Backfill rareMinerals
      if ((this as any).rareMinerals === undefined) (this as any).rareMinerals = 0

      // Backfill export platform
      if (!this.exportPlatform) {
        (this as any).exportPlatform = {
          built: false,
          status: 'docked',
          cargo: { metals: 0, ice: 0, rareMinerals: 0 },
          capacity: 100,
          launchTime: null,
          returnTime: null,
          estimatedCredits: null,
          autoLaunch: false,
          forceLaunched: false,
          reserves: { metals: null, ice: null, rareMinerals: null },
        }
      }

      // Scale saved manifest costs if they look pre-10x
      if (this.lastManifest?.length > 0 && this.lastManifest[0].cost < 100) {
        for (const item of this.lastManifest) {
          item.cost = Math.round(item.cost * 10)
        }
      }
      if (this.manifest?.length > 0 && this.manifest[0].cost < 100) {
        for (const item of this.manifest) {
          item.cost = Math.round(item.cost * 10)
        }
      }
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat(economy): add save migration for 10x pricing and economy fields"
```

---

### Task 12: Launch Platform Auto-Build

**Files:**
- Modify: `src/stores/gameStore.ts`

- [ ] **Step 1: Add launch platform auto-construction**

The launch platform should be buildable like any other building. Add logic in the tick for colonists to auto-build the launch platform when they have enough metals and no platform exists.

In the `tick()` action, after the silo auto-build block, add:

```typescript
      // Auto-build launch platform when metals available and none exists
      if (!this.exportPlatform.built && this.metals >= 30) {
        const hasLaunchPlatform = this.buildings.some(b => b.type === 'launchplatform')
        if (!hasLaunchPlatform) {
          const hasEngineer = alive.some(c => c.currentAction?.type === 'engineer' || c.currentAction?.type === 'wander' || !c.currentAction)
          if (hasEngineer) {
            this.metals -= 30
            const pos = getBuildingPosition('launchplatform', this.buildings)
            this.buildings.push({ id: uid(), type: 'launchplatform', damaged: false, x: pos.x, y: pos.y, rotation: pos.rotation })
            this.exportPlatform.built = true
            this.pushMessage('Engineers have constructed a launch platform at the LZ.', 'event')
          }
        }
      }
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat(economy): add launch platform auto-construction"
```

---

### Task 13: Final Integration Verification

- [ ] **Step 1: Full build check**

Run: `bun run build`
Expected: Build succeeds with no type errors

- [ ] **Step 2: Manual smoke test**

Run: `bun run dev`

Verify in browser:
1. New game starts with 1,000 credits
2. Shipment prices show 10x values (Supply Crate = 600cr)
3. EXPORT tab visible in command console
4. After accumulating 30 metals, launch platform auto-builds
5. Colonists begin loading resources onto platform when above reserves
6. Launch button works — platform goes in transit
7. After 120s, credits arrive from HQ
8. After 180s more, platform returns
9. Storage overflow warning when metals exceed 50 (no silos)
10. Silo auto-builds when storage >80% full
11. HQ rate event fires after 10-15 minutes with radio message

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(economy): address integration issues from smoke testing"
```
