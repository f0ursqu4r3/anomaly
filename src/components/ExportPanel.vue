<template>
  <div class="export-panel">
    <!-- Not built yet -->
    <div v-if="!game.exportPlatform.built" class="not-built">
      <div class="section-label">LAUNCH PLATFORM</div>
      <p class="mono dim">No launch platform constructed.</p>
      <p class="mono dim">Engineers will build one when 30 metals are available.</p>
    </div>

    <!-- Platform status -->
    <template v-else>
      <div class="section-label">LAUNCH PLATFORM</div>

      <!-- HQ Rates -->
      <div class="rates-row mono">
        <span class="rate-label">HQ RATES:</span>
        <span class="rate" :class="{ boosted: rates.metals !== 15 }">
          Metals {{ rates.metals }}cr
        </span>
        <span class="rate" :class="{ boosted: rates.ice !== 40 }">
          Ice {{ rates.ice }}cr
        </span>
        <span class="rate" :class="{ boosted: rates.rareMinerals !== 100 }">
          Rare {{ rates.rareMinerals }}cr
        </span>
      </div>

      <!-- Platform away -->
      <div v-if="game.exportPlatform.status !== 'docked'" class="transit-status mono">
        <span v-if="game.exportPlatform.status === 'in_transit'" class="status-transit">
          EN ROUTE TO HQ — {{ transitEta }}
        </span>
        <span v-else class="status-returning">
          RETURNING — {{ returnEta }}
        </span>
      </div>

      <!-- Docked — show cargo and controls -->
      <template v-if="game.exportPlatform.status === 'docked'">
        <div class="cargo-row mono">
          <span>CARGO: {{ loaded }}/{{ game.exportPlatform.capacity }}</span>
          <span v-if="game.exportPlatform.cargo.metals > 0"> · {{ game.exportPlatform.cargo.metals }}m</span>
          <span v-if="game.exportPlatform.cargo.ice > 0"> · {{ game.exportPlatform.cargo.ice }}i</span>
          <span v-if="game.exportPlatform.cargo.rareMinerals > 0"> · {{ game.exportPlatform.cargo.rareMinerals }}r</span>
        </div>

        <div v-if="loaded > 0" class="estimate mono dim">
          EST. {{ estimate }}cr at current rates
        </div>

        <div class="controls">
          <button
            class="action-btn green"
            :disabled="loaded === 0"
            @click="game.launchExport(false)"
          >
            LAUNCH
          </button>
          <button
            class="action-btn amber"
            :disabled="loaded === 0"
            @click="game.launchExport(true)"
          >
            FORCE LAUNCH
          </button>
          <button
            class="action-btn dim"
            :class="{ active: game.exportPlatform.autoLaunch }"
            @click="game.toggleAutoLaunch()"
          >
            {{ game.exportPlatform.autoLaunch ? 'AUTO ●' : 'AUTO' }}
          </button>
        </div>

        <!-- Reserves -->
        <div class="reserves mono dim">
          <span class="reserve-label">RESERVES:</span>
          <span>M:{{ effectiveReserves.metals }}</span>
          <span>I:{{ effectiveReserves.ice }}</span>
          <span>R:{{ effectiveReserves.rareMinerals }}</span>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { getCurrentRates, calculatePayoutEstimate } from '@/systems/economy'

const game = useGameStore()

const rates = computed(() => getCurrentRates(game.totalPlaytimeMs))

const loaded = computed(() => game.exportPlatformLoaded)

const estimate = computed(() => calculatePayoutEstimate(game.exportPlatform.cargo, game.totalPlaytimeMs))

const effectiveReserves = computed(() => game.effectiveReserves)

const transitEta = computed(() => {
  if (!game.exportPlatform.launchTime) return '--'
  const arrival = game.exportPlatform.launchTime + 120_000
  const remaining = Math.max(0, arrival - game.totalPlaytimeMs)
  return `${Math.ceil(remaining / 1000)}s`
})

const returnEta = computed(() => {
  if (!game.exportPlatform.returnTime) return '--'
  const remaining = Math.max(0, game.exportPlatform.returnTime - game.totalPlaytimeMs)
  return `${Math.ceil(remaining / 1000)}s`
})
</script>

<style scoped>
.export-panel {
  padding: 0.5rem;
  width: 100%;
  overflow-y: auto;
}

.section-label {
  font-size: 0.7rem;
  color: var(--amber, #f5a623);
  margin-bottom: 0.5rem;
  letter-spacing: 0.05em;
}

.rates-row {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.rate-label {
  color: var(--dim, #666);
}

.rate {
  color: var(--text, #ccc);
}

.rate.boosted {
  color: var(--green, #4caf50);
  text-shadow: 0 0 4px var(--green, #4caf50);
}

.transit-status {
  font-size: 0.75rem;
  padding: 0.3rem 0;
}

.status-transit {
  color: var(--amber, #f5a623);
}

.status-returning {
  color: var(--dim, #666);
}

.cargo-row {
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}

.estimate {
  font-size: 0.7rem;
  margin-bottom: 0.5rem;
}

.controls {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.reserves {
  font-size: 0.65rem;
  display: flex;
  gap: 0.4rem;
}

.reserve-label {
  color: var(--dim, #666);
}

.not-built {
  opacity: 0.6;
}

.not-built p {
  font-size: 0.75rem;
  margin: 0.25rem 0;
}

.dim {
  opacity: 0.6;
}

.mono {
  font-family: 'JetBrains Mono', monospace;
}

.action-btn {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.05em;
  padding: 6px 12px;
  border: 1px solid var(--accent-muted);
  background: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
  min-height: 32px;
}

.action-btn.green {
  border-color: var(--green);
  color: var(--green);
}

.action-btn.amber {
  border-color: var(--amber);
  color: var(--amber);
}

.action-btn.dim {
  color: var(--text-muted);
}

.action-btn.active {
  background: rgba(255, 255, 255, 0.1);
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.action-btn:not(:disabled):hover {
  background: var(--bg-elevated);
}
</style>
