# Map Layout & Colonist AI Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rigid zone grid and role-based colonist assignment with an organic zoned map (pan/zoom, path graph, scatter placement) and utility-scored colonist AI (needs, traits, action selection).

**Architecture:** New `src/systems/` directory extracts simulation logic from the monolithic gameStore. Types move to `src/types/`. The gameStore delegates to these systems during tick. The visual layer (useColonistMovement, MapColonist) adapts to the new action-based AI and path-based movement.

**Tech Stack:** Vue 3, Pinia, TypeScript (strict, ES2020, bundler moduleResolution)

**Spec:** `docs/superpowers/specs/2026-03-29-map-and-colonist-ai-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/types/colonist.ts` | Trait, ActionType, Action, updated Colonist interface |
| `src/types/map.ts` | Zone, PathEdge types |
| `src/systems/mapLayout.ts` | Zone definitions, path graph, organic building placement, pathfinding |
| `src/systems/colonistAI.ts` | Needs update, utility scoring, action selection, forced interrupts |

### Modified Files
| File | Changes |
|------|---------|
| `src/stores/gameStore.ts` | Remove `reassignRoles()`, `SLOT_OFFSETS`, `ZONE_FOR_TYPE`, `MAP_ZONES`. Update Colonist type. Delegate AI to `colonistAI.ts`. Update production to activity-based. Save migration v2→v3. |
| `src/composables/useColonistMovement.ts` | Path-based walking between zones. New visual states. Read `currentAction`/`currentZone` from colonist. |
| `src/components/ColonyMap.vue` | Pan/zoom transform wrapper. Zone boundary circles + labels as SVG. Path lines. Remove hardcoded zone markers. |
| `src/components/MapColonist.vue` | New visual states: resting (dimmed), socializing, injured (red tint). Action-based color instead of role-based. |
| `src/components/MapBuilding.vue` | Add rotation prop for organic scatter. |
| `src/stores/offlineEngine.ts` | Update to work with new Colonist shape (no `role` field). Simplified offline production. |

---

## Task 1: Types & Map Layout System

**Files:**
- Create: `src/types/colonist.ts`
- Create: `src/types/map.ts`
- Create: `src/systems/mapLayout.ts`

- [ ] **Step 1: Create `src/types/colonist.ts`**

```typescript
export type Trait = 'hardy' | 'diligent' | 'social' | 'cautious' | 'efficient' | 'stoic'

export type ActionType =
  | 'drill'
  | 'engineer'
  | 'repair'
  | 'unpack'
  | 'rest'
  | 'socialize'
  | 'seek_medical'
  | 'wander'

export interface Action {
  type: ActionType
  targetZone: string
  targetId?: string       // building or drop id
  remainingTicks: number
  walkPath?: string[]     // zone waypoints if walking between zones
}

export const TRAITS: Trait[] = ['hardy', 'diligent', 'social', 'cautious', 'efficient', 'stoic']

export function randomTrait(): Trait {
  return TRAITS[Math.floor(Math.random() * TRAITS.length)]
}
```

- [ ] **Step 2: Create `src/types/map.ts`**

```typescript
import type { BuildingType } from '@/stores/gameStore'

export interface Zone {
  id: string
  x: number
  y: number
  radius: number
  label: string
  color: string
  buildingTypes: BuildingType[]
}

export interface PathEdge {
  from: string
  to: string
  weight: number
}
```

- [ ] **Step 3: Create `src/systems/mapLayout.ts`**

This file defines all zone data, the path graph, organic building placement, and pathfinding.

```typescript
import type { Zone, PathEdge } from '@/types/map'
import type { Building, BuildingType } from '@/stores/gameStore'

// ── Zone Definitions ──

export const ZONES: Zone[] = [
  { id: 'habitat',  x: 50, y: 40, radius: 10, label: 'SEC-A HABITAT', color: '#4af', buildingTypes: [] },
  { id: 'power',    x: 30, y: 25, radius: 9,  label: 'SEC-B POWER',   color: '#f80', buildingTypes: ['solar'] },
  { id: 'lifeSup',  x: 70, y: 25, radius: 9,  label: 'SEC-C LIFESUP', color: '#0ff', buildingTypes: ['o2generator'] },
  { id: 'drill',    x: 50, y: 65, radius: 10, label: 'SEC-D DRILL',   color: '#0f8', buildingTypes: ['drillrig'] },
  { id: 'medical',  x: 75, y: 48, radius: 7,  label: 'SEC-E MED',     color: '#f44', buildingTypes: ['medbay'] },
  { id: 'landing',  x: 25, y: 50, radius: 7,  label: 'LZ-1',          color: '#f80', buildingTypes: [] },
]

export const ZONE_MAP: Record<string, Zone> = Object.fromEntries(ZONES.map(z => [z.id, z]))

export const ZONE_FOR_BUILDING: Record<BuildingType, string> = {
  solar: 'power',
  o2generator: 'lifeSup',
  drillrig: 'drill',
  medbay: 'medical',
}

// ── Path Graph ──

export const PATH_EDGES: PathEdge[] = [
  { from: 'habitat', to: 'power',   weight: 1 },
  { from: 'habitat', to: 'lifeSup', weight: 1 },
  { from: 'habitat', to: 'drill',   weight: 1 },
  { from: 'habitat', to: 'medical', weight: 1 },
  { from: 'habitat', to: 'landing', weight: 1 },
  { from: 'power',   to: 'lifeSup', weight: 1.2 },
]

// Build adjacency list for pathfinding
const adjacency: Record<string, { zone: string; weight: number }[]> = {}
for (const z of ZONES) adjacency[z.id] = []
for (const e of PATH_EDGES) {
  adjacency[e.from].push({ zone: e.to, weight: e.weight })
  adjacency[e.to].push({ zone: e.from, weight: e.weight })
}

/**
 * BFS shortest path between two zones. Returns array of zone IDs
 * including start and end. E.g. ['power', 'habitat', 'drill']
 */
export function findPath(from: string, to: string): string[] {
  if (from === to) return [from]
  const visited = new Set<string>([from])
  const queue: { zone: string; path: string[] }[] = [{ zone: from, path: [from] }]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const neighbor of adjacency[current.zone] || []) {
      if (neighbor.zone === to) return [...current.path, to]
      if (!visited.has(neighbor.zone)) {
        visited.add(neighbor.zone)
        queue.push({ zone: neighbor.zone, path: [...current.path, neighbor.zone] })
      }
    }
  }
  return [from, to] // fallback direct
}

// ── Organic Building Placement ──

const MIN_BUILDING_DISTANCE = 6 // minimum % distance between buildings in same zone

/**
 * Place a building organically within its zone. First building snaps to center,
 * subsequent buildings scatter with collision avoidance.
 */
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

  // First building snaps to center
  if (sameZone.length === 0) {
    return { x: zone.x, y: zone.y, rotation: (Math.random() - 0.5) * 6 }
  }

  // Try random positions within zone radius, pick one with no collisions
  for (let attempt = 0; attempt < 20; attempt++) {
    const angle = Math.random() * Math.PI * 2
    const dist = Math.random() * zone.radius * 0.8 // stay within 80% of radius
    const x = zone.x + Math.cos(angle) * dist
    const y = zone.y + Math.sin(angle) * dist

    const tooClose = sameZone.some(b => {
      const dx = b.x - x
      const dy = b.y - y
      return Math.sqrt(dx * dx + dy * dy) < MIN_BUILDING_DISTANCE
    })

    if (!tooClose) {
      return { x, y, rotation: (Math.random() - 0.5) * 10 }
    }
  }

  // Fallback: offset from center based on count
  const offset = sameZone.length * 4
  const angle = (sameZone.length * 2.4) % (Math.PI * 2) // golden angle-ish
  return {
    x: zone.x + Math.cos(angle) * offset,
    y: zone.y + Math.sin(angle) * offset,
    rotation: (Math.random() - 0.5) * 10,
  }
}

/**
 * Get the landing position for a supply drop within the landing zone.
 */
export function getLandingPosition(): { x: number; y: number } {
  const zone = ZONE_MAP.landing
  const jitterX = (Math.random() - 0.5) * zone.radius
  const jitterY = (Math.random() - 0.5) * zone.radius
  return { x: zone.x + jitterX, y: zone.y + jitterY }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`

This will likely show errors since gameStore still exports the old types. That's expected — we'll fix it in Task 2.

- [ ] **Step 5: Commit**

```bash
git add src/types/colonist.ts src/types/map.ts src/systems/mapLayout.ts
git commit -m "feat: add types and map layout system for organic zones"
```

---

## Task 2: Colonist AI System

**Files:**
- Create: `src/systems/colonistAI.ts`

- [ ] **Step 1: Create `src/systems/colonistAI.ts`**

This is the core utility scoring engine. It handles needs updates, forced interrupts, action selection, and action advancement.

```typescript
import type { Action, ActionType, Trait } from '@/types/colonist'
import type { ColonyState, Building, Directive, SupplyDrop } from '@/stores/gameStore'
import { ZONE_FOR_BUILDING, ZONE_MAP, findPath } from '@/systems/mapLayout'

// ── Constants ──

// Energy drain/recovery per tick
const ENERGY_DRAIN_WORKING = 1.5
const ENERGY_DRAIN_WALKING = 0.5
const ENERGY_RECOVERY_RESTING = 3.0

// Morale drain/recovery per tick
const MORALE_DRAIN_PASSIVE = 0.2
const MORALE_DRAIN_HAZARD = 1.0
const MORALE_RECOVERY_SOCIAL = 2.0
const MORALE_RECOVERY_RESTING = 0.5

// Thresholds
const ENERGY_TIRED = 30
const ENERGY_EXHAUSTED = 10
const MORALE_STRESSED = 25
const MORALE_BREAKING = 10
const HEALTH_SEEK_MEDICAL = 70
const HEALTH_SEEK_MEDICAL_URGENT = 40

// Action durations (ticks)
const DURATION: Record<ActionType, [number, number]> = {
  drill:        [8, 15],
  engineer:     [8, 15],
  repair:       [10, 20],
  unpack:       [5, 10],
  rest:         [10, 25],
  socialize:    [8, 15],
  seek_medical: [15, 30],
  wander:       [5, 10],
}

// Trait modifiers
interface TraitMod {
  energyDrainMult: number
  moraleDrainMult: number
  workUtilityMult: number
  socialUtilityMult: number
  repairUtilityMult: number
  medicalThresholdBonus: number // added to health threshold for seeking medical
  durationMult: number
  walkSpeedMult: number
}

const TRAIT_MODS: Record<Trait, TraitMod> = {
  hardy:     { energyDrainMult: 0.75, moraleDrainMult: 1.0,  workUtilityMult: 1.0,  socialUtilityMult: 1.0,  repairUtilityMult: 1.0,  medicalThresholdBonus: 0,  durationMult: 1.0,  walkSpeedMult: 1.0 },
  diligent:  { energyDrainMult: 1.0,  moraleDrainMult: 1.0,  workUtilityMult: 1.2,  socialUtilityMult: 0.7,  repairUtilityMult: 1.0,  medicalThresholdBonus: 0,  durationMult: 1.0,  walkSpeedMult: 1.0 },
  social:    { energyDrainMult: 1.0,  moraleDrainMult: 1.3,  workUtilityMult: 1.0,  socialUtilityMult: 1.5,  repairUtilityMult: 1.0,  medicalThresholdBonus: 0,  durationMult: 1.0,  walkSpeedMult: 1.0 },
  cautious:  { energyDrainMult: 1.0,  moraleDrainMult: 1.0,  workUtilityMult: 1.0,  socialUtilityMult: 1.0,  repairUtilityMult: 1.5,  medicalThresholdBonus: 15, durationMult: 1.0,  walkSpeedMult: 1.0 },
  efficient: { energyDrainMult: 1.0,  moraleDrainMult: 1.0,  workUtilityMult: 1.0,  socialUtilityMult: 1.0,  repairUtilityMult: 1.0,  medicalThresholdBonus: 0,  durationMult: 0.85, walkSpeedMult: 1.1 },
  stoic:     { energyDrainMult: 1.0,  moraleDrainMult: 0.7,  workUtilityMult: 1.0,  socialUtilityMult: 0.6,  repairUtilityMult: 1.0,  medicalThresholdBonus: 0,  durationMult: 1.0,  walkSpeedMult: 1.0 },
}

// Directive utility modifiers
const DIRECTIVE_UTILITY: Record<Directive, { drill: number; engineer: number; repair: number }> = {
  mining:    { drill: 1.5, engineer: 0.6, repair: 1.0 },
  safety:    { drill: 0.6, engineer: 1.5, repair: 1.5 },
  balanced:  { drill: 1.0, engineer: 1.0, repair: 1.0 },
  emergency: { drill: 0.5, engineer: 2.0, repair: 2.0 },
}

// ── Needs Update ──

export interface ColonistLike {
  id: string
  health: number
  energy: number
  morale: number
  trait: Trait
  currentAction: Action | null
  currentZone: string
}

export function updateNeeds(colonist: ColonistLike): void {
  if (colonist.health <= 0) return
  const mod = TRAIT_MODS[colonist.trait]
  const action = colonist.currentAction

  // Energy
  if (action) {
    if (action.walkPath && action.walkPath.length > 0) {
      colonist.energy = Math.max(0, colonist.energy - ENERGY_DRAIN_WALKING * mod.energyDrainMult)
    } else if (action.type === 'rest') {
      colonist.energy = Math.min(100, colonist.energy + ENERGY_RECOVERY_RESTING)
    } else if (action.type === 'socialize') {
      colonist.energy = Math.min(100, colonist.energy + ENERGY_RECOVERY_RESTING * 0.3)
    } else if (action.type === 'wander') {
      // No drain while wandering
    } else {
      colonist.energy = Math.max(0, colonist.energy - ENERGY_DRAIN_WORKING * mod.energyDrainMult)
    }
  }

  // Morale
  if (action?.type === 'socialize') {
    colonist.morale = Math.min(100, colonist.morale + MORALE_RECOVERY_SOCIAL)
  } else if (action?.type === 'rest') {
    colonist.morale = Math.min(100, colonist.morale + MORALE_RECOVERY_RESTING)
  } else {
    colonist.morale = Math.max(0, colonist.morale - MORALE_DRAIN_PASSIVE * mod.moraleDrainMult)
  }
}

// ── Forced Interrupts ──

export function checkInterrupt(colonist: ColonistLike): boolean {
  if (colonist.health <= 0) return false
  if (colonist.energy <= ENERGY_EXHAUSTED && colonist.currentAction?.type !== 'rest') {
    colonist.currentAction = null // force re-evaluation
    return true
  }
  if (colonist.morale <= MORALE_BREAKING && colonist.currentAction?.type !== 'rest' && colonist.currentAction?.type !== 'socialize') {
    colonist.currentAction = null
    return true
  }
  return false
}

// ── Action Advancement ──

export function advanceAction(colonist: ColonistLike): boolean {
  const action = colonist.currentAction
  if (!action) return true // idle, needs decision

  // If walking between zones, advance walk path
  if (action.walkPath && action.walkPath.length > 1) {
    action.walkPath.shift()
    colonist.currentZone = action.walkPath[0]
    if (action.walkPath.length <= 1) {
      // Arrived at target zone, clear walk path, start the actual action
      action.walkPath = undefined
      action.remainingTicks = getActionDuration(action.type, colonist.trait)
    }
    return false
  }

  action.remainingTicks--
  if (action.remainingTicks <= 0) {
    colonist.currentAction = null
    return true // needs new decision
  }
  return false
}

function getActionDuration(type: ActionType, trait: Trait): number {
  const [min, max] = DURATION[type]
  const base = min + Math.floor(Math.random() * (max - min + 1))
  return Math.max(1, Math.round(base * TRAIT_MODS[trait].durationMult))
}

// ── Utility Scoring ──

interface ScoredAction {
  type: ActionType
  targetZone: string
  targetId?: string
  score: number
}

export function selectAction(
  colonist: ColonistLike,
  state: ColonyState,
): Action | null {
  if (colonist.health <= 0) return null

  const mod = TRAIT_MODS[colonist.trait]
  const dirMod = DIRECTIVE_UTILITY[state.activeDirective]
  const candidates: ScoredAction[] = []

  // DRILL
  if (colonist.energy > 20) {
    const rigs = state.buildings.filter(b => b.type === 'drillrig' && !b.damaged)
    if (rigs.length > 0) {
      const rig = rigs[Math.floor(Math.random() * rigs.length)]
      candidates.push({
        type: 'drill',
        targetZone: 'drill',
        targetId: rig.id,
        score: 50 * dirMod.drill * mod.workUtilityMult,
      })
    }
  }

  // ENGINEER (pick power or lifeSup based on which resource is lower)
  if (colonist.energy > 20) {
    const powerPct = state.powerMax > 0 ? state.power / state.powerMax : 1
    const airPct = state.airMax > 0 ? state.air / state.airMax : 1
    const hasSolar = state.buildings.some(b => b.type === 'solar' && !b.damaged)
    const hasO2 = state.buildings.some(b => b.type === 'o2generator' && !b.damaged)

    if (hasSolar || hasO2) {
      let zone: string
      let targetBuilding: Building | undefined
      if (powerPct <= airPct && hasSolar) {
        zone = 'power'
        const solars = state.buildings.filter(b => b.type === 'solar' && !b.damaged)
        targetBuilding = solars[Math.floor(Math.random() * solars.length)]
      } else if (hasO2) {
        zone = 'lifeSup'
        const o2s = state.buildings.filter(b => b.type === 'o2generator' && !b.damaged)
        targetBuilding = o2s[Math.floor(Math.random() * o2s.length)]
      } else {
        zone = 'power'
        const solars = state.buildings.filter(b => b.type === 'solar' && !b.damaged)
        targetBuilding = solars[Math.floor(Math.random() * solars.length)]
      }

      let emergencyMult = 1.0
      if (powerPct < 0.2) emergencyMult = zone === 'power' ? 3.0 : emergencyMult
      if (airPct < 0.2) emergencyMult = zone === 'lifeSup' ? 3.0 : emergencyMult

      candidates.push({
        type: 'engineer',
        targetZone: zone,
        targetId: targetBuilding?.id,
        score: 45 * dirMod.engineer * mod.workUtilityMult * emergencyMult,
      })
    }
  }

  // REPAIR
  const damaged = state.buildings.filter(b => b.damaged)
  if (damaged.length > 0) {
    const target = damaged[0]
    const targetZone = ZONE_FOR_BUILDING[target.type]
    candidates.push({
      type: 'repair',
      targetZone,
      targetId: target.id,
      score: 80 * dirMod.repair * mod.repairUtilityMult,
    })
  }

  // UNPACK
  const activeDrops = state.supplyDrops.filter(d => d.state === 'landed' || d.state === 'unpacking')
  if (activeDrops.length > 0) {
    const drop = activeDrops[0]
    candidates.push({
      type: 'unpack',
      targetZone: 'landing',
      targetId: drop.id,
      score: 70, // high priority, not modified by directive
    })
  }

  // REST
  {
    let restScore = 10 // baseline
    if (colonist.energy < ENERGY_TIRED) {
      // Exponential rise as energy drops
      restScore = 30 + (ENERGY_TIRED - colonist.energy) * 3
    }
    if (colonist.energy <= ENERGY_EXHAUSTED) {
      restScore = 200 // forced basically
    }
    candidates.push({ type: 'rest', targetZone: 'habitat', score: restScore })
  }

  // SOCIALIZE
  {
    let socialScore = 5
    if (colonist.morale < MORALE_STRESSED) {
      socialScore = 25 + (MORALE_STRESSED - colonist.morale) * 2
    }
    if (colonist.morale <= MORALE_BREAKING) {
      socialScore = 150
    }
    socialScore *= mod.socialUtilityMult
    candidates.push({ type: 'socialize', targetZone: 'habitat', score: socialScore })
  }

  // SEEK_MEDICAL
  const medThreshold = HEALTH_SEEK_MEDICAL + mod.medicalThresholdBonus
  if (colonist.health < medThreshold && state.buildings.some(b => b.type === 'medbay' && !b.damaged)) {
    let medScore = 20
    if (colonist.health < HEALTH_SEEK_MEDICAL_URGENT) {
      medScore = 60 + (HEALTH_SEEK_MEDICAL_URGENT - colonist.health) * 3
    }
    candidates.push({ type: 'seek_medical', targetZone: 'medical', score: medScore })
  }

  // WANDER (fallback)
  candidates.push({ type: 'wander', targetZone: 'habitat', score: 3 })

  if (candidates.length === 0) return null

  // Add noise (±10%)
  for (const c of candidates) {
    c.score *= 0.9 + Math.random() * 0.2
  }

  // Pick highest
  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]

  // Build action with walk path if needed
  const walkPath = colonist.currentZone !== best.targetZone
    ? findPath(colonist.currentZone, best.targetZone)
    : undefined

  const needsWalk = walkPath && walkPath.length > 1

  return {
    type: best.type,
    targetZone: best.targetZone,
    targetId: best.targetId,
    remainingTicks: needsWalk ? walkPath!.length - 1 : getActionDuration(best.type, colonist.trait),
    walkPath: needsWalk ? walkPath : undefined,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`

Still expect errors from gameStore — colonist type mismatch. That's the next task.

- [ ] **Step 3: Commit**

```bash
git add src/systems/colonistAI.ts
git commit -m "feat: add utility-scored colonist AI system"
```

---

## Task 3: Update gameStore — Types, State & Migration

**Files:**
- Modify: `src/stores/gameStore.ts`

This task updates the Colonist type, removes old zone/role code, adds new fields to state, updates `freshState()`, and adds save migration.

- [ ] **Step 1: Update Colonist interface and remove ColonistRole**

In `src/stores/gameStore.ts`, replace the old Colonist type:

```typescript
// Remove:
export type ColonistRole = 'driller' | 'engineer' | 'idle'

export interface Colonist {
  id: string
  name: string
  role: ColonistRole
  health: number
}

// Replace with:
import type { Trait, Action } from '@/types/colonist'
import { randomTrait } from '@/types/colonist'

export interface Colonist {
  id: string
  name: string
  health: number
  energy: number
  morale: number
  trait: Trait
  currentAction: Action | null
  currentZone: string
}
```

- [ ] **Step 2: Remove old zone/slot code**

Delete from gameStore.ts:
- `MAP_ZONES` export (lines ~288-294)
- `ZONE_FOR_TYPE` const (lines ~296-301)
- `SLOT_OFFSETS` const (lines ~303-310)
- `getBuildingPosition()` function (lines ~312-322)
- `LANDING_ZONE` const (line ~87)

**Keep `DIRECTIVE_RATIOS`** — it is still used by the offline engine and directive modifiers. Do NOT delete it.

Add import at top:
```typescript
import { getBuildingPosition, getLandingPosition, ZONE_MAP } from '@/systems/mapLayout'
```

- [ ] **Step 3: Update `freshState()` colonists**

Replace the `makeStartingColonists()` calls to include new fields:

```typescript
function makeStartingColonists(): Colonist[] {
  return [
    { id: uid(), name: 'Riko', health: 100, energy: 80, morale: 70, trait: randomTrait(), currentAction: null, currentZone: 'habitat' },
    { id: uid(), name: 'Sable', health: 100, energy: 80, morale: 70, trait: randomTrait(), currentAction: null, currentZone: 'habitat' },
  ]
}
```

- [ ] **Step 4: Update `newColonist` creation in `applySupplyDrop()`**

Replace the `newColonist` case:

```typescript
case 'newColonist': {
  const usedNames = new Set(this.colonists.map((c) => c.name))
  const available = COLONIST_NAMES.filter((n) => !usedNames.has(n))
  const name = available.length > 0
    ? available[Math.floor(Math.random() * available.length)]
    : `Crew-${this.colonists.length + 1}`
  this.colonists.push({
    id: uid(), name, health: 100,
    energy: 80, morale: 70, trait: randomTrait(),
    currentAction: null, currentZone: 'habitat',
  })
  this.pushMessage(`${name} has joined the colony.`, 'event')
  break
}
```

- [ ] **Step 5: Update supply drop spawning to use landing zone**

In `processShipments()`, replace `LANDING_ZONE` usage:

```typescript
// Replace:
// x: LANDING_ZONE.x + jitterX,
// y: LANDING_ZONE.y + jitterY,

// With:
const landingPos = getLandingPosition()
// ...
x: landingPos.x,
y: landingPos.y,
```

Remove the `jitterX`/`jitterY` calculations since `getLandingPosition()` already includes jitter.

- [ ] **Step 6: Update `migrateState()` for v2→v3**

Update `SAVE_KEY` to `'colony-save-v3'` and add migration logic. Also load v2 saves:

```typescript
const SAVE_KEY = 'colony-save-v3'
const LEGACY_SAVE_KEY = 'colony-save-v2'
```

In `load()`, try v3 first, then fall back to v2:

```typescript
async load() {
  for (const key of [SAVE_KEY, LEGACY_SAVE_KEY]) {
    try {
      const { value } = await Preferences.get({ key })
      if (value) {
        const parsed = JSON.parse(value) as Partial<ColonyState>
        this.$patch(parsed)
        this.migrateState()
        return
      }
    } catch { /* fall through */ }
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ColonyState>
      this.$patch(parsed)
      this.migrateState()
      return
    }
  }
},
```

Update `migrateState()`:

```typescript
migrateState() {
  // v2→v3: Add new colonist fields
  for (const c of this.colonists) {
    if ((c as any).energy === undefined) c.energy = 80
    if ((c as any).morale === undefined) c.morale = 70
    if ((c as any).trait === undefined) c.trait = randomTrait()
    if ((c as any).currentAction === undefined) c.currentAction = null
    if ((c as any).currentZone === undefined) c.currentZone = 'habitat'
    // Remove deprecated role field
    delete (c as any).role
  }

  // Recalculate building positions with organic scatter
  for (const b of this.buildings) {
    const pos = getBuildingPosition(
      b.type,
      this.buildings.filter(ob => ob.id !== b.id),
    )
    b.x = pos.x
    b.y = pos.y
    ;(b as any).rotation = pos.rotation
  }

  // Backfill other fields (from v1 migrations)
  if (this.credits === undefined) this.credits = 50
  if (this.totalCreditsEarned === undefined) this.totalCreditsEarned = 50
  if (this.activeDirective === undefined) this.activeDirective = 'balanced'
  if (!this.messages) this.messages = []
  if (!this.inTransitShipments) this.inTransitShipments = []
  if (!this.supplyDrops) this.supplyDrops = []
  if (!this.manifest) this.manifest = []
  if (this.shipmentCooldownUntil === undefined) this.shipmentCooldownUntil = 0
  if (this.ticksSinceLastReport === undefined) this.ticksSinceLastReport = 0
  if (!this.offlineEvents) this.offlineEvents = []
},
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx vue-tsc --noEmit 2>&1 | head -30`

Fix any remaining type errors. The getters that reference `c.role` will need updating (next task).

- [ ] **Step 8: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat: update colonist type, remove old zones, add save migration"
```

---

## Task 4: Update gameStore — Tick, Production & Getters

**Files:**
- Modify: `src/stores/gameStore.ts`

This task rewires the tick loop to use the new AI system and updates production to be activity-based.

- [ ] **Step 1: Add colonistAI import**

```typescript
import { updateNeeds, checkInterrupt, advanceAction, selectAction } from '@/systems/colonistAI'
```

- [ ] **Step 2: Replace `reassignRoles()` with AI tick in `tick()`**

Replace `this.reassignRoles()` call with:

```typescript
// Colonist AI
for (const c of alive) {
  updateNeeds(c)
  const interrupted = checkInterrupt(c)
  if (!interrupted) {
    const needsDecision = advanceAction(c)
    if (needsDecision) {
      c.currentAction = selectAction(c, this.$state)
    }
  } else {
    c.currentAction = selectAction(c, this.$state)
  }
}
```

- [ ] **Step 3: Update production to be activity-based**

Replace the power/air/drill sections in `tick()`. Instead of counting by role, count by who is actively working:

```typescript
// Count active workers by zone
const workersAtPower = alive.filter(
  c => c.currentAction?.type === 'engineer' && c.currentAction?.targetZone === 'power' && !c.currentAction?.walkPath?.length
).length
const workersAtLifeSup = alive.filter(
  c => c.currentAction?.type === 'engineer' && c.currentAction?.targetZone === 'lifeSup' && !c.currentAction?.walkPath?.length
).length
const activeDrillers = alive.filter(
  c => c.currentAction?.type === 'drill' && !c.currentAction?.walkPath?.length
).length

const mod = DIRECTIVE_MODIFIERS[this.activeDirective]

// Power
const solars = this.buildings.filter((b) => b.type === 'solar' && !b.damaged).length
const activeBuildings = this.buildings.filter((b) => !b.damaged).length
const powerEngBonus = (1 + workersAtPower * ENGINEER_EFFICIENCY_BONUS) * mod.prodMult
const powerProd = solars * POWER_PRODUCTION_PER_SOLAR * powerEngBonus
const powerCons = activeBuildings * POWER_CONSUMPTION_PER_BUILDING
this.power = Math.min(this.powerMax, Math.max(0, this.power + (powerProd - powerCons) * dt))

// Air
const generators = this.buildings.filter((b) => b.type === 'o2generator' && !b.damaged).length
const airEngBonus = (1 + workersAtLifeSup * ENGINEER_EFFICIENCY_BONUS) * mod.prodMult
const airProd = this.power > 0 ? generators * O2_PRODUCTION_PER_GENERATOR * airEngBonus : 0
const airCons = alive.length * AIR_CONSUMPTION_PER_COLONIST
this.air = Math.min(this.airMax, Math.max(0, this.air + (airProd - airCons) * dt))

// Drilling + credit income
const rigCount = this.buildings.filter((b) => b.type === 'drillrig' && !b.damaged).length
const drillEngBonus = 1 + (workersAtPower + workersAtLifeSup) * ENGINEER_EFFICIENCY_BONUS
const drillSpeed = (activeDrillers * DRILL_SPEED_PER_DRILLER + rigCount * DRILL_SPEED_PER_RIG) * drillEngBonus * mod.drillMult
```

- [ ] **Step 4: Update getters to be activity-based**

Replace the role-based getters:

```typescript
getters: {
  aliveColonists: (s) => s.colonists.filter((c) => c.health > 0),

  // Workers actively doing engineer work (not walking)
  activeEngineers: (s) => s.colonists.filter(
    c => c.health > 0 && c.currentAction?.type === 'engineer' && !c.currentAction?.walkPath?.length
  ),

  // Workers actively drilling (not walking)
  activeDrillers: (s) => s.colonists.filter(
    c => c.health > 0 && c.currentAction?.type === 'drill' && !c.currentAction?.walkPath?.length
  ),

  engineerBonus(s): number {
    const atPower = s.colonists.filter(
      c => c.health > 0 && c.currentAction?.type === 'engineer' && c.currentAction?.targetZone === 'power' && !c.currentAction?.walkPath?.length
    ).length
    const atLifeSup = s.colonists.filter(
      c => c.health > 0 && c.currentAction?.type === 'engineer' && c.currentAction?.targetZone === 'lifeSup' && !c.currentAction?.walkPath?.length
    ).length
    const count = atPower + atLifeSup
    const mod = DIRECTIVE_MODIFIERS[s.activeDirective].prodMult
    return (1 + count * ENGINEER_EFFICIENCY_BONUS) * mod
  },

  airRate(s): number {
    const alive = s.colonists.filter((c) => c.health > 0).length
    const consumption = alive * AIR_CONSUMPTION_PER_COLONIST
    const generators = s.buildings.filter((b) => b.type === 'o2generator' && !b.damaged).length
    const workersAtLifeSup = s.colonists.filter(
      c => c.health > 0 && c.currentAction?.type === 'engineer' && c.currentAction?.targetZone === 'lifeSup' && !c.currentAction?.walkPath?.length
    ).length
    const mod = DIRECTIVE_MODIFIERS[s.activeDirective].prodMult
    const engBonus = (1 + workersAtLifeSup * ENGINEER_EFFICIENCY_BONUS) * mod
    const production = s.power > 0 ? generators * O2_PRODUCTION_PER_GENERATOR * engBonus : 0
    return production - consumption
  },

  powerRate(s): number {
    const solars = s.buildings.filter((b) => b.type === 'solar' && !b.damaged).length
    const workersAtPower = s.colonists.filter(
      c => c.health > 0 && c.currentAction?.type === 'engineer' && c.currentAction?.targetZone === 'power' && !c.currentAction?.walkPath?.length
    ).length
    const mod = DIRECTIVE_MODIFIERS[s.activeDirective].prodMult
    const engBonus = (1 + workersAtPower * ENGINEER_EFFICIENCY_BONUS) * mod
    const production = solars * POWER_PRODUCTION_PER_SOLAR * engBonus
    const activeBuildings = s.buildings.filter((b) => !b.damaged).length
    const consumption = activeBuildings * POWER_CONSUMPTION_PER_BUILDING
    return production - consumption
  },

  drillRate(s): number {
    const activeDrillers = s.colonists.filter(
      c => c.health > 0 && c.currentAction?.type === 'drill' && !c.currentAction?.walkPath?.length
    ).length
    const rigCount = s.buildings.filter((b) => b.type === 'drillrig' && !b.damaged).length
    const totalEngineers = s.colonists.filter(
      c => c.health > 0 && c.currentAction?.type === 'engineer' && !c.currentAction?.walkPath?.length
    ).length
    const mod = DIRECTIVE_MODIFIERS[s.activeDirective].drillMult
    const engBonus = 1 + totalEngineers * ENGINEER_EFFICIENCY_BONUS
    return (activeDrillers * DRILL_SPEED_PER_DRILLER + rigCount * DRILL_SPEED_PER_RIG) * engBonus * mod
  },

  creditRate(s): number {
    const activeDrillers = s.colonists.filter(
      c => c.health > 0 && c.currentAction?.type === 'drill' && !c.currentAction?.walkPath?.length
    ).length
    const rigCount = s.buildings.filter((b) => b.type === 'drillrig' && !b.damaged).length
    const totalEngineers = s.colonists.filter(
      c => c.health > 0 && c.currentAction?.type === 'engineer' && !c.currentAction?.walkPath?.length
    ).length
    const mod = DIRECTIVE_MODIFIERS[s.activeDirective].drillMult
    const engBonus = 1 + totalEngineers * ENGINEER_EFFICIENCY_BONUS
    const rate = (activeDrillers * DRILL_SPEED_PER_DRILLER + rigCount * DRILL_SPEED_PER_RIG) * engBonus * mod
    return BASE_CREDITS_PER_TICK + rate * METALS_PER_DEPTH * CREDITS_PER_METAL_MINED
  },
```

- [ ] **Step 5: Delete `reassignRoles()` entirely**

Remove the entire `reassignRoles()` method from the actions block.

- [ ] **Step 6: Add urgent event triggers**

In `processShipments()`, after spawning a supply drop, trigger re-evaluation for idle colonists:

```typescript
// After pushing to supplyDrops:
for (const c of this.colonists) {
  if (c.health > 0 && (!c.currentAction || c.currentAction.type === 'wander')) {
    c.currentAction = selectAction(c, this.$state)
  }
}
```

Similarly in `checkHazards()`, after damaging a building:

```typescript
// After setting target.damaged = true:
for (const c of this.colonists) {
  if (c.health > 0 && (!c.currentAction || c.currentAction.type === 'wander' || c.currentAction.type === 'drill')) {
    c.currentAction = selectAction(c, this.$state)
  }
}
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx vue-tsc --noEmit 2>&1 | head -30`

- [ ] **Step 8: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat: wire colonist AI into tick loop, activity-based production"
```

---

## Task 5: Update Colonist Movement Composable

**Files:**
- Modify: `src/composables/useColonistMovement.ts`

This task rewrites the visual state machine to read from the new AI system (currentAction, currentZone) and walk along path graph waypoints.

- [ ] **Step 1: Rewrite `useColonistMovement.ts`**

The movement composable now reads colonist `currentAction` and `currentZone` to determine visual position and state, instead of independently choosing targets.

```typescript
import { ref, watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { Colonist } from '@/stores/gameStore'
import { ZONE_MAP } from '@/systems/mapLayout'
import type { ActionType } from '@/types/colonist'

export type VisualState = 'walking' | 'working' | 'resting' | 'socializing' | 'injured' | 'idle'

export interface ColonistMapState {
  colonistId: string
  x: number
  y: number
  targetX: number
  targetY: number
  visualState: VisualState
  transitionMs: number
  assignedDropId: string | null
}

const WALK_SPEED = 8
const UNPACK_WORK_TIME = 1500

function jitter(base: number, range: number): number {
  return base + (Math.random() - 0.5) * range
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function actionToVisualState(action: ActionType | null, colonist: Colonist): VisualState {
  if (!action) return 'idle'
  switch (action) {
    case 'rest': return 'resting'
    case 'socialize': return 'socializing'
    case 'seek_medical': return colonist.health < 40 ? 'injured' : 'walking'
    case 'wander': return 'idle'
    default: return 'working'
  }
}

export function useColonistMovement() {
  const game = useGameStore()
  const positions = ref<Map<string, ColonistMapState>>(new Map())

  function getOrCreate(colonistId: string): ColonistMapState {
    let state = positions.value.get(colonistId)
    if (!state) {
      const zone = ZONE_MAP.habitat
      const startX = jitter(zone.x, 8)
      const startY = jitter(zone.y, 8)
      state = {
        colonistId,
        x: startX,
        y: startY,
        targetX: startX,
        targetY: startY,
        visualState: 'idle',
        transitionMs: 0,
        assignedDropId: null,
      }
      positions.value.set(colonistId, state)
    }
    return state
  }

  function colonistsAtDrop(dropId: string): number {
    let count = 0
    for (const ms of positions.value.values()) {
      if (ms.assignedDropId === dropId) count++
    }
    return count
  }

  function update(_dtMs: number) {
    for (const colonist of game.colonists) {
      const ms = getOrCreate(colonist.id)

      if (colonist.health <= 0) {
        ms.visualState = 'idle'
        ms.transitionMs = 0
        ms.assignedDropId = null
        continue
      }

      const action = colonist.currentAction

      // Determine target position based on action and zone
      if (!action) {
        // Idle at current position, gentle wander
        ms.visualState = 'idle'
        ms.transitionMs = 0
        ms.assignedDropId = null
        continue
      }

      // Walking between zones (action has walkPath with >1 entries)
      if (action.walkPath && action.walkPath.length > 1) {
        const nextZoneId = action.walkPath[1] // next zone to walk toward
        const nextZone = ZONE_MAP[nextZoneId]
        if (nextZone) {
          const tx = clamp(jitter(nextZone.x, 3), 5, 95)
          const ty = clamp(jitter(nextZone.y, 3), 12, 92)
          if (ms.targetX !== tx || ms.targetY !== ty) {
            ms.targetX = tx
            ms.targetY = ty
            ms.x = tx
            ms.y = ty
            const d = dist(ms.x, ms.y, tx, ty) || 10
            ms.transitionMs = (d / WALK_SPEED) * 1000
          }
        }
        ms.visualState = colonist.health < 40 ? 'injured' : 'walking'
        ms.assignedDropId = null
        continue
      }

      // At target zone, doing the action
      const zone = ZONE_MAP[action.targetZone] || ZONE_MAP.habitat

      // Find specific target (building or drop)
      let targetX = zone.x
      let targetY = zone.y

      if (action.targetId) {
        if (action.type === 'unpack') {
          const drop = game.supplyDrops.find(d => d.id === action.targetId)
          if (drop) {
            targetX = drop.x
            targetY = drop.y
            ms.assignedDropId = drop.id

            // Advance unpack progress
            if (drop.state === 'landed') drop.state = 'unpacking'
            if (drop.state === 'unpacking') {
              const workers = colonistsAtDrop(drop.id)
              const rate = workers * Math.pow(0.8, workers - 1)
              drop.unpackProgress = Math.min(
                1,
                drop.unpackProgress + (UNPACK_WORK_TIME / drop.unpackDuration) * rate,
              )
              if (drop.unpackProgress >= 1) {
                game.applySupplyDrop(drop)
                drop.state = 'done'
                drop.landedAt = game.totalPlaytimeMs
                ms.assignedDropId = null
              }
            }
          }
        } else {
          const building = game.buildings.find(b => b.id === action.targetId)
          if (building) {
            targetX = building.x
            targetY = building.y
          }
        }
      }

      // Add jitter around target
      const jx = clamp(jitter(targetX, 4), 5, 95)
      const jy = clamp(jitter(targetY, 4), 12, 92)

      // Only update position if we haven't set it yet for this action
      if (ms.visualState === 'walking' || ms.targetX !== jx) {
        const d = dist(ms.x, ms.y, jx, jy)
        if (d > 2) {
          ms.targetX = jx
          ms.targetY = jy
          ms.x = jx
          ms.y = jy
          ms.transitionMs = (d / WALK_SPEED) * 1000
          ms.visualState = 'walking'
          continue
        }
      }

      ms.x = jx
      ms.y = jy
      ms.targetX = jx
      ms.targetY = jy
      ms.transitionMs = 0
      ms.visualState = actionToVisualState(action.type, colonist)
      if (action.type !== 'unpack') ms.assignedDropId = null
    }

    // Trigger reactivity
    positions.value = new Map(positions.value)
  }

  watch(
    () => game.lastTickAt,
    () => update(1000),
  )

  return { positions, getOrCreate }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/composables/useColonistMovement.ts
git commit -m "feat: rewrite colonist movement for path-based AI"
```

---

## Task 6: Update Visual Components

**Files:**
- Modify: `src/components/ColonyMap.vue`
- Modify: `src/components/MapColonist.vue`
- Modify: `src/components/MapBuilding.vue`

- [ ] **Step 1: Update ColonyMap.vue — zone overlays and path lines**

Replace the hardcoded zone markers and add SVG zone boundaries and paths. Add a pan/zoom transform wrapper.

Replace the template:

```vue
<template>
  <div class="colony-map" ref="mapContainer"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @dblclick="resetView"
  >
    <!-- Scan line overlay (outside transform) -->
    <div class="scanlines" />

    <!-- Pan/zoom content -->
    <div class="map-content" :style="transformStyle">
      <!-- Zone boundaries and paths (SVG) -->
      <svg class="zone-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
        <!-- Path lines -->
        <line v-for="(edge, i) in pathEdges" :key="'p'+i"
          :x1="edge.x1" :y1="edge.y1" :x2="edge.x2" :y2="edge.y2"
          stroke="var(--accent-dim)" stroke-width="0.3" opacity="0.12"
        />
        <!-- Zone circles -->
        <circle v-for="zone in zones" :key="zone.id"
          :cx="zone.x" :cy="zone.y" :r="zone.radius"
          fill="none" :stroke="zone.color" stroke-width="0.2"
          stroke-dasharray="1.5,1" opacity="0.15"
        />
      </svg>

      <!-- Zone labels -->
      <div v-for="zone in zones" :key="'label-'+zone.id"
        class="zone-marker"
        :style="{ left: zone.x + '%', top: (zone.y - zone.radius - 2) + '%', color: zone.color }"
      >
        {{ zone.label }}
      </div>

      <!-- Terrain craters -->
      <div class="crater" style="left: 15%; top: 55%; width: 40px; height: 40px" />
      <div class="crater" style="left: 85%; top: 75%; width: 25px; height: 25px" />
      <div class="crater" style="left: 40%; top: 15%; width: 30px; height: 30px" />
      <div class="crater" style="left: 60%; top: 65%; width: 20px; height: 20px" />
      <div class="crater" style="left: 10%; top: 30%; width: 18px; height: 18px" />
      <div class="crater" style="left: 90%; top: 40%; width: 22px; height: 22px" />
      <div class="crater sm" style="left: 35%; top: 85%; width: 14px; height: 14px" />
      <div class="crater sm" style="left: 75%; top: 88%; width: 12px; height: 12px" />

      <!-- Habitat ring -->
      <div class="habitat-ring" />

      <!-- Buildings -->
      <MapBuilding v-for="b in game.buildings" :key="b.id" :building="b" />

      <!-- Supply drops -->
      <MapSupplyDrop v-for="d in game.supplyDrops" :key="d.id" :drop="d" />

      <!-- Colonists -->
      <MapColonist
        v-for="c in game.colonists"
        :key="c.id"
        :colonist="c"
        :x="getColonistState(c.id).x"
        :y="getColonistState(c.id).y"
        :visual-state="getColonistState(c.id).visualState"
        :transition-ms="getColonistState(c.id).transitionMs"
      />
    </div>

    <!-- HUD (outside transform) -->
    <HazardAlert />
    <ResourceHud />

    <!-- Live feed indicator -->
    <div class="feed-indicator">
      <span class="feed-dot" />
      <span class="feed-text">LIVE</span>
    </div>
  </div>
</template>
```

Update the script:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useColonistMovement } from '@/composables/useColonistMovement'
import { ZONES, PATH_EDGES, ZONE_MAP } from '@/systems/mapLayout'
import HazardAlert from './HazardAlert.vue'
import ResourceHud from './ResourceHud.vue'
import MapBuilding from './MapBuilding.vue'
import MapColonist from './MapColonist.vue'
import MapSupplyDrop from './MapSupplyDrop.vue'

const game = useGameStore()
const { positions, getOrCreate } = useColonistMovement()

const zones = ZONES
const pathEdges = PATH_EDGES.map(e => ({
  x1: ZONE_MAP[e.from].x,
  y1: ZONE_MAP[e.from].y,
  x2: ZONE_MAP[e.to].x,
  y2: ZONE_MAP[e.to].y,
}))

function getColonistState(id: string) {
  return positions.value.get(id) || getOrCreate(id)
}

// Pan & Zoom
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const lastPointer = ref({ x: 0, y: 0 })

const transformStyle = computed(() => ({
  transform: `scale(${zoom.value}) translate(${panX.value}px, ${panY.value}px)`,
  transformOrigin: 'center center',
}))

function onWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  zoom.value = Math.min(2.0, Math.max(0.8, zoom.value + delta))
}

function onPointerDown(e: PointerEvent) {
  isPanning.value = true
  lastPointer.value = { x: e.clientX, y: e.clientY }
}

function onPointerMove(e: PointerEvent) {
  if (!isPanning.value) return
  const dx = e.clientX - lastPointer.value.x
  const dy = e.clientY - lastPointer.value.y
  panX.value += dx / zoom.value
  panY.value += dy / zoom.value
  lastPointer.value = { x: e.clientX, y: e.clientY }
}

function onPointerUp() {
  isPanning.value = false
}

function resetView() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}
</script>
```

Add CSS for `.map-content` and `.zone-overlay`:

```css
.map-content {
  position: absolute;
  inset: 0;
  transition: transform 0.15s ease-out;
}

.zone-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}
```

- [ ] **Step 2: Update MapColonist.vue**

Update props to accept `visualState` instead of `state`, and add new visual state classes:

Props:
```typescript
const props = defineProps<{
  colonist: Colonist
  x: number
  y: number
  visualState: 'walking' | 'working' | 'resting' | 'socializing' | 'injured' | 'idle'
  transitionMs: number
}>()
```

Replace `roleClass` computed with `stateClass`:
```typescript
const stateClass = computed(() => {
  const action = props.colonist.currentAction?.type
  // Color by action type instead of role
  if (action === 'drill') return 'action-drill'
  if (action === 'engineer') return 'action-engineer'
  if (action === 'repair') return 'action-repair'
  if (action === 'unpack') return 'action-unpack'
  if (action === 'seek_medical') return 'action-medical'
  return 'action-idle'
})
```

Update template class binding:
```html
:class="[stateClass, visualState, { dead: colonist.health <= 0 }]"
```

Add new CSS classes:
```css
.action-drill .colonist-dot { background: var(--green); box-shadow: 0 0 6px var(--green-glow); }
.action-engineer .colonist-dot { background: var(--amber); box-shadow: 0 0 6px var(--amber-glow); }
.action-repair .colonist-dot { background: var(--amber); box-shadow: 0 0 6px var(--amber-glow); }
.action-unpack .colonist-dot { background: var(--cyan); box-shadow: 0 0 6px var(--cyan-glow); }
.action-medical .colonist-dot { background: var(--red); box-shadow: 0 0 6px var(--red-glow); }
.action-idle .colonist-dot { background: var(--text-muted); box-shadow: 0 0 4px var(--accent-dim); }

.resting .colonist-dot { opacity: 0.4; animation: rest-pulse 3s ease-in-out infinite; }
.socializing .colonist-dot { opacity: 0.7; }
.injured .colonist-dot { background: var(--red) !important; opacity: 0.6; }

@keyframes rest-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.5; }
}
```

- [ ] **Step 3: Update MapBuilding.vue — add rotation**

Add rotation to the style binding:

```html
:style="{ left: building.x + '%', top: building.y + '%', transform: `translate(-50%, -50%) rotate(${building.rotation || 0}deg)` }"
```

Update the Building interface in gameStore to include optional `rotation`:
```typescript
export interface Building {
  id: string
  type: BuildingType
  damaged: boolean
  x: number
  y: number
  rotation?: number
}
```

Update `applySupplyDrop()` equipment case to store rotation:
```typescript
const pos = getBuildingPosition(item.buildingType, this.buildings)
this.buildings.push({
  id: uid(),
  type: item.buildingType,
  damaged: false,
  x: pos.x,
  y: pos.y,
  rotation: pos.rotation,
})
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx vue-tsc --noEmit 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add src/components/ColonyMap.vue src/components/MapColonist.vue src/components/MapBuilding.vue src/stores/gameStore.ts
git commit -m "feat: add pan/zoom, zone overlays, action-based colonist visuals"
```

---

## Task 7: Update Offline Engine

**Files:**
- Modify: `src/stores/offlineEngine.ts`

The offline engine references `ColonistRole` and `reassignRoles()`. It needs to work with the new colonist shape.

- [ ] **Step 1: Simplify offline engine colonist handling**

The offline engine doesn't need to run full utility AI. It can use a simplified production model:
- Count alive colonists and buildings
- Derive approximate driller/engineer counts from the directive ratios (same as old `reassignRoles` logic but without mutating the colonist)
- Keep the existing rate computation structure

Update imports to not reference `ColonistRole`. Replace any `c.role` references with derived counts from directive ratios.

In `computeRates()`, replace:
```typescript
// Old: const drillerCount = state.colonists.filter(c => c.health > 0 && c.role === 'driller').length
// New: derive from directive ratios
const alive = state.colonists.filter(c => c.health > 0).length
const ratio = DIRECTIVE_RATIOS[state.activeDirective]
const drillerCount = Math.round(alive * ratio.driller)
const engineerCount = Math.round(alive * ratio.engineer)
```

In `reassignRoles()` inside the offline engine, since we can't set `c.role` anymore, just compute target counts for rate calculation without mutating colonists.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx vue-tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/stores/offlineEngine.ts
git commit -m "fix: update offline engine for new colonist model"
```

---

## Task 8: Fix Remaining References & Build Verification

**Files:**
- Modify: Various files that reference old types

- [ ] **Step 1: Search for remaining `c.role` or `ColonistRole` references**

Run: `grep -rn 'c\.role\|ColonistRole\|\.role ==\|role-driller\|role-engineer\|role-idle' src/`

Fix every hit. Common locations:
- `CommandConsole.vue` status bar may show directive mode label (should be fine, it reads `activeDirective`)
- `DirectivePanel.vue` — check for role references
- Any component that reads `colonist.role`

- [ ] **Step 2: Search for remaining `MAP_ZONES` imports**

Run: `grep -rn 'MAP_ZONES\|SLOT_OFFSETS\|ZONE_FOR_TYPE\|LANDING_ZONE' src/`

Fix any remaining imports to use `ZONE_MAP` from `@/systems/mapLayout`.

- [ ] **Step 3: Search for old movement state type**

Run: `grep -rn "'walking' | 'working' | 'idle'" src/`

Ensure all references use the new `VisualState` type from `useColonistMovement.ts`.

- [ ] **Step 4: Full TypeScript check**

Run: `npx vue-tsc --noEmit`

Fix all errors until this passes cleanly.

- [ ] **Step 5: Build check**

Run: `bun run build`

Verify the production build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix: resolve all type errors and build issues"
```

---

## Task 9: Manual Smoke Test & Tuning

- [ ] **Step 1: Start dev server**

Run: `bun run dev`

- [ ] **Step 2: Verify fresh game starts**

Open browser. Check:
- Colony map renders with zone boundaries and labels
- Buildings appear with organic scatter and slight rotation
- Path lines visible between zones
- Colonists spawn at habitat

- [ ] **Step 3: Verify colonist AI behavior**

Watch colonists for 30-60 seconds:
- Colonists should walk along paths to their assigned zones
- After working for a while, some should head back to habitat to rest
- Resource rates should fluctuate as colonists move between work/rest
- Low energy colonists should visibly head home

- [ ] **Step 4: Verify pan/zoom**

- Scroll to zoom in/out (0.8x–2.0x range)
- Click-drag to pan
- Double-click to reset view
- HUD stays fixed while map transforms

- [ ] **Step 5: Verify directive changes affect behavior**

Switch between Mining/Safety/Balanced/Emergency directives. Watch colonists redistribute over 10-20 seconds.

- [ ] **Step 6: Verify shipment flow**

Order a supply drop. Watch colonists path to landing zone to unpack.

- [ ] **Step 7: Verify save/load**

Refresh the page. Colonists should load with energy/morale/trait values. Buildings should appear at organic positions.

- [ ] **Step 8: Tune constants if needed**

If colonists rest too often or not enough, adjust `ENERGY_DRAIN_WORKING`, `ENERGY_RECOVERY_RESTING`, and utility score baselines in `colonistAI.ts`.

- [ ] **Step 9: Commit any tuning changes**

```bash
git add -A
git commit -m "chore: tune colonist AI constants after smoke test"
```

---

## Task 10: Add `.superpowers/` to .gitignore

- [ ] **Step 1: Check and update .gitignore**

```bash
echo ".superpowers/" >> .gitignore
git add .gitignore
git commit -m "chore: add .superpowers to gitignore"
```
