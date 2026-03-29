<template>
  <Transition name="achievement">
    <div v-if="visible" class="achievement-toast" @click="dismiss">
      <div class="achievement-icon">{{ achievement?.icon }}</div>
      <div class="achievement-info">
        <div class="achievement-unlocked">ACHIEVEMENT UNLOCKED</div>
        <div class="achievement-name">{{ achievement?.name }}</div>
        <div class="achievement-desc">{{ achievement?.description }}</div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAchievementStore } from '@/stores/achievementStore'

const achievements = useAchievementStore()
const visible = ref(false)
const achievement = ref<{ icon: string; name: string; description: string } | null>(null)
let hideTimeout: ReturnType<typeof setTimeout> | null = null

watch(() => achievements.lastUnlocked, (id) => {
  if (!id) return
  const a = achievements.achievements.find(x => x.id === id)
  if (!a) return

  achievement.value = { icon: a.icon, name: a.name, description: a.description }
  visible.value = true

  if (hideTimeout) clearTimeout(hideTimeout)
  hideTimeout = setTimeout(() => {
    visible.value = false
    achievements.clearLastUnlocked()
  }, 3500)
})

function dismiss() {
  visible.value = false
  achievements.clearLastUnlocked()
}
</script>

<style scoped>
.achievement-toast {
  position: fixed;
  top: calc(12px + var(--safe-top));
  left: 16px;
  right: 16px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #2a1d08, #1a1a2e);
  border: 1px solid var(--amber);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 950;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8), 0 0 24px var(--amber-glow);
}

.achievement-icon {
  font-size: 1.8rem;
  flex-shrink: 0;
}

.achievement-info {
  flex: 1;
  min-width: 0;
}

.achievement-unlocked {
  font-size: 0.5rem;
  letter-spacing: 0.2em;
  color: var(--amber);
  font-weight: 700;
}

.achievement-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 1px;
}

.achievement-desc {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-top: 1px;
}

.achievement-enter-active {
  animation: achievement-in 0.4s ease-out;
}

.achievement-leave-active {
  animation: achievement-out 0.3s ease-in forwards;
}
</style>
