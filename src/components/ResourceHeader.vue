<template>
  <div class="resource-header">
    <div class="res-item">
      <span class="res-icon"><SvgIcon name="power" size="xs" /></span>
      <span class="res-val mono" :class="rateClass(game.powerRate)">
        {{ fmt(game.power) }}<span class="res-rate">{{ fmtRate(game.powerRate) }}</span>
      </span>
    </div>
    <div class="res-item">
      <span class="res-icon"><SvgIcon name="air" size="xs" /></span>
      <span class="res-val mono" :class="rateClass(game.airRate)">
        {{ fmt(game.air) }}<span class="res-rate">{{ fmtRate(game.airRate) }}</span>
      </span>
    </div>
    <div class="res-item">
      <span class="res-icon"><SvgIcon name="metals" size="xs" /></span>
      <span class="res-val mono">{{ fmt(game.metals) }}</span>
    </div>
    <div class="res-item">
      <span class="res-icon"><SvgIcon name="ice" size="xs" /></span>
      <span class="res-val mono">{{ fmt(game.ice) }}</span>
    </div>
    <div v-if="game.rareMinerals > 0" class="res-item">
      <span class="res-icon"><SvgIcon name="rare" size="xs" /></span>
      <span class="res-val mono">{{ fmt(game.rareMinerals) }}</span>
    </div>
    <div v-if="game.repairKits > 0" class="res-item">
      <span class="res-icon"><SvgIcon name="repair" size="xs" /></span>
      <span class="res-val mono">{{ game.repairKits }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'
import SvgIcon from './SvgIcon.vue'

const game = useGameStore()

function fmt(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  if (n >= 100) return Math.floor(n).toString()
  return n.toFixed(1)
}

function fmtRate(n: number): string {
  if (Math.abs(n) < 0.05) return ''
  return (n > 0 ? '+' : '') + n.toFixed(1)
}

function rateClass(n: number): string {
  if (n < -0.5) return 'danger'
  if (n > 0.5) return 'rate-pos'
  return ''
}
</script>

<style scoped>
.resource-header {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 6px 8px;
  background: var(--bg-deep);
  border-bottom: 1px solid var(--accent-muted);
  flex-shrink: 0;
}

.res-item {
  display: flex;
  align-items: center;
  gap: 3px;
}

.res-icon {
  color: var(--text-muted);
  display: flex;
}

.res-val {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.res-rate {
  font-size: 0.625rem;
  font-weight: 400;
  color: var(--text-secondary);
  margin-left: 2px;
}

.res-val.danger {
  color: var(--red);
}

.res-val.danger .res-rate {
  color: var(--red);
}

.res-val.rate-pos .res-rate {
  color: var(--green);
}
</style>
