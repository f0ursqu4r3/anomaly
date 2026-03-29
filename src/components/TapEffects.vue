<template>
  <div class="tap-effects">
    <!-- Floating numbers -->
    <TransitionGroup name="float">
      <div
        v-for="num in floatingNumbers"
        :key="num.id"
        class="float-number mono"
        :style="{ left: num.x + 'px' }"
      >
        +{{ num.text }}
      </div>
    </TransitionGroup>

    <!-- Combo badge -->
    <Transition name="combo-badge">
      <div v-if="game.comboCount > 1 && game.comboActive" class="combo-badge mono" :class="comboTier">
        <span class="combo-x">x{{ game.comboCount }}</span>
        <span class="combo-label">COMBO</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()

interface FloatNum {
  id: number
  text: string
  x: number
}

const floatingNumbers = ref<FloatNum[]>([])
let nextId = 0
let cleanupInterval: ReturnType<typeof setInterval> | null = null

const comboTier = computed(() => {
  if (game.comboCount >= 15) return 'tier-3'
  if (game.comboCount >= 8) return 'tier-2'
  if (game.comboCount >= 3) return 'tier-1'
  return ''
})

function spawnNumber(depthGain: number) {
  const id = nextId++
  const text = depthGain < 1 ? depthGain.toFixed(2) + 'm' : depthGain.toFixed(1) + 'm'
  const x = 120 + (Math.random() - 0.5) * 80 // scatter around center
  floatingNumbers.value.push({ id, text, x })

  setTimeout(() => {
    floatingNumbers.value = floatingNumbers.value.filter(n => n.id !== id)
  }, 900)
}

onMounted(() => {
  cleanupInterval = setInterval(() => {
    // Safety cleanup for any stuck numbers
    if (floatingNumbers.value.length > 10) {
      floatingNumbers.value = floatingNumbers.value.slice(-5)
    }
  }, 2000)
})

onUnmounted(() => {
  if (cleanupInterval) clearInterval(cleanupInterval)
})

defineExpose({ spawnNumber })
</script>

<style scoped>
.tap-effects {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.float-number {
  position: absolute;
  top: 40%;
  font-size: 1rem;
  font-weight: 700;
  color: var(--amber);
  text-shadow: 0 0 8px var(--amber-glow);
  animation: float-up 0.9s ease-out forwards;
  white-space: nowrap;
}

.combo-badge {
  position: absolute;
  top: 20%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  animation: combo-pulse 0.6s ease-in-out infinite;
}

.combo-x {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--amber);
  text-shadow: 0 0 12px var(--amber-glow);
  line-height: 1;
}

.combo-label {
  font-size: 0.5rem;
  letter-spacing: 0.2em;
  color: var(--text-secondary);
}

.combo-badge.tier-1 .combo-x {
  color: var(--amber);
  text-shadow: 0 0 12px var(--amber-glow);
}

.combo-badge.tier-2 .combo-x {
  color: var(--red);
  text-shadow: 0 0 16px var(--red-glow), 0 0 32px var(--red-glow);
  font-size: 1.8rem;
}

.combo-badge.tier-3 .combo-x {
  color: var(--purple);
  text-shadow: 0 0 20px rgba(167, 139, 250, 0.5), 0 0 40px rgba(167, 139, 250, 0.3);
  font-size: 2rem;
}

.combo-badge-enter-active {
  animation: slide-up 0.3s ease-out;
}

.combo-badge-leave-active {
  transition: opacity 0.4s ease;
}

.combo-badge-leave-to {
  opacity: 0;
}
</style>
