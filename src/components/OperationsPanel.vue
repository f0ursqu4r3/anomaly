<template>
  <div class="operations-panel">
    <!-- Directives section -->
    <div class="section-label">DIRECTIVES</div>
    <div class="directive-list">
      <button
        v-for="d in directives"
        :key="d.value"
        class="directive-row"
        :class="{ active: game.activeDirective === d.value }"
        @click="game.setDirective(d.value)"
      >
        <SvgIcon :name="d.icon" size="sm" />
        <span class="dir-name">{{ d.label }}</span>
        <span class="dir-toggle">{{ game.activeDirective === d.value ? 'ACTIVE' : 'OFF' }}</span>
      </button>
    </div>

    <!-- Launch Platforms section -->
    <div class="section-label platforms-label">
      LAUNCH PLATFORMS
      <span v-if="platforms.length > 0" class="count-badge">{{ platforms.length }}</span>
    </div>

    <div v-if="platforms.length === 0" class="empty-state">
      No launch platforms built. Order one from Shipments.
    </div>

    <!-- HQ Rates (only shown when platforms exist) -->
    <div v-if="platforms.length > 0" class="rates-row">
      <span class="rate-label">HQ RATES</span>
      <span class="rate" :class="{ boosted: rates.metals !== 15 }">M {{ rates.metals }}cr</span>
      <span class="rate" :class="{ boosted: rates.ice !== 40 }">I {{ rates.ice }}cr</span>
      <span class="rate" :class="{ boosted: rates.rareMinerals !== 100 }">R {{ rates.rareMinerals }}cr</span>
    </div>

    <!-- Platform accordion -->
    <div v-for="platform in platforms" :key="platform.id" class="platform-row">
      <button class="platform-header" @click="togglePlatform(platform.id)">
        <span class="status-dot" :class="statusClass(platform)" />
        <span class="platform-name">{{ platformLabel(platform) }}</span>
        <span class="platform-cargo mono">{{ loaded(platform) }}/{{ getState(platform)?.capacity ?? 100 }}</span>
        <span class="platform-state" :class="statusClass(platform)">{{ statusLabel(platform) }}</span>
        <span class="expand-arrow">{{ expandedId === platform.id ? '&#x25BE;' : '&#x25B8;' }}</span>
      </button>

      <div v-if="expandedId === platform.id" class="platform-detail">
        <div v-if="getState(platform)?.status === 'docked'" class="detail-content">
          <div class="cargo-section">
            <div class="capacity-bar-bg">
              <div
                class="capacity-bar-fill"
                :class="{ full: loaded(platform) >= (getState(platform)?.capacity ?? 100) }"
                :style="{ width: (loaded(platform) / (getState(platform)?.capacity ?? 100)) * 100 + '%' }"
              />
            </div>
            <div v-if="loaded(platform) > 0" class="cargo-breakdown">
              <span v-if="getState(platform)!.cargo.metals > 0" class="cargo-item">{{ Math.round(getState(platform)!.cargo.metals) }}m</span>
              <span v-if="getState(platform)!.cargo.ice > 0" class="cargo-item">{{ Math.round(getState(platform)!.cargo.ice) }}i</span>
              <span v-if="getState(platform)!.cargo.rareMinerals > 0" class="cargo-item">{{ Math.round(getState(platform)!.cargo.rareMinerals) }}r</span>
              <span class="cargo-estimate">~{{ estimate(platform) }}cr</span>
            </div>
          </div>
          <div class="controls">
            <button class="action-btn green" :disabled="loaded(platform) === 0" @click="game.launchExport(platform.id, false)">LAUNCH</button>
            <button class="action-btn amber" :disabled="loaded(platform) === 0" @click="game.launchExport(platform.id, true)">FORCE</button>
            <button class="action-btn" :class="{ active: getState(platform)?.autoLaunch }" @click="game.toggleAutoLaunch(platform.id)">
              {{ getState(platform)?.autoLaunch ? 'AUTO ON' : 'AUTO' }}
            </button>
          </div>
        </div>
        <div v-else class="detail-content">
          <span v-if="getState(platform)?.status === 'in_transit'" class="transit-eta">
            EN ROUTE &mdash; {{ transitEta(platform) }}
          </span>
          <span v-else class="transit-eta returning">
            RETURNING &mdash; {{ returnEta(platform) }}
          </span>
        </div>
      </div>
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
import { ref, computed } from 'vue'
import type { Building, Directive } from '@/stores/gameStore'
import { useGameStore } from '@/stores/gameStore'
import { getCurrentRates, calculatePayoutEstimate } from '@/systems/economy'
import SvgIcon from './SvgIcon.vue'

const game = useGameStore()

// --- Directives ---

const directives: { value: Directive; label: string; icon: string }[] = [
  { value: 'mining', label: 'Prioritize Extraction', icon: 'mining' },
  { value: 'safety', label: 'Prioritize Safety', icon: 'safety' },
  { value: 'balanced', label: 'Balanced Ops', icon: 'balanced' },
  { value: 'emergency', label: 'Emergency Protocol', icon: 'emergency' },
]

// --- Platforms ---

const expandedId = ref<string | null>(null)
const rates = computed(() => getCurrentRates(game.totalPlaytimeMs))
const platforms = computed(() => game.operationalPlatforms)
const autoReserves = computed(() => game.exportAutoReserves)

function togglePlatform(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function getState(platform: Building) {
  return game.exportPlatforms[platform.id]
}

function loaded(platform: Building): number {
  const ep = getState(platform)
  if (!ep) return 0
  return Math.round(ep.cargo.metals + ep.cargo.ice + ep.cargo.rareMinerals)
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
  return 'LOADING'
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
.operations-panel {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 8px 10px;
}

.section-label {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.platforms-label {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.count-badge {
  background: var(--accent-dim);
  color: var(--text-secondary);
  font-size: 0.5625rem;
  padding: 1px 5px;
  border-radius: var(--radius-xs);
}

/* Directives */
.directive-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.directive-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-surface);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  width: 100%;
  cursor: pointer;
  transition: all 0.15s;
}

.directive-row.active {
  border-color: var(--cyan);
  background: var(--accent-dim);
}

.directive-row .dir-name {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  text-align: left;
}

.directive-row .dir-toggle {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--text-muted);
}

.directive-row.active .dir-toggle {
  color: var(--cyan);
}

/* Empty state */
.empty-state {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--text-muted);
  padding: 12px 10px;
  text-align: center;
  font-style: italic;
}

/* HQ Rates */
.rates-row {
  display: flex;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  padding: 5px 10px;
  background: var(--accent-dim);
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
  flex-wrap: wrap;
  align-items: baseline;
}

.rate-label {
  color: var(--text-muted);
  font-size: 0.625rem;
  letter-spacing: 0.1em;
}

.rate { color: var(--text-secondary); }
.rate.boosted {
  color: var(--green);
  text-shadow: 0 0 6px var(--green-glow);
}

/* Platform accordion */
.platform-row {
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-sm);
  margin-bottom: 4px;
  overflow: hidden;
}

.platform-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-surface);
  width: 100%;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  border: none;
  color: var(--text-primary);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.status-docked { background: var(--green); box-shadow: 0 0 4px var(--green-glow); }
.status-dot.status-transit { background: var(--amber); box-shadow: 0 0 4px var(--amber-glow); }
.status-dot.status-returning { background: var(--text-muted); }

.platform-name { flex: 1; text-align: left; color: var(--text-primary); }
.platform-cargo { color: var(--text-secondary); font-size: 0.625rem; }
.platform-state { font-size: 0.625rem; }
.platform-state.status-docked { color: var(--green); }
.platform-state.status-transit { color: var(--amber); }
.platform-state.status-returning { color: var(--text-muted); }

.expand-arrow { color: var(--text-muted); font-size: 0.75rem; }

/* Expanded detail */
.platform-detail {
  border-top: 1px solid var(--accent-muted);
  background: var(--bg-deep);
}

.detail-content {
  padding: 8px 10px;
}

.cargo-section { margin-bottom: 6px; }

.capacity-bar-bg {
  height: 4px;
  background: var(--bg-primary);
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

.capacity-bar-fill.full { background: var(--amber); }

.cargo-breakdown {
  display: flex;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.625rem;
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
}

.action-btn {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  letter-spacing: 0.05em;
  padding: 6px 12px;
  border: 1px solid var(--accent-muted);
  background: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
  min-height: 32px;
  transition: all 0.15s;
}

.action-btn.green { border-color: var(--green); color: var(--green); }
.action-btn.amber { border-color: var(--amber); color: var(--amber); }
.action-btn.active { background: var(--bg-elevated); border-color: var(--cyan); color: var(--cyan); }
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.transit-eta {
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--cyan);
}

.transit-eta.returning {
  color: var(--text-muted);
}

/* Reserves */
.reserves {
  display: flex;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  align-items: baseline;
  padding-top: 6px;
  margin-top: 4px;
  border-top: 1px solid var(--accent-muted);
}

.reserve-label { color: var(--text-muted); letter-spacing: 0.1em; }
.reserve-val { color: var(--text-secondary); }
</style>
