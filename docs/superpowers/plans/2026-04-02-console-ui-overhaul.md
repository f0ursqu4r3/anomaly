# Console UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the command console as the primary game surface — resource header, 3-tab layout, row-based shipment catalog, merged Operations tab, context status bar, Operator's Manual modal, and tappable colonist names in comms.

**Architecture:** The console half becomes the full game interface. ResourceHud moves from a map overlay into a persistent console header. Export and Directives merge into an Operations tab with accordion platform management. The map simplifies to a clean satellite feed with minimal chrome. A new Operator's Manual modal provides in-fiction item documentation.

**Tech Stack:** Vue 3 + Pinia + TypeScript. No new dependencies.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/components/GameView.vue` | 50/50 grid split (was 55/45) |
| `src/components/CommandConsole.vue` | Console shell: resource header, 3 tabs, context status bar |
| `src/components/ResourceHeader.vue` | **New.** Persistent resource display strip above tabs |
| `src/components/ShipmentPanel.vue` | Row-based catalog, manifest, in-transit |
| `src/components/OperationsPanel.vue` | **New.** Directives + launch platform accordion |
| `src/components/MessageLog.vue` | Tappable colonist names, message type color coding |
| `src/components/ColonyMap.vue` | Remove ResourceHud, add edge stats + settings gear |
| `src/components/ColonistTracker.vue` | **New.** Map overlay that follows a tracked colonist |
| `src/components/OperatorsManual.vue` | **New.** Modal with categorized item/system entries |
| `src/stores/gameStore.ts` | Add `abbrevStat` to ShipmentOption, add `trackedColonistId` state |
| `src/config/buildings.ts` | Add `abbrevStat` to BuildingConfig |
| `src/assets/main.css` | No changes needed (component styles are scoped) |

Files removed from active use: `ExportPanel.vue`, `DirectivePanel.vue`, `ResourceHud.vue` (functionality absorbed into new components). Delete after all tasks complete.

---

### Task 1: Update Grid Split to 50/50

**Files:**
- Modify: `src/components/GameView.vue:28-92`

- [ ] **Step 1: Update portrait grid split**

In `src/components/GameView.vue`, change the grid template from 55fr/45fr to 50fr/50fr:

```vue
/* In <style scoped> */
.game-view {
  height: 100%;
  display: grid;
  grid-template-rows: 50fr 50fr;
}
```

- [ ] **Step 2: Update landscape grid split**

In the same file's media query, update the landscape columns:

```css
@media (orientation: landscape), (min-width: 768px) {
  .game-view {
    grid-template-rows: none;
    grid-template-columns: 50fr 50fr;
  }
}
```

- [ ] **Step 3: Verify visually**

Run: `bun run dev`
Confirm: Map and console are equal halves in both portrait and landscape.

- [ ] **Step 4: Commit**

```bash
git add src/components/GameView.vue
git commit -m "style: update game layout to 50/50 split"
```

---

### Task 2: Create ResourceHeader Component

**Files:**
- Create: `src/components/ResourceHeader.vue`
- Modify: `src/components/ResourceHud.vue` (reference for data logic)

- [ ] **Step 1: Create ResourceHeader.vue**

This component extracts the resource display logic from `ResourceHud.vue` (lines 45-68 for script, lines 1-42 for template) but renders as a horizontal strip designed for the console, not a map overlay.

```vue
<template>
  <div class="resource-header">
    <div class="res-item">
      <span class="res-icon"><SvgIcon name="power" size="xs" /></span>
      <span class="res-val mono" :class="rateClass(game.powerRate)">
        {{ fmt(game.power) }}<span class="res-rate">{{ fmtRate(game.powerRate) }}</span>
      </span>
    </div>
    <div class="res-item">
      <span class="res-icon"><SvgIcon name="air" size="xs" /></span>
      <span class="res-val mono" :class="rateClass(game.airRate)">
        {{ fmt(game.air) }}<span class="res-rate">{{ fmtRate(game.airRate) }}</span>
      </span>
    </div>
    <div class="res-item">
      <span class="res-icon"><SvgIcon name="metals" size="xs" /></span>
      <span class="res-val mono">{{ fmt(game.metals) }}</span>
    </div>
    <div class="res-item">
      <span class="res-icon"><SvgIcon name="ice" size="xs" /></span>
      <span class="res-val mono">{{ fmt(game.ice) }}</span>
    </div>
    <div class="res-item">
      <span class="res-icon"><SvgIcon name="rare" size="xs" /></span>
      <span class="res-val mono">{{ fmt(game.rareMinerals) }}</span>
    </div>
    <div v-if="game.repairKits > 0" class="res-item">
      <span class="res-icon"><SvgIcon name="repair" size="xs" /></span>
      <span class="res-val mono">{{ game.repairKits }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'
import SvgIcon from './SvgIcon.vue'

const game = useGameStore()

function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  if (n >= 100) return Math.floor(n).toString()
  return n.toFixed(1)
}

function fmtRate(n: number): string {
  if (Math.abs(n) < 0.05) return ''
  return (n > 0 ? '+' : '') + n.toFixed(1)
}

function rateClass(n: number): string {
  if (n < -0.5) return 'danger'
  if (n > 0.5) return 'rate-pos'
  return ''
}
</script>

<style scoped>
.resource-header {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 6px 8px;
  background: var(--bg-deep);
  border-bottom: 1px solid var(--accent-muted);
  flex-shrink: 0;
}

.res-item {
  display: flex;
  align-items: center;
  gap: 3px;
}

.res-icon {
  color: var(--text-muted);
  display: flex;
}

.res-val {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.res-rate {
  font-size: 0.625rem;
  font-weight: 400;
  color: var(--text-secondary);
  margin-left: 2px;
}

.res-val.danger {
  color: var(--red);
}

.res-val.danger .res-rate {
  color: var(--red);
}

.res-val.rate-pos .res-rate {
  color: var(--green);
}
</style>
```

- [ ] **Step 2: Verify it renders standalone**

Temporarily import into `CommandConsole.vue` above the tabs to check it renders. We'll wire it in properly in Task 4.

- [ ] **Step 3: Commit**

```bash
git add src/components/ResourceHeader.vue
git commit -m "feat: create ResourceHeader component for console"
```

---

### Task 3: Add abbrevStat to Shipment Options

**Files:**
- Modify: `src/config/buildings.ts:3-13`
- Modify: `src/stores/gameStore.ts:85-90, 269-317`

- [ ] **Step 1: Add abbrevStat to BuildingConfig**

In `src/config/buildings.ts`, add `abbrevStat` to the interface:

```typescript
export interface BuildingConfig {
  type: BuildingType
  label: string
  description: string
  zone: string
  constructionTime: number // seconds
  costMetals: number
  costIce: number
  shipmentCost: number | null // null = colony-built, not orderable from HQ
  shipmentWeight: number | null
  abbrevStat: string // short stat hint for catalog row
}
```

- [ ] **Step 2: Add abbrevStat to each building config**

In `src/config/buildings.ts`, add `abbrevStat` to each entry in `BUILDING_CONFIGS`:

```typescript
// solar (line ~17):
abbrevStat: '+4 pwr',

// o2generator (line ~28):
abbrevStat: '+2 O2',

// extractionrig (line ~39):
abbrevStat: '+extract',

// medbay (line ~50):
abbrevStat: 'heals',

// partsfactory (line ~61):
abbrevStat: '+repairs',

// storageSilo (line ~72):
abbrevStat: '+storage',

// launchplatform (line ~83):
abbrevStat: 'exports',
```

- [ ] **Step 3: Add abbrevStat to ShipmentOption interface**

In `src/stores/gameStore.ts`, add `abbrevStat` to the `ShipmentOption` interface (line ~85):

```typescript
export interface ShipmentOption {
  type: ShipmentType
  label: string
  description: string
  cost: number
  weight: number // cargo weight units
  abbrevStat: string // short stat for catalog row
  buildingType?: BuildingType
}
```

- [ ] **Step 4: Update EQUIPMENT_SHIPMENTS derivation**

In `src/stores/gameStore.ts`, update the `EQUIPMENT_SHIPMENTS` mapping (line ~269) to include `abbrevStat`:

```typescript
const EQUIPMENT_SHIPMENTS: ShipmentOption[] = BUILDING_CONFIGS
  .filter(c => c.shipmentCost !== null)
  .map(c => ({
    type: 'equipment' as ShipmentType,
    label: c.label,
    description: c.description,
    cost: c.shipmentCost!,
    weight: c.shipmentWeight!,
    abbrevStat: c.abbrevStat,
    buildingType: c.type,
  }))
```

- [ ] **Step 5: Add abbrevStat to non-equipment SHIPMENT_OPTIONS**

In `src/stores/gameStore.ts`, update the inline entries in `SHIPMENT_OPTIONS` (line ~280):

```typescript
export const SHIPMENT_OPTIONS: ShipmentOption[] = [
  {
    type: 'supplyCrate',
    label: 'Supply Crate',
    description: '+15 metals, +5 ice',
    cost: 600,
    weight: 20,
    abbrevStat: '+15m +5i',
  },
  ...EQUIPMENT_SHIPMENTS,
  {
    type: 'newColonist',
    label: 'New Colonist',
    description: 'Recruit crew member',
    cost: 1750,
    weight: 35,
    abbrevStat: '+1 crew',
  },
  {
    type: 'repairKit',
    label: 'Repair Kit',
    description: 'Fix one damaged building',
    cost: 250,
    weight: 5,
    abbrevStat: 'fix 1',
  },
  {
    type: 'emergencyO2',
    label: 'Emergency O2',
    description: '+30 air (fast delivery)',
    cost: 350,
    weight: 25,
    abbrevStat: '+30 O2',
  },
  {
    type: 'emergencyPower',
    label: 'Emergency Power',
    description: '+30 power (fast delivery)',
    cost: 350,
    weight: 15,
    abbrevStat: '+30 pwr',
  },
]
```

- [ ] **Step 6: Verify build**

Run: `bun run build`
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add src/config/buildings.ts src/stores/gameStore.ts
git commit -m "feat: add abbrevStat to shipment options for catalog rows"
```

---

### Task 4: Restructure CommandConsole (Resource Header + 3 Tabs + Context Status Bar)

**Files:**
- Modify: `src/components/CommandConsole.vue:1-22, 226-251, 254-298, 443-500`

- [ ] **Step 1: Update imports and tab type**

In `src/components/CommandConsole.vue` script section, replace DirectivePanel and ExportPanel imports with the new components:

```typescript
// Remove these imports:
// import DirectivePanel from './DirectivePanel.vue'
// import ExportPanel from './ExportPanel.vue'

// Add these imports:
import ResourceHeader from './ResourceHeader.vue'
import OperationsPanel from './OperationsPanel.vue'
```

- [ ] **Step 2: Update tab definition**

Replace the `tab` ref and `tabs` computed (lines 276-288):

```typescript
const tab = ref<'log' | 'shipments' | 'ops'>('log')

const tabs = computed(() => {
  const t: { id: 'log' | 'shipments' | 'ops'; label: string }[] = [
    { id: 'log', label: 'COMMS' },
    { id: 'shipments', label: 'SHIPMENTS' },
    { id: 'ops', label: 'OPS' },
  ]
  return t
})
```

- [ ] **Step 3: Update close-lens template**

Replace the close-lens template block (lines 4-22):

```vue
<template v-if="lens === 'close'">
  <ResourceHeader />
  <div class="console-tabs">
    <button
      v-for="t in tabs"
      :key="t.id"
      class="tab-btn"
      :class="{ active: tab === t.id }"
      @click="tab = t.id"
    >
      {{ t.label }}
    </button>
  </div>
  <div class="console-content">
    <MessageLog v-if="tab === 'log'" />
    <ShipmentPanel v-if="tab === 'shipments'" />
    <OperationsPanel v-if="tab === 'ops'" />
  </div>
</template>
```

- [ ] **Step 4: Update status bar to be context-sensitive**

Replace the status bar template (lines 226-250):

```vue
<div class="console-statusbar">
  <span class="status-item">
    <span class="status-label">CREDITS</span>
    <span class="status-val mono credits">
      <SvgIcon name="credits" size="xs" />${{ fmtCredits(game.credits) }}
    </span>
  </span>
  <span class="status-item">
    <span class="status-label">INCOME</span>
    <span class="status-val mono">+${{ game.creditRate.toFixed(1) }}/s</span>
  </span>

  <!-- Context-sensitive right side -->
  <template v-if="lens === 'close'">
    <template v-if="tab === 'log'">
      <span class="status-item">
        <span class="status-label">CREW</span>
        <span class="status-val mono">{{ game.aliveColonists.length }}/{{ game.colonists.length }}</span>
      </span>
      <span class="status-item">
        <span class="status-label">DEPTH</span>
        <span class="status-val mono">{{ game.depth }}m</span>
      </span>
    </template>
    <template v-else-if="tab === 'shipments'">
      <span class="status-item">
        <span class="status-label">WEIGHT</span>
        <span class="status-val mono">{{ game.manifestWeight }}/{{ CARGO_CAPACITY }}kg</span>
      </span>
      <span class="status-item">
        <span class="status-label">COST</span>
        <span class="status-val mono">{{ game.manifestCost }}cr</span>
      </span>
    </template>
    <template v-else-if="tab === 'ops'">
      <span class="status-item">
        <span class="status-label">MODE</span>
        <span class="status-val mono directive-badge">{{ directiveShort }}</span>
      </span>
      <span class="status-item">
        <span class="status-label">PLATFORMS</span>
        <span class="status-val mono">{{ game.operationalPlatforms.length }}</span>
      </span>
    </template>
  </template>

  <!-- Moon lens keeps existing crew/mode display -->
  <template v-else>
    <span class="status-item">
      <span class="status-label">CREW</span>
      <span class="status-val mono">
        <SvgIcon name="crew" size="xs" />{{ game.aliveColonists.length }}/{{ game.colonists.length }}
      </span>
    </span>
    <span class="status-item">
      <span class="status-label">MODE</span>
      <span class="status-val mono directive-badge">{{ directiveShort }}</span>
    </span>
  </template>

  <button class="manual-btn" @click="showManual = true" title="Operator's Manual">&#x1F4D6;</button>
</div>
```

- [ ] **Step 5: Add manual state and CARGO_CAPACITY import**

In the script section, add:

```typescript
import { CARGO_CAPACITY } from '@/stores/gameStore'

const showManual = ref(false)
```

Remove the settings button emit from the status bar (it moves to the map). Keep the `defineEmits<{ openSettings: [] }>()` for now — the map will use it via a different path.

- [ ] **Step 6: Remove the settings-btn styles, add manual-btn styles**

In the `<style scoped>` section, replace `.settings-btn` styles with:

```css
.manual-btn {
  background: transparent;
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 0.875rem;
  padding: 4px 8px;
  cursor: pointer;
  min-height: 36px;
  display: flex;
  align-items: center;
}

.manual-btn:active {
  background: var(--bg-elevated);
}
```

- [ ] **Step 7: Verify build**

Run: `bun run build`
Expected: May fail if OperationsPanel doesn't exist yet. That's expected — we create it next. Verify no other type errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/CommandConsole.vue
git commit -m "feat: restructure console with resource header, 3 tabs, context status bar"
```

---

### Task 5: Create OperationsPanel Component

**Files:**
- Create: `src/components/OperationsPanel.vue`
- Reference: `src/components/DirectivePanel.vue` (lines 1-137), `src/components/ExportPanel.vue` (lines 1-405)

- [ ] **Step 1: Create OperationsPanel.vue**

This merges DirectivePanel and ExportPanel into one component with directives at top and platform accordion below.

```vue
<template>
  <div class="operations-panel">
    <!-- Directives section -->
    <div class="section-label">DIRECTIVES</div>
    <div class="directive-list">
      <button
        v-for="d in directives"
        :key="d.value"
        class="directive-row"
        :class="{ active: game.activeDirective === d.value }"
        @click="game.setDirective(d.value)"
      >
        <SvgIcon :name="d.icon" size="sm" />
        <span class="dir-name">{{ d.label }}</span>
        <span class="dir-toggle">{{ game.activeDirective === d.value ? 'ACTIVE' : 'OFF' }}</span>
      </button>
    </div>

    <!-- Launch Platforms section -->
    <div class="section-label platforms-label">
      LAUNCH PLATFORMS
      <span v-if="platforms.length > 0" class="count-badge">{{ platforms.length }}</span>
    </div>

    <div v-if="platforms.length === 0" class="empty-state">
      No launch platforms built. Order one from Shipments.
    </div>

    <!-- HQ Rates (only shown when platforms exist) -->
    <div v-if="platforms.length > 0" class="rates-row">
      <span class="rate-label">HQ RATES</span>
      <span class="rate" :class="{ boosted: rates.metals !== 15 }">M {{ rates.metals }}cr</span>
      <span class="rate" :class="{ boosted: rates.ice !== 40 }">I {{ rates.ice }}cr</span>
      <span class="rate" :class="{ boosted: rates.rareMinerals !== 100 }">R {{ rates.rareMinerals }}cr</span>
    </div>

    <!-- Platform accordion -->
    <div v-for="platform in platforms" :key="platform.id" class="platform-row">
      <button class="platform-header" @click="togglePlatform(platform.id)">
        <span class="status-dot" :class="statusClass(platform)" />
        <span class="platform-name">{{ platformLabel(platform) }}</span>
        <span class="platform-cargo mono">{{ loaded(platform) }}/{{ getState(platform)?.capacity ?? 100 }}</span>
        <span class="platform-state" :class="statusClass(platform)">{{ statusLabel(platform) }}</span>
        <span class="expand-arrow">{{ expandedId === platform.id ? '&#x25BE;' : '&#x25B8;' }}</span>
      </button>

      <div v-if="expandedId === platform.id" class="platform-detail">
        <div v-if="getState(platform)?.status === 'docked'" class="detail-content">
          <div class="cargo-section">
            <div class="capacity-bar-bg">
              <div
                class="capacity-bar-fill"
                :class="{ full: loaded(platform) >= (getState(platform)?.capacity ?? 100) }"
                :style="{ width: (loaded(platform) / (getState(platform)?.capacity ?? 100)) * 100 + '%' }"
              />
            </div>
            <div v-if="loaded(platform) > 0" class="cargo-breakdown">
              <span v-if="getState(platform)!.cargo.metals > 0" class="cargo-item">{{ getState(platform)!.cargo.metals }}m</span>
              <span v-if="getState(platform)!.cargo.ice > 0" class="cargo-item">{{ getState(platform)!.cargo.ice }}i</span>
              <span v-if="getState(platform)!.cargo.rareMinerals > 0" class="cargo-item">{{ getState(platform)!.cargo.rareMinerals }}r</span>
              <span class="cargo-estimate">~{{ estimate(platform) }}cr</span>
            </div>
          </div>
          <div class="controls">
            <button class="action-btn green" :disabled="loaded(platform) === 0" @click="game.launchExport(platform.id, false)">LAUNCH</button>
            <button class="action-btn amber" :disabled="loaded(platform) === 0" @click="game.launchExport(platform.id, true)">FORCE</button>
            <button class="action-btn" :class="{ active: getState(platform)?.autoLaunch }" @click="game.toggleAutoLaunch(platform.id)">
              {{ getState(platform)?.autoLaunch ? 'AUTO ON' : 'AUTO' }}
            </button>
          </div>
        </div>
        <div v-else class="detail-content">
          <span v-if="getState(platform)?.status === 'in_transit'" class="transit-eta">
            EN ROUTE &mdash; {{ transitEta(platform) }}
          </span>
          <span v-else class="transit-eta returning">
            RETURNING &mdash; {{ returnEta(platform) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Global reserves -->
    <div v-if="platforms.length > 0" class="reserves">
      <span class="reserve-label">RESERVES</span>
      <span class="reserve-val">M:{{ autoReserves.metals }}</span>
      <span class="reserve-val">I:{{ autoReserves.ice }}</span>
      <span class="reserve-val">R:{{ autoReserves.rareMinerals }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Building, Directive } from '@/stores/gameStore'
import { useGameStore } from '@/stores/gameStore'
import { getCurrentRates, calculatePayoutEstimate } from '@/systems/economy'
import SvgIcon from './SvgIcon.vue'

const game = useGameStore()

// --- Directives ---

const directives: { value: Directive; label: string; icon: string }[] = [
  { value: 'mining', label: 'Prioritize Extraction', icon: 'mining' },
  { value: 'safety', label: 'Prioritize Safety', icon: 'safety' },
  { value: 'balanced', label: 'Balanced Ops', icon: 'balanced' },
  { value: 'emergency', label: 'Emergency Protocol', icon: 'emergency' },
]

// --- Platforms ---

const expandedId = ref<string | null>(null)
const rates = computed(() => getCurrentRates(game.totalPlaytimeMs))
const platforms = computed(() => game.operationalPlatforms)
const autoReserves = computed(() => game.exportAutoReserves)

function togglePlatform(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function getState(platform: Building) {
  return game.exportPlatforms[platform.id]
}

function loaded(platform: Building): number {
  const ep = getState(platform)
  if (!ep) return 0
  return ep.cargo.metals + ep.cargo.ice + ep.cargo.rareMinerals
}

function estimate(platform: Building): number {
  const ep = getState(platform)
  if (!ep) return 0
  return calculatePayoutEstimate(ep.cargo, game.totalPlaytimeMs)
}

function platformLabel(platform: Building): string {
  const index = game.buildings
    .filter((b) => b.type === 'launchplatform')
    .findIndex((b) => b.id === platform.id)
  return `Platform #${index + 1}`
}

function statusLabel(platform: Building): string {
  const ep = getState(platform)
  if (!ep) return 'INIT'
  if (ep.status === 'in_transit') return 'EN ROUTE'
  if (ep.status === 'returning') return 'RETURNING'
  return 'LOADING'
}

function statusClass(platform: Building): string {
  const ep = getState(platform)
  if (!ep) return ''
  if (ep.status === 'in_transit') return 'status-transit'
  if (ep.status === 'returning') return 'status-returning'
  return 'status-docked'
}

function transitEta(platform: Building): string {
  const ep = getState(platform)
  if (!ep?.launchTime) return '--'
  const remaining = Math.max(0, ep.launchTime + 120_000 - game.totalPlaytimeMs)
  return `${Math.ceil(remaining / 1000)}s`
}

function returnEta(platform: Building): string {
  const ep = getState(platform)
  if (!ep?.returnTime) return '--'
  const remaining = Math.max(0, ep.returnTime - game.totalPlaytimeMs)
  return `${Math.ceil(remaining / 1000)}s`
}
</script>

<style scoped>
.operations-panel {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 8px 10px;
}

.section-label {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.platforms-label {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.count-badge {
  background: var(--accent-dim);
  color: var(--text-secondary);
  font-size: 0.5625rem;
  padding: 1px 5px;
  border-radius: var(--radius-xs);
}

/* Directives */
.directive-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.directive-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-surface);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  width: 100%;
  cursor: pointer;
  transition: all 0.15s;
}

.directive-row.active {
  border-color: var(--cyan);
  background: var(--accent-dim);
}

.directive-row .dir-name {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  text-align: left;
}

.directive-row .dir-toggle {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--text-muted);
}

.directive-row.active .dir-toggle {
  color: var(--cyan);
}

/* Empty state */
.empty-state {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--text-muted);
  padding: 12px 10px;
  text-align: center;
  font-style: italic;
}

/* HQ Rates */
.rates-row {
  display: flex;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  padding: 5px 10px;
  background: var(--accent-dim);
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
  flex-wrap: wrap;
  align-items: baseline;
}

.rate-label {
  color: var(--text-muted);
  font-size: 0.625rem;
  letter-spacing: 0.1em;
}

.rate { color: var(--text-secondary); }
.rate.boosted {
  color: var(--green);
  text-shadow: 0 0 6px var(--green-glow);
}

/* Platform accordion */
.platform-row {
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-sm);
  margin-bottom: 4px;
  overflow: hidden;
}

.platform-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-surface);
  width: 100%;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  border: none;
  color: var(--text-primary);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.status-docked { background: var(--green); box-shadow: 0 0 4px var(--green-glow); }
.status-dot.status-transit { background: var(--amber); box-shadow: 0 0 4px var(--amber-glow); }
.status-dot.status-returning { background: var(--text-muted); }

.platform-name { flex: 1; text-align: left; color: var(--text-primary); }
.platform-cargo { color: var(--text-secondary); font-size: 0.625rem; }
.platform-state { font-size: 0.625rem; }
.platform-state.status-docked { color: var(--green); }
.platform-state.status-transit { color: var(--amber); }
.platform-state.status-returning { color: var(--text-muted); }

.expand-arrow { color: var(--text-muted); font-size: 0.75rem; }

/* Expanded detail */
.platform-detail {
  border-top: 1px solid var(--accent-muted);
  background: var(--bg-deep);
}

.detail-content {
  padding: 8px 10px;
}

.cargo-section { margin-bottom: 6px; }

.capacity-bar-bg {
  height: 4px;
  background: var(--bg-primary);
  border-radius: var(--radius-xs);
  overflow: hidden;
  margin-bottom: 4px;
}

.capacity-bar-fill {
  height: 100%;
  background: var(--cyan);
  border-radius: var(--radius-xs);
  transition: width 0.2s ease;
}

.capacity-bar-fill.full { background: var(--amber); }

.cargo-breakdown {
  display: flex;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--text-secondary);
}

.cargo-estimate {
  color: var(--text-muted);
  margin-left: auto;
}

/* Controls */
.controls {
  display: flex;
  gap: 6px;
}

.action-btn {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  letter-spacing: 0.05em;
  padding: 6px 12px;
  border: 1px solid var(--accent-muted);
  background: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
  min-height: 32px;
  transition: all 0.15s;
}

.action-btn.green { border-color: var(--green); color: var(--green); }
.action-btn.amber { border-color: var(--amber); color: var(--amber); }
.action-btn.active { background: var(--bg-elevated); border-color: var(--cyan); color: var(--cyan); }
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.transit-eta {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--cyan);
}

.transit-eta.returning {
  color: var(--text-muted);
}

/* Reserves */
.reserves {
  display: flex;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  align-items: baseline;
  padding-top: 6px;
  margin-top: 4px;
  border-top: 1px solid var(--accent-muted);
}

.reserve-label { color: var(--text-muted); letter-spacing: 0.1em; }
.reserve-val { color: var(--text-secondary); }
</style>
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Clean build with the new OperationsPanel.

- [ ] **Step 3: Verify visually**

Run: `bun run dev`
Confirm: OPS tab shows directives at top (compact rows with ACTIVE/OFF toggle), platform accordion below with expand/collapse, empty state message when no platforms exist.

- [ ] **Step 4: Commit**

```bash
git add src/components/OperationsPanel.vue
git commit -m "feat: create OperationsPanel merging directives and export platforms"
```

---

### Task 6: Convert ShipmentPanel to Row-Based Catalog

**Files:**
- Modify: `src/components/ShipmentPanel.vue:101-120, 234-760`

- [ ] **Step 1: Replace catalog grid with row-based layout**

In `src/components/ShipmentPanel.vue`, replace the catalog section (lines 101-120):

```vue
<!-- Catalog rows -->
<div class="catalog">
  <button
    v-for="opt in options"
    :key="opt.label"
    class="catalog-row"
    :class="{ disabled: !canAdd(opt), tapped: tappedItem === opt.label }"
    @click="addFromCatalog(opt)"
  >
    <SvgIcon :name="shipmentIcon(opt)" size="sm" class="catalog-icon" />
    <span class="catalog-name">{{ opt.label }}</span>
    <span class="catalog-stat mono">{{ opt.abbrevStat }}</span>
    <span class="catalog-cost mono">{{ opt.cost }}cr</span>
    <span class="catalog-weight mono">{{ opt.weight }}kg</span>
  </button>
</div>
```

- [ ] **Step 2: Replace catalog grid styles with row styles**

Remove the `.catalog-grid` and `.catalog-btn` styles (around lines 595-660) and replace with:

```css
.catalog {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 8px;
}

.catalog-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-surface);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  width: 100%;
  cursor: pointer;
  transition: all 0.1s;
  font-family: var(--font-mono);
}

.catalog-row:active:not(.disabled) {
  background: var(--accent-dim);
  border-color: var(--cyan);
}

.catalog-row.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.catalog-row.tapped {
  animation: row-flash 0.2s ease;
}

@keyframes row-flash {
  0% { background: var(--accent-dim); }
  100% { background: var(--bg-surface); }
}

.catalog-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.catalog-name {
  flex: 1;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  text-align: left;
}

.catalog-stat {
  font-size: 0.625rem;
  color: var(--amber);
  min-width: 50px;
  text-align: right;
}

.catalog-cost {
  font-size: 0.6875rem;
  color: var(--green);
  min-width: 50px;
  text-align: right;
}

.catalog-weight {
  font-size: 0.625rem;
  color: var(--text-muted);
  min-width: 30px;
  text-align: right;
}
```

- [ ] **Step 3: Verify visually**

Run: `bun run dev`
Confirm: Shipment catalog shows as rows with icon, name, abbreviated stat, cost, weight. Tapping adds to manifest. Disabled state dims unaffordable items.

- [ ] **Step 4: Commit**

```bash
git add src/components/ShipmentPanel.vue
git commit -m "feat: convert shipment catalog to row-based layout with abbrevStat"
```

---

### Task 7: Simplify ColonyMap (Remove HUD, Add Edge Stats + Settings)

**Files:**
- Modify: `src/components/ColonyMap.vue:122-140, 353-586`

- [ ] **Step 1: Remove ResourceHud from template**

In `src/components/ColonyMap.vue`, remove the ResourceHud component from the template (line 123):

```vue
<!-- Remove this line: -->
<!-- <ResourceHud /> -->
```

Also remove the ResourceHud import from the script section.

- [ ] **Step 2: Add settings gear and edge stats**

Replace the removed ResourceHud line and rework the overlay elements. After the `</div>` closing the map content (line 120), replace lines 122-140 with:

```vue
<HazardAlert />

<!-- Settings gear — top right -->
<button class="settings-btn" @click="$emit('openSettings')">&#x2699;</button>

<!-- Edge stats -->
<div class="edge-stats">
  <span class="edge-stat mono">CREW {{ game.aliveColonists.length }}</span>
  <span class="edge-stat mono">DEPTH {{ game.depth }}m</span>
</div>

<div v-if="moon.awayCount > 0" class="away-indicator mono">
  {{ moon.awayCount }} CREW DEPLOYED
</div>

<PauseButton />

<div v-if="game.isPaused" class="pause-overlay">
  <span class="pause-text">PAUSED</span>
</div>

<div class="feed-indicator">
  <span class="feed-dot" />
  <span class="feed-text">LIVE</span>
</div>

<div v-if="settings.showFps" class="fps-counter">{{ fps }} FPS</div>
```

- [ ] **Step 3: Add emit declaration**

In the script section, add emit declaration:

```typescript
defineEmits<{ openSettings: [] }>()
```

- [ ] **Step 4: Add styles for settings button and edge stats**

Add to the `<style scoped>` section:

```css
.settings-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  background: var(--bg-elevated);
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 1.125rem;
  padding: 6px 10px;
  cursor: pointer;
  min-height: 36px;
  min-width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}

.settings-btn:active {
  opacity: 1;
  background: var(--bg-surface);
}

.edge-stats {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 5;
  display: flex;
  gap: 10px;
}

.edge-stat {
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  opacity: 0.6;
}
```

- [ ] **Step 5: Update GameView to pass openSettings through map**

In `src/components/GameView.vue`, update the ColonyMap usage to forward the settings event:

```vue
<ColonyMap v-if="lens === 'close'" @open-settings="$emit('open-settings')" />
```

Remove the settings event forwarding from CommandConsole if it's no longer needed there (keep it if moon lens still uses it).

- [ ] **Step 6: Verify visually**

Run: `bun run dev`
Confirm: Map has no resource HUD overlay. Settings gear in top-right corner. Small CREW/DEPTH stats in top-left. Everything else unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/components/ColonyMap.vue src/components/GameView.vue
git commit -m "feat: simplify colony map — remove HUD, add edge stats and settings gear"
```

---

### Task 8: Add Tappable Colonist Names in MessageLog

**Files:**
- Modify: `src/components/MessageLog.vue:1-8, 11-54, 57-103`
- Modify: `src/stores/gameStore.ts` (add trackedColonistId)

- [ ] **Step 1: Add trackedColonistId to game store**

In `src/stores/gameStore.ts`, add to the `ColonyState` interface:

```typescript
trackedColonistId: string | null
```

And in the initial state (in the `defineStore` state factory), add:

```typescript
trackedColonistId: null,
```

Add an action to the store:

```typescript
trackColonist(id: string | null) {
  this.trackedColonistId = id
},
```

- [ ] **Step 2: Update MessageLog template for tappable names**

Replace the MessageLog template:

```vue
<template>
  <div ref="logEl" class="message-log" @scroll="onScroll">
    <div v-for="msg in game.messages" :key="msg.id" class="log-entry" :class="msg.severity">
      <span class="log-time mono">{{ fmtMissionTime(msg.timestamp) }}</span>
      <span class="log-text" v-html="renderMessage(msg.text)" />
    </div>
    <div v-if="game.messages.length === 0" class="log-empty">Awaiting colony transmissions...</div>
  </div>
</template>
```

- [ ] **Step 3: Add name detection and rendering logic**

In the MessageLog script section, add colonist name detection:

```typescript
import { computed } from 'vue'

const colonistNames = computed(() =>
  game.colonists.map(c => c.name).sort((a, b) => b.length - a.length)
)

function renderMessage(text: string): string {
  let result = escapeHtml(text)
  for (const name of colonistNames.value) {
    const escapedName = escapeHtml(name)
    const colonist = game.colonists.find(c => c.name === name)
    if (colonist) {
      result = result.replace(
        new RegExp(`\\b${escapeRegex(escapedName)}\\b`, 'g'),
        `<span class="colonist-link" data-colonist-id="${colonist.id}">${escapedName}</span>`
      )
    }
  }
  return result
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
```

- [ ] **Step 4: Add click handler for colonist links**

Add a click handler to the message log container:

```typescript
function onLogClick(e: Event) {
  const target = e.target as HTMLElement
  if (target.classList.contains('colonist-link')) {
    const id = target.dataset.colonistId
    if (id) {
      game.trackColonist(game.trackedColonistId === id ? null : id)
    }
  }
}
```

Update the template to include the click handler:

```vue
<div ref="logEl" class="message-log" @scroll="onScroll" @click="onLogClick">
```

- [ ] **Step 5: Add colonist-link styles**

Add to the `<style scoped>` section:

```css
:deep(.colonist-link) {
  color: var(--cyan);
  cursor: pointer;
  border-bottom: 1px dotted var(--cyan);
  padding-bottom: 1px;
}

:deep(.colonist-link:active) {
  color: var(--text-primary);
  background: var(--accent-dim);
}
```

- [ ] **Step 6: Verify**

Run: `bun run dev`
Confirm: Colonist names in comms are highlighted cyan with dotted underline. Tapping toggles tracking (store value changes — visual overlay comes in Task 9).

- [ ] **Step 7: Commit**

```bash
git add src/components/MessageLog.vue src/stores/gameStore.ts
git commit -m "feat: add tappable colonist names in comms log"
```

---

### Task 9: Create ColonistTracker Map Overlay

**Files:**
- Create: `src/components/ColonistTracker.vue`
- Modify: `src/components/ColonyMap.vue`

- [ ] **Step 1: Create ColonistTracker.vue**

This follows the BuildingInfo overlay pattern — positioned absolutely on the map, tracking a colonist.

```vue
<template>
  <div
    v-if="colonist"
    class="colonist-tracker"
    :style="{ left: x + '%', top: y + '%' }"
  >
    <div class="tracker-card">
      <div class="tracker-header">
        <span class="tracker-name">{{ colonist.name }}</span>
        <button class="tracker-close" @click="game.trackColonist(null)">&times;</button>
      </div>
      <div class="tracker-row">
        <span class="tracker-label">ACTION</span>
        <span class="tracker-val">{{ actionLabel }}</span>
      </div>
      <div class="tracker-row">
        <span class="tracker-label">MORALE</span>
        <span class="tracker-val" :class="moraleClass">{{ colonist.morale }}</span>
      </div>
    </div>
    <div class="tracker-pip" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const props = defineProps<{
  x: number
  y: number
}>()

const game = useGameStore()

const colonist = computed(() => {
  if (!game.trackedColonistId) return null
  return game.colonists.find(c => c.id === game.trackedColonistId) ?? null
})

const actionLabel = computed(() => {
  if (!colonist.value?.currentAction) return 'idle'
  const action = colonist.value.currentAction
  if (action.type === 'extract') return 'extracting'
  if (action.type === 'engineer') return 'engineering'
  if (action.type === 'repair') return 'repairing'
  if (action.type === 'unpack') return 'unpacking'
  if (action.type === 'rest') return 'resting'
  if (action.type === 'heal') return 'healing'
  if (action.type === 'load') return 'loading cargo'
  if (action.type === 'construct') return 'constructing'
  if (action.type === 'socialize') return 'socializing'
  return action.type
})

const moraleClass = computed(() => {
  if (!colonist.value) return ''
  if (colonist.value.morale < 20) return 'morale-critical'
  if (colonist.value.morale < 40) return 'morale-low'
  return 'morale-ok'
})
</script>

<style scoped>
.colonist-tracker {
  position: absolute;
  transform: translate(-50%, -100%) translateY(-12px);
  z-index: 20;
  pointer-events: auto;
  transition: left 0.5s ease, top 0.5s ease;
}

.tracker-card {
  background: var(--bg-elevated);
  border: 1px solid var(--cyan);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  min-width: 100px;
  box-shadow: 0 0 8px var(--cyan-glow);
}

.tracker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.tracker-name {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--cyan);
}

.tracker-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0 2px;
  min-height: auto;
  line-height: 1;
}

.tracker-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.5625rem;
}

.tracker-label {
  color: var(--text-muted);
  letter-spacing: 0.1em;
}

.tracker-val {
  color: var(--text-primary);
}

.morale-ok { color: var(--green); }
.morale-low { color: var(--amber); }
.morale-critical { color: var(--red); }

.tracker-pip {
  width: 6px;
  height: 6px;
  background: var(--cyan);
  border-radius: 50%;
  margin: 2px auto 0;
  box-shadow: 0 0 4px var(--cyan-glow);
}
</style>
```

- [ ] **Step 2: Mount ColonistTracker in ColonyMap**

In `src/components/ColonyMap.vue`, import and add the tracker after the MapColonist loop (after line 119):

```typescript
import ColonistTracker from './ColonistTracker.vue'
```

In the template, after the MapColonist v-for block, add:

```vue
<ColonistTracker
  v-if="trackedColonistPos"
  :x="trackedColonistPos.targetX"
  :y="trackedColonistPos.targetY"
/>
```

In the script, add:

```typescript
const trackedColonistPos = computed(() => {
  if (!game.trackedColonistId) return null
  return getColonistState(game.trackedColonistId)
})
```

- [ ] **Step 3: Verify visually**

Run: `bun run dev`
Confirm: Tap a colonist name in comms → map shows tracking overlay following that colonist with name, action, morale. Tap close or tap another name to dismiss/switch.

- [ ] **Step 4: Commit**

```bash
git add src/components/ColonistTracker.vue src/components/ColonyMap.vue
git commit -m "feat: add colonist tracking overlay triggered from comms"
```

---

### Task 10: Create Operator's Manual Modal

**Files:**
- Create: `src/components/OperatorsManual.vue`
- Modify: `src/components/CommandConsole.vue`

- [ ] **Step 1: Create OperatorsManual.vue**

```vue
<template>
  <Teleport to="body">
    <div v-if="visible" class="manual-overlay" @click.self="$emit('close')">
      <div class="manual-modal">
        <div class="manual-header">
          <h2 class="manual-title">OPERATOR'S MANUAL</h2>
          <button class="manual-close" @click="$emit('close')">&times;</button>
        </div>

        <div class="manual-nav">
          <button
            v-for="cat in categories"
            :key="cat.id"
            class="nav-btn"
            :class="{ active: activeCategory === cat.id }"
            @click="activeCategory = cat.id"
          >
            {{ cat.label }}
          </button>
        </div>

        <div class="manual-content">
          <div v-for="entry in activeEntries" :key="entry.label" class="manual-entry" :id="'manual-' + entry.label.replace(/\s/g, '-').toLowerCase()">
            <div class="entry-header">
              <SvgIcon :name="entry.icon" size="md" />
              <h3 class="entry-name">{{ entry.label }}</h3>
            </div>
            <p class="entry-desc">{{ entry.description }}</p>
            <div class="entry-stats">
              <span v-if="entry.cost" class="stat">Cost: {{ entry.cost }}cr</span>
              <span v-if="entry.weight" class="stat">Weight: {{ entry.weight }}kg</span>
              <span v-if="entry.buildTime" class="stat">Build: {{ entry.buildTime }}s</span>
              <span v-if="entry.costMetals" class="stat">Materials: {{ entry.costMetals }}m{{ entry.costIce ? ' ' + entry.costIce + 'i' : '' }}</span>
            </div>
            <p v-if="entry.flavorText" class="entry-flavor">{{ entry.flavorText }}</p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { BUILDING_CONFIGS } from '@/config/buildings'
import { SHIPMENT_OPTIONS } from '@/stores/gameStore'
import SvgIcon from './SvgIcon.vue'

defineProps<{ visible: boolean }>()
defineEmits<{ close: [] }>()

interface ManualEntry {
  label: string
  icon: string
  description: string
  cost?: number
  weight?: number
  buildTime?: number
  costMetals?: number
  costIce?: number
  flavorText?: string
  category: string
}

const categories = [
  { id: 'buildings', label: 'BUILDINGS' },
  { id: 'supplies', label: 'SUPPLIES' },
  { id: 'systems', label: 'SYSTEMS' },
]

const activeCategory = ref('buildings')

const entries: ManualEntry[] = [
  // Buildings from config
  ...BUILDING_CONFIGS.map(c => ({
    label: c.label,
    icon: c.type === 'solar' ? 'power' : c.type === 'o2generator' ? 'air' : c.type === 'extractionrig' ? 'mining' : c.type === 'medbay' ? 'medical' : c.type === 'partsfactory' ? 'repair' : c.type === 'storageSilo' ? 'storage' : c.type === 'launchplatform' ? 'export' : 'building',
    description: c.description,
    buildTime: c.constructionTime,
    costMetals: c.costMetals,
    costIce: c.costIce || undefined,
    cost: c.shipmentCost ?? undefined,
    weight: c.shipmentWeight ?? undefined,
    category: 'buildings',
  })),
  // Supplies
  ...SHIPMENT_OPTIONS.filter(o => o.type !== 'equipment').map(o => ({
    label: o.label,
    icon: o.type === 'supplyCrate' ? 'metals' : o.type === 'newColonist' ? 'crew' : o.type === 'repairKit' ? 'repair' : o.type === 'emergencyO2' ? 'air' : o.type === 'emergencyPower' ? 'power' : 'crate',
    description: o.description,
    cost: o.cost,
    weight: o.weight,
    category: 'supplies',
  })),
  // Systems (placeholder entries — content filled incrementally)
  {
    label: 'Export Operations',
    icon: 'export',
    description: 'Launch platforms export colony resources to HQ in exchange for credits. Colonists automatically load cargo onto docked platforms. Platforms cycle: loading → in transit (120s) → returning (180s). Force-launching skips the full-capacity wait but extends the return trip.',
    category: 'systems',
  },
  {
    label: 'Directives',
    icon: 'balanced',
    description: 'Directives control the extractor-to-engineer work ratio and modify extraction speed, hazard resistance, and production output. Changes take effect immediately. Choose based on current colony needs — mining for resources, safety during hazard-heavy periods, emergency when life support is failing.',
    category: 'systems',
  },
  {
    label: 'Colony Depth',
    icon: 'mining',
    description: 'Extraction operations gradually increase colony depth. Greater depth unlocks rare mineral deposits but increases hazard frequency. Depth cannot be reduced.',
    category: 'systems',
  },
]

const activeEntries = computed(() =>
  entries.filter(e => e.category === activeCategory.value)
)
</script>

<style scoped>
.manual-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.manual-modal {
  background: var(--bg-primary);
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-md);
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.manual-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid var(--accent-muted);
}

.manual-title {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--text-primary);
}

.manual-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.25rem;
  cursor: pointer;
  min-height: auto;
  padding: 4px;
}

.manual-nav {
  display: flex;
  border-bottom: 1px solid var(--accent-dim);
  flex-shrink: 0;
}

.nav-btn {
  flex: 1;
  padding: 8px 4px;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-secondary);
  background: transparent;
  border-bottom: 2px solid transparent;
}

.nav-btn.active {
  color: var(--cyan);
  border-bottom-color: var(--cyan);
}

.manual-content {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 10px 14px;
}

.manual-entry {
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--accent-dim);
}

.manual-entry:last-child {
  border-bottom: none;
}

.entry-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  color: var(--text-secondary);
}

.entry-name {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-primary);
}

.entry-desc {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 6px;
}

.entry-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.625rem;
}

.stat {
  color: var(--text-muted);
  background: var(--bg-surface);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
}

.entry-flavor {
  font-size: 0.6875rem;
  color: var(--text-muted);
  font-style: italic;
  margin-top: 6px;
  line-height: 1.5;
}
</style>
```

- [ ] **Step 2: Wire into CommandConsole**

In `src/components/CommandConsole.vue`, import and mount the manual:

```typescript
import OperatorsManual from './OperatorsManual.vue'
```

Add at the end of the template (before closing `</div>` of `.command-console`):

```vue
<OperatorsManual :visible="showManual" @close="showManual = false" />
```

- [ ] **Step 3: Verify visually**

Run: `bun run dev`
Confirm: Book icon in status bar opens the manual modal. Categories switch between Buildings, Supplies, Systems. Entries show name, description, stats. Close button and overlay click dismiss.

- [ ] **Step 4: Commit**

```bash
git add src/components/OperatorsManual.vue src/components/CommandConsole.vue
git commit -m "feat: add Operator's Manual modal accessible from status bar"
```

---

### Task 11: Message Type Color Indicators

**Files:**
- Modify: `src/components/MessageLog.vue:57-103`

- [ ] **Step 1: Add left-edge color indicator to messages**

Update the `.log-entry` styling and add a left-border indicator:

```css
.log-entry {
  display: flex;
  gap: 8px;
  padding: 2px 0 2px 6px;
  border-left: 2px solid transparent;
}

.log-entry.event {
  border-left-color: var(--cyan);
}

.log-entry.warning {
  border-left-color: var(--amber);
}

.log-entry.critical {
  border-left-color: var(--red);
}
```

- [ ] **Step 2: Verify visually**

Run: `bun run dev`
Confirm: Messages have colored left-edge indicators — cyan for events, amber for warnings, red for critical. Default messages have no border.

- [ ] **Step 3: Commit**

```bash
git add src/components/MessageLog.vue
git commit -m "style: add color-coded left-edge indicators to comms messages"
```

---

### Task 12: Clean Up Removed Components

**Files:**
- Delete: `src/components/ExportPanel.vue`
- Delete: `src/components/DirectivePanel.vue`
- Modify: `src/components/ColonyMap.vue` (remove ResourceHud import if not already done)

- [ ] **Step 1: Verify no remaining references**

Search for imports of the removed components:

```bash
grep -r "ExportPanel\|DirectivePanel\|ResourceHud" src/components/ --include="*.vue" --include="*.ts"
```

Expected: No references in any file except the files themselves.

- [ ] **Step 2: Delete the files**

```bash
rm src/components/ExportPanel.vue src/components/DirectivePanel.vue
```

Note: Keep `ResourceHud.vue` for now — it may still be referenced in the moon lens or other views. Only delete if truly unused.

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Clean build, no import errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove ExportPanel and DirectivePanel (merged into OperationsPanel)"
```

---

### Task 13: Final Verification

- [ ] **Step 1: Full visual walkthrough**

Run: `bun run dev`

Check each element:
1. **50/50 split** — map and console are equal halves
2. **Resource header** — persistent above tabs, readable values with rates
3. **Three tabs** — COMMS, SHIPMENTS, OPS
4. **COMMS tab** — messages with left-edge color indicators, tappable colonist names (cyan, dotted underline)
5. **SHIPMENTS tab** — row-based catalog with icon/name/stat/cost/weight, manifest and in-transit above
6. **OPS tab** — directives at top (compact rows with ACTIVE/OFF), platforms accordion below with expand/collapse
7. **Status bar** — credits + income always visible, right side changes per tab
8. **Manual** — book icon opens modal with categorized entries
9. **Map** — clean feed, settings gear top-right, edge stats top-left, no HUD overlay
10. **Colonist tracking** — tap name in comms → overlay follows colonist on map

- [ ] **Step 2: Build check**

Run: `bun run build`
Expected: No type errors, clean production build.

- [ ] **Step 3: Commit any remaining fixes**

If any adjustments were needed during verification, commit them:

```bash
git add -A
git commit -m "fix: polish console UI overhaul"
```
