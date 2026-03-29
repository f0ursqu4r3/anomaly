<template>
  <div class="resource-hud">
    <div class="hud-item" :class="{ danger: game.air / game.airMax < 0.2 }">
      <SvgIcon name="air" size="xs" />
      <span class="hud-val mono">{{ fmt(game.air) }}</span>
    </div>
    <div class="hud-item" :class="{ danger: game.power / game.powerMax < 0.2 }">
      <SvgIcon name="power" size="xs" />
      <span class="hud-val mono">{{ fmt(game.power) }}</span>
    </div>
    <div class="hud-item">
      <SvgIcon name="metals" size="xs" />
      <span class="hud-val mono">{{ fmt(game.metals) }}</span>
    </div>
    <div class="hud-item">
      <SvgIcon name="ice" size="xs" />
      <span class="hud-val mono">{{ fmt(game.ice) }}</span>
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
  padding: calc(var(--safe-top) + 3px) 8px 4px;
  background: rgba(5, 8, 16, 0.92);
  border-bottom: 1px solid rgba(100, 160, 220, 0.1);
}

.hud-item {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--text-secondary);
}

.hud-val {
  font-size: 11px;
  color: var(--text-primary);
}

.hud-item.danger {
  color: var(--red);
}

.hud-item.danger .hud-val {
  color: var(--red);
  animation: combo-pulse 1s ease-in-out infinite;
}

.hud-item.depth {
  color: var(--cyan);
}

.hud-item.depth .hud-val {
  color: var(--cyan);
  font-size: 10px;
}
</style>
