<template>
  <div class="hull-bar" :class="{ emergency: game.hullIntegrity < 20 }">
    <div class="hull-label">HULL</div>
    <div class="hull-track">
      <div class="hull-fill" :style="{ width: game.hullIntegrity + '%' }"></div>
    </div>
    <div class="hull-value mono">{{ game.hullIntegrity }}%</div>
    <button
      v-if="game.hullIntegrity < 75"
      class="hull-repair"
      @click="game.repairHull()"
    >
      FIX
    </button>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()
</script>

<style scoped>
.hull-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.hull-bar.emergency {
  border-color: var(--red);
  animation: pulse-glow 1.5s ease-in-out infinite;
  --amber-glow: var(--red-glow);
}

.hull-label {
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  flex-shrink: 0;
}

.hull-track {
  flex: 1;
  height: 6px;
  background: var(--bg-deep);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.hull-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.5s ease-out;
  background: var(--green);
}

.hull-bar.emergency .hull-fill {
  background: var(--red);
}

.hull-value {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
  width: 30px;
  text-align: right;
}

.hull-repair {
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 4px 8px;
  min-height: 28px;
  background: var(--amber);
  color: #000;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.hull-repair:active {
  background: var(--amber-dim);
  transform: scale(0.93);
}
</style>
