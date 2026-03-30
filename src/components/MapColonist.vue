<template>
  <div
    class="map-colonist"
    :class="[stateClass, visualState, { dead: colonist.health <= 0 }]"
    :style="{
      left: x + '%',
      top: y + '%',
      transitionDuration: transitionMs + 'ms',
    }"
  >
    <div class="colonist-dot" />
    <div v-if="visualState === 'walking' && colonist.health > 0" class="colonist-trail" />
    <div v-if="settings.showActionStates && colonist.health > 0" class="action-label">
      {{ colonist.currentAction?.type || 'idle' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Colonist } from '@/stores/gameStore'
import type { VisualState } from '@/composables/useColonistMovement'
import { useSettingsStore } from '@/stores/settingsStore'

const settings = useSettingsStore()

const props = defineProps<{
  colonist: Colonist
  x: number
  y: number
  visualState: VisualState
  transitionMs: number
}>()

const stateClass = computed(() => {
  const action = props.colonist.currentAction?.type
  if (action === 'drill') return 'action-drill'
  if (action === 'engineer') return 'action-engineer'
  if (action === 'repair') return 'action-repair'
  if (action === 'unpack') return 'action-unpack'
  if (action === 'seek_medical') return 'action-medical'
  return 'action-idle'
})
</script>

<style scoped>
.map-colonist {
  position: absolute;
  transform: translate(-50%, -50%) scale(var(--marker-scale, 1));
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 3;
  transition-property: left, top;
  transition-timing-function: linear;
}

.colonist-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: all 0.2s;
}

.action-drill .colonist-dot {
  background: var(--green);
  box-shadow: 0 0 6px var(--green-glow), 0 0 12px rgba(52, 211, 153, 0.1);
}

.action-engineer .colonist-dot {
  background: var(--amber);
  box-shadow: 0 0 6px var(--amber-glow), 0 0 12px rgba(245, 158, 11, 0.1);
}

.action-repair .colonist-dot {
  background: var(--amber);
  box-shadow: 0 0 6px var(--amber-glow), 0 0 12px rgba(245, 158, 11, 0.1);
}

.action-unpack .colonist-dot {
  background: var(--cyan);
  box-shadow: 0 0 6px var(--cyan-glow), 0 0 12px rgba(126, 207, 255, 0.1);
}

.action-medical .colonist-dot {
  background: var(--red);
  box-shadow: 0 0 6px var(--red-glow), 0 0 12px rgba(233, 69, 96, 0.1);
}

.action-idle .colonist-dot {
  background: var(--text-muted);
  box-shadow: 0 0 4px var(--accent-dim);
}

.resting .colonist-dot {
  opacity: 0.4;
  animation: rest-pulse 3s ease-in-out infinite;
}

.socializing .colonist-dot {
  opacity: 0.7;
}

.injured .colonist-dot {
  background: var(--red) !important;
  opacity: 0.6;
}

@keyframes rest-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.5; }
}

.walking .colonist-dot {
  animation: dot-pulse 0.8s ease-in-out infinite;
}

.dead .colonist-dot {
  opacity: 0.15;
  box-shadow: none;
  animation: none;
  width: 5px;
  height: 5px;
}

/* Motion trail */
.colonist-trail {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  opacity: 0.15;
  animation: trail-fade 1.2s ease-out infinite;
}

.action-drill .colonist-trail {
  background: var(--green);
}

.action-engineer .colonist-trail,
.action-repair .colonist-trail {
  background: var(--amber);
}

.action-unpack .colonist-trail {
  background: var(--cyan);
}

.action-idle .colonist-trail {
  background: var(--text-muted);
}

@keyframes dot-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.4);
    opacity: 0.7;
  }
}

@keyframes trail-fade {
  0% {
    transform: scale(1);
    opacity: 0.2;
  }
  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}

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
</style>
