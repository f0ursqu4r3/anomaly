<template>
  <div class="export-panel">
    <div class="section-label">EXPORT PLATFORMS</div>

    <!-- HQ Rates -->
    <div class="rates-row">
      <span class="rate-label">HQ RATES</span>
      <span class="rate" :class="{ boosted: rates.metals !== 15 }">
        Metals {{ rates.metals }}cr
      </span>
      <span class="rate" :class="{ boosted: rates.ice !== 40 }"> Ice {{ rates.ice }}cr </span>
      <span class="rate" :class="{ boosted: rates.rareMinerals !== 100 }">
        Rare {{ rates.rareMinerals }}cr
      </span>
    </div>

    <!-- Per-platform cards -->
    <div v-for="platform in platforms" :key="platform.id" class="platform-card">
      <div class="platform-header">
        <span>{{ platformLabel(platform) }}</span>
        <span class="platform-status" :class="statusClass(platform)">{{
          statusLabel(platform)
        }}</span>
      </div>

      <!-- Platform away -->
      <template
        v-if="
          getState(platform)?.status === 'in_transit' || getState(platform)?.status === 'returning'
        "
      >
        <div class="transit-info">
          <span v-if="getState(platform)?.status === 'in_transit'">
            EN ROUTE — {{ transitEta(platform) }}
          </span>
          <span v-else> RETURNING — {{ returnEta(platform) }} </span>
        </div>
      </template>

      <!-- Docked -->
      <template v-if="getState(platform)?.status === 'docked'">
        <div class="cargo-section">
          <div class="cargo-header">
            <span>CARGO</span>
            <span
              class="cargo-count"
              :class="{ full: loaded(platform) >= (getState(platform)?.capacity ?? 100) }"
            >
              {{ loaded(platform) }}/{{ getState(platform)?.capacity ?? 100 }}
            </span>
          </div>
          <div class="capacity-bar-bg">
            <div
              class="capacity-bar-fill"
              :class="{ full: loaded(platform) >= (getState(platform)?.capacity ?? 100) }"
              :style="{
                width: (loaded(platform) / (getState(platform)?.capacity ?? 100)) * 100 + '%',
              }"
            />
          </div>
          <div v-if="loaded(platform) > 0" class="cargo-breakdown">
            <span v-if="getState(platform)!.cargo.metals > 0" class="cargo-item"
              >{{ getState(platform)!.cargo.metals }}m</span
            >
            <span v-if="getState(platform)!.cargo.ice > 0" class="cargo-item"
              >{{ getState(platform)!.cargo.ice }}i</span
            >
            <span v-if="getState(platform)!.cargo.rareMinerals > 0" class="cargo-item"
              >{{ getState(platform)!.cargo.rareMinerals }}r</span
            >
            <span class="cargo-estimate">est. {{ estimate(platform) }}cr</span>
          </div>
        </div>

        <div class="controls">
          <button
            class="action-btn green"
            :disabled="loaded(platform) === 0"
            @click="game.launchExport(platform.id, false)"
          >
            LAUNCH
          </button>
          <button
            class="action-btn amber"
            :disabled="loaded(platform) === 0"
            @click="game.launchExport(platform.id, true)"
          >
            FORCE
          </button>
          <button
            class="action-btn"
            :class="{ active: getState(platform)?.autoLaunch }"
            @click="game.toggleAutoLaunch(platform.id)"
          >
            {{ getState(platform)?.autoLaunch ? 'AUTO ON' : 'AUTO' }}
          </button>
        </div>
      </template>
    </div>

    <!-- Global reserves -->
    <div v-if="platforms.length > 0" class="reserves">
      <span class="reserve-label">RESERVES</span>
      <span class="reserve-val">M:{{ autoReserves.metals }}</span>
      <span class="reserve-val">I:{{ autoReserves.ice }}</span>
      <span class="reserve-val">R:{{ autoReserves.rareMinerals }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Building } from '@/stores/gameStore'
import { useGameStore } from '@/stores/gameStore'
import { getCurrentRates, calculatePayoutEstimate } from '@/systems/economy'

const game = useGameStore()

const rates = computed(() => getCurrentRates(game.totalPlaytimeMs))
const platforms = computed(() => game.operationalPlatforms)
const autoReserves = computed(() => game.exportAutoReserves)

function getState(platform: Building) {
  return game.exportPlatforms[platform.id]
}

function loaded(platform: Building): number {
  const ep = getState(platform)
  if (!ep) return 0
  return ep.cargo.metals + ep.cargo.ice + ep.cargo.rareMinerals
}

function estimate(platform: Building): number {
  const ep = getState(platform)
  if (!ep) return 0
  return calculatePayoutEstimate(ep.cargo, game.totalPlaytimeMs)
}

function platformLabel(platform: Building): string {
  const index = game.buildings
    .filter((b) => b.type === 'launchplatform')
    .findIndex((b) => b.id === platform.id)
  return `Platform #${index + 1}`
}

function statusLabel(platform: Building): string {
  const ep = getState(platform)
  if (!ep) return 'INIT'
  if (ep.status === 'in_transit') return 'EN ROUTE'
  if (ep.status === 'returning') return 'RETURNING'
  return 'DOCKED'
}

function statusClass(platform: Building): string {
  const ep = getState(platform)
  if (!ep) return ''
  if (ep.status === 'in_transit') return 'status-transit'
  if (ep.status === 'returning') return 'status-returning'
  return 'status-docked'
}

function transitEta(platform: Building): string {
  const ep = getState(platform)
  if (!ep?.launchTime) return '--'
  const remaining = Math.max(0, ep.launchTime + 120_000 - game.totalPlaytimeMs)
  return `${Math.ceil(remaining / 1000)}s`
}

function returnEta(platform: Building): string {
  const ep = getState(platform)
  if (!ep?.returnTime) return '--'
  const remaining = Math.max(0, ep.returnTime - game.totalPlaytimeMs)
  return `${Math.ceil(remaining / 1000)}s`
}
</script>

<style scoped>
.export-panel {
  padding: 8px 10px;
  overflow-y: auto;
  width: 100%;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.section-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

/* HQ Rates — styled like transit-item pattern */
.rates-row {
  display: flex;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 5px 10px;
  background: var(--accent-dim);
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
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
  animation: rate-pulse 2s ease-in-out infinite;
}

@keyframes rate-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* Platform cards — matches manifest-section pattern */
.platform-card {
  position: relative;
  overflow: hidden;
  background: var(--bg-surface);
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  margin-bottom: 6px;
}

.platform-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.platform-status {
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.05em;
}

.status-docked {
  color: var(--green);
}
.status-transit {
  color: var(--cyan);
}
.status-returning {
  color: var(--text-muted);
}

/* Transit info — matches transit-item pattern */
.transit-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--cyan);
  padding: 5px 0;
}

/* Cargo — matches capacity-bar pattern from ShipmentPanel */
.cargo-section {
  margin-bottom: 6px;
}

.cargo-header {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.cargo-count {
  font-weight: 400;
  letter-spacing: 0.05em;
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
  transition: width 0.2s ease;
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
  margin-bottom: 4px;
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
  padding-top: 6px;
  margin-top: 2px;
  border-top: 1px solid var(--accent-muted);
}

.reserve-label {
  color: var(--text-muted);
  letter-spacing: 0.1em;
}

.reserve-val {
  color: var(--text-secondary);
}
</style>
