# Settings Menu

**Date:** 2026-03-30
**Status:** Draft

## Overview

Full-screen modal settings menu triggered by a gear icon in the status bar. Settings stored separately from game save data via a dedicated Pinia store.

## Trigger

Gear icon in the `CommandConsole` status bar, far right after the MODE badge. Clicking opens the settings modal overlay.

## Presentation

Full-screen modal overlay, same pattern as `GameOverModal` and `ShiftReport`. Dark background with CRT/terminal aesthetic. Monospace typography. Close via X button or tapping outside.

## Settings

Organized as collapsible section groups:

### GAME
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Auto-save | toggle | on | Auto-save every 30 ticks |
| Notifications | toggle | on | Capacitor push notifications for offline events |
| Reset colony | button | — | Inline two-step confirmation (tap → "Are you sure?" → confirm), then calls `gameStore.resetGame()` |

### DISPLAY
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Scanlines | toggle | on | CRT scanline overlay on map |
| Zone labels | toggle | on | SEC-A, SEC-B, etc. text labels |
| Path lines | toggle | on | Lines between zones |
| Radio chatter | toggle | on | Prevents `radioChatter.ts` from generating new messages. Existing messages remain in log. |

### ACCESSIBILITY
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Text size | select | normal | small / normal / large — scales base font size |
| Reduce animations | toggle | off | Disables pulse, glow, trail, and blink effects |
| High contrast | toggle | off | Boosts opacity on HUD elements, zone circles, path lines |

### DEBUG
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Show FPS | toggle | off | FPS counter in corner |
| Show action states | toggle | off | Adds a small text label above each colonist dot showing current action type. New UI element in MapColonist.vue. |
| Time multiplier | select | 1x | 1x / 2x / 5x — multiplies tick speed. Dev tool, ships to all users but hidden in collapsed DEBUG section. |

Debug section is collapsed by default. Tap section header to expand.

## Architecture

### New Files
```
src/stores/settingsStore.ts   — Pinia store for all settings, persistence via Preferences
src/components/SettingsModal.vue — Modal component with section groups and controls
```

### Modified Files
```
src/components/CommandConsole.vue  — Add gear icon to status bar
src/App.vue                        — Mount SettingsModal
src/components/ColonyMap.vue       — Read display settings (scanlines, zone labels, paths)
src/components/MapColonist.vue     — Read reduce-animations, show-action-states
src/composables/useGameLoop.ts     — Read time multiplier, auto-save toggle
src/systems/radioChatter.ts        — Read radio chatter toggle
```

### Settings Store

```typescript
interface Settings {
  // Game
  autoSave: boolean
  notifications: boolean
  // Display
  scanlines: boolean
  zoneLabels: boolean
  pathLines: boolean
  radioChatter: boolean
  // Accessibility
  textSize: 'small' | 'normal' | 'large'
  reduceAnimations: boolean
  highContrast: boolean
  // Debug
  showFps: boolean
  showActionStates: boolean
  timeMultiplier: 1 | 2 | 5
}
```

Persisted to `colony-settings-v1` via Capacitor Preferences (localStorage fallback). Loaded on app start. Reactive — components read directly from store, changes apply immediately.

Separate from `gameStore` — settings are user preferences, not colony state. Not affected by reset colony.

## Mobile Layout

At narrow widths (< 500px), settings sections stack vertically with full-width toggles. Each section header is tappable to collapse/expand. Modal takes full screen with slight padding.

## Out of Scope

- Sound/volume controls (no audio system yet)
- Key bindings / control remapping
- Cloud sync for settings
- Per-colonist name customization
