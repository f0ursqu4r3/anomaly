<template>
  <InfoCard :title="colonist.name" :x="x" :y="y">
    <div class="info-row">
      <span class="info-label">Action</span>
      <span>{{ actionLabel }}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Mood</span>
      <span :class="moodClass">{{ moodLabel }}</span>
    </div>
    <div class="stat-bars">
      <div v-if="colonist.health < 100" class="stat-bar">
        <span class="bar-label">HP</span>
        <div class="bar-track">
          <div class="bar-fill bar-health" :style="{ width: colonist.health + '%' }" />
        </div>
      </div>
      <div class="stat-bar">
        <span class="bar-label">EN</span>
        <div class="bar-track">
          <div class="bar-fill bar-energy" :style="{ width: colonist.energy + '%' }" />
        </div>
      </div>
      <div class="stat-bar">
        <span class="bar-label">MR</span>
        <div class="bar-track">
          <div class="bar-fill bar-morale" :style="{ width: colonist.morale + '%' }" />
        </div>
      </div>
      <div class="stat-bar">
        <span class="bar-label">FC</span>
        <div class="bar-track">
          <div class="bar-fill bar-focus" :style="{ width: colonist.focus + '%' }" />
        </div>
      </div>
      <div class="stat-bar">
        <span class="bar-label">HN</span>
        <div class="bar-track">
          <div class="bar-fill bar-hunger" :style="{ width: colonist.hunger + '%' }" />
        </div>
      </div>
    </div>
  </InfoCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Colonist } from '@/stores/gameStore'
import InfoCard from './InfoCard.vue'

const props = defineProps<{
  colonist: Colonist
  x: number
  y: number
}>()

function getMoodLabel(c: Colonist): string {
  if (c.hunger < 15) return 'Starving'
  if (c.energy < 10) return 'Exhausted'
  if (c.morale < 10) return 'Breaking'
  if (c.hunger < 40) return 'Hungry'
  if (c.focus < 10) return 'Burned Out'
  if (c.energy < 30) return 'Tired'
  if (c.morale < 25) return 'Stressed'
  if (c.focus < 25) return 'Unfocused'
  if (c.focus > 75 && c.energy > 60) return 'Focused'
  if (c.morale > 75) return 'Content'
  return 'Okay'
}

const moodLabel = computed(() => getMoodLabel(props.colonist))

const moodClass = computed(() => {
  const label = moodLabel.value
  if (['Starving', 'Exhausted', 'Breaking'].includes(label)) return 'mood-critical'
  if (['Hungry', 'Burned Out', 'Tired', 'Stressed', 'Unfocused'].includes(label)) return 'mood-warning'
  if (['Focused', 'Content'].includes(label)) return 'mood-good'
  return 'mood-neutral'
})

const actionLabel = computed(() => {
  if (!props.colonist.currentAction) return 'idle'
  const action = props.colonist.currentAction
  if (action.type === 'extract') return 'extracting'
  if (action.type === 'engineer') return 'engineering'
  if (action.type === 'repair') return 'repairing'
  if (action.type === 'unpack') return 'unpacking'
  if (action.type === 'rest') return 'resting'
  if (action.type === 'eat') return 'eating'
  if (action.type === 'seek_medical') return 'seeking medical'
  if (action.type === 'load') return 'loading cargo'
  if (action.type === 'construct') return 'constructing'
  if (action.type === 'socialize') return 'socializing'
  return action.type
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

.mood-good {
  color: var(--green);
}
.mood-neutral {
  color: var(--text-secondary);
}
.mood-warning {
  color: var(--amber);
}
.mood-critical {
  color: var(--red);
}

.stat-bars {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 4px;
}

.stat-bar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bar-label {
  color: var(--text-secondary);
  font-size: 0.7em;
  font-family: 'JetBrains Mono', monospace;
  width: 18px;
  flex-shrink: 0;
}

.bar-track {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.bar-health {
  background: var(--red);
}

.bar-energy {
  background: var(--green);
}

.bar-morale {
  background: var(--green);
}

.bar-focus {
  background: var(--cyan);
}

.bar-hunger {
  background: var(--amber);
}
</style>
