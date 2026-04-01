<template>
  <div class="game-view">
    <div class="map-panel" :class="{ transitioning: isTransitioning }">
      <ColonyMap v-if="lens === 'close'" />
      <MoonMap v-else />
      <button class="lens-switch" @click="toggleLens">
        {{ lens === 'close' ? 'MEDIUM LENS' : 'CLOSE LENS' }}
      </button>
    </div>
    <div class="console-panel">
      <CommandConsole @open-settings="$emit('open-settings')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import ColonyMap from './ColonyMap.vue'
import MoonMap from './MoonMap.vue'
import CommandConsole from './CommandConsole.vue'
import { useLensView } from '@/composables/useLensView'

defineEmits<{ 'open-settings': [] }>()

const { lens, isTransitioning, toggleLens } = useLensView()
</script>

<style scoped>
.game-view {
  height: 100%;
  display: grid;
  grid-template-rows: 55fr 45fr;
}

.map-panel {
  position: relative;
  overflow: hidden;
}

.map-panel.transitioning {
  animation: lens-refocus 600ms ease-in-out;
}

@keyframes lens-refocus {
  0% { filter: brightness(1) blur(0); }
  40% { filter: brightness(0.3) blur(4px); }
  60% { filter: brightness(0.3) blur(4px); }
  100% { filter: brightness(1) blur(0); }
}

.console-panel {
  overflow: hidden;
}

.lens-switch {
  position: absolute;
  bottom: 12px;
  right: 60px;
  background: var(--bg-elevated);
  border: 1px solid var(--accent-muted);
  color: var(--cyan);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  padding: 6px 10px;
  cursor: pointer;
  z-index: 5;
  min-height: 28px;
}

.lens-switch:active {
  background: var(--bg-surface);
}

/* Landscape phones + tablets: side-by-side layout */
@media (orientation: landscape), (min-width: 768px) {
  .game-view {
    grid-template-rows: none;
    grid-template-columns: 55fr 45fr;
  }

  .map-panel {
    padding-left: var(--safe-left);
  }

  .console-panel {
    padding-right: var(--safe-right);
  }
}
</style>
