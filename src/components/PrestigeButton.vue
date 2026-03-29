<template>
  <div v-if="game.canPrestige" class="prestige-section">
    <div class="prestige-card">
      <div class="prestige-header">PRESTIGE AVAILABLE</div>
      <p class="prestige-desc">Reset your run and gain permanent bonuses based on depth reached.</p>
      <div class="prestige-bonuses">
        <div class="bonus-item">
          <span class="bonus-label">Drill Speed</span>
          <span class="bonus-value mono">+{{ drillBonus }}%</span>
        </div>
        <div class="bonus-item">
          <span class="bonus-label">Offline Cap</span>
          <span class="bonus-value mono">+1h</span>
        </div>
        <div class="bonus-item">
          <span class="bonus-label">Starting Ore</span>
          <span class="bonus-value mono">+{{ startingOre }}</span>
        </div>
      </div>
      <button v-if="!confirming" class="prestige-btn" @click="confirming = true">
        PRESTIGE
      </button>
      <div v-else class="prestige-confirm">
        <p class="confirm-warn">This will reset your current run!</p>
        <div class="confirm-actions">
          <button class="confirm-yes" @click="doPrestige">CONFIRM</button>
          <button class="confirm-no" @click="confirming = false">CANCEL</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()
const confirming = ref(false)

const drillBonus = computed(() => {
  const depthBonus = Math.floor(game.depth / 500)
  return depthBonus * 10
})

const startingOre = computed(() => {
  const depthBonus = Math.floor(game.depth / 500)
  return depthBonus * 10
})

function doPrestige() {
  game.prestige()
  confirming.value = false
}
</script>

<style scoped>
.prestige-section {
  margin-bottom: 6px;
}

.prestige-card {
  padding: 16px;
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.08), rgba(233, 69, 96, 0.08));
  border: 1px solid var(--purple);
  border-radius: var(--radius-lg);
  text-align: center;
}

.prestige-header {
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  color: var(--purple);
  font-weight: 700;
  margin-bottom: 6px;
}

.prestige-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.prestige-bonuses {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 14px;
}

.bonus-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.bonus-label {
  font-size: 0.6rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.bonus-value {
  font-size: 0.85rem;
  color: var(--green);
  font-weight: 600;
}

.prestige-btn {
  width: 100%;
  padding: 12px;
  border-radius: var(--radius-md);
  background: var(--purple);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  transition: background 0.15s, transform 0.1s;
}

.prestige-btn:active {
  background: #8b6fe0;
  transform: scale(0.96);
}

.confirm-warn {
  font-size: 0.8rem;
  color: var(--red);
  margin-bottom: 10px;
  font-weight: 600;
}

.confirm-actions {
  display: flex;
  gap: 8px;
}

.confirm-yes {
  flex: 1;
  padding: 12px;
  border-radius: var(--radius-md);
  background: var(--red);
  color: #fff;
  font-weight: 700;
  font-size: 0.8rem;
  transition: background 0.15s, transform 0.1s;
}

.confirm-yes:active {
  background: #c4354e;
  transform: scale(0.96);
}

.confirm-no {
  flex: 1;
  padding: 12px;
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.8rem;
  transition: background 0.15s, transform 0.1s;
}

.confirm-no:active {
  background: var(--bg-surface);
  transform: scale(0.96);
}
</style>
