<template>
  <div
    class="map-colonist"
    :class="[roleClass, { dead: colonist.health <= 0, walking: state === 'walking' }]"
    :style="{
      left: x + '%',
      top: y + '%',
      transitionDuration: transitionMs + 'ms',
    }"
  >
    <div class="colonist-dot" />
    <!-- Motion trail -->
    <div v-if="state === 'walking' && colonist.health > 0" class="colonist-trail" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Colonist } from '@/stores/gameStore'

const props = defineProps<{
  colonist: Colonist
  x: number
  y: number
  state: 'walking' | 'working' | 'idle'
  transitionMs: number
}>()

// View-only — no click interaction

const roleClass = computed(() => `role-${props.colonist.role}`)
</script>

<style scoped>
.map-colonist {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 3;
  transition-property: left, top;
  transition-timing-function: linear;
}

.colonist-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: all 0.2s;
}

.role-driller .colonist-dot {
  background: var(--green);
  box-shadow: 0 0 6px var(--green-glow), 0 0 12px rgba(52, 211, 153, 0.1);
}

.role-engineer .colonist-dot {
  background: var(--amber);
  box-shadow: 0 0 6px var(--amber-glow), 0 0 12px rgba(245, 158, 11, 0.1);
}

.role-idle .colonist-dot {
  background: var(--text-muted);
  box-shadow: 0 0 4px var(--accent-dim);
}

.walking .colonist-dot {
  animation: dot-pulse 0.8s ease-in-out infinite;
}

.dead .colonist-dot {
  opacity: 0.15;
  box-shadow: none;
  animation: none;
  width: 5px;
  height: 5px;
}

/* Motion trail */
.colonist-trail {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  opacity: 0.15;
  animation: trail-fade 1.2s ease-out infinite;
}

.role-driller .colonist-trail {
  background: var(--green);
}

.role-engineer .colonist-trail {
  background: var(--amber);
}

.role-idle .colonist-trail {
  background: var(--text-muted);
}

@keyframes dot-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.4); opacity: 0.7; }
}

@keyframes trail-fade {
  0% { transform: scale(1); opacity: 0.2; }
  100% { transform: scale(2.5); opacity: 0; }
}
</style>
