<template>
  <div class="drop-info" :class="{ below: y < 30 }" :style="{ left: Math.max(15, Math.min(85, x)) + '%', top: (y < 30 ? y + 6 : y - 6) + '%' }">
    <div class="info-header">Supply Drop</div>
    <div class="info-row">
      <span class="info-label">Status</span>
      <span :class="statusClass">{{ statusLabel }}</span>
    </div>
    <div v-if="drop.state === 'unpacking'" class="info-row">
      <span class="info-label">Progress</span>
      <span class="status-constructing">{{ Math.round(drop.unpackProgress * 100) }}%</span>
    </div>
    <div class="info-row">
      <span class="info-label">Weight</span>
      <span>{{ drop.totalWeight }}kg</span>
    </div>
    <div class="contents-label">Contents</div>
    <div v-for="(group, i) in groupedContents" :key="i" class="info-row">
      <span class="info-label">{{ group.label }}</span>
      <span v-if="group.count > 1">x{{ group.count }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SupplyDrop } from '@/stores/gameStore'

const props = defineProps<{
  drop: SupplyDrop
  x: number
  y: number
}>()

const statusLabel = computed(() => {
  if (props.drop.state === 'landed') return 'AWAITING CREW'
  if (props.drop.state === 'unpacking') return 'UNPACKING'
  return 'DONE'
})

const statusClass = computed(() => {
  if (props.drop.state === 'landed') return 'status-waiting'
  if (props.drop.state === 'unpacking') return 'status-constructing'
  return 'status-ok'
})

const groupedContents = computed(() => {
  const counts = new Map<string, number>()
  for (const item of props.drop.contents) {
    counts.set(item.label, (counts.get(item.label) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count }))
})
</script>

<style scoped>
.drop-info {
  position: absolute;
  transform: translate(-50%, -100%) scale(var(--marker-scale, 1));
  transform-origin: bottom center;
  z-index: 20;
  background: var(--overlay-bg);
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
  pointer-events: none;
  min-width: 100px;
}

.drop-info.below {
  transform: translate(-50%, 0) scale(var(--marker-scale, 1));
  transform-origin: top center;
}

.info-header {
  font-size: 10px;
  color: var(--purple);
  margin-bottom: 4px;
  border-bottom: 1px solid var(--accent-dim);
  padding-bottom: 3px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  line-height: 1.6;
}

.info-label {
  color: var(--text-secondary);
}

.contents-label {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 4px;
  border-top: 1px solid var(--accent-dim);
  padding-top: 3px;
}

.status-ok { color: var(--green); }
.status-constructing { color: var(--amber); }
.status-waiting { color: var(--purple); }
</style>
