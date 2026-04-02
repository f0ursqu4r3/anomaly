# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # Type-check (vue-tsc --noEmit) then production build
npm run preview    # Preview production build
```

No lint or test commands are configured.

## Architecture

Moon colony idle game: Vue 3 + Pinia + TypeScript, wrapped with Capacitor for mobile.

### Tick-Driven Simulation

The game runs on a 1-second tick loop (`useGameLoop.ts` → `game.tick()`). Each tick:

1. Colonist AI: update needs, advance/complete actions, award XP on completion, check for breakdowns, select next action via utility scoring
2. Calculate power and air production/consumption
3. Extract resources at colony and outposts, process survey missions and outpost launches, accumulate credits
4. Med bay healing / health drain when resources critical (Iron Stomach trait reduces drain 30%)
5. Detect colonist deaths → apply morale events to survivors (bonded partners hit harder)
6. Process in-transit shipments → spawn supply drops on arrival
7. Radio chatter — action transitions, bond working, high/low morale
8. Update colonist bonds (co-location affinity) and idle morale drain
9. Check hazards (every ~15s, chance scales with depth) → morale impact on all colonists
10. Generate status messages (every 10 ticks)

Auto-saves every 30 ticks. Save key: `colony-save-v4` via Capacitor Preferences (localStorage fallback).

### Store Pattern

Two Pinia stores: `gameStore.ts` holds colony state, getters for derived rates, and actions for mutations. The `ColonyState` interface is the source of truth — resources, colonists, buildings, supply drops, shipments, depth, messages, directives. `moonStore.ts` holds sector and outpost state for the moon surface — scanned sectors, survey missions, active outposts, and launch queues.

### Colonist Identity System

Each colonist has a personality trait (drives AI behavior) and a skill trait (gameplay bonuses). Identity is managed across three modules:

- **`types/colonist.ts`**: `Trait` (personality), `SkillTrait` (8 skill traits: Steady Hands, Geologist, Pathfinder, Field Medic, Claustrophobic, Iron Stomach, Tinkerer, Night Owl), `Specialization`, `XPTrack`, level thresholds
- **`systems/colonistIdentity.ts`**: XP accrual (1 per completed action, 3 tracks), bond updates (co-location affinity ±1 every 60-120s, threshold 20, max 3), morale events (death/hazard/survey/isolation/idle), breakdown checks (<15 morale), efficiency multiplier calculation, specialization unlock (level 3 → Prospector/Mechanic/Medic)
- **`systems/colonistAI.ts`**: Utility-based action selection incorporating efficiency multiplier (XP + skill trait + specialization + morale + bond = additive), Night Owl energy handling, bond partner zone preference

Efficiency bonuses are additive: `1.0 + xpLevel*0.05 + skillTrait + specialization + morale + bond`. Max realistic ~30-40%.

### Economy System

Credits earned primarily through resource exports to HQ, not passive income. The colony exists to produce value for HQ.

- **`systems/economy.ts`**: HQ rate bulletin system. Base rates (metals 15cr, ice 40cr, rare minerals 100cr). Event-driven rate shifts every 10-15 min lasting 90-120s. Weighted random events: metal demand, ice shortage, rare mineral rush, supply glut, quarterly push.
- **Export platform**: Colony-built building (30 metals). Colonists `load` resources to platform (AI-scored action). 100-unit capacity. Launch → 120s transit → HQ credits at current rates → 180s return (270s if force-launched). Auto-launch toggle. Auto-reserves (parts factory + silo cost, player overridable).
- **Storage caps**: Base 50 metals / 25 ice / 10 rare minerals. Storage Silos ordered from HQ (600cr) (+100m/+50i/+25r per silo). Overflow clamped with radio warnings.
- **Pricing (10x scale)**: All credit values use 10x scale for readability. Passive stipend 2cr/sec. Shipments 600-1,750cr. Starting credits 1,000.

### Visual Layer (Separate from Simulation)

`useColonistMovement.ts` runs a parallel visual state machine for colonist positions on the map. It watches `game.lastTickAt` and updates a `Map<id, ColonistMapState>` with walking/working/idle states. Priority: unpack supply drops first, then role-based zone targeting (extractors→extraction zone, engineers→buildings, idle→habitat).

### Component Layout

`GameView` switches between two lenses: `ColonyMap` (close lens — isometric terrain with buildings/colonists/drops/HUD) and `MoonMap` (medium lens — organic terrain map of the moon surface). `CommandConsole` (45% right) switches context per lens: comms/shipments/directives on close lens, moon controls (ping, sector info, outpost management) on medium lens. `HazardAlert` and `GameOverModal` overlay from `App.vue`. Key components: `ColonyMap`, `MoonMap`, `SectorHex`.

#### Lens System

The interface supports two zoom levels, toggled from the HUD:

- **Close lens** (`ColonyMap`): The default colony view. Isometric terrain showing individual buildings, colonists, and supply drops. Full operational detail.
- **Medium lens** (`MoonMap`): Pure satellite feed of the moon surface. Hex grid under the hood, rendered as continuous organic terrain with biome-specific features (boulders, ice patches, volcanic glow, crater rings, canyon lines). Sectors discovered via blind orbital ping (cooldown-based). Colony sector shows miniature building/colonist positions. Pan/zoom with fixed-size markers. All controls in the command console, not overlaid on the map.

Far lens (multi-colony overview) is planned but not yet implemented.

### Building Construction & Placement

All building data lives in `src/config/buildings.ts` — single source of truth for labels, zones, construction times, costs, and shipment prices. `BLUEPRINTS`, `SHIPMENT_OPTIONS`, and `ZONE_FOR_BUILDING` are derived from it.

**Construction flow**: Shipment arrives → supply drop lands → colonists unpack crate → building placed as ghost/wireframe (`constructionProgress: 0`) → engineers `construct` over time → building becomes operational (`constructionProgress: null`). Construction times are per-type (20-90s). Multiple engineers speed it up (1=100%, 2=160%, 3=200%).

**Cluster placement**: New buildings anchor adjacent to existing ones in the same zone (~4.5 unit offset), forming organic settlement-like clusters. First building places near zone center. Zone radius constrains spread.

**Worn paths**: Colonist zone transitions tracked in `zonePaths` (sorted pair key → traffic count). Rendered as SVG lines between zone centers. Intensity tiers: faint (10+), light (50+), worn (150+). Decays -1 per 60 ticks.

### Map Zones

Buildings cluster organically within circular zones:

- habitat: 50,40 — colonist home base
- extraction: 50,65 — extraction rigs, storage silos
- power: 30,25 — solar panels
- lifeSup: 70,25 — O2 generators
- medical: 75,48 — med bays
- workshop: 25,70 — parts factory
- landing: 25,50 — supply drops, launch platform

### Shipment Flow

Manifest builder (max 4 items, 100kg) → launch (60s cooldown, deducts credits) → in-transit (10s normal, 3s emergency) → arrival: emergency items apply instantly, equipment/crates spawn supply drops → colonists unpack → engineers construct building (20-90s).

## Key Conventions

- Path alias: `@/*` → `./src/*`
- TypeScript strict mode, ES2020 target
- Building config centralized in `src/config/buildings.ts` (construction times, costs, zones, shipment prices)
- Other game constants at top of `gameStore.ts` (rates, thresholds) and `colonistIdentity.ts` (bond/morale/XP)
- Capacitor plugins for native features (preferences, admob, IAP, notifications)
- Retro CRT/terminal visual aesthetic (dark palette, monospace, scanlines)

## Design Context

### Users

Remote operator watching a moon colony through a satellite feed. The player is detached — sending supplies and directives, not directly controlling colonists. Context is mobile-first idle gaming: short active sessions, longer idle stretches. The interface is the player's only window into the colony.

### Brand Personality

**Gritty, tense, industrial.** The colony is a hostile, fragile outpost. Every system could fail. The UI should feel like mission control hardware — functional, purposeful, built for survival, not comfort. Closer to Alien's Nostromo than Star Trek's Enterprise.

### Aesthetic Direction

- **Visual tone:** Dark CRT terminal with colored glows. Information-dense but not cluttered. Each element earns its screen space.
- **References:** FTL / Into the Breach (clean, strategic, information-dense), Factorio / Shapez (systems-focused, efficiency aesthetic)
- **Anti-references:** Generic mobile games (bright gradients, cartoon icons, popup spam), hyper-realistic 3D (we're a satellite feed, not a viewport)
- **Theme:** Dark mode only. Deep navy/black backgrounds (#06060c → #181830). Semantic color glows: amber (power/warning), cyan (info/O2), red (danger), green (mining/positive). JetBrains Mono for data, Inter for body text. Scanline overlay for CRT texture.
- **Emotional range:** Calm control as the baseline — you're the operator, detached and competent. Tension and urgency when systems fail — hazard alerts, resource warnings, the colony demanding your attention.

### Design Principles

1. **Satellite feed, not a viewport.** Everything is mediated through the terminal. UI elements should feel like HUD overlays on a feed, not floating game UI. Glows, scanlines, and monospace text reinforce this.
2. **Information density over decoration.** Show what matters, hide what doesn't. No ornamental chrome. If an element doesn't inform a decision, it shouldn't be on screen.
3. **Color means something.** Every color maps to a system: amber = power/economy, cyan = air/info, red = danger/medical, green = mining/positive. Never use color purely for decoration.
4. **Tension through restraint.** The game feels tense because the UI is calm — when something goes wrong, the red glow and shake animations hit harder against the quiet baseline.
5. **Touch-first, glance-friendly.** 44px minimum touch targets. Key status visible at a glance. The player should be able to assess colony health in under 2 seconds.
