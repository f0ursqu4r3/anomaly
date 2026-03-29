<template>
  <div id="app">
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

useGameLoop()
</script>
