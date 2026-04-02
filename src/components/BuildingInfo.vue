<template>
  <div class="building-info" :class="{ below: y < 30 }" :style="{ left: Math.max(15, Math.min(85, x)) + '%', top: (y < 30 ? y + 6 : y - 6) + '%' }">
    <div class="info-header">{{ label }}</div>
    <div class="info-row">
      <span class="info-label">Status</span>
      <span v-if="isConstructing" class="status-constructing">
        BUILDING {{ Math.round(building.constructionProgress! * 100) }}%
      </span>
      <span v-else :class="building.damaged ? 'status-bad' : 'status-ok'">
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
    <div v-if="showWorkers" class="info-row">
      <span class="info-label">Workers</span>
      <span>{{ workerCount }}</span>
    </div>
    <!-- Launch platform cargo -->
    <template v-if="building.type === 'launchplatform' && !isConstructing">
      <div class="info-row">
        <span class="info-label">Cargo</span>
        <span :class="{ 'status-ok': platformLoaded > 0 }">{{ platformLoaded }}/{{ platState?.capacity ?? 100 }}</span>
      </div>
      <div v-if="platformLoaded > 0 && platState" class="info-row">
        <span class="info-label">Contents</span>
        <span class="cargo-detail">
          <span v-if="platState.cargo.metals > 0">{{ platState.cargo.metals }}m </span>
          <span v-if="platState.cargo.ice > 0">{{ platState.cargo.ice }}i </span>
          <span v-if="platState.cargo.rareMinerals > 0">{{ platState.cargo.rareMinerals }}r</span>
        </span>
      </div>
      <div class="info-row">
        <span class="info-label">Status</span>
        <span :class="platformStatusClass">{{ platformStatus }}</span>
      </div>
    </template>
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

const isConstructing = computed(() =>
  props.building.constructionProgress !== null && props.building.constructionProgress < 1
)

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

// Buildings that have workers inside
const WORKER_BUILDINGS = new Set(['extractionrig', 'partsfactory', 'medbay', 'launchplatform', 'solar', 'o2generator'])

const showWorkers = computed(() => WORKER_BUILDINGS.has(props.building.type))

const workerCount = computed(() => {
  return game.colonists.filter(c => {
    if (c.health <= 0 || !c.currentAction || c.currentAction.walkPath?.length) return false
    if (c.currentAction.targetId) return c.currentAction.targetId === props.building.id
    return false
  }).length
})

// Launch platform specifics — keyed by building ID
const platState = computed(() => game.exportPlatforms[props.building.id])

const platformLoaded = computed(() => {
  const c = platState.value?.cargo
  if (!c) return 0
  return c.metals + c.ice + c.rareMinerals
})

const platformStatus = computed(() => {
  const s = platState.value?.status
  if (s === 'in_transit') return 'EN ROUTE'
  if (s === 'returning') return 'RETURNING'
  return 'DOCKED'
})

const platformStatusClass = computed(() => {
  const s = platState.value?.status
  if (s === 'in_transit') return 'status-constructing' // amber
  if (s === 'returning') return '' // default
  return 'status-ok' // green
})
</script>

<style scoped>
.building-info {
  position: absolute;
  transform: translate(-50%, -100%) scale(var(--marker-scale, 1));
  transform-origin: bottom center;
  z-index: 20;
  background: var(--overlay-bg);
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
  pointer-events: none;
  min-width: 100px;
}

.building-info.below {
  transform: translate(-50%, 0) scale(var(--marker-scale, 1));
  transform-origin: top center;
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
  color: var(--text-secondary);
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

.status-constructing {
  color: var(--amber);
}

.cargo-detail {
  color: var(--text-primary);
}
</style>
