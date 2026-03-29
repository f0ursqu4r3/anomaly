<template>
  <div class="game-view">
    <div class="map-panel">
      <ColonyMap />
    </div>
    <div class="console-panel">
      <CommandConsole />
    </div>
  </div>
</template>

<script setup lang="ts">
import ColonyMap from './ColonyMap.vue'
import CommandConsole from './CommandConsole.vue'
</script>

<style scoped>
.game-view {
  height: 100%;
  display: grid;
  grid-template-rows: 55fr 45fr;
}

.map-panel {
  position: relative;
  overflow: hidden;
}

.console-panel {
  overflow: hidden;
}
</style>
