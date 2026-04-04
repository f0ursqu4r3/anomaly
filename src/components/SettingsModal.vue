<template>
  <Teleport to="body">
    <div v-if="visible" class="settings-overlay" @click.self="$emit('close')">
      <div class="settings-modal">
        <div class="settings-header">
          <span class="settings-title" @click="titleTaps++">SYSTEM CONFIG</span>
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
                <input
                  type="checkbox"
                  :checked="settings.autoSave"
                  @change="settings.toggle('autoSave')"
                />
              </label>
              <label class="setting-row">
                <span>Notifications</span>
                <input
                  type="checkbox"
                  :checked="settings.notifications"
                  @change="settings.toggle('notifications')"
                />
              </label>
              <div class="setting-row">
                <span>Reset colony</span>
                <button v-if="!confirmReset" class="reset-btn" @click="confirmReset = true">
                  RESET
                </button>
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
                <input
                  type="checkbox"
                  :checked="settings.scanlines"
                  @change="settings.toggle('scanlines')"
                />
              </label>
              <label class="setting-row">
                <span>Zone labels</span>
                <input
                  type="checkbox"
                  :checked="settings.zoneLabels"
                  @change="settings.toggle('zoneLabels')"
                />
              </label>
              <label class="setting-row">
                <span>Path lines</span>
                <input
                  type="checkbox"
                  :checked="settings.pathLines"
                  @change="settings.toggle('pathLines')"
                />
              </label>
              <label class="setting-row">
                <span>Radio chatter</span>
                <input
                  type="checkbox"
                  :checked="settings.radioChatter"
                  @change="settings.toggle('radioChatter')"
                />
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
                <select
                  :value="settings.textSize"
                  @change="
                    settings.set('textSize', ($event.target as HTMLSelectElement).value as any)
                  "
                >
                  <option value="small">Small</option>
                  <option value="normal">Normal</option>
                  <option value="large">Large</option>
                </select>
              </div>
              <label class="setting-row">
                <span>Reduce animations</span>
                <input
                  type="checkbox"
                  :checked="settings.reduceAnimations"
                  @change="settings.toggle('reduceAnimations')"
                />
              </label>
              <label class="setting-row">
                <span>High contrast</span>
                <input
                  type="checkbox"
                  :checked="settings.highContrast"
                  @change="settings.toggle('highContrast')"
                />
              </label>
            </div>
          </div>

          <!-- DEBUG (hidden until title tapped 5x) -->
          <div v-if="debugVisible" class="section">
            <div class="section-header" @click="toggleSection('debug')">
              <span>DEBUG</span>
              <span class="chevron">{{ openSections.debug ? '▾' : '▸' }}</span>
            </div>
            <div v-if="openSections.debug" class="section-content">
              <label class="setting-row">
                <span>Show FPS</span>
                <input
                  type="checkbox"
                  :checked="settings.showFps"
                  @change="settings.toggle('showFps')"
                />
              </label>
              <label class="setting-row">
                <span>Show action states</span>
                <input
                  type="checkbox"
                  :checked="settings.showActionStates"
                  @change="settings.toggle('showActionStates')"
                />
              </label>
              <div class="setting-row">
                <span>Time speed</span>
                <select
                  :value="settings.timeMultiplier"
                  @change="
                    settings.set(
                      'timeMultiplier',
                      Number(($event.target as HTMLSelectElement).value) as any,
                    )
                  "
                >
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
import { reactive, ref, computed } from 'vue'
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
const titleTaps = ref(0)
const debugVisible = computed(() => titleTaps.value >= 5)

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
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--cyan);
}

.close-btn {
  font-size: 1.25rem;
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
  font-size: 0.625rem;
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
  font-size: 0.75rem;
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
  font-size: 0.75rem;
  color: var(--text-primary);
  cursor: pointer;
}

.setting-row input[type='checkbox'] {
  accent-color: var(--cyan);
  width: 16px;
  height: 16px;
}

.setting-row select {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-xs);
  padding: 6px 10px;
  font-family: var(--font-mono);
  font-size: 16px; /* prevents iOS auto-zoom on focus */
  min-height: 36px;
}

.reset-btn {
  font-family: var(--font-mono);
  font-size: 0.625rem;
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
