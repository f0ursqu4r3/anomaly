<template>
  <Transition name="hazard">
    <div v-if="game.lastHazard" class="hazard-alert">
      <SvgIcon :name="iconFor(game.lastHazard.type)" size="md" />
      <div class="hazard-message">{{ game.lastHazard.message }}</div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { HazardEvent } from '@/stores/gameStore'
import SvgIcon from './SvgIcon.vue'

const game = useGameStore()

function iconFor(type: HazardEvent['type']): string {
  const map: Record<string, string> = {
    meteor: 'hazard-meteor',
    powersurge: 'hazard-surge',
    gaspocket: 'hazard-gas',
  }
  return map[type] || 'emergency'
}

watch(
  () => game.lastHazard,
  (h) => {
    if (h) setTimeout(() => game.dismissHazard(), 3000)
  },
)
</script>

<style scoped>
.hazard-alert {
  position: absolute;
  top: calc(var(--safe-top) + 40px);
  left: 12px;
  right: 12px;
  z-index: 10;
  background: var(--red);
  backdrop-filter: blur(8px);
  border-radius: var(--radius-md);
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  animation: shake 0.4s ease;
  pointer-events: none;
  color: var(--text-primary);
}

.hazard-message {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-primary);
}

.hazard-enter-active {
  animation: toast-in 0.3s ease;
}
.hazard-leave-active {
  animation: toast-out 0.3s ease forwards;
}
</style>
