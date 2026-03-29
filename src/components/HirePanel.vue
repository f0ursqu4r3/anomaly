<template>
  <div class="hire-panel">
    <div v-for="option in hireOptions" :key="option.role" class="hire-card">
      <div class="hire-icon">{{ option.icon }}</div>
      <div class="hire-info">
        <div class="hire-role">{{ option.label }}</div>
        <div class="hire-desc">{{ option.desc }}</div>
      </div>
      <button
        class="hire-btn"
        :class="{ affordable: game.resources.ore >= option.cost }"
        :disabled="game.resources.ore < option.cost"
        @click="game.hireCrew(option.role, option.cost)"
      >
        <span class="hire-cost mono">{{ fmtNumber(option.cost) }}</span>
        <span class="hire-label">ore</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { CrewRole } from '@/stores/gameStore'
import { fmtNumber } from '@/utils/format'

const game = useGameStore()

function crewCost(role: CrewRole): number {
  const count = game.crew.filter(c => c.role === role).length
  return Math.floor(50 * Math.pow(2.5, count))
}

const hireOptions = computed(() => [
  { role: 'driller' as CrewRole, icon: '\u26CF', label: 'Driller', desc: 'Digs deeper, faster', cost: crewCost('driller') },
  { role: 'refiner' as CrewRole, icon: '\u2697', label: 'Refiner', desc: 'Converts ore to crystals', cost: crewCost('refiner') },
  { role: 'researcher' as CrewRole, icon: '\uD83D\uDD2C', label: 'Researcher', desc: 'Generates research data', cost: crewCost('researcher') },
])
</script>

<style scoped>
.hire-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hire-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.hire-icon {
  font-size: 1.3rem;
  width: 32px;
  text-align: center;
  flex-shrink: 0;
}

.hire-info {
  flex: 1;
  min-width: 0;
}

.hire-role {
  font-size: 0.85rem;
  font-weight: 600;
}

.hire-desc {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.hire-btn {
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

.hire-btn.affordable {
  background: var(--amber);
  color: #000;
}

.hire-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

.hire-cost {
  font-size: 0.8rem;
  font-weight: 700;
}

.hire-label {
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
</style>
