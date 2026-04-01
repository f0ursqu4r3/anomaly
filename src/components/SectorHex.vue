<template>
  <g
    :transform="`translate(${px}, ${py})`"
    :class="['sector-hex', { hidden: sector.status === 'hidden' }]"
    @click="sector.status !== 'hidden' && $emit('select', sector)"
  >
    <!-- Hex polygon -->
    <polygon
      :points="hexPoints"
      :fill="sector.status === 'hidden' ? 'var(--bg-deep)' : terrainConfig.bgColor"
      :stroke="sector.status === 'hidden' ? 'var(--accent-dim)' : terrainConfig.color"
      stroke-width="1.5"
      :opacity="sector.status === 'hidden' ? 0.3 : 1"
    />

    <!-- Fog overlay for hidden sectors -->
    <polygon
      v-if="sector.status === 'hidden'"
      :points="hexPoints"
      fill="var(--bg-deep)"
      opacity="0.7"
    />

    <template v-if="sector.status !== 'hidden'">
      <!-- Terrain label -->
      <text
        x="0"
        :y="-hexSize * 0.15"
        text-anchor="middle"
        :fill="terrainConfig.color"
        :font-size="hexSize * 0.2"
        font-family="var(--font-mono)"
        opacity="0.8"
      >
        {{ terrainConfig.label.toUpperCase() }}
      </text>

      <!-- Colony marker -->
      <template v-if="sector.id === COLONY_SECTOR_ID">
        <circle cx="0" :cy="hexSize * 0.15" :r="hexSize * 0.18" fill="none" stroke="var(--cyan)" stroke-width="1.5" />
        <circle cx="0" :cy="hexSize * 0.15" :r="hexSize * 0.06" fill="var(--cyan)" />
      </template>

      <!-- Outpost marker -->
      <template v-else-if="sector.outpostId">
        <circle cx="0" :cy="hexSize * 0.15" :r="hexSize * 0.15" fill="none" stroke="var(--green)" stroke-width="1.5" />
        <polygon
          :points="outpostTrianglePoints"
          fill="var(--green)"
        />
      </template>

      <!-- Scan signature hint -->
      <text
        v-if="sector.scanSignature && !sector.deposit"
        x="0"
        :y="hexSize * 0.15"
        text-anchor="middle"
        fill="var(--cyan)"
        :font-size="hexSize * 0.17"
        font-family="var(--font-mono)"
        opacity="0.9"
      >
        {{ sector.scanSignature.depositType.toUpperCase() }}
      </text>

      <!-- Confirmed deposit label -->
      <text
        v-if="sector.deposit"
        x="0"
        :y="sector.outpostId ? hexSize * 0.42 : hexSize * 0.15"
        text-anchor="middle"
        fill="var(--green)"
        :font-size="hexSize * 0.16"
        font-family="var(--font-mono)"
        opacity="0.9"
      >
        {{ sector.deposit.quality.toUpperCase() }} {{ sector.deposit.type.toUpperCase() }}
      </text>

      <!-- Scanning indicator -->
      <text
        v-if="sector.status === 'scanning'"
        x="0"
        :y="hexSize * 0.15"
        text-anchor="middle"
        fill="var(--amber)"
        :font-size="hexSize * 0.18"
        font-family="var(--font-mono)"
        class="scanning-text"
      >
        SCANNING...
      </text>
    </template>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Sector } from '@/types/moon'
import { TERRAIN_CONFIGS, COLONY_SECTOR_ID } from '@/systems/sectorGen'

const props = defineProps<{
  sector: Sector
  px: number
  py: number
  hexSize: number
}>()

defineEmits<{ select: [sector: Sector] }>()

const terrainConfig = computed(() => TERRAIN_CONFIGS[props.sector.terrain])

// Flat-top hexagon points
const hexPoints = computed(() => {
  const s = props.hexSize * 0.9
  const points: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i)
    const x = s * Math.cos(angle)
    const y = s * Math.sin(angle)
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return points.join(' ')
})

// Small upward triangle for outpost marker
const outpostTrianglePoints = computed(() => {
  const s = props.hexSize * 0.08
  const cy = props.hexSize * 0.15
  return `${-s},${cy + s} ${s},${cy + s} 0,${cy - s}`
})
</script>

<style scoped>
.sector-hex {
  cursor: pointer;
  transition: opacity 0.2s;
}

.sector-hex:hover:not(.hidden) polygon:first-child {
  filter: brightness(1.3);
}

.sector-hex.hidden {
  pointer-events: none;
}

@keyframes pulse-opacity {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.scanning-text {
  animation: pulse-opacity 1.5s ease-in-out infinite;
}
</style>
