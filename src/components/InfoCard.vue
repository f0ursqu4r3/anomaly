<template>
  <div
    class="info-card"
    :class="{ below: y < 30 }"
    :style="cardStyle"
  >
    <div class="info-header">
      <span>{{ title }}</span>
      <button v-if="dismissable" class="info-dismiss" @click="$emit('dismiss')">&times;</button>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    x: number
    y: number
    dismissable?: boolean
  }>(),
  { dismissable: false },
)

defineEmits<{ dismiss: [] }>()

const cardStyle = computed(() => {
  const clampedX = Math.max(20, Math.min(80, props.x))
  const clampedY = props.y < 30 ? props.y + 8 : props.y - 8
  // Shift horizontal anchor based on position: left edge → anchor left, center → center, right → anchor right
  // Map 20-80 range to 0%-100% translate
  const tPct = ((clampedX - 20) / 60) * 100
  const translateX = -tPct
  const translateY = props.y < 30 ? 0 : -100
  return {
    left: clampedX + '%',
    top: clampedY + '%',
    transform: `translate(${translateX}%, ${translateY}%) scale(var(--marker-scale, 1))`,
    transformOrigin: props.y < 30 ? 'top center' : 'bottom center',
  }
})
</script>

<style scoped>
.info-card {
  position: absolute;
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
  max-width: 200px;
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
