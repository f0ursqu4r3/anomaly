<template>
  <div
    class="map-building"
    :class="[typeClass, { damaged: building.damaged }]"
    :style="{ left: building.x + '%', top: building.y + '%', transform: `translate(-50%, -50%) rotate(${building.rotation || 0}deg)` }"
  >
    <!-- View-only — no click interaction -->
    <div class="building-sprite">
      <SvgIcon :name="iconName" size="sm" />
    </div>
    <div v-if="building.damaged" class="dmg-indicator" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Building } from '@/stores/gameStore'
import SvgIcon from './SvgIcon.vue'

const props = defineProps<{ building: Building }>()

const iconName = computed(() => {
  const map: Record<string, string> = {
    o2generator: 'o2generator',
    solar: 'solar',
    drillrig: 'drillrig',
    medbay: 'medbay',
  }
  return map[props.building.type] || 'shipment'
})

const typeClass = computed(() => `type-${props.building.type}`)
</script>

<style scoped>
.map-building {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  z-index: 2;
}

.building-sprite {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sprite-bg);
  border: 1.5px solid transparent;
  transition: all 0.2s;
}

.type-solar .building-sprite {
  color: var(--amber);
  border-color: var(--amber-glow);
  box-shadow:
    0 0 10px var(--amber-glow),
    0 0 20px rgba(245, 158, 11, 0.08);
}

.type-o2generator .building-sprite {
  color: var(--cyan);
  border-color: var(--cyan-glow);
  box-shadow:
    0 0 10px var(--cyan-glow),
    0 0 20px rgba(126, 207, 255, 0.08);
}

.type-drillrig .building-sprite {
  color: var(--green);
  border-color: var(--green-glow);
  box-shadow:
    0 0 10px var(--green-glow),
    0 0 20px rgba(52, 211, 153, 0.08);
}

.type-medbay .building-sprite {
  color: var(--red);
  border-color: var(--red-glow);
  box-shadow:
    0 0 10px var(--red-glow),
    0 0 20px rgba(233, 69, 96, 0.08);
}

.damaged .building-sprite {
  border-color: var(--red) !important;
  box-shadow:
    0 0 14px var(--red-glow),
    0 0 28px rgba(233, 69, 96, 0.1) !important;
  animation: dmg-pulse 1.5s ease-in-out infinite;
}

.dmg-indicator {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--red);
  box-shadow: 0 0 6px var(--red);
  animation: feed-blink 1s ease-in-out infinite;
}

@keyframes dmg-pulse {
  0%,
  100% {
    box-shadow: 0 0 10px var(--red-glow);
  }
  50% {
    box-shadow:
      0 0 20px var(--red-glow),
      0 0 35px rgba(233, 69, 96, 0.15);
  }
}

@keyframes feed-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.2;
  }
}
</style>
