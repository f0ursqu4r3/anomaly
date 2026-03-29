<template>
  <div class="crew-summary" @click="$emit('open')">
    <div class="crew-roles">
      <span class="role-chip" v-for="r in roleCounts" :key="r.role">
        <span class="role-icon">{{ r.icon }}</span>
        <span class="role-count mono">{{ r.count }}</span>
      </span>
    </div>
    <div class="crew-meta mono">
      Avg Lv.{{ avgLevel }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

defineEmits<{ open: [] }>()

const game = useGameStore()

const roleCounts = computed(() => [
  { role: 'driller', icon: '\u26CF', count: game.crew.filter(c => c.role === 'driller').length },
  { role: 'refiner', icon: '\u2697', count: game.crew.filter(c => c.role === 'refiner').length },
  { role: 'researcher', icon: '\uD83D\uDD2C', count: game.crew.filter(c => c.role === 'researcher').length },
])

const avgLevel = computed(() => {
  if (game.crew.length === 0) return 0
  const sum = game.crew.reduce((acc, c) => acc + c.level, 0)
  return Math.round(sum / game.crew.length)
})
</script>

<style scoped>
.crew-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  min-height: 44px;
  margin: 0 16px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.04);
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s;
}

.crew-summary:active {
  background: var(--bg-elevated);
}

.crew-roles {
  display: flex;
  gap: 12px;
}

.role-chip {
  display: flex;
  align-items: center;
  gap: 4px;
}

.role-icon {
  font-size: 1rem;
}

.role-count {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
}

.crew-meta {
  font-size: 0.7rem;
  color: var(--amber);
  font-weight: 600;
}
</style>
