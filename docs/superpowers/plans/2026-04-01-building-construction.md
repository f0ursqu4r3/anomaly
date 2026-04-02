# Building Construction & Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace instant building placement with a construction phase where engineers build over time, introduce organic cluster-based placement, add worn paths from colonist traffic, and unify building config into a single file.

**Architecture:** Create `src/config/buildings.ts` as the single source of truth for all building data. Derive existing `BLUEPRINTS`, `SHIPMENT_OPTIONS`, and `ZONE_FOR_BUILDING` from it. Add `constructionProgress` to `Building`, `construct` action to colonist AI, ghost/wireframe rendering during construction, and traffic-based path rendering on the colony map.

**Tech Stack:** Vue 3, Pinia, TypeScript (existing stack, no new dependencies)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/config/buildings.ts` | Create | Unified building config: all per-building constants in one place |
| `src/stores/gameStore.ts` | Modify | Derive BLUEPRINTS/SHIPMENT_OPTIONS from config, add `constructionProgress` to Building, construction tick logic, remove silo/platform auto-build, add `zonePaths` to state |
| `src/systems/mapLayout.ts` | Modify | New cluster placement algorithm in `getBuildingPosition` |
| `src/types/colonist.ts` | Modify | Add `construct` to ActionType |
| `src/systems/colonistAI.ts` | Modify | Add `construct` action scoring |
| `src/systems/radioChatter.ts` | Modify | Construction start/complete messages |
| `src/composables/useColonistMovement.ts` | Modify | Track zone transitions for traffic, `construct` visual state |
| `src/components/MapBuilding.vue` | Modify | Ghost/wireframe rendering, progress bar for under-construction |
| `src/components/BuildingInfo.vue` | Modify | Show construction progress |
| `src/components/ColonyMap.vue` | Modify | Render worn path SVG lines |
| `src/stores/offlineEngine.ts` | Modify | Offline construction progress |

---

### Task 1: Building Config File

**Files:**
- Create: `src/config/buildings.ts`
- Modify: `src/stores/gameStore.ts`
- Modify: `src/systems/mapLayout.ts`

- [ ] **Step 1: Create the building config file**

Create `src/config/buildings.ts`:

```typescript
import type { BuildingType } from '@/stores/gameStore'

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
}

export const BUILDING_CONFIGS: BuildingConfig[] = [
  {
    type: 'solar',
    label: 'Solar Panel',
    description: 'Generates power for the colony',
    zone: 'power',
    constructionTime: 45,
    costMetals: 15,
    costIce: 0,
    shipmentCost: 800,
    shipmentWeight: 18,
  },
  {
    type: 'o2generator',
    label: 'O2 Generator',
    description: 'Produces breathable air',
    zone: 'lifeSup',
    constructionTime: 60,
    costMetals: 20,
    costIce: 5,
    shipmentCost: 1000,
    shipmentWeight: 32,
  },
  {
    type: 'extractionrig',
    label: 'Extraction Rig',
    description: 'Automated resource extraction',
    zone: 'extraction',
    constructionTime: 50,
    costMetals: 25,
    costIce: 0,
    shipmentCost: 1300,
    shipmentWeight: 55,
  },
  {
    type: 'medbay',
    label: 'Med Bay',
    description: 'Heals injured crew over time',
    zone: 'medical',
    constructionTime: 75,
    costMetals: 30,
    costIce: 10,
    shipmentCost: 1500,
    shipmentWeight: 40,
  },
  {
    type: 'partsfactory',
    label: 'Parts Factory',
    description: 'Produces repair kits (requires operator)',
    zone: 'workshop',
    constructionTime: 60,
    costMetals: 15,
    costIce: 0,
    shipmentCost: 800,
    shipmentWeight: 30,
  },
  {
    type: 'storageSilo',
    label: 'Storage Silo',
    description: 'Increases resource storage capacity',
    zone: 'extraction',
    constructionTime: 20,
    costMetals: 20,
    costIce: 0,
    shipmentCost: 600,
    shipmentWeight: 20,
  },
  {
    type: 'launchplatform',
    label: 'Launch Platform',
    description: 'Export resources to HQ for credits',
    zone: 'landing',
    constructionTime: 90,
    costMetals: 30,
    costIce: 0,
    shipmentCost: null,
    shipmentWeight: null,
  },
]

// Derived lookups
export const BUILDING_CONFIG_MAP: Record<string, BuildingConfig> = Object.fromEntries(
  BUILDING_CONFIGS.map(c => [c.type, c])
)

export function getBuildingConfig(type: BuildingType): BuildingConfig {
  return BUILDING_CONFIG_MAP[type] ?? BUILDING_CONFIGS[0]
}

export function getBuildingLabel(type: BuildingType): string {
  return BUILDING_CONFIG_MAP[type]?.label ?? type
}
```

- [ ] **Step 2: Derive BLUEPRINTS and SHIPMENT_OPTIONS from config**

In `src/stores/gameStore.ts`, replace the hardcoded `BLUEPRINTS` array (around lines 335-385) with a derived version. First add the import near the top:

```typescript
import { BUILDING_CONFIGS, BUILDING_CONFIG_MAP, getBuildingLabel } from '@/config/buildings'
```

Then replace the `BLUEPRINTS` array with:

```typescript
export const BLUEPRINTS: BuildingBlueprint[] = BUILDING_CONFIGS.map(c => ({
  type: c.type,
  label: c.label,
  description: c.description,
  costMetals: c.costMetals,
  costIce: c.costIce,
}))
```

Replace the equipment entries in `SHIPMENT_OPTIONS` (the ones with `type: 'equipment'`) with a derived version. Keep the non-equipment items (Supply Crate, New Colonist, Repair Kit, Emergency O2, Emergency Power) as-is. Replace the full array:

```typescript
const EQUIPMENT_SHIPMENTS: ShipmentOption[] = BUILDING_CONFIGS
  .filter(c => c.shipmentCost !== null)
  .map(c => ({
    type: 'equipment' as ShipmentType,
    label: c.label,
    description: c.description,
    cost: c.shipmentCost!,
    weight: c.shipmentWeight!,
    buildingType: c.type,
  }))

export const SHIPMENT_OPTIONS: ShipmentOption[] = [
  {
    type: 'supplyCrate',
    label: 'Supply Crate',
    description: '+15 metals, +5 ice',
    cost: 600,
    weight: 20,
  },
  ...EQUIPMENT_SHIPMENTS,
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

- [ ] **Step 3: Derive ZONE_FOR_BUILDING from config**

In `src/systems/mapLayout.ts`, replace the hardcoded `ZONE_FOR_BUILDING` (around lines 18-26) with:

```typescript
import { BUILDING_CONFIGS } from '@/config/buildings'

export const ZONE_FOR_BUILDING: Record<string, string> = Object.fromEntries(
  BUILDING_CONFIGS.map(c => [c.type, c.zone])
)
```

Remove the old `import type { BuildingType } from '@/stores/gameStore'` if it was only used for `ZONE_FOR_BUILDING`'s type. Keep it if `getBuildingPosition` still needs `BuildingType`.

- [ ] **Step 4: Verify build**

Run: `bun run build`
Expected: Build succeeds — same behavior, just data moved to config

- [ ] **Step 5: Commit**

```bash
git add src/config/buildings.ts src/stores/gameStore.ts src/systems/mapLayout.ts
git commit -m "refactor: unify building config into src/config/buildings.ts"
```

---

### Task 2: Construction Progress on Building

**Files:**
- Modify: `src/stores/gameStore.ts`

- [ ] **Step 1: Add constructionProgress to Building interface**

Update the `Building` interface (around line 50):

```typescript
export interface Building {
  id: string
  type: BuildingType
  damaged: boolean
  constructionProgress: number | null // null = operational, 0-1 = under construction
  x: number
  y: number
  rotation?: number
}
```

- [ ] **Step 2: Update all building creation sites**

Every place that creates a `Building` object needs `constructionProgress`. Search for `this.buildings.push(` and update:

In `makeStartingBuildings()`: set `constructionProgress: null` (starting buildings are already built).

In `applySupplyDrop` (equipment case): change `constructionProgress: null` to `constructionProgress: 0` — buildings from supply drops start under construction.

In the silo auto-build block: set `constructionProgress: 0`.

In the launch platform auto-build block: set `constructionProgress: 0`.

Every `this.buildings.push({...})` call must include `constructionProgress`.

- [ ] **Step 3: Filter out under-construction buildings from production**

Find all getters/calculations that count operational buildings. They currently check `!b.damaged`. Add `&& b.constructionProgress === null` to each:

- Solar panel count: `b.type === 'solar' && !b.damaged` → `b.type === 'solar' && !b.damaged && b.constructionProgress === null`
- O2 generator count: same pattern
- Extraction rig count: same pattern
- Med bay count: same pattern
- Parts factory count: same pattern
- Storage silo count (in `storageCap` getter): same pattern

Search for `.filter(b => b.type ===` and `.filter(b => !b.damaged` to find all instances.

- [ ] **Step 4: Skip under-construction buildings for hazard damage**

In `checkHazards()`, the meteor hazard targets `undamaged` buildings. Add construction check:

```typescript
const undamaged = this.buildings.filter((b) => !b.damaged && b.constructionProgress === null)
```

- [ ] **Step 5: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat(construction): add constructionProgress to Building, gate production on completion"
```

---

### Task 3: Construct Action Type & AI

**Files:**
- Modify: `src/types/colonist.ts`
- Modify: `src/systems/colonistAI.ts`
- Modify: `src/composables/useColonistMovement.ts`

- [ ] **Step 1: Add construct to ActionType**

In `src/types/colonist.ts`, add `'construct'` after `'load'`:

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
  | 'construct'
```

- [ ] **Step 2: Add construct duration and scoring to colonistAI**

In `src/systems/colonistAI.ts`, add `construct` to the `DURATION` record:

```typescript
  construct:    [20, 40],
```

In `selectAction`, after the REPAIR block, add:

```typescript
  // CONSTRUCT — build under-construction buildings
  if (colonist.energy > 20) {
    const sites = state.buildings.filter(b => b.constructionProgress !== null && b.constructionProgress < 1)
    if (sites.length > 0) {
      const site = sites[0]
      const targetZone = ZONE_FOR_BUILDING[site.type]
      const constructors = countWorkers(state, 'construct', site.id)
      // First constructor gets full score, second gets 30%, third+ negligible
      const workerDiscount = constructors === 0 ? 1.0 : constructors === 1 ? 0.3 : 0.05
      candidates.push({
        type: 'construct',
        targetZone,
        targetId: site.id,
        score: 75 * dirMod.engineer * mod.workUtilityMult * workerDiscount,
      })
    }
  }
```

- [ ] **Step 3: Add construct visual state**

In `src/composables/useColonistMovement.ts`, find the `actionToVisualState` switch. Add:

```typescript
    case 'construct': return 'working'
```

- [ ] **Step 4: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/types/colonist.ts src/systems/colonistAI.ts src/composables/useColonistMovement.ts
git commit -m "feat(construction): add construct action type with AI scoring"
```

---

### Task 4: Construction Tick Logic

**Files:**
- Modify: `src/stores/gameStore.ts`

- [ ] **Step 1: Import building config for construction times**

Add to imports:

```typescript
import { BUILDING_CONFIG_MAP } from '@/config/buildings'
```

(May already be imported from Task 1 — if so, just ensure `BUILDING_CONFIG_MAP` is in the import list.)

- [ ] **Step 2: Add construction progress logic in tick**

In the `tick()` action, after the colonist AI loop (after the XP/specialization/breakdown handling), add:

```typescript
      // Construction progress — engineers at construction sites advance progress
      for (const building of this.buildings) {
        if (building.constructionProgress === null || building.constructionProgress >= 1) continue
        const config = BUILDING_CONFIG_MAP[building.type]
        if (!config) continue

        const zone = config.zone
        const constructors = alive.filter(
          c => c.currentAction?.type === 'construct' &&
               c.currentAction?.targetId === building.id &&
               !c.currentAction?.walkPath?.length
        ).length

        if (constructors === 0) continue

        // Speed scales with workers: 1 = 100%, 2 = 160%, 3 = 200%
        const speedMult = 1 + Math.min(constructors - 1, 2) * 0.6
        const progressPerTick = (1 / config.constructionTime) * speedMult

        building.constructionProgress = Math.min(1, building.constructionProgress + progressPerTick)

        if (building.constructionProgress >= 1) {
          building.constructionProgress = null // now operational
          this.pushMessage(`${config.label} construction complete. Systems online.`, 'event')

          // Award engineering XP to constructors
          for (const c of alive) {
            if (c.currentAction?.type === 'construct' && c.currentAction?.targetId === building.id) {
              awardXP(c, 'engineer')
            }
          }
        }
      }
```

- [ ] **Step 3: Remove auto-build for silos and launch platform**

Find the silo auto-build block (the one that checks `metalsAtCap || iceAtCap`) and remove it entirely. Silos are now ordered from HQ via shipments.

Find the launch platform auto-build block (checks `!this.exportPlatform.built && this.metals >= 30`) and remove it. The launch platform will need to be ordered or handled differently — for now, set `exportPlatform.built = true` when a `launchplatform` building reaches `constructionProgress === null`:

In the construction completion block above, after `building.constructionProgress = null`, add:

```typescript
          // Special: launch platform marks export system as ready
          if (building.type === 'launchplatform') {
            this.exportPlatform.built = true
          }
```

- [ ] **Step 4: Update applySupplyDrop to start construction**

In `applySupplyDrop`, update the equipment case to set `constructionProgress: 0`:

```typescript
          case 'equipment':
            if (item.buildingType) {
              const pos = getBuildingPosition(item.buildingType, this.buildings)
              this.buildings.push({
                id: uid(),
                type: item.buildingType,
                damaged: false,
                constructionProgress: 0,
                x: pos.x,
                y: pos.y,
                rotation: pos.rotation,
              })
              const label =
                BLUEPRINTS.find((b) => b.type === item.buildingType)?.label || item.buildingType
              this.pushMessage(`${label} prefab delivered. Construction starting.`, 'event')
            }
            break
```

- [ ] **Step 5: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat(construction): add construction tick logic, remove auto-build"
```

---

### Task 5: Organic Cluster Placement

**Files:**
- Modify: `src/systems/mapLayout.ts`

- [ ] **Step 1: Replace getBuildingPosition with cluster algorithm**

Replace the existing `getBuildingPosition` function (lines 68-111) with:

```typescript
const ANCHOR_OFFSET = 4.5 // distance from anchor building
const MIN_BUILDING_DISTANCE = 3.5

export function getBuildingPosition(
  type: BuildingType,
  existingBuildings: Building[],
): { x: number; y: number; rotation: number } {
  const zoneId = ZONE_FOR_BUILDING[type]
  const zone = ZONE_MAP[zoneId]
  if (!zone) return { x: 50, y: 50, rotation: 0 }

  const sameZone = existingBuildings.filter(
    b => ZONE_FOR_BUILDING[b.type] === zoneId
  )

  // First building: near zone center with slight offset
  if (sameZone.length === 0) {
    const jitter = 2
    return {
      x: zone.x + (Math.random() - 0.5) * jitter,
      y: zone.y + (Math.random() - 0.5) * jitter,
      rotation: (Math.random() - 0.5) * 6,
    }
  }

  // Cluster growth: anchor to a random existing building
  for (let attempt = 0; attempt < 30; attempt++) {
    const anchor = sameZone[Math.floor(Math.random() * sameZone.length)]
    const angle = Math.random() * Math.PI * 2
    const x = anchor.x + Math.cos(angle) * ANCHOR_OFFSET
    const y = anchor.y + Math.sin(angle) * ANCHOR_OFFSET

    // Check within zone radius
    const dx = x - zone.x
    const dy = y - zone.y
    if (Math.sqrt(dx * dx + dy * dy) > zone.radius) continue

    // Check minimum distance from all buildings
    const tooClose = sameZone.some(b => {
      const bx = b.x - x
      const by = b.y - y
      return Math.sqrt(bx * bx + by * by) < MIN_BUILDING_DISTANCE
    })
    if (tooClose) continue

    return { x, y, rotation: (Math.random() - 0.5) * 10 }
  }

  // Fallback: golden angle spiral
  const count = sameZone.length
  const angle = (count * 2.4) % (Math.PI * 2)
  const ring = Math.min(zone.radius * 0.7, 3 + count * 1.5)
  return {
    x: zone.x + Math.cos(angle) * ring,
    y: zone.y + Math.sin(angle) * ring,
    rotation: (Math.random() - 0.5) * 10,
  }
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/systems/mapLayout.ts
git commit -m "feat(construction): replace random scatter with organic cluster placement"
```

---

### Task 6: Ghost/Wireframe Visual for Construction

**Files:**
- Modify: `src/components/MapBuilding.vue`
- Modify: `src/components/BuildingInfo.vue`

- [ ] **Step 1: Update MapBuilding template for construction state**

In `src/components/MapBuilding.vue`, update the template to show construction visual:

```html
<template>
  <div
    class="map-building"
    :class="[typeClass, { damaged: building.damaged, constructing: isConstructing }]"
    :style="{ left: building.x + '%', top: building.y + '%', transform: `translate(-50%, -50%) scale(var(--marker-scale, 1)) rotate(${building.rotation || 0}deg)` }"
    @click.stop="emit('select', building)"
  >
    <div class="building-sprite">
      <SvgIcon :name="iconName" size="sm" />
    </div>
    <div v-if="building.damaged" class="dmg-badge">
      <SvgIcon name="repair" size="xs" />
    </div>
    <div v-if="isConstructing" class="construction-bar">
      <div class="construction-fill" :style="{ width: (building.constructionProgress! * 100) + '%' }" />
    </div>
    <div v-if="workerCount > 0" class="worker-pips">
      <span v-for="n in workerCount" :key="n" class="worker-pip" :class="typeClass" />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Add isConstructing computed and update workerCount for constructors**

In the script section, add:

```typescript
const isConstructing = computed(() =>
  props.building.constructionProgress !== null && props.building.constructionProgress < 1
)
```

Update the `workerCount` computed to include `construct` action. In the `zoneActions` map, also match `construct` for any zone:

After the existing zone-based worker counting, add a separate check for constructors targeting this specific building:

```typescript
const workerCount = computed(() => {
  // Count constructors targeting this specific building
  if (isConstructing.value) {
    return game.colonists.filter(
      c => c.health > 0 &&
        c.currentAction?.type === 'construct' &&
        c.currentAction?.targetId === props.building.id &&
        !c.currentAction?.walkPath?.length
    ).length
  }

  // Operational buildings: existing zone-based counting
  const zone = ZONE_FOR_BUILDING[props.building.type]
  if (!zone) return 0
  // ... (keep existing logic)
})
```

Merge this carefully with the existing `workerCount` logic — constructing buildings count constructors, operational buildings count zone workers and repairers as before.

- [ ] **Step 3: Add construction CSS**

Add to the `<style scoped>` section:

```css
.constructing .building-sprite {
  border-style: dashed !important;
  opacity: 0.4;
}

.construction-bar {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 3px;
  background: rgba(100, 100, 100, 0.3);
  border-radius: 2px;
  overflow: hidden;
}

.construction-fill {
  height: 100%;
  background: var(--amber, #f5a623);
  border-radius: 2px;
  transition: width 1s linear;
}
```

- [ ] **Step 4: Update BuildingInfo for construction state**

In `src/components/BuildingInfo.vue`, update the status display:

```html
    <div class="info-row">
      <span class="info-label">Status</span>
      <span v-if="isConstructing" class="status-constructing">
        BUILDING {{ Math.round(building.constructionProgress! * 100) }}%
      </span>
      <span v-else :class="building.damaged ? 'status-bad' : 'status-ok'">
        {{ building.damaged ? 'DAMAGED' : 'Operational' }}
      </span>
    </div>
```

Add the computed:

```typescript
const isConstructing = computed(() =>
  props.building.constructionProgress !== null && props.building.constructionProgress < 1
)
```

Add CSS:

```css
.status-constructing {
  color: var(--amber);
}
```

- [ ] **Step 5: Update ColonyMap to hide constructors from map**

In `src/components/ColonyMap.vue`, add `'construct'` to the `INSIDE_ACTIONS` set:

```typescript
const INSIDE_ACTIONS = new Set(['extract', 'engineer', 'repair', 'seek_medical', 'load', 'construct'])
```

- [ ] **Step 6: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/components/MapBuilding.vue src/components/BuildingInfo.vue src/components/ColonyMap.vue
git commit -m "feat(construction): ghost/wireframe visual with progress bar during construction"
```

---

### Task 7: Worn Paths (Desire Lines)

**Files:**
- Modify: `src/stores/gameStore.ts`
- Modify: `src/composables/useColonistMovement.ts`
- Modify: `src/components/ColonyMap.vue`

- [ ] **Step 1: Add zonePaths to ColonyState**

In `ColonyState` interface, add:

```typescript
  zonePaths: Record<string, number>
```

In `freshState()`, add:

```typescript
    zonePaths: {},
```

- [ ] **Step 2: Track zone transitions in colonist movement**

In `src/composables/useColonistMovement.ts`, find where colonists arrive at a new zone (where `colonist.currentZone` changes or where walkPath segments complete). The game store's `advanceAction` already updates `colonist.currentZone` when a walk segment completes.

Instead of tracking in the movement composable, track in the game store tick. After the colonist AI loop, add:

In `src/stores/gameStore.ts`, in the `tick()` action, after the colonist AI loop, add zone transition tracking:

```typescript
      // Track zone transitions for worn paths
      for (const c of alive) {
        const action = c.currentAction
        if (action?.walkPath && action.walkPath.length > 1) {
          // Colonist is walking — will track when they arrive
        } else if (action && !action.walkPath && c.currentZone) {
          // Check if colonist just arrived at a new zone
          const prevZone = _prevZones.get(c.id)
          if (prevZone && prevZone !== c.currentZone) {
            const key = [prevZone, c.currentZone].sort().join(':')
            this.zonePaths[key] = (this.zonePaths[key] ?? 0) + 1
          }
          _prevZones.set(c.id, c.currentZone)
        }
      }
```

Add the tracking map at module level (near `announcedBonds`):

```typescript
const _prevZones = new Map<string, string>()
```

- [ ] **Step 3: Add path decay**

In the tick, after the zone transition tracking, add decay every 60 ticks:

```typescript
      // Decay worn paths
      if (this.ticksSinceLastReport % 60 === 0) {
        for (const key of Object.keys(this.zonePaths)) {
          this.zonePaths[key]--
          if (this.zonePaths[key] <= 0) delete this.zonePaths[key]
        }
      }
```

- [ ] **Step 4: Render worn paths on ColonyMap**

In `src/components/ColonyMap.vue`, add a computed for path data:

```typescript
const wornPaths = computed(() => {
  const paths: { x1: number; y1: number; x2: number; y2: number; opacity: number; width: number }[] = []
  for (const [key, count] of Object.entries(game.zonePaths)) {
    if (count < 10) continue
    const [z1, z2] = key.split(':')
    const zone1 = ZONE_MAP[z1]
    const zone2 = ZONE_MAP[z2]
    if (!zone1 || !zone2) continue

    let opacity = 0.1
    let width = 1
    if (count >= 150) { opacity = 0.35; width = 2 }
    else if (count >= 50) { opacity = 0.2; width = 1.5 }

    paths.push({ x1: zone1.x, y1: zone1.y, x2: zone2.x, y2: zone2.y, opacity, width })
  }
  return paths
})
```

In the template, inside the SVG zone overlay (after the zone circles, before the closing `</svg>`), add:

```html
        <!-- Worn paths from colonist traffic -->
        <line
          v-for="(p, i) in wornPaths"
          :key="'path-' + i"
          :x1="p.x1" :y1="p.y1" :x2="p.x2" :y2="p.y2"
          :stroke="`rgba(200, 200, 200, ${p.opacity})`"
          :stroke-width="p.width"
          stroke-linecap="round"
        />
```

- [ ] **Step 5: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/stores/gameStore.ts src/components/ColonyMap.vue
git commit -m "feat(construction): add worn desire paths from colonist foot traffic"
```

---

### Task 8: Radio Chatter — Construction Messages

**Files:**
- Modify: `src/systems/radioChatter.ts`

- [ ] **Step 1: Add construction message templates**

After the loading templates, add:

```typescript
const CONSTRUCT_START: string[] = [
  '{name}: Starting work on the new {building}.',
  '{name}: Got the blueprints. Building the {building}.',
  '{name}: Assembling the {building}. This\'ll take a bit.',
]

const CONSTRUCT_DONE: string[] = [
  '{name}: {building} construction complete. Systems online.',
  '{name}: {building} is up and running.',
  '{name}: All done — {building} is operational.',
]
```

- [ ] **Step 2: Add construct action check-in to generateChatter**

In the arrival/start messages block, add after the `load` case:

```typescript
      } else if (currType === 'construct' && curr?.targetId) {
        const buildingType = allColonists.length > 0
          ? (state as any)?.buildings?.find((b: any) => b.id === curr.targetId)?.type
          : null
        // Simple fallback — just use generic message if we can't resolve type
        emitMessage(c.id, now, emit, fill(pick(CONSTRUCT_START), {
          name: c.name,
          building: 'structure',
        }))
```

Note: The `generateChatter` function receives colonists but not the full game state. To get the building label, we'd need to pass it in or use a simpler approach. Use the generic word "structure" for now — the construction completion message in the tick already includes the specific building name.

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/systems/radioChatter.ts
git commit -m "feat(construction): add construction radio chatter"
```

---

### Task 9: Offline Construction & Save Migration

**Files:**
- Modify: `src/stores/offlineEngine.ts`
- Modify: `src/stores/gameStore.ts`

- [ ] **Step 1: Add offline construction progress**

In `src/stores/offlineEngine.ts`, in the main simulation loop, after the parts factory block, add:

```typescript
    // Offline construction progress
    const constructionSites = state.buildings.filter(b => b.constructionProgress !== null && b.constructionProgress < 1)
    if (constructionSites.length > 0) {
      const aliveOffline = state.colonists.filter(c => c.health > 0).length
      const engineerRatio = DIRECTIVE_RATIOS[state.activeDirective].engineer
      const engineers = Math.max(1, Math.round(aliveOffline * engineerRatio))

      for (const site of constructionSites) {
        // Assume 1 engineer per site during offline
        const config = BUILDING_CONFIGS.find(c => c.type === site.type)
        if (!config) continue
        const progressPerSec = 1 / config.constructionTime
        site.constructionProgress = Math.min(1, (site.constructionProgress ?? 0) + progressPerSec * phaseDt)
        if (site.constructionProgress >= 1) {
          site.constructionProgress = null
          events.push({ type: 'milestone', severity: 'info', offsetMs: elapsedSoFar, message: `${config.label} construction complete.` })

          // Launch platform special case
          if (site.type === 'launchplatform' && state.exportPlatform) {
            state.exportPlatform.built = true
          }
        }
      }
    }
```

Add the import at top of offlineEngine.ts:

```typescript
import { BUILDING_CONFIGS } from '@/config/buildings'
```

- [ ] **Step 2: Add save migration**

In `src/stores/gameStore.ts`, in `migrateState()`, add:

```typescript
      // v6→v7: Construction progress + zone paths
      for (const b of this.buildings) {
        if ((b as any).constructionProgress === undefined) {
          (b as any).constructionProgress = null // existing buildings are operational
        }
      }
      if (!(this as any).zonePaths) {
        (this as any).zonePaths = {}
      }
```

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/stores/offlineEngine.ts src/stores/gameStore.ts
git commit -m "feat(construction): add offline construction and save migration"
```

---

### Task 10: Final Integration Verification

- [ ] **Step 1: Full build check**

Run: `bun run build`
Expected: Build succeeds with no type errors

- [ ] **Step 2: Manual smoke test**

Run: `bun run dev`

Verify in browser:
1. Start new game — starting buildings are operational (no construction phase for initial)
2. Order a Solar Panel from shipments → arrives as supply drop → colonists unpack → building appears as ghost/wireframe with dashed border
3. Engineers walk to construction site and build — progress bar fills
4. After ~45s (solo engineer), building transitions to solid operational state with radio message
5. Order a Storage Silo (600cr from shipments) — same construction flow, 20s build time
6. Multiple buildings in a zone cluster together (not random scatter)
7. Worn paths begin appearing between habitat and active zones after a few minutes
8. BuildingInfo shows "BUILDING X%" during construction, "Operational" after

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(construction): address integration issues from smoke testing"
```
