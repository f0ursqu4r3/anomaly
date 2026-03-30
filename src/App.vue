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
    <HazardAlert />
    <GameView />
  </div>
</template>

<script setup lang="ts">
import { useGameLoop } from '@/composables/useGameLoop'
import GameOverModal from '@/components/GameOverModal.vue'
import HazardAlert from '@/components/HazardAlert.vue'
import GameView from '@/components/GameView.vue'
import ShiftReport from '@/components/ShiftReport.vue'

const { showShiftReport, dismissReport, reportData } = useGameLoop()
</script>
