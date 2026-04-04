<template>
  <div
    ref="mapContainer"
    class="colony-map"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @touchstart.passive="onTouchStart"
    @touchmove.prevent="onTouchMove"
    @touchend.passive="onTouchEnd"
    @dblclick="resetView"
    @click="clearSelection"
  >
    <div v-if="settings.scanlines" class="scanlines" />
    <!-- Hazard flash vignette -->
    <div v-if="hazardFlash" class="hazard-flash" />

    <div class="map-content" :class="{ 'zoomed-in': isZoomedIn }" :style="transformStyle">
      <MapTerrain />

      <!-- Worn paths from colonist traffic (SVG) -->
      <!-- Zone labels (toggled via settings) -->
      <template v-if="settings.zoneLabels">
        <div
          v-for="zone in ZONES"
          :key="'zl-' + zone.id"
          class="zone-label"
          :style="{
            left: zone.x + '%',
            top: zone.y - zone.radius - 1 + '%',
            color: zone.color,
            transform: `translateX(-50%) scale(${1 / zoom})`,
          }"
        >
          {{ zone.label }}
        </div>
      </template>

      <svg
        class="zone-overlay"
        :class="{ 'high-contrast': settings.highContrast }"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        <template v-if="settings.pathLines">
          <line
            v-for="(p, i) in wornPaths"
            :key="'path-' + i"
            :x1="p.x1"
            :y1="p.y1"
            :x2="p.x2"
            :y2="p.y2"
            :stroke="`rgba(200, 200, 200, ${p.opacity})`"
            :stroke-width="p.width"
            stroke-linecap="round"
          />
        </template>
        <!-- Resource flow lines -->
        <template v-if="showFlowLines">
          <line
            v-for="(fl, i) in flowLines"
            :key="'flow-' + i"
            :x1="fl.x1"
            :y1="fl.y1"
            :x2="fl.x2"
            :y2="fl.y2"
            :stroke="fl.color"
            stroke-width="0.15"
            stroke-dasharray="0.8,1.2"
            stroke-linecap="round"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="2"
              to="0"
              dur="3s"
              repeatCount="indefinite"
            />
          </line>
        </template>
      </svg>

      <!-- Habitat label (counter-scaled like building labels) -->
      <div
        class="hab-label"
        :style="{
          left: ZONE_MAP.habitat.x + '%',
          top: ZONE_MAP.habitat.y + 5 + '%',
          transform: `translateX(-50%) scale(${1 / zoom})`,
        }"
      >
        HAB
      </div>

      <MapBuilding v-for="b in game.buildings" :key="b.id" :building="b" @select="selectBuilding" />
      <MapSupplyDrop v-for="d in game.supplyDrops" :key="d.id" :drop="d" @select="selectDrop" />

      <MapColonist
        v-for="c in visibleColonists"
        :key="c.id"
        :colonist="c"
        :x="getColonistState(c.id).x"
        :y="getColonistState(c.id).y"
        :visual-state="getColonistState(c.id).visualState"
        @select="selectColonist"
      />

      <!-- Connector line from selected entity to info overlay (45° elbow) -->
      <svg
        v-if="selectedEntityPos"
        :key="selectedEntityKey"
        class="info-connector"
        viewBox="0 0 100 100"
      >
        <polyline
          :points="connectorPoints"
          class="connector-line"
          fill="none"
          stroke="rgba(255, 255, 255, 0.15)"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </svg>

      <!-- Info overlays -->
      <BuildingInfo
        v-if="selectedBuilding"
        :building="selectedBuilding"
        :x="selectedBuilding.x"
        :y="selectedBuilding.y"
      />
      <DropInfo v-if="selectedDrop" :drop="selectedDrop" :x="selectedDrop.x" :y="selectedDrop.y" />
      <ColonistInfo
        v-if="trackedColonist"
        :colonist="trackedColonist"
        :x="trackedColonistPos!.x"
        :y="trackedColonistPos!.y"
      />
    </div>

    <HazardAlert />

    <!-- Settings gear — top right -->
    <button class="settings-btn" @click="$emit('openSettings')">
      <SvgIcon name="settings" size="md" />
    </button>

    <!-- Edge stats -->
    <div class="edge-stats">
      <span class="edge-stat mono">CREW {{ game.aliveColonists.length }}</span>
      <span class="edge-stat mono">DEPTH {{ Math.floor(game.depth) }}m</span>
    </div>

    <div v-if="moon.awayCount > 0" class="away-indicator mono">
      {{ moon.awayCount }} CREW DEPLOYED
    </div>

    <!-- Activity summary -->
    <div class="activity-summary">
      <span v-for="a in activitySummary" :key="a.label" class="activity-item mono">
        <span :style="{ color: a.color }">{{ a.count }}</span> {{ a.label }}
      </span>
    </div>

    <div class="feed-indicator">
      <span class="feed-dot" />
      <span class="feed-text">LIVE</span>
    </div>

    <div v-if="settings.showFps" class="fps-counter">{{ fps }} FPS</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { Building, SupplyDrop } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useMoonStore } from '@/stores/moonStore'
import { useColonistMovement } from '@/composables/useColonistMovement'
import { ZONE_MAP, ZONES } from '@/systems/mapLayout'
import MapTerrain from './MapTerrain.vue'
import HazardAlert from './HazardAlert.vue'
import MapBuilding from './MapBuilding.vue'
import MapColonist from './MapColonist.vue'
import MapSupplyDrop from './MapSupplyDrop.vue'
import BuildingInfo from './BuildingInfo.vue'
import DropInfo from './DropInfo.vue'
import ColonistInfo from './ColonistInfo.vue'
import SvgIcon from './SvgIcon.vue'

defineEmits<{ openSettings: [] }>()

const game = useGameStore()
const settings = useSettingsStore()
const moon = useMoonStore()
const { positions, getOrCreate } = useColonistMovement()

const wornPaths = computed(() => {
  const paths: {
    x1: number
    y1: number
    x2: number
    y2: number
    opacity: number
    width: number
  }[] = []
  for (const [key, count] of Object.entries(game.zonePaths)) {
    if (count < 10) continue
    const [z1, z2] = key.split(':')
    const zone1 = ZONE_MAP[z1]
    const zone2 = ZONE_MAP[z2]
    if (!zone1 || !zone2) continue

    let opacity = 0.05
    let width = 1
    if (count >= 150) {
      width = 1.5
    } else if (count >= 50) {
      width = 1.25
    }

    paths.push({ x1: zone1.x, y1: zone1.y, x2: zone2.x, y2: zone2.y, opacity, width })
  }
  return paths
})

const flowLines = computed(() => {
  const lines: { x1: number; y1: number; x2: number; y2: number; color: string }[] = []
  const producers = game.buildings.filter((b) => b.constructionProgress === null)
  const solarPanels = producers.filter((b) => b.type === 'solar')
  const o2Generators = producers.filter((b) => b.type === 'o2generator')
  const consumerBuildings = producers.filter(
    (b) => !['solar', 'o2generator', 'storageSilo'].includes(b.type),
  )
  // Habitat is a visual landmark, not a game building — include it as a consumer
  const hab = ZONE_MAP.habitat
  const consumers = [...consumerBuildings.map((b) => ({ x: b.x, y: b.y })), { x: hab.x, y: hab.y }]

  for (const solar of solarPanels) {
    for (const consumer of consumers) {
      lines.push({
        x1: solar.x,
        y1: solar.y,
        x2: consumer.x,
        y2: consumer.y,
        color: 'rgba(245, 158, 11, 0.02)',
      })
    }
  }
  for (const o2 of o2Generators) {
    for (const consumer of consumers) {
      lines.push({
        x1: o2.x,
        y1: o2.y,
        x2: consumer.x,
        y2: consumer.y,
        color: 'rgba(126, 207, 255, 0.02)',
      })
    }
  }
  return lines
})

const showFlowLines = computed(() => zoom.value >= 0.9)

const activitySummary = computed(() => {
  const counts: { label: string; count: number; color: string }[] = []
  const alive = game.aliveColonists
  const mining = alive.filter((c) => c.currentAction?.type === 'extract').length
  const engineering = alive.filter((c) =>
    ['engineer', 'construct', 'repair'].includes(c.currentAction?.type ?? ''),
  ).length
  const medical = alive.filter((c) => c.currentAction?.type === 'seek_medical').length
  const loading = alive.filter((c) =>
    ['load', 'unpack'].includes(c.currentAction?.type ?? ''),
  ).length
  const resting = alive.filter((c) =>
    ['rest', 'eat', 'socialize'].includes(c.currentAction?.type ?? ''),
  ).length
  const idle = alive.filter((c) => !c.currentAction || c.currentAction.type === 'wander').length

  if (engineering) counts.push({ label: 'ENGINEER', count: engineering, color: 'var(--amber)' })
  if (idle) counts.push({ label: 'IDLE', count: idle, color: 'var(--text-muted)' })
  if (loading) counts.push({ label: 'LOADING', count: loading, color: 'var(--cyan)' })
  if (medical) counts.push({ label: 'MEDICAL', count: medical, color: 'var(--red)' })
  if (mining) counts.push({ label: 'MINING', count: mining, color: 'var(--green)' })
  if (resting) counts.push({ label: 'RESTING', count: resting, color: 'var(--text-secondary)' })
  return counts
})

function getColonistState(id: string) {
  return positions.value.get(id) || getOrCreate(id)
}

const trackedColonistPos = computed(() => {
  if (!game.trackedColonistId) return null
  return getColonistState(game.trackedColonistId)
})

const trackedColonist = computed(() => {
  if (!game.trackedColonistId) return null
  return game.colonists.find((c) => c.id === game.trackedColonistId) ?? null
})

// Colonists working inside buildings are shown as pips on the building, not as map markers
const INSIDE_ACTIONS = new Set([
  'extract',
  'engineer',
  'repair',
  'seek_medical',
  'load',
  'construct',
])

const visibleColonists = computed(() =>
  game.colonists.filter((c) => {
    if (c.health <= 0) return true // show dead colonists (faded)
    const action = c.currentAction
    if (!action) return true // idle/no action — show on map
    if (action.walkPath?.length) return true // walking — show on map
    if (INSIDE_ACTIONS.has(action.type)) return false // working inside building — hide
    return true
  }),
)

const selectedBuilding = ref<Building | null>(null)
const selectedDrop = ref<SupplyDrop | null>(null)

// Unified entity position for connector line
const selectedEntityPos = computed(() => {
  if (selectedBuilding.value) return { x: selectedBuilding.value.x, y: selectedBuilding.value.y }
  if (selectedDrop.value) return { x: selectedDrop.value.x, y: selectedDrop.value.y }
  if (trackedColonistPos.value)
    return { x: trackedColonistPos.value.x, y: trackedColonistPos.value.y }
  return null
})

const selectedEntityKey = computed(() => {
  if (selectedBuilding.value) return 'b-' + selectedBuilding.value.id
  if (selectedDrop.value) return 'd-' + selectedDrop.value.id
  if (game.trackedColonistId) return 'c-' + game.trackedColonistId
  return ''
})

const connectorPoints = computed(() => {
  const pos = selectedEntityPos.value
  if (!pos) return ''
  const bx = pos.x
  const by = pos.y
  const below = by < 30
  const overlayX = Math.max(20, Math.min(80, bx))
  const overlayY = below ? by + 8 : by - 8

  // Anchor point on the card matches InfoCard's adaptive translate
  // At x=20 the card anchors from its left edge, at x=80 from its right
  // Pick a connector anchor near the entity's X to keep the line short
  let anchorX = bx
  // Clamp anchor to stay within reasonable range of the overlay
  anchorX = Math.max(overlayX - 8, Math.min(overlayX + 8, anchorX))

  if (Math.abs(anchorX - bx) < 1.5) {
    anchorX = bx + (bx < 50 ? 3 : -3)
  }

  const elbowDx = Math.abs(anchorX - bx)
  const elbowY = below ? by + elbowDx : by - elbowDx
  return `${anchorX},${overlayY} ${anchorX},${elbowY} ${bx},${by}`
})

const hazardFlash = ref(false)

// Clear selected drop if it gets removed (unpacking complete)
watch(
  () => game.supplyDrops,
  () => {
    if (selectedDrop.value && !game.supplyDrops.find((d) => d.id === selectedDrop.value!.id)) {
      selectedDrop.value = null
    }
  },
)

// Watch for hazard events — flash the screen
watch(
  () => game.lastHazardAt,
  () => {
    if (game.lastHazardAt > 0) {
      hazardFlash.value = true
      setTimeout(() => {
        hazardFlash.value = false
      }, 400)
    }
  },
)

function clearSelection() {
  selectedBuilding.value = null
  selectedDrop.value = null
  game.trackColonist(null)
}

function selectBuilding(b: Building) {
  selectedDrop.value = null
  game.trackColonist(null)
  selectedBuilding.value = selectedBuilding.value?.id === b.id ? null : b
}

function selectDrop(d: SupplyDrop) {
  selectedBuilding.value = null
  game.trackColonist(null)
  selectedDrop.value = selectedDrop.value?.id === d.id ? null : d
}

function selectColonist(c: { id: string }) {
  selectedBuilding.value = null
  selectedDrop.value = null
  game.trackColonist(game.trackedColonistId === c.id ? null : c.id)
}

// Pan & Zoom
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const lastPointer = ref({ x: 0, y: 0 })

const isZoomedIn = computed(() => zoom.value > 1.2)

const transformStyle = computed(() => ({
  transform: `scale(${zoom.value}) translate(${panX.value}px, ${panY.value}px)`,
  transformOrigin: 'center center',
  transition: isPanning.value ? 'none' : 'transform 0.15s ease-out',
  '--marker-scale': `${1 / zoom.value}`,
}))

function onWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  zoom.value = Math.min(2.0, Math.max(0.8, zoom.value + delta))
}

function onPointerDown(e: PointerEvent) {
  isPanning.value = true
  lastPointer.value = { x: e.clientX, y: e.clientY }
}

function onPointerMove(e: PointerEvent) {
  if (!isPanning.value) return
  const dx = e.clientX - lastPointer.value.x
  const dy = e.clientY - lastPointer.value.y
  panX.value += dx / zoom.value
  panY.value += dy / zoom.value
  lastPointer.value = { x: e.clientX, y: e.clientY }
}

function onPointerUp() {
  isPanning.value = false
}

// Pinch zoom
let lastPinchDist = 0
let isPinching = false

function getTouchDist(e: TouchEvent): number {
  const [a, b] = [e.touches[0], e.touches[1]]
  const dx = a.clientX - b.clientX
  const dy = a.clientY - b.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    isPinching = true
    lastPinchDist = getTouchDist(e)
  }
}

function onTouchMove(e: TouchEvent) {
  if (isPinching && e.touches.length === 2) {
    const dist = getTouchDist(e)
    const scale = dist / lastPinchDist
    zoom.value = Math.min(2.0, Math.max(0.8, zoom.value * scale))
    lastPinchDist = dist
  }
}

function onTouchEnd(e: TouchEvent) {
  if (e.touches.length < 2) {
    isPinching = false
  }
}

function resetView() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

const mapContainer = ref<HTMLElement | null>(null)

watch(
  () => game.panToColonistId,
  (id) => {
    if (!id || !mapContainer.value) return
    const pos = positions.value.get(id) || getOrCreate(id)
    const rect = mapContainer.value.getBoundingClientRect()
    // Colonist position is in % of container; convert to pixel offset from center
    const cx = (pos.x / 100) * rect.width
    const cy = (pos.y / 100) * rect.height
    const targetX = (rect.width / 2 - cx) / zoom.value
    const targetY = (rect.height / 2 - cy) / zoom.value
    panX.value = targetX
    panY.value = targetY
    if (zoom.value < 1.2) zoom.value = 1.3
    game.panToColonistId = null
  },
)

const fps = ref(0)
let fpsFrames = 0
let fpsLastTime = performance.now()
let fpsRaf = 0

function updateFps() {
  fpsFrames++
  const now = performance.now()
  if (now - fpsLastTime >= 1000) {
    fps.value = fpsFrames
    fpsFrames = 0
    fpsLastTime = now
  }
  fpsRaf = requestAnimationFrame(updateFps)
}

onMounted(() => {
  fpsRaf = requestAnimationFrame(updateFps)
})
onUnmounted(() => cancelAnimationFrame(fpsRaf))
</script>

<style scoped>
.colony-map {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  container-type: size;
  background:
    radial-gradient(ellipse at 30% 60%, rgba(25, 30, 40, 0.95) 0%, transparent 35%),
    radial-gradient(ellipse at 70% 35%, rgba(20, 25, 35, 0.85) 0%, transparent 30%),
    radial-gradient(ellipse at 50% 50%, rgba(18, 22, 32, 0.4) 0%, transparent 60%),
    linear-gradient(160deg, #080c14 0%, #0c1220 40%, #101828 60%, #080e18 100%);
  box-shadow: inset 0 0 120px rgba(0, 0, 0, 0.6);
}

.scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 8;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 3px,
    var(--accent-faint) 3px,
    var(--accent-faint) 4px
  );
}

.hazard-flash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 9;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(233, 69, 96, 0.15) 100%);
  animation: hazard-vignette 0.4s ease-out forwards;
}

@keyframes hazard-vignette {
  0% {
    opacity: 1;
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.info-connector {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 19;
  overflow: visible;
}

.connector-line {
  stroke-dasharray: 500;
  stroke-dashoffset: 100;
  animation: connector-draw 1s ease-in forwards;
}

@keyframes connector-draw {
  to {
    stroke-dashoffset: 0;
  }
}

.feed-indicator {
  position: absolute;
  top: calc(var(--safe-top) + 8px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 9;
  pointer-events: none;
}

.feed-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--red);
  animation: feed-blink 2s ease-in-out infinite;
}

.feed-text {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--red-glow);
}

@keyframes feed-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.2;
  }
}

.map-content {
  position: absolute;
  /* Square: use the smaller container dimension so 100×100 grid isn't distorted */
  width: min(100cqw, 100cqh);
  height: min(100cqw, 100cqh);
  left: 50%;
  top: 50%;
  translate: -50% -50%;
}

.zone-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.zone-overlay.high-contrast line {
  opacity: 0.3;
}

.zone-label {
  position: absolute;
  font-family: var(--font-mono);
  font-size: 0.4375rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  opacity: 0.4;
  pointer-events: none;
  white-space: nowrap;
  z-index: 1;
}

.fps-counter {
  position: absolute;
  bottom: calc(var(--safe-bottom, 0px) + 80px);
  left: calc(var(--safe-left, 0px) + 8px);
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--text-secondary);
  z-index: 9;
  pointer-events: none;
}

.activity-summary {
  position: absolute;
  bottom: calc(var(--safe-bottom, 0px) + 64px);
  left: calc(var(--safe-left, 0px) + 16px);
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 2px;
  pointer-events: none;
}

.activity-item {
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  opacity: 0.5;
}

.away-indicator {
  position: absolute;
  bottom: 36px;
  left: 8px;
  z-index: 10;
  font-size: 0.625rem;
  color: var(--amber);
  padding: 2px 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--accent-dim);
  border-radius: 2px;
}

.settings-btn {
  position: absolute;
  top: calc(var(--safe-top) + 8px);
  right: calc(var(--safe-right) + 8px);
  z-index: 10;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.5rem;
  cursor: pointer;
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
}

.settings-btn:active {
  opacity: 0.8;
}

.edge-stats {
  position: absolute;
  top: calc(var(--safe-top) + 8px);
  left: calc(var(--safe-left) + 8px);
  z-index: 5;
  display: flex;
  gap: 10px;
}

.edge-stat {
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  opacity: 0.6;
}

.zoomed-in :deep(.building-label),
.zoomed-in .hab-label {
  display: block;
}

.hab-label {
  position: absolute;
  font-family: var(--font-mono);
  font-size: 0.5rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: rgba(126, 207, 255, 0.6);
  pointer-events: none;
  white-space: nowrap;
  display: none;
  z-index: 1;
}
</style>
