<template>
  <div
    class="map-building"
    :class="[typeClass, { damaged: building.damaged, constructing: isConstructing, 'just-completed': justCompleted, 'platform-away': platformAway }]"
    :style="{ left: building.x + '%', top: building.y + '%', transform: `translate(-50%, -50%) rotate(${building.rotation || 0}deg)` }"
    @click.stop="emit('select', building)"
  >
    <div class="building-shadow" />
    <div class="building-footprint">
      <!-- Solar: 3x2 panel grid -->
      <svg v-if="building.type === 'solar'" class="fp-svg" viewBox="0 0 28 20">
        <rect x="1" y="1" width="8" height="8" rx="0.5" fill="currentColor" fill-opacity="0.5" stroke="currentColor" stroke-opacity="0.7" stroke-width="0.5" />
        <rect x="10" y="1" width="8" height="8" rx="0.5" fill="currentColor" fill-opacity="0.5" stroke="currentColor" stroke-opacity="0.7" stroke-width="0.5" />
        <rect x="19" y="1" width="8" height="8" rx="0.5" fill="currentColor" fill-opacity="0.5" stroke="currentColor" stroke-opacity="0.7" stroke-width="0.5" />
        <rect x="1" y="11" width="8" height="8" rx="0.5" fill="currentColor" fill-opacity="0.5" stroke="currentColor" stroke-opacity="0.7" stroke-width="0.5" />
        <rect x="10" y="11" width="8" height="8" rx="0.5" fill="currentColor" fill-opacity="0.5" stroke="currentColor" stroke-opacity="0.7" stroke-width="0.5" />
        <rect x="19" y="11" width="8" height="8" rx="0.5" fill="currentColor" fill-opacity="0.5" stroke="currentColor" stroke-opacity="0.7" stroke-width="0.5" />
      </svg>
      <!-- O2 Generator: dome with inner ring -->
      <svg v-else-if="building.type === 'o2generator'" class="fp-svg fp-circle" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="10" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-opacity="0.6" stroke-width="1" />
        <circle cx="11" cy="11" r="5" fill="none" stroke="currentColor" stroke-opacity="0.3" stroke-width="0.5" />
      </svg>
      <!-- Extraction Rig: rect with arm -->
      <svg v-else-if="building.type === 'extractionrig'" class="fp-svg" viewBox="0 0 32 18">
        <rect x="1" y="1" width="24" height="16" rx="1.5" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-opacity="0.6" stroke-width="1" />
        <rect x="25" y="5" width="6" height="2" rx="0.5" fill="currentColor" fill-opacity="0.5" />
      </svg>
      <!-- Med Bay: dome with cross -->
      <svg v-else-if="building.type === 'medbay'" class="fp-svg fp-circle" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="9" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-opacity="0.5" stroke-width="1" />
        <path d="M10 5v10M5 10h10" stroke="currentColor" stroke-opacity="0.6" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <!-- Storage Silo: small rect -->
      <svg v-else-if="building.type === 'storageSilo'" class="fp-svg" viewBox="0 0 16 12">
        <rect x="1" y="1" width="14" height="10" rx="1" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-opacity="0.5" stroke-width="0.8" />
        <line x1="1" y1="5" x2="15" y2="5" stroke="currentColor" stroke-opacity="0.2" stroke-width="0.5" />
      </svg>
      <!-- Launch Platform: square with H (dashed when vehicle is away) -->
      <svg v-else-if="building.type === 'launchplatform'" class="fp-svg" viewBox="0 0 26 26">
        <rect x="1" y="1" width="24" height="24" rx="2" fill="currentColor" :fill-opacity="platformAway ? 0.02 : 0.06" stroke="currentColor" :stroke-opacity="platformAway ? 0.25 : 0.5" stroke-width="1.2" :stroke-dasharray="platformAway ? '2,2' : 'none'" />
        <rect x="5" y="5" width="16" height="16" rx="1" fill="none" stroke="currentColor" :stroke-opacity="platformAway ? 0.12 : 0.25" stroke-width="0.5" />
        <text v-if="!platformAway" x="13" y="17" text-anchor="middle" fill="currentColor" fill-opacity="0.35" font-family="var(--font-mono)" font-size="10" font-weight="700">H</text>
      </svg>
      <!-- Parts Factory: rectangle -->
      <svg v-else-if="building.type === 'partsfactory'" class="fp-svg" viewBox="0 0 24 16">
        <rect x="1" y="1" width="22" height="14" rx="1.5" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-opacity="0.6" stroke-width="1" />
        <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-opacity="0.25" stroke-width="0.5" />
        <circle cx="16" cy="8" r="2" fill="none" stroke="currentColor" stroke-opacity="0.25" stroke-width="0.5" />
      </svg>
      <!-- Fallback: simple rect -->
      <svg v-else class="fp-svg" viewBox="0 0 20 20">
        <rect x="1" y="1" width="18" height="18" rx="2" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-opacity="0.5" stroke-width="1" />
      </svg>
    </div>
    <!-- Alert marker (damage/warnings only) -->
    <div v-if="alertType" class="alert-marker" :class="alertType" />
    <!-- Zoom-dependent label -->
    <div v-if="showLabel" class="building-label" :style="{ transform: `translateX(-50%) scale(var(--marker-scale, 1))` }">{{ shortLabel }}</div>
    <div v-if="building.damaged" class="dmg-badge">
      <SvgIcon name="repair" size="xs" />
    </div>
    <div v-if="isConstructing" class="construction-bar">
      <div class="construction-fill" :style="{ width: (building.constructionProgress! * 100) + '%' }" />
    </div>
    <div v-if="workerCount > 0" class="worker-pips">
      <span v-for="n in workerCount" :key="n" class="worker-pip" :class="typeClass" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Building } from '@/stores/gameStore'
import { useGameStore } from '@/stores/gameStore'
import { ZONE_FOR_BUILDING } from '@/systems/mapLayout'
import SvgIcon from './SvgIcon.vue'

const props = defineProps<{ building: Building }>()
const emit = defineEmits<{ select: [building: Building] }>()
const game = useGameStore()

const typeClass = computed(() => `type-${props.building.type}`)

const isConstructing = computed(() =>
  props.building.constructionProgress !== null && props.building.constructionProgress < 1
)

// Flash when construction completes
const justCompleted = ref(false)
watch(isConstructing, (newVal, oldVal) => {
  if (oldVal === true && newVal === false) {
    justCompleted.value = true
    setTimeout(() => { justCompleted.value = false }, 1200)
  }
})

const workerCount = computed(() => {
  // Under construction: count constructors targeting this building
  if (isConstructing.value) {
    return game.colonists.filter(
      c => c.health > 0 &&
        c.currentAction?.type === 'construct' &&
        c.currentAction?.targetId === props.building.id &&
        !c.currentAction?.walkPath?.length
    ).length
  }

  // Operational: count workers targeting this specific building
  return game.colonists.filter(c => {
    if (c.health <= 0 || !c.currentAction || c.currentAction.walkPath?.length) return false

    // Repairers match by targetId
    if (c.currentAction.type === 'repair') {
      return c.currentAction.targetId === props.building.id
    }

    // Workers with a targetId match their specific building
    if (c.currentAction.targetId) {
      return c.currentAction.targetId === props.building.id
    }

    return false
  }).length
})

const SHORT_LABELS: Record<string, string> = {
  solar: 'SOL',
  o2generator: 'O2',
  extractionrig: 'RIG',
  medbay: 'MED',
  storageSilo: 'SILO',
  launchplatform: 'PAD',
  partsfactory: 'FAC',
}

const shortLabel = computed(() => SHORT_LABELS[props.building.type] || '???')

const showLabel = computed(() => true) // CSS controls visibility via zoom



const platformAway = computed(() => {
  if (props.building.type !== 'launchplatform') return false
  const ep = game.exportPlatforms[props.building.id]
  return ep?.status === 'in_transit' || ep?.status === 'returning'
})

const alertType = computed(() => {
  if (props.building.damaged) return null // wrench icon handles damage
  if (props.building.constructionProgress !== null) return null
  const needsWorkers = props.building.type === 'extractionrig'
  if (needsWorkers && workerCount.value === 0) return 'alert-warning'
  return null
})
</script>

<style scoped>
.map-building {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: auto;
  cursor: pointer;
  z-index: 2;
}

.building-shadow {
  position: absolute;
  inset: -1px;
  transform: translate(1.5px, 1.5px);
  filter: blur(3px);
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  pointer-events: none;
}

.building-footprint {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fp-svg {
  width: 30px;
  height: auto;
  display: block;
}

/* Type colors */
.type-solar { color: var(--amber); }
.type-o2generator { color: var(--cyan); }
.type-extractionrig { color: var(--green); }
.type-medbay { color: var(--red); }
.type-partsfactory { color: var(--amber); }
.type-storageSilo { color: var(--text-secondary, #888); }
.type-launchplatform { color: var(--amber); }

/* Glow per type */
.type-solar .building-footprint { filter: drop-shadow(0 0 4px var(--amber-glow)); }
.type-o2generator .building-footprint { filter: drop-shadow(0 0 4px var(--cyan-glow)); }
.type-extractionrig .building-footprint { filter: drop-shadow(0 0 4px var(--green-glow)); }
.type-medbay .building-footprint { filter: drop-shadow(0 0 4px var(--red-glow)); }
.type-partsfactory .building-footprint { filter: drop-shadow(0 0 4px var(--amber-glow)); }
.type-launchplatform .building-footprint { filter: drop-shadow(0 0 4px var(--amber-glow)); }
.type-storageSilo .building-footprint { filter: drop-shadow(0 0 3px rgba(136,136,136,0.1)); }

/* Launch platform away state */
.platform-away .building-footprint {
  filter: drop-shadow(0 0 2px rgba(245, 158, 11, 0.1));
  opacity: 0.5;
}

/* Building label (zoom-dependent via CSS) */
.building-label {
  position: absolute;
  bottom: -12px;
  left: 50%;
  font-family: var(--font-mono);
  font-size: 0.5rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: currentColor;
  opacity: 0.6;
  white-space: nowrap;
  pointer-events: none;
  display: none;
}

/* Construction */
.constructing .building-footprint {
  opacity: 0.35;
  animation: construct-pulse 2s ease-in-out infinite;
}

.just-completed .building-footprint {
  animation: complete-burst 1.2s ease-out forwards;
}

@keyframes complete-burst {
  0% { filter: drop-shadow(0 0 15px currentColor); transform: scale(1.15); }
  40% { filter: drop-shadow(0 0 25px currentColor); }
  100% { filter: drop-shadow(0 0 4px currentColor); transform: scale(1); }
}

@keyframes construct-pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.5; }
}

/* Damage */
.damaged .building-footprint {
  animation: dmg-pulse 1.5s ease-in-out infinite;
}

@keyframes dmg-pulse {
  0%, 100% { filter: drop-shadow(0 0 6px var(--red-glow)); }
  50% { filter: drop-shadow(0 0 15px var(--red-glow)); }
}

.dmg-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 14px;
  height: 14px;
  border-radius: var(--radius-xs);
  background: var(--red);
  color: var(--bg-deep);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 6px var(--red);
  animation: feed-blink 1s ease-in-out infinite;
  z-index: 2;
}

.dmg-badge .svg-icon {
  width: 10px;
  height: 10px;
}

@keyframes feed-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

/* Construction bar */
.construction-bar {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 3px;
  background: rgba(100, 100, 100, 0.3);
  border-radius: 2px;
  overflow: hidden;
}

.construction-fill {
  height: 100%;
  background: var(--amber);
  border-radius: var(--radius-xs);
  transition: width 1s linear;
}

/* Worker pips */
.worker-pips {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
}

.worker-pip {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 4px currentColor;
}

.worker-pip.type-solar { color: var(--amber); }
.worker-pip.type-o2generator { color: var(--cyan); }
.worker-pip.type-extractionrig { color: var(--green); }
.worker-pip.type-medbay { color: var(--red); }
.worker-pip.type-partsfactory { color: var(--amber); }
.worker-pip.type-launchplatform { color: var(--amber); }
.worker-pip.type-storageSilo { color: var(--text-secondary); }

/* Alert markers */
.alert-marker {
  position: absolute;
  top: -6px;
  right: -6px;
  z-index: 3;
  border-radius: 50%;
  pointer-events: none;
}



.alert-warning {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  background: var(--amber);
  box-shadow: 0 0 6px rgba(245, 158, 11, 0.5);
  animation: alert-pulse 1.5s ease-in-out infinite;
}

@keyframes alert-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.4); }
}
</style>
