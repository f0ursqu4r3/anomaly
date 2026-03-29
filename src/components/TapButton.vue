<template>
  <div class="tap-container">
    <button class="tap-btn" :class="{ tapping }" @click="handleTap">
      <div class="tap-inner">
        <div class="tap-icon">&#x26CF;</div>
        <div class="tap-label">DRILL</div>
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

function handleTap() {
  game.tap()
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
  padding: 20px 0;
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
  transition: transform 0.1s ease;
}

.tap-btn:active {
  transform: scale(0.92) !important;
}

.tap-btn.tapping {
  border-color: var(--amber);
}

.tap-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
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

.tap-ripple {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid var(--amber);
  animation: tap-ripple 0.4s ease-out forwards;
  pointer-events: none;
}
</style>
