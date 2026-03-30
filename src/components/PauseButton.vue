<template>
  <button class="pause-btn" @click="game.togglePause()" :aria-label="game.isPaused ? 'Resume' : 'Pause'">
    <svg viewBox="0 0 16 16" fill="none" class="pause-icon">
      <template v-if="game.isPaused">
        <path d="M4 2.5L13 8L4 13.5V2.5Z" fill="currentColor" />
      </template>
      <template v-else>
        <rect x="3" y="2" width="3.5" height="12" rx="0.8" fill="currentColor" />
        <rect x="9.5" y="2" width="3.5" height="12" rx="0.8" fill="currentColor" />
      </template>
    </svg>
  </button>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'
const game = useGameStore()
</script>

<style scoped>
.pause-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  z-index: 15;
  width: 44px;
  aspect-ratio: 1;
  border-radius: var(--radius-full);
  border: 1px solid var(--accent-muted);
  background: var(--overlay-bg);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.pause-btn:active {
  background: var(--accent-dim);
}

.pause-icon {
  width: 14px;
  height: 14px;
}
</style>
