<template>
  <div class="command-console">
    <div class="console-tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="tab-btn"
        :class="{ active: tab === t.id }"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </div>
    <div class="console-content">
      <MessageLog v-if="tab === 'log'" />
      <ShipmentPanel v-if="tab === 'shipments'" />
      <DirectivePanel v-if="tab === 'directives'" />
    </div>
    <div class="console-statusbar">
      <span class="status-item">
        <span class="status-label">CREDITS</span>
        <span class="status-val mono credits">
          <SvgIcon name="credits" size="xs" />${{ fmtCredits(game.credits) }}
        </span>
      </span>
      <span class="status-item">
        <span class="status-label">INCOME</span>
        <span class="status-val mono">+${{ game.creditRate.toFixed(1) }}/s</span>
      </span>
      <span class="status-item">
        <span class="status-label">CREW</span>
        <span class="status-val mono">
          <SvgIcon name="crew" size="xs" />{{ game.aliveColonists.length }}/{{ game.colonists.length }}
        </span>
      </span>
      <span class="status-item">
        <span class="status-label">DIR</span>
        <span class="status-val mono directive-badge">{{ directiveShort }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import SvgIcon from './SvgIcon.vue'
import MessageLog from './MessageLog.vue'
import ShipmentPanel from './ShipmentPanel.vue'
import DirectivePanel from './DirectivePanel.vue'

const game = useGameStore()
const tab = ref<'log' | 'shipments' | 'directives'>('log')

const tabs = [
  { id: 'log' as const, label: 'COMMS' },
  { id: 'shipments' as const, label: 'SHIPMENTS' },
  { id: 'directives' as const, label: 'DIRECTIVES' },
]

const directiveShort = computed(() => {
  const map: Record<string, string> = { mining: 'MINE', safety: 'SAFE', balanced: 'BAL', emergency: 'EMRG' }
  return map[game.activeDirective] || 'BAL'
})

function fmtCredits(n: number): string {
  if (n < 10) return n.toFixed(1)
  return Math.floor(n).toString()
}
</script>

<style scoped>
.command-console {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border-top: 1px solid var(--accent-muted);
}

@media (orientation: landscape), (min-width: 768px) {
  .command-console {
    border-top: none;
    border-left: 1px solid var(--accent-muted);
  }
}

.console-tabs {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--accent-dim);
}

.tab-btn {
  flex: 1;
  padding: 10px 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  background: transparent;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.tab-btn.active {
  color: var(--cyan);
  border-bottom-color: var(--cyan);
}

.console-content {
  flex: 1;
  overflow: hidden;
  display: flex;
}

.console-statusbar {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 5px 8px calc(var(--safe-bottom) + 4px);
  background: var(--bg-deep);
  border-top: 1px solid var(--accent-dim);
  flex-shrink: 0;
}

.status-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.status-label {
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.status-val {
  font-size: 12px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 2px;
}

.status-val.credits {
  color: var(--amber);
}

.directive-badge {
  color: var(--cyan);
}
</style>
