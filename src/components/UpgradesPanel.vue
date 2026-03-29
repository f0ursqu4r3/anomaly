<template>
  <div class="upgrades-panel">
    <div class="upgrade-card" v-for="upgrade in game.upgrades" :key="upgrade.id">
      <div class="upgrade-info">
        <div class="upgrade-name">{{ upgrade.name }}</div>
        <div class="upgrade-desc">{{ upgrade.description }}</div>
      </div>
      <button
        v-if="!upgrade.purchased"
        class="upgrade-btn"
        :class="{ affordable: canAfford(upgrade) }"
        :disabled="!canAfford(upgrade)"
        @click="game.purchaseUpgrade(upgrade.id)"
      >
        <span class="upgrade-cost mono">{{ fmtNumber(upgrade.cost) }}</span>
        <span class="upgrade-resource">{{ upgrade.costResource }}</span>
      </button>
      <div v-else class="upgrade-owned">OWNED</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'
import type { Upgrade } from '@/stores/gameStore'
import { fmtNumber } from '@/utils/format'

const game = useGameStore()

function canAfford(upgrade: Upgrade): boolean {
  return game.resources[upgrade.costResource] >= upgrade.cost
}
</script>

<style scoped>
.upgrades-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.upgrade-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.upgrade-info {
  flex: 1;
  min-width: 0;
}

.upgrade-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.upgrade-desc {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-top: 1px;
}

.upgrade-btn {
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  transition: background 0.2s, color 0.2s;
}

.upgrade-btn.affordable {
  background: var(--amber);
  color: #000;
}

.upgrade-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

.upgrade-cost {
  font-size: 0.8rem;
  font-weight: 700;
}

.upgrade-resource {
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.upgrade-owned {
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  color: var(--green);
  font-weight: 600;
  padding: 6px 12px;
}
</style>
