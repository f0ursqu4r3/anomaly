<template>
  <div class="resource-hud">
    <div class="hud-item" :class="{ danger: game.air / game.airMax < 0.2 }">
      <SvgIcon name="air" size="xs" />
      <div class="hud-stack">
        <span class="hud-val mono">{{ fmt(game.air) }}</span>
        <span class="hud-rate mono" :class="rateClass(game.airRate)">{{
          fmtRate(game.airRate)
        }}</span>
        <span class="hud-breakdown mono">+{{ game.airProduction.toFixed(1) }} / -{{ game.airConsumption.toFixed(1) }}</span>
      </div>
    </div>
    <div class="hud-item" :class="{ danger: game.power / game.powerMax < 0.2 }">
      <SvgIcon name="power" size="xs" />
      <div class="hud-stack">
        <span class="hud-val mono">{{ fmt(game.power) }}</span>
        <span class="hud-rate mono" :class="rateClass(game.powerRate)">{{
          fmtRate(game.powerRate)
        }}</span>
        <span class="hud-breakdown mono">+{{ game.powerProduction.toFixed(1) }} / -{{ game.powerConsumption.toFixed(1) }}</span>
      </div>
    </div>
    <div class="hud-item">
      <SvgIcon name="metals" size="xs" />
      <span class="hud-val mono">{{ fmt(game.metals) }}</span>
    </div>
    <div class="hud-item">
      <SvgIcon name="ice" size="xs" />
      <span class="hud-val mono">{{ fmt(game.ice) }}</span>
    </div>
    <div v-if="game.repairKits > 0 || game.buildings.some(b => b.damaged)" class="hud-item repair-kits">
      <SvgIcon name="repair" size="xs" />
      <span class="hud-val mono">{{ game.repairKits }}</span>
    </div>
    <div class="hud-item depth">
      <SvgIcon name="depth" size="xs" />
      <span class="hud-val mono">{{ fmtDepth(game.depth) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'
import { fmtDepth } from '@/utils/format'
import SvgIcon from './SvgIcon.vue'

const game = useGameStore()

function fmt(n: number): string {
  if (n < 10) return n.toFixed(1)
  if (n < 1000) return Math.floor(n).toString()
  return (n / 1000).toFixed(1) + 'K'
}

function fmtRate(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}`
}

function rateClass(n: number): string {
  if (n > 0.05) return 'rate-pos'
  if (n < -0.05) return 'rate-neg'
  return 'rate-zero'
}
</script>

<style scoped>
.resource-hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: calc(var(--safe-top) + 3px) 6px 4px;
  background: var(--overlay-bg);
  border-bottom: 1px solid var(--accent-muted);
}

.hud-item {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--text-secondary);
}

.hud-stack {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.hud-val {
  font-size: 11px;
  color: var(--text-primary);
}

.hud-rate {
  font-size: 8px;
}

.rate-pos {
  color: var(--green);
}
.rate-neg {
  color: var(--red);
}
.rate-zero {
  color: var(--text-muted);
}

.hud-item.danger {
  color: var(--red);
}

.hud-item.danger .hud-val {
  color: var(--red);
}

.hud-breakdown {
  font-size: 7px;
  color: var(--text-muted);
  opacity: 0.7;
}

.hud-item.repair-kits {
  color: var(--amber);
}

.hud-item.depth {
  color: var(--cyan);
}

.hud-item.depth .hud-val {
  color: var(--cyan);
  font-size: 10px;
}
</style>
