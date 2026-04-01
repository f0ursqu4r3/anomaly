# Survey & Extract Core Loop

## Overview

Redesign of the core game loop from "drill deeper into an asteroid" to "survey and extract resources across a moon's surface." The player is an orbital operator on a satellite, overseeing a corporate mining colony on a remote, fictional moon. The new loop is: Scan → Survey → Extract → Transport → Expand.

This replaces depth-as-progression with territorial expansion visible from the satellite feed.

## World & Premise

- Setting: a remote, uncharted moon in a distant system
- Corporation-funded mining colony
- Player is the orbital operator — observes through satellite feed, sends supplies and directives
- The moon has varied terrain: rocky plains, ice flats, volcanic ridges, craters, canyons
- Hostile environment: no breathable atmosphere, extreme temperatures, unstable geology

### Terminology Changes

| Old | New |
|-----|-----|
| Asteroid | Moon |
| Drill deeper | Survey & Extract |
| Depth (global progression) | Territory surveyed + outposts established |
| Drill site zone | Extraction zone (colony) / outpost sites (medium map) |
| Drill rig | Extraction rig (repurposed) |

### What Stays Unchanged

- Colony buildings (solar, O2 generator, med bay, parts factory)
- Shipment system (supplies from offworld)
- Directives (mining/safety/balanced/emergency)
- Colonist AI, traits, energy/morale/health
- CRT terminal / satellite feed aesthetic

## The Two Lenses

The satellite has physical lens hardware. Switching is an explicit action with a brief "refocusing" transition (static burst or lens adjustment animation). The game ticks during transitions.

### Close Lens (existing, minor changes)

- Colony detail view — buildings, colonists, supply drops
- Where you manage infrastructure: build, repair, assign directives
- The current drill zone becomes a local extraction zone for the colony's founding deposit (baseline income)
- Colonists who are away (survey/outpost) are absent from this view
- HUD shows colony resources

### Medium Lens (new)

- Wider view of terrain surrounding the colony
- Colony appears as a compact cluster at center
- Terrain sectors visible with distinct color/texture per type (false-color satellite imaging)
- Unexplored sectors have fog/static overlay — terrain type visible but not deposits
- Orbital scan highlights sectors with "possible mineral signatures"
- Survey teams visible as moving markers between colony and sectors
- Established outposts appear as operational icons at their sector
- HUD shows survey/outpost overview
- This is where strategic decisions happen: where to scan, where to send teams, which outposts to push

### Far Lens (deferred)

Not in this scope. Reserved for multi-region expansion (P4).

## Survey & Exploration Pipeline

### Step 1: Orbital Scan

- Player taps an unexplored sector on medium lens to initiate scan
- Free but takes time (30-60s per sector)
- Results reveal deposit type and rough quality: "Moderate metal signatures", "Rich ice deposits", "Faint rare mineral traces"
- Some sectors come back empty
- Can only scan sectors adjacent to explored territory (fog clears outward from colony)

### Step 2: Survey Team

- To confirm a deposit, player sends a survey team (2-3 colonists)
- Colonists leave the colony — gone from close lens, visible on medium lens traveling
- Travel time based on distance from colony
- Risk: distance + terrain type determine chance of incident
- Incident severity ranges from minor (injury, delayed return) to severe (colonist lost)
- Survey takes time on-site (60-120s), then team returns with confirmed data
- Confirmed deposit shows: exact yield, estimated duration, extraction difficulty
- Key tension: every survey pulls colonists away from base, weakening colony operations

### Step 3: Establish Outpost

- Player builds an outpost at a confirmed deposit (costs metals + credits)
- Colonists are assigned to the outpost — they relocate from colony
- Outpost begins extracting resources
- Each outpost needs minimum crew and may need its own power/life support depending on distance

## Outpost Operations

### Outpost Lifecycle

- Starts at surface extraction — safe, moderate yields
- Player can push deeper: more investment, more risk, richer resources
- Depth is per-outpost, measured in extraction levels (Level 1, 2, 3...) not meters
- Each level requires equipment (shipped or fabricated) and time to establish
- Higher levels increase yield and hazard frequency at that outpost

### Outpost Properties

- **Deposit type**: metals, ice, rare minerals
- **Deposit quality**: poor / moderate / rich (determines total yield before depletion)
- **Extraction level**: how deep the operation goes
- **Crew assigned**: colonists stationed there
- **Stockpile**: extracted materials waiting to be launched
- **Status**: active, damaged, depleted

### Depletion

- Deposits are finite — they run out
- Richer deposits last longer, but everything depletes eventually
- Forces the player to keep surveying and expanding
- Depleted outpost can be abandoned (crew returns) or kept as a waypoint (reduces travel risk to farther sectors)

### Launch Platform & Resource Transport

Each outpost has a launch platform for sending materials back to colony:

- Extracted materials accumulate at the outpost as stockpile
- When ready, crew loads the platform and fires payload back to colony
- Payload lands at colony's landing zone as a supply drop (reuses existing unpack mechanic)
- Loading takes crew time — colonists stop extracting while loading
- Launch visible on medium lens (payload arcing back to colony)
- Transit time based on distance

**Player decisions:**
- Launch frequently with small payloads (keeps colony fed, but crew spends time loading vs extracting)
- Wait for full payloads (efficient, but hazard could destroy stockpile)

**Outpost crew splits time between:**
1. Extracting resources
2. Loading launch platform
3. Repairing damage

More crew = parallel operations. Skeleton crew = bottlenecked.

## Biomes & Terrain

The moon surface is divided into sectors, each with a terrain type. Terrain is procedurally assigned at game start (seeded) — each playthrough has a different map. Colony always starts on Rocky Plains.

| Terrain | Visual | Deposits | Survey Risk |
|---------|--------|----------|-------------|
| Rocky Plains | Grey, flat, scattered boulders | Common metals | Low |
| Ice Flats | White/cyan, smooth | Ice, some metals | Low-Medium |
| Volcanic Ridge | Dark red/orange, jagged | Rare minerals, metals | High |
| Craters | Deep shadows, uneven | Rich metals | Medium |
| Canyons | Narrow, layered walls | Mixed deposits | Medium-High |

Visual differentiation uses false-color imaging overlays on the medium lens — distinct at a glance from the satellite feed.

## Hazards (Design Direction)

Specific hazard types to be revisited in a separate design pass. The design principles for this scope:

- **Environmental hazards**: frequent, terrain-dependent, mitigatable with proper infrastructure (windbreaks, sealed airlocks, insulated power lines). If prepared, they're a non-event. If not, they degrade operations.
- **Catastrophic hazards**: rare, high impact, can't be fully prevented but damage can be reduced.
- **Overall frequency**: much lower than current. Colony should be able to idle safely when properly equipped.
- **Hazards should feel like weather and environment**, not random punishment. High winds, sandstorms, temperature shifts — things you prepare for.
- Biome-specific hazards trigger at outposts in matching terrain. Colony hazards are a baseline set for the colony's Rocky Plains location.

## Impact on Existing Systems

| System | Change |
|--------|--------|
| Game state | Add: sectors, outposts, survey missions, moon terrain map. Rename asteroid → moon. |
| Colonist model | Add: location (colony vs outpost vs survey). Colonists can be "away" |
| Buildings | Drill rig → extraction rig. New: launch platform (outpost). Colony drill zone → local extraction zone |
| Resources | Same types (metals, ice, credits). Rare minerals kept simple or deferred |
| Tick loop | Add: survey progress, outpost production, transport transit, outpost hazards |
| Visual layer | New medium lens view. Colony map mostly unchanged. Away colonists hidden |
| Command console | New tab or panel for survey/outpost management |
| Offline engine | Must simulate outpost production, survey completion, transport arrivals |
| Shipment system | Unchanged — supplies from offworld |
| Directives | Functional as-is, may need rethinking later |

## Out of Scope

- Far lens (zoom level 3)
- Colonist identity (traits/XP/relationships — separate P1 feature)
- Economy & trading (separate P1 feature)
- Research & tech tree (separate P1 feature)
- Detailed hazard redesign (separate design pass)
- Rare minerals as a distinct new resource type
- Specific moon name/lore

## Documentation Updates

The following docs need updating as part of implementation:
- `CLAUDE.md` — update architecture, terminology (asteroid → moon), zone descriptions, tick loop description
- `docs/IDEAS.md` — reframe P1 section to reflect new core loop, update P2-P5 in context of survey/extract model
