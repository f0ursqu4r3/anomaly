<template>
  <div id="app">
    <AnomalyModal v-if="game.activeAnomaly" />
    <GameView />
    <OfflineToast
      v-if="showOfflineToast"
      :depth-gained="offlineDepthGained"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGameLoop } from '@/composables/useGameLoop'
import { useGameStore } from '@/stores/gameStore'
import { initAds } from '@/services/ads'
import { scheduleOfflineCapNotification, cancelOfflineCapNotification } from '@/services/notifications'
import { initStore } from '@/services/iap'
import { fmtDepth } from '@/utils/format'
import AnomalyModal from '@/components/AnomalyModal.vue'
import GameView from '@/components/GameView.vue'
import OfflineToast from '@/components/OfflineToast.vue'

const game = useGameStore()

const showOfflineToast = ref(false)
const offlineDepthGained = ref('')

onMounted(async () => {
  // Check offline time before game loop starts
  const elapsed = Date.now() - game.lastTickAt
  const depthBefore = game.depth

  // Game loop handles load + processOfflineTime
  // We just need to detect if there was significant offline time
  if (elapsed > 5000) {
    // Wait a tick for processOfflineTime to run
    setTimeout(() => {
      const gained = game.depth - depthBefore
      if (gained > 0) {
        offlineDepthGained.value = fmtDepth(gained)
        showOfflineToast.value = true
      }
    }, 100)
  }

  // Initialize services
  initAds()
  initStore()

  // Cancel any pending offline notification since we're back
  cancelOfflineCapNotification()

  // Schedule new notification for when offline cap will be reached
  scheduleOfflineCapNotification(game.offlineEarningCapMs)
})

useGameLoop()
</script>
