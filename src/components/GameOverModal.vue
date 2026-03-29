<template>
  <div v-if="game.gameOver" class="gameover-overlay">
    <div class="gameover-card">
      <div class="gameover-icon">&#x1F4A5;</div>
      <h2>HULL DESTROYED</h2>
      <p>Your station couldn't withstand the pressure. The hull collapsed at {{ fmtDepth(game.depth) }}.</p>

      <div class="gameover-stats">
        <div class="stat">
          <span class="stat-label">Depth reached</span>
          <span class="stat-value mono">{{ fmtDepth(game.depth) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Crew survived</span>
          <span class="stat-value mono">{{ game.crew.length }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Resources lost</span>
          <span class="stat-value mono lost">50%</span>
        </div>
      </div>

      <button class="restart-btn" @click="game.gameOverRestart()">
        RESTART RUN
      </button>
      <p class="restart-hint">Your crew and artifacts are preserved. Half your starting ore is lost.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'
import { fmtDepth } from '@/utils/format'

const game = useGameStore()
</script>

<style scoped>
.gameover-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 16px;
}

.gameover-card {
  background: linear-gradient(135deg, #1a0808, #1a1a2e);
  border: 2px solid var(--red);
  border-radius: 20px;
  padding: 28px 24px;
  max-width: 340px;
  width: 100%;
  text-align: center;
  color: #fff;
  box-shadow: 0 0 60px rgba(233, 69, 96, 0.3);
}

.gameover-icon {
  font-size: 3rem;
  margin-bottom: 8px;
}

h2 {
  font-size: 1.2rem;
  letter-spacing: 0.15em;
  color: var(--red);
  margin-bottom: 8px;
  font-family: var(--font-mono);
}

p {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 16px;
}

.gameover-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 20px;
}

.stat {
  display: flex;
  justify-content: space-between;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius-sm);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.stat-value {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
}

.stat-value.lost {
  color: var(--red);
}

.restart-btn {
  width: 100%;
  padding: 14px;
  border-radius: var(--radius-md);
  background: var(--red);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  font-family: var(--font-mono);
  touch-action: manipulation;
  transition: background 0.15s, transform 0.1s;
}

.restart-btn:active {
  background: #c4354e;
  transform: scale(0.96);
}

.restart-hint {
  font-size: 0.65rem;
  color: var(--text-muted);
  margin-top: 10px;
  margin-bottom: 0;
}
</style>
