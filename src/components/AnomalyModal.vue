<template>
  <div class="anomaly-overlay">
    <div class="anomaly-card">
      <div class="anomaly-tag">&#x26A0; ANOMALY DETECTED</div>
      <h2>{{ game.activeAnomaly?.title }}</h2>
      <p>{{ game.activeAnomaly?.description }}</p>

      <!-- Choice cards -->
      <div class="choices">
        <button
          v-for="(choice, i) in game.activeAnomaly?.choices"
          :key="i"
          class="choice-card"
          @click="makeChoice(i)"
        >
          <div class="choice-label">{{ choice.label }}</div>
          <div class="choice-desc">{{ choice.description }}</div>
          <div class="choice-meta">
            <div class="choice-risk" v-if="choice.risk > 0">
              <div class="risk-bar">
                <div class="risk-fill" :style="{ width: (choice.risk * 100) + '%' }"></div>
              </div>
              <span class="risk-text mono">{{ Math.round((1 - choice.risk) * 100) }}% safe</span>
            </div>
            <span v-else class="risk-safe mono">100% safe</span>
            <div class="choice-rewards">
              <span v-if="choice.reward.ore" class="reward-chip">+{{ fmt(choice.reward.ore) }} ore</span>
              <span v-if="choice.reward.crystals" class="reward-chip crystal">+{{ fmt(choice.reward.crystals) }} crystals</span>
              <span v-if="choice.reward.data" class="reward-chip data">+{{ fmt(choice.reward.data) }} data</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'
import { fmtNumber } from '@/utils/format'

const game = useGameStore()
const fmt = fmtNumber

function makeChoice(index: number) {
  game.resolveAnomalyChoice(index)
}
</script>

<style scoped>
.anomaly-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.anomaly-card {
  background: var(--bg-primary);
  border: 1px solid var(--red);
  border-radius: 16px;
  padding: 20px;
  max-width: 360px;
  width: 100%;
  text-align: center;
  color: #fff;
}

.anomaly-tag {
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  color: var(--red);
  margin-bottom: 8px;
}

h2 {
  font-size: 1.1rem;
  margin-bottom: 6px;
}

p {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 16px;
  line-height: 1.4;
}

.choices {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.choice-card {
  text-align: left;
  padding: 12px;
  background: var(--bg-surface);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  transition: border-color 0.15s, background 0.15s;
  min-height: 44px;
  touch-action: manipulation;
}

.choice-card:active {
  background: var(--bg-elevated);
  border-color: var(--amber-dim);
  transform: scale(0.98);
}

.choice-label {
  font-size: 0.85rem;
  font-weight: 700;
  margin-bottom: 2px;
}

.choice-desc {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.choice-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.choice-risk {
  display: flex;
  align-items: center;
  gap: 6px;
}

.risk-bar {
  flex: 1;
  height: 4px;
  background: rgba(52, 211, 153, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.risk-fill {
  height: 100%;
  background: var(--red);
  border-radius: 2px;
}

.risk-text {
  font-size: 0.6rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

.risk-safe {
  font-size: 0.6rem;
  color: var(--green);
}

.choice-rewards {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.reward-chip {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(245, 158, 11, 0.12);
  color: var(--amber);
}

.reward-chip.crystal { background: rgba(126, 207, 255, 0.12); color: var(--cyan); }
.reward-chip.data { background: rgba(167, 139, 250, 0.12); color: var(--purple); }
</style>
