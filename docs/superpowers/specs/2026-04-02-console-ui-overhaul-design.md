# Console UI Overhaul

**Date:** 2026-04-02
**Scope:** Restructure the command console as the primary game surface. Address discoverability, information density, and cause-effect clarity issues identified in playtesting.

## Context

First external playtest revealed that new players struggle to understand what things are, what they do, and what they affect. The resource HUD is too small, shipment items lack descriptions, launching payloads gives no visible feedback, and the income/economy loop is opaque. The tab structure hides critical information behind extra taps.

**Design principle:** The game should be fully playable from the console half. The map is a visual feed — atmospheric, not interactive (beyond colonist tracking). The console is the operator's control surface.

## Console Layout Structure

The console is organized in three persistent layers:

```
┌─────────────────────────────┐
│  RESOURCE HEADER            │
├─────────────────────────────┤
│  COMMS │ SHIPMENTS │ OPS    │
├─────────────────────────────┤
│                             │
│   (active tab content)      │
│                             │
├─────────────────────────────┤
│  CONTEXT STATUS BAR         │
└─────────────────────────────┘
```

### Resource Header

Persistent strip above the tabs. Replaces the current absolute-positioned map HUD overlay. Always visible regardless of active tab.

**Displays:**
- Power: production / draw (amber)
- Air: production / draw (cyan)
- Metals: count (green)
- Ice: count (cyan)
- Rare minerals: count (purple)
- Repair kits: count

Monospace values with semantic color coding. Sized for at-a-glance readability — significantly larger than the current 0.5625rem HUD text.

### Tabs

Three tabs, down from four:
- **COMMS** — radio chatter, status messages, alerts
- **SHIPMENTS** — catalog, manifest, in-transit tracking
- **OPS** — directives + launch platform management (merged from Export + Directives)

### Context Status Bar

Bottom strip. Credits and income rate are always visible on the left. Right side changes per tab:

| Tab | Right-side context |
|---|---|
| COMMS | Crew count, colony depth |
| SHIPMENTS | Manifest weight/100kg, total cost, launch cooldown |
| OPS | Active directive count, platforms in transit |

Operator's Manual accessible via a book icon in the status bar (opens as modal).

## Shipments Tab

Top-to-bottom layout:

1. **In-transit** (conditional) — visible when shipments are en route. Shows item count, total weight, ETA countdown. Collapses away when empty.
2. **Manifest** — items queued for next launch. Each row mirrors catalog format with quantity controls (+/-). Launch button with inline cooldown indicator.
3. **Catalog** — all available items in compact row format.

### Catalog Row Format

Single-line compact rows. Each row: icon, name, abbreviated key stat, cost, weight.

```
⚡  Solar Panel      +4 pwr    600 cr   8kg
🏭  Parts Factory    +repairs  900 cr  15kg
🚀  Launch Platform  exports  1250 cr  20kg
🏥  Med Bay          heals    1000 cr  12kg
```

Tapping a row adds it to the manifest (or increments quantity if already present). The abbreviated stat provides just enough context — full details live in the Operator's Manual.

## Operations Tab

Two sections, fixed layout:

### Directives (top)

- Section header: "DIRECTIVES"
- Each directive is a compact row: name + toggle (ACTIVE / OFF)
- Full set always visible — this is a known, fixed list
- No expand/collapse needed

### Launch Platforms (below directives)

- Section header: "LAUNCH PLATFORMS" with count badge
- Each platform is an accordion row

**Collapsed state:** Status dot (colored), platform name, cargo fill (e.g. 72/100), state label (LOADING / IN TRANSIT 45s / RETURNING 120s).

**Expanded state:** Cargo breakdown (metals/ice/rare), auto-launch toggle, auto-reserve setting, force launch button. Only one platform expanded at a time.

**Visual states:**
- Loading: active, green status dot
- In transit: amber status dot, countdown
- Returning: dimmed, muted status dot, countdown

**Empty state:** Before any launch platform is built, show: "No launch platforms built. Order one from Shipments." Connects the dots for new players.

## Comms Tab

Message log stays as primary content. Key change: colonist names become interactive.

### Tappable Colonist Names

Colonist names in comms messages are styled as highlighted tappable text (terminal-aesthetic, not underlined links). Tapping a name:

1. Pans the map to that colonist
2. Attaches a tracking overlay that follows them (similar to existing BuildingInfo card)
3. Overlay shows: name, current action, morale indicator
4. Dismissed by tapping the overlay close button or tapping another colonist name

### Message Type Indicators

Light color coding on message left edge or icon:
- Status messages: default (muted)
- Warnings / resource alerts: amber
- Hazard events: red
- Social / bond chatter: cyan

No other structural changes to comms.

## Map Simplification

The map becomes a clean satellite feed with minimal chrome.

### Removed from Map
- Resource HUD overlay (moved to console header)
- Settings button

### Added to Map Edges
- Settings gear: top-right corner
- Ambient stats along edges: crew count, colony depth, game time (small, monospace, low opacity)

### Retained
- Lens toggle (colony/moon view switch)
- Building placement, supply drops, worn paths, zone rendering — unchanged

### New: Colonist Tracking Overlay
Triggered from comms tab only (not from map interaction). Small info card that follows the selected colonist showing name, action, and morale. Dismissable.

## Operator's Manual

Modal overlay accessed from the book icon in the status bar.

### Structure
- Organized by category: Buildings, Equipment, Supplies, Colony Systems, Export Operations
- Each entry: name, icon, full description, stats (cost, weight, build time, worker requirements, effects), flavor text
- Scrollable with section headers as jump points

### Contextual Access
Long-press on a shipment catalog row opens the manual directly to that item's entry. Short tap adds to manifest as normal.

### Tone
Dry corporate training manual. In-fiction document for new colony operators.

> "The Solar Panel (Model SP-4) provides approximately 4 units of continuous power generation. Recommended deployment ratio: 1 panel per 2 high-draw installations. See Section 3.2 for power management guidelines."

### Scope Note
The manual shell (modal, navigation, entry layout) is part of this spec. Writing all entry content is a separate task that can be filled in incrementally.

## Files Affected

| File | Change |
|---|---|
| `src/components/CommandConsole.vue` | Major restructure: resource header, 3-tab layout, context status bar |
| `src/components/ResourceHud.vue` | Rework as console header component instead of map overlay |
| `src/components/ShipmentPanel.vue` | Row-based catalog, manifest restructure |
| `src/components/ExportPanel.vue` | Merge into new Operations tab |
| `src/components/DirectivePanel.vue` | Merge into new Operations tab (directives section) |
| `src/components/ColonyMap.vue` | Remove HUD overlay, add edge stats + settings gear |
| `src/components/GameView.vue` | Update to 50/50 split |
| `src/components/MessageLog.vue` | Tappable colonist names, message type color coding |
| `src/components/MapColonist.vue` | Support tracking overlay triggered from console |
| `src/assets/main.css` | Updated spacing, font sizes for new layout |
| New: `src/components/OperatorsManual.vue` | Modal component for the manual |
| New: `src/components/ColonistTracker.vue` | Map overlay that follows a tracked colonist |

## Future Work (Not In Scope)

These improvements are deferred to a follow-up spec:

- Map colonist readability: labels, visual distinction, action indicators
- Building info card refresh to match new console visual language
- Font size setting audit — ensure it applies globally
- First-time onboarding: Operator's Manual auto-opens on first launch, tutorial sequence
- Colonist tap-to-track directly from the map (not just from comms)
