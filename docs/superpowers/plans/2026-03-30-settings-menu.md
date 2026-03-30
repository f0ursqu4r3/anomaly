# Settings Menu Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen settings modal with game, display, accessibility, and debug settings, triggered from the status bar.

**Architecture:** New `settingsStore.ts` Pinia store holds all settings and persists via Capacitor Preferences. `SettingsModal.vue` renders the UI. Existing components read from the settings store to conditionally render effects.

**Tech Stack:** Vue 3, Pinia, TypeScript, Capacitor Preferences

**Spec:** `docs/superpowers/specs/2026-03-30-settings-menu-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/stores/settingsStore.ts` | Pinia store: settings state, persistence, defaults |
| `src/components/SettingsModal.vue` | Full-screen modal with collapsible sections and controls |

### Modified Files
| File | Changes |
|------|---------|
| `src/components/CommandConsole.vue` | Add gear icon button to status bar |
| `src/App.vue` | Mount SettingsModal, pass visibility state |
| `src/components/ColonyMap.vue` | Read scanlines/zoneLabels/pathLines/highContrast/reduceAnimations settings |
| `src/components/MapColonist.vue` | Read showActionStates and reduceAnimations settings |
| `src/composables/useGameLoop.ts` | Read timeMultiplier and autoSave settings |
| `src/systems/radioChatter.ts` | Read radioChatter toggle |

---

## Task 1: Settings Store

**Files:**
- Create: `src/stores/settingsStore.ts`

- [ ] **Step 1: Create the settings store**

```typescript
import { defineStore } from 'pinia'
import { Preferences } from '@capacitor/preferences'

const SETTINGS_KEY = 'colony-settings-v1'

export interface Settings {
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

const DEFAULTS: Settings = {
  autoSave: true,
  notifications: true,
  scanlines: true,
  zoneLabels: true,
  pathLines: true,
  radioChatter: true,
  textSize: 'normal',
  reduceAnimations: false,
  highContrast: false,
  showFps: false,
  showActionStates: false,
  timeMultiplier: 1,
}

export const useSettingsStore = defineStore('settings', {
  state: (): Settings => ({ ...DEFAULTS }),

  actions: {
    async load() {
      try {
        const { value } = await Preferences.get({ key: SETTINGS_KEY })
        if (value) {
          const parsed = JSON.parse(value) as Partial<Settings>
          this.$patch(parsed)
          return
        }
      } catch { /* fall through */ }
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>
        this.$patch(parsed)
      }
    },

    async save() {
      const data = JSON.stringify(this.$state)
      try {
        await Preferences.set({ key: SETTINGS_KEY, value: data })
      } catch {
        localStorage.setItem(SETTINGS_KEY, data)
      }
    },

    reset() {
      this.$patch({ ...DEFAULTS })
      this.save()
    },

    toggle(key: keyof Settings) {
      const val = this[key]
      if (typeof val === 'boolean') {
        (this as any)[key] = !val
        this.save()
      }
    },

    set<K extends keyof Settings>(key: K, value: Settings[K]) {
      (this as any)[key] = value
      this.save()
    },
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/settingsStore.ts
git commit -m "feat: add settings store with persistence"
```

---

## Task 2: Settings Modal Component

**Files:**
- Create: `src/components/SettingsModal.vue`

- [ ] **Step 1: Create the modal component**

The modal uses the existing CRT/terminal aesthetic. Collapsible sections with toggles, selects, and a reset button.

```vue
<template>
  <Teleport to="body">
    <div v-if="visible" class="settings-overlay" @click.self="$emit('close')">
      <div class="settings-modal">
        <div class="settings-header">
          <span class="settings-title">SYSTEM CONFIG</span>
          <button class="close-btn" @click="$emit('close')">&times;</button>
        </div>

        <div class="settings-body">
          <!-- GAME -->
          <div class="section">
            <div class="section-header" @click="toggleSection('game')">
              <span>GAME</span>
              <span class="chevron">{{ openSections.game ? '▾' : '▸' }}</span>
            </div>
            <div v-if="openSections.game" class="section-content">
              <label class="setting-row">
                <span>Auto-save</span>
                <input type="checkbox" :checked="settings.autoSave" @change="settings.toggle('autoSave')" />
              </label>
              <label class="setting-row">
                <span>Notifications</span>
                <input type="checkbox" :checked="settings.notifications" @change="settings.toggle('notifications')" />
              </label>
              <div class="setting-row">
                <span>Reset colony</span>
                <button v-if="!confirmReset" class="reset-btn" @click="confirmReset = true">RESET</button>
                <button v-else class="reset-btn danger" @click="doReset">CONFIRM?</button>
              </div>
            </div>
          </div>

          <!-- DISPLAY -->
          <div class="section">
            <div class="section-header" @click="toggleSection('display')">
              <span>DISPLAY</span>
              <span class="chevron">{{ openSections.display ? '▾' : '▸' }}</span>
            </div>
            <div v-if="openSections.display" class="section-content">
              <label class="setting-row">
                <span>Scanlines</span>
                <input type="checkbox" :checked="settings.scanlines" @change="settings.toggle('scanlines')" />
              </label>
              <label class="setting-row">
                <span>Zone labels</span>
                <input type="checkbox" :checked="settings.zoneLabels" @change="settings.toggle('zoneLabels')" />
              </label>
              <label class="setting-row">
                <span>Path lines</span>
                <input type="checkbox" :checked="settings.pathLines" @change="settings.toggle('pathLines')" />
              </label>
              <label class="setting-row">
                <span>Radio chatter</span>
                <input type="checkbox" :checked="settings.radioChatter" @change="settings.toggle('radioChatter')" />
              </label>
            </div>
          </div>

          <!-- ACCESSIBILITY -->
          <div class="section">
            <div class="section-header" @click="toggleSection('accessibility')">
              <span>ACCESSIBILITY</span>
              <span class="chevron">{{ openSections.accessibility ? '▾' : '▸' }}</span>
            </div>
            <div v-if="openSections.accessibility" class="section-content">
              <div class="setting-row">
                <span>Text size</span>
                <select :value="settings.textSize" @change="settings.set('textSize', ($event.target as HTMLSelectElement).value as any)">
                  <option value="small">Small</option>
                  <option value="normal">Normal</option>
                  <option value="large">Large</option>
                </select>
              </div>
              <label class="setting-row">
                <span>Reduce animations</span>
                <input type="checkbox" :checked="settings.reduceAnimations" @change="settings.toggle('reduceAnimations')" />
              </label>
              <label class="setting-row">
                <span>High contrast</span>
                <input type="checkbox" :checked="settings.highContrast" @change="settings.toggle('highContrast')" />
              </label>
            </div>
          </div>

          <!-- DEBUG -->
          <div class="section">
            <div class="section-header" @click="toggleSection('debug')">
              <span>DEBUG</span>
              <span class="chevron">{{ openSections.debug ? '▾' : '▸' }}</span>
            </div>
            <div v-if="openSections.debug" class="section-content">
              <label class="setting-row">
                <span>Show FPS</span>
                <input type="checkbox" :checked="settings.showFps" @change="settings.toggle('showFps')" />
              </label>
              <label class="setting-row">
                <span>Show action states</span>
                <input type="checkbox" :checked="settings.showActionStates" @change="settings.toggle('showActionStates')" />
              </label>
              <div class="setting-row">
                <span>Time speed</span>
                <select :value="settings.timeMultiplier" @change="settings.set('timeMultiplier', Number(($event.target as HTMLSelectElement).value) as any)">
                  <option :value="1">1x</option>
                  <option :value="2">2x</option>
                  <option :value="5">5x</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { useGameStore } from '@/stores/gameStore'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const settings = useSettingsStore()
const game = useGameStore()

const openSections = reactive({
  game: true,
  display: true,
  accessibility: true,
  debug: false,
})

const confirmReset = ref(false)

function toggleSection(key: keyof typeof openSections) {
  openSections[key] = !openSections[key]
}

function doReset() {
  game.resetGame()
  confirmReset.value = false
  emit('close')
}
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.settings-modal {
  width: 100%;
  max-width: 400px;
  max-height: 85vh;
  background: var(--bg-primary);
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--accent-dim);
}

.settings-title {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--cyan);
}

.close-btn {
  font-size: 20px;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-primary);
}

.settings-body {
  overflow-y: auto;
  padding: 8px 0;
}

.section {
  border-bottom: 1px solid var(--accent-dim);
}

.section:last-child {
  border-bottom: none;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.section-header:hover {
  color: var(--text-primary);
}

.chevron {
  font-size: 12px;
  color: var(--text-muted);
}

.section-content {
  padding: 0 16px 10px;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
}

.setting-row input[type="checkbox"] {
  accent-color: var(--cyan);
  width: 16px;
  height: 16px;
}

.setting-row select {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-xs);
  padding: 4px 8px;
  font-family: var(--font-mono);
  font-size: 11px;
}

.reset-btn {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 4px 12px;
  border: 1px solid var(--text-muted);
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.reset-btn:hover {
  border-color: var(--text-primary);
  color: var(--text-primary);
}

.reset-btn.danger {
  border-color: var(--red);
  color: var(--red);
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SettingsModal.vue
git commit -m "feat: add settings modal component"
```

---

## Task 3: Wire Gear Icon and Mount Modal

**Files:**
- Modify: `src/components/CommandConsole.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Add gear icon to CommandConsole status bar**

In `CommandConsole.vue`, after the MODE status-item, add:

```html
<button class="settings-btn" @click="$emit('openSettings')">
  <SvgIcon name="settings" size="xs" />
</button>
```

Add `openSettings` to emits:
```typescript
defineEmits<{ openSettings: [] }>()
```

Add CSS:
```css
.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
}

.settings-btn:hover {
  color: var(--text-primary);
}
```

Note: If `SvgIcon` doesn't have a `settings` icon, use the text `⚙` instead:
```html
<button class="settings-btn" @click="$emit('openSettings')">⚙</button>
```

- [ ] **Step 2: Check if SvgIcon has a settings icon**

Read `src/components/SvgIcon.vue` to see what icons are available. If no settings/gear icon exists, use the `⚙` character fallback.

- [ ] **Step 3: Mount SettingsModal in App.vue**

Update `App.vue`:

```vue
<template>
  <div id="app">
    <ShiftReport
      :visible="showShiftReport"
      :duration-ms="reportData.durationMs"
      :delta-credits="reportData.deltaCredits"
      :delta-metals="reportData.deltaMetals"
      :delta-ice="reportData.deltaIce"
      :delta-depth="reportData.deltaDepth"
      @dismiss="dismissReport"
    />
    <GameOverModal />
    <SettingsModal :visible="showSettings" @close="showSettings = false" />
    <GameView @open-settings="showSettings = true" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useGameLoop } from '@/composables/useGameLoop'
import { useSettingsStore } from '@/stores/settingsStore'
import GameOverModal from '@/components/GameOverModal.vue'
import GameView from '@/components/GameView.vue'
import ShiftReport from '@/components/ShiftReport.vue'
import SettingsModal from '@/components/SettingsModal.vue'

const settings = useSettingsStore()
settings.load()

const showSettings = ref(false)
const { showShiftReport, dismissReport, reportData } = useGameLoop()
</script>
```

- [ ] **Step 4: Propagate openSettings event through GameView**

`GameView.vue` contains `CommandConsole`. The `openSettings` event needs to bubble up from `CommandConsole` → `GameView` → `App.vue`.

In `GameView.vue`, read the file first, then add:
- `defineEmits<{ 'open-settings': [] }>()`
- On the `<CommandConsole>` component: `@open-settings="$emit('open-settings')"`

- [ ] **Step 5: Commit**

```bash
git add src/components/CommandConsole.vue src/App.vue src/components/GameView.vue
git commit -m "feat: wire settings gear icon and mount modal"
```

---

## Task 4: Wire Settings into Components

**Files:**
- Modify: `src/components/ColonyMap.vue`
- Modify: `src/components/MapColonist.vue`
- Modify: `src/composables/useGameLoop.ts`
- Modify: `src/systems/radioChatter.ts`

- [ ] **Step 1: Wire display settings into ColonyMap.vue**

Add import:
```typescript
import { useSettingsStore } from '@/stores/settingsStore'
const settings = useSettingsStore()
```

Conditionally render scanlines, zone labels, and path lines:

```html
<div v-if="settings.scanlines" class="scanlines" />
```

For zone labels:
```html
<div v-if="settings.zoneLabels" v-for="zone in zones" ...>
```

For path lines — wrap the `<line>` elements:
```html
<template v-if="settings.pathLines">
  <line v-for="(edge, i) in pathEdges" ... />
</template>
```

For high contrast — add a class to the zone overlay:
```html
<svg class="zone-overlay" :class="{ 'high-contrast': settings.highContrast }" ...>
```

Add CSS:
```css
.zone-overlay.high-contrast line { opacity: 0.3; }
.zone-overlay.high-contrast circle { opacity: 0.35; stroke-width: 0.4; }
```

For reduce animations — add a class to the map container:
```html
<div class="colony-map" :class="{ 'reduce-animations': settings.reduceAnimations }" ...>
```

Add CSS:
```css
.reduce-animations .colonist-dot,
.reduce-animations .colonist-trail,
.reduce-animations .feed-dot {
  animation: none !important;
}
```

For FPS counter — add to the template (outside `.map-content`, near the feed indicator):
```html
<div v-if="settings.showFps" class="fps-counter">{{ fps }} FPS</div>
```

Add script:
```typescript
import { ref, onMounted, onUnmounted } from 'vue'

const fps = ref(0)
let fpsFrames = 0
let fpsLastTime = performance.now()
let fpsRaf = 0

function updateFps() {
  fpsFrames++
  const now = performance.now()
  if (now - fpsLastTime >= 1000) {
    fps.value = fpsFrames
    fpsFrames = 0
    fpsLastTime = now
  }
  fpsRaf = requestAnimationFrame(updateFps)
}

onMounted(() => { fpsRaf = requestAnimationFrame(updateFps) })
onUnmounted(() => cancelAnimationFrame(fpsRaf))
```

Add CSS:
```css
.fps-counter {
  position: absolute;
  bottom: 8px;
  left: 8px;
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  z-index: 9;
  pointer-events: none;
}
```

- [ ] **Step 2: Wire debug settings into MapColonist.vue**

Add import:
```typescript
import { useSettingsStore } from '@/stores/settingsStore'
const settings = useSettingsStore()
```

Add action label to template (after the colonist-trail div):
```html
<div v-if="settings.showActionStates && colonist.health > 0" class="action-label">
  {{ colonist.currentAction?.type || 'idle' }}
</div>
```

Add CSS:
```css
.action-label {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-mono);
  font-size: 6px;
  color: var(--text-muted);
  white-space: nowrap;
  pointer-events: none;
}
```

- [ ] **Step 3: Wire time multiplier and auto-save into useGameLoop.ts**

Add import:
```typescript
import { useSettingsStore } from '@/stores/settingsStore'
```

In `startLoop()`, replace the fixed `TICK_MS` interval:
```typescript
function startLoop() {
  if (tickInterval) return
  const settings = useSettingsStore()
  tickInterval = setInterval(() => {
    game.tick(TICK_MS)
    tickCount++
    if (settings.autoSave && tickCount % SAVE_EVERY_N_TICKS === 0) {
      game.save()
    }
  }, TICK_MS / settings.timeMultiplier)
}
```

Note: When `timeMultiplier` changes, the loop needs to be restarted. Add a watcher in the `onMounted` hook:

```typescript
import { watch } from 'vue'

// Inside onMounted, after startLoop:
watch(() => useSettingsStore().timeMultiplier, () => {
  if (tickInterval) {
    stopLoop()
    startLoop()
  }
})
```

- [ ] **Step 4: Wire radio chatter toggle**

In `src/systems/radioChatter.ts`, update the `generateChatter` function signature to accept a `chatterEnabled` parameter:

```typescript
export function generateChatter(
  colonists: Colonist[],
  allColonists: Colonist[],
  buildingLabel: (id: string) => string,
  emit: MessageEmitter,
  now: number,
  chatterEnabled: boolean = true,
) {
  if (!chatterEnabled) return
  // ... rest unchanged
}
```

In `gameStore.ts` where `generateChatter` is called, pass the setting:

```typescript
import { useSettingsStore } from '@/stores/settingsStore'

// In the tick function where generateChatter is called:
const settings = useSettingsStore()
generateChatter(
  alive,
  this.colonists,
  (id) => { ... },
  (text, severity) => this.pushMessage(text, severity),
  this.totalPlaytimeMs,
  settings.radioChatter,
)
```

- [ ] **Step 5: Wire text size setting**

In `App.vue`, add a watcher that sets a CSS class on `document.documentElement`:

```typescript
import { watch } from 'vue'

watch(() => settings.textSize, (size) => {
  document.documentElement.dataset.textSize = size
}, { immediate: true })
```

In `src/assets/main.css`, add:

```css
[data-text-size="small"] { font-size: 13px; }
[data-text-size="normal"] { font-size: 16px; }
[data-text-size="large"] { font-size: 19px; }
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ColonyMap.vue src/components/MapColonist.vue src/composables/useGameLoop.ts src/systems/radioChatter.ts src/stores/gameStore.ts src/App.vue src/assets/main.css
git commit -m "feat: wire all settings into components"
```

---

## Task 5: Build Verification & Polish

**Files:**
- Various

- [ ] **Step 1: TypeScript check**

Run: `bun run build`

Fix any type errors.

- [ ] **Step 2: Verify settings modal opens/closes**

Start dev server (`bun run dev`), click gear icon, verify modal appears with all 4 sections.

- [ ] **Step 3: Verify toggles work**

Toggle scanlines off → scanlines disappear from map. Toggle zone labels off → labels disappear. Toggle path lines off → lines disappear. Toggle radio chatter off → no more colonist messages in comms.

- [ ] **Step 4: Verify debug settings**

Enable "Show action states" → small labels appear above colonist dots. Change time multiplier to 2x → game speeds up.

- [ ] **Step 5: Verify persistence**

Change some settings, refresh page, verify settings persist.

- [ ] **Step 6: Verify reset colony**

Click Reset → "CONFIRM?" appears → click again → game resets. Settings should NOT reset.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: settings menu polish and build fixes"
```
