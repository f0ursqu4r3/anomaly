<template>
  <div class="moon-map">
    <!-- HUD bar -->
    <div class="moon-hud">
      <span class="hud-item">
        <span class="hud-label">OUTPOSTS</span>
        <span class="hud-value green">{{ moon.activeOutposts.length }}</span>
      </span>
      <span class="hud-item">
        <span class="hud-label">AWAY</span>
        <span class="hud-value amber">{{ moon.awayCount }}</span>
      </span>
      <span class="hud-item" v-if="moon.activeScanId">
        <span class="hud-label">SCANNING</span>
        <span class="hud-value cyan scanning-indicator">&#9679;</span>
      </span>
    </div>

    <!-- SVG Map -->
    <svg
      viewBox="0 0 500 500"
      class="hex-svg"
      @click.self="selectedSector = null"
    >
      <g transform="translate(250, 250)">
        <!-- Survey team paths -->
        <template v-for="mission in moon.activeMissions" :key="mission.id">
          <line
            v-if="missionTarget(mission)"
            x1="0"
            y1="0"
            :x2="missionTarget(mission)!.x"
            :y2="missionTarget(mission)!.y"
            stroke="var(--amber)"
            stroke-width="1"
            stroke-dasharray="4 3"
            opacity="0.4"
          />
          <!-- Team position marker -->
          <circle
            v-if="missionPos(mission)"
            :cx="missionPos(mission)!.x"
            :cy="missionPos(mission)!.y"
            r="4"
            fill="var(--amber)"
            opacity="0.9"
          />
        </template>

        <!-- Outpost launch markers -->
        <template v-for="launch in moon.outpostLaunches" :key="launch.id">
          <circle
            v-if="launchPos(launch)"
            :cx="launchPos(launch)!.x"
            :cy="launchPos(launch)!.y"
            r="3.5"
            fill="var(--green)"
            opacity="0.9"
          />
        </template>

        <!-- Sector hexes -->
        <SectorHex
          v-for="sector in moon.sectors"
          :key="sector.id"
          :sector="sector"
          :px="hexPx(sector.q)"
          :py="hexPy(sector.q, sector.r)"
          :hex-size="hexSize"
          @select="onSelectSector"
        />
      </g>
    </svg>

    <!-- Sector info panel -->
    <Transition name="panel-slide">
      <div v-if="selectedSector" class="sector-panel" @click.stop>
        <div class="panel-header">
          <span class="panel-terrain" :style="{ color: selectedTerrainConfig.color }">
            {{ selectedTerrainConfig.label.toUpperCase() }}
          </span>
          <span class="panel-coords">({{ selectedSector.q }}, {{ selectedSector.r }})</span>
          <button class="panel-close" @click="selectedSector = null">&times;</button>
        </div>

        <p class="panel-desc">{{ selectedTerrainConfig.description }}</p>

        <!-- Scan signature info -->
        <div v-if="selectedSector.scanSignature && !selectedSector.deposit" class="panel-info cyan">
          {{ selectedSector.scanSignature.qualityHint }} of {{ selectedSector.scanSignature.depositType }}
        </div>

        <!-- Confirmed deposit info -->
        <div v-if="selectedSector.deposit" class="panel-info green">
          {{ selectedSector.deposit.quality }} {{ selectedSector.deposit.type }} &mdash;
          {{ selectedSector.deposit.remainingYield }}/{{ selectedSector.deposit.totalYield }} remaining
        </div>

        <!-- Outpost management -->
        <div v-if="selectedOutpost" class="outpost-info">
          <div class="outpost-name">{{ selectedOutpost.name }}</div>
          <div class="outpost-stats">
            <span>Crew: {{ selectedOutpost.crewIds.length }}</span>
            <span>Stockpile: {{ totalStockpile(selectedOutpost) }}</span>
            <span v-if="selectedSector.deposit">Deposit: {{ selectedSector.deposit.remainingYield }} left</span>
          </div>
          <div class="panel-actions">
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
        <div v-else class="panel-actions">
          <!-- Scan -->
          <button
            v-if="selectedSector.status === 'visible' && selectedSector.id !== COLONY_SECTOR_ID"
            class="action-btn cyan"
            @click="doScan(selectedSector!.id)"
          >
            INITIATE SCAN
          </button>

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
              ESTABLISH OUTPOST (30m, 50cr)
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
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import SectorHex from './SectorHex.vue'
import { useMoonStore, OUTPOST_ESTABLISH_COST_METALS, OUTPOST_ESTABLISH_COST_CREDITS } from '@/stores/moonStore'
import { useGameStore } from '@/stores/gameStore'
import { TERRAIN_CONFIGS, COLONY_SECTOR_ID } from '@/systems/sectorGen'
import type { Sector, SurveyMission, OutpostLaunch, Outpost } from '@/types/moon'

const moon = useMoonStore()
const game = useGameStore()

const hexSize = 38

// ── Hex coordinate conversion ──

function hexPx(q: number): number {
  return hexSize * (3 / 2) * q
}

function hexPy(q: number, r: number): number {
  return hexSize * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r)
}

// ── Sector selection ──

const selectedSector = ref<Sector | null>(null)
const showCrewSelect = ref(false)
const crewAction = ref<'survey' | 'outpost'>('survey')
const selectedCrewIds = ref<string[]>([])

const selectedTerrainConfig = computed(() =>
  selectedSector.value ? TERRAIN_CONFIGS[selectedSector.value.terrain] : TERRAIN_CONFIGS.rocky,
)

const selectedOutpost = computed(() => {
  if (!selectedSector.value?.outpostId) return null
  return moon.outposts.find((o) => o.id === selectedSector.value!.outpostId) ?? null
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

function onSelectSector(sector: Sector) {
  selectedSector.value = sector
  showCrewSelect.value = false
  selectedCrewIds.value = []
}

function openCrewSelect(action: 'survey' | 'outpost') {
  crewAction.value = action
  selectedCrewIds.value = []
  showCrewSelect.value = true
}

function totalStockpile(outpost: Outpost): number {
  return Math.floor(outpost.stockpile.metals + outpost.stockpile.ice + outpost.stockpile.rareMinerals)
}

// ── Actions ──

function doScan(sectorId: string) {
  moon.queueScan(sectorId)
  selectedSector.value = null
}

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
    // Deduct resources
    game.metals -= OUTPOST_ESTABLISH_COST_METALS
    game.credits -= OUTPOST_ESTABLISH_COST_CREDITS
    moon.establishOutpost(
      selectedSector.value.id,
      selectedCrewIds.value,
      game.totalPlaytimeMs,
      game.pushMessage,
    )
  }

  showCrewSelect.value = false
  selectedCrewIds.value = []
  selectedSector.value = null
}

function doLaunchPayload(outpostId: string) {
  moon.launchFromOutpost(outpostId, game.totalPlaytimeMs, game.pushMessage)
}

function doAbandon(outpostId: string) {
  moon.abandonOutpost(outpostId, (cid: string) => {
    const c = game.colonists.find((col) => col.id === cid)
    if (c) c.currentZone = 'habitat'
  }, game.pushMessage)
  selectedSector.value = null
}

// ── Mission position interpolation ──

function missionTarget(mission: SurveyMission): { x: number; y: number } | null {
  const sector = moon.sectors.find((s) => s.id === mission.sectorId)
  if (!sector) return null
  return { x: hexPx(sector.q), y: hexPy(sector.q, sector.r) }
}

function missionPos(mission: SurveyMission): { x: number; y: number } | null {
  const target = missionTarget(mission)
  if (!target) return null

  const now = game.totalPlaytimeMs

  if (mission.status === 'traveling') {
    const t = Math.min(1, Math.max(0, (now - mission.departedAt) / (mission.arrivalAt - mission.departedAt)))
    return { x: target.x * t, y: target.y * t }
  }

  if (mission.status === 'surveying') {
    return target
  }

  if (mission.status === 'returning') {
    const t = Math.min(1, Math.max(0, (now - mission.surveyCompleteAt) / (mission.returnAt - mission.surveyCompleteAt)))
    return { x: target.x * (1 - t), y: target.y * (1 - t) }
  }

  return null
}

function launchPos(launch: OutpostLaunch): { x: number; y: number } | null {
  const outpost = moon.outposts.find((o) => o.id === launch.outpostId)
  if (!outpost) return null
  const sector = moon.sectors.find((s) => s.id === outpost.sectorId)
  if (!sector) return null

  const origin = { x: hexPx(sector.q), y: hexPy(sector.q, sector.r) }
  const now = game.totalPlaytimeMs
  const t = Math.min(1, Math.max(0, (now - launch.launchedAt) / (launch.arrivalAt - launch.launchedAt)))

  return { x: origin.x * (1 - t), y: origin.y * (1 - t) }
}
</script>

<style scoped>
.moon-map {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--bg-deep);
  overflow: hidden;
}

/* ── HUD bar ── */

.moon-hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 16px;
  padding: 6px 12px;
  padding-top: calc(6px + var(--safe-top));
  background: rgba(6, 6, 12, 0.85);
  border-bottom: 1px solid var(--accent-dim);
  font-family: var(--font-mono);
  font-size: 10px;
  z-index: 2;
}

.hud-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.hud-label {
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

.hud-value {
  font-weight: 600;
}

.hud-value.green { color: var(--green); }
.hud-value.amber { color: var(--amber); }
.hud-value.cyan { color: var(--cyan); }

.scanning-indicator {
  animation: pulse-opacity 1.5s ease-in-out infinite;
}

@keyframes pulse-opacity {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* ── SVG ── */

.hex-svg {
  width: 100%;
  height: 100%;
}

/* ── Sector panel ── */

.sector-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-elevated);
  border-top: 1px solid var(--accent-muted);
  padding: 12px 16px;
  padding-bottom: calc(12px + var(--safe-bottom));
  z-index: 10;
  font-family: var(--font-mono);
  font-size: 11px;
  max-height: 50%;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.panel-terrain {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.panel-coords {
  color: var(--text-muted);
  font-size: 10px;
}

.panel-close {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  font-family: var(--font-mono);
}

.panel-desc {
  color: var(--text-secondary);
  margin: 0 0 8px;
  font-size: 10px;
  line-height: 1.4;
}

.panel-info {
  font-size: 10px;
  margin-bottom: 8px;
  padding: 4px 8px;
  border-left: 2px solid;
}

.panel-info.cyan {
  color: var(--cyan);
  border-color: var(--cyan);
}

.panel-info.green {
  color: var(--green);
  border-color: var(--green);
}

/* ── Outpost info ── */

.outpost-info {
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
}

/* ── Actions ── */

.panel-actions {
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

.crew-actions {
  display: flex;
  gap: 8px;
}

/* ── Panel transition ── */

.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: transform 0.25s ease;
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  transform: translateY(100%);
}
</style>
