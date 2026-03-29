<template>
  <div v-if="game.pathChoicePending" class="path-overlay">
    <div class="path-card">
      <div class="path-tag">&#x1F6E4; PATH DIVERGENCE</div>
      <h2>Choose Your Route</h2>
      <p>The tunnel branches ahead. Where do you drill next?</p>

      <div class="path-options">
        <button
          v-for="path in game.pathOptions"
          :key="path.id"
          class="path-option"
          @click="game.choosePath(path.id)"
        >
          <div class="path-name">{{ path.name }}</div>
          <div class="path-desc">{{ path.description }}</div>

          <div v-if="path.scouted" class="path-modifiers">
            <span class="mod" :class="modClass(path.modifiers.drillSpeedMult)">
              &#x26CF; {{ modLabel(path.modifiers.drillSpeedMult) }} speed
            </span>
            <span class="mod" :class="modClass(path.modifiers.oreBonus)">
              &#x1FAA8; {{ modLabel(path.modifiers.oreBonus) }} ore
            </span>
            <span class="mod" :class="modClass(path.modifiers.crystalBonus)">
              &#x1F48E; {{ modLabel(path.modifiers.crystalBonus) }} crystals
            </span>
            <span class="mod" :class="dangerClass(path.modifiers.hazardRate)">
              &#x26A0; {{ dangerLabel(path.modifiers.hazardRate) }}
            </span>
          </div>
          <div v-else class="path-unscouted">
            <span class="unscouted-text">Details obscured — assign scouts to reveal</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()

function modLabel(mult: number): string {
  if (mult >= 1.3) return '\u2B06\u2B06'
  if (mult >= 1.1) return '\u2B06'
  if (mult <= 0.7) return '\u2B07\u2B07'
  if (mult <= 0.9) return '\u2B07'
  return '\u2796'
}

function modClass(mult: number): string {
  if (mult >= 1.1) return 'mod-good'
  if (mult <= 0.9) return 'mod-bad'
  return 'mod-neutral'
}

function dangerLabel(rate: number): string {
  if (rate >= 1.8) return 'Extreme'
  if (rate >= 1.3) return 'High'
  if (rate <= 0.5) return 'Safe'
  if (rate <= 0.8) return 'Low'
  return 'Moderate'
}

function dangerClass(rate: number): string {
  if (rate >= 1.3) return 'mod-bad'
  if (rate <= 0.8) return 'mod-good'
  return 'mod-neutral'
}
</script>

<style scoped>
.path-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.path-card {
  background: var(--bg-primary);
  border: 1px solid var(--cyan);
  border-radius: 16px;
  padding: 20px;
  max-width: 360px;
  width: 100%;
  text-align: center;
  color: #fff;
}

.path-tag {
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  color: var(--cyan);
  margin-bottom: 8px;
}

h2 { font-size: 1.1rem; margin-bottom: 4px; }
p { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 16px; }

.path-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.path-option {
  text-align: left;
  padding: 12px;
  background: var(--bg-surface);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  min-height: 44px;
  touch-action: manipulation;
  transition: border-color 0.15s, background 0.15s;
}

.path-option:active {
  background: var(--bg-elevated);
  border-color: var(--cyan);
  transform: scale(0.98);
}

.path-name {
  font-size: 0.85rem;
  font-weight: 700;
  margin-bottom: 2px;
}

.path-desc {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.path-modifiers {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.mod {
  font-size: 0.6rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-muted);
}

.mod-good { color: var(--green); background: rgba(52, 211, 153, 0.1); }
.mod-bad { color: var(--red); background: rgba(233, 69, 96, 0.1); }
.mod-neutral { color: var(--text-secondary); }

.path-unscouted {
  padding: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-sm);
}

.unscouted-text {
  font-size: 0.65rem;
  color: var(--text-muted);
  font-style: italic;
}
</style>
