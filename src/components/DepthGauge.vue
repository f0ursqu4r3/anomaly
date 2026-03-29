<template>
  <div class="depth-gauge">
    <div class="gauge-track">
      <div class="gauge-fill" :style="{ height: fillPercent + '%' }"></div>
      <div class="gauge-markers">
        <div v-for="i in 5" :key="i" class="marker" :style="{ bottom: (i * 20) + '%' }"></div>
      </div>
    </div>
    <div class="depth-info">
      <div class="depth-label">DEPTH</div>
      <div class="depth-value mono">{{ fmtDepth(game.depth) }}</div>
      <div class="depth-rate mono">{{ drillSpeedDisplay }}/s</div>
      <div class="depth-max">Record: {{ fmtDepth(game.maxDepth) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { fmtDepth } from '@/utils/format'

const game = useGameStore()

const fillPercent = computed(() => {
  const target = Math.max(game.maxDepth, 100)
  return Math.min((game.depth / target) * 100, 100)
})

const drillSpeedDisplay = computed(() => {
  const speed = game.drillSpeed
  if (speed < 1) return speed.toFixed(2) + 'm'
  if (speed < 1000) return speed.toFixed(1) + 'm'
  return (speed / 1000).toFixed(2) + 'km'
})
</script>

<style scoped>
.depth-gauge {
  display: flex;
  align-items: stretch;
  gap: 12px;
  padding: 16px;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.gauge-track {
  width: 24px;
  flex-shrink: 0;
  background: var(--bg-deep);
  border-radius: var(--radius-full);
  position: relative;
  overflow: hidden;
  min-height: 70px;
}

.gauge-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, var(--amber), var(--red));
  border-radius: var(--radius-full);
  transition: height 0.5s ease-out;
}

.gauge-markers {
  position: absolute;
  inset: 0;
}

.marker {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
}

.depth-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}

.depth-label {
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.depth-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--amber);
  line-height: 1.1;
}

.depth-rate {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.depth-max {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 4px;
}
</style>
