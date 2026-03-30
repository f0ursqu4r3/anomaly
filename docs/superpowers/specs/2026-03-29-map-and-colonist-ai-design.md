# Map Layout & Colonist AI Overhaul

**Date:** 2026-03-29
**Status:** Draft

## Overview

Two interconnected systems redesigned to make the colony feel like a real place inhabited by real people, viewed through an orbiting satellite camera.

1. **Zoned Organic Map** — Named zones with satellite overlay labels, organic building scatter within zones, path graph connecting zones, pan/zoom.
2. **Utility-Scored Colonist AI** — Colonists with needs (energy, morale, health), personality traits, and utility-based action selection. Directives influence behavior through utility weights rather than direct role assignment.

### Design Principles

- The player is a **remote operator** watching through a satellite feed — colonists are autonomous, not puppets
- **Soft autonomy**: colonists mostly follow directives but have human needs that occasionally take priority
- Realism comes from **visible emergent behavior**, not exposed internal state — the player sees what colonists *do*, not what they *think*
- Production fluctuates naturally as colonists rest, socialize, and respond to emergencies

---

## 1. Map System

### Zone Architecture

Six zones, each with a center point (% coordinates), radius, label, and accent color:

| Zone | ID | Center | Radius | Label | Color | Building Types |
|------|----|--------|--------|-------|-------|---------------|
| Habitat | `habitat` | 50, 40 | 10% | SEC-A HABITAT | `#4af` | — |
| Power | `power` | 30, 25 | 9% | SEC-B POWER | `#f80` | solar |
| Life Support | `lifeSup` | 70, 25 | 9% | SEC-C LIFESUP | `#0ff` | o2generator |
| Drill | `drill` | 50, 65 | 10% | SEC-D DRILL | `#0f8` | drillrig |
| Medical | `medical` | 75, 48 | 7% | SEC-E MED | `#f44` | medbay |
| Landing | `landing` | 25, 50 | 7% | LZ-1 | `#f80` | — |

### Building Placement

- New buildings placed at zone center + **random offset within zone radius**
- Slight random rotation (±5°) for organic feel
- **Collision avoidance**: new buildings must be ≥ minimum distance from existing buildings in the same zone
- First building in a zone snaps to center
- Zone radius can expand slightly as buildings accumulate (growth feel)

Replaces the current `SLOT_OFFSETS` grid system entirely.

### Path Graph

Zones connected by edges forming a simple graph:

```
        power ——— lifeSup
          \       /
           habitat
          /    \
     landing    medical
          \    /
           drill
```

Edges:
- habitat ↔ power
- habitat ↔ lifeSup
- habitat ↔ drill
- habitat ↔ medical
- habitat ↔ landing
- power ↔ lifeSup (infrastructure corridor)

Colonists walk **along path edges** between zones (not straight lines across the map). Within a zone, colonists move freely to their target building/spot.

### Path Rendering

- Faint lines between zone centers, opacity 0.08–0.15
- Always visible as satellite HUD overlay
- Drawn as static SVG, not per-frame

### Zone Rendering

- Faint dashed circle at each zone boundary
- Monospace sector label above each zone
- Both are satellite HUD overlays (not affected by zoom transform)

### Pan & Zoom

- Map content wrapped in a CSS transform container: `transform: scale(zoom) translate(panX, panY)`
- **Touch**: pinch to zoom, drag to pan
- **Mouse**: scroll to zoom, click-drag to pan
- Zoom range: 0.8x → 2.0x (close level only)
- Default: 1.0x (whole colony visible)
- Pan bounds prevent scrolling past colony edges + margin
- Double-tap/click: re-center on habitat, reset zoom
- Smooth transitions with CSS ease-out
- HUD elements (resource bar, LIVE indicator) stay **fixed** outside the transform

---

## 2. Colonist AI

### Needs

Three needs per colonist, range 0–100:

**Energy**
- Drains: ~1.5/tick while working, ~0.5/tick while walking
- Recovers: ~3.0/tick while resting at habitat
- Threshold 30%: "tired" — rest utility spikes
- Threshold 10%: "exhausted" — forced interrupt, must rest

**Morale**
- Drains: ~0.2/tick passively, faster during hazards/injuries
- Recovers: ~2.0/tick while socializing, ~0.5/tick while resting
- Threshold 25%: "stressed" — work speed -30%
- Threshold 10%: "breaking" — refuses work tasks

**Health**
- Existing system unchanged
- Threshold 40%: seek medical utility rises sharply
- Threshold 0%: incapacitated (existing behavior)

### Action Catalog

Eight actions, scored by utility at each decision point:

| Action | Target Zone | Preconditions | Utility Driver |
|--------|------------|---------------|----------------|
| DRILL | drill | energy > 20% | High when directive=mining, scales with colony drill need |
| ENGINEER | power or lifeSup | energy > 20% | High when directive=safety. Zone chosen by **resource need**: targets whichever resource (power or air) is lower as a % of max. Tie-break: random. |
| REPAIR | damaged bldg zone | damaged building exists | Very high — urgent, any colonist |
| UNPACK | landing | supply drop exists | High on arrival, diminishes per worker assigned |
| REST | habitat | always | Exponential rise as energy drops below 30% |
| SOCIALIZE | habitat | another colonist at habitat | Rises as morale drops, bonus if another colonist present |
| SEEK_MEDICAL | medical | health < 70%, med bay exists | Exponential rise as health drops below 40% |
| WANDER | habitat area | always | Very low baseline — fallback |

### Decision Loop

Colonists make decisions at these points (NOT every tick):
1. When current action **completes** (natural end)
2. When a **forced interrupt** fires (exhaustion at energy ≤ 10%, breaking at morale ≤ 10%)
3. When an **urgent event** occurs (supply drop lands, building damaged)

**Algorithm:**
1. Gather all actions where preconditions are met
2. Score each: `baseUtility × needModifier × traitModifier × directiveModifier`
3. Add small random noise (±10%) to prevent lockstep behavior
4. Pick highest score
5. If action requires a different zone → generate walk path via path graph, WALK first
6. Begin action (set duration, start animation)

### Traits

One trait per colonist, assigned at creation. Each trait modifies utility weights and need drain/recovery rates:

| Trait | Effect |
|-------|--------|
| **Hardy** | Energy drains 25% slower. Rest utility threshold lower. |
| **Diligent** | Work utility +20% bonus. Less likely to socialize early. |
| **Social** | Morale drains faster when alone. Socialize utility boosted. |
| **Cautious** | Repair utility boosted. Seeks medical earlier. |
| **Efficient** | Work actions complete 15% faster. Walk speed +10%. |
| **Stoic** | Morale drains 30% slower. Socialize utility reduced. |

### Directive Integration

Directives no longer reassign roles. They **modify utility weights**:

| Directive | Effect |
|-----------|--------|
| Mining | drill utility ×1.5, engineer utility ×0.6 |
| Safety | repair/engineer utility ×1.5, drill utility ×0.6 |
| Balanced | no modifiers |
| Emergency | repair/engineer utility ×2.0, rest threshold lowered |

`reassignRoles()` is **removed entirely**. Colonists self-organize. The directive is a thumb on the scale, not a direct command.

### Automatic Emergency Behavior

The current system auto-overrides roles when air or power drops below 20%, independent of the player's directive. This spec replaces that with **implicit utility boosts** baked into the scoring system:

- When air < 20%: ENGINEER action targeting lifeSup zone gets a ×3.0 implicit multiplier (stacks with directive modifier)
- When power < 20%: ENGINEER action targeting power zone gets a ×3.0 implicit multiplier
- When both < 20%: both multipliers active, colonists split based on which is lower
- These are **not** directive changes — they're world-state modifiers in the utility calculation, always active regardless of selected directive

This preserves the "idle game safety net" (colony doesn't die while player is away) while keeping the utility system as the single decision-making mechanism. The player never needs to manually switch to Emergency for survival — it happens organically.

---

## 3. Architecture

### New Files

```
src/systems/colonistAI.ts    — utility scoring, action selection, needs update
src/systems/mapLayout.ts     — zone definitions, path graph, building placement
src/systems/pathfinding.ts   — zone-to-zone path resolution, walk waypoints
src/types/colonist.ts        — ColonistState, Action, Need, Trait types
src/types/map.ts             — Zone, PathEdge, BuildingPlacement types
```

### Modified Files

```
src/stores/gameStore.ts                  — remove reassignRoles(), add needs tick, delegate to systems
src/composables/useColonistMovement.ts   — path-based walking, new visual states
src/components/ColonyMap.vue             — pan/zoom container, path rendering, zone overlays
src/components/MapColonist.vue           — new visual states (resting, socializing, injured)
src/components/MapBuilding.vue           — rotation support for organic scatter
```

### Removed

- `reassignRoles()` — replaced by utility-based self-organization
- `SLOT_OFFSETS` — replaced by organic scatter placement
- `ZONE_FOR_TYPE` — moves into `mapLayout.ts` as part of zone config

### Data Model

**Colonist (updated):**
```typescript
interface Colonist {
  id: string
  name: string
  health: number
  energy: number          // 0-100, new
  morale: number          // 0-100, new
  trait: Trait             // assigned at creation, new
  currentAction: Action | null  // new
  currentZone: string     // which zone they're in, new
}
```

Note: `role` field is removed. A colonist's effective role is determined by their current action (drilling = driller, engineering = engineer, etc.).

**Zone:**
```typescript
interface Zone {
  id: string
  x: number              // center % (0-100)
  y: number
  radius: number         // base radius %
  label: string          // 'SEC-A HABITAT'
  color: string          // accent color
  buildingTypes: BuildingType[]
}
```

**PathEdge:**
```typescript
interface PathEdge {
  from: string           // zone id
  to: string
  weight: number         // distance cost
}
```

**Action:**
```typescript
interface Action {
  type: ActionType
  targetZone: string
  targetId?: string      // building or drop id
  remainingTicks: number
  walkPath?: string[]    // zone waypoints if walking between zones
}

type ActionType = 'drill' | 'engineer' | 'repair' | 'unpack' | 'rest' | 'socialize' | 'seek_medical' | 'wander'
```

**Trait:**
```typescript
type Trait = 'hardy' | 'diligent' | 'social' | 'cautious' | 'efficient' | 'stoic'
```

### Tick Order (New)

1. **Update colonist needs** — drain energy/morale based on current action
2. **Check forced interrupts** — exhaustion, critical health → override current action
3. **Advance actions** — decrement remainingTicks, complete if done
4. **Decision point for idle colonists** — run utility scoring, pick new action
5. **Calculate production** — power, air based on who is actively WORKING at what zone
6. **Advance drilling & credits** — based on colonists actively drilling
7. **Med bay healing** — colonists at med bay with SEEK_MEDICAL action
8. **Health drain** — if air/power critical (unchanged)
9. **Update resource caps** — (unchanged)
10. **Process shipments & drops** — (unchanged, but drops trigger urgent re-evaluation)
11. **Hazard check** — (unchanged, but damage triggers interrupt for nearby colonists)
12. **Status messages** — (unchanged)

### Production Model

Production is now based on **who is actively working where**, not role counts:

```
// Before: role-based
engineers = colonists.filter(role === 'engineer').length
powerProd = solarCount × 1.5 × (1 + engineers × 0.15)

// After: activity-based
workersAtPower = colonists actively doing ENGINEER action in power zone
powerProd = solarCount × 1.5 × (1 + workersAtPower × 0.15)
```

This means production fluctuates naturally as colonists take breaks, socialize, or respond to emergencies. The player sees resource rates dip when people rest — the colony breathes.

---

## 4. Visual Layer

### Colonist Visual States

| State | Appearance | Context |
|-------|-----------|---------|
| Walking | Dot moves along path, faint trail behind | Traveling between zones |
| Working | Bright pulse at building, role-colored glow | Drilling, engineering, repairing, unpacking |
| Resting | Dimmed dot at habitat, slow gentle pulse | Recovering energy |
| Socializing | Two dots near each other at habitat | Recovering morale |
| Injured | Red-tinted, slow movement | Heading to med bay |
| Wandering | Muted dot, drifting near habitat | Fallback idle behavior |

### Movement

- Between zones: colonists follow path graph waypoints
- Within zones: direct walk to target building/spot
- Walk speed varies by trait (Efficient +10%) and energy level (tired = slower, visible from orbit)
- CSS transitions on left/top properties with linear timing

### Existing Aesthetic (Preserved)

- CRT scanline overlay
- Dark space background with subtle noise
- "LIVE" feed indicator with pulsing red dot
- Monospace typography
- Inset shadow depth
- Color-coded building type glows

### New Visual Elements

- Zone boundary overlays (faint dashed circles)
- Zone labels (SEC-A, SEC-B, etc.)
- Path lines between zones
- Colonist trails while walking
- Visual distinction for resting/socializing/injured states
- Zoom level indicator in corner

---

## 5. Save Migration

- Bump save key to `colony-save-v3`
- **Zone ID renames**: `drillSite` → `drill`, `powerField` → `power`. Migration must update any persisted zone references.
- **Supply drops**: currently spawn at `LANDING_ZONE` (45%, 45%) with jitter. Now spawn within the `landing` zone radius instead.
- **v2 → v3 migration** runs automatically on load:
  - Add `energy: 80`, `morale: 70` to each colonist
  - Assign random trait to each colonist
  - Set `currentAction: null`, `currentZone: 'habitat'`
  - Remove `role` field
  - Recalculate building positions using new organic scatter within zones

---

## Out of Scope

- Medium & Far zoom levels (separate spec, future work)
- Worn trail traffic tracking (easy add-on later)
- Colonist info popup on tap
- Day/night cycle
- Colonist relationships/friendships
- New building types or zones
