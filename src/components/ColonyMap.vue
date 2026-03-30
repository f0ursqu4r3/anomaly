<template>
  <div class="colony-map" :class="{ 'reduce-animations': settings.reduceAnimations }" ref="mapContainer"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @dblclick="resetView"
    @click="selectedBuilding = null"
  >
    <div v-if="settings.scanlines" class="scanlines" />

    <div class="map-content" :style="transformStyle">
      <!-- Zone boundaries and paths (SVG) -->
      <svg class="zone-overlay" :class="{ 'high-contrast': settings.highContrast }" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <template v-if="settings.pathLines">
        <line v-for="(edge, i) in pathEdges" :key="'p'+i"
          :x1="edge.x1" :y1="edge.y1" :x2="edge.x2" :y2="edge.y2"
          stroke="var(--accent-dim)" stroke-width="0.3" opacity="0.12"
        />
        </template>
        <circle v-for="zone in zones" :key="zone.id"
          :cx="zone.x" :cy="zone.y" :r="zone.radius"
          fill="none" :stroke="zone.color" stroke-width="0.2"
          stroke-dasharray="1.5,1" opacity="0.15"
        />
      </svg>

      <!-- Zone labels -->
      <template v-if="settings.zoneLabels">
      <div v-for="zone in zones" :key="'label-'+zone.id"
        class="zone-marker"
        :style="{ left: zone.x + '%', top: (zone.y - zone.radius - 2) + '%', color: zone.color, transform: `translate(-50%, -50%) scale(var(--marker-scale, 1))` }"
      >
        {{ zone.label }}
      </div>
      </template>

      <div class="habitat-ring" />

      <MapBuilding v-for="b in game.buildings" :key="b.id" :building="b" @select="selectBuilding" />
      <BuildingInfo
        v-if="selectedBuilding"
        :building="selectedBuilding"
        :x="selectedBuilding.x"
        :y="selectedBuilding.y"
      />
      <MapSupplyDrop v-for="d in game.supplyDrops" :key="d.id" :drop="d" />

      <MapColonist
        v-for="c in game.colonists"
        :key="c.id"
        :colonist="c"
        :x="getColonistState(c.id).targetX"
        :y="getColonistState(c.id).targetY"
        :visual-state="getColonistState(c.id).visualState"
        :transition-ms="getColonistState(c.id).transitionMs"
      />
    </div>

    <HazardAlert />
    <ResourceHud />

    <PauseButton />

    <div v-if="game.isPaused" class="pause-overlay">
      <span class="pause-text">PAUSED</span>
    </div>

    <div class="feed-indicator">
      <span class="feed-dot" />
      <span class="feed-text">LIVE</span>
    </div>

    <div v-if="settings.showFps" class="fps-counter">{{ fps }} FPS</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { Building } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useColonistMovement } from '@/composables/useColonistMovement'
import { ZONES, PATH_EDGES, ZONE_MAP } from '@/systems/mapLayout'
import HazardAlert from './HazardAlert.vue'
import ResourceHud from './ResourceHud.vue'
import PauseButton from './PauseButton.vue'
import MapBuilding from './MapBuilding.vue'
import MapColonist from './MapColonist.vue'
import MapSupplyDrop from './MapSupplyDrop.vue'
import BuildingInfo from './BuildingInfo.vue'

const game = useGameStore()
const settings = useSettingsStore()
const { positions, getOrCreate } = useColonistMovement()

const zones = ZONES
const pathEdges = PATH_EDGES.map(e => ({
  x1: ZONE_MAP[e.from].x,
  y1: ZONE_MAP[e.from].y,
  x2: ZONE_MAP[e.to].x,
  y2: ZONE_MAP[e.to].y,
}))

function getColonistState(id: string) {
  return positions.value.get(id) || getOrCreate(id)
}

const selectedBuilding = ref<Building | null>(null)

function selectBuilding(b: Building) {
  selectedBuilding.value = selectedBuilding.value?.id === b.id ? null : b
}

// Pan & Zoom
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const lastPointer = ref({ x: 0, y: 0 })

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

function resetView() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

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

onMounted(() => { fpsRaf = requestAnimationFrame(updateFps) })
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
    radial-gradient(ellipse at 20% 70%, rgba(15, 20, 35, 0.8) 0%, transparent 50%),
    radial-gradient(ellipse at 75% 25%, rgba(20, 25, 40, 0.7) 0%, transparent 45%),
    radial-gradient(ellipse at 45% 85%, rgba(25, 18, 30, 0.6) 0%, transparent 40%),
    radial-gradient(ellipse at 60% 40%, rgba(10, 15, 25, 0.5) 0%, transparent 55%),
    linear-gradient(170deg, #050810 0%, #080c18 40%, #0a0e1a 70%, #060a14 100%);
  box-shadow: inset 0 0 150px rgba(0, 0, 0, 0.7);
}

/* Subtle noise texture via repeating gradient */
.colony-map::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.4;
  background-image:
    radial-gradient(circle at 30% 20%, rgba(80, 120, 160, 0.04) 0%, transparent 2px),
    radial-gradient(circle at 70% 60%, rgba(80, 120, 160, 0.03) 0%, transparent 1.5px),
    radial-gradient(circle at 15% 80%, rgba(80, 120, 160, 0.03) 0%, transparent 1px),
    radial-gradient(circle at 85% 35%, rgba(80, 120, 160, 0.04) 0%, transparent 2px),
    radial-gradient(circle at 55% 10%, rgba(80, 120, 160, 0.02) 0%, transparent 1px);
  background-size:
    120px 120px,
    80px 80px,
    150px 150px,
    100px 100px,
    60px 60px;
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

.zone-marker {
  position: absolute;
  font-family: var(--font-mono);
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 0.18em;
  color: var(--accent-muted);
  pointer-events: none;
  z-index: 1;
}


.habitat-ring {
  position: absolute;
  left: 50%;
  top: 40%;
  width: 50px;
  height: 50px;
  transform: translate(-50%, -50%) scale(var(--marker-scale, 1));
  border-radius: 50%;
  border: 1px solid var(--accent-dim);
  box-shadow: 0 0 20px var(--accent-faint);
  pointer-events: none;
  z-index: 1;
}

.feed-indicator {
  position: absolute;
  top: calc(var(--safe-top) + 32px);
  right: 8px;
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
  font-size: 8px;
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

.zone-overlay.high-contrast line { opacity: 0.3; }
.zone-overlay.high-contrast circle { opacity: 0.35; stroke-width: 0.4; }

.reduce-animations .colonist-dot,
.reduce-animations .colonist-trail,
.reduce-animations .feed-dot {
  animation: none !important;
}

.fps-counter {
  position: absolute;
  bottom: 8px;
  left: 8px;
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  z-index: 9;
  pointer-events: none;
}

.pause-overlay {
  position: absolute;
  inset: 0;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--bg-deep) 50%, transparent);
  pointer-events: none;
}

.pause-text {
  font-family: var(--font-mono);
  font-size: 24px;
  color: var(--text-muted);
  letter-spacing: 8px;
  text-transform: uppercase;
  opacity: 0.6;
}
</style>
