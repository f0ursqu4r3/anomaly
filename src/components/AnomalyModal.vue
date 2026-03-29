<template>
  <div class="anomaly-overlay" @click.self="resolveAnomaly">
    <div class="anomaly-card">
      <div class="anomaly-tag">⚠ ANOMALY DETECTED</div>
      <h2>{{ game.activeAnomaly?.title }}</h2>
      <p>{{ game.activeAnomaly?.description }}</p>

      <div class="reward-preview">
        <span v-if="game.activeAnomaly?.reward.ore">+{{ fmt(game.activeAnomaly.reward.ore) }} ore</span>
        <span v-if="game.activeAnomaly?.reward.crystals">+{{ fmt(game.activeAnomaly.reward.crystals) }} crystals</span>
        <span v-if="game.activeAnomaly?.reward.data">+{{ fmt(game.activeAnomaly.reward.data) }} data</span>
      </div>

      <button class="resolve-btn" @click="resolveAnomaly">
        Investigate
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'
import { fmtNumber } from '@/utils/format'

const game = useGameStore()
const fmt = fmtNumber

function resolveAnomaly() {
  game.resolveAnomaly()
}
</script>

<style scoped>
.anomaly-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.anomaly-card {
  background: #1a1a2e;
  border: 1px solid #e94560;
  border-radius: 12px;
  padding: 2rem;
  max-width: 320px;
  width: 90%;
  text-align: center;
  color: #fff;
}

.anomaly-tag {
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  color: #e94560;
  margin-bottom: 0.75rem;
}

h2 {
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
}

p {
  font-size: 0.9rem;
  color: #aaa;
  margin-bottom: 1.25rem;
}

.reward-preview {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.reward-preview span {
  background: rgba(255,255,255,0.07);
  border-radius: 99px;
  padding: 0.25rem 0.75rem;
  font-size: 0.8rem;
  color: #7ecfff;
}

.resolve-btn {
  background: #e94560;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 2rem;
  font-size: 1rem;
  cursor: pointer;
  width: 100%;
}

.resolve-btn:active {
  opacity: 0.85;
}
</style>
