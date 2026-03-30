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

Asteroid colony idle game: Vue 3 + Pinia + TypeScript, wrapped with Capacitor for mobile.

### Tick-Driven Simulation

The game runs on a 1-second tick loop (`useGameLoop.ts` → `game.tick()`). Each tick:

1. Reassign colonist roles based on active directive (with emergency overrides at <20% air/power)
2. Calculate power and air production/consumption
3. Advance depth, mine metals, roll for ice, accumulate credits
4. Med bay healing / health drain when resources critical
5. Process in-transit shipments → spawn supply drops on arrival
6. Check hazards (every ~15s, chance scales with depth)
7. Generate status messages (every 10 ticks)

Auto-saves every 30 ticks. Save key: `colony-save-v2` via Capacitor Preferences (localStorage fallback).

### Store Pattern

Single Pinia store (`gameStore.ts`, ~800 lines) holds all game state, getters for derived rates, and actions for mutations. The `ColonyState` interface is the source of truth — resources, colonists, buildings, supply drops, shipments, depth, messages, directives.

### Visual Layer (Separate from Simulation)

`useColonistMovement.ts` runs a parallel visual state machine for colonist positions on the map. It watches `game.lastTickAt` and updates a `Map<id, ColonistMapState>` with walking/working/idle states. Priority: unpack supply drops first, then role-based zone targeting (drillers→drill site, engineers→buildings, idle→habitat).

### Component Layout

`GameView` splits into two panels: `ColonyMap` (55% left, isometric terrain with buildings/colonists/drops/HUD) and `CommandConsole` (45% right, tabbed: comms/shipments/directives). `HazardAlert` and `GameOverModal` overlay from `App.vue`.

### Map Zones

Buildings snap to named zones with slot offsets (up to 6 per zone):
- habitat: 50,45 — colonist home base
- drillSite: 50,78 — drill rigs
- powerField: 28,28 — solar panels
- lifeSup: 72,28 — O2 generators
- medical: 72,58 — med bays

### Shipment Flow

Manifest builder (max 4 items, 100kg) → launch (60s cooldown, deducts credits) → in-transit (10s normal, 3s emergency) → arrival: emergency items apply instantly, equipment/crates spawn supply drops → colonists auto-path to unpack collaboratively.

## Key Conventions

- Path alias: `@/*` → `./src/*`
- TypeScript strict mode, ES2020 target
- All game constants are defined at top of `gameStore.ts` (rates, costs, thresholds)
- Capacitor plugins for native features (preferences, admob, IAP, notifications)
- Retro CRT/terminal visual aesthetic (dark palette, monospace, scanlines)
