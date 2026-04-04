<template>
  <InfoCard :x="x" :y="y" :show-header="false">
    <div class="info-row">
      <span class="colonist-name">{{ colonist.name }}</span>
      <span>{{ actionLabel }}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Morale</span>
      <span :class="moraleClass">{{ Math.round(colonist.morale) }}</span>
    </div>
    <div v-if="colonist.health < 100" class="info-row">
      <span class="info-label">Health</span>
      <span :class="colonist.health < 30 ? 'health-critical' : 'health-low'">{{ Math.round(colonist.health) }}%</span>
    </div>
  </InfoCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Colonist } from '@/stores/gameStore'
import { useGameStore } from '@/stores/gameStore'
import InfoCard from './InfoCard.vue'

const props = defineProps<{
  colonist: Colonist
  x: number
  y: number
}>()

const game = useGameStore()

const actionLabel = computed(() => {
  if (!props.colonist.currentAction) return 'idle'
  const action = props.colonist.currentAction
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
  if (props.colonist.morale < 20) return 'morale-critical'
  if (props.colonist.morale < 40) return 'morale-low'
  return 'morale-ok'
})
</script>

<style scoped>
.info-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  line-height: 1.6;
}

.info-label {
  color: var(--text-secondary);
}

.colonist-name {
  color: var(--text-primary);
  font-weight: 600;
}

.morale-ok { color: var(--green); }
.morale-low { color: var(--amber); }
.morale-critical { color: var(--red); }
.health-low { color: var(--amber); }
.health-critical { color: var(--red); }
</style>
