<template>
  <div class="depth-bg" :class="'zone-' + game.depthZone">
    <!-- Drifting particles -->
    <div class="particles">
      <div v-for="i in 12" :key="i" class="particle" :style="particleStyle(i)"></div>
    </div>

    <!-- Zone transition label -->
    <Transition name="zone-label">
      <div v-if="showZoneLabel" class="zone-label" :key="currentZoneName">
        <span class="zone-entering">ENTERING</span>
        <span class="zone-name">{{ currentZoneName }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()

const showZoneLabel = ref(false)
const currentZoneName = computed(() => game.depthZoneName)
let zoneTimeout: ReturnType<typeof setTimeout> | null = null

watch(() => game.depthZone, (newZone, oldZone) => {
  if (newZone !== oldZone && oldZone !== undefined) {
    showZoneLabel.value = true
    if (zoneTimeout) clearTimeout(zoneTimeout)
    zoneTimeout = setTimeout(() => {
      showZoneLabel.value = false
    }, 3000)
  }
})

function particleStyle(i: number): Record<string, string> {
  const left = (i * 8.3 + (i % 3) * 2.7) % 100
  const delay = (i * 1.3) % 8
  const duration = 6 + (i % 5) * 2
  const size = 1 + (i % 3)
  return {
    left: left + '%',
    animationDelay: delay + 's',
    animationDuration: duration + 's',
    width: size + 'px',
    height: size + 'px',
  }
}
</script>

<style scoped>
.depth-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transition: background 2s ease;
  z-index: 0;
}

.zone-surface {
  background: radial-gradient(ellipse at 50% 30%, #1a1510 0%, var(--bg-deep) 70%);
}

.zone-rock {
  background: radial-gradient(ellipse at 50% 30%, #0f1520 0%, var(--bg-deep) 70%);
}

.zone-crystal {
  background: radial-gradient(ellipse at 50% 40%, #150a20 0%, var(--bg-deep) 70%);
}

.zone-magma {
  background: radial-gradient(ellipse at 50% 50%, #200a0a 0%, var(--bg-deep) 70%);
}

.zone-void {
  background: radial-gradient(ellipse at 50% 50%, #050810 0%, #000005 70%);
}

/* Particles */
.particles {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.particle {
  position: absolute;
  top: -10px;
  border-radius: 50%;
  opacity: 0;
  animation: zone-particle 8s linear infinite;
}

.zone-surface .particle { background: rgba(180, 140, 80, 0.3); }
.zone-rock .particle { background: rgba(100, 130, 180, 0.3); }
.zone-crystal .particle { background: rgba(167, 139, 250, 0.4); }
.zone-magma .particle { background: rgba(233, 69, 96, 0.4); }
.zone-void .particle { background: rgba(126, 207, 255, 0.3); }

/* Zone label */
.zone-label {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.zone-entering {
  font-size: 0.55rem;
  letter-spacing: 0.25em;
  color: var(--text-muted);
}

.zone-name {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-primary);
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.15);
}

.zone-label-enter-active {
  animation: milestone-flash 3s ease-out forwards;
}

.zone-label-leave-active {
  transition: opacity 0.5s ease;
}

.zone-label-leave-to {
  opacity: 0;
}
</style>
