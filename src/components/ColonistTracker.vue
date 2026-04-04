<template>
  <div
    v-if="colonist"
    class="colonist-tracker"
    :style="{ left: x + '%', top: y + '%', transitionDuration: transitionMs + 'ms' }"
  >
    <div class="tracker-card">
      <div class="tracker-header">
        <span class="tracker-name">{{ colonist.name }}</span>
        <button class="tracker-close" @click="game.trackColonist(null)">&times;</button>
      </div>
      <div class="tracker-row">
        <span class="tracker-label">ACTION</span>
        <span class="tracker-val">{{ actionLabel }}</span>
      </div>
      <div class="tracker-row">
        <span class="tracker-label">MORALE</span>
        <span class="tracker-val" :class="moraleClass">{{ Math.round(colonist.morale) }}</span>
      </div>
    </div>
    <div class="tracker-pip" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const props = defineProps<{
  x: number
  y: number
  transitionMs: number
}>()

const game = useGameStore()

const colonist = computed(() => {
  if (!game.trackedColonistId) return null
  return game.colonists.find(c => c.id === game.trackedColonistId) ?? null
})

const actionLabel = computed(() => {
  if (!colonist.value?.currentAction) return 'idle'
  const action = colonist.value.currentAction
  if (action.type === 'extract') return 'extracting'
  if (action.type === 'engineer') return 'engineering'
  if (action.type === 'repair') return 'repairing'
  if (action.type === 'unpack') return 'unpacking'
  if (action.type === 'rest') return 'resting'
  if (action.type === 'seek_medical') return 'seeking medical'
  if (action.type === 'load') return 'loading cargo'
  if (action.type === 'construct') return 'constructing'
  if (action.type === 'socialize') return 'socializing'
  return action.type
})

const moraleClass = computed(() => {
  if (!colonist.value) return ''
  if (colonist.value.morale < 20) return 'morale-critical'
  if (colonist.value.morale < 40) return 'morale-low'
  return 'morale-ok'
})
</script>

<style scoped>
.colonist-tracker {
  position: absolute;
  transform: translate(-50%, -100%) translateY(-12px);
  z-index: 20;
  pointer-events: auto;
  transition-property: left, top;
  transition-timing-function: linear;
}

.tracker-card {
  background: var(--bg-elevated);
  border: 1px solid var(--cyan);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  min-width: 100px;
  box-shadow: 0 0 8px var(--cyan-glow);
}

.tracker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.tracker-name {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--cyan);
}

.tracker-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.125rem;
  cursor: pointer;
  padding: 8px;
  margin: -8px -8px -8px 0;
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.tracker-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.625rem;
}

.tracker-label {
  color: var(--text-muted);
  letter-spacing: 0.1em;
}

.tracker-val {
  color: var(--text-primary);
}

.morale-ok { color: var(--green); }
.morale-low { color: var(--amber); }
.morale-critical { color: var(--red); }

.tracker-pip {
  width: 6px;
  height: 6px;
  background: var(--cyan);
  border-radius: 50%;
  margin: 2px auto 0;
  box-shadow: 0 0 4px var(--cyan-glow);
}
</style>
