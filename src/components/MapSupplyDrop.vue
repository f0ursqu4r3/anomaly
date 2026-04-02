<template>
  <div
    class="map-supply-drop"
    :class="[drop.state]"
    :style="{ left: drop.x + '%', top: drop.y + '%' }"
    @click.stop="emit('select', drop)"
  >
    <!-- Crate icon + progress ring wrapper -->
    <div class="drop-sprite">
      <svg v-if="drop.state === 'unpacking'" class="progress-ring" viewBox="0 0 36 36">
        <circle class="ring-bg" cx="18" cy="18" r="15" />
        <circle
          class="ring-fill"
          cx="18"
          cy="18"
          r="15"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="circumference * (1 - drop.unpackProgress)"
        />
      </svg>
      <SvgIcon name="shipment" size="sm" />
    </div>

    <!-- Label -->
    <div class="drop-label">{{ drop.contents.length }} items · {{ drop.totalWeight }}kg</div>
  </div>
</template>

<script setup lang="ts">
import type { SupplyDrop } from '@/stores/gameStore'
import SvgIcon from './SvgIcon.vue'

defineProps<{ drop: SupplyDrop }>()
const emit = defineEmits<{ select: [drop: SupplyDrop] }>()

const circumference = 2 * Math.PI * 15 // ~94.25
</script>

<style scoped>
.map-supply-drop {
  position: absolute;
  transform: translate(-50%, -50%) scale(var(--marker-scale, 1));
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: auto;
  cursor: pointer;
  z-index: 2;
}

.drop-sprite {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sprite-bg);
  border: 1.5px solid var(--purple-glow);
  color: var(--purple);
  position: relative;
  transition: all 0.2s;
}

/* Landed: pulsing glow to attract attention */
.landed .drop-sprite {
  box-shadow:
    0 0 12px var(--purple-glow),
    0 0 24px rgba(167, 139, 250, 0.1);
  animation: drop-pulse 1.2s ease-in-out infinite;
}

/* Unpacking: steady glow */
.unpacking .drop-sprite {
  box-shadow: 0 0 10px var(--purple-glow);
  border-color: var(--cyan-glow);
  color: var(--cyan);
}

/* Done: flash and fade */
.done .drop-sprite {
  animation: drop-done 0.8s ease forwards;
}

.drop-label {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  letter-spacing: 0.05em;
}

.done .drop-label {
  opacity: 0;
}

/* Progress ring */
.progress-ring {
  position: absolute;
  width: 36px;
  height: 36px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-90deg);
}

.ring-bg {
  fill: none;
  stroke: var(--accent-muted);
  stroke-width: 2;
}

.ring-fill {
  fill: none;
  stroke: var(--cyan);
  stroke-width: 2;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.3s ease;
}

@keyframes drop-pulse {
  0%,
  100% {
    box-shadow: 0 0 8px var(--purple-glow);
    transform: scale(1);
  }
  50% {
    box-shadow:
      0 0 18px var(--purple-glow),
      0 0 30px rgba(167, 139, 250, 0.1);
    transform: scale(1.08);
  }
}

@keyframes drop-done {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  30% {
    transform: scale(1.3);
    opacity: 1;
    box-shadow: 0 0 30px var(--cyan-glow);
  }
  100% {
    transform: scale(0.5);
    opacity: 0;
  }
}
</style>
