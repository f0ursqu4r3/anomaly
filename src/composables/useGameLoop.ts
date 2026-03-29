import { onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const TICK_MS = 1000
const SAVE_EVERY_N_TICKS = 30  // save every 30 ticks (30s)

export function useGameLoop() {
  const game = useGameStore()

  let tickInterval: ReturnType<typeof setInterval> | null = null
  let tickCount = 0

  function startLoop() {
    if (tickInterval) return
    tickInterval = setInterval(() => {
      game.tick(TICK_MS)
      tickCount++
      if (tickCount % SAVE_EVERY_N_TICKS === 0) {
        game.save()
      }
    }, TICK_MS)
  }

  function stopLoop() {
    if (tickInterval) {
      clearInterval(tickInterval)
      tickInterval = null
    }
  }

  // Handle app going to background / coming back
  function onVisibilityChange() {
    if (document.hidden) {
      stopLoop()
      game.save()
    } else {
      game.processOfflineTime()
      startLoop()
    }
  }

  onMounted(async () => {
    await game.load()
    startLoop()
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onUnmounted(() => {
    stopLoop()
    game.save()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return { startLoop, stopLoop }
}
