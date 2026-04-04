<template>
  <div
    class="info-card"
    :class="{ below: y < 30 }"
    :style="{ left: Math.max(15, Math.min(85, x)) + '%', top: (y < 30 ? y + 6 : y - 6) + '%' }"
  >
    <div class="info-header">
      <span>{{ title }}</span>
      <button v-if="dismissable" class="info-dismiss" @click="$emit('dismiss')">&times;</button>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    x: number
    y: number
    dismissable?: boolean
  }>(),
  { dismissable: false },
)

defineEmits<{ dismiss: [] }>()
</script>

<style scoped>
.info-card {
  position: absolute;
  transform: translate(-50%, -100%) scale(var(--marker-scale, 1));
  transform-origin: bottom center;
  z-index: 20;
  background: var(--overlay-bg);
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--text-secondary);
  pointer-events: auto;
  min-width: 100px;
}

.info-card.below {
  transform: translate(-50%, 0) scale(var(--marker-scale, 1));
  transform-origin: top center;
}

.info-header {
  font-size: 0.625rem;
  color: var(--text-primary);
  margin-bottom: 4px;
  border-bottom: 1px solid var(--accent-dim);
  padding-bottom: 3px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-dismiss {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1rem;
  cursor: pointer;
  padding: 4px 8px;
  margin: -4px -8px -4px 0;
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
</style>
