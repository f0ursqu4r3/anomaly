<template>
  <div class="artifacts-panel">
    <div class="artifacts-header">
      <span class="artifacts-count mono">{{ game.artifactCount }}/{{ game.artifacts.length }}</span>
      <span class="artifacts-label">artifacts discovered</span>
    </div>

    <div class="rarity-section" v-for="rarity in rarities" :key="rarity">
      <div class="rarity-label" :class="'rarity-' + rarity">{{ rarity }}</div>
      <div class="artifacts-grid">
        <div
          v-for="a in artifactsByRarity(rarity)"
          :key="a.id"
          class="artifact-card"
          :class="{ found: a.found, ['rarity-' + a.rarity]: a.found }"
        >
          <div class="artifact-icon">{{ a.found ? a.icon : '\uD83D\uDD12' }}</div>
          <div class="artifact-info">
            <div class="artifact-name">{{ a.found ? a.name : '???' }}</div>
            <div class="artifact-desc">{{ a.found ? a.description : 'Undiscovered' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()
const rarities = ['legendary', 'rare', 'common'] as const

function artifactsByRarity(rarity: string) {
  return game.artifacts.filter(a => a.rarity === rarity)
}
</script>

<style scoped>
.artifacts-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.artifacts-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.artifacts-count {
  font-size: 0.85rem;
  color: var(--amber);
  font-weight: 700;
}

.artifacts-label {
  font-size: 0.65rem;
  color: var(--text-muted);
}

.rarity-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rarity-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.rarity-label.rarity-common { color: var(--text-muted); }
.rarity-label.rarity-rare { color: var(--cyan); }
.rarity-label.rarity-legendary { color: var(--amber); }

.artifacts-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.artifact-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.04);
  opacity: 0.35;
  filter: grayscale(1);
}

.artifact-card.found {
  opacity: 1;
  filter: none;
}

.artifact-card.found.rarity-rare { border-color: rgba(126, 207, 255, 0.2); }
.artifact-card.found.rarity-legendary { border-color: rgba(245, 158, 11, 0.3); background: linear-gradient(135deg, rgba(245, 158, 11, 0.05), var(--bg-surface)); }

.artifact-icon {
  font-size: 1.2rem;
  width: 28px;
  text-align: center;
  flex-shrink: 0;
}

.artifact-info { flex: 1; min-width: 0; }

.artifact-name {
  font-size: 0.8rem;
  font-weight: 600;
}

.artifact-desc {
  font-size: 0.65rem;
  color: var(--text-secondary);
}
</style>
