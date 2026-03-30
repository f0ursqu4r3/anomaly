import { ref, reactive, onMounted, onUnmounted, watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'
import {
  scheduleOfflineNotifications,
  cancelAllOfflineNotifications,
} from '@/services/notifications'
import { simulateOffline } from '@/stores/offlineEngine'
import type { OfflineResult } from '@/stores/offlineEngine'

const TICK_MS = 1000
const SAVE_EVERY_N_TICKS = 30
const EAGER_SIM_WINDOW_MS = 4 * 60 * 60 * 1000 // 4h max for notification scheduling

export function useGameLoop() {
  const game = useGameStore()
  const showShiftReport = ref(false)
  const reportData = reactive({
    durationMs: 0,
    deltaCredits: 0,
    deltaMetals: 0,
    deltaIce: 0,
    deltaDepth: 0,
  })

  let tickInterval: ReturnType<typeof setInterval> | null = null
  let tickCount = 0

  function startLoop() {
    if (tickInterval) return
    const settings = useSettingsStore()
    tickInterval = setInterval(() => {
      if (game.isPaused) return
      game.tick(TICK_MS)
      tickCount++
      if (settings.autoSave && tickCount % SAVE_EVERY_N_TICKS === 0) {
        game.save()
      }
    }, TICK_MS / settings.timeMultiplier)
  }

  function stopLoop() {
    if (tickInterval) {
      clearInterval(tickInterval)
      tickInterval = null
    }
  }

  function applyReportData(result: OfflineResult) {
    reportData.durationMs = result.durationMs
    reportData.deltaCredits = result.deltaCredits
    reportData.deltaMetals = result.deltaMetals
    reportData.deltaIce = result.deltaIce
    reportData.deltaDepth = result.deltaDepth
  }

  function dismissReport() {
    showShiftReport.value = false
    game.dismissShiftReport()
    startLoop()
  }

  function handleOfflineResult(result: OfflineResult | null) {
    if (result && result.durationMs > 60_000) {
      applyReportData(result)
      showShiftReport.value = true
    } else {
      startLoop()
    }
  }

  async function onVisibilityChange() {
    if (document.hidden) {
      stopLoop()
      await game.save()

      const eagerResult = simulateOffline(game.$state, EAGER_SIM_WINDOW_MS)
      await scheduleOfflineNotifications(eagerResult.events, Date.now())
    } else {
      await cancelAllOfflineNotifications()
      if (game.isPaused) {
        startLoop() // restart interval but tick guard prevents execution
      } else {
        handleOfflineResult(game.processOfflineTime())
      }
    }
  }

  onMounted(async () => {
    await game.load()
    handleOfflineResult(game.processOfflineTime())
    document.addEventListener('visibilitychange', onVisibilityChange)

    watch(() => useSettingsStore().timeMultiplier, () => {
      if (tickInterval) {
        stopLoop()
        startLoop()
      }
    })
  })

  onUnmounted(() => {
    stopLoop()
    game.save()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return { startLoop, stopLoop, showShiftReport, dismissReport, reportData }
}
