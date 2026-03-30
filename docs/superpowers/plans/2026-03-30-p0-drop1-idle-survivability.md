# P0 Drop 1 — Idle Survivability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game playable by adding pause, fixing hazard rate, surfacing resource info, and clarifying visual indicators.

**Architecture:** Four independent changes to the existing game store, HUD, and map components. Pause adds state + loop guard. Hazard tuning changes constants + adds cooldown. Drain visibility adds getters + HUD lines + a building info overlay. Visual clarity replaces the damage dot with a wrench badge and adds colonist health pips.

**Tech Stack:** Vue 3, Pinia, TypeScript, existing SvgIcon component

---

### Task 1: Pause — Store State & Game Loop

**Files:**
- Modify: `src/stores/gameStore.ts` (ColonyState interface ~line 98, initial state, tick, save)
- Modify: `src/composables/useGameLoop.ts` (tick guard)

- [ ] **Step 1: Add `isPaused` to ColonyState interface**

In `src/stores/gameStore.ts`, add `isPaused` to the `ColonyState` interface (after `gameOverReason`):

```typescript
// In ColonyState interface (~line 118)
gameOver: boolean
gameOverReason: string
isPaused: boolean
```

- [ ] **Step 2: Set default value in initial state**

In the `state()` function of `defineStore`, add:

```typescript
isPaused: false,
```

alongside the other defaults (find `gameOver: false` and add after `gameOverReason`).

- [ ] **Step 3: Add `togglePause` action**

In the `actions` block of `defineStore`, add:

```typescript
togglePause() {
  this.isPaused = !this.isPaused
  if (this.isPaused) {
    this.save()
  }
},
```

- [ ] **Step 4: Guard the tick in useGameLoop**

In `src/composables/useGameLoop.ts`, modify the `setInterval` callback (line 32-37):

```typescript
tickInterval = setInterval(() => {
  if (game.isPaused) return
  game.tick(TICK_MS)
  tickCount++
  if (settings.autoSave && tickCount % SAVE_EVERY_N_TICKS === 0) {
    game.save()
  }
}, TICK_MS / settings.timeMultiplier)
```

- [ ] **Step 5: Skip offline sim when paused**

In `src/composables/useGameLoop.ts`, in `onVisibilityChange` when returning to foreground (line 80), check pause:

```typescript
} else {
  await cancelAllOfflineNotifications()
  if (game.isPaused) {
    startLoop() // restart interval but tick guard prevents execution
  } else {
    handleOfflineResult(game.processOfflineTime())
  }
}
```

- [ ] **Step 6: Note on colonist movement**

`useColonistMovement.ts` watches `game.lastTickAt` (line 252) to trigger visual updates. Since the tick guard prevents `game.tick()` from running, `lastTickAt` never updates, and colonist movement automatically freezes. No changes needed in `useColonistMovement.ts`.

- [ ] **Step 7: Build check**

Run: `bun run build`
Expected: no type errors

- [ ] **Step 8: Commit**

```bash
git add src/stores/gameStore.ts src/composables/useGameLoop.ts
git commit -m "feat: add pause state and game loop guard"
```

---

### Task 2: Pause — UI Components

**Files:**
- Create: `src/components/PauseButton.vue`
- Modify: `src/components/ColonyMap.vue` (add pause button + overlay)

- [ ] **Step 1: Create PauseButton component**

Create `src/components/PauseButton.vue`:

```vue
<template>
  <button class="pause-btn" @click="game.togglePause()" :aria-label="game.isPaused ? 'Resume' : 'Pause'">
    <svg viewBox="0 0 16 16" fill="none" class="pause-icon">
      <template v-if="game.isPaused">
        <path d="M4 2.5L13 8L4 13.5V2.5Z" fill="currentColor" />
      </template>
      <template v-else>
        <rect x="3" y="2" width="3.5" height="12" rx="0.8" fill="currentColor" />
        <rect x="9.5" y="2" width="3.5" height="12" rx="0.8" fill="currentColor" />
      </template>
    </svg>
  </button>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'
const game = useGameStore()
</script>

<style scoped>
.pause-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  z-index: 15;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--accent-muted);
  background: var(--overlay-bg);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.pause-btn:active {
  background: var(--accent-dim);
}

.pause-icon {
  width: 14px;
  height: 14px;
}
</style>
```

- [ ] **Step 2: Add pause button and overlay to ColonyMap**

In `src/components/ColonyMap.vue`, import and add the component. Add import:

```typescript
import PauseButton from './PauseButton.vue'
```

In the template, after `<ResourceHud />` (line 64), add:

```vue
<PauseButton />

<div v-if="game.isPaused" class="pause-overlay">
  <span class="pause-text">PAUSED</span>
</div>
```

Add the pause overlay styles to the `<style scoped>` section:

```css
.pause-overlay {
  position: absolute;
  inset: 0;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

.pause-text {
  font-family: var(--font-mono);
  font-size: 24px;
  color: var(--text-muted);
  letter-spacing: 8px;
  text-transform: uppercase;
  opacity: 0.6;
}
```

- [ ] **Step 3: Build check**

Run: `bun run build`
Expected: no type errors

- [ ] **Step 4: Manual test**

Run `bun run dev`, open browser. Verify:
- Pause button visible bottom-right of map
- Tapping toggles pause icon between bars/triangle
- "PAUSED" overlay appears
- Colonists stop moving, resources stop changing
- Unpausing resumes everything

- [ ] **Step 5: Commit**

```bash
git add src/components/PauseButton.vue src/components/ColonyMap.vue
git commit -m "feat: add pause button and overlay to colony map"
```

---

### Task 3: Hazard Rate Tuning

**Files:**
- Modify: `src/stores/gameStore.ts` (constants ~lines 150-152, ColonyState ~line 98, checkHazards ~line 612)

- [ ] **Step 1: Update hazard constants**

In `src/stores/gameStore.ts`, change the three hazard constants (~lines 150-152):

```typescript
export const HAZARD_CHECK_INTERVAL_MS = 20_000
export const HAZARD_BASE_CHANCE = 0.02
export const HAZARD_DEPTH_SCALE = 0.00001
```

- [ ] **Step 2: Add cooldown constant and state field**

Add new constant near the other hazard constants:

```typescript
export const HAZARD_MIN_GAP_MS = 45_000
```

Add `lastHazardAt` to the `ColonyState` interface (near `lastHazard`):

```typescript
lastHazard: HazardEvent | null
lastHazardAt: number
hazardCooldownUntil: number
```

Set default in state: `lastHazardAt: 0,`

- [ ] **Step 3: Add streak protection to checkHazards**

In the `checkHazards()` action (~line 612), add a gap check at the top, right after the existing cooldown check:

```typescript
checkHazards() {
  if (Date.now() < this.hazardCooldownUntil) return
  const now = Date.now()
  if (now - this.lastHazardAt < HAZARD_MIN_GAP_MS) return
  const mod = DIRECTIVE_MODIFIERS[this.activeDirective]
  // ... rest of existing code
```

Then, right after the hazard cooldown is set (the line `this.hazardCooldownUntil = Date.now() + HAZARD_CHECK_INTERVAL_MS`), add:

```typescript
this.hazardCooldownUntil = Date.now() + HAZARD_CHECK_INTERVAL_MS
this.lastHazardAt = Date.now()
```

- [ ] **Step 4: Build check**

Run: `bun run build`
Expected: no type errors

- [ ] **Step 5: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat: tune hazard rates and add 45s streak protection"
```

---

### Task 4: Resource Drain Visibility — Store Getters

**Files:**
- Modify: `src/stores/gameStore.ts` (getters block, ~line 392)

- [ ] **Step 1: Refactor airRate into production/consumption getters**

In the getters block, replace the existing `airRate` getter (~line 392) with three getters:

```typescript
airProduction(s): number {
  const generators = s.buildings.filter((b) => b.type === 'o2generator' && !b.damaged).length
  const workersAtLifeSup = s.colonists.filter(
    c => c.health > 0 && c.currentAction?.type === 'engineer' && c.currentAction?.targetZone === 'lifeSup' && !c.currentAction?.walkPath?.length
  ).length
  const mod = DIRECTIVE_MODIFIERS[s.activeDirective].prodMult
  const engBonus = (1 + workersAtLifeSup * ENGINEER_EFFICIENCY_BONUS) * mod
  return s.power > 0 ? generators * O2_PRODUCTION_PER_GENERATOR * engBonus : 0
},

airConsumption(s): number {
  const alive = s.colonists.filter((c) => c.health > 0).length
  return alive * AIR_CONSUMPTION_PER_COLONIST
},

airRate(): number {
  return this.airProduction - this.airConsumption
},
```

- [ ] **Step 2: Refactor powerRate into production/consumption getters**

Replace the existing `powerRate` getter (~line 405) with three getters:

```typescript
powerProduction(s): number {
  const solars = s.buildings.filter((b) => b.type === 'solar' && !b.damaged).length
  const workersAtPower = s.colonists.filter(
    c => c.health > 0 && c.currentAction?.type === 'engineer' && c.currentAction?.targetZone === 'power' && !c.currentAction?.walkPath?.length
  ).length
  const mod = DIRECTIVE_MODIFIERS[s.activeDirective].prodMult
  const engBonus = (1 + workersAtPower * ENGINEER_EFFICIENCY_BONUS) * mod
  return solars * POWER_PRODUCTION_PER_SOLAR * engBonus
},

powerConsumption(s): number {
  const activeBuildings = s.buildings.filter((b) => !b.damaged).length
  return activeBuildings * POWER_CONSUMPTION_PER_BUILDING
},

powerRate(): number {
  return this.powerProduction - this.powerConsumption
},
```

- [ ] **Step 3: Add repairKits to ColonyState**

In the `ColonyState` interface, add after `supplyDrops`:

```typescript
repairKits: number
```

Set default in state: `repairKits: 0,`

- [ ] **Step 4: Change repair kit shipment handling to use inventory**

In the `processArrivedShipments` action, find the `repairKit` case (~line 816):

Replace:

```typescript
case 'repairKit': {
  const damaged = this.buildings.find((b) => b.damaged)
  if (damaged) {
    damaged.damaged = false
    const label = BLUEPRINTS.find((b) => b.type === damaged.type)?.label || damaged.type
    this.pushMessage(`${label} repaired with kit.`, 'event')
  } else {
    this.pushMessage('Repair kit deployed. No damaged buildings found.', 'info')
  }
  break
}
```

With:

```typescript
case 'repairKit': {
  this.repairKits++
  this.pushMessage(`Repair kit added to inventory. (${this.repairKits} in stock)`, 'event')
  break
}
```

- [ ] **Step 5: Add colonist-driven repair using inventory**

Currently colonists pick a `repair` action (in `src/systems/colonistAI.ts:257-271`) and walk to the damaged building, but nothing actually fixes it — repairs only happened via the shipment handler (which we just changed to add to inventory). We need to add tick-level logic so colonists at a damaged building consume a kit to fix it.

In `src/stores/gameStore.ts`, in the `tick()` action, find the section that processes colonist actions (after resource calculations, around the health/healing section). Add repair processing:

```typescript
// Colonist repair — consume a kit if a repairer has arrived at target
if (this.repairKits > 0) {
  const repairers = alive.filter(
    (c) => c.currentAction?.type === 'repair' && c.currentAction.targetId && !c.currentAction.walkPath?.length
  )
  for (const repairer of repairers) {
    if (this.repairKits <= 0) break
    const building = this.buildings.find((b) => b.id === repairer.currentAction!.targetId && b.damaged)
    if (building) {
      building.damaged = false
      this.repairKits--
      const label = BLUEPRINTS.find((b) => b.type === building.type)?.label || building.type
      this.pushMessage(`${label} repaired by ${repairer.name}.`, 'event')
      repairer.currentAction = null // re-evaluate next tick
    }
  }
}
```

Also update `src/stores/offlineEngine.ts` line 177 — the offline repair logic also needs to gate on `repairKits`:

```typescript
// In offlineEngine.ts, find the repair section (~line 177)
if (state.repairKits > 0) {
  const damaged = state.buildings.find((b) => b.damaged)
  if (damaged) {
    damaged.damaged = false
    state.repairKits--
  }
}
```

Also update the colonist AI in `src/systems/colonistAI.ts` (~line 258) to only consider repair if kits are available:

```typescript
// REPAIR — only if repair kits in stock
const damaged = state.buildings.filter(b => b.damaged)
if (damaged.length > 0 && (state as any).repairKits > 0) {
```

Note: The `(state as any)` cast may be needed if the AI function receives a plain state object. Check the type of the `state` parameter — if it's `ColonyState`, you can access `repairKits` directly.

- [ ] **Step 6: Build check**

Run: `bun run build`
Expected: no type errors

- [ ] **Step 7: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat: add production/consumption getters and repair kit inventory"
```

---

### Task 5: Resource Drain Visibility — HUD Updates

**Files:**
- Modify: `src/components/ResourceHud.vue`

- [ ] **Step 1: Add breakdown lines to air and power HUD items**

In `src/components/ResourceHud.vue`, update the air HUD item (lines 3-10). Add a breakdown line inside each `hud-stack`:

```vue
<div class="hud-item" :class="{ danger: game.air / game.airMax < 0.2 }">
  <SvgIcon name="air" size="xs" />
  <div class="hud-stack">
    <span class="hud-val mono">{{ fmt(game.air) }}</span>
    <span class="hud-rate mono" :class="rateClass(game.airRate)">{{
      fmtRate(game.airRate)
    }}</span>
    <span class="hud-breakdown mono">+{{ game.airProduction.toFixed(1) }} / -{{ game.airConsumption.toFixed(1) }}</span>
  </div>
</div>
```

Do the same for power:

```vue
<div class="hud-item" :class="{ danger: game.power / game.powerMax < 0.2 }">
  <SvgIcon name="power" size="xs" />
  <div class="hud-stack">
    <span class="hud-val mono">{{ fmt(game.power) }}</span>
    <span class="hud-rate mono" :class="rateClass(game.powerRate)">{{
      fmtRate(game.powerRate)
    }}</span>
    <span class="hud-breakdown mono">+{{ game.powerProduction.toFixed(1) }} / -{{ game.powerConsumption.toFixed(1) }}</span>
  </div>
</div>
```

- [ ] **Step 2: Add repair kit HUD item**

After the ice HUD item and before the depth item, add:

```vue
<div v-if="game.repairKits > 0 || game.buildings.some(b => b.damaged)" class="hud-item repair-kits">
  <SvgIcon name="repair" size="xs" />
  <span class="hud-val mono">{{ game.repairKits }}</span>
</div>
```

- [ ] **Step 3: Add styles**

Add to the `<style scoped>` block:

```css
.hud-breakdown {
  font-size: 7px;
  color: var(--text-muted);
  opacity: 0.7;
}

.hud-item.repair-kits {
  color: var(--amber);
}
```

- [ ] **Step 4: Build check**

Run: `bun run build`
Expected: no type errors

- [ ] **Step 5: Manual test**

Run `bun run dev`. Verify:
- Air and power show breakdown line below rate (e.g., "+4.0 / -1.3")
- Repair kit count shows when you have kits or a building is damaged
- Wrench icon displays next to the count

- [ ] **Step 6: Commit**

```bash
git add src/components/ResourceHud.vue
git commit -m "feat: add resource breakdown and repair kit count to HUD"
```

---

### Task 6: Resource Drain Visibility — Building Info Overlay

**Files:**
- Create: `src/components/BuildingInfo.vue`
- Modify: `src/components/MapBuilding.vue` (add click handler)
- Modify: `src/components/ColonyMap.vue` (manage selected building state)

- [ ] **Step 1: Create BuildingInfo component**

Create `src/components/BuildingInfo.vue`:

```vue
<template>
  <div class="building-info" :style="{ left: x + '%', top: (y - 8) + '%' }">
    <div class="info-header">{{ label }}</div>
    <div class="info-row">
      <span class="info-label">Status</span>
      <span :class="building.damaged ? 'status-bad' : 'status-ok'">
        {{ building.damaged ? 'DAMAGED' : 'Operational' }}
      </span>
    </div>
    <div v-if="production" class="info-row">
      <span class="info-label">Output</span>
      <span class="rate-pos">+{{ production }}/s</span>
    </div>
    <div v-if="consumption" class="info-row">
      <span class="info-label">Draw</span>
      <span class="rate-neg">-{{ consumption }}/s</span>
    </div>
    <div class="info-row">
      <span class="info-label">Workers</span>
      <span>{{ workerCount }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  type Building,
  BLUEPRINTS,
  POWER_PRODUCTION_PER_SOLAR,
  O2_PRODUCTION_PER_GENERATOR,
  POWER_CONSUMPTION_PER_BUILDING,
  useGameStore,
} from '@/stores/gameStore'

const props = defineProps<{
  building: Building
  x: number
  y: number
}>()

const game = useGameStore()

const label = computed(() => {
  const bp = BLUEPRINTS.find((b) => b.type === props.building.type)
  const index = game.buildings
    .filter((b) => b.type === props.building.type)
    .findIndex((b) => b.id === props.building.id)
  return `${bp?.label ?? props.building.type} #${index + 1}`
})

const production = computed(() => {
  if (props.building.damaged) return null
  if (props.building.type === 'solar') return POWER_PRODUCTION_PER_SOLAR.toFixed(1)
  if (props.building.type === 'o2generator') return O2_PRODUCTION_PER_GENERATOR.toFixed(1)
  return null
})

const consumption = computed(() => {
  if (props.building.damaged) return null
  return POWER_CONSUMPTION_PER_BUILDING.toFixed(1)
})

const workerCount = computed(() => {
  const zone = props.building.type === 'solar' ? 'power'
    : props.building.type === 'o2generator' ? 'lifeSup'
    : props.building.type === 'drillrig' ? 'drillSite'
    : props.building.type === 'medbay' ? 'medical'
    : null
  if (!zone) return 0
  // Count colonists working in this zone (approximate — zone-level, not building-level)
  return game.colonists.filter(
    (c) => c.health > 0 && c.currentAction?.targetZone === zone && !c.currentAction?.walkPath?.length
  ).length
})
</script>

<style scoped>
.building-info {
  position: absolute;
  transform: translate(-50%, -100%);
  z-index: 20;
  background: var(--overlay-bg);
  border: 1px solid var(--accent-muted);
  border-radius: 6px;
  padding: 6px 8px;
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-secondary);
  pointer-events: none;
  min-width: 100px;
}

.info-header {
  font-size: 10px;
  color: var(--text-primary);
  margin-bottom: 4px;
  border-bottom: 1px solid var(--accent-dim);
  padding-bottom: 3px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  line-height: 1.6;
}

.info-label {
  color: var(--text-muted);
}

.status-ok {
  color: var(--green);
}

.status-bad {
  color: var(--red);
}

.rate-pos {
  color: var(--green);
}

.rate-neg {
  color: var(--amber);
}
</style>
```

- [ ] **Step 2: Add click handler to MapBuilding**

In `src/components/MapBuilding.vue`, change `pointer-events: none` to `pointer-events: auto` on the `.map-building` class (line 42), and add a click emit:

Update the script:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Building } from '@/stores/gameStore'
import SvgIcon from './SvgIcon.vue'

const props = defineProps<{ building: Building }>()
const emit = defineEmits<{ select: [building: Building] }>()

const iconName = computed(() => {
  const map: Record<string, string> = {
    o2generator: 'o2generator',
    solar: 'solar',
    drillrig: 'drillrig',
    medbay: 'medbay',
  }
  return map[props.building.type] || 'shipment'
})

const typeClass = computed(() => `type-${props.building.type}`)
</script>
```

Add click handler to the template root div:

```vue
<div
  class="map-building"
  :class="[typeClass, { damaged: building.damaged }]"
  :style="{ left: building.x + '%', top: building.y + '%', transform: `translate(-50%, -50%) scale(var(--marker-scale, 1)) rotate(${building.rotation || 0}deg)` }"
  @click.stop="emit('select', building)"
>
```

Change the CSS:

```css
.map-building {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: auto;
  cursor: pointer;
  z-index: 2;
}
```

- [ ] **Step 3: Wire building selection in ColonyMap**

In `src/components/ColonyMap.vue`, add imports and state:

```typescript
import { ref } from 'vue'
import BuildingInfo from './BuildingInfo.vue'
import type { Building } from '@/stores/gameStore'

const selectedBuilding = ref<Building | null>(null)

function selectBuilding(b: Building) {
  selectedBuilding.value = selectedBuilding.value?.id === b.id ? null : b
}
```

Update the `MapBuilding` usage in the template (line 49):

```vue
<MapBuilding
  v-for="b in game.buildings"
  :key="b.id"
  :building="b"
  @select="selectBuilding"
/>
```

Add the `BuildingInfo` component after the MapBuilding loop:

```vue
<BuildingInfo
  v-if="selectedBuilding"
  :building="selectedBuilding"
  :x="selectedBuilding.x"
  :y="selectedBuilding.y"
/>
```

Add a click handler on the map container to dismiss the info panel. On the root div (line 2), add:

```vue
@click="selectedBuilding = null"
```

- [ ] **Step 4: Build check**

Run: `bun run build`
Expected: no type errors

- [ ] **Step 5: Manual test**

Run `bun run dev`. Verify:
- Tapping a building shows info overlay above it
- Shows name, status, production, consumption, worker count
- Tapping same building dismisses it
- Tapping elsewhere dismisses it
- Damaged buildings show "DAMAGED" in red

- [ ] **Step 6: Commit**

```bash
git add src/components/BuildingInfo.vue src/components/MapBuilding.vue src/components/ColonyMap.vue
git commit -m "feat: add tap-to-inspect building info overlay"
```

---

### Task 7: Visual Indicator Clarity — Building Damage

**Files:**
- Modify: `src/components/MapBuilding.vue` (replace dot with wrench badge)

- [ ] **Step 1: Replace damage indicator in template**

In `src/components/MapBuilding.vue`, replace the `dmg-indicator` div (line 11):

```vue
<div v-if="building.damaged" class="dmg-badge">
  <SvgIcon name="repair" size="xs" />
</div>
```

- [ ] **Step 2: Replace damage indicator styles**

Remove the `.dmg-indicator` CSS block (lines 97-107) and replace with:

```css
.dmg-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: var(--red);
  color: var(--bg-deep, #1a1a2e);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 6px var(--red);
  animation: feed-blink 1s ease-in-out infinite;
}

.dmg-badge .svg-icon {
  width: 10px;
  height: 10px;
}
```

Keep the `feed-blink` keyframes and the `dmg-pulse` animation — those still apply to the building sprite glow.

- [ ] **Step 3: Build check**

Run: `bun run build`
Expected: no type errors

- [ ] **Step 4: Manual test**

Run `bun run dev`. Wait for a meteor hazard or manually damage a building. Verify:
- Wrench icon in a red square badge appears at top-right of damaged building
- Red glow on the building sprite still pulses
- No more red dot

- [ ] **Step 5: Commit**

```bash
git add src/components/MapBuilding.vue
git commit -m "feat: replace damage dot with wrench badge indicator"
```

---

### Task 8: Visual Indicator Clarity — Colonist Health Pip

**Files:**
- Modify: `src/components/MapColonist.vue`
- Modify: `src/stores/gameStore.ts` (add threshold constant)

- [ ] **Step 1: Add health threshold constant**

In `src/stores/gameStore.ts`, near the other colonist-related constants (around line 147):

```typescript
export const COLONIST_INJURY_VISIBLE_THRESHOLD = 0.7
```

- [ ] **Step 2: Add health pip to MapColonist template**

In `src/components/MapColonist.vue`, add the health pip after the `colonist-dot` div (line 11):

```vue
<div class="colonist-dot" />
<div
  v-if="colonist.health > 0 && colonist.health < injuryThreshold"
  class="health-pip"
>
  <div class="health-fill" :style="{ width: healthPct + '%' }" />
</div>
```

- [ ] **Step 3: Add health pip logic to script**

In the `<script setup>`, import the constant and add computed properties:

```typescript
import { COLONIST_INJURY_VISIBLE_THRESHOLD } from '@/stores/gameStore'

const injuryThreshold = COLONIST_INJURY_VISIBLE_THRESHOLD * 100

const healthPct = computed(() => colonist.health)
```

Wait — colonist health is 0-100 based on the store. Let me check:

Actually, `colonist.health` is already 0-100 in the store. So the threshold should be compared as `colonist.health < 70`:

```typescript
const injuryThreshold = COLONIST_INJURY_VISIBLE_THRESHOLD * 100

const healthPct = computed(() => props.colonist.health)
```

And in the template: `v-if="colonist.health > 0 && colonist.health < injuryThreshold"`

- [ ] **Step 4: Add health pip styles**

Add to the `<style scoped>` block:

```css
.health-pip {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 2px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 1px;
  overflow: hidden;
}

.health-fill {
  height: 100%;
  background: #ff9f43;
  border-radius: 1px;
  transition: width 0.3s;
}
```

- [ ] **Step 5: Build check**

Run: `bun run build`
Expected: no type errors

- [ ] **Step 6: Manual test**

Run `bun run dev`. Wait for colonists to take health damage (hazards, low resources). Verify:
- Orange health bar appears below injured colonists (health < 70)
- Bar width reflects health percentage
- Bar disappears when health recovers above 70
- Dead colonists don't show the pip
- Distinct from building damage (orange vs red, different shape)

- [ ] **Step 7: Commit**

```bash
git add src/components/MapColonist.vue src/stores/gameStore.ts
git commit -m "feat: add orange health pip for injured colonists"
```

---

### Task 9: Final Build & Verification

**Files:** None (verification only)

- [ ] **Step 1: Full build check**

Run: `bun run build`
Expected: clean build, no errors

- [ ] **Step 2: Full manual test**

Run `bun run dev` and verify all four features together:
- Pause button works, "PAUSED" overlay shows, everything freezes
- Hazards feel less frequent, no back-to-back streaks
- HUD shows air/power breakdown and repair kit count
- Tapping buildings shows info overlay
- Damaged buildings show wrench badge
- Injured colonists show orange health pip
- Save/load preserves pause state, repair kit count, lastHazardAt

- [ ] **Step 3: Commit any fixes**

If any issues found, fix and commit individually.
