<template>
  <Transition name="milestone">
    <div v-if="visible" class="milestone-overlay" :key="milestoneDepth">
      <div class="milestone-content">
        <div class="milestone-depth mono">{{ milestoneDepth }}m</div>
        <div class="milestone-label">MILESTONE REACHED</div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()
const visible = ref(false)
const milestoneDepth = ref(0)
let hideTimeout: ReturnType<typeof setTimeout> | null = null

watch(() => game.lastMilestoneDepth, (depth) => {
  if (depth !== null) {
    milestoneDepth.value = depth
    visible.value = true
    if (hideTimeout) clearTimeout(hideTimeout)
    hideTimeout = setTimeout(() => {
      visible.value = false
    }, 2500)
  }
})
</script>

<style scoped>
.milestone-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 800;
  background: radial-gradient(ellipse, rgba(245, 158, 11, 0.08) 0%, transparent 60%);
}

.milestone-content {
  text-align: center;
  animation: milestone-flash 2.5s ease-out forwards;
}

.milestone-depth {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--amber);
  text-shadow: 0 0 30px var(--amber-glow), 0 0 60px var(--amber-glow);
  line-height: 1;
}

.milestone-label {
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  color: var(--text-secondary);
  margin-top: 6px;
}

.milestone-enter-active {
  transition: opacity 0.3s ease;
}

.milestone-leave-active {
  transition: opacity 0.5s ease;
}

.milestone-enter-from,
.milestone-leave-to {
  opacity: 0;
}
</style>
