<template>
  <div class="crew-summary" @click="$emit('open')">
    <div class="crew-stations">
      <span class="station-chip" v-for="s in stationDisplay" :key="s.station" :title="s.station">
        <span class="station-icon">{{ s.icon }}</span>
        <span class="station-count mono">{{ s.count }}</span>
      </span>
    </div>
    <div class="crew-meta mono">
      {{ game.crew.length }} crew
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

defineEmits<{ open: [] }>()

const game = useGameStore()

const stationDisplay = computed(() => [
  { station: 'drill', icon: '\u26CF', count: game.stationCounts.drill },
  { station: 'refinery', icon: '\u2697', count: game.stationCounts.refinery },
  { station: 'lab', icon: '\uD83D\uDD2C', count: game.stationCounts.lab },
  { station: 'scout', icon: '\uD83E\uDDED', count: game.stationCounts.scout },
  { station: 'idle', icon: '\uD83D\uDCA4', count: game.stationCounts.idle },
].filter(s => s.count > 0))
</script>

<style scoped>
.crew-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  min-height: 40px;
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

.crew-stations {
  display: flex;
  gap: 10px;
}

.station-chip {
  display: flex;
  align-items: center;
  gap: 3px;
}

.station-icon { font-size: 0.85rem; }

.station-count {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
}

.crew-meta {
  font-size: 0.65rem;
  color: var(--text-secondary);
}
</style>
