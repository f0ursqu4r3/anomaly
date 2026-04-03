<template>
  <div class="directive-panel">
    <div class="section-label">ACTIVE DIRECTIVE</div>
    <div class="directive-list">
      <button
        v-for="d in directives"
        :key="d.value"
        class="directive-btn"
        :class="{ active: game.activeDirective === d.value }"
        @click="game.setDirective(d.value)"
      >
        <div class="dir-header">
          <SvgIcon :name="d.icon" size="md" />
          <span class="dir-name">{{ d.label }}</span>
        </div>
        <span class="dir-desc">{{ d.description }}</span>
        <span class="dir-ratio mono">{{ d.ratioText }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'
import type { Directive } from '@/stores/gameStore'
import SvgIcon from './SvgIcon.vue'

const game = useGameStore()

const directives: {
  value: Directive
  label: string
  icon: string
  description: string
  ratioText: string
}[] = [
  {
    value: 'mining',
    label: 'Prioritize Extraction',
    icon: 'mining',
    description: '1.3x extraction speed, crew exposed to hazards',
    ratioText: '70% extractors / 20% engineers',
  },
  {
    value: 'safety',
    label: 'Prioritize Safety',
    icon: 'safety',
    description: '40% hazard resist, 1.2x air & power output',
    ratioText: '20% extractors / 60% engineers',
  },
  {
    value: 'balanced',
    label: 'Balanced Ops',
    icon: 'balanced',
    description: 'Even split, 15% hazard resist',
    ratioText: '40% extractors / 40% engineers',
  },
  {
    value: 'emergency',
    label: 'Emergency Protocol',
    icon: 'emergency',
    description: '1.5x air & power output, minimal extraction',
    ratioText: '10% extractors / 80% engineers',
  },
]
</script>

<style scoped>
.directive-panel {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 8px 10px;
}

.section-label {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.directive-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.directive-btn {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 12px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  text-align: left;
  width: 100%;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.directive-btn.active {
  border-color: var(--cyan);
  background: var(--accent-dim);
  box-shadow: 0 0 12px var(--cyan-glow);
}

.dir-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
}

.directive-btn.active .dir-header {
  color: var(--cyan);
}

.dir-name {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-primary);
}

.dir-desc {
  font-size: 0.6875rem;
  color: var(--text-secondary);
}

.dir-ratio {
  font-size: 0.625rem;
  color: var(--text-secondary);
}
</style>
