<template>
  <div class="colony-map">
    <!-- Scan line overlay -->
    <div class="scanlines" />

    <!-- Zone markers -->
    <div class="zone-marker" style="left: 50%; top: 38%">SEC-A: HAB</div>
    <div class="zone-marker" style="left: 28%; top: 18%">SEC-B: POWER</div>
    <div class="zone-marker" style="left: 72%; top: 18%">SEC-C: LIFE SUP</div>
    <div class="zone-marker" style="left: 50%; top: 70%">SEC-D: DRILL</div>
    <div class="zone-marker" style="left: 72%; top: 50%">SEC-E: MED</div>

    <!-- Terrain craters -->
    <div class="crater" style="left: 15%; top: 55%; width: 40px; height: 40px" />
    <div class="crater" style="left: 85%; top: 75%; width: 25px; height: 25px" />
    <div class="crater" style="left: 40%; top: 15%; width: 30px; height: 30px" />
    <div class="crater" style="left: 60%; top: 65%; width: 20px; height: 20px" />
    <div class="crater" style="left: 10%; top: 30%; width: 18px; height: 18px" />
    <div class="crater" style="left: 90%; top: 40%; width: 22px; height: 22px" />
    <div class="crater sm" style="left: 35%; top: 85%; width: 14px; height: 14px" />
    <div class="crater sm" style="left: 75%; top: 88%; width: 12px; height: 12px" />

    <!-- Habitat ring -->
    <div class="habitat-ring" />

    <!-- Buildings -->
    <MapBuilding v-for="b in game.buildings" :key="b.id" :building="b" />

    <!-- Supply drops -->
    <MapSupplyDrop v-for="d in game.supplyDrops" :key="d.id" :drop="d" />

    <!-- Colonists -->
    <MapColonist
      v-for="c in game.colonists"
      :key="c.id"
      :colonist="c"
      :x="getColonistState(c.id).x"
      :y="getColonistState(c.id).y"
      :state="getColonistState(c.id).state"
      :transition-ms="getColonistState(c.id).transitionMs"
    />

    <!-- Hazard alert (scoped to map) -->
    <HazardAlert />

    <!-- HUD -->
    <ResourceHud />

    <!-- Live feed indicator -->
    <div class="feed-indicator">
      <span class="feed-dot" />
      <span class="feed-text">LIVE</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'
import { useColonistMovement } from '@/composables/useColonistMovement'
import HazardAlert from './HazardAlert.vue'
import ResourceHud from './ResourceHud.vue'
import MapBuilding from './MapBuilding.vue'
import MapColonist from './MapColonist.vue'
import MapSupplyDrop from './MapSupplyDrop.vue'

const game = useGameStore()
const { positions, getOrCreate } = useColonistMovement()

function getColonistState(id: string) {
  return positions.value.get(id) || getOrCreate(id)
}
</script>

<style scoped>
.colony-map {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
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
  transform: translate(-50%, -50%);
  font-family: var(--font-mono);
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 0.18em;
  color: var(--accent-muted);
  pointer-events: none;
  z-index: 1;
}

.crater {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1px solid rgba(80, 120, 180, 0.06);
  background: radial-gradient(circle, rgba(0, 0, 0, 0.2) 30%, transparent 70%);
  box-shadow:
    inset 1px 1px 3px rgba(0, 0, 0, 0.3),
    0 0 6px rgba(80, 120, 180, 0.02);
  pointer-events: none;
}

.crater.sm {
  border-color: rgba(80, 120, 180, 0.04);
}

.habitat-ring {
  position: absolute;
  left: 50%;
  top: 45%;
  width: 50px;
  height: 50px;
  transform: translate(-50%, -50%);
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
</style>
