# Deep Station — Asteroid Colony Idle Game

An underground asteroid colony management sim built with Vue 3 + Capacitor. Command a fledgling colony deep beneath a barren moon's surface — manage colonists, construct buildings, drill for resources, and survive escalating hazards as you push deeper.

## Stack

- **Vue 3** + Composition API + TypeScript
- **Pinia** — single-store game state with tick-driven logic
- **Vite** — build tooling and HMR
- **Capacitor 8** — native iOS/Android wrapper
- **@capacitor/preferences** — local persistence (localStorage fallback)
- **@capacitor-community/admob** — ad monetization
- **@capacitor-community/in-app-purchases** — IAP integration

## Project Structure

```text
src/
├── stores/
│   └── gameStore.ts              # Core state, tick logic, economy, hazards, save/load
├── composables/
│   ├── useGameLoop.ts            # 1s tick interval, auto-save, visibility/offline handling
│   └── useColonistMovement.ts    # Colonist pathfinding, work zones, supply drop AI
├── components/
│   ├── GameView.vue              # Root game layout
│   ├── ColonyMap.vue             # Isometric terrain, buildings, colonists, craters
│   ├── CommandConsole.vue        # Tabbed console (Comms / Shipments / Directives)
│   ├── ResourceHud.vue           # Real-time resource bars with rate indicators
│   ├── ShipmentPanel.vue         # Manifest builder and item catalog
│   ├── DirectivePanel.vue        # Directive selection with stat breakdowns
│   ├── MessageLog.vue            # Console message feed (info/warning/critical/event)
│   ├── HazardAlert.vue           # Emergency alert popups
│   └── GameOverModal.vue         # End-screen with colony stats
├── services/
│   ├── adService.ts              # AdMob integration
│   ├── iapService.ts             # In-app purchases
│   └── notificationService.ts    # Local notifications for offline events
├── utils/
│   └── format.ts                 # fmtNumber, fmtDepth, fmtDuration
├── assets/
│   └── main.css                  # Global styles, CRT/terminal aesthetic
└── App.vue                       # Root — mounts game loop
```

## Game Systems

### Resources

| Resource    | Max | Source                         | Drain                  |
| ----------- | --- | ------------------------------ | ---------------------- |
| **Air**     | 125 | O2 generators (2.0/s each)     | 0.5/s per colonist     |
| **Power**   | 125 | Solar panels (1.5/s each)      | 0.3/s per building     |
| **Metals**  | —   | Drilling (2.0 per depth unit)  | Spent on shipments     |
| **Ice**     | —   | 15% chance/tick while drilling | Worth 2.0 credits each |
| **Credits** | —   | 1.0/tick base + mining bonuses | Shipment purchases     |

### Colonists

Each colonist has a role (driller, engineer, or idle) and a health bar (0–100). Roles are auto-assigned based on the active directive.

- **Drillers** — contribute 0.15 drill speed each
- **Engineers** — 15% production bonus per engineer (stacks), can repair buildings
- Health drains at 2.0/s when air or power is depleted; heals at 0.5/s per active med bay
- All colonists dead = game over

Starting crew: Riko (driller), Sable (engineer), Juno (idle).

### Buildings

| Building     | Zone               | Effect                           |
| ------------ | ------------------ | -------------------------------- |
| Solar Panel  | Power Field SEC-B  | +1.5 power/s                     |
| O2 Generator | Life Support SEC-C | +2.0 air/s (requires power)      |
| Drill Rig    | Drill Site SEC-D   | +0.08 drill speed                |
| Med Bay      | Medical SEC-E      | Heals colonists (requires power) |

Buildings can be damaged by hazards and repaired with kits. Up to 6 per zone.

### Drilling & Depth

Drill speed = `(drillers × 0.15 + rigs × 0.08) × engineer_bonus × directive_multiplier`

Hazard chance scales with depth: `0.03 + depth × 0.00002`, checked every 15 seconds.

### Hazards

| Hazard        | Chance | Effect                    |
| ------------- | ------ | ------------------------- |
| Meteor Strike | 40%    | Damages a random building |
| Power Surge   | 30%    | Drains 30% max power      |
| Gas Pocket    | 30%    | Vents 25% max air         |

Reduced by directive hazard resistance. 15-second cooldown between checks.

### Directives

| Directive     | Drill | Hazard Resist | Production | Crew Split          |
| ------------- | ----- | ------------- | ---------- | ------------------- |
| **Mining**    | 1.3x  | 0%            | 1.0x       | 70% drill / 20% eng |
| **Safety**    | 0.7x  | 40%           | 1.2x       | 20% drill / 60% eng |
| **Balanced**  | 1.0x  | 15%           | 1.0x       | 40% drill / 40% eng |
| **Emergency** | 0.5x  | 10%           | 1.5x       | 10% drill / 80% eng |

Emergency overrides trigger automatically when air or power drops below 20%.

### Shipment System

Order supplies from the surface via a manifest builder:

- **Cooldown:** 60s between launches
- **Capacity:** 4 items max, 100kg total
- **Transit:** 10s normal, 3s for emergency items
- **Delivery:** Colonists auto-path to unpack supply drops on the map

| Item            | Cost | Weight | Effect                     |
| --------------- | ---- | ------ | -------------------------- |
| Supply Crate    | $20  | 15kg   | +15 metals, +5 ice         |
| Solar Panel     | $35  | 30kg   | New building               |
| O2 Generator    | $40  | 35kg   | New building               |
| Drill Rig       | $50  | 40kg   | New building               |
| Med Bay         | $60  | 45kg   | New building               |
| New Colonist    | $75  | 20kg   | Adds crew member           |
| Repair Kit      | $15  | 10kg   | Fixes one damaged building |
| Emergency O2    | $25  | 10kg   | +30 air (fast delivery)    |
| Emergency Power | $25  | 10kg   | +30 power (fast delivery)  |

## Game Loop

Driven by `useGameLoop.ts`, mounted once in `App.vue`:

- **Tick rate:** 1000ms
- **Auto-save:** every 30 ticks (30s)
- **Offline catch-up:** on visibility change, replays up to 5 minutes of ticks
- **Save format:** `colony-save-v2` via Capacitor Preferences (localStorage fallback)

## Development

```bash
npm install
npm run dev          # Vite dev server
npm run build        # Production build
npm run type-check   # vue-tsc
```

### Capacitor (mobile)

```bash
npx cap sync
npx cap open ios     # Xcode
npx cap open android # Android Studio
```
