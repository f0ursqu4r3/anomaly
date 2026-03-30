# P0 Drop 2 — Parts Factory & Auto-Relaunch

Passive repair kit generation and automatic shipment repeat. Completes the idle survivability milestone.

## 1. Parts Factory

### Building Definition

New building type `partsfactory` added to the `BuildingType` union and `BLUEPRINTS` array.

| Property | Value |
|---|---|
| Type | `partsfactory` |
| Label | "Parts Factory" |
| Description | "Produces repair kits from metals" |
| Cost | 15 metals, 0 ice |
| Power draw | 0.3/s (standard `POWER_CONSUMPTION_PER_BUILDING`) |
| Zone | New `workshop` zone on the map |

### Production

The factory is passive — no colonist assignment needed. Production is a global timer shared across all factories.

| Property | Value |
|---|---|
| Base interval | 45 seconds per kit |
| Scaling | Interval = 45000ms / (number of undamaged factories) |
| Metal cost | 2 metals per kit |
| Requirements | At least 1 undamaged factory, power > 0, metals >= 2 |

**Tick logic:** Track `lastPartsProducedAt: number` in `ColonyState`. Each tick, count undamaged factories. If count > 0, compute effective interval (45000 / count). If `totalPlaytimeMs - lastPartsProducedAt >= effectiveInterval` and power > 0 and metals >= 2: decrement metals by 2, increment `repairKits`, update `lastPartsProducedAt`, push status message.

Use `totalPlaytimeMs` (not `Date.now()`) so production pauses when the game is paused and works correctly with offline simulation.

### Map Placement

Add a `workshop` zone to `mapLayout.ts` at approximately (25, 70) with radius 8. Add `partsfactory: 'workshop'` to the `ZONE_FOR_BUILDING` mapping. The zone label "WORKSHOP" appears on the map like other zones.

### Shipment Option

Add Parts Factory to `SHIPMENT_OPTIONS` so players can order it:

| Property | Value |
|---|---|
| Type | `equipment` |
| Building type | `partsfactory` |
| Label | "Parts Factory" |
| Description | "Produces repair kits" |
| Cost | 40 credits |
| Weight | 30kg |

### SVG Icon

Add a `partsfactory` icon to the `SvgIcon` component. Simple gear/cog design to distinguish from the wrench (repair) icon.

### Offline Engine

Add factory production to `offlineEngine.ts`. In each simulated tick: count undamaged factories, check interval, consume metals, produce kits. Same logic as the main tick.

## 2. Auto-Relaunch

### State

Add `autoRelaunch: boolean` to `ColonyState`, default `false`.

### Behavior

When `autoRelaunch` is true, after each tick's shipment processing:
- Check if cooldown has expired (`totalPlaytimeMs >= shipmentCooldownUntil`)
- Check if `lastManifest` is non-empty (store the last launched manifest — see below)
- Check if credits >= total cost of last manifest
- If all true: auto-launch the last manifest, push message "Auto-relaunching shipment..."
- If credits insufficient: push warning "Auto-relaunch skipped — insufficient credits" and disable `autoRelaunch`

### Last Manifest Tracking

Add `lastManifest: ShipmentOption[]` to `ColonyState` (default `[]`). In `launchShipment()`, before clearing the manifest, save a copy to `lastManifest`. The auto-relaunch uses `lastManifest` to know what to send.

### UI

Add a toggle in `ShipmentPanel.vue` below the launch button:
- Checkbox/toggle labeled "Repeat"
- Only visible after the player has launched at least one shipment (`lastManifest.length > 0`)
- Toggles `game.autoRelaunch`
- Visual indicator when active (e.g., highlight or icon)

### Offline Engine

Add auto-relaunch to offline simulation. Same logic: after processing shipments in each offline tick, check if auto-relaunch conditions are met and fire if so.

## State Changes Summary

New fields in `ColonyState`:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `lastPartsProducedAt` | `number` | `0` | Factory production timer (totalPlaytimeMs) |
| `autoRelaunch` | `boolean` | `false` | Auto-relaunch toggle |
| `lastManifest` | `ShipmentOption[]` | `[]` | Copy of last launched manifest |

New constants:

| Constant | Value | Purpose |
|---|---|---|
| `PARTS_FACTORY_INTERVAL_MS` | `45000` | Base interval for kit production |
| `PARTS_FACTORY_METAL_COST` | `2` | Metals consumed per kit |

Modified types:

| Type | Change |
|---|---|
| `BuildingType` | Add `'partsfactory'` to union |
