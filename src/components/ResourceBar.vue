<template>
  <div class="resource-bar">
    <div class="resource" v-for="r in resources" :key="r.key">
      <span class="resource-icon">{{ r.icon }}</span>
      <div class="resource-info">
        <span class="resource-value mono">{{ fmtNumber(r.value) }}</span>
        <span class="resource-rate mono">+{{ fmtRate(r.rate) }}/s</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { fmtNumber } from '@/utils/format'

const game = useGameStore()

function fmtRate(n: number): string {
  if (n < 1) return n.toFixed(2)
  return fmtNumber(n)
}

const resources = computed(() => [
  { key: 'ore', icon: '\u{26CF}', value: game.resources.ore, rate: game.resourceRates.ore },
  { key: 'crystals', icon: '\uD83D\uDC8E', value: game.resources.crystals, rate: game.resourceRates.crystals },
  { key: 'data', icon: '\uD83D\uDCE1', value: game.resources.data, rate: game.resourceRates.data },
])
</script>

<style scoped>
.resource-bar {
  display: flex;
  gap: 6px;
  padding: 0 16px;
}

.resource {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.resource-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.resource-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.resource-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-rate {
  font-size: 0.65rem;
  color: var(--green);
  line-height: 1.2;
}
</style>
