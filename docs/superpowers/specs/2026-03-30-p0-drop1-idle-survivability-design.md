# P0 Drop 1 — Immediate Relief

Tuning, UI fixes, and visibility improvements that make the game playable before adding new idle mechanics (Drop 2: Parts Factory, standing orders, repair targeting).

## 1. Pause Button

### Behavior

- Toggle that freezes the tick loop completely — no resource changes, no hazards, no colonist movement, no timers
- Closing the app while paused: stays paused on return. No offline simulation runs
- Auto-saves on pause so progress is never lost
- Paused state persisted in `ColonyState` and saved to `colony-save-v2`

### UI

- Pause/play button in the HUD area (top region of ColonyMap)
- "PAUSED" text overlay on the colony map when active — subtle but unmissable
- Shipment cooldown timer, hazard timers, and all tick-driven counters freeze visually

### Implementation

- Add `isPaused: boolean` to `ColonyState`
- `useGameLoop.ts`: skip `game.tick()` when paused
- `useColonistMovement.ts`: freeze visual state machine when paused
- Save triggers on pause toggle (not just every 30 ticks)
- Pause button component in HUD, wired to store action

## 2. Hazard Rate Tuning

### Current Values (problematic)

| Constant | Current | Problem |
|---|---|---|
| `HAZARD_CHECK_INTERVAL_MS` | 15,000ms | Too frequent |
| `HAZARD_BASE_CHANCE` | 0.03 (3%) | Too high at surface |
| `HAZARD_DEPTH_SCALE` | 0.00002 | Scales too aggressively |
| Min gap between hazards | none | Allows back-to-back streaks |

At depth 500: 4% chance every 15s → ~4 min average, with no floor on consecutive hits.

### Proposed Values

| Constant | Proposed | Rationale |
|---|---|---|
| `HAZARD_CHECK_INTERVAL_MS` | 20,000ms | Slower base tick |
| `HAZARD_BASE_CHANCE` | 0.02 (2%) | Gentler start |
| `HAZARD_DEPTH_SCALE` | 0.00001 | Halved scaling |
| `HAZARD_MIN_GAP_MS` | 45,000ms | Streak protection (new) |

At depth 500: 2.5% chance every 20s → ~10 min average, minimum 45s between any two hazards.

### Implementation

- Update constants in `gameStore.ts`
- Add `lastHazardAt: number` to `ColonyState` (epoch ms, default 0)
- In hazard check: skip if `now - lastHazardAt < HAZARD_MIN_GAP_MS`
- Record `lastHazardAt` when a hazard fires
- Directive modifiers unchanged — Safety still reduces chance by 40%

## 3. Resource Drain Visibility

### HUD Breakdown

Add a generation/drain breakdown line under the existing air and power rate display:

- Air: `+4.0 gen / -1.3 use` (smaller, muted text below the net rate)
- Power: `+3.0 gen / -1.8 use` (same treatment)

Add repair kit count as a new HUD item:

- Shows current repair kit stock count
- Only appears once the player has received at least one repair kit (avoids early-game clutter)

### Getters

Add to `gameStore.ts`:

- `airProduction`: total air generated per tick (O2 generators × rate × directive modifier)
- `airConsumption`: total air consumed per tick (colonist count × consumption rate)
- `powerProduction`: total power generated per tick (solar panels × rate × directive modifier)
- `powerConsumption`: total power consumed per tick (building count × power draw)
- `repairKitCount`: current repair kit inventory

These may already be partially calculated inline in the tick function — extract them as named getters.

### Tap Building Info

Tapping a building on the colony map shows an info overlay with:

- Building name and type (e.g., "Solar Panel #2")
- Status: Operational / Damaged
- Production rate (e.g., "+1.5 power/s" or "+2.0 air/s")
- Power consumption (e.g., "-0.3 power/s")
- Assigned workers (count and names if colonist identity exists)

### Implementation

- `ResourceHud.vue`: add breakdown line and repair kit display
- `gameStore.ts`: add/extract production and consumption getters
- Add `repairKits: number` to `ColonyState` (initial 0). Repair kits from shipments go into inventory instead of auto-fixing. Colonists consume one from inventory when they repair a damaged building (existing repair behavior, but now gated by stock > 0). If stock is 0 and a building is damaged, it stays damaged until a kit arrives.
- New component or extension of `MapBuilding.vue` for tap-to-inspect overlay
- Tap handler on buildings in `ColonyMap.vue` — toggle info panel for tapped building
- Tap elsewhere or tap again to dismiss

## 4. Visual Indicator Clarity

### Building Damage — Improved

Replace the current red pulsing dot with a wrench badge:

- Small wrench icon (🔧 or SVG) in a red square badge, positioned at top-right corner of the building
- Keep the red border glow as a secondary signal
- Remove the small red dot — the wrench badge replaces it

The wrench reads as "mechanical problem" and can't be confused with a person being hurt.

### Colonist Injury — New

Add a health pip below injured colonists on the map:

- Small horizontal bar (roughly colonist-width) positioned just below the colonist sprite
- Only renders when colonist health is below 70% (avoids noise for minor scrapes)
- Color: orange (#ff9f43) — distinct from building red (#ff6b6b)
- Bar fill represents health percentage
- Fades out when health recovers above threshold

### Implementation

- `MapBuilding.vue`: replace red dot with wrench badge element, keep red border glow
- `MapColonist.vue`: add conditional health pip below colonist element
- Health threshold constant: `COLONIST_INJURY_VISIBLE_THRESHOLD = 0.7`
- Health pip only renders when `colonist.health < threshold`

## State Changes Summary

New fields in `ColonyState`:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `isPaused` | `boolean` | `false` | Pause toggle |
| `lastHazardAt` | `number` | `0` | Streak protection timestamp |
| `repairKits` | `number` | `0` | Repair kit inventory |

New constants in `gameStore.ts`:

| Constant | Value | Purpose |
|---|---|---|
| `HAZARD_MIN_GAP_MS` | `45000` | Minimum time between hazards |
| `COLONIST_INJURY_VISIBLE_THRESHOLD` | `0.7` | Health % below which pip shows |

Modified constants:

| Constant | Old | New |
|---|---|---|
| `HAZARD_CHECK_INTERVAL_MS` | `15000` | `20000` |
| `HAZARD_BASE_CHANCE` | `0.03` | `0.02` |
| `HAZARD_DEPTH_SCALE` | `0.00002` | `0.00001` |
