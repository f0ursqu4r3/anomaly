<template>
  <Transition name="hazard">
    <div v-if="game.lastHazard" class="hazard-toast" @click="game.clearHazard()">
      <div class="hazard-icon">&#x26A0;</div>
      <div class="hazard-info">
        <div class="hazard-title">{{ game.lastHazard.title }}</div>
        <div class="hazard-detail">
          Hull -{{ game.lastHazard.hullDamage }}
          <span v-if="game.lastHazard.staminaHit"> · Crew stamina hit</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()

watch(() => game.lastHazard, (hazard) => {
  if (hazard) {
    setTimeout(() => game.clearHazard(), 3000)
  }
})
</script>

<style scoped>
.hazard-toast {
  position: fixed;
  top: calc(12px + var(--safe-top));
  left: 16px;
  right: 16px;
  padding: 10px 14px;
  background: #2a0a0a;
  border: 1px solid var(--red);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 850;
  box-shadow: 0 4px 20px rgba(233, 69, 96, 0.3);
  animation: shake 0.3s ease-in-out;
}

.hazard-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.hazard-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--red);
}

.hazard-detail {
  font-size: 0.65rem;
  color: var(--text-secondary);
}

.hazard-enter-active {
  animation: achievement-in 0.3s ease-out;
}

.hazard-leave-active {
  animation: achievement-out 0.3s ease-in forwards;
}
</style>
