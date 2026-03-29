<template>
  <div id="app">
    <AnomalyModal v-if="game.activeAnomaly" />
    <AchievementToast />
    <GameView />
    <OfflineToast
      v-if="showOfflineToast"
      :depth-gained="offlineDepthGained"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useGameLoop } from '@/composables/useGameLoop'
import { useGameStore } from '@/stores/gameStore'
import { useAchievementStore } from '@/stores/achievementStore'
import { initAds } from '@/services/ads'
import { scheduleOfflineCapNotification, cancelOfflineCapNotification } from '@/services/notifications'
import { initStore } from '@/services/iap'
import { fmtDepth } from '@/utils/format'
import AnomalyModal from '@/components/AnomalyModal.vue'
import AchievementToast from '@/components/AchievementToast.vue'
import GameView from '@/components/GameView.vue'
import OfflineToast from '@/components/OfflineToast.vue'

const game = useGameStore()
const achievements = useAchievementStore()

const showOfflineToast = ref(false)
const offlineDepthGained = ref('')

// Check achievements every 2 seconds
let achievementInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  const elapsed = Date.now() - game.lastTickAt
  const depthBefore = game.depth

  if (elapsed > 5000) {
    setTimeout(() => {
      const gained = game.depth - depthBefore
      if (gained > 0) {
        offlineDepthGained.value = fmtDepth(gained)
        showOfflineToast.value = true
      }
    }, 100)
  }

  initAds()
  initStore()
  cancelOfflineCapNotification()
  scheduleOfflineCapNotification(game.offlineEarningCapMs)

  // Start achievement checker
  achievementInterval = setInterval(() => {
    achievements.checkAll()
  }, 2000)
})

onUnmounted(() => {
  if (achievementInterval) clearInterval(achievementInterval)
})

useGameLoop()
</script>
