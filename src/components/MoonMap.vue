<template>
  <div class="moon-map">
    <!-- SVG Map -->
    <svg
      viewBox="0 0 500 500"
      class="hex-svg"
      @click.self="moon.selectSector(null)"
      @wheel.prevent="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
      @dblclick="resetView"
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g :transform="svgTransform">
        <!-- Faint topographic contour lines -->
        <circle
          v-for="r in contourRadii"
          :key="'contour-' + r"
          cx="0"
          cy="0"
          :r="r"
          fill="none"
          stroke="var(--accent-dim)"
          stroke-width="0.5"
          opacity="0.08"
        />

        <!-- Faint coordinate grid -->
        <line
          v-for="g in gridLines"
          :key="g.key"
          :x1="g.x1"
          :y1="g.y1"
          :x2="g.x2"
          :y2="g.y2"
          stroke="var(--accent-dim)"
          stroke-width="0.3"
          opacity="0.05"
        />

        <!-- Survey team paths (line stays scaled, markers counter-scaled) -->
        <template v-for="mission in moon.activeMissions" :key="mission.id">
          <line
            v-if="missionTarget(mission)"
            x1="0"
            y1="0"
            :x2="missionTarget(mission)!.x"
            :y2="missionTarget(mission)!.y"
            stroke="var(--amber)"
            :stroke-width="1 * inverseZoom"
            stroke-dasharray="4 3"
            opacity="0.4"
          />
          <!-- Team position marker (fixed size) -->
          <g
            v-if="missionPos(mission)"
            :transform="`translate(${missionPos(mission)!.x}, ${missionPos(mission)!.y}) scale(${inverseZoom})`"
          >
            <circle r="4" fill="var(--amber)" opacity="0.9" />
          </g>
        </template>

        <!-- Outpost launch markers (fixed size) -->
        <template v-for="launch in moon.outpostLaunches" :key="launch.id">
          <g
            v-if="launchPos(launch)"
            :transform="`translate(${launchPos(launch)!.x}, ${launchPos(launch)!.y}) scale(${inverseZoom})`"
          >
            <circle r="3.5" fill="var(--green)" opacity="0.9" />
          </g>
        </template>

        <!-- Sector hexes -->
        <SectorHex
          v-for="sector in moon.sectors"
          :key="sector.id"
          :sector="sector"
          :px="hexPx(sector.q)"
          :py="hexPy(sector.q, sector.r)"
          :hex-size="hexSize"
          :inverse-zoom="inverseZoom"
          :colony-buildings="sector.id === COLONY_SECTOR_ID ? game.buildings : undefined"
          :colony-colonist-positions="sector.id === COLONY_SECTOR_ID ? colonistDots : undefined"
          @select="onSelectSector"
        />
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import SectorHex from './SectorHex.vue'
import { useMoonStore } from '@/stores/moonStore'
import { useGameStore } from '@/stores/gameStore'
import { COLONY_SECTOR_ID } from '@/systems/sectorGen'
import { useColonistMovement } from '@/composables/useColonistMovement'
import type { Sector, SurveyMission, OutpostLaunch } from '@/types/moon'

const moon = useMoonStore()
const game = useGameStore()

const hexSize = 38

// ── Hex coordinate conversion ──

function hexPx(q: number): number {
  return hexSize * (3 / 2) * q
}

function hexPy(q: number, r: number): number {
  return hexSize * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r)
}

// ── Pan & Zoom ──

const svgZoom = ref(1)
const svgPanX = ref(0)
const svgPanY = ref(0)
const isPanning = ref(false)
const lastPointer = ref({ x: 0, y: 0 })
const panMoved = ref(false)

const svgTransform = computed(() =>
  `translate(${250 + svgPanX.value}, ${250 + svgPanY.value}) scale(${svgZoom.value})`,
)

function onWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  svgZoom.value = Math.min(2.5, Math.max(0.6, svgZoom.value + delta))
}

function onPointerDown(e: PointerEvent) {
  isPanning.value = true
  panMoved.value = false
  lastPointer.value = { x: e.clientX, y: e.clientY }
}

function onPointerMove(e: PointerEvent) {
  if (!isPanning.value) return
  const dx = e.clientX - lastPointer.value.x
  const dy = e.clientY - lastPointer.value.y
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) panMoved.value = true
  // Scale pointer movement to SVG coordinate space
  const svg = e.currentTarget as SVGSVGElement
  const rect = svg.getBoundingClientRect()
  const scaleX = 500 / rect.width
  const scaleY = 500 / rect.height
  svgPanX.value += dx * scaleX / svgZoom.value
  svgPanY.value += dy * scaleY / svgZoom.value
  lastPointer.value = { x: e.clientX, y: e.clientY }
}

function onPointerUp() {
  isPanning.value = false
}

function resetView() {
  svgZoom.value = 1
  svgPanX.value = 0
  svgPanY.value = 0
}

const inverseZoom = computed(() => 1 / svgZoom.value)

// ── Colony miniature data ──

const { positions } = useColonistMovement()

const colonistDots = computed(() => {
  const dots: { id: string; x: number; y: number }[] = []
  const away = moon.awayColonistIds
  for (const c of game.colonists) {
    if (c.health <= 0 || away.has(c.id)) continue
    const pos = positions.value.get(c.id)
    if (pos) {
      dots.push({ id: c.id, x: pos.targetX, y: pos.targetY })
    }
  }
  return dots
})

// ── Contour and grid overlays ──

const contourRadii = computed(() => {
  const radii: number[] = []
  for (let ring = 1; ring <= 4; ring++) {
    radii.push(hexSize * Math.sqrt(3) * ring * 0.9)
  }
  return radii
})

const gridLines = computed(() => {
  const lines: { key: string; x1: number; y1: number; x2: number; y2: number }[] = []
  const span = 200
  const step = 50
  for (let x = -span; x <= span; x += step) {
    lines.push({ key: `v${x}`, x1: x, y1: -span, x2: x, y2: span })
  }
  for (let y = -span; y <= span; y += step) {
    lines.push({ key: `h${y}`, x1: -span, y1: y, x2: span, y2: y })
  }
  return lines
})

// ── Sector selection ──

function onSelectSector(sector: Sector) {
  if (panMoved.value) return
  moon.selectSector(sector.id)
}

// ── Mission position interpolation ──

function missionTarget(mission: SurveyMission): { x: number; y: number } | null {
  const sector = moon.sectors.find((s) => s.id === mission.sectorId)
  if (!sector) return null
  return { x: hexPx(sector.q), y: hexPy(sector.q, sector.r) }
}

function missionPos(mission: SurveyMission): { x: number; y: number } | null {
  const target = missionTarget(mission)
  if (!target) return null

  const now = game.totalPlaytimeMs

  if (mission.status === 'traveling') {
    const t = Math.min(1, Math.max(0, (now - mission.departedAt) / (mission.arrivalAt - mission.departedAt)))
    return { x: target.x * t, y: target.y * t }
  }

  if (mission.status === 'surveying') {
    return target
  }

  if (mission.status === 'returning') {
    const t = Math.min(1, Math.max(0, (now - mission.surveyCompleteAt) / (mission.returnAt - mission.surveyCompleteAt)))
    return { x: target.x * (1 - t), y: target.y * (1 - t) }
  }

  return null
}

function launchPos(launch: OutpostLaunch): { x: number; y: number } | null {
  const outpost = moon.outposts.find((o) => o.id === launch.outpostId)
  if (!outpost) return null
  const sector = moon.sectors.find((s) => s.id === outpost.sectorId)
  if (!sector) return null

  const origin = { x: hexPx(sector.q), y: hexPy(sector.q, sector.r) }
  const now = game.totalPlaytimeMs
  const t = Math.min(1, Math.max(0, (now - launch.launchedAt) / (launch.arrivalAt - launch.launchedAt)))

  return { x: origin.x * (1 - t), y: origin.y * (1 - t) }
}
</script>

<style scoped>
.moon-map {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--bg-deep);
  overflow: hidden;
}

/* ── SVG ── */

.hex-svg {
  width: 100%;
  height: 100%;
}
</style>
