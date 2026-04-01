import { defineStore } from 'pinia'
import type {
  MoonState,
  Sector,
  SurveyMission,
  SurveyStatus,
  Outpost,
  OutpostLaunch,
  Deposit,
  DepositType,
  DepositQuality,
  ScanSignature,
  SurveyIncident,
  OutpostStockpile,
} from '@/types/moon'
import {
  generateSectors,
  getAdjacentSectorIds,
  travelTimeMs,
  TERRAIN_CONFIGS,
  COLONY_SECTOR_ID,
  hexDistance,
} from '@/systems/sectorGen'
import { uid } from '@/stores/gameStore'

// ── Constants ─────────────────────────────────────────────────────────

export const SCAN_DURATION_MS = 45_000
export const SURVEY_ONSITE_MS = 90_000
export const OUTPOST_EXTRACT_INTERVAL_MS = 10_000
export const OUTPOST_LAUNCH_LOAD_MS = 15_000
export const OUTPOST_ESTABLISH_COST_METALS = 30
export const OUTPOST_ESTABLISH_COST_CREDITS = 50

const OUTPOST_NAMES = [
  'Outpost Alpha',
  'Outpost Bravo',
  'Outpost Charlie',
  'Outpost Delta',
  'Outpost Echo',
  'Outpost Foxtrot',
  'Outpost Golf',
  'Outpost Hotel',
]

const QUALITY_WEIGHTS: { quality: DepositQuality; weight: number }[] = [
  { quality: 'poor', weight: 0.4 },
  { quality: 'moderate', weight: 0.4 },
  { quality: 'rich', weight: 0.2 },
]

const YIELD_RANGES: Record<DepositQuality, [number, number]> = {
  poor: [50, 100],
  moderate: [150, 300],
  rich: [400, 700],
}

const QUALITY_HINTS: Record<DepositQuality, string> = {
  poor: 'Faint traces',
  moderate: 'Moderate signatures',
  rich: 'Strong readings',
}

// ── Helpers ───────────────────────────────────────────────────────────

function pickQuality(): DepositQuality {
  let roll = Math.random()
  for (const { quality, weight } of QUALITY_WEIGHTS) {
    roll -= weight
    if (roll <= 0) return quality
  }
  return 'poor'
}

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function freshMoonState(): MoonState {
  return {
    sectors: [],
    outposts: [],
    surveyMissions: [],
    outpostLaunches: [],
    scanQueue: [],
    activeScanId: null,
    scanStartedAt: 0,
  }
}

// ── Store ─────────────────────────────────────────────────────────────

export const useMoonStore = defineStore('moon', {
  state: (): MoonState => freshMoonState(),

  getters: {
    scannableSectors(s): Sector[] {
      return s.sectors.filter(
        (sec) =>
          sec.status === 'visible' &&
          sec.id !== COLONY_SECTOR_ID &&
          !s.scanQueue.includes(sec.id) &&
          s.activeScanId !== sec.id,
      )
    },

    availableForOutpost(s): Sector[] {
      return s.sectors.filter(
        (sec) =>
          sec.status === 'surveyed' &&
          sec.deposit !== null &&
          sec.deposit.remainingYield > 0 &&
          sec.outpostId === null,
      )
    },

    activeMissions(s): SurveyMission[] {
      return s.surveyMissions.filter(
        (m) => m.status !== 'complete' && m.status !== 'failed',
      )
    },

    activeOutposts(s): Outpost[] {
      return s.outposts.filter((o) => o.status === 'active')
    },

    awayColonistIds(s): Set<string> {
      const ids = new Set<string>()
      // Colonists on active survey missions
      for (const m of s.surveyMissions) {
        if (m.status !== 'complete' && m.status !== 'failed') {
          for (const cid of m.colonistIds) ids.add(cid)
        }
      }
      // Colonists stationed at active outposts
      for (const o of s.outposts) {
        if (o.status === 'active' || o.status === 'damaged') {
          for (const cid of o.crewIds) ids.add(cid)
        }
      }
      return ids
    },

    awayCount(): number {
      return this.awayColonistIds.size
    },
  },

  actions: {
    initialize(seed: number) {
      const state = freshMoonState()
      state.sectors = generateSectors(seed, 3)
      this.$patch(state)
    },

    // ── Scanning ──

    queueScan(sectorId: string) {
      const sector = this.sectors.find((s) => s.id === sectorId)
      if (!sector || sector.status !== 'visible') return
      if (this.scanQueue.includes(sectorId)) return
      this.scanQueue.push(sectorId)
    },

    tickScanning(
      totalPlaytimeMs: number,
      pushMessage: (text: string, sev: 'info' | 'warning' | 'critical' | 'event') => void,
    ) {
      // Start next scan if idle
      if (!this.activeScanId && this.scanQueue.length > 0) {
        const nextId = this.scanQueue.shift()!
        const sector = this.sectors.find((s) => s.id === nextId)
        if (sector && sector.status === 'visible') {
          this.activeScanId = nextId
          this.scanStartedAt = totalPlaytimeMs
          sector.status = 'scanning'
          pushMessage(`Orbital scan initiated: sector ${sector.q},${sector.r} (${TERRAIN_CONFIGS[sector.terrain].label}).`, 'info')
        } else {
          this.activeScanId = null
        }
      }

      // Check scan completion
      if (this.activeScanId) {
        const elapsed = totalPlaytimeMs - this.scanStartedAt
        if (elapsed >= SCAN_DURATION_MS) {
          const sector = this.sectors.find((s) => s.id === this.activeScanId)
          if (sector) {
            sector.status = 'scanned'

            // 70% chance a deposit is found
            if (Math.random() < 0.7) {
              const terrainConfig = TERRAIN_CONFIGS[sector.terrain]
              const depositType =
                terrainConfig.depositTypes[
                  Math.floor(Math.random() * terrainConfig.depositTypes.length)
                ]
              const quality = pickQuality()

              // Store pending deposit for survey confirmation (serialized with state)
              sector._pendingDeposit = { type: depositType, quality }

              sector.scanSignature = {
                depositType,
                qualityHint: QUALITY_HINTS[quality],
              }

              pushMessage(
                `Scan complete: ${QUALITY_HINTS[quality]} of ${depositType} detected in sector ${sector.q},${sector.r}.`,
                'event',
              )
            } else {
              sector.scanSignature = null
              pushMessage(
                `Scan complete: No significant deposits in sector ${sector.q},${sector.r}.`,
                'info',
              )
            }

            // Reveal adjacent hidden sectors
            const adjacentIds = getAdjacentSectorIds(sector.q, sector.r)
            for (const adjId of adjacentIds) {
              const adj = this.sectors.find((s) => s.id === adjId)
              if (adj && adj.status === 'hidden') {
                adj.status = 'visible'
              }
            }
          }

          this.activeScanId = null
          this.scanStartedAt = 0
        }
      }
    },

    // ── Surveys ──

    launchSurvey(
      sectorId: string,
      colonistIds: string[],
      totalPlaytimeMs: number,
      pushMessage: (text: string, sev: 'info' | 'warning' | 'critical' | 'event') => void,
    ) {
      const sector = this.sectors.find((s) => s.id === sectorId)
      if (!sector || sector.status !== 'scanned' || !sector.scanSignature) return

      const travel = travelTimeMs(sector.q, sector.r)
      const mission: SurveyMission = {
        id: uid(),
        sectorId,
        colonistIds: [...colonistIds],
        status: 'traveling',
        departedAt: totalPlaytimeMs,
        arrivalAt: totalPlaytimeMs + travel,
        surveyCompleteAt: totalPlaytimeMs + travel + SURVEY_ONSITE_MS,
        returnAt: totalPlaytimeMs + travel + SURVEY_ONSITE_MS + travel,
        incident: null,
      }

      this.surveyMissions.push(mission)
      pushMessage(
        `Survey team (${colonistIds.length}) dispatched to sector ${sector.q},${sector.r}. ETA ${Math.round(travel / 1000)}s.`,
        'event',
      )
    },

    tickSurveys(
      totalPlaytimeMs: number,
      pushMessage: (text: string, sev: 'info' | 'warning' | 'critical' | 'event') => void,
      returnColonist: (colonistId: string) => void,
    ) {
      for (const mission of this.surveyMissions) {
        if (mission.status === 'complete' || mission.status === 'failed') continue

        const sector = this.sectors.find((s) => s.id === mission.sectorId)
        if (!sector) continue

        if (mission.status === 'traveling' && totalPlaytimeMs >= mission.arrivalAt) {
          mission.status = 'surveying'
          pushMessage(
            `Survey team arrived at sector ${sector.q},${sector.r}. Beginning survey.`,
            'info',
          )
        }

        if (mission.status === 'surveying' && totalPlaytimeMs >= mission.surveyCompleteAt) {
          // Check for incidents
          const terrainConfig = TERRAIN_CONFIGS[sector.terrain]
          const dist = hexDistance(0, 0, sector.q, sector.r)
          const riskChance = terrainConfig.surveyRiskBase + dist * 0.05

          if (Math.random() < riskChance) {
            const affectedId =
              mission.colonistIds[Math.floor(Math.random() * mission.colonistIds.length)]
            const roll = Math.random()

            if (roll < 0.5) {
              // Injury
              mission.incident = {
                type: 'injury',
                colonistId: affectedId,
                message: `Colonist injured during survey in ${TERRAIN_CONFIGS[sector.terrain].label}.`,
              }
              // Delay return
              mission.returnAt += 15_000
              pushMessage(mission.incident.message, 'warning')
            } else if (roll < 0.85) {
              // Delay
              mission.incident = {
                type: 'delay',
                colonistId: affectedId,
                message: `Survey team delayed by difficult terrain in sector ${sector.q},${sector.r}.`,
              }
              mission.returnAt += 30_000
              pushMessage(mission.incident.message, 'warning')
            } else {
              // Lost — colonist doesn't return
              mission.incident = {
                type: 'lost',
                colonistId: affectedId,
                message: `Contact lost with a team member in sector ${sector.q},${sector.r}.`,
              }
              pushMessage(mission.incident.message, 'critical')
            }
          }

          // Confirm deposit
          const pending = sector._pendingDeposit

          if (pending) {
            const [minYield, maxYield] = YIELD_RANGES[pending.quality]
            const totalYield = randomInRange(minYield, maxYield)
            sector.deposit = {
              type: pending.type,
              quality: pending.quality,
              totalYield,
              remainingYield: totalYield,
            }
            sector._pendingDeposit = undefined

            pushMessage(
              `Survey confirmed: ${pending.quality} ${pending.type} deposit (${totalYield} units) in sector ${sector.q},${sector.r}.`,
              'event',
            )
          } else {
            pushMessage(
              `Survey complete: no exploitable deposits in sector ${sector.q},${sector.r}.`,
              'info',
            )
          }

          sector.status = 'surveyed'
          mission.status = 'returning'
          pushMessage(
            `Survey team returning from sector ${sector.q},${sector.r}.`,
            'info',
          )
        }

        if (mission.status === 'returning' && totalPlaytimeMs >= mission.returnAt) {
          mission.status = 'complete'

          // Return colonists (except lost ones)
          for (const cid of mission.colonistIds) {
            if (mission.incident?.type === 'lost' && mission.incident.colonistId === cid) {
              continue // This colonist is lost
            }
            returnColonist(cid)
          }

          pushMessage(`Survey team has returned to the colony.`, 'event')
        }
      }
    },

    // ── Outposts ──

    establishOutpost(
      sectorId: string,
      crewIds: string[],
      totalPlaytimeMs: number,
      deductResources: () => boolean,
      pushMessage: (text: string, sev: 'info' | 'warning' | 'critical' | 'event') => void,
    ): boolean {
      const sector = this.sectors.find((s) => s.id === sectorId)
      if (!sector || !sector.deposit || sector.outpostId) return false
      if (!deductResources()) return false

      const usedNames = new Set(this.outposts.map((o) => o.name))
      const name = OUTPOST_NAMES.find((n) => !usedNames.has(n)) ?? `Outpost ${this.outposts.length + 1}`

      const outpost: Outpost = {
        id: uid(),
        sectorId,
        name,
        deposit: { ...sector.deposit },
        extractionLevel: 1,
        crewIds: [...crewIds],
        stockpile: { metals: 0, ice: 0, rareMinerals: 0 },
        status: 'active',
        lastHazardAt: 0,
        establishedAt: totalPlaytimeMs,
      }

      this.outposts.push(outpost)
      sector.outpostId = outpost.id

      pushMessage(
        `${name} established in sector ${sector.q},${sector.r}. Crew of ${crewIds.length} stationed.`,
        'event',
      )
      return true
    },

    tickOutposts(
      totalPlaytimeMs: number,
      dtMs: number,
      pushMessage: (text: string, sev: 'info' | 'warning' | 'critical' | 'event') => void,
    ) {
      for (const outpost of this.outposts) {
        if (outpost.status !== 'active') continue

        // Extraction — produce resources based on deposit type and crew
        const sector = this.sectors.find((s) => s.id === outpost.sectorId)
        if (!sector || !sector.deposit || sector.deposit.remainingYield <= 0) {
          if (outpost.status === 'active') {
            outpost.status = 'depleted'
            pushMessage(`${outpost.name}: deposit depleted.`, 'warning')
          }
          continue
        }

        // Extract based on interval
        const extractAmount = (dtMs / OUTPOST_EXTRACT_INTERVAL_MS) * outpost.crewIds.length
        const actualExtract = Math.min(extractAmount, sector.deposit.remainingYield)
        sector.deposit.remainingYield -= actualExtract

        // Add to stockpile
        switch (sector.deposit.type) {
          case 'metals':
            outpost.stockpile.metals += actualExtract
            break
          case 'ice':
            outpost.stockpile.ice += actualExtract
            break
          case 'rareMinerals':
            outpost.stockpile.rareMinerals += actualExtract
            break
        }

        // Check depletion
        if (sector.deposit.remainingYield <= 0) {
          outpost.status = 'depleted'
          pushMessage(`${outpost.name}: deposit fully extracted.`, 'warning')
        }
      }
    },

    launchFromOutpost(
      outpostId: string,
      totalPlaytimeMs: number,
      pushMessage: (text: string, sev: 'info' | 'warning' | 'critical' | 'event') => void,
    ) {
      const outpost = this.outposts.find((o) => o.id === outpostId)
      if (!outpost) return

      const sector = this.sectors.find((s) => s.id === outpost.sectorId)
      if (!sector) return

      const payload: OutpostStockpile = { ...outpost.stockpile }
      const totalPayload = payload.metals + payload.ice + payload.rareMinerals
      if (totalPayload <= 0) return

      const travel = travelTimeMs(sector.q, sector.r)
      const launch: OutpostLaunch = {
        id: uid(),
        outpostId,
        payload,
        launchedAt: totalPlaytimeMs,
        arrivalAt: totalPlaytimeMs + OUTPOST_LAUNCH_LOAD_MS + travel,
      }

      this.outpostLaunches.push(launch)

      // Clear stockpile
      outpost.stockpile = { metals: 0, ice: 0, rareMinerals: 0 }

      pushMessage(
        `${outpost.name}: launch sent — ${totalPayload.toFixed(0)} units en route to colony.`,
        'event',
      )
    },

    tickLaunches(
      totalPlaytimeMs: number,
      addResources: (metals: number, ice: number) => void,
      pushMessage: (text: string, sev: 'info' | 'warning' | 'critical' | 'event') => void,
    ) {
      const arrived: string[] = []
      for (const launch of this.outpostLaunches) {
        if (totalPlaytimeMs >= launch.arrivalAt) {
          addResources(launch.payload.metals, launch.payload.ice)
          const total = Math.floor(launch.payload.metals + launch.payload.ice + launch.payload.rareMinerals)
          pushMessage(`Outpost payload arrived: ${total} units received.`, 'event')
          arrived.push(launch.id)
        }
      }
      this.outpostLaunches = this.outpostLaunches.filter(l => !arrived.includes(l.id))
    },

    abandonOutpost(
      outpostId: string,
      returnColonist: (colonistId: string) => void,
      pushMessage: (text: string, sev: 'info' | 'warning' | 'critical' | 'event') => void,
    ) {
      const outpost = this.outposts.find((o) => o.id === outpostId)
      if (!outpost) return

      for (const cid of outpost.crewIds) {
        returnColonist(cid)
      }

      outpost.status = 'abandoned'
      outpost.crewIds = []

      const sector = this.sectors.find((s) => s.id === outpost.sectorId)
      if (sector) {
        sector.outpostId = null
      }

      pushMessage(`${outpost.name} abandoned. Crew returning to colony.`, 'event')
    },
  },
})
