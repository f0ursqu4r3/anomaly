# Building Construction & Placement — Design Spec

## Overview

Rework building placement from instant creation to a multi-phase construction process. Buildings arrive as prefab kits, are unpacked by colonists, then constructed by engineers over time. Placement uses organic cluster growth within zones instead of random scatter. Colonist foot traffic creates visible worn paths between zones.

## 1. Construction Phase

### Flow

Shipment arrives → supply drop lands → colonists unpack crate (existing system) → building placed as ghost/wireframe at computed position → engineers construct over time → building becomes operational.

### Building State

The `Building` interface gains a new field:

```typescript
constructionProgress: number | null  // null = operational, 0-1 = under construction
```

Buildings with `constructionProgress !== null` are **not operational** — they don't produce power, generate O2, extract resources, heal, etc. They can't be damaged by hazards during construction.

### Construction Times

Fixed per building type, defined in `src/config/buildings.ts`:

| Building | Construction Time (seconds) | Rationale |
|---|---|---|
| Storage Silo | 20 | Simple metal frame |
| Solar Panel | 45 | Precision alignment, wiring |
| Extraction Rig | 50 | Heavy machinery assembly |
| O2 Generator | 60 | Complex life support system |
| Parts Factory | 60 | Workshop tooling, precision |
| Med Bay | 75 | Medical equipment calibration |
| Launch Platform | 90 | Largest structure, heavy engineering |

### Engineer Assignment

- New action type: `construct` — engineers walk to the construction site and build
- AI scoring: construction sites score high for engineers (priority similar to repair)
- At least 1 engineer required for progress
- Additional engineers speed construction with diminishing returns:
  - 1 engineer: 100% speed
  - 2 engineers: 160% speed
  - 3 engineers: 200% speed
  - Formula: `speedMultiplier = 1 + (engineers - 1) * 0.6` capped at `engineers <= 3`
- Progress per tick: `(1 / constructionTimeTicks) * speedMultiplier`
- Engineers show as worker pips on the construction site

### Visual

- **Ghost/wireframe**: Building icon rendered with dashed border, low opacity (~0.4), using the building's theme color
- **Progress bar**: Thin bar below the building icon showing construction progress (0-100%)
- **Engineer pips**: Cyan dots below progress bar (same as operational buildings)
- **Completion**: Transition to solid icon with full glow. Radio message: "{engineer}: {building} construction complete. Systems online."
- **Construction start**: Radio message: "Construction started on {building}."

### Interaction with Existing Systems

- `applySupplyDrop`: Instead of pushing a fully operational building, push one with `constructionProgress: 0`
- Building production getters (power, O2, extraction, etc.): Filter out buildings where `constructionProgress !== null`
- Hazard targeting: Skip buildings under construction (nothing to damage yet)
- Repair system: Not applicable during construction
- BuildingInfo overlay: Show "Under Construction — X%" instead of "Operational"

## 2. Organic Cluster Placement

### Algorithm

Replace the current random-scatter placement with anchor-based cluster growth:

1. Find all existing buildings in the target zone
2. If none exist, place at zone center with slight random offset (±2 units)
3. If buildings exist:
   a. Pick a random existing building in the zone as the "anchor"
   b. Choose a random angle from the anchor
   c. Place at fixed offset distance (~4.5 map units) from the anchor
   d. Validate: within zone radius, minimum distance (3.5 units) from all other buildings
   e. Retry with different anchor/angle up to 30 attempts
4. Apply slight random rotation (±5°) for visual variety
5. Fallback: if all attempts fail, use current golden-angle spiral

### Effect

- Power zone: solar panels cluster together like a solar farm
- Extraction zone: rigs form a mining camp, silos nearby
- Medical zone: med bays create a medical compound
- Each zone's shape is different every game (random anchors and angles)
- Zone radius still constrains spread — natural soft cap on buildings per zone

## 3. Worn Paths (Desire Lines)

### Traffic Tracking

A `Map<string, number>` keyed by sorted zone-pair strings (e.g., `"extraction:habitat"`). Stored in `ColonyState`.

- Each time a colonist completes a walk between two zones, increment the pair counter by 1
- Counters decay at -1 per 60 seconds so abandoned routes fade
- Only track direct zone-to-zone transitions (from the colonist's walkPath)

### Rendering

SVG lines on the colony map between zone centers, styled by traffic intensity:

| Traffic (trips) | Opacity | Width | Appearance |
|---|---|---|---|
| < 10 | 0 | — | Invisible |
| 10–50 | 0.1 | 1px | Faint trace |
| 50–150 | 0.2 | 1.5px | Light path |
| 150+ | 0.35 | 2px | Worn trail |

- Color: neutral gray/white (`rgba(200, 200, 200, opacity)`)
- Rendered below buildings, above zone circles
- Uses existing zone path graph for line routing (zone center to zone center)

### Visual Only

No gameplay effect on movement speed. Future enhancement potential.

### Persistence

Traffic counters saved with game state. Decay is tick-driven (check every 60 ticks, decrement all counters by 1, remove entries at 0).

## 4. Building Config File

### Unified Source of Truth

Create `src/config/buildings.ts` — single definition per building type replacing scattered data across `BLUEPRINTS`, `SHIPMENT_OPTIONS`, and `ZONE_FOR_BUILDING`.

```typescript
export interface BuildingConfig {
  type: BuildingType
  label: string
  description: string
  zone: string
  constructionTime: number  // seconds
  costMetals: number
  costIce: number
  shipmentCost: number | null  // null = colony-built, not orderable from HQ
  shipmentWeight: number | null
}
```

### Derived Constants

The existing `BLUEPRINTS`, `SHIPMENT_OPTIONS`, and `ZONE_FOR_BUILDING` are derived from the config:

```typescript
export const BLUEPRINTS = BUILDING_CONFIGS.map(c => ({
  type: c.type, label: c.label, description: c.description,
  costMetals: c.costMetals, costIce: c.costIce,
}))

export const SHIPMENT_OPTIONS = BUILDING_CONFIGS
  .filter(c => c.shipmentCost !== null)
  .map(c => ({
    type: 'equipment' as const, label: c.label, description: c.description,
    cost: c.shipmentCost!, weight: c.shipmentWeight!, buildingType: c.type,
  }))

export const ZONE_FOR_BUILDING = Object.fromEntries(
  BUILDING_CONFIGS.map(c => [c.type, c.zone])
)
```

Non-equipment shipment items (Supply Crate, New Colonist, Repair Kit, Emergency O2/Power) remain as a separate array since they aren't buildings.

### Config Values

| Type | Label | Zone | Construct(s) | Metals | Ice | HQ Cost | Weight |
|---|---|---|---|---|---|---|---|
| solar | Solar Panel | power | 45 | 15 | 0 | 800 | 18 |
| o2generator | O2 Generator | lifeSup | 60 | 20 | 5 | 1000 | 32 |
| extractionrig | Extraction Rig | extraction | 50 | 25 | 0 | 1300 | 55 |
| medbay | Med Bay | medical | 75 | 30 | 10 | 1500 | 40 |
| partsfactory | Parts Factory | workshop | 60 | 15 | 0 | 800 | 30 |
| storageSilo | Storage Silo | extraction | 20 | 20 | 0 | 600 | 20 |
| launchplatform | Launch Platform | landing | 90 | 30 | 0 | null | null |

Note: Storage Silo is now orderable from HQ (600cr). Launch Platform remains colony-built only.

## 5. New Action Type: `construct`

Added to `ActionType`. Engineers walk to the construction site and work on it.

- AI scoring: Similar to `repair` — high priority when construction sites exist, strong diminishing returns (first engineer gets full score, second much less)
- Duration: Continuous — engineer works until construction completes or they're interrupted by needs
- XP: Awards engineering XP on completion (when building finishes, not per tick)
- Radio chatter: "Working on the new {building}." / "{building} construction complete."

## 6. Systems Affected

### New Files
- `src/config/buildings.ts` — unified building config

### Modified Files
- `src/stores/gameStore.ts` — `Building` interface gains `constructionProgress`, construction tick logic, remove auto-build for silos/launch platform (both now go through normal construction), derive `BLUEPRINTS` from config
- `src/systems/colonistAI.ts` — add `construct` action scoring and duration
- `src/systems/mapLayout.ts` — new cluster placement algorithm in `getBuildingPosition`
- `src/types/colonist.ts` — add `construct` to `ActionType`
- `src/components/MapBuilding.vue` — ghost/wireframe rendering for under-construction buildings, progress bar
- `src/components/BuildingInfo.vue` — show construction progress instead of "Operational"
- `src/components/ColonyMap.vue` — render worn path SVG lines
- `src/systems/radioChatter.ts` — construction start/complete messages
- `src/composables/useColonistMovement.ts` — track zone transitions for traffic, `construct` visual state
- `src/stores/offlineEngine.ts` — offline construction progress

### Data Model Additions

```typescript
// Building interface addition
constructionProgress: number | null  // null = operational

// ColonyState addition
zonePaths: Record<string, number>  // "zone1:zone2" → traffic count

// ActionType addition
'construct'
```

### Save Migration

- Backfill existing buildings: `constructionProgress = null` (all already operational)
- Backfill `zonePaths: {}` 
