# Deep Station — Idle Game

Vue 3 + Capacitor mobile idle game scaffold.

## Stack

- **Vue 3** + Composition API
- **Pinia** — game state store
- **Capacitor** — native iOS/Android wrapper
- **@capacitor/preferences** — local persistence

## Project Structure

```
src/
├── stores/
│   └── gameStore.ts        # Core game state, tick logic, prestige, save/load
├── composables/
│   └── useGameLoop.ts      # setInterval tick, auto-save, visibility handling
├── components/
│   └── AnomalyModal.vue    # Anomaly event popup
├── utils/
│   └── format.ts           # fmtNumber, fmtDepth, fmtDuration
└── App.vue                 # Root — mounts game loop
```

## Setup

```bash
npm create vue@latest deep-station
cd deep-station
npm install pinia @capacitor/core @capacitor/cli @capacitor/preferences
npx cap init
npm install
```

Add to `main.ts`:
```ts
import { createPinia } from 'pinia'
app.use(createPinia())
```

## Game Loop

The loop lives in `useGameLoop.ts` and is mounted once in `App.vue`.
- Ticks every 1000ms
- Auto-saves every 30 ticks
- Handles `visibilitychange` for offline catch-up

## Adding Content

**New upgrade:** Add to `INITIAL_UPGRADES` array in `gameStore.ts`
**New anomaly:** Add to `ANOMALY_POOL` array — set `depth` as the trigger depth
**New crew role:** Add to `CrewRole` type and update `calcDrillSpeed / calcRefineRate / calcResearchRate`

## Prestige

- Unlocks at 1000m depth (`PRESTIGE_DEPTH_THRESHOLD`)
- Crew levels survive
- Grants permanent drill multiplier + offline cap increase + starting ore
- All upgrades and resources reset

## Next Steps (not yet built)

- [ ] Main game view (`GameView.vue`) — depth gauge, resource display, tap button
- [ ] Upgrades panel
- [ ] Crew management panel  
- [ ] AdMob integration (`@capacitor-community/admob`)
- [ ] IAP integration (`@capacitor-community/in-app-purchases`)
- [ ] Push notifications for offline earnings
- [ ] Prestige confirmation modal
