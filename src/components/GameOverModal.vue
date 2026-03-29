<template>
  <Transition name="modal">
    <div v-if="game.gameOver" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-icon">
          <SvgIcon name="skull" size="xl" />
        </div>
        <h2 class="modal-title">Colony Lost</h2>
        <p class="modal-reason">{{ game.gameOverReason }}</p>
        <div class="modal-stats">
          <div class="stat">
            <span class="stat-label">MAX DEPTH</span>
            <span class="stat-value mono">{{ fmtDepth(game.maxDepth) }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">SURVIVED</span>
            <span class="stat-value mono">{{ fmtDuration(game.totalPlaytimeMs) }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">CREDITS</span>
            <span class="stat-value mono">${{ Math.floor(game.totalCreditsEarned) }}</span>
          </div>
        </div>
        <button class="restart-btn" @click="game.resetGame()">
          Try Again
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'
import { fmtDepth, fmtDuration } from '@/utils/format'
import SvgIcon from './SvgIcon.vue'

const game = useGameStore()
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.modal-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 32px 24px;
  text-align: center;
  max-width: 320px;
  width: 100%;
  animation: slide-up 0.3s ease;
  border: 1px solid rgba(233, 69, 96, 0.2);
}

.modal-icon {
  color: var(--red);
  margin-bottom: 8px;
}

.modal-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--red);
  margin-bottom: 8px;
}

.modal-reason {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.modal-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 24px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 9px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.restart-btn {
  width: 100%;
  padding: 14px;
  font-size: 16px;
  font-weight: 700;
  background: var(--cyan);
  color: var(--bg-deep);
  border-radius: var(--radius-md);
}

.modal-enter-active { animation: slide-up 0.3s ease; }
.modal-leave-active { animation: slide-up 0.3s ease reverse forwards; }
</style>
