<template>
  <div class="export-panel">
    <!-- Not built yet -->
    <div v-if="!game.exportPlatform.built" class="not-built">
      <div class="section-label">LAUNCH PLATFORM</div>
      <p class="info-text">No launch platform constructed.</p>
      <p class="info-text">Order one from HQ via SHIPMENTS.</p>
    </div>

    <!-- Platform status -->
    <template v-else>
      <div class="section-label">LAUNCH PLATFORM</div>

      <!-- HQ Rates -->
      <div class="rates-row">
        <span class="rate-label">HQ RATES</span>
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
      <div v-if="game.exportPlatform.status !== 'docked'" class="transit-status">
        <span v-if="game.exportPlatform.status === 'in_transit'" class="status-transit">
          EN ROUTE TO HQ — {{ transitEta }}
        </span>
        <span v-else class="status-returning">
          RETURNING — {{ returnEta }}
        </span>
      </div>

      <!-- Docked — show cargo and controls -->
      <template v-if="game.exportPlatform.status === 'docked'">
        <div class="cargo-section">
          <div class="cargo-header">
            <span>CARGO</span>
            <span class="cargo-count" :class="{ full: loaded >= game.exportPlatform.capacity }">
              {{ loaded }}/{{ game.exportPlatform.capacity }}
            </span>
          </div>
          <div class="capacity-bar-bg">
            <div
              class="capacity-bar-fill"
              :class="{ full: loaded >= game.exportPlatform.capacity }"
              :style="{ width: (loaded / game.exportPlatform.capacity * 100) + '%' }"
            />
          </div>
          <div v-if="loaded > 0" class="cargo-breakdown">
            <span v-if="game.exportPlatform.cargo.metals > 0" class="cargo-item">{{ game.exportPlatform.cargo.metals }}m</span>
            <span v-if="game.exportPlatform.cargo.ice > 0" class="cargo-item">{{ game.exportPlatform.cargo.ice }}i</span>
            <span v-if="game.exportPlatform.cargo.rareMinerals > 0" class="cargo-item">{{ game.exportPlatform.cargo.rareMinerals }}r</span>
            <span class="cargo-estimate">est. {{ estimate }}cr</span>
          </div>
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
            FORCE
          </button>
          <button
            class="action-btn"
            :class="{ active: game.exportPlatform.autoLaunch }"
            @click="game.toggleAutoLaunch()"
          >
            {{ game.exportPlatform.autoLaunch ? 'AUTO ON' : 'AUTO' }}
          </button>
        </div>

        <!-- Reserves -->
        <div class="reserves">
          <span class="reserve-label">RESERVES</span>
          <span class="reserve-val">M:{{ effectiveReserves.metals }}</span>
          <span class="reserve-val">I:{{ effectiveReserves.ice }}</span>
          <span class="reserve-val">R:{{ effectiveReserves.rareMinerals }}</span>
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
  padding: 8px 10px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.section-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.not-built .info-text {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  margin: 4px 0;
}

/* HQ Rates */
.rates-row {
  display: flex;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  margin-bottom: 10px;
  flex-wrap: wrap;
  align-items: baseline;
}

.rate-label {
  color: var(--text-muted);
  font-size: 10px;
  letter-spacing: 0.1em;
}

.rate {
  color: var(--text-secondary);
}

.rate.boosted {
  color: var(--green);
  text-shadow: 0 0 6px var(--green-glow);
}

/* Transit status */
.transit-status {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 6px 0;
}

.status-transit {
  color: var(--amber);
}

.status-returning {
  color: var(--text-muted);
}

/* Cargo */
.cargo-section {
  margin-bottom: 8px;
}

.cargo-header {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.cargo-count {
  color: var(--text-primary);
}

.cargo-count.full {
  color: var(--amber);
}

.capacity-bar-bg {
  height: 4px;
  background: var(--bg-deep);
  border-radius: var(--radius-xs);
  overflow: hidden;
  margin-bottom: 4px;
}

.capacity-bar-fill {
  height: 100%;
  background: var(--cyan);
  border-radius: var(--radius-xs);
  transition: width 0.3s ease;
}

.capacity-bar-fill.full {
  background: var(--amber);
}

.cargo-breakdown {
  display: flex;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-secondary);
}

.cargo-estimate {
  color: var(--text-muted);
  margin-left: auto;
}

/* Controls */
.controls {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
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
  transition: all 0.15s;
}

.action-btn.green {
  border-color: var(--green);
  color: var(--green);
}

.action-btn.amber {
  border-color: var(--amber);
  color: var(--amber);
}

.action-btn.active {
  background: var(--bg-elevated);
  border-color: var(--cyan);
  color: var(--cyan);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn:not(:disabled):hover {
  background: var(--bg-elevated);
}

/* Reserves */
.reserves {
  display: flex;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 10px;
  align-items: baseline;
}

.reserve-label {
  color: var(--text-muted);
  letter-spacing: 0.1em;
}

.reserve-val {
  color: var(--text-secondary);
}
</style>
