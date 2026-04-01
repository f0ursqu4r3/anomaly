<template>
  <g
    :transform="`translate(${px}, ${py})`"
    :class="['sector-hex', { hidden: sector.status === 'hidden' }]"
    @click="sector.status !== 'hidden' && $emit('select', sector)"
  >
    <!-- Organic hex shape -->
    <path
      :d="organicHexPath"
      :fill="sector.status === 'hidden' ? '#08080f' : terrainConfig.bgColor"
      :stroke="sector.status === 'hidden' ? 'none' : terrainConfig.color"
      :stroke-width="sector.status === 'hidden' ? 0 : 0.5"
      :stroke-opacity="0.15"
      :opacity="sector.status === 'hidden' ? 0.4 : 1"
    />

    <!-- Hidden sector: subtle noise dots -->
    <template v-if="sector.status === 'hidden'">
      <circle
        v-for="(dot, i) in noiseDots"
        :key="'n' + i"
        :cx="dot.x"
        :cy="dot.y"
        :r="dot.r"
        fill="#0a0a14"
        :opacity="dot.o"
      />
    </template>

    <!-- Scanned / Surveyed terrain features -->
    <template v-if="sector.status !== 'hidden'">
      <!-- Rocky: scattered boulders -->
      <template v-if="sector.terrain === 'rocky'">
        <circle
          v-for="(b, i) in rockyFeatures"
          :key="'b' + i"
          :cx="b.x"
          :cy="b.y"
          :r="b.r"
          :fill="terrainConfig.color"
          :opacity="b.o"
        />
      </template>

      <!-- Ice: soft lighter patches -->
      <template v-if="sector.terrain === 'ice'">
        <ellipse
          v-for="(p, i) in iceFeatures"
          :key="'ip' + i"
          :cx="p.x"
          :cy="p.y"
          :rx="p.rx"
          :ry="p.ry"
          :fill="terrainConfig.color"
          :opacity="p.o"
        />
      </template>

      <!-- Volcanic: warm glow spots -->
      <template v-if="sector.terrain === 'volcanic'">
        <circle
          v-for="(g, i) in volcanicFeatures"
          :key="'vg' + i"
          :cx="g.x"
          :cy="g.y"
          :r="g.r"
          :fill="terrainConfig.color"
          :opacity="g.o"
          :filter="i < 2 ? 'url(#glow)' : undefined"
        />
      </template>

      <!-- Crater: circular ring features -->
      <template v-if="sector.terrain === 'crater'">
        <circle
          v-for="(c, i) in craterFeatures"
          :key="'cr' + i"
          :cx="c.x"
          :cy="c.y"
          :r="c.r"
          fill="none"
          :stroke="terrainConfig.color"
          :stroke-width="0.8"
          :opacity="c.o"
        />
      </template>

      <!-- Canyon: thin line striations -->
      <template v-if="sector.terrain === 'canyon'">
        <line
          v-for="(l, i) in canyonFeatures"
          :key="'cn' + i"
          :x1="l.x1"
          :y1="l.y1"
          :x2="l.x2"
          :y2="l.y2"
          :stroke="terrainConfig.color"
          :stroke-width="0.7"
          :opacity="l.o"
          stroke-linecap="round"
        />
      </template>

      <!-- Labels & markers: counter-scaled so they stay fixed size on zoom -->
      <g :transform="`scale(${inverseZoom})`">
        <!-- Terrain label -->
        <text
          x="0"
          :y="-hexSize * 0.15"
          text-anchor="middle"
          :fill="terrainConfig.color"
          :font-size="hexSize * 0.2"
          font-family="var(--font-mono)"
          opacity="0.7"
        >
          {{ terrainConfig.label.toUpperCase() }}
        </text>

        <!-- Outpost marker (non-colony) -->
        <template v-if="sector.outpostId && sector.id !== COLONY_SECTOR_ID">
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

        <!-- Surveyed confirmed indicator -->
        <circle
          v-if="sector.status === 'surveyed' && sector.deposit"
          :cx="hexSize * 0.3"
          :cy="-hexSize * 0.3"
          :r="hexSize * 0.06"
          fill="var(--green)"
          opacity="0.8"
        />
      </g>

      <!-- Colony miniature: shows actual buildings and colonists -->
      <template v-if="sector.id === COLONY_SECTOR_ID">
        <circle cx="0" cy="0" :r="hexSize * 0.4" fill="none" stroke="var(--cyan)" stroke-width="0.6" opacity="0.3" />
        <!-- Buildings rendered at relative positions (colony coords 0-100 mapped to hex area) -->
        <rect
          v-for="b in colonyBuildings"
          :key="b.id"
          :x="mapColonyCoord(b.x, 'x') - 1.2"
          :y="mapColonyCoord(b.y, 'y') - 1.2"
          width="2.4"
          height="2.4"
          :fill="b.damaged ? 'var(--red)' : buildingColor(b.type)"
          :opacity="b.damaged ? 0.5 : 0.8"
          rx="0.4"
        />
        <!-- Colonists as tiny dots -->
        <circle
          v-for="c in colonyColonistPositions"
          :key="c.id"
          :cx="mapColonyCoord(c.x, 'x')"
          :cy="mapColonyCoord(c.y, 'y')"
          r="0.8"
          fill="var(--text-primary)"
          opacity="0.7"
        />
      </template>
    </template>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Sector } from '@/types/moon'
import type { Building, BuildingType } from '@/stores/gameStore'
import { TERRAIN_CONFIGS, COLONY_SECTOR_ID } from '@/systems/sectorGen'

const props = defineProps<{
  sector: Sector
  px: number
  py: number
  hexSize: number
  inverseZoom: number
  colonyBuildings?: Building[]
  colonyColonistPositions?: { id: string; x: number; y: number }[]
}>()

defineEmits<{ select: [sector: Sector] }>()

const terrainConfig = computed(() => TERRAIN_CONFIGS[props.sector.terrain])

// Seeded random from sector id for deterministic features
function sectorRng(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 1 | h)
    h = (h + Math.imul(h ^ (h >>> 7), 61 | h)) ^ h
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296
  }
}

// Organic hex path with slight vertex irregularity
const organicHexPath = computed(() => {
  const s = props.hexSize * 0.92
  const rand = sectorRng(props.sector.id)
  const points: [number, number][] = []

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i)
    const jitter = 1 + (rand() - 0.5) * 0.12
    const x = s * jitter * Math.cos(angle)
    const y = s * jitter * Math.sin(angle)
    points.push([x, y])
  }

  // Build smooth path using quadratic curves between midpoints
  let d = ''
  for (let i = 0; i < points.length; i++) {
    const curr = points[i]
    const next = points[(i + 1) % points.length]
    const midX = (curr[0] + next[0]) / 2
    const midY = (curr[1] + next[1]) / 2

    if (i === 0) {
      const prev = points[points.length - 1]
      const startMidX = (prev[0] + curr[0]) / 2
      const startMidY = (prev[1] + curr[1]) / 2
      d += `M ${startMidX.toFixed(2)} ${startMidY.toFixed(2)} `
    }

    d += `Q ${curr[0].toFixed(2)} ${curr[1].toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)} `
  }
  d += 'Z'
  return d
})

// Noise dots for hidden sectors
const noiseDots = computed(() => {
  const rand = sectorRng(props.sector.id + '-noise')
  const s = props.hexSize * 0.7
  const dots: { x: number; y: number; r: number; o: number }[] = []
  for (let i = 0; i < 8; i++) {
    dots.push({
      x: (rand() - 0.5) * s * 2,
      y: (rand() - 0.5) * s * 2,
      r: rand() * 2 + 0.5,
      o: rand() * 0.15 + 0.05,
    })
  }
  return dots
})

// Terrain-specific features, deterministic per sector (separate computeds for type safety)

function makeFeatureRng() {
  return sectorRng(props.sector.id + '-feat')
}

const rockyFeatures = computed(() => {
  const rand = makeFeatureRng()
  const s = props.hexSize * 0.55
  const features: { x: number; y: number; r: number; o: number }[] = []
  const count = 5 + Math.floor(rand() * 4)
  for (let i = 0; i < count; i++) {
    features.push({
      x: (rand() - 0.5) * s * 2,
      y: (rand() - 0.5) * s * 2,
      r: rand() * 2.5 + 0.8,
      o: rand() * 0.12 + 0.04,
    })
  }
  return features
})

const iceFeatures = computed(() => {
  const rand = makeFeatureRng()
  const s = props.hexSize * 0.55
  const features: { x: number; y: number; rx: number; ry: number; o: number }[] = []
  const count = 3 + Math.floor(rand() * 3)
  for (let i = 0; i < count; i++) {
    features.push({
      x: (rand() - 0.5) * s * 1.6,
      y: (rand() - 0.5) * s * 1.6,
      rx: rand() * 6 + 3,
      ry: rand() * 4 + 2,
      o: rand() * 0.08 + 0.03,
    })
  }
  return features
})

const volcanicFeatures = computed(() => {
  const rand = makeFeatureRng()
  const s = props.hexSize * 0.55
  const features: { x: number; y: number; r: number; o: number }[] = []
  const count = 3 + Math.floor(rand() * 3)
  for (let i = 0; i < count; i++) {
    features.push({
      x: (rand() - 0.5) * s * 1.6,
      y: (rand() - 0.5) * s * 1.6,
      r: rand() * 4 + 1.5,
      o: rand() * 0.15 + 0.05,
    })
  }
  return features
})

const craterFeatures = computed(() => {
  const rand = makeFeatureRng()
  const s = props.hexSize * 0.55
  const features: { x: number; y: number; r: number; o: number }[] = []
  const count = 2 + Math.floor(rand() * 2)
  for (let i = 0; i < count; i++) {
    features.push({
      x: (rand() - 0.5) * s * 1.4,
      y: (rand() - 0.5) * s * 1.4,
      r: rand() * 6 + 3,
      o: rand() * 0.1 + 0.04,
    })
  }
  return features
})

const canyonFeatures = computed(() => {
  const rand = makeFeatureRng()
  const s = props.hexSize * 0.55
  const features: { x1: number; y1: number; x2: number; y2: number; o: number }[] = []
  const count = 4 + Math.floor(rand() * 3)
  for (let i = 0; i < count; i++) {
    const baseAngle = rand() * Math.PI * 0.4 + Math.PI * 0.3
    const cx = (rand() - 0.5) * s * 1.4
    const cy = (rand() - 0.5) * s * 1.4
    const len = rand() * 8 + 4
    features.push({
      x1: cx - Math.cos(baseAngle) * len,
      y1: cy - Math.sin(baseAngle) * len,
      x2: cx + Math.cos(baseAngle) * len,
      y2: cy + Math.sin(baseAngle) * len,
      o: rand() * 0.1 + 0.04,
    })
  }
  return features
})

// Map colony coordinates (0-100%) to hex-local coordinates
function mapColonyCoord(val: number, axis: 'x' | 'y'): number {
  // Colony map is 0-100, center at 50. Map to hex area with radius ~40% of hexSize
  const range = props.hexSize * 0.35
  return ((val - 50) / 50) * range
}

function buildingColor(type: BuildingType): string {
  switch (type) {
    case 'solar': return 'var(--amber)'
    case 'o2generator': return 'var(--cyan)'
    case 'extractionrig': return 'var(--green)'
    case 'medbay': return 'var(--red)'
    case 'partsfactory': return 'var(--orange)'
    default: return 'var(--text-muted)'
  }
}

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

.sector-hex:hover:not(.hidden) path {
  filter: brightness(1.3);
}

.sector-hex.hidden {
  pointer-events: none;
}
</style>
