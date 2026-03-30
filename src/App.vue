<template>
  <div id="app">
    <ShiftReport
      :visible="showShiftReport"
      :duration-ms="reportData.durationMs"
      :delta-credits="reportData.deltaCredits"
      :delta-metals="reportData.deltaMetals"
      :delta-ice="reportData.deltaIce"
      :delta-depth="reportData.deltaDepth"
      @dismiss="dismissReport"
    />
    <GameOverModal />
    <SettingsModal :visible="showSettings" @close="showSettings = false" />
    <GameView @open-settings="showSettings = true" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useGameLoop } from '@/composables/useGameLoop'
import { useSettingsStore } from '@/stores/settingsStore'
import GameOverModal from '@/components/GameOverModal.vue'
import GameView from '@/components/GameView.vue'
import ShiftReport from '@/components/ShiftReport.vue'
import SettingsModal from '@/components/SettingsModal.vue'

const settings = useSettingsStore()
settings.load()

const showSettings = ref(false)
const { showShiftReport, dismissReport, reportData } = useGameLoop()

watch(() => settings.textSize, (size) => {
  document.documentElement.dataset.textSize = size
}, { immediate: true })
</script>
