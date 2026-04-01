# Survey & Extract Core Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "drill deeper" core loop with a survey-and-extract model across a moon surface, adding a medium-lens satellite view for strategic sector scanning and outpost management.

**Architecture:** New `moonStore.ts` Pinia store manages sectors, survey missions, and outposts separately from the colony store. A `sectorGen.ts` system procedurally generates the moon surface as a hex-like grid with terrain types. The medium lens is a new Vue component (`MoonMap.vue`) that renders sectors, teams, and outposts. The existing colony map becomes the "close lens." A `useLensView` composable manages lens switching. The existing `drill` action type and `drillrig` building are renamed to `extract` and `extractionrig`. Outpost logic (extraction, stockpile, launch) runs each tick via the moon store. Colony gameStore receives launched payloads as supply drops through the existing unpack system.

**Tech Stack:** Vue 3, Pinia, TypeScript, existing mapLayout/colonistAI/radioChatter systems

---

### Task 1: Rename drill → extract Throughout Codebase

Rename all drill-related terminology to extraction terminology. This is a mechanical rename that touches many files but is low-risk.

**Files:**
- Modify: `src/types/colonist.ts` (ActionType)
- Modify: `src/stores/gameStore.ts` (BuildingType, constants, getters, actions, labels)
- Modify: `src/systems/colonistAI.ts` (action scoring, durations, trait mods)
- Modify: `src/systems/mapLayout.ts` (zone ID, label, ZONE_FOR_BUILDING)
- Modify: `src/systems/radioChatter.ts` (chatter templates)
- Modify: `src/stores/offlineEngine.ts` (rate computation)
- Modify: `src/composables/useColonistMovement.ts` (visual state mapping)
- Modify: `src/components/ResourceHud.vue` (depth display)
- Modify: `src/utils/format.ts` (fmtDepth)

- [ ] **Step 1: Rename ActionType `'drill'` → `'extract'`**

In `src/types/colonist.ts`, replace the `'drill'` action type:

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
```

- [ ] **Step 2: Rename BuildingType `'drillrig'` → `'extractionrig'`**

In `src/stores/gameStore.ts` line 25:

```typescript
export type BuildingType = 'o2generator' | 'solar' | 'extractionrig' | 'medbay' | 'partsfactory'
```

- [ ] **Step 3: Rename constants in gameStore.ts**

Replace drill constants (around lines 147-148):

```typescript
export const EXTRACT_SPEED_PER_WORKER = 0.15
export const EXTRACT_SPEED_PER_RIG = 0.08
```

Rename `DIRECTIVE_RATIOS` keys (line 184):

```typescript
export const DIRECTIVE_RATIOS: Record<Directive, { extractor: number; engineer: number }> = {
  mining: { extractor: 0.7, engineer: 0.2 },
  safety: { extractor: 0.2, engineer: 0.6 },
  balanced: { extractor: 0.4, engineer: 0.4 },
  emergency: { extractor: 0.1, engineer: 0.8 },
}
```

Rename `drillMult` → `extractMult` in `DIRECTIVE_MODIFIERS` (line 191):

```typescript
export const DIRECTIVE_MODIFIERS: Record<
  Directive,
  { extractMult: number; hazardResist: number; prodMult: number }
> = {
  mining: { extractMult: 1.3, hazardResist: 0.0, prodMult: 1.0 },
  safety: { extractMult: 0.7, hazardResist: 0.4, prodMult: 1.2 },
  balanced: { extractMult: 1.0, hazardResist: 0.15, prodMult: 1.0 },
  emergency: { extractMult: 0.5, hazardResist: 0.1, prodMult: 1.5 },
}
```

- [ ] **Step 4: Update blueprint and shipment labels**

Update the `BLUEPRINTS` entry (around line 296):

```typescript
{
  type: 'extractionrig',
  label: 'Extraction Rig',
  description: 'Extracts metals and ice from deposits',
  costMetals: 25,
  costIce: 0,
},
```

Update `SHIPMENT_OPTIONS` entry (around line 225):

```typescript
{
  type: 'equipment',
  label: 'Extraction Rig',
  description: 'Extracts resources from deposits',
  cost: 65,
  weight: 55,
  buildingType: 'extractionrig',
},
```

- [ ] **Step 5: Update getters in gameStore.ts**

Rename `activeDrillers` getter (line 408):

```typescript
activeExtractors: (s) => s.colonists.filter(
  c => c.health > 0 && c.currentAction?.type === 'extract' && !c.currentAction?.walkPath?.length
),
```

Rename `drillRate` getter (line 462):

```typescript
extractRate(s): number {
  const extractorCount = s.colonists.filter(
    c => c.health > 0 && c.currentAction?.type === 'extract' && !c.currentAction?.walkPath?.length
  ).length
  const rigCount = s.buildings.filter((b) => b.type === 'extractionrig' && !b.damaged).length
  const totalEngineers = s.colonists.filter(
    c => c.health > 0 && c.currentAction?.type === 'engineer' && !c.currentAction?.walkPath?.length
  ).length
  const mod = DIRECTIVE_MODIFIERS[s.activeDirective].extractMult
  const engBonus = 1 + totalEngineers * ENGINEER_EFFICIENCY_BONUS
  return (extractorCount * EXTRACT_SPEED_PER_WORKER + rigCount * EXTRACT_SPEED_PER_RIG) * engBonus * mod
},
```

Update `creditRate` getter similarly — replace `drill` references with `extract`.

- [ ] **Step 6: Update tick() action in gameStore.ts**

In the tick method (lines 562-615), rename:
- `activeDrillers` variable → `activeExtractors`
- `c.currentAction?.type === 'drill'` → `c.currentAction?.type === 'extract'`
- `drillSpeed` variable → `extractSpeed`
- `drillEngBonus` → `extractEngBonus`
- `DRILL_SPEED_PER_DRILLER` → `EXTRACT_SPEED_PER_WORKER`
- `DRILL_SPEED_PER_RIG` → `EXTRACT_SPEED_PER_RIG`
- `b.type === 'drillrig'` → `b.type === 'extractionrig'`
- `mod.drillMult` → `mod.extractMult`

- [ ] **Step 7: Update colonistAI.ts**

In `src/systems/colonistAI.ts`:

Replace `'drill'` with `'extract'` in the `DURATION` record (line 23):

```typescript
const DURATION: Record<ActionType, [number, number]> = {
  extract:      [12, 25],
  engineer:     [12, 25],
  // ... rest unchanged
}
```

In `DIRECTIVE_UTILITY` (line 54), rename `drill` key:

```typescript
const DIRECTIVE_UTILITY: Record<Directive, { extract: number; engineer: number; repair: number }> = {
  mining:    { extract: 1.5, engineer: 0.6, repair: 1.0 },
  safety:    { extract: 0.6, engineer: 1.5, repair: 1.5 },
  balanced:  { extract: 1.0, engineer: 1.0, repair: 1.0 },
  emergency: { extract: 0.5, engineer: 2.0, repair: 2.0 },
}
```

In `selectAction()`, rename the drill candidate scoring to use `'extract'` action type and `DIRECTIVE_RATIOS.extractor`.

- [ ] **Step 8: Update mapLayout.ts**

In `src/systems/mapLayout.ts`:

Rename drill zone (line 10):

```typescript
{ id: 'extraction', x: 50, y: 65, radius: 10, label: 'SEC-D EXTRACTION', color: '#0f8', buildingTypes: ['extractionrig'] },
```

Update `ZONE_FOR_BUILDING` (line 18):

```typescript
export const ZONE_FOR_BUILDING: Record<BuildingType, string> = {
  solar: 'power',
  o2generator: 'lifeSup',
  extractionrig: 'extraction',
  medbay: 'medical',
  partsfactory: 'workshop',
}
```

Update `PATH_EDGES` — rename `'drill'` → `'extraction'` in the habitat-to-drill edge (line 31):

```typescript
{ from: 'habitat', to: 'extraction', weight: 1 },
```

- [ ] **Step 9: Update radioChatter.ts**

In `src/systems/radioChatter.ts`, replace all `'drill'` action references and chatter templates:
- Rename template keys like `CHECKIN_DRILL` → `CHECKIN_EXTRACT`
- Update message text: "drill site" → "extraction site", "drilling" → "extracting", "dig" → "extraction"

- [ ] **Step 10: Update offlineEngine.ts**

In `src/stores/offlineEngine.ts`, in `computeRates()`:
- Replace `'drill'` → `'extract'` in colonist action type checks
- Replace `'drillrig'` → `'extractionrig'` in building type checks
- Replace `DRILL_SPEED_*` → `EXTRACT_SPEED_*` constants
- Replace `drillMult` → `extractMult`

- [ ] **Step 11: Update useColonistMovement.ts**

In `src/composables/useColonistMovement.ts`, in `actionToVisualState()` (line 37):
- Replace `'drill'` → `'extract'` in the switch/mapping

- [ ] **Step 12: Update ResourceHud.vue**

In `src/components/ResourceHud.vue`:
- The depth display (line 35-38) stays for now but rename the CSS class from `depth` to `extraction-depth` for clarity
- Update any tooltip text referencing "drill"

- [ ] **Step 13: Update freshState() startup message**

In `gameStore.ts` `freshState()` (line 372):

```typescript
{
  id: uid(),
  text: 'Starting structures deployed: Solar, O2 Gen, Extraction Rig.',
  severity: 'info',
  timestamp: 0,
},
```

And in `makeStartingBuildings()` (line 337), rename `'drillrig'` → `'extractionrig'`:

```typescript
const types: BuildingType[] = ['solar', 'o2generator', 'extractionrig']
```

- [ ] **Step 14: Verify the rename compiles**

Run: `bunx vue-tsc --noEmit`

Expected: No type errors. All `'drill'`/`'drillrig'` references should be resolved.

- [ ] **Step 15: Manual smoke test**

Run: `bun run dev`

Verify in browser:
- Colony loads without errors
- Colonists walk to extraction zone and extract
- Extraction rigs produce resources
- Shipment panel shows "Extraction Rig" label
- Console messages say "extraction" not "drill"

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "refactor: rename drill → extract throughout codebase

Renames drill/drillrig terminology to extract/extractionrig to align
with the new survey-and-extract core loop design."
```

---

### Task 2: New Type Definitions for Moon Systems

Define all interfaces for sectors, outposts, survey missions, and terrain.

**Files:**
- Create: `src/types/moon.ts`

- [ ] **Step 1: Create moon type definitions**

Create `src/types/moon.ts`:

```typescript
// ── Terrain & Biomes ──

export type TerrainType = 'rocky' | 'ice' | 'volcanic' | 'crater' | 'canyon'

export interface TerrainConfig {
  type: TerrainType
  label: string
  color: string        // false-color tint for medium lens
  bgColor: string      // sector background
  depositTypes: DepositType[]
  surveyRiskBase: number  // 0-1, base chance of incident per survey
  description: string
}

export type DepositType = 'metals' | 'ice' | 'rareMinerals'

export type DepositQuality = 'poor' | 'moderate' | 'rich'

// ── Sectors ──

export type SectorStatus = 'hidden' | 'visible' | 'scanned' | 'scanning' | 'surveyed'

export interface Sector {
  id: string
  q: number            // axial hex coordinate
  r: number            // axial hex coordinate
  terrain: TerrainType
  status: SectorStatus
  deposit: Deposit | null           // null until surveyed
  scanSignature: ScanSignature | null  // set after orbital scan
  outpostId: string | null          // link to outpost if one exists
}

export interface ScanSignature {
  depositType: DepositType
  qualityHint: string   // "Faint traces" | "Moderate signatures" | "Strong readings"
}

export interface Deposit {
  type: DepositType
  quality: DepositQuality
  totalYield: number     // total extractable units
  remainingYield: number // depletes over time
}

// ── Survey Missions ──

export type SurveyStatus = 'traveling' | 'surveying' | 'returning' | 'complete' | 'failed'

export interface SurveyMission {
  id: string
  sectorId: string
  colonistIds: string[]     // 2-3 colonists sent
  status: SurveyStatus
  departedAt: number        // totalPlaytimeMs
  arrivalAt: number         // when team reaches sector
  surveyCompleteAt: number  // when survey finishes
  returnAt: number          // when team gets back to colony
  incident: SurveyIncident | null
}

export interface SurveyIncident {
  type: 'injury' | 'delay' | 'lost'
  colonistId: string       // affected colonist
  message: string
}

// ── Outposts ──

export type OutpostStatus = 'active' | 'damaged' | 'depleted' | 'abandoned'

export interface Outpost {
  id: string
  sectorId: string
  name: string
  deposit: Deposit
  extractionLevel: number  // 1, 2, 3... higher = richer but riskier
  crewIds: string[]        // colonists stationed here
  stockpile: OutpostStockpile
  status: OutpostStatus
  lastHazardAt: number
  establishedAt: number    // totalPlaytimeMs
}

export interface OutpostStockpile {
  metals: number
  ice: number
  rareMinerals: number
}

// ── Outpost Launches ──

export interface OutpostLaunch {
  id: string
  outpostId: string
  payload: OutpostStockpile
  launchedAt: number       // totalPlaytimeMs
  arrivalAt: number        // when payload reaches colony
}

// ── Moon State ──

export interface MoonState {
  sectors: Sector[]
  outposts: Outpost[]
  surveyMissions: SurveyMission[]
  outpostLaunches: OutpostLaunch[]
  scanQueue: string[]       // sector IDs queued for orbital scan
  activeScanId: string | null
  scanStartedAt: number
}
```

- [ ] **Step 2: Verify types compile**

Run: `bunx vue-tsc --noEmit`

Expected: No errors (types are not imported anywhere yet, but file should parse cleanly).

- [ ] **Step 3: Commit**

```bash
git add src/types/moon.ts
git commit -m "feat: add type definitions for moon survey/extract systems

Defines Sector, Outpost, SurveyMission, Deposit, TerrainType and
related interfaces for the new core loop."
```

---

### Task 3: Sector Generation System

Procedurally generate the moon surface as a hex grid with terrain types. The colony occupies the center sector; surrounding sectors radiate outward in rings.

**Files:**
- Create: `src/systems/sectorGen.ts`

- [ ] **Step 1: Create sector generation module**

Create `src/systems/sectorGen.ts`:

```typescript
import type { Sector, TerrainType, TerrainConfig } from '@/types/moon'

// ── Terrain Definitions ──

export const TERRAIN_CONFIGS: Record<TerrainType, TerrainConfig> = {
  rocky: {
    type: 'rocky',
    label: 'Rocky Plains',
    color: '#8a8a7a',
    bgColor: '#1a1a16',
    depositTypes: ['metals'],
    surveyRiskBase: 0.05,
    description: 'Flat terrain with scattered boulders. Low risk, common metals.',
  },
  ice: {
    type: 'ice',
    label: 'Ice Flats',
    color: '#7ecfff',
    bgColor: '#0c1a22',
    depositTypes: ['ice', 'metals'],
    surveyRiskBase: 0.10,
    description: 'Smooth frozen plains. Ice deposits with some metals.',
  },
  volcanic: {
    type: 'volcanic',
    label: 'Volcanic Ridge',
    color: '#e94560',
    bgColor: '#1f0a0f',
    depositTypes: ['rareMinerals', 'metals'],
    surveyRiskBase: 0.25,
    description: 'Jagged volcanic terrain. Rare minerals, high risk.',
  },
  crater: {
    type: 'crater',
    label: 'Crater Basin',
    color: '#a0a0b0',
    bgColor: '#12121a',
    depositTypes: ['metals'],
    surveyRiskBase: 0.15,
    description: 'Deep impact craters. Rich metal deposits.',
  },
  canyon: {
    type: 'canyon',
    label: 'Canyon Network',
    color: '#c8a070',
    bgColor: '#1a150e',
    depositTypes: ['metals', 'ice'],
    surveyRiskBase: 0.20,
    description: 'Narrow canyon systems. Mixed deposits, moderate risk.',
  },
}

// ── Seeded PRNG (same as offlineEngine) ──

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Hex Grid Utilities ──
// Using axial coordinates (q, r). Center at (0, 0).

const HEX_DIRECTIONS: [number, number][] = [
  [1, 0], [1, -1], [0, -1],
  [-1, 0], [-1, 1], [0, 1],
]

function hexRing(center: [number, number], radius: number): [number, number][] {
  if (radius === 0) return [center]
  const results: [number, number][] = []
  let [q, r] = [center[0] + HEX_DIRECTIONS[4][0] * radius, center[1] + HEX_DIRECTIONS[4][1] * radius]
  for (let dir = 0; dir < 6; dir++) {
    for (let step = 0; step < radius; step++) {
      results.push([q, r])
      q += HEX_DIRECTIONS[dir][0]
      r += HEX_DIRECTIONS[dir][1]
    }
  }
  return results
}

function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2
}

// ── Terrain Assignment ──

const TERRAIN_WEIGHTS: { terrain: TerrainType; weight: number }[] = [
  { terrain: 'rocky', weight: 0.35 },
  { terrain: 'ice', weight: 0.25 },
  { terrain: 'crater', weight: 0.20 },
  { terrain: 'canyon', weight: 0.12 },
  { terrain: 'volcanic', weight: 0.08 },
]

function pickTerrain(rand: () => number): TerrainType {
  let roll = rand()
  for (const { terrain, weight } of TERRAIN_WEIGHTS) {
    roll -= weight
    if (roll <= 0) return terrain
  }
  return 'rocky'
}

// ── Public API ──

export const COLONY_SECTOR_ID = 'sector-0-0'

/**
 * Generate moon surface sectors. Ring 0 = colony (always rocky).
 * Rings 1-maxRing radiate outward with procedural terrain.
 * For medium lens, we generate rings 0-3 (37 sectors).
 */
export function generateSectors(seed: number, maxRing: number = 3): Sector[] {
  const rand = mulberry32(seed)
  const sectors: Sector[] = []

  for (let ring = 0; ring <= maxRing; ring++) {
    const coords = hexRing([0, 0], ring)
    for (const [q, r] of coords) {
      const id = `sector-${q}-${r}`
      const isColony = q === 0 && r === 0
      const terrain: TerrainType = isColony ? 'rocky' : pickTerrain(rand)
      // Ring 0 and 1 start visible, rest hidden
      const status = ring <= 1 ? 'visible' : 'hidden'

      sectors.push({
        id,
        q,
        r,
        terrain,
        status: isColony ? 'surveyed' : status,
        deposit: null,
        scanSignature: null,
        outpostId: null,
      })
    }
  }

  return sectors
}

/**
 * Get sectors adjacent to a given sector.
 */
export function getAdjacentSectorIds(q: number, r: number): string[] {
  return HEX_DIRECTIONS.map(([dq, dr]) => `sector-${q + dq}-${r + dr}`)
}

/**
 * Calculate travel time in ms from colony to sector based on hex distance.
 */
export function travelTimeMs(q: number, r: number): number {
  const dist = hexDistance(0, 0, q, r)
  return dist * 15_000 // 15 seconds per hex
}

/**
 * Convert axial hex coords to pixel position for rendering.
 * Returns { x, y } as percentages (0-100) for the medium lens viewport.
 */
export function hexToPixel(q: number, r: number): { x: number; y: number } {
  const size = 10 // hex size in viewport %
  const x = 50 + size * (3 / 2 * q)
  const y = 50 + size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r)
  return { x, y }
}

export { hexDistance }
```

- [ ] **Step 2: Verify compilation**

Run: `bunx vue-tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/systems/sectorGen.ts
git commit -m "feat: add procedural sector generation for moon surface

Hex-grid based sector system with 5 terrain types, seeded PRNG,
and utilities for adjacency, travel time, and rendering positions."
```

---

### Task 4: Moon Store — State & Scanning

Create the Pinia store that manages moon-level state: sectors, orbital scanning, and the scan queue. This task covers state initialization and the scan mechanic only. Survey missions and outposts are added in subsequent tasks.

**Files:**
- Create: `src/stores/moonStore.ts`
- Modify: `src/stores/gameStore.ts` (add moon store initialization to `freshState` flow)

- [ ] **Step 1: Create moonStore with sector state and scanning**

Create `src/stores/moonStore.ts`:

```typescript
import { defineStore } from 'pinia'
import type {
  MoonState, Sector, SurveyMission, Outpost, OutpostLaunch,
  ScanSignature, DepositType, DepositQuality, Deposit,
  SurveyIncident, OutpostStockpile,
} from '@/types/moon'
import {
  generateSectors, getAdjacentSectorIds, travelTimeMs,
  TERRAIN_CONFIGS, COLONY_SECTOR_ID, hexDistance,
} from '@/systems/sectorGen'
import { uid } from '@/stores/gameStore'

// ── Constants ──

const SCAN_DURATION_MS = 45_000          // 45s to scan a sector
const SURVEY_ONSITE_MS = 90_000          // 90s on-site survey time
const OUTPOST_EXTRACT_INTERVAL_MS = 10_000 // extract every 10s
const OUTPOST_LAUNCH_LOAD_MS = 15_000    // 15s to load launch platform
const OUTPOST_ESTABLISH_COST_METALS = 30
const OUTPOST_ESTABLISH_COST_CREDITS = 50

// Deposit generation
const DEPOSIT_YIELD: Record<DepositQuality, [number, number]> = {
  poor: [50, 100],
  moderate: [150, 300],
  rich: [400, 700],
}

const QUALITY_WEIGHTS: { quality: DepositQuality; weight: number }[] = [
  { quality: 'poor', weight: 0.4 },
  { quality: 'moderate', weight: 0.4 },
  { quality: 'rich', weight: 0.2 },
]

const SCAN_SIGNATURE_HINTS: Record<DepositQuality, string> = {
  poor: 'Faint traces',
  moderate: 'Moderate signatures',
  rich: 'Strong readings',
}

// Outpost names
const OUTPOST_NAMES = [
  'Outpost Alpha', 'Outpost Bravo', 'Outpost Charlie', 'Outpost Delta',
  'Outpost Echo', 'Outpost Foxtrot', 'Outpost Golf', 'Outpost Hotel',
]

export {
  SCAN_DURATION_MS, SURVEY_ONSITE_MS, OUTPOST_EXTRACT_INTERVAL_MS,
  OUTPOST_ESTABLISH_COST_METALS, OUTPOST_ESTABLISH_COST_CREDITS,
}

// ── Store ──

export const useMoonStore = defineStore('moon', {
  state: (): MoonState => ({
    sectors: [],
    outposts: [],
    surveyMissions: [],
    outpostLaunches: [],
    scanQueue: [],
    activeScanId: null,
    scanStartedAt: 0,
  }),

  getters: {
    /** Sectors that are scannable: visible, not yet scanned, not being scanned */
    scannableSectors(s): Sector[] {
      return s.sectors.filter(sec =>
        sec.status === 'visible' && !s.scanQueue.includes(sec.id) && sec.id !== COLONY_SECTOR_ID
      )
    },

    /** Sectors that have been surveyed and have a confirmed deposit but no outpost */
    availableForOutpost(s): Sector[] {
      return s.sectors.filter(sec =>
        sec.status === 'surveyed' && sec.deposit !== null && sec.outpostId === null && sec.id !== COLONY_SECTOR_ID
      )
    },

    /** Active (non-complete/failed) survey missions */
    activeMissions(s): SurveyMission[] {
      return s.surveyMissions.filter(m => m.status !== 'complete' && m.status !== 'failed')
    },

    /** Active outposts */
    activeOutposts(s): Outpost[] {
      return s.outposts.filter(o => o.status === 'active')
    },

    /** All colonist IDs currently away from colony (on survey or at outpost) */
    awayColonistIds(s): Set<string> {
      const ids = new Set<string>()
      for (const m of s.surveyMissions) {
        if (m.status !== 'complete' && m.status !== 'failed') {
          for (const cid of m.colonistIds) ids.add(cid)
        }
      }
      for (const o of s.outposts) {
        if (o.status !== 'abandoned') {
          for (const cid of o.crewIds) ids.add(cid)
        }
      }
      return ids
    },

    /** Total colonists away */
    awayCount(): number {
      return this.awayColonistIds.size
    },
  },

  actions: {
    // ── Initialization ──

    initialize(seed: number) {
      this.sectors = generateSectors(seed, 3)
      this.outposts = []
      this.surveyMissions = []
      this.outpostLaunches = []
      this.scanQueue = []
      this.activeScanId = null
      this.scanStartedAt = 0
    },

    // ── Orbital Scanning ──

    /** Queue a sector for orbital scanning */
    queueScan(sectorId: string) {
      const sector = this.sectors.find(s => s.id === sectorId)
      if (!sector || sector.status !== 'visible') return
      if (this.scanQueue.includes(sectorId)) return

      this.scanQueue.push(sectorId)

      // Start scanning immediately if nothing active
      if (!this.activeScanId) {
        this._startNextScan()
      }
    },

    _startNextScan() {
      if (this.scanQueue.length === 0) {
        this.activeScanId = null
        return
      }
      const nextId = this.scanQueue[0]
      const sector = this.sectors.find(s => s.id === nextId)
      if (sector) {
        sector.status = 'scanning'
        this.activeScanId = nextId
        // scanStartedAt will be set in tickScanning using game time
      }
    },

    /** Called each game tick to advance scanning */
    tickScanning(totalPlaytimeMs: number, pushMessage: (text: string, severity: string) => void) {
      if (!this.activeScanId) {
        if (this.scanQueue.length > 0) this._startNextScan()
        if (!this.activeScanId) return
      }

      // Set start time on first tick of this scan
      if (this.scanStartedAt === 0) {
        this.scanStartedAt = totalPlaytimeMs
      }

      const elapsed = totalPlaytimeMs - this.scanStartedAt
      if (elapsed < SCAN_DURATION_MS) return

      // Scan complete
      const sector = this.sectors.find(s => s.id === this.activeScanId)
      if (sector) {
        // Determine if there's a deposit and generate a signature
        const terrainConf = TERRAIN_CONFIGS[sector.terrain]
        const hasDeposit = Math.random() < 0.7 // 70% chance of finding something
        if (hasDeposit && terrainConf.depositTypes.length > 0) {
          const depositType = terrainConf.depositTypes[Math.floor(Math.random() * terrainConf.depositTypes.length)]
          const quality = this._rollQuality()
          sector.scanSignature = {
            depositType,
            qualityHint: SCAN_SIGNATURE_HINTS[quality],
          }
          // Store quality for later survey confirmation (hidden from player)
          ;(sector as any)._hiddenQuality = quality
          pushMessage(
            `Orbital scan complete: ${terrainConf.label} sector — ${SCAN_SIGNATURE_HINTS[quality]} of ${depositType}.`,
            'event',
          )
        } else {
          sector.scanSignature = null
          pushMessage(
            `Orbital scan complete: ${terrainConf.label} sector — no significant deposits detected.`,
            'info',
          )
        }
        sector.status = 'scanned'

        // Reveal adjacent hidden sectors
        const adjacentIds = getAdjacentSectorIds(sector.q, sector.r)
        for (const adjId of adjacentIds) {
          const adj = this.sectors.find(s => s.id === adjId)
          if (adj && adj.status === 'hidden') {
            adj.status = 'visible'
          }
        }
      }

      // Move to next scan
      this.scanQueue.shift()
      this.scanStartedAt = 0
      this.activeScanId = null
      if (this.scanQueue.length > 0) {
        this._startNextScan()
      }
    },

    _rollQuality(): DepositQuality {
      let roll = Math.random()
      for (const { quality, weight } of QUALITY_WEIGHTS) {
        roll -= weight
        if (roll <= 0) return quality
      }
      return 'poor'
    },

    // ── Survey Missions ──

    /** Send a survey team to a scanned sector */
    launchSurvey(
      sectorId: string,
      colonistIds: string[],
      totalPlaytimeMs: number,
      pushMessage: (text: string, severity: string) => void,
    ) {
      const sector = this.sectors.find(s => s.id === sectorId)
      if (!sector || sector.status !== 'scanned' || !sector.scanSignature) return
      if (colonistIds.length < 2 || colonistIds.length > 3) return

      const travel = travelTimeMs(sector.q, sector.r)
      const mission: SurveyMission = {
        id: uid(),
        sectorId,
        colonistIds: [...colonistIds],
        status: 'traveling',
        departedAt: totalPlaytimeMs,
        arrivalAt: totalPlaytimeMs + travel,
        surveyCompleteAt: totalPlaytimeMs + travel + SURVEY_ONSITE_MS,
        returnAt: totalPlaytimeMs + travel + SURVEY_ONSITE_MS + travel,
        incident: null,
      }

      this.surveyMissions.push(mission)
      const names = colonistIds.length // we'll show count since we don't have names here
      pushMessage(`Survey team (${names} colonists) dispatched to sector ${sector.q},${sector.r}.`, 'event')
    },

    /** Advance survey mission states each tick */
    tickSurveys(
      totalPlaytimeMs: number,
      pushMessage: (text: string, severity: string) => void,
      returnColonist: (colonistId: string) => void,
    ) {
      for (const mission of this.surveyMissions) {
        if (mission.status === 'complete' || mission.status === 'failed') continue

        if (mission.status === 'traveling' && totalPlaytimeMs >= mission.arrivalAt) {
          mission.status = 'surveying'
          pushMessage(`Survey team arrived at sector. Beginning ground survey.`, 'info')
        }

        if (mission.status === 'surveying' && totalPlaytimeMs >= mission.surveyCompleteAt) {
          // Check for incidents
          const sector = this.sectors.find(s => s.id === mission.sectorId)
          if (sector) {
            const terrainConf = TERRAIN_CONFIGS[sector.terrain]
            const dist = hexDistance(0, 0, sector.q, sector.r)
            const riskMult = 1 + (dist - 1) * 0.3 // farther = more risk
            const incidentChance = terrainConf.surveyRiskBase * riskMult

            if (Math.random() < incidentChance) {
              // Incident occurred
              const severity = Math.random()
              const targetColonist = mission.colonistIds[Math.floor(Math.random() * mission.colonistIds.length)]
              if (severity < 0.5) {
                // Injury — colonist returns hurt
                mission.incident = {
                  type: 'injury',
                  colonistId: targetColonist,
                  message: 'Team member injured during survey operations.',
                }
                pushMessage(`Survey incident: team member injured in ${terrainConf.label} sector.`, 'warning')
              } else if (severity < 0.85) {
                // Delay — extend return time
                mission.incident = {
                  type: 'delay',
                  colonistId: targetColonist,
                  message: 'Equipment malfunction delayed the survey team.',
                }
                mission.returnAt += 30_000 // 30s extra
                pushMessage(`Survey team delayed — equipment malfunction in the field.`, 'warning')
              } else {
                // Lost — colonist doesn't return
                mission.incident = {
                  type: 'lost',
                  colonistId: targetColonist,
                  message: 'A team member was lost during the survey.',
                }
                pushMessage(`Survey team reports: we lost someone out here. Returning to base.`, 'critical')
              }
            }

            // Confirm the deposit
            const hiddenQuality = (sector as any)._hiddenQuality as DepositQuality | undefined
            if (sector.scanSignature && hiddenQuality) {
              const [minYield, maxYield] = DEPOSIT_YIELD[hiddenQuality]
              const totalYield = minYield + Math.random() * (maxYield - minYield)
              sector.deposit = {
                type: sector.scanSignature.depositType,
                quality: hiddenQuality,
                totalYield,
                remainingYield: totalYield,
              }
              delete (sector as any)._hiddenQuality
            }
            sector.status = 'surveyed'
          }

          mission.status = 'returning'
          pushMessage(`Survey complete. Team returning to colony.`, 'event')
        }

        if (mission.status === 'returning' && totalPlaytimeMs >= mission.returnAt) {
          mission.status = 'complete'

          // Return colonists to colony
          for (const cid of mission.colonistIds) {
            if (mission.incident?.type === 'lost' && mission.incident.colonistId === cid) {
              continue // this colonist doesn't return
            }
            returnColonist(cid)
          }

          // Apply injury if applicable
          if (mission.incident?.type === 'injury') {
            // The gameStore will handle reducing health when it processes returned colonists
          }

          pushMessage(`Survey team has returned to colony.`, 'event')
        }
      }
    },

    // ── Outposts ──

    /** Establish an outpost at a surveyed sector */
    establishOutpost(
      sectorId: string,
      crewIds: string[],
      totalPlaytimeMs: number,
      pushMessage: (text: string, severity: string) => void,
    ): boolean {
      const sector = this.sectors.find(s => s.id === sectorId)
      if (!sector || sector.status !== 'surveyed' || !sector.deposit || sector.outpostId) return false
      if (crewIds.length < 2) return false

      const name = OUTPOST_NAMES[this.outposts.length % OUTPOST_NAMES.length]
      const outpost: Outpost = {
        id: uid(),
        sectorId,
        name,
        deposit: { ...sector.deposit },
        extractionLevel: 1,
        crewIds: [...crewIds],
        stockpile: { metals: 0, ice: 0, rareMinerals: 0 },
        status: 'active',
        lastHazardAt: 0,
        establishedAt: totalPlaytimeMs,
      }

      this.outposts.push(outpost)
      sector.outpostId = outpost.id
      pushMessage(`${name} established in ${TERRAIN_CONFIGS[sector.terrain].label} sector.`, 'event')
      return true
    },

    /** Advance outpost extraction each tick */
    tickOutposts(totalPlaytimeMs: number, dtMs: number, pushMessage: (text: string, severity: string) => void) {
      for (const outpost of this.outposts) {
        if (outpost.status !== 'active') continue
        if (outpost.deposit.remainingYield <= 0) {
          outpost.status = 'depleted'
          pushMessage(`${outpost.name} deposit depleted.`, 'warning')
          continue
        }

        // Extraction rate scales with crew count and extraction level
        const crewFactor = Math.min(outpost.crewIds.length, 4) // diminishing returns past 4
        const levelFactor = 1 + (outpost.extractionLevel - 1) * 0.5
        const extractRate = crewFactor * levelFactor * (dtMs / OUTPOST_EXTRACT_INTERVAL_MS)

        const extracted = Math.min(extractRate, outpost.deposit.remainingYield)
        outpost.deposit.remainingYield -= extracted

        // Add to stockpile based on deposit type
        switch (outpost.deposit.type) {
          case 'metals':
            outpost.stockpile.metals += extracted
            break
          case 'ice':
            outpost.stockpile.ice += extracted
            break
          case 'rareMinerals':
            outpost.stockpile.rareMinerals += extracted
            break
        }
      }
    },

    /** Launch stockpile from outpost back to colony */
    launchFromOutpost(
      outpostId: string,
      totalPlaytimeMs: number,
      pushMessage: (text: string, severity: string) => void,
    ) {
      const outpost = this.outposts.find(o => o.id === outpostId)
      if (!outpost) return

      const payload = { ...outpost.stockpile }
      const totalPayload = payload.metals + payload.ice + payload.rareMinerals
      if (totalPayload < 1) return

      const sector = this.sectors.find(s => s.id === outpost.sectorId)
      const travel = sector ? travelTimeMs(sector.q, sector.r) : 15_000

      this.outpostLaunches.push({
        id: uid(),
        outpostId,
        payload,
        launchedAt: totalPlaytimeMs,
        arrivalAt: totalPlaytimeMs + travel,
      })

      // Clear stockpile
      outpost.stockpile = { metals: 0, ice: 0, rareMinerals: 0 }
      pushMessage(`${outpost.name} launched payload (${Math.floor(totalPayload)} units) to colony.`, 'event')
    },

    /** Process arriving outpost launches — add resources to colony */
    tickLaunches(
      totalPlaytimeMs: number,
      addResources: (metals: number, ice: number) => void,
      pushMessage: (text: string, severity: string) => void,
    ) {
      const arrived: string[] = []
      for (const launch of this.outpostLaunches) {
        if (totalPlaytimeMs >= launch.arrivalAt) {
          addResources(launch.payload.metals, launch.payload.ice)
          const total = Math.floor(launch.payload.metals + launch.payload.ice + launch.payload.rareMinerals)
          pushMessage(`Outpost payload arrived: ${total} units received.`, 'event')
          arrived.push(launch.id)
        }
      }
      this.outpostLaunches = this.outpostLaunches.filter(l => !arrived.includes(l.id))
    },

    /** Abandon an outpost — crew returns to colony */
    abandonOutpost(
      outpostId: string,
      returnColonist: (colonistId: string) => void,
      pushMessage: (text: string, severity: string) => void,
    ) {
      const outpost = this.outposts.find(o => o.id === outpostId)
      if (!outpost) return

      for (const cid of outpost.crewIds) {
        returnColonist(cid)
      }
      outpost.crewIds = []
      outpost.status = 'abandoned'

      const sector = this.sectors.find(s => s.id === outpost.sectorId)
      if (sector) sector.outpostId = null

      pushMessage(`${outpost.name} abandoned. Crew returning to colony.`, 'event')
    },
  },
})
```

- [ ] **Step 2: Add moon store initialization to gameStore**

In `src/stores/gameStore.ts`, in the `freshState()` function, we don't need to change anything yet — the moon store initializes separately. But we need to call `moonStore.initialize()` when a new game starts.

In the store's `load()` action (or wherever new game is created), after `freshState()` is called, add initialization. Find the section where `this.$patch(freshState())` or similar is called for a new game and add:

```typescript
// In the resetGame or newGame action, after resetting colony state:
const moonStore = useMoonStore()
moonStore.initialize(Date.now())
```

Also add the import at the top of `gameStore.ts`:

```typescript
import { useMoonStore } from '@/stores/moonStore'
```

- [ ] **Step 3: Add moon tick calls to gameStore.tick()**

In `gameStore.ts`, at the end of the `tick()` action (before the periodic status messages block, around line 707), add:

```typescript
// Moon systems
const moon = useMoonStore()
moon.tickScanning(this.totalPlaytimeMs, (text, sev) => this.pushMessage(text, sev))
moon.tickSurveys(
  this.totalPlaytimeMs,
  (text, sev) => this.pushMessage(text, sev),
  (colonistId) => {
    // Return colonist to colony
    const c = this.colonists.find(col => col.id === colonistId)
    if (c) {
      c.currentZone = 'habitat'
      c.currentAction = null
    }
  },
)
moon.tickOutposts(this.totalPlaytimeMs, dtMs, (text, sev) => this.pushMessage(text, sev))
moon.tickLaunches(
  this.totalPlaytimeMs,
  (metals, ice) => {
    this.metals += metals
    this.ice += ice
  },
  (text, sev) => this.pushMessage(text, sev),
)
```

- [ ] **Step 4: Add colonist "away" filtering**

In `gameStore.ts`, update the `aliveColonists` getter or add a new getter for colonists present at colony:

```typescript
/** Colonists present at the colony (not on survey or at outpost) */
colonyColonists(s): Colonist[] {
  const moon = useMoonStore()
  const away = moon.awayColonistIds
  return s.colonists.filter(c => c.health > 0 && !away.has(c.id))
},
```

Then update the tick loop to use `colonyColonists` instead of `aliveColonists` for the AI loop, worker counting, and air consumption — colonists at outposts don't consume colony resources.

In `tick()`, replace `const alive = this.aliveColonists` with:

```typescript
const alive = this.colonyColonists
```

Keep `this.aliveColonists` for game-over checks (all colonists dead, not just colony ones).

- [ ] **Step 5: Verify compilation**

Run: `bunx vue-tsc --noEmit`

Expected: No errors.

- [ ] **Step 6: Manual smoke test**

Run: `bun run dev`

Verify:
- Game loads without errors
- Console shows no moon-related errors
- Colony functions normally (extraction, buildings, shipments)
- Check browser console for any warnings

- [ ] **Step 7: Commit**

```bash
git add src/stores/moonStore.ts src/stores/gameStore.ts
git commit -m "feat: add moon store with scanning, surveys, and outpost systems

New Pinia store manages sectors, orbital scanning, survey missions,
outpost operations, and launch logistics. Integrated into game tick."
```

---

### Task 5: Lens Switching Composable

Create the composable that manages which lens (close/medium) is active and provides the switching logic with transition state.

**Files:**
- Create: `src/composables/useLensView.ts`

- [ ] **Step 1: Create lens view composable**

Create `src/composables/useLensView.ts`:

```typescript
import { ref, computed } from 'vue'

export type LensMode = 'close' | 'medium'

const currentLens = ref<LensMode>('close')
const isTransitioning = ref(false)
const TRANSITION_MS = 600

export function useLensView() {
  const lens = computed(() => currentLens.value)

  function switchLens(target: LensMode) {
    if (target === currentLens.value || isTransitioning.value) return

    isTransitioning.value = true
    setTimeout(() => {
      currentLens.value = target
      setTimeout(() => {
        isTransitioning.value = false
      }, TRANSITION_MS / 2)
    }, TRANSITION_MS / 2)
  }

  function toggleLens() {
    switchLens(currentLens.value === 'close' ? 'medium' : 'close')
  }

  return {
    lens,
    isTransitioning,
    switchLens,
    toggleLens,
    TRANSITION_MS,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/composables/useLensView.ts
git commit -m "feat: add lens switching composable for close/medium views"
```

---

### Task 6: Medium Lens — Moon Map Component

Create the new MoonMap component that renders the hex-grid sector map for the medium lens view. This is the primary new visual component.

**Files:**
- Create: `src/components/MoonMap.vue`
- Create: `src/components/SectorHex.vue`
- Modify: `src/components/GameView.vue` (integrate lens switching)

- [ ] **Step 1: Create SectorHex component**

Create `src/components/SectorHex.vue`:

```vue
<template>
  <g
    class="sector-hex"
    :class="[`status-${sector.status}`, `terrain-${sector.terrain}`, { 'has-outpost': sector.outpostId }]"
    :transform="`translate(${px}, ${py})`"
    @click="$emit('select', sector)"
  >
    <!-- Hex shape -->
    <polygon
      :points="hexPoints"
      class="hex-fill"
      :style="{ fill: bgColor, stroke: borderColor }"
    />

    <!-- Terrain label -->
    <text
      v-if="sector.status !== 'hidden'"
      class="terrain-label"
      text-anchor="middle"
      :y="-hexSize * 0.25"
    >
      {{ terrainLabel }}
    </text>

    <!-- Scan signature -->
    <text
      v-if="sector.scanSignature"
      class="scan-hint"
      text-anchor="middle"
      :y="hexSize * 0.15"
    >
      {{ sector.scanSignature.qualityHint }}
    </text>

    <!-- Deposit type after survey -->
    <text
      v-if="sector.deposit"
      class="deposit-label"
      text-anchor="middle"
      :y="hexSize * 0.15"
    >
      {{ depositLabel }}
    </text>

    <!-- Status indicator -->
    <text
      v-if="sector.status === 'scanning'"
      class="status-indicator scanning"
      text-anchor="middle"
      :y="hexSize * 0.45"
    >
      SCANNING...
    </text>

    <!-- Outpost marker -->
    <g v-if="sector.outpostId" class="outpost-marker">
      <circle :r="hexSize * 0.15" :cy="hexSize * 0.35" fill="var(--green)" opacity="0.8" />
      <text text-anchor="middle" :y="hexSize * 0.4" class="outpost-icon">&#9650;</text>
    </g>

    <!-- Colony marker (center hex) -->
    <g v-if="isColony" class="colony-marker">
      <circle :r="hexSize * 0.2" fill="var(--cyan)" opacity="0.6" />
      <text text-anchor="middle" y="4" class="colony-icon">&#9673;</text>
    </g>

    <!-- Fog overlay for hidden sectors -->
    <polygon
      v-if="sector.status === 'hidden'"
      :points="hexPoints"
      class="hex-fog"
    />
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Sector } from '@/types/moon'
import { TERRAIN_CONFIGS, COLONY_SECTOR_ID } from '@/systems/sectorGen'

const props = defineProps<{
  sector: Sector
  px: number
  py: number
  hexSize: number
}>()

defineEmits<{ select: [sector: Sector] }>()

const isColony = computed(() => props.sector.id === COLONY_SECTOR_ID)

const terrainConf = computed(() => TERRAIN_CONFIGS[props.sector.terrain])

const terrainLabel = computed(() => {
  if (isColony.value) return 'COLONY'
  return terrainConf.value.label.toUpperCase()
})

const depositLabel = computed(() => {
  if (!props.sector.deposit) return ''
  const type = props.sector.deposit.type
  const quality = props.sector.deposit.quality
  return `${quality} ${type}`
})

const bgColor = computed(() => {
  if (props.sector.status === 'hidden') return 'var(--bg-deep)'
  return terrainConf.value.bgColor
})

const borderColor = computed(() => {
  if (props.sector.status === 'hidden') return 'var(--accent-dim)'
  if (props.sector.outpostId) return 'var(--green)'
  if (props.sector.status === 'scanning') return 'var(--amber)'
  if (props.sector.status === 'scanned' && props.sector.scanSignature) return 'var(--cyan)'
  return terrainConf.value.color + '40' // 25% opacity
})

// Generate flat-top hexagon points
const hexPoints = computed(() => {
  const s = props.hexSize
  const points: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i
    const x = s * Math.cos(angle)
    const y = s * Math.sin(angle)
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return points.join(' ')
})
</script>

<style scoped>
.sector-hex {
  cursor: pointer;
}

.sector-hex.status-hidden {
  cursor: default;
  pointer-events: none;
}

.hex-fill {
  stroke-width: 1.5;
  transition: fill 0.3s, stroke 0.3s;
}

.sector-hex:hover .hex-fill {
  filter: brightness(1.3);
}

.hex-fog {
  fill: var(--bg-deep);
  opacity: 0.85;
  pointer-events: none;
}

.terrain-label {
  font-family: var(--font-mono);
  font-size: 5px;
  fill: var(--text-secondary);
  pointer-events: none;
}

.scan-hint {
  font-family: var(--font-mono);
  font-size: 4px;
  fill: var(--cyan);
  pointer-events: none;
}

.deposit-label {
  font-family: var(--font-mono);
  font-size: 4px;
  fill: var(--green);
  pointer-events: none;
  text-transform: capitalize;
}

.status-indicator {
  font-family: var(--font-mono);
  font-size: 4px;
  pointer-events: none;
}

.status-indicator.scanning {
  fill: var(--amber);
  animation: pulse-glow 1.5s infinite;
}

.colony-icon {
  font-size: 8px;
  fill: var(--cyan);
  pointer-events: none;
}

.outpost-icon {
  font-size: 6px;
  fill: var(--bg-deep);
  pointer-events: none;
}
</style>
```

- [ ] **Step 2: Create MoonMap component**

Create `src/components/MoonMap.vue`:

```vue
<template>
  <div class="moon-map">
    <svg
      viewBox="0 0 500 500"
      class="moon-svg"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
    >
      <g :transform="`translate(250, 250) scale(${zoom})`">
        <!-- Survey team paths -->
        <line
          v-for="mission in moon.activeMissions"
          :key="mission.id"
          :x1="0" :y1="0"
          :x2="missionTarget(mission).x" :y2="missionTarget(mission).y"
          class="survey-path"
        />

        <!-- Survey team markers -->
        <circle
          v-for="mission in moon.activeMissions"
          :key="'m-' + mission.id"
          :cx="missionPosition(mission).x"
          :cy="missionPosition(mission).y"
          :r="4"
          class="survey-marker"
          :class="mission.status"
        />

        <!-- Outpost launch arcs -->
        <circle
          v-for="launch in moon.outpostLaunches"
          :key="'l-' + launch.id"
          :cx="launchPosition(launch).x"
          :cy="launchPosition(launch).y"
          :r="3"
          class="launch-marker"
        />

        <!-- Sector hexes -->
        <SectorHex
          v-for="sector in moon.sectors"
          :key="sector.id"
          :sector="sector"
          :px="sectorPos(sector).x"
          :py="sectorPos(sector).y"
          :hex-size="hexSize"
          @select="onSectorSelect"
        />
      </g>
    </svg>

    <!-- Sector info panel -->
    <div v-if="selectedSector" class="sector-panel">
      <div class="panel-header">
        <span class="panel-title mono">{{ sectorTitle }}</span>
        <button class="panel-close" @click="selectedSector = null">&times;</button>
      </div>
      <div class="panel-body">
        <p class="terrain-info mono">{{ terrainDescription }}</p>

        <!-- Actions based on sector status -->
        <button
          v-if="canScan"
          class="action-btn scan-btn"
          @click="queueScan"
        >
          INITIATE SCAN
        </button>

        <button
          v-if="canSurvey"
          class="action-btn survey-btn"
          @click="showSurveyDialog = true"
        >
          SEND SURVEY TEAM
        </button>

        <button
          v-if="canEstablish"
          class="action-btn establish-btn"
          @click="showEstablishDialog = true"
        >
          ESTABLISH OUTPOST ({{ establishCost }})
        </button>

        <!-- Outpost info if exists -->
        <div v-if="sectorOutpost" class="outpost-info">
          <p class="mono">{{ sectorOutpost.name }}</p>
          <p class="mono detail">Level {{ sectorOutpost.extractionLevel }} | Crew: {{ sectorOutpost.crewIds.length }}</p>
          <p class="mono detail">
            Stockpile: {{ Math.floor(totalStockpile) }} units
          </p>
          <p class="mono detail deposit-remaining">
            Deposit: {{ Math.floor(sectorOutpost.deposit.remainingYield) }} / {{ Math.floor(sectorOutpost.deposit.totalYield) }}
          </p>
          <button
            v-if="totalStockpile >= 1"
            class="action-btn launch-btn"
            @click="launchPayload"
          >
            LAUNCH PAYLOAD
          </button>
          <button
            class="action-btn abandon-btn"
            @click="abandonOutpost"
          >
            ABANDON
          </button>
        </div>

        <!-- Survey team selector dialog -->
        <div v-if="showSurveyDialog" class="crew-select">
          <p class="mono">Select 2-3 colonists:</p>
          <label
            v-for="c in availableColonists"
            :key="c.id"
            class="crew-option mono"
          >
            <input
              type="checkbox"
              :value="c.id"
              v-model="selectedCrewIds"
              :disabled="selectedCrewIds.length >= 3 && !selectedCrewIds.includes(c.id)"
            />
            {{ c.name }} ({{ c.trait }})
          </label>
          <button
            class="action-btn confirm-btn"
            :disabled="selectedCrewIds.length < 2"
            @click="confirmSurvey"
          >
            DISPATCH ({{ selectedCrewIds.length }})
          </button>
        </div>

        <!-- Establish outpost crew selector -->
        <div v-if="showEstablishDialog" class="crew-select">
          <p class="mono">Assign 2+ colonists:</p>
          <label
            v-for="c in availableColonists"
            :key="c.id"
            class="crew-option mono"
          >
            <input
              type="checkbox"
              :value="c.id"
              v-model="selectedCrewIds"
            />
            {{ c.name }} ({{ c.trait }})
          </label>
          <button
            class="action-btn confirm-btn"
            :disabled="selectedCrewIds.length < 2 || !canAffordOutpost"
            @click="confirmEstablish"
          >
            ESTABLISH ({{ selectedCrewIds.length }} crew)
          </button>
        </div>
      </div>
    </div>

    <!-- Moon HUD -->
    <div class="moon-hud">
      <div class="hud-item mono">
        <span class="hud-label">OUTPOSTS</span>
        <span class="hud-val">{{ moon.activeOutposts.length }}</span>
      </div>
      <div class="hud-item mono">
        <span class="hud-label">AWAY</span>
        <span class="hud-val">{{ moon.awayCount }}</span>
      </div>
      <div class="hud-item mono">
        <span class="hud-label">SCANNING</span>
        <span class="hud-val">{{ moon.activeScanId ? 'YES' : '—' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMoonStore, OUTPOST_ESTABLISH_COST_METALS, OUTPOST_ESTABLISH_COST_CREDITS } from '@/stores/moonStore'
import { useGameStore } from '@/stores/gameStore'
import { TERRAIN_CONFIGS, hexToPixel, travelTimeMs } from '@/systems/sectorGen'
import type { Sector, SurveyMission, OutpostLaunch } from '@/types/moon'
import SectorHex from './SectorHex.vue'

const moon = useMoonStore()
const game = useGameStore()

const zoom = ref(1)
const selectedSector = ref<Sector | null>(null)
const showSurveyDialog = ref(false)
const showEstablishDialog = ref(false)
const selectedCrewIds = ref<string[]>([])

const hexSize = 38 // SVG units per hex

// ── Sector positions ──

function sectorPos(sector: Sector): { x: number; y: number } {
  const s = hexSize
  const x = s * (3 / 2 * sector.q)
  const y = s * (Math.sqrt(3) / 2 * sector.q + Math.sqrt(3) * sector.r)
  return { x, y }
}

// ── Mission positions (interpolated along path) ──

function missionTarget(mission: SurveyMission): { x: number; y: number } {
  const sector = moon.sectors.find(s => s.id === mission.sectorId)
  if (!sector) return { x: 0, y: 0 }
  return sectorPos(sector)
}

function missionPosition(mission: SurveyMission): { x: number; y: number } {
  const target = missionTarget(mission)
  const now = game.totalPlaytimeMs

  if (mission.status === 'surveying') return target
  if (mission.status === 'complete') return { x: 0, y: 0 }

  if (mission.status === 'traveling') {
    const progress = Math.min(1, (now - mission.departedAt) / (mission.arrivalAt - mission.departedAt))
    return { x: target.x * progress, y: target.y * progress }
  }
  if (mission.status === 'returning') {
    const returnStart = mission.surveyCompleteAt
    const progress = Math.min(1, (now - returnStart) / (mission.returnAt - returnStart))
    return { x: target.x * (1 - progress), y: target.y * (1 - progress) }
  }
  return { x: 0, y: 0 }
}

// ── Launch positions ──

function launchPosition(launch: OutpostLaunch): { x: number; y: number } {
  const outpost = moon.outposts.find(o => o.id === launch.outpostId)
  if (!outpost) return { x: 0, y: 0 }
  const sector = moon.sectors.find(s => s.id === outpost.sectorId)
  if (!sector) return { x: 0, y: 0 }
  const target = sectorPos(sector)
  const now = game.totalPlaytimeMs
  const progress = Math.min(1, (now - launch.launchedAt) / (launch.arrivalAt - launch.launchedAt))
  return { x: target.x * (1 - progress), y: target.y * (1 - progress) }
}

// ── Sector selection ──

function onSectorSelect(sector: Sector) {
  if (sector.status === 'hidden') return
  selectedSector.value = sector
  showSurveyDialog.value = false
  showEstablishDialog.value = false
  selectedCrewIds.value = []
}

const sectorTitle = computed(() => {
  if (!selectedSector.value) return ''
  const s = selectedSector.value
  const terrain = TERRAIN_CONFIGS[s.terrain]
  return `${terrain.label} (${s.q}, ${s.r})`
})

const terrainDescription = computed(() => {
  if (!selectedSector.value) return ''
  const terrain = TERRAIN_CONFIGS[selectedSector.value.terrain]
  let desc = terrain.description
  if (selectedSector.value.scanSignature) {
    desc += ` | ${selectedSector.value.scanSignature.qualityHint} of ${selectedSector.value.scanSignature.depositType}`
  }
  if (selectedSector.value.deposit) {
    desc += ` | Confirmed: ${selectedSector.value.deposit.quality} ${selectedSector.value.deposit.type} (${Math.floor(selectedSector.value.deposit.remainingYield)} remaining)`
  }
  return desc
})

// ── Actions ──

const canScan = computed(() => {
  if (!selectedSector.value) return false
  return selectedSector.value.status === 'visible'
})

const canSurvey = computed(() => {
  if (!selectedSector.value) return false
  return selectedSector.value.status === 'scanned' && selectedSector.value.scanSignature !== null
})

const canEstablish = computed(() => {
  if (!selectedSector.value) return false
  return selectedSector.value.status === 'surveyed'
    && selectedSector.value.deposit !== null
    && !selectedSector.value.outpostId
})

const canAffordOutpost = computed(() => {
  return game.metals >= OUTPOST_ESTABLISH_COST_METALS && game.credits >= OUTPOST_ESTABLISH_COST_CREDITS
})

const establishCost = `${OUTPOST_ESTABLISH_COST_METALS}m, ${OUTPOST_ESTABLISH_COST_CREDITS}cr`

const sectorOutpost = computed(() => {
  if (!selectedSector.value?.outpostId) return null
  return moon.outposts.find(o => o.id === selectedSector.value!.outpostId) ?? null
})

const totalStockpile = computed(() => {
  if (!sectorOutpost.value) return 0
  const s = sectorOutpost.value.stockpile
  return s.metals + s.ice + s.rareMinerals
})

const availableColonists = computed(() => {
  const away = moon.awayColonistIds
  return game.colonists.filter(c => c.health > 0 && !away.has(c.id))
})

function queueScan() {
  if (!selectedSector.value) return
  moon.queueScan(selectedSector.value.id)
}

function confirmSurvey() {
  if (!selectedSector.value || selectedCrewIds.value.length < 2) return
  moon.launchSurvey(
    selectedSector.value.id,
    selectedCrewIds.value,
    game.totalPlaytimeMs,
    (text, sev) => game.pushMessage(text, sev),
  )
  showSurveyDialog.value = false
  selectedCrewIds.value = []
}

function confirmEstablish() {
  if (!selectedSector.value || selectedCrewIds.value.length < 2 || !canAffordOutpost.value) return
  game.metals -= OUTPOST_ESTABLISH_COST_METALS
  game.credits -= OUTPOST_ESTABLISH_COST_CREDITS
  moon.establishOutpost(
    selectedSector.value.id,
    selectedCrewIds.value,
    game.totalPlaytimeMs,
    (text, sev) => game.pushMessage(text, sev),
  )
  showEstablishDialog.value = false
  selectedCrewIds.value = []
}

function launchPayload() {
  if (!sectorOutpost.value) return
  moon.launchFromOutpost(
    sectorOutpost.value.id,
    game.totalPlaytimeMs,
    (text, sev) => game.pushMessage(text, sev),
  )
}

function abandonOutpost() {
  if (!sectorOutpost.value) return
  moon.abandonOutpost(
    sectorOutpost.value.id,
    (colonistId) => {
      const c = game.colonists.find(col => col.id === colonistId)
      if (c) {
        c.currentZone = 'habitat'
        c.currentAction = null
      }
    },
    (text, sev) => game.pushMessage(text, sev),
  )
  selectedSector.value = null
}

// ── Pan/zoom ──
let panStart: { x: number; y: number } | null = null

function onPointerDown(e: PointerEvent) {
  panStart = { x: e.clientX, y: e.clientY }
}

function onPointerMove(_e: PointerEvent) {
  // Pan logic can be added later
}

function onPointerUp() {
  panStart = null
}
</script>

<style scoped>
.moon-map {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--bg-deep);
  overflow: hidden;
}

.moon-svg {
  width: 100%;
  height: 100%;
}

.survey-path {
  stroke: var(--amber);
  stroke-width: 1;
  stroke-dasharray: 4 2;
  opacity: 0.5;
}

.survey-marker {
  fill: var(--amber);
  filter: drop-shadow(0 0 3px var(--amber));
}

.survey-marker.returning {
  fill: var(--cyan);
  filter: drop-shadow(0 0 3px var(--cyan));
}

.launch-marker {
  fill: var(--green);
  filter: drop-shadow(0 0 3px var(--green));
}

/* Sector info panel */
.sector-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-elevated);
  border-top: 1px solid var(--accent-muted);
  padding: 8px 12px;
  max-height: 45%;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.panel-title {
  font-size: 12px;
  color: var(--text-primary);
}

.panel-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
}

.panel-body {
  font-size: 10px;
}

.terrain-info {
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-size: 9px;
  line-height: 1.4;
}

.action-btn {
  display: block;
  width: 100%;
  padding: 8px;
  margin-top: 6px;
  background: var(--accent-dim);
  border: 1px solid var(--accent-muted);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
  text-align: center;
}

.action-btn:hover {
  background: var(--accent-muted);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.scan-btn { border-color: var(--cyan); color: var(--cyan); }
.survey-btn { border-color: var(--amber); color: var(--amber); }
.establish-btn { border-color: var(--green); color: var(--green); }
.launch-btn { border-color: var(--green); color: var(--green); }
.abandon-btn { border-color: var(--red); color: var(--red); opacity: 0.7; }

.outpost-info {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--accent-dim);
}

.outpost-info .detail {
  font-size: 9px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.deposit-remaining {
  color: var(--amber) !important;
}

.crew-select {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--accent-dim);
}

.crew-option {
  display: block;
  padding: 4px 0;
  font-size: 10px;
  color: var(--text-secondary);
  cursor: pointer;
}

.crew-option input {
  margin-right: 6px;
}

.confirm-btn {
  margin-top: 8px;
}

/* Moon HUD */
.moon-hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  padding: calc(var(--safe-top) + 3px) 6px 4px;
  background: var(--overlay-bg);
  border-bottom: 1px solid var(--accent-muted);
}

.moon-hud .hud-item {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 10px;
}

.moon-hud .hud-label {
  color: var(--text-muted);
  font-size: 8px;
}

.moon-hud .hud-val {
  color: var(--text-primary);
}
</style>
```

- [ ] **Step 3: Update GameView.vue to switch between lenses**

Replace `src/components/GameView.vue`:

```vue
<template>
  <div class="game-view">
    <div class="map-panel" :class="{ transitioning: isTransitioning }">
      <ColonyMap v-if="lens === 'close'" />
      <MoonMap v-else />
      <!-- Lens switcher button -->
      <button class="lens-switch" @click="toggleLens">
        {{ lens === 'close' ? 'MEDIUM LENS' : 'CLOSE LENS' }}
      </button>
    </div>
    <div class="console-panel">
      <CommandConsole @open-settings="$emit('open-settings')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import ColonyMap from './ColonyMap.vue'
import MoonMap from './MoonMap.vue'
import CommandConsole from './CommandConsole.vue'
import { useLensView } from '@/composables/useLensView'

defineEmits<{ 'open-settings': [] }>()

const { lens, isTransitioning, toggleLens } = useLensView()
</script>

<style scoped>
.game-view {
  height: 100%;
  display: grid;
  grid-template-rows: 55fr 45fr;
}

.map-panel {
  position: relative;
  overflow: hidden;
}

.map-panel.transitioning {
  animation: lens-refocus 0.6s ease-in-out;
}

@keyframes lens-refocus {
  0% { filter: brightness(1) blur(0); }
  40% { filter: brightness(0.3) blur(4px); }
  60% { filter: brightness(0.3) blur(4px); }
  100% { filter: brightness(1) blur(0); }
}

.console-panel {
  overflow: hidden;
}

.lens-switch {
  position: absolute;
  bottom: 8px;
  right: 8px;
  z-index: 20;
  padding: 6px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--accent-muted);
  color: var(--cyan);
  font-family: var(--font-mono);
  font-size: 9px;
  cursor: pointer;
  border-radius: 2px;
}

.lens-switch:active {
  background: var(--accent-muted);
}

/* Landscape phones + tablets: side-by-side layout */
@media (orientation: landscape), (min-width: 768px) {
  .game-view {
    grid-template-rows: none;
    grid-template-columns: 55fr 45fr;
  }

  .map-panel {
    padding-left: var(--safe-left);
  }

  .console-panel {
    padding-right: var(--safe-right);
  }
}
</style>
```

- [ ] **Step 4: Verify compilation**

Run: `bunx vue-tsc --noEmit`

Expected: No errors.

- [ ] **Step 5: Manual smoke test**

Run: `bun run dev`

Verify in browser:
- Colony close lens loads as before
- "MEDIUM LENS" button visible in bottom-right of map
- Clicking it transitions to medium lens with hex grid visible
- Colony hex at center, surrounding sectors with terrain colors
- Hidden sectors show fog
- Clicking back to "CLOSE LENS" returns to colony view
- Transition has brief blur/darken effect

- [ ] **Step 6: Commit**

```bash
git add src/components/MoonMap.vue src/components/SectorHex.vue src/components/GameView.vue
git commit -m "feat: add medium lens with moon map, sector hexes, and lens switching

New MoonMap component renders hex-grid sectors with terrain types.
SectorHex handles individual sector rendering and selection.
GameView switches between close/medium lens with refocusing animation."
```

---

### Task 7: Moon State Persistence

Ensure moon state is saved/loaded alongside colony state, and offline simulation accounts for moon systems.

**Files:**
- Modify: `src/stores/gameStore.ts` (save/load moon state)
- Modify: `src/stores/moonStore.ts` (add save/load helpers)
- Modify: `src/stores/offlineEngine.ts` (basic moon offline simulation)

- [ ] **Step 1: Add moon state to save/load in gameStore**

In `src/stores/gameStore.ts`, find the `save()` action and add moon state:

```typescript
async save() {
  const moon = useMoonStore()
  const saveData = {
    colony: this.$state,
    moon: moon.$state,
  }
  try {
    await Preferences.set({ key: SAVE_KEY, value: JSON.stringify(saveData) })
    this.lastSavedAt = Date.now()
  } catch {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData))
      this.lastSavedAt = Date.now()
    } catch { /* silent */ }
  }
},
```

Update `load()` to restore moon state:

```typescript
async load() {
  let raw: string | null = null
  try {
    const res = await Preferences.get({ key: SAVE_KEY })
    raw = res.value
  } catch {
    raw = localStorage.getItem(SAVE_KEY)
  }
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      // Handle both old format (flat colony state) and new format (colony + moon)
      if (parsed.colony) {
        this.$patch(parsed.colony)
        const moon = useMoonStore()
        if (parsed.moon) {
          moon.$patch(parsed.moon)
        } else {
          moon.initialize(Date.now())
        }
      } else {
        // Legacy save — flat colony state
        this.$patch(parsed)
        const moon = useMoonStore()
        moon.initialize(Date.now())
      }
    } catch { /* corrupt save, use fresh state */ }
  } else {
    // New game
    const moon = useMoonStore()
    moon.initialize(Date.now())
  }
},
```

- [ ] **Step 2: Add basic outpost simulation to offlineEngine**

In `src/stores/offlineEngine.ts`, after the existing offline simulation, add a simplified outpost production pass. At the end of `simulateOffline()`, before returning the result:

```typescript
// Simplified outpost production during offline
// We don't import moonStore here (offline engine is pure), so we just
// note that outpost production should be handled by moonStore when
// the game resumes. The tick loop will catch up outpost state.
```

For now, outpost production during offline is deferred — the tick loop will process accumulated time when the app resumes. This is acceptable for P1 since outpost production is secondary income.

- [ ] **Step 3: Bump save version**

In `src/stores/gameStore.ts`, update the save key:

```typescript
const SAVE_KEY = 'colony-save-v4'
const LEGACY_SAVE_KEY = 'colony-save-v3'
```

Add migration handling in `load()` for the old key.

- [ ] **Step 4: Verify save/load works**

Run: `bun run dev`

Verify:
- Start game, switch to medium lens, scan a sector
- Refresh browser — moon state persists
- Check that new games start with fresh sector generation

- [ ] **Step 5: Commit**

```bash
git add src/stores/gameStore.ts src/stores/moonStore.ts src/stores/offlineEngine.ts
git commit -m "feat: persist moon state in save/load system

Moon store state saved alongside colony state. Legacy save format
migration supported. Bumps save version to v4."
```

---

### Task 8: Close Lens Updates — Away Colonists & HUD Changes

Update the close lens to reflect colonists being away and adjust the HUD to show relevant moon info.

**Files:**
- Modify: `src/components/ResourceHud.vue` (replace depth with outpost count)
- Modify: `src/composables/useColonistMovement.ts` (hide away colonists)
- Modify: `src/components/ColonyMap.vue` (show away count indicator)

- [ ] **Step 1: Update ResourceHud to show outpost info instead of depth**

In `src/components/ResourceHud.vue`, replace the depth HUD item (lines 35-38):

```vue
<div class="hud-item outposts">
  <SvgIcon name="depth" size="xs" />
  <div class="hud-stack">
    <span class="hud-val mono">{{ moon.activeOutposts.length }} sites</span>
    <span class="hud-rate mono away-count" v-if="moon.awayCount > 0">{{ moon.awayCount }} away</span>
  </div>
</div>
```

Add the moon store import:

```typescript
import { useMoonStore } from '@/stores/moonStore'

const moon = useMoonStore()
```

Update styles — replace `.hud-item.depth` with:

```css
.hud-item.outposts {
  color: var(--cyan);
}

.hud-item.outposts .hud-val {
  color: var(--cyan);
  font-size: 10px;
}

.away-count {
  font-size: 8px;
  color: var(--amber);
}
```

- [ ] **Step 2: Hide away colonists from movement system**

In `src/composables/useColonistMovement.ts`, in the `update()` function, add a check for away colonists. At the top of the update loop for each colonist, skip if they're away:

```typescript
import { useMoonStore } from '@/stores/moonStore'

// Inside update():
const moonStore = useMoonStore()
const awayIds = moonStore.awayColonistIds

// In the per-colonist loop, add at the top:
if (awayIds.has(colonist.id)) {
  // Remove from visible positions
  positions.value.delete(colonist.id)
  continue
}
```

- [ ] **Step 3: Add away crew indicator to ColonyMap**

In `src/components/ColonyMap.vue`, add a small indicator showing how many colonists are away. Add after the ResourceHud component:

```vue
<div v-if="moon.awayCount > 0" class="away-indicator mono">
  {{ moon.awayCount }} CREW DEPLOYED
</div>
```

Add import and setup:

```typescript
import { useMoonStore } from '@/stores/moonStore'
const moon = useMoonStore()
```

Add style:

```css
.away-indicator {
  position: absolute;
  bottom: 36px;
  left: 8px;
  z-index: 10;
  font-size: 8px;
  color: var(--amber);
  padding: 2px 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--accent-dim);
  border-radius: 2px;
}
```

- [ ] **Step 4: Verify**

Run: `bun run dev`

Verify:
- HUD shows outpost count instead of depth
- When colonists are sent on survey, they disappear from close lens
- Away count shows in both HUD and map indicator
- Colonists reappear at habitat when mission completes

- [ ] **Step 5: Commit**

```bash
git add src/components/ResourceHud.vue src/composables/useColonistMovement.ts src/components/ColonyMap.vue
git commit -m "feat: update close lens for away colonists and outpost HUD

ResourceHud shows outpost count and away crew instead of depth.
Away colonists hidden from colony map movement system.
Colony map shows deployed crew indicator."
```

---

### Task 9: Update Documentation

Update CLAUDE.md and IDEAS.md to reflect the new core loop.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/IDEAS.md`

- [ ] **Step 1: Update CLAUDE.md**

Key changes:
- Replace "Asteroid colony idle game" with "Moon colony idle game" in Architecture header
- Update the Tick-Driven Simulation section to mention moon systems (scanning, surveys, outpost extraction, launches)
- Update "Advance depth, mine metals" to "Extract resources at colony and outposts"
- Rename drill references: "drill site" → "extraction zone", "drill rigs" → "extraction rigs"
- Add Medium Lens description to Component Layout section
- Update Map Zones: rename `drillSite` → `extraction`
- Add Lens System subsection explaining close/medium lens switching
- Update Key Conventions if any reference drill/asteroid

- [ ] **Step 2: Update IDEAS.md**

Key changes:
- Update "What We Have Now" section to describe the survey/extract loop
- Mark P1 "Depth Zones & Biomes" as partially implemented (terrain system exists, biome-specific mechanics are the medium lens sectors)
- Reframe remaining P1 items in context of moon setting (not asteroid)
- Update P4 zoom levels — note that Close + Medium lenses are now implemented, Far lens remains planned
- Replace all "asteroid" references with "moon"
- Update "drilling" language to "extraction" / "survey"

- [ ] **Step 3: Verify no broken references**

Scan for any remaining "asteroid" or "drill" references that should be updated:

Run: `grep -ri "asteroid\|drill" src/ --include="*.ts" --include="*.vue"`

Fix any remaining references.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/IDEAS.md
git commit -m "docs: update CLAUDE.md and IDEAS.md for moon survey/extract model

Replaces asteroid/drilling terminology with moon/extraction throughout.
Documents medium lens, sector system, and survey pipeline."
```

---

### Task 10: Integration Testing & Polish

End-to-end verification that the full survey → extract → launch → receive loop works.

**Files:**
- No new files — verification and fixes only

- [ ] **Step 1: Full loop smoke test**

Run: `bun run dev`

Test the complete flow:
1. Game starts on close lens with colony functioning
2. Switch to medium lens — hex grid visible with colony at center
3. Tap a visible sector → "INITIATE SCAN" button appears
4. Initiate scan → sector shows "SCANNING..." → completes after ~45s
5. Scanned sector with deposit → "SEND SURVEY TEAM" button
6. Select 2 colonists → dispatch → team marker moves on map
7. Those colonists disappear from close lens
8. Survey completes → team returns → colonists reappear at habitat
9. Surveyed sector with confirmed deposit → "ESTABLISH OUTPOST"
10. Select crew, establish (deducts metals + credits)
11. Outpost appears on sector, stockpile accumulates
12. "LAUNCH PAYLOAD" sends resources back
13. Payload arrives at colony, resources added
14. Auto-save works, refresh preserves moon state

- [ ] **Step 2: Fix any issues found**

Address any bugs discovered during the smoke test. Common issues to watch for:
- Colonist AI trying to assign actions to away colonists
- Moon store not initialized on first load
- Scan/survey timing off with time multiplier
- Sector panel not updating reactively

- [ ] **Step 3: Type check**

Run: `bunx vue-tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Build check**

Run: `bun run build`

Expected: Clean build with no errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix: integration fixes for survey/extract core loop"
```
