<template>
  <div class="building-info" :class="{ below: y < 30 }" :style="{ left: Math.max(15, Math.min(85, x)) + '%', top: (y < 30 ? y + 6 : y - 6) + '%' }">
    <div class="info-header">{{ label }}</div>
    <div class="info-row">
      <span class="info-label">Status</span>
      <span :class="building.damaged ? 'status-bad' : 'status-ok'">
        {{ building.damaged ? 'DAMAGED' : 'Operational' }}
      </span>
    </div>
    <div v-if="production" class="info-row">
      <span class="info-label">Output</span>
      <span class="rate-pos">+{{ production }}/s</span>
    </div>
    <div v-if="consumption" class="info-row">
      <span class="info-label">Draw</span>
      <span class="rate-neg">-{{ consumption }}/s</span>
    </div>
    <div class="info-row">
      <span class="info-label">Workers</span>
      <span>{{ workerCount }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  type Building,
  BLUEPRINTS,
  POWER_PRODUCTION_PER_SOLAR,
  O2_PRODUCTION_PER_GENERATOR,
  POWER_CONSUMPTION_PER_BUILDING,
  useGameStore,
} from '@/stores/gameStore'

const props = defineProps<{
  building: Building
  x: number
  y: number
}>()

const game = useGameStore()

const label = computed(() => {
  const bp = BLUEPRINTS.find((b) => b.type === props.building.type)
  const index = game.buildings
    .filter((b) => b.type === props.building.type)
    .findIndex((b) => b.id === props.building.id)
  return `${bp?.label ?? props.building.type} #${index + 1}`
})

const production = computed(() => {
  if (props.building.damaged) return null
  if (props.building.type === 'solar') return POWER_PRODUCTION_PER_SOLAR.toFixed(1)
  if (props.building.type === 'o2generator') return O2_PRODUCTION_PER_GENERATOR.toFixed(1)
  return null
})

const consumption = computed(() => {
  if (props.building.damaged) return null
  return POWER_CONSUMPTION_PER_BUILDING.toFixed(1)
})

const workerCount = computed(() => {
  const zone = props.building.type === 'solar' ? 'power'
    : props.building.type === 'o2generator' ? 'lifeSup'
    : props.building.type === 'drillrig' ? 'drillSite'
    : props.building.type === 'medbay' ? 'medical'
    : null
  if (!zone) return 0
  return game.colonists.filter(
    (c) => c.health > 0 && c.currentAction?.targetZone === zone && !c.currentAction?.walkPath?.length
  ).length
})
</script>

<style scoped>
.building-info {
  position: absolute;
  transform: translate(-50%, -100%);
  z-index: 20;
  background: var(--overlay-bg);
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-secondary);
  pointer-events: none;
  min-width: 100px;
}

.building-info.below {
  transform: translate(-50%, 0);
}

.info-header {
  font-size: 10px;
  color: var(--text-primary);
  margin-bottom: 4px;
  border-bottom: 1px solid var(--accent-dim);
  padding-bottom: 3px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  line-height: 1.6;
}

.info-label {
  color: var(--text-muted);
}

.status-ok {
  color: var(--green);
}

.status-bad {
  color: var(--red);
}

.rate-pos {
  color: var(--green);
}

.rate-neg {
  color: var(--amber);
}
</style>
