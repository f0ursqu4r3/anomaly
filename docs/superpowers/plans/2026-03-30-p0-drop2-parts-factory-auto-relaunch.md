# P0 Drop 2 — Parts Factory & Auto-Relaunch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add passive repair kit generation via Parts Factory building and automatic shipment repeat toggle, completing the idle survivability milestone.

**Architecture:** Parts Factory is a new building type with passive production tracked by a global timer in the store. Auto-relaunch saves the last manifest and re-sends it when cooldown expires. Both features modify `gameStore.ts` (state, constants, tick logic), `offlineEngine.ts`, and their respective UI components.

**Tech Stack:** Vue 3, Pinia, TypeScript, existing SvgIcon and mapLayout systems

---

### Task 1: Parts Factory — Type & Blueprint Registration

**Files:**
- Modify: `src/stores/gameStore.ts` (BuildingType, BLUEPRINTS, ColonyState, constants)
- Modify: `src/systems/mapLayout.ts` (zone, ZONE_FOR_BUILDING, PATH_EDGES)

- [ ] **Step 1: Add `partsfactory` to BuildingType union**

In `src/stores/gameStore.ts` line 25, update:

```typescript
export type BuildingType = 'o2generator' | 'solar' | 'drillrig' | 'medbay' | 'partsfactory'
```

- [ ] **Step 2: Add factory constants**

Near the other production constants (around line 148), add:

```typescript
export const PARTS_FACTORY_INTERVAL_MS = 45_000
export const PARTS_FACTORY_METAL_COST = 2
```

- [ ] **Step 3: Add blueprint entry**

In the `BLUEPRINTS` array (after Med Bay, ~line 295), add:

```typescript
{
  type: 'partsfactory',
  label: 'Parts Factory',
  description: 'Produces repair kits from metals',
  costMetals: 15,
  costIce: 0,
},
```

- [ ] **Step 4: Add shipment option**

In the `SHIPMENT_OPTIONS` array (after Med Bay entry, ~line 234), add:

```typescript
{
  type: 'equipment',
  label: 'Parts Factory',
  description: 'Produces repair kits',
  cost: 40,
  weight: 30,
  buildingType: 'partsfactory',
},
```

- [ ] **Step 5: Add `lastPartsProducedAt` to ColonyState**

In the `ColonyState` interface, add after `repairKits`:

```typescript
lastPartsProducedAt: number
```

Set default in `freshState()`: `lastPartsProducedAt: 0,`

- [ ] **Step 6: Add workshop zone to mapLayout**

In `src/systems/mapLayout.ts`, add to the `ZONES` array (after medical, before landing):

```typescript
{ id: 'workshop', x: 25, y: 70, radius: 8,  label: 'SEC-F WORKSHOP', color: '#fa0', buildingTypes: ['partsfactory'] },
```

Add to `ZONE_FOR_BUILDING` (line 17-22):

```typescript
export const ZONE_FOR_BUILDING: Record<BuildingType, string> = {
  solar: 'power',
  o2generator: 'lifeSup',
  drillrig: 'drill',
  medbay: 'medical',
  partsfactory: 'workshop',
}
```

Add path edge connecting workshop to habitat:

```typescript
{ from: 'habitat', to: 'workshop', weight: 1 },
```

- [ ] **Step 7: Build check**

Run: `bun run build`
Expected: no type errors

- [ ] **Step 8: Commit**

```bash
git add src/stores/gameStore.ts src/systems/mapLayout.ts
git commit -m "feat: register parts factory building type, blueprint, and workshop zone"
```

---

### Task 2: Parts Factory — SVG Icon

**Files:**
- Modify: `src/components/SvgIcon.vue` (add icon entry)

- [ ] **Step 1: Add partsfactory icon**

In `src/components/SvgIcon.vue`, find the `ICONS` object. Add a new entry for `partsfactory` — a gear/cog icon:

```typescript
partsfactory: {
  viewBox: '0 0 16 16',
  path: `<path d="M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM6.2 2.5l-.4-1.2H10.2l-.4 1.2.8.5 1.2-.4.8.8-.4 1.2.5.8 1.2-.4v1.6l-1.2-.4-.5.8.4 1.2-.8.8-1.2-.4-.8.5.4 1.2H6.2l.4-1.2-.8-.5-1.2.4-.8-.8.4-1.2-.5-.8-1.2.4V6.4l1.2.4.5-.8-.4-1.2.8-.8 1.2.4z" stroke="currentColor" stroke-width="0.8" fill="none"/>`,
},
```

- [ ] **Step 2: Build check**

Run: `bun run build`
Expected: no type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/SvgIcon.vue
git commit -m "feat: add gear icon for parts factory"
```

---

### Task 3: Parts Factory — Production Tick Logic

**Files:**
- Modify: `src/stores/gameStore.ts` (tick action)

- [ ] **Step 1: Add factory production to tick**

In `src/stores/gameStore.ts`, in the `tick()` action, after the colonist repair block (the `if (this.repairKits > 0) { ... repairers ...}` section) and before the hazard check, add:

```typescript
// Parts Factory production
const factoryCount = this.buildings.filter(b => b.type === 'partsfactory' && !b.damaged).length
if (factoryCount > 0 && this.power > 0 && this.metals >= PARTS_FACTORY_METAL_COST) {
  const interval = PARTS_FACTORY_INTERVAL_MS / factoryCount
  if (this.totalPlaytimeMs - this.lastPartsProducedAt >= interval) {
    this.metals -= PARTS_FACTORY_METAL_COST
    this.repairKits++
    this.lastPartsProducedAt = this.totalPlaytimeMs
    this.pushMessage(`Parts Factory produced a repair kit. (${this.repairKits} in stock, -${PARTS_FACTORY_METAL_COST} metals)`, 'info')
  }
}
```

- [ ] **Step 2: Build check**

Run: `bun run build`
Expected: no type errors

- [ ] **Step 3: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat: add parts factory production tick logic"
```

---

### Task 4: Parts Factory — Offline Engine

**Files:**
- Modify: `src/stores/offlineEngine.ts`

- [ ] **Step 1: Import factory constants**

In `src/stores/offlineEngine.ts`, add to the import block (line 2-28):

```typescript
PARTS_FACTORY_INTERVAL_MS,
PARTS_FACTORY_METAL_COST,
```

- [ ] **Step 2: Add factory production to offline sim loop**

In `src/stores/offlineEngine.ts`, after the offline repair block (~line 296-303) and before the auto-directive check (~line 305), add:

```typescript
// Parts Factory production (offline)
const factoryCount = state.buildings.filter(b => b.type === 'partsfactory' && !b.damaged).length
if (factoryCount > 0 && state.power > 0 && state.metals >= PARTS_FACTORY_METAL_COST) {
  const interval = PARTS_FACTORY_INTERVAL_MS / factoryCount
  if (state.totalPlaytimeMs - state.lastPartsProducedAt >= interval) {
    state.metals -= PARTS_FACTORY_METAL_COST
    state.repairKits++
    state.lastPartsProducedAt = state.totalPlaytimeMs
  }
}
```

- [ ] **Step 3: Build check**

Run: `bun run build`
Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add src/stores/offlineEngine.ts
git commit -m "feat: add parts factory production to offline engine"
```

---

### Task 5: Auto-Relaunch — Store State & Logic

**Files:**
- Modify: `src/stores/gameStore.ts` (ColonyState, launchShipment, tick)

- [ ] **Step 1: Add auto-relaunch state fields**

In `ColonyState` interface, add after `shipmentCooldownUntil`:

```typescript
autoRelaunch: boolean
lastManifest: ShipmentOption[]
```

Set defaults in `freshState()`:

```typescript
autoRelaunch: false,
lastManifest: [],
```

- [ ] **Step 2: Save last manifest on launch**

In the `launchShipment()` action (~line 730), before `this.manifest = []` (line 754), add:

```typescript
this.lastManifest = [...this.manifest]
```

So the section becomes:

```typescript
this.lastManifest = [...this.manifest]
this.manifest = []
this.shipmentCooldownUntil = this.totalPlaytimeMs + SHIPMENT_COOLDOWN_MS
```

- [ ] **Step 3: Add auto-relaunch check to tick**

In the `tick()` action, after `this.processShipments()` is called, add the auto-relaunch check:

```typescript
// Auto-relaunch
if (this.autoRelaunch && this.lastManifest.length > 0 && !this.shipmentOnCooldown) {
  const cost = this.lastManifest.reduce((sum, o) => sum + o.cost, 0)
  if (this.credits >= cost) {
    this.credits -= cost
    const hasEmergency = this.lastManifest.some(
      (o) => o.type === 'emergencyO2' || o.type === 'emergencyPower',
    )
    const transit = hasEmergency ? EMERGENCY_TRANSIT_MS : SHIPMENT_TRANSIT_MS
    this.inTransitShipments.push({
      id: uid(),
      contents: [...this.lastManifest],
      totalWeight: this.lastManifest.reduce((sum, o) => sum + o.weight, 0),
      arrivalAt: this.totalPlaytimeMs + transit,
    })
    this.shipmentCooldownUntil = this.totalPlaytimeMs + SHIPMENT_COOLDOWN_MS
    this.pushMessage('Auto-relaunching shipment...', 'event')
  } else {
    this.pushMessage('Auto-relaunch skipped — insufficient credits.', 'warning')
    this.autoRelaunch = false
  }
}
```

- [ ] **Step 4: Add toggleAutoRelaunch action**

In the actions block, add:

```typescript
toggleAutoRelaunch() {
  this.autoRelaunch = !this.autoRelaunch
},
```

- [ ] **Step 5: Build check**

Run: `bun run build`
Expected: no type errors

- [ ] **Step 6: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat: add auto-relaunch state, manifest tracking, and tick logic"
```

---

### Task 6: Auto-Relaunch — Offline Engine

**Files:**
- Modify: `src/stores/offlineEngine.ts`

- [ ] **Step 1: Import additional constants**

In `src/stores/offlineEngine.ts`, add to the import block:

```typescript
SHIPMENT_COOLDOWN_MS,
SHIPMENT_TRANSIT_MS,
EMERGENCY_TRANSIT_MS,
```

Also import `SHIPMENT_OPTIONS` if needed — actually, `lastManifest` is already stored as `ShipmentOption[]` on state, so we don't need the options list.

- [ ] **Step 2: Add auto-relaunch to offline sim**

In `src/stores/offlineEngine.ts`, after the `landShipments` call in the `phaseReason === 'shipment'` block (~line 293), add an auto-relaunch check. Actually, it's simpler to add it after the factory production block, after all per-tick processing:

```typescript
// Auto-relaunch (offline)
if (state.autoRelaunch && state.lastManifest.length > 0 && state.totalPlaytimeMs >= state.shipmentCooldownUntil) {
  const cost = state.lastManifest.reduce((sum: number, o: any) => sum + o.cost, 0)
  if (state.credits >= cost) {
    state.credits -= cost
    const hasEmergency = state.lastManifest.some(
      (o: any) => o.type === 'emergencyO2' || o.type === 'emergencyPower',
    )
    const transit = hasEmergency ? EMERGENCY_TRANSIT_MS : SHIPMENT_TRANSIT_MS
    state.inTransitShipments.push({
      id: uid(),
      contents: [...state.lastManifest],
      totalWeight: state.lastManifest.reduce((sum: number, o: any) => sum + o.weight, 0),
      arrivalAt: state.totalPlaytimeMs + transit,
    })
    state.shipmentCooldownUntil = state.totalPlaytimeMs + SHIPMENT_COOLDOWN_MS
    events.push({ type: 'shipment', severity: 'info', offsetMs: elapsedSoFar, message: 'Auto-relaunched shipment.' })
  } else {
    state.autoRelaunch = false
  }
}
```

Note: The type annotations on reduce callbacks (`sum: number, o: any`) may be needed since `lastManifest` comes from serialized state. Check if TypeScript infers correctly — if `ColonyState.lastManifest` is typed as `ShipmentOption[]`, the types should work without `any`.

- [ ] **Step 3: Build check**

Run: `bun run build`
Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add src/stores/offlineEngine.ts
git commit -m "feat: add auto-relaunch to offline engine"
```

---

### Task 7: Auto-Relaunch — UI Toggle

**Files:**
- Modify: `src/components/ShipmentPanel.vue`

- [ ] **Step 1: Add repeat toggle to manifest footer**

In `src/components/ShipmentPanel.vue`, find the `manifest-footer` div (~line 70). Add a repeat toggle button inside the `manifest-actions` div, before the CLEAR button:

```vue
<div class="manifest-actions">
  <button
    v-if="game.lastManifest.length > 0"
    class="repeat-btn"
    :class="{ active: game.autoRelaunch }"
    @click="game.toggleAutoRelaunch()"
  >
    {{ game.autoRelaunch ? '⟳ REPEAT ON' : '⟳ REPEAT' }}
  </button>
  <button class="clear-btn" @click="game.clearManifest()">CLEAR</button>
```

- [ ] **Step 2: Add repeat button styles**

Add to the `<style scoped>` block:

```css
.repeat-btn {
  padding: 8px 14px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  background: var(--bg-elevated);
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.repeat-btn.active {
  background: var(--accent-dim);
  color: var(--cyan);
  border: 1px solid var(--cyan);
}
```

- [ ] **Step 3: Also show repeat toggle when manifest is empty but lastManifest exists**

Add a standalone repeat toggle that appears below the cooldown bar or transit section, when the manifest is empty but a previous shipment exists. After the transit section and before the manifest section (~line 17), add:

```vue
<!-- Auto-relaunch toggle (visible when no manifest but previous exists) -->
<div v-if="game.manifest.length === 0 && game.lastManifest.length > 0" class="relaunch-row">
  <button
    class="repeat-btn standalone"
    :class="{ active: game.autoRelaunch }"
    @click="game.toggleAutoRelaunch()"
  >
    {{ game.autoRelaunch ? '⟳ AUTO-REPEAT ON' : '⟳ AUTO-REPEAT' }}
  </button>
  <span class="relaunch-hint mono">Last: {{ game.lastManifest.length }} items</span>
</div>
```

Add styles:

```css
.relaunch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 6px 8px;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
}

.relaunch-hint {
  font-size: 9px;
  color: var(--text-muted);
}

.repeat-btn.standalone {
  padding: 6px 12px;
}
```

- [ ] **Step 4: Build check**

Run: `bun run build`
Expected: no type errors

- [ ] **Step 5: Commit**

```bash
git add src/components/ShipmentPanel.vue
git commit -m "feat: add auto-relaunch repeat toggle to shipment panel"
```

---

### Task 8: Final Build & Verification

**Files:** None (verification only)

- [ ] **Step 1: Full build check**

Run: `bun run build`
Expected: clean build, no errors

- [ ] **Step 2: Full manual test**

Run `bun run dev` and verify:
- Parts Factory appears in shipment catalog (40 credits, 30kg)
- Ordering and receiving a Parts Factory places it in the workshop zone
- Workshop zone label and circle appear on the map
- Factory icon (gear) renders correctly on the map
- After 45s (with power > 0 and metals >= 2), a repair kit is produced and metals are decremented
- Repair kit count in HUD increments
- Multiple factories reduce the production interval
- Auto-relaunch toggle appears after first shipment launch
- Enabling repeat auto-sends the same manifest when cooldown expires
- Auto-relaunch disables and warns when credits run out
- Save/load preserves factory production timer, autoRelaunch, lastManifest

- [ ] **Step 3: Commit any fixes**

If any issues found, fix and commit individually.
