# Economy & Trading — Design Spec

## Overview

Rework the colony economy so credits are earned primarily through resource exports to HQ, not passive income. Introduce an export launch platform, HQ rate bulletins, storage capacity limits, and rebalanced pricing. The operator's job is to keep the colony productive and profitable for HQ.

## Framing

The colony exists to produce value for HQ. The player is a remote operator managing the supply chain:
- Colony extracts resources → colonists load the export platform → launch to HQ → HQ credits the operator's account
- Operator spends credits ordering supplies from HQ → shipments arrive at colony
- Early game: small stipend keeps you alive while bootstrapping
- Late game: credits come almost entirely from resource exports

The player doesn't control HQ pricing. Rates shift based on HQ demand events — the operator can only react by timing exports.

## 1. Price Rebalance (10x Scale)

All credit values scaled 10x for readability. Bigger numbers feel more substantial on a mission control display and leave room for granular HQ rates without decimals.

### Passive Income

- **BASE_CREDITS_PER_TICK**: 1.0 → 2.0 cr/sec (was effectively 1.0, now 2.0 at 10x scale = same real purchasing power reduction since costs went up ~20x)
- Starting credits: 50 → 1,000

### Shipment Costs (10x)

| Item | Old Cost | New Cost |
|---|---|---|
| Supply Crate | 30 | 600 |
| Solar Panel | 40 | 800 |
| O2 Generator | 50 | 1,000 |
| Extraction Rig | 65 | 1,300 |
| Med Bay | 80 | 1,500 |
| Parts Factory | 40 | 800 |
| New Colonist | 90 | 1,750 |
| Repair Kit | 15 | 250 |
| Emergency O2 | 20 | 350 |
| Emergency Power | 20 | 350 |

### Other Credit Values (10x)

- `CREDITS_PER_METAL_MINED`: 0.1 → 1.0
- `CREDITS_PER_ICE_FOUND`: 2.0 → 20.0
- `OUTPOST_ESTABLISH_COST_CREDITS`: 50 → 500
- `totalCreditsEarned` starting value: 50 → 1,000

## 2. Export Platform

### Building

- **New building type**: `launchplatform`
- **Zone**: `landing` (shares zone with incoming supply drops)
- **Limit**: One per colony (research could unlock a second later)
- **Cost**: 30 metals (colony-built by engineers, not ordered from HQ)
- **Not included in starting buildings** — player must accumulate metals and have engineers build it

### Loading

- **New action type**: `load` — colonists haul resources from stockpile to the platform
- AI utility scoring treats loading as a work action, targeting the landing zone
- Loading rate: ~2 units per trip (colonist walks to stockpile area, picks up, walks to platform)
- Loading speed scales with number of colonists hauling
- Loading only happens when platform is docked and not full

### Auto-Reserve

Colonists auto-calculate a reserve threshold per resource type:
- **Metals reserve**: Parts factory consumption rate * 5 cycles (= 10 metals if 1 factory) + cost of cheapest affordable building
- **Ice reserve**: 0 (ice has no local consumption currently)
- **Rare minerals reserve**: 0

Player can override reserves manually per resource type via the export panel. Colonists won't load below the reserve threshold.

### Capacity

- **Starting capacity**: 100 units total (shared across resource types)
- Research upgrades unlock larger platforms (200, 500) — deferred to Research & Tech Tree spec

### Launch Cycle

1. Player hits "Launch" (or auto-launch triggers when full)
2. Platform departs — no more loading/launching until return
3. **Transit to HQ**: 120 seconds
4. **HQ credits account** at rates active *when payload arrives* (not when launched)
5. **Return trip**: 180 seconds (empty platform)
6. Platform docks — loading can resume

**Force-launch**: Available anytime cargo > 0, even if not full.
- Penalty: return trip takes 50% longer (270s instead of 180s)
- Creates urgency tradeoff: "I need credits now but my platform will be gone longer"

**Auto-launch**: Toggle — automatically launches when platform reaches capacity. Uses normal launch (not force-launch).

### Messages

- Loading started: "Colonists loading export platform. {loaded}/{capacity} units."
- Launch: "Payload en route to HQ — {metals} metals, {ice} ice. Estimated {estimate}cr at current rates."
- Arrival: "HQ confirms receipt. {actual}cr credited to account."
- Return: "Export platform has docked. Ready for loading."
- Force-launch: "Emergency export — platform launching at {loaded}/{capacity} capacity. Extended return time."

## 3. HQ Rate Bulletins

### Base Rates

| Resource | Base Rate |
|---|---|
| Metals | 15 cr/unit |
| Ice | 40 cr/unit |
| Rare Minerals | 100 cr/unit |

### Rate Events

Mostly stable. Events fire every 10-15 minutes (randomized interval). Each event lasts 90-120 seconds.

| Event | Effect | Weight | Radio Message |
|---|---|---|---|
| Metal demand | Metals 2x (30cr) | 25% | "HQ: Metal reserves low. Premium rates authorized." |
| Ice shortage | Ice 2x (80cr) | 25% | "HQ: Coolant shortage reported. Ice at premium." |
| Rare mineral rush | Rare minerals 2.5x (250cr) | 15% | "HQ: Research division requesting rare minerals. Top rates." |
| Supply glut | Random resource 0.5x | 15% | "HQ: {resource} surplus on station. Rates adjusted down." |
| Quarterly push | All resources 1.5x | 10% | "HQ: Quarterly push. All export rates boosted." |
| Rate normalization | Reset to base | 10% | "HQ: Market stabilized. Standard rates in effect." |

### Display

Current rates shown on the command console. Simple text line: "HQ RATES: Metals 15 | Ice 40 | Rare 100" with active rate events highlighted (color glow on affected resource).

### Offline Handling

Rate events don't fire during offline simulation. Offline payload deliveries use base rates. Avoids the player feeling like they missed spikes while away.

## 4. Storage Silos

### Resource Caps

Introduce maximum storage capacity per resource type. Without silos, the colony has limited space.

**Base capacity (no silos)**:
- Metals: 50
- Ice: 25
- Rare Minerals: 10

**Per Storage Silo built**:
- +100 metals capacity
- +50 ice capacity
- +25 rare minerals capacity

### Building

- **Colony-built**: Engineers construct locally from metals (not HQ-ordered)
- **Cost**: 20 metals
- **Zone**: Extraction zone (near resources)
- **Auto-build**: When any resource is >80% of capacity and metals are available, engineers auto-construct a silo. Radio message: "Engineers constructing additional storage."
- **Player can also direct construction** from the build menu (same as other buildings)

### Overflow

When a resource hits cap, extraction continues but excess is lost. Radio warning: "{name}: Storage full — we're losing metals out here." Fires once when cap is first hit, then every 60s while overflowing.

### Interaction with Export Platform

Storage caps create natural export pressure:
- Small storage → must export frequently with partial loads
- More silos → can stockpile and time exports around rate bulletins
- Player decision: spend metals on a silo (more storage) or export them now (immediate credits)

## 5. Systems Affected

### New Files
- `src/systems/economy.ts` — HQ rate bulletin logic: base rates, event generation, current rate calculation, rate event timer

### Modified Files
- `src/stores/gameStore.ts` — Price constant changes (10x), export platform state (loaded cargo, docked/in-transit, auto-launch toggle, reserve overrides), storage cap state, `launchplatform` building type, `load` action handling in tick, overflow checks, silo auto-build
- `src/types/colonist.ts` — Add `load` to `ActionType`
- `src/systems/colonistAI.ts` — Add `load` action scoring (load platform when docked and cargo available above reserve), duration for load action
- `src/systems/radioChatter.ts` — Loading, launch, arrival, overflow, rate bulletin messages
- `src/stores/offlineEngine.ts` — Offline export simulation at base rates, updated credit constants
- `src/stores/moonStore.ts` — Updated outpost establishment cost
- `src/components/CommandConsole.vue` — Export panel (platform status, loaded cargo, reserves, launch/auto-launch controls, HQ rates display)
- `src/systems/mapLayout.ts` — Add launch platform to landing zone building types
- `src/components/ShipmentPanel.vue` — Updated prices

### Data Model Additions

```typescript
// In ColonyState
exportPlatform: {
  built: boolean
  status: 'docked' | 'loading' | 'in_transit' | 'returning'
  cargo: { metals: number; ice: number; rareMinerals: number }
  capacity: number  // starts at 100
  launchTime: number | null
  estimatedCredits: number | null
  autoLaunch: boolean
  forceLaunched: boolean
  reserves: { metals: number | null; ice: number | null; rareMinerals: number | null }
  // null = auto-calculated, number = player override
}

storageCaps: {
  metals: number  // base 50 + 100 per silo
  ice: number     // base 25 + 50 per silo
  rareMinerals: number  // base 10 + 25 per silo
}

// In economy.ts
interface RateEvent {
  type: string
  multipliers: { metals: number; ice: number; rareMinerals: number }
  message: string
  expiresAt: number
}
```

### Save Migration

- Backfill `exportPlatform` with default state (not built, docked, empty cargo)
- Backfill `storageCaps` calculated from existing silo count (0 at migration)
- Scale existing credit values by 10x: `credits *= 10`, `totalCreditsEarned *= 10`
- Update shipment costs in any saved manifest/lastManifest
