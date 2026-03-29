<template>
  <div class="tap-container">
    <button
      class="tap-btn"
      :class="[
        { tapping, shaking: game.comboCount >= 5 && game.comboActive },
        'zone-' + game.depthZone,
      ]"
      @click="handleTap"
    >
      <div class="tap-inner">
        <div class="tap-icon">&#x26CF;</div>
        <div class="tap-label">DRILL</div>
        <div v-if="game.comboCount > 1 && game.comboActive" class="tap-combo mono">
          {{ game.comboMultiplier.toFixed(1) }}x
        </div>
      </div>
      <div v-if="tapping" class="tap-ripple"></div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()
const tapping = ref(false)
let tapTimeout: ReturnType<typeof setTimeout> | null = null

const emit = defineEmits<{ tap: [depthGain: number] }>()

function handleTap() {
  const gain = game.tap()
  emit('tap', gain)
  tapping.value = true
  if (tapTimeout) clearTimeout(tapTimeout)
  tapTimeout = setTimeout(() => {
    tapping.value = false
  }, 200)
}
</script>

<style scoped>
.tap-container {
  display: flex;
  justify-content: center;
}

.tap-btn {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(145deg, var(--bg-elevated), var(--bg-surface));
  border: 2px solid var(--amber-dim);
  color: var(--amber);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pulse-glow 3s ease-in-out infinite;
  transition: transform 0.1s ease, border-color 0.3s, box-shadow 0.3s;
}

/* Zone-specific glow colors */
.tap-btn.zone-surface { --glow-color: rgba(180, 140, 80, 0.25); }
.tap-btn.zone-rock { --glow-color: rgba(100, 130, 180, 0.25); }
.tap-btn.zone-crystal { --glow-color: rgba(167, 139, 250, 0.3); border-color: rgba(167, 139, 250, 0.4); color: var(--purple); }
.tap-btn.zone-magma { --glow-color: rgba(233, 69, 96, 0.3); border-color: rgba(233, 69, 96, 0.4); color: var(--red); }
.tap-btn.zone-void { --glow-color: rgba(126, 207, 255, 0.3); border-color: rgba(126, 207, 255, 0.4); color: var(--cyan); }

.tap-btn:active {
  transform: scale(0.92) !important;
}

.tap-btn.tapping {
  border-color: var(--amber);
}

.tap-btn.shaking {
  animation: pulse-glow 3s ease-in-out infinite, shake 0.15s ease-in-out infinite;
}

.tap-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  z-index: 1;
}

.tap-icon {
  font-size: 2rem;
}

.tap-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  font-family: var(--font-mono);
}

.tap-combo {
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--green);
  margin-top: -2px;
}

.tap-ripple {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid var(--amber);
  animation: tap-ripple 0.4s ease-out forwards;
  pointer-events: none;
}
</style>
