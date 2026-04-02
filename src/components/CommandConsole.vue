<template>
  <div class="command-console">
    <!-- Close lens: normal tabs -->
    <template v-if="lens === 'close'">
      <div class="console-tabs">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="tab-btn"
          :class="{ active: tab === t.id }"
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </div>
      <div class="console-content">
        <MessageLog v-if="tab === 'log'" />
        <ShipmentPanel v-if="tab === 'shipments'" />
        <DirectivePanel v-if="tab === 'directives'" />
        <ExportPanel v-if="tab === 'export'" />
      </div>
    </template>

    <!-- Medium lens: moon operator console -->
    <template v-else>
      <!-- Moon status bar -->
      <div class="moon-status-bar">
        <span class="moon-stat">
          <span class="moon-stat-label">OUTPOSTS</span>
          <span class="moon-stat-value green">{{ moon.activeOutposts.length }}</span>
        </span>
        <span class="moon-stat">
          <span class="moon-stat-label">AWAY</span>
          <span class="moon-stat-value amber">{{ moon.awayCount }}</span>
        </span>
        <span class="moon-stat">
          <span class="moon-stat-label">MISSIONS</span>
          <span class="moon-stat-value cyan">{{ moon.activeMissions.length }}</span>
        </span>
        <button
          class="ping-btn"
          :class="{ charging: moon.pingCharging, cooldown: pingOnCooldown }"
          :disabled="!pingReady && !moon.pingCharging"
          @click="doPing"
        >
          <template v-if="moon.pingCharging">
            <span class="ping-label">CHARGING</span>
            <span class="ping-progress-bar">
              <span class="ping-progress-fill" :style="{ width: pingChargePercent + '%' }"></span>
            </span>
          </template>
          <template v-else-if="pingOnCooldown">
            <span class="ping-label">PING</span>
            <span class="ping-cooldown-text">{{ pingCooldownDisplay }}s</span>
          </template>
          <template v-else>
            <span class="ping-label">PING</span>
          </template>
        </button>
      </div>

      <!-- Moon console content -->
      <div class="console-content moon-console-content">
        <!-- Selected sector details -->
        <div v-if="selectedSector" class="sector-detail">
          <div class="sector-header">
            <span class="sector-terrain" :style="{ color: selectedTerrainConfig.color }">
              {{ selectedTerrainConfig.label.toUpperCase() }}
            </span>
            <span class="sector-coords">({{ selectedSector.q }}, {{ selectedSector.r }})</span>
            <button class="sector-close" @click="moon.selectSector(null)">&times;</button>
          </div>

          <p class="sector-desc">{{ selectedTerrainConfig.description }}</p>

          <!-- Scan signature info -->
          <div v-if="selectedSector.scanSignature && !selectedSector.deposit" class="sector-info cyan">
            {{ selectedSector.scanSignature.qualityHint }} of {{ selectedSector.scanSignature.depositType }}
          </div>

          <!-- Confirmed deposit info -->
          <div v-if="selectedSector.deposit" class="sector-info green">
            {{ selectedSector.deposit.quality }} {{ selectedSector.deposit.type }} &mdash;
            {{ selectedSector.deposit.remainingYield }}/{{ selectedSector.deposit.totalYield }} remaining
          </div>

          <!-- Outpost management -->
          <div v-if="selectedOutpost" class="outpost-section">
            <div class="outpost-name">{{ selectedOutpost.name }}</div>
            <div class="outpost-stats">
              <span>Crew: {{ selectedOutpost.crewIds.length }}</span>
              <span>Stockpile: {{ totalStockpile(selectedOutpost) }}</span>
              <span v-if="selectedSector.deposit">Deposit: {{ selectedSector.deposit.remainingYield }} left</span>
            </div>
            <div class="sector-actions">
              <button
                class="action-btn green"
                :disabled="totalStockpile(selectedOutpost) <= 0"
                @click="doLaunchPayload(selectedOutpost!.id)"
              >
                LAUNCH PAYLOAD
              </button>
              <button
                class="action-btn red"
                @click="doAbandon(selectedOutpost!.id)"
              >
                ABANDON
              </button>
            </div>
          </div>

          <!-- Action buttons (no outpost) -->
          <div v-else class="sector-actions">
            <!-- Survey -->
            <template v-if="selectedSector.status === 'scanned' && selectedSector.scanSignature">
              <button
                v-if="!showCrewSelect"
                class="action-btn amber"
                @click="openCrewSelect('survey')"
              >
                SEND SURVEY TEAM
              </button>
            </template>

            <!-- Establish outpost -->
            <template v-if="selectedSector.status === 'surveyed' && selectedSector.deposit && !selectedSector.outpostId">
              <button
                v-if="!showCrewSelect"
                class="action-btn green"
                :disabled="!canAffordOutpost"
                @click="openCrewSelect('outpost')"
              >
                ESTABLISH OUTPOST (30 metals, 50 cr)
              </button>
            </template>

            <!-- Crew selector -->
            <div v-if="showCrewSelect" class="crew-select">
              <div class="crew-label">
                Select crew ({{ crewAction === 'survey' ? '2-3' : '2+' }} required):
              </div>
              <div class="crew-list">
                <label
                  v-for="col in availableColonists"
                  :key="col.id"
                  class="crew-option"
                >
                  <input
                    type="checkbox"
                    :value="col.id"
                    v-model="selectedCrewIds"
                    :disabled="crewAction === 'survey' && selectedCrewIds.length >= 3 && !selectedCrewIds.includes(col.id)"
                  />
                  {{ col.name }}
                  <span class="crew-trait">{{ SKILL_TRAIT_LABELS[col.skillTrait] }}</span>
                  <span v-if="getExpertiseLabel(col)" class="crew-expertise">{{ getExpertiseLabel(col) }}</span>
                </label>
              </div>
              <div class="crew-actions">
                <button
                  class="action-btn"
                  :class="crewAction === 'survey' ? 'amber' : 'green'"
                  :disabled="!crewSelectionValid"
                  @click="confirmCrew"
                >
                  CONFIRM
                </button>
                <button class="action-btn dim" @click="showCrewSelect = false">CANCEL</button>
              </div>
            </div>
          </div>
        </div>

        <!-- No sector selected: overview -->
        <div v-else class="moon-overview">
          <!-- Active outposts -->
          <div v-if="moon.activeOutposts.length > 0" class="overview-section">
            <div class="overview-heading">ACTIVE OUTPOSTS</div>
            <div
              v-for="outpost in moon.activeOutposts"
              :key="outpost.id"
              class="overview-item"
              @click="moon.selectSector(outpost.sectorId)"
            >
              <span class="overview-item-name green">{{ outpost.name }}</span>
              <span class="overview-item-detail">
                Crew {{ outpost.crewIds.length }}
                &middot; Stock {{ totalStockpile(outpost) }}
                <template v-if="outpostSector(outpost)?.deposit">
                  &middot; {{ outpostSector(outpost)!.deposit!.remainingYield }} left
                </template>
              </span>
            </div>
          </div>

          <!-- Active missions -->
          <div v-if="moon.activeMissions.length > 0" class="overview-section">
            <div class="overview-heading">SURVEY MISSIONS</div>
            <div
              v-for="mission in moon.activeMissions"
              :key="mission.id"
              class="overview-item"
              @click="moon.selectSector(mission.sectorId)"
            >
              <span class="overview-item-name amber">
                Sector {{ missionSectorCoords(mission) }}
              </span>
              <span class="overview-item-detail">
                {{ missionStatusLabel(mission) }}
                &middot; Crew {{ mission.colonistIds.length }}
              </span>
            </div>
          </div>

          <!-- Empty state -->
          <div
            v-if="moon.activeOutposts.length === 0 && moon.activeMissions.length === 0"
            class="overview-empty"
          >
            Tap a sector on the surface map to inspect it.
          </div>
        </div>
      </div>
    </template>

    <div class="console-statusbar">
      <span class="status-item">
        <span class="status-label">CREDITS</span>
        <span class="status-val mono credits">
          <SvgIcon name="credits" size="xs" />${{ fmtCredits(game.credits) }}
        </span>
      </span>
      <span class="status-item">
        <span class="status-label">INCOME</span>
        <span class="status-val mono">+${{ game.creditRate.toFixed(1) }}/s</span>
      </span>
      <span class="status-item">
        <span class="status-label">CREW</span>
        <span class="status-val mono">
          <SvgIcon name="crew" size="xs" />{{ game.aliveColonists.length }}/{{
            game.colonists.length
          }}
        </span>
      </span>
      <span class="status-item">
        <span class="status-label">MODE</span>
        <span class="status-val mono directive-badge">{{ directiveShort }}</span>
      </span>
      <button class="settings-btn" @click="$emit('openSettings')">&#x2699;</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useMoonStore, PING_CHARGE_MS, OUTPOST_ESTABLISH_COST_METALS, OUTPOST_ESTABLISH_COST_CREDITS } from '@/stores/moonStore'
import { useLensView } from '@/composables/useLensView'
import { TERRAIN_CONFIGS } from '@/systems/sectorGen'
import { getExpertiseLabel } from '@/systems/colonistIdentity'
import { SKILL_TRAIT_LABELS } from '@/types/colonist'

defineEmits<{ openSettings: [] }>()
import SvgIcon from './SvgIcon.vue'
import MessageLog from './MessageLog.vue'
import ShipmentPanel from './ShipmentPanel.vue'
import DirectivePanel from './DirectivePanel.vue'
import ExportPanel from './ExportPanel.vue'

import type { Outpost, SurveyMission } from '@/types/moon'

const game = useGameStore()
const moon = useMoonStore()
const { lens } = useLensView()

const tab = ref<'log' | 'shipments' | 'directives' | 'export'>('log')

const tabs = computed(() => {
  const t: { id: 'log' | 'shipments' | 'directives' | 'export'; label: string }[] = [
    { id: 'log', label: 'COMMS' },
    { id: 'shipments', label: 'SHIPMENTS' },
  ]
  if (game.operationalPlatforms.length > 0) {
    t.push({ id: 'export', label: 'EXPORT' })
  }
  t.push({ id: 'directives', label: 'DIRECTIVES' })
  return t
})

const directiveShort = computed(() => {
  const map: Record<string, string> = {
    mining: 'MINE',
    safety: 'SAFE',
    balanced: 'BAL',
    emergency: 'EMRG',
  }
  return map[game.activeDirective] || 'BAL'
})

function fmtCredits(n: number): string {
  if (n < 10) return n.toFixed(1)
  return Math.floor(n).toString()
}

// ── Moon: Ping ──

const pingReady = computed(() => {
  return !moon.pingCharging && game.totalPlaytimeMs >= moon.pingCooldownUntil
})

const pingOnCooldown = computed(() => {
  return !moon.pingCharging && game.totalPlaytimeMs < moon.pingCooldownUntil
})

const pingCooldownDisplay = computed(() => {
  const remaining = Math.max(0, moon.pingCooldownUntil - game.totalPlaytimeMs)
  return Math.ceil(remaining / 1000)
})

const pingChargePercent = computed(() => {
  if (!moon.pingCharging) return 0
  const elapsed = game.totalPlaytimeMs - moon.pingChargeStartedAt
  return Math.min(100, (elapsed / PING_CHARGE_MS) * 100)
})

function doPing() {
  moon.initiatePing(game.totalPlaytimeMs)
}

// ── Moon: Sector selection ──

const selectedSector = computed(() => moon.selectedSector)

const selectedTerrainConfig = computed(() =>
  selectedSector.value ? TERRAIN_CONFIGS[selectedSector.value.terrain] : TERRAIN_CONFIGS.rocky,
)

const selectedOutpost = computed(() => {
  if (!selectedSector.value?.outpostId) return null
  return moon.outposts.find((o) => o.id === selectedSector.value!.outpostId) ?? null
})

const showCrewSelect = ref(false)
const crewAction = ref<'survey' | 'outpost'>('survey')
const selectedCrewIds = ref<string[]>([])

// Reset crew select when sector changes
watch(selectedSector, () => {
  showCrewSelect.value = false
  selectedCrewIds.value = []
})

const availableColonists = computed(() => {
  const away = moon.awayColonistIds
  return game.colonists.filter((c) => c.health > 0 && !away.has(c.id))
})

const canAffordOutpost = computed(
  () => game.metals >= OUTPOST_ESTABLISH_COST_METALS && game.credits >= OUTPOST_ESTABLISH_COST_CREDITS,
)

const crewSelectionValid = computed(() => {
  const count = selectedCrewIds.value.length
  if (crewAction.value === 'survey') return count >= 2 && count <= 3
  return count >= 2
})

function openCrewSelect(action: 'survey' | 'outpost') {
  crewAction.value = action
  selectedCrewIds.value = []
  showCrewSelect.value = true
}

function totalStockpile(outpost: Outpost): number {
  return Math.floor(outpost.stockpile.metals + outpost.stockpile.ice + outpost.stockpile.rareMinerals)
}

// ── Moon: Actions ──

function confirmCrew() {
  if (!selectedSector.value || !crewSelectionValid.value) return

  if (crewAction.value === 'survey') {
    moon.launchSurvey(
      selectedSector.value.id,
      selectedCrewIds.value,
      game.totalPlaytimeMs,
      game.pushMessage,
    )
  } else {
    moon.establishOutpost(
      selectedSector.value.id,
      selectedCrewIds.value,
      game.totalPlaytimeMs,
      () => {
        if (game.metals < OUTPOST_ESTABLISH_COST_METALS || game.credits < OUTPOST_ESTABLISH_COST_CREDITS) return false
        game.metals -= OUTPOST_ESTABLISH_COST_METALS
        game.credits -= OUTPOST_ESTABLISH_COST_CREDITS
        return true
      },
      game.pushMessage,
    )
  }

  showCrewSelect.value = false
  selectedCrewIds.value = []
  moon.selectSector(null)
}

function doLaunchPayload(outpostId: string) {
  moon.launchFromOutpost(outpostId, game.totalPlaytimeMs, game.pushMessage)
}

function doAbandon(outpostId: string) {
  moon.abandonOutpost(outpostId, (cid: string) => {
    const c = game.colonists.find((col) => col.id === cid)
    if (c) c.currentZone = 'habitat'
  }, game.pushMessage)
  moon.selectSector(null)
}

// ── Moon: Overview helpers ──

function outpostSector(outpost: Outpost) {
  return moon.sectors.find((s) => s.id === outpost.sectorId) ?? null
}

function missionSectorCoords(mission: SurveyMission): string {
  const sector = moon.sectors.find((s) => s.id === mission.sectorId)
  return sector ? `${sector.q},${sector.r}` : '?,?'
}

function missionStatusLabel(mission: SurveyMission): string {
  switch (mission.status) {
    case 'traveling': return 'En route'
    case 'surveying': return 'Surveying'
    case 'returning': return 'Returning'
    default: return mission.status
  }
}
</script>

<style scoped>
.command-console {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border-top: 1px solid var(--accent-muted);
}

@media (orientation: landscape), (min-width: 768px) {
  .command-console {
    border-top: none;
    border-left: 1px solid var(--accent-muted);
  }
}

.console-tabs {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--accent-dim);
}

.tab-btn {
  flex: 1;
  padding: 10px 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-secondary);
  background: transparent;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.tab-btn.active {
  color: var(--cyan);
  border-bottom-color: var(--cyan);
}

.console-content {
  flex: 1;
  overflow: hidden;
  display: flex;
}

.console-statusbar {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 5px 8px calc(var(--safe-bottom) + 4px);
  background: var(--bg-deep);
  border-top: 1px solid var(--accent-dim);
  flex-shrink: 0;
}

.status-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.status-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
}

.status-val {
  font-size: 12px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 2px;
}

.status-val.credits {
  color: var(--amber);
}

.directive-badge {
  color: var(--cyan);
}

.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
}

.settings-btn:hover {
  color: var(--text-primary);
}

/* ── Moon status bar ── */

.moon-status-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
  background: var(--bg-deep);
  border-bottom: 1px solid var(--accent-dim);
  font-family: var(--font-mono);
  font-size: 10px;
  flex-shrink: 0;
}

.moon-stat {
  display: flex;
  align-items: center;
  gap: 5px;
}

.moon-stat-label {
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}

.moon-stat-value {
  font-weight: 600;
}

.moon-stat-value.green { color: var(--green); }
.moon-stat-value.amber { color: var(--amber); }
.moon-stat-value.cyan { color: var(--cyan); }

/* ── Ping button ── */

.ping-btn {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.05em;
  padding: 6px 12px;
  border: 1px solid var(--cyan);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--cyan);
  cursor: pointer;
  min-height: 36px;
  min-width: 64px;
}

.ping-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  border-color: var(--accent-muted);
  color: var(--text-muted);
}

.ping-btn.charging {
  border-color: var(--amber);
  color: var(--amber);
}

.ping-btn.cooldown {
  border-color: var(--accent-muted);
  color: var(--text-muted);
}

.ping-btn:not(:disabled):hover {
  background: rgba(126, 207, 255, 0.08);
}

.ping-label {
  font-weight: 700;
}

.ping-cooldown-text {
  font-size: 10px;
}

.ping-progress-bar {
  width: 32px;
  height: 4px;
  background: rgba(245, 158, 11, 0.15);
  border-radius: 2px;
  overflow: hidden;
}

.ping-progress-fill {
  height: 100%;
  background: var(--amber);
  transition: width 0.3s linear;
}

/* ── Moon console content ── */

.moon-console-content {
  flex-direction: column;
  overflow-y: auto;
  padding: 12px;
  gap: 0;
}

/* ── Sector detail ── */

.sector-detail {
  font-family: var(--font-mono);
  font-size: 11px;
}

.sector-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.sector-terrain {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.sector-coords {
  color: var(--text-secondary);
  font-size: 10px;
}

.sector-close {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  font-family: var(--font-mono);
}

.sector-desc {
  color: var(--text-secondary);
  margin: 0 0 8px;
  font-size: 10px;
  line-height: 1.4;
}

.sector-info {
  font-size: 10px;
  margin-bottom: 8px;
  padding: 4px 8px;
  border-left: 2px solid;
}

.sector-info.cyan {
  color: var(--cyan);
  border-color: var(--cyan);
}

.sector-info.green {
  color: var(--green);
  border-color: var(--green);
}

/* ── Outpost section ── */

.outpost-section {
  margin-top: 6px;
}

.outpost-name {
  color: var(--green);
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 4px;
}

.outpost-stats {
  display: flex;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

/* ── Actions ── */

.sector-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
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

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn.cyan { color: var(--cyan); border-color: var(--cyan); }
.action-btn.amber { color: var(--amber); border-color: var(--amber); }
.action-btn.green { color: var(--green); border-color: var(--green); }
.action-btn.red { color: var(--red); border-color: var(--red); }
.action-btn.dim { color: var(--text-muted); }

.action-btn:not(:disabled):hover {
  background: var(--bg-elevated);
}

/* ── Crew selector ── */

.crew-select {
  width: 100%;
}

.crew-label {
  color: var(--text-secondary);
  font-size: 10px;
  margin-bottom: 6px;
}

.crew-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-bottom: 8px;
}

.crew-option {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-primary);
  font-size: 10px;
  cursor: pointer;
}

.crew-option input[type="checkbox"] {
  accent-color: var(--cyan);
}

.crew-trait {
  color: var(--cyan);
  font-family: var(--font-mono);
  font-size: 10px;
  margin-left: 6px;
  opacity: 0.7;
}

.crew-expertise {
  color: var(--amber);
  font-family: var(--font-mono);
  font-size: 10px;
  margin-left: 6px;
  opacity: 0.7;
}

.crew-actions {
  display: flex;
  gap: 8px;
}

/* ── Moon overview ── */

.moon-overview {
  font-family: var(--font-mono);
  font-size: 11px;
}

.overview-section {
  margin-bottom: 16px;
}

.overview-heading {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--accent-dim);
}

.overview-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background 0.1s, border-color 0.1s;
}

.overview-item:hover {
  background: var(--bg-surface);
  border-left-color: var(--accent-muted);
}

.overview-item-name {
  font-weight: 600;
  font-size: 11px;
}

.overview-item-name.green { color: var(--green); }
.overview-item-name.amber { color: var(--amber); }

.overview-item-detail {
  font-size: 10px;
  color: var(--text-secondary);
}

.overview-empty {
  color: var(--text-muted);
  font-size: 10px;
  padding: 20px 8px;
  text-align: center;
  line-height: 1.5;
}
</style>
