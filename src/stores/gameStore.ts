import { defineStore } from 'pinia'
import { Preferences } from '@capacitor/preferences'
import { simulateOffline } from './offlineEngine'
import type { OfflineEvent, OfflineResult } from './offlineEngine'
import type { Trait, Action, SkillTrait, Specialization } from '@/types/colonist'
import { randomTrait, randomSkillTrait, SPECIALIZATION_LABELS } from '@/types/colonist'
import { getBuildingPosition, getLandingPosition } from '@/systems/mapLayout'
import { updateNeeds, checkInterrupt, advanceAction, selectAction } from '@/systems/colonistAI'
import { generateChatter } from '@/systems/radioChatter'
import {
  awardXP,
  checkSpecialization,
  updateBonds,
  applyDeathMorale,
  applyHazardMorale,
  checkBreakdown,
} from '@/systems/colonistIdentity'
import {
  initEconomy,
  tickEconomy,
  getCurrentRates,
  getEconomyState,
  restoreEconomyState,
} from '@/systems/economy'
import { useSettingsStore } from '@/stores/settingsStore'
import { useMoonStore } from '@/stores/moonStore'

// ── Types ──────────────────────────────────────────────────────────

export interface Colonist {
  id: string
  name: string
  health: number
  energy: number
  morale: number
  trait: Trait
  skillTrait: SkillTrait
  extractionXP: number
  engineeringXP: number
  medicalXP: number
  specialization: Specialization | null
  bonds: Record<string, number>
  lastBreakdownAt: number | null
  currentAction: Action | null
  currentZone: string
}

export type BuildingType = 'o2generator' | 'solar' | 'extractionrig' | 'medbay' | 'partsfactory' | 'storageSilo' | 'launchplatform'

export interface Building {
  id: string
  type: BuildingType
  damaged: boolean
  x: number
  y: number
  rotation?: number
}

export interface BuildingBlueprint {
  type: BuildingType
  label: string
  description: string
  costMetals: number
  costIce: number
}

export interface HazardEvent {
  type: 'meteor' | 'powersurge' | 'gaspocket'
  message: string
  timestamp: number
}

export type Directive = 'mining' | 'safety' | 'balanced' | 'emergency'

export type ShipmentType =
  | 'supplyCrate'
  | 'equipment'
  | 'newColonist'
  | 'repairKit'
  | 'emergencyO2'
  | 'emergencyPower'

export interface ShipmentOption {
  type: ShipmentType
  label: string
  description: string
  cost: number
  weight: number // cargo weight units
  buildingType?: BuildingType
}

export interface ConsoleMessage {
  id: string
  text: string
  severity: 'info' | 'warning' | 'critical' | 'event'
  timestamp: number
}

export interface InTransitShipment {
  id: string
  contents: ShipmentOption[]
  totalWeight: number
  arrivalAt: number // totalPlaytimeMs when it arrives
}

export interface SupplyDrop {
  id: string
  contents: ShipmentOption[] // all items in this care package
  totalWeight: number
  x: number
  y: number
  state: 'landed' | 'unpacking' | 'done'
  unpackProgress: number // 0–1
  unpackDuration: number // ms to fully unpack with 1 colonist
  landedAt: number
}

export interface ExportPlatform {
  built: boolean
  status: 'docked' | 'in_transit' | 'returning'
  cargo: { metals: number; ice: number; rareMinerals: number }
  capacity: number
  launchTime: number | null
  returnTime: number | null
  estimatedCredits: number | null
  autoLaunch: boolean
  forceLaunched: boolean
  reserves: { metals: number | null; ice: number | null; rareMinerals: number | null }
}

const UNPACK_MS_PER_KG = 150 // 150ms per kg with 1 colonist (e.g. 45kg = 6.75s)
const DONE_LINGER_MS = 1500

export interface ColonyState {
  air: number
  airMax: number
  power: number
  powerMax: number
  metals: number
  ice: number
  rareMinerals: number

  colonists: Colonist[]
  buildings: Building[]
  depth: number
  maxDepth: number

  lastHazard: HazardEvent | null
  lastHazardAt: number
  hazardCooldownUntil: number

  credits: number
  totalCreditsEarned: number
  activeDirective: Directive
  messages: ConsoleMessage[]
  inTransitShipments: InTransitShipment[]
  supplyDrops: SupplyDrop[]
  repairKits: number
  lastPartsProducedAt: number
  manifest: ShipmentOption[] // items queued for next shipment
  shipmentCooldownUntil: number // totalPlaytimeMs when next shipment can launch
  autoRelaunch: boolean
  lastManifest: ShipmentOption[]
  ticksSinceLastReport: number

  gameOver: boolean
  gameOverReason: string
  isPaused: boolean
  totalPlaytimeMs: number
  lastTickAt: number
  lastSavedAt: number
  offlineEvents: OfflineEvent[]
  exportPlatform: ExportPlatform
}

// ── Constants ──────────────────────────────────────────────────────

const SAVE_KEY = 'colony-save-v4'
const LEGACY_SAVE_KEY = 'colony-save-v3'

export const AIR_CONSUMPTION_PER_COLONIST = 0.5
export const O2_PRODUCTION_PER_GENERATOR = 2.0
export const POWER_PRODUCTION_PER_SOLAR = 1.5
export const POWER_CONSUMPTION_PER_BUILDING = 0.3
export const EXTRACT_SPEED_PER_WORKER = 0.15
export const EXTRACT_SPEED_PER_RIG = 0.08
export const METALS_PER_DEPTH = 2.0
export const ICE_CHANCE_PER_TICK = 0.15
export const ICE_PER_FIND = 1.0
export const ENGINEER_EFFICIENCY_BONUS = 0.15
export const MEDBAY_HEAL_PER_SEC = 0.5
export const HEALTH_DRAIN_PER_SEC = 2.0
export const COLONIST_INJURY_VISIBLE_THRESHOLD = 0.7

export const PARTS_FACTORY_INTERVAL_MS = 45_000
export const PARTS_FACTORY_METAL_COST = 2

export const HAZARD_CHECK_INTERVAL_MS = 20_000
export const HAZARD_BASE_CHANCE = 0.02
export const HAZARD_DEPTH_SCALE = 0.00001
export const HAZARD_MIN_GAP_MS = 45_000

const STARTING_AIR = 60
export const STARTING_AIR_MAX = 125
const STARTING_POWER = 50
export const STARTING_POWER_MAX = 125
const STARTING_METALS = 10
const STARTING_ICE = 0

// Credit economy
export const BASE_CREDITS_PER_TICK = 2.0
export const CREDITS_PER_METAL_MINED = 1.0
export const CREDITS_PER_ICE_FOUND = 20.0
const SHIPMENT_TRANSIT_MS = 10_000
const EMERGENCY_TRANSIT_MS = 3_000
const MAX_MESSAGES = 50
const SHIPMENT_COOLDOWN_MS = 60_000
const MANIFEST_MAX_SLOTS = 4
const CARGO_CAPACITY = 100

// Storage caps
const BASE_STORAGE_METALS = 50
const BASE_STORAGE_ICE = 25
const BASE_STORAGE_RARE_MINERALS = 10
const SILO_BONUS_METALS = 100
const SILO_BONUS_ICE = 50
const SILO_BONUS_RARE_MINERALS = 25
const SILO_AUTO_BUILD_THRESHOLD = 0.8

// Export platform
const EXPORT_PLATFORM_BASE_CAPACITY = 100
const EXPORT_TRANSIT_MS = 120_000
const EXPORT_RETURN_MS = 180_000
const EXPORT_FORCE_RETURN_MS = 270_000
const LOAD_UNITS_PER_TRIP = 2

export { EXPORT_TRANSIT_MS, EXPORT_RETURN_MS, EXPORT_FORCE_RETURN_MS }

// Directive config
export const DIRECTIVE_RATIOS: Record<Directive, { extractor: number; engineer: number }> = {
  mining: { extractor: 0.7, engineer: 0.2 },
  safety: { extractor: 0.2, engineer: 0.6 },
  balanced: { extractor: 0.4, engineer: 0.4 },
  emergency: { extractor: 0.1, engineer: 0.8 },
}

export const DIRECTIVE_MODIFIERS: Record<
  Directive,
  { extractMult: number; hazardResist: number; prodMult: number }
> = {
  mining: { extractMult: 1.3, hazardResist: 0.0, prodMult: 1.0 },
  safety: { extractMult: 0.7, hazardResist: 0.4, prodMult: 1.2 },
  balanced: { extractMult: 1.0, hazardResist: 0.15, prodMult: 1.0 },
  emergency: { extractMult: 0.5, hazardResist: 0.1, prodMult: 1.5 },
}

export const SHIPMENT_OPTIONS: ShipmentOption[] = [
  {
    type: 'supplyCrate',
    label: 'Supply Crate',
    description: '+15 metals, +5 ice',
    cost: 600,
    weight: 20,
  },
  {
    type: 'equipment',
    label: 'Solar Panel',
    description: 'Generates power for the colony',
    cost: 800,
    weight: 18,
    buildingType: 'solar',
  },
  {
    type: 'equipment',
    label: 'O2 Generator',
    description: 'Produces breathable air',
    cost: 1000,
    weight: 32,
    buildingType: 'o2generator',
  },
  {
    type: 'equipment',
    label: 'Extraction Rig',
    description: 'Automated resource extraction',
    cost: 1300,
    weight: 55,
    buildingType: 'extractionrig',
  },
  {
    type: 'equipment',
    label: 'Med Bay',
    description: 'Heals injured crew over time',
    cost: 1500,
    weight: 40,
    buildingType: 'medbay',
  },
  {
    type: 'equipment',
    label: 'Parts Factory',
    description: 'Produces repair kits',
    cost: 800,
    weight: 30,
    buildingType: 'partsfactory',
  },
  {
    type: 'newColonist',
    label: 'New Colonist',
    description: 'Recruit crew member',
    cost: 1750,
    weight: 35,
  },
  {
    type: 'repairKit',
    label: 'Repair Kit',
    description: 'Fix one damaged building',
    cost: 250,
    weight: 5,
  },
  {
    type: 'emergencyO2',
    label: 'Emergency O2',
    description: '+30 air (fast delivery)',
    cost: 350,
    weight: 25,
  },
  {
    type: 'emergencyPower',
    label: 'Emergency Power',
    description: '+30 power (fast delivery)',
    cost: 350,
    weight: 15,
  },
]

export { MANIFEST_MAX_SLOTS, CARGO_CAPACITY, SHIPMENT_COOLDOWN_MS, SHIPMENT_TRANSIT_MS, EMERGENCY_TRANSIT_MS }

export const BLUEPRINTS: BuildingBlueprint[] = [
  {
    type: 'o2generator',
    label: 'O2 Generator',
    description: 'Produces air (uses power)',
    costMetals: 20,
    costIce: 5,
  },
  {
    type: 'solar',
    label: 'Solar Panel',
    description: 'Generates power',
    costMetals: 15,
    costIce: 0,
  },
  {
    type: 'extractionrig',
    label: 'Extraction Rig',
    description: 'Extracts metals and ice from deposits',
    costMetals: 25,
    costIce: 0,
  },
  {
    type: 'medbay',
    label: 'Med Bay',
    description: 'Heals injured colonists',
    costMetals: 30,
    costIce: 10,
  },
  {
    type: 'partsfactory',
    label: 'Parts Factory',
    description: 'Produces repair kits from metals (requires operator)',
    costMetals: 15,
    costIce: 0,
  },
  {
    type: 'storageSilo',
    label: 'Storage Silo',
    description: 'Increases resource storage capacity',
    costMetals: 20,
    costIce: 0,
  },
  {
    type: 'launchplatform',
    label: 'Launch Platform',
    description: 'Export resources to HQ for credits',
    costMetals: 30,
    costIce: 0,
  },
]

export const COLONIST_NAMES = ['Kael', 'Mira', 'Tarn', 'Vex', 'Lira', 'Cade', 'Nyx', 'Orin', 'Zara', 'Pax']

// ── Helpers ─────────────────────────────────────────────────────────

let nextId = 1
const announcedBonds = new Set<string>()
export function uid(): string {
  return `${Date.now()}-${nextId++}`
}

function makeStartingColonists(): Colonist[] {
  return [
    { id: uid(), name: 'Riko', health: 100, energy: 80, morale: 70, trait: randomTrait(), skillTrait: randomSkillTrait(), extractionXP: 0, engineeringXP: 0, medicalXP: 0, specialization: null, bonds: {}, lastBreakdownAt: null, currentAction: null, currentZone: 'habitat' },
    { id: uid(), name: 'Sable', health: 100, energy: 80, morale: 70, trait: randomTrait(), skillTrait: randomSkillTrait(), extractionXP: 0, engineeringXP: 0, medicalXP: 0, specialization: null, bonds: {}, lastBreakdownAt: null, currentAction: null, currentZone: 'habitat' },
  ]
}

function makeStartingBuildings(): Building[] {
  const b: Building[] = []
  const types: BuildingType[] = ['solar', 'o2generator', 'extractionrig']
  for (const t of types) {
    const pos = getBuildingPosition(t, b)
    b.push({ id: uid(), type: t, damaged: false, x: pos.x, y: pos.y, rotation: pos.rotation })
  }
  return b
}

function freshState(): ColonyState {
  return {
    air: STARTING_AIR,
    airMax: STARTING_AIR_MAX,
    power: STARTING_POWER,
    powerMax: STARTING_POWER_MAX,
    metals: STARTING_METALS,
    ice: STARTING_ICE,
    rareMinerals: 0,
    colonists: makeStartingColonists(),
    buildings: makeStartingBuildings(),
    depth: 0,
    maxDepth: 0,
    lastHazard: null,
    lastHazardAt: 0,
    hazardCooldownUntil: 0,
    credits: 1000,
    totalCreditsEarned: 1000,
    activeDirective: 'balanced',
    messages: [
      {
        id: uid(),
        text: 'Colony link established. You have command.',
        severity: 'event',
        timestamp: 0,
      },
      {
        id: uid(),
        text: 'Starting structures deployed: Solar, O2 Gen, Extraction Rig.',
        severity: 'info',
        timestamp: 0,
      },
    ],
    inTransitShipments: [],
    supplyDrops: [],
    repairKits: 0,
    lastPartsProducedAt: 0,
    manifest: [],
    shipmentCooldownUntil: 0,
    autoRelaunch: false,
    lastManifest: [],
    ticksSinceLastReport: 0,
    gameOver: false,
    gameOverReason: '',
    isPaused: false,
    totalPlaytimeMs: 0,
    lastTickAt: Date.now(),
    lastSavedAt: Date.now(),
    offlineEvents: [],
    exportPlatform: {
      built: false,
      status: 'docked',
      cargo: { metals: 0, ice: 0, rareMinerals: 0 },
      capacity: EXPORT_PLATFORM_BASE_CAPACITY,
      launchTime: null,
      returnTime: null,
      estimatedCredits: null,
      autoLaunch: false,
      forceLaunched: false,
      reserves: { metals: null, ice: null, rareMinerals: null },
    },
  }
}

// ── Store ───────────────────────────────────────────────────────────

export const useGameStore = defineStore('game', {
  state: (): ColonyState => freshState(),

  getters: {
    aliveColonists: (s) => s.colonists.filter((c) => c.health > 0),

    colonyColonists(s): Colonist[] {
      const moon = useMoonStore()
      const away = moon.awayColonistIds
      return s.colonists.filter(c => c.health > 0 && !away.has(c.id))
    },

    activeEngineers: (s) => s.colonists.filter(
      c => c.health > 0 && c.currentAction?.type === 'engineer' && !c.currentAction?.walkPath?.length
    ),

    activeExtractors: (s) => s.colonists.filter(
      c => c.health > 0 && c.currentAction?.type === 'extract' && !c.currentAction?.walkPath?.length
    ),

    engineerBonus(s): number {
      const atPower = s.colonists.filter(
        c => c.health > 0 && c.currentAction?.type === 'engineer' && c.currentAction?.targetZone === 'power' && !c.currentAction?.walkPath?.length
      ).length
      const atLifeSup = s.colonists.filter(
        c => c.health > 0 && c.currentAction?.type === 'engineer' && c.currentAction?.targetZone === 'lifeSup' && !c.currentAction?.walkPath?.length
      ).length
      const count = atPower + atLifeSup
      const mod = DIRECTIVE_MODIFIERS[s.activeDirective].prodMult
      return (1 + count * ENGINEER_EFFICIENCY_BONUS) * mod
    },

    airProduction(s): number {
      const generators = s.buildings.filter((b) => b.type === 'o2generator' && !b.damaged).length
      const workersAtLifeSup = s.colonists.filter(
        c => c.health > 0 && c.currentAction?.type === 'engineer' && c.currentAction?.targetZone === 'lifeSup' && !c.currentAction?.walkPath?.length
      ).length
      const mod = DIRECTIVE_MODIFIERS[s.activeDirective].prodMult
      const engBonus = (1 + workersAtLifeSup * ENGINEER_EFFICIENCY_BONUS) * mod
      return s.power > 0 ? generators * O2_PRODUCTION_PER_GENERATOR * engBonus : 0
    },

    airConsumption(s): number {
      const moon = useMoonStore()
      const away = moon.awayColonistIds
      const atColony = s.colonists.filter(c => c.health > 0 && !away.has(c.id)).length
      return atColony * AIR_CONSUMPTION_PER_COLONIST
    },

    airRate(): number {
      return this.airProduction - this.airConsumption
    },

    powerProduction(s): number {
      const solars = s.buildings.filter((b) => b.type === 'solar' && !b.damaged).length
      const workersAtPower = s.colonists.filter(
        c => c.health > 0 && c.currentAction?.type === 'engineer' && c.currentAction?.targetZone === 'power' && !c.currentAction?.walkPath?.length
      ).length
      const mod = DIRECTIVE_MODIFIERS[s.activeDirective].prodMult
      const engBonus = (1 + workersAtPower * ENGINEER_EFFICIENCY_BONUS) * mod
      return solars * POWER_PRODUCTION_PER_SOLAR * engBonus
    },

    powerConsumption(s): number {
      const activeBuildings = s.buildings.filter((b) => !b.damaged).length
      return activeBuildings * POWER_CONSUMPTION_PER_BUILDING
    },

    powerRate(): number {
      return this.powerProduction - this.powerConsumption
    },

    extractRate(s): number {
      const extractorCount = s.colonists.filter(
        c => c.health > 0 && c.currentAction?.type === 'extract' && !c.currentAction?.walkPath?.length
      ).length
      const rigCount = s.buildings.filter((b) => b.type === 'extractionrig' && !b.damaged).length
      const totalEngineers = s.colonists.filter(
        c => c.health > 0 && c.currentAction?.type === 'engineer' && !c.currentAction?.walkPath?.length
      ).length
      const mod = DIRECTIVE_MODIFIERS[s.activeDirective].extractMult
      const engBonus = 1 + totalEngineers * ENGINEER_EFFICIENCY_BONUS
      return (extractorCount * EXTRACT_SPEED_PER_WORKER + rigCount * EXTRACT_SPEED_PER_RIG) * engBonus * mod
    },

    creditRate(s): number {
      const extractorCount = s.colonists.filter(
        c => c.health > 0 && c.currentAction?.type === 'extract' && !c.currentAction?.walkPath?.length
      ).length
      const rigCount = s.buildings.filter((b) => b.type === 'extractionrig' && !b.damaged).length
      const totalEngineers = s.colonists.filter(
        c => c.health > 0 && c.currentAction?.type === 'engineer' && !c.currentAction?.walkPath?.length
      ).length
      const mod = DIRECTIVE_MODIFIERS[s.activeDirective].extractMult
      const engBonus = 1 + totalEngineers * ENGINEER_EFFICIENCY_BONUS
      const rate = (extractorCount * EXTRACT_SPEED_PER_WORKER + rigCount * EXTRACT_SPEED_PER_RIG) * engBonus * mod
      return BASE_CREDITS_PER_TICK + rate * METALS_PER_DEPTH * CREDITS_PER_METAL_MINED
    },

    manifestWeight(s): number {
      return s.manifest.reduce((sum, item) => sum + item.weight, 0)
    },

    manifestCost(s): number {
      return s.manifest.reduce((sum, item) => sum + item.cost, 0)
    },

    manifestFull(s): boolean {
      return s.manifest.length >= MANIFEST_MAX_SLOTS
    },

    shipmentOnCooldown(s): boolean {
      return s.totalPlaytimeMs < s.shipmentCooldownUntil
    },

    shipmentCooldownRemaining(s): number {
      return Math.max(0, s.shipmentCooldownUntil - s.totalPlaytimeMs)
    },

    storageCap(s): { metals: number; ice: number; rareMinerals: number } {
      const siloCount = s.buildings.filter(b => b.type === 'storageSilo' && !b.damaged).length
      return {
        metals: BASE_STORAGE_METALS + siloCount * SILO_BONUS_METALS,
        ice: BASE_STORAGE_ICE + siloCount * SILO_BONUS_ICE,
        rareMinerals: BASE_STORAGE_RARE_MINERALS + siloCount * SILO_BONUS_RARE_MINERALS,
      }
    },

    exportPlatformLoaded(s): number {
      const c = s.exportPlatform.cargo
      return c.metals + c.ice + c.rareMinerals
    },

    exportAutoReserves(s): { metals: number; ice: number; rareMinerals: number } {
      const factoryCount = s.buildings.filter(b => b.type === 'partsfactory' && !b.damaged).length
      const factoryReserve = factoryCount * 2 * 5 // PARTS_FACTORY_METAL_COST * 5 cycles
      const buildReserve = 20 // enough for a silo
      return {
        metals: factoryReserve + buildReserve,
        ice: 0,
        rareMinerals: 0,
      }
    },

    effectiveReserves(s): { metals: number; ice: number; rareMinerals: number } {
      const auto = (this as any).exportAutoReserves
      return {
        metals: s.exportPlatform.reserves.metals ?? auto.metals,
        ice: s.exportPlatform.reserves.ice ?? auto.ice,
        rareMinerals: s.exportPlatform.reserves.rareMinerals ?? auto.rareMinerals,
      }
    },
  },

  actions: {
    // ── Pause ──
    togglePause() {
      this.isPaused = !this.isPaused
      if (this.isPaused) {
        this.save()
      }
    },

    // ── Tick ──
    tick(dtMs: number) {
      if (this.gameOver) return
      const dt = dtMs / 1000

      this.totalPlaytimeMs += dtMs
      this.lastTickAt = Date.now()

      if (this.aliveColonists.length === 0) {
        this.gameOver = true
        this.gameOverReason = 'All colonists have perished.'
        return
      }
      const alive = this.colonyColonists

      // Colonist AI
      for (const c of alive) {
        updateNeeds(c)
        const interrupted = checkInterrupt(c)
        if (!interrupted) {
          const prevAction = c.currentAction?.type
          const needsDecision = advanceAction(c)
          if (needsDecision) {
            // Action just completed — award XP
            if (prevAction) {
              awardXP(c, prevAction)
              const newSpec = checkSpecialization(c)
              if (newSpec) {
                this.pushMessage(`${c.name} has earned the rank of ${SPECIALIZATION_LABELS[newSpec]}.`, 'event')
              }
            }
            // Check for breakdown before selecting next action
            const breakdownTicks = checkBreakdown(c, this.totalPlaytimeMs)
            if (breakdownTicks) {
              c.currentAction = { type: 'rest', targetZone: 'habitat', remainingTicks: breakdownTicks }
              c.currentZone = 'habitat'
              this.pushMessage(`${c.name}: I can't keep going. Need to stop.`, 'info')
            } else {
              c.currentAction = selectAction(c, this.$state)
            }
          }
        } else {
          c.currentAction = selectAction(c, this.$state)
        }
      }

      // Radio chatter — colonists communicate organically
      const settingsState = useSettingsStore()
      generateChatter(
        alive,
        this.colonists,
        (id) => {
          const b = this.buildings.find(b => b.id === id)
          return b ? (BLUEPRINTS.find(bp => bp.type === b.type)?.label ?? b.type) : 'building'
        },
        (text, severity) => this.pushMessage(text, severity),
        this.totalPlaytimeMs,
        settingsState.radioChatter,
      )

      // Update colonist bonds (co-location affinity)
      updateBonds(this.colonists)

      // Check for newly formed bonds and emit messages
      for (const c of alive) {
        if (!c.bonds) continue
        for (const [partnerId, affinity] of Object.entries(c.bonds)) {
          // Announce when bond first crosses threshold (20-21 range, during the accrual tick)
          if (affinity === 20) {
            const pairKey = [c.id, partnerId].sort().join(':')
            if (!announcedBonds.has(pairKey)) {
              announcedBonds.add(pairKey)
              const partner = this.colonists.find(p => p.id === partnerId)
              if (partner && partner.health > 0) {
                this.pushMessage(`${c.name} and ${partner.name} seem to have each other's rhythm down.`, 'info')
              }
            }
          }
        }
      }

      // Idle morale drain — colonists with no productive work lose morale
      for (const c of alive) {
        if (c.currentAction?.type === 'wander' || !c.currentAction) {
          // Track idle time via a simple tick check (every 30 ticks)
          if (this.ticksSinceLastReport % 30 === 0) {
            c.morale = Math.max(0, c.morale - 2)
          }
        }
      }

      // Economy — HQ rate bulletins
      tickEconomy(this.totalPlaytimeMs, (text, sev) => this.pushMessage(text, sev))

      // Export platform tick
      const ep = this.exportPlatform
      if (ep.built) {
        // Loading — colonists with 'load' action transfer resources
        if (ep.status === 'docked') {
          const loaders = alive.filter(
            c => c.currentAction?.type === 'load' && !c.currentAction?.walkPath?.length
          )
          const reserves = this.effectiveReserves
          for (const _loader of loaders) {
            const loaded = ep.cargo.metals + ep.cargo.ice + ep.cargo.rareMinerals
            if (loaded >= ep.capacity) break

            const space = ep.capacity - loaded
            const toLoad = Math.min(2, space)
            let remaining = toLoad

            // Load metals first (above reserve), then ice, then rare minerals
            if (remaining > 0 && this.metals > reserves.metals) {
              const take = Math.min(remaining, this.metals - reserves.metals)
              this.metals -= take
              ep.cargo.metals += take
              remaining -= take
            }
            if (remaining > 0 && this.ice > reserves.ice) {
              const take = Math.min(remaining, this.ice - reserves.ice)
              this.ice -= take
              ep.cargo.ice += take
              remaining -= take
            }
            if (remaining > 0 && this.rareMinerals > reserves.rareMinerals) {
              const take = Math.min(remaining, this.rareMinerals - reserves.rareMinerals)
              this.rareMinerals -= take
              ep.cargo.rareMinerals += take
              remaining -= take
            }
          }

          // Auto-launch when full
          const totalLoaded = ep.cargo.metals + ep.cargo.ice + ep.cargo.rareMinerals
          if (ep.autoLaunch && totalLoaded >= ep.capacity) {
            this.launchExport(false)
          }
        }

        // Transit — check if payload arrived at HQ
        if (ep.status === 'in_transit' && ep.launchTime) {
          const TRANSIT = 120_000
          if (this.totalPlaytimeMs >= ep.launchTime + TRANSIT) {
            const rates = getCurrentRates(this.totalPlaytimeMs)
            const payout = Math.round(
              ep.cargo.metals * rates.metals +
              ep.cargo.ice * rates.ice +
              ep.cargo.rareMinerals * rates.rareMinerals
            )
            this.credits += payout
            this.totalCreditsEarned += payout
            this.pushMessage(`HQ confirms receipt. ${payout}cr credited to account.`, 'event')

            ep.status = 'returning'
            const RETURN_NORMAL = 180_000
            const RETURN_FORCE = 270_000
            ep.returnTime = this.totalPlaytimeMs + (ep.forceLaunched ? RETURN_FORCE : RETURN_NORMAL)
            ep.cargo = { metals: 0, ice: 0, rareMinerals: 0 }
          }
        }

        // Returning — check if platform is back
        if (ep.status === 'returning' && ep.returnTime) {
          if (this.totalPlaytimeMs >= ep.returnTime) {
            ep.status = 'docked'
            ep.launchTime = null
            ep.returnTime = null
            ep.forceLaunched = false
            this.pushMessage('Export platform has docked. Ready for loading.', 'event')
          }
        }
      }

      // Count active workers by zone
      const workersAtPower = alive.filter(
        c => c.currentAction?.type === 'engineer' && c.currentAction?.targetZone === 'power' && !c.currentAction?.walkPath?.length
      ).length
      const workersAtLifeSup = alive.filter(
        c => c.currentAction?.type === 'engineer' && c.currentAction?.targetZone === 'lifeSup' && !c.currentAction?.walkPath?.length
      ).length
      const activeExtractors = alive.filter(
        c => c.currentAction?.type === 'extract' && !c.currentAction?.walkPath?.length
      ).length

      const mod = DIRECTIVE_MODIFIERS[this.activeDirective]

      // Power
      const solars = this.buildings.filter((b) => b.type === 'solar' && !b.damaged).length
      const activeBuildings = this.buildings.filter((b) => !b.damaged).length
      const powerEngBonus = (1 + workersAtPower * ENGINEER_EFFICIENCY_BONUS) * mod.prodMult
      const powerProd = solars * POWER_PRODUCTION_PER_SOLAR * powerEngBonus
      const powerCons = activeBuildings * POWER_CONSUMPTION_PER_BUILDING
      this.power = Math.min(this.powerMax, Math.max(0, this.power + (powerProd - powerCons) * dt))

      // Air
      const generators = this.buildings.filter((b) => b.type === 'o2generator' && !b.damaged).length
      const airEngBonus = (1 + workersAtLifeSup * ENGINEER_EFFICIENCY_BONUS) * mod.prodMult
      const airProd = this.power > 0 ? generators * O2_PRODUCTION_PER_GENERATOR * airEngBonus : 0
      const airCons = alive.length * AIR_CONSUMPTION_PER_COLONIST
      this.air = Math.min(this.airMax, Math.max(0, this.air + (airProd - airCons) * dt))

      // Extraction + credit income
      const rigCount = this.buildings.filter((b) => b.type === 'extractionrig' && !b.damaged).length
      const totalActiveEngineers = workersAtPower + workersAtLifeSup
      const extractEngBonus = 1 + totalActiveEngineers * ENGINEER_EFFICIENCY_BONUS
      const extractSpeed = (activeExtractors * EXTRACT_SPEED_PER_WORKER + rigCount * EXTRACT_SPEED_PER_RIG) * extractEngBonus * mod.extractMult

      const metalsBefore = this.metals
      let iceFound = false
      if (extractSpeed > 0) {
        const depthGain = extractSpeed * dt
        this.depth += depthGain
        if (this.depth > this.maxDepth) this.maxDepth = this.depth
        this.metals += depthGain * METALS_PER_DEPTH
        if (Math.random() < ICE_CHANCE_PER_TICK * dt) {
          this.ice += ICE_PER_FIND
          iceFound = true
        }
      }
      const metalsDelta = this.metals - metalsBefore
      const creditGain =
        (BASE_CREDITS_PER_TICK +
          metalsDelta * CREDITS_PER_METAL_MINED +
          (iceFound ? CREDITS_PER_ICE_FOUND : 0)) *
        dt
      this.credits += creditGain
      this.totalCreditsEarned += creditGain

      // Clamp resources to storage caps
      const caps = this.storageCap
      if (this.metals > caps.metals) {
        if (this.ticksSinceLastReport % 60 === 0) {
          const overflowColonist = alive.find(c => c.currentAction?.type === 'extract')
          const name = overflowColonist?.name ?? 'Colony'
          this.pushMessage(`${name}: Storage full — we're losing metals out here.`, 'warning')
        }
        this.metals = caps.metals
      }
      if (this.ice > caps.ice) {
        if (this.ticksSinceLastReport % 60 === 0) {
          this.pushMessage('Ice storage at capacity. Excess discarded.', 'warning')
        }
        this.ice = caps.ice
      }
      if (this.rareMinerals > caps.rareMinerals) {
        this.rareMinerals = caps.rareMinerals
      }

      // Auto-build storage silo when nearing capacity
      const metalPct = caps.metals > 0 ? this.metals / caps.metals : 0
      const icePct = caps.ice > 0 ? this.ice / caps.ice : 0
      if ((metalPct > SILO_AUTO_BUILD_THRESHOLD || icePct > SILO_AUTO_BUILD_THRESHOLD) && this.metals >= 20) {
        const hasEngineer = alive.some(c => c.currentAction?.type === 'engineer' || c.currentAction?.type === 'wander' || !c.currentAction)
        if (hasEngineer) {
          this.metals -= 20
          const pos = getBuildingPosition('storageSilo', this.buildings)
          this.buildings.push({ id: uid(), type: 'storageSilo', damaged: false, x: pos.x, y: pos.y, rotation: pos.rotation })
          this.pushMessage('Engineers constructing additional storage.', 'event')
        }
      }

      // Auto-build launch platform when metals available and none exists
      if (!this.exportPlatform.built && this.metals >= 30) {
        const hasLaunchPlatform = this.buildings.some(b => b.type === 'launchplatform')
        if (!hasLaunchPlatform) {
          const hasEngineer = alive.some(c => c.currentAction?.type === 'engineer' || c.currentAction?.type === 'wander' || !c.currentAction)
          if (hasEngineer) {
            this.metals -= 30
            const pos = getBuildingPosition('launchplatform', this.buildings)
            this.buildings.push({ id: uid(), type: 'launchplatform', damaged: false, x: pos.x, y: pos.y, rotation: pos.rotation })
            this.exportPlatform.built = true
            this.pushMessage('Engineers have constructed a launch platform at the LZ.', 'event')
          }
        }
      }

      // Med bay healing
      const medbays = this.buildings.filter((b) => b.type === 'medbay' && !b.damaged).length
      if (medbays > 0 && this.power > 0) {
        const healRate = medbays * MEDBAY_HEAL_PER_SEC * this.engineerBonus * dt
        for (const c of this.colonists) {
          if (c.health > 0 && c.health < 100) {
            c.health = Math.min(100, c.health + healRate)
          }
        }
      }

      // Snapshot alive colonists before health drain (for death detection)
      const aliveBeforeDrain = this.colonists.filter(c => c.health > 0).map(c => c.id)

      // Health drain when critical
      if (this.air <= 0 || this.power <= 0) {
        for (const c of this.colonists) {
          if (c.health > 0) {
            const drainMult = c.skillTrait === 'ironStomach' ? 0.7 : 1.0
            c.health = Math.max(0, c.health - HEALTH_DRAIN_PER_SEC * dt * drainMult)
          }
        }
        if (this.aliveColonists.length === 0) {
          this.gameOver = true
          this.gameOverReason =
            this.air <= 0
              ? 'The colony ran out of air.'
              : 'Total power failure. Life support offline.'
        }
      }

      // Check for deaths that happened this tick — fire morale events
      for (const id of aliveBeforeDrain) {
        const c = this.colonists.find(col => col.id === id)
        if (c && c.health <= 0) {
          applyDeathMorale(c, this.colonists)
          this.pushMessage(`${c.name} has died.`, 'critical')
        }
      }

      // Colonist repair — consume a kit if a repairer has arrived at target
      if (this.repairKits > 0) {
        const repairers = alive.filter(
          (c) => c.currentAction?.type === 'repair' && c.currentAction.targetId && !c.currentAction.walkPath?.length
        )
        for (const repairer of repairers) {
          if (this.repairKits <= 0) break
          const building = this.buildings.find((b) => b.id === repairer.currentAction!.targetId && b.damaged)
          if (building) {
            building.damaged = false
            this.repairKits--
            const label = BLUEPRINTS.find((b) => b.type === building.type)?.label || building.type
            this.pushMessage(`${label} repaired by ${repairer.name}.`, 'event')
            repairer.currentAction = null // re-evaluate next tick
          }
        }
      }

      // Parts Factory production — requires an engineer operating the workshop
      const factoryCount = this.buildings.filter(b => b.type === 'partsfactory' && !b.damaged).length
      const workshopOperators = alive.filter(
        c => c.currentAction?.type === 'engineer' && c.currentAction?.targetZone === 'workshop' && !c.currentAction?.walkPath?.length
      ).length
      if (factoryCount > 0 && workshopOperators > 0 && this.power > 0 && this.metals >= PARTS_FACTORY_METAL_COST) {
        const interval = PARTS_FACTORY_INTERVAL_MS / factoryCount
        if (this.totalPlaytimeMs - this.lastPartsProducedAt >= interval) {
          this.metals -= PARTS_FACTORY_METAL_COST
          this.repairKits++
          this.lastPartsProducedAt = this.totalPlaytimeMs
          this.pushMessage(`Parts Factory produced a repair kit. (${this.repairKits} in stock, -${PARTS_FACTORY_METAL_COST} metals)`, 'info')
        }
      }

      // Update capacities
      this.airMax = STARTING_AIR_MAX + generators * 25
      this.powerMax = STARTING_POWER_MAX + solars * 25

      // Process shipments and supply drops
      this.processShipments()

      // Auto-relaunch
      if (this.autoRelaunch && this.lastManifest.length > 0 && !this.shipmentOnCooldown) {
        const cost = this.lastManifest.reduce((sum, o) => sum + o.cost, 0)
        if (this.credits >= cost) {
          this.credits -= cost
          const hasEmergency = this.lastManifest.some(
            (o) => o.type === 'emergencyO2' || o.type === 'emergencyPower',
          )
          const transit = hasEmergency ? EMERGENCY_TRANSIT_MS : SHIPMENT_TRANSIT_MS
          this.inTransitShipments.push({
            id: uid(),
            contents: [...this.lastManifest],
            totalWeight: this.lastManifest.reduce((sum, o) => sum + o.weight, 0),
            arrivalAt: this.totalPlaytimeMs + transit,
          })
          this.shipmentCooldownUntil = this.totalPlaytimeMs + SHIPMENT_COOLDOWN_MS
          this.pushMessage('Auto-relaunching shipment...', 'event')
        } else {
          this.pushMessage('Auto-relaunch skipped — insufficient credits.', 'warning')
          this.autoRelaunch = false
        }
      }

      this.processSupplyDrops(dtMs)

      // Moon systems
      const moon = useMoonStore()
      moon.tickPing(this.totalPlaytimeMs, (text, sev) => this.pushMessage(text, sev))
      moon.tickSurveys(
        this.totalPlaytimeMs,
        (text, sev) => this.pushMessage(text, sev),
        (colonistId) => {
          const c = this.colonists.find(col => col.id === colonistId)
          if (c) {
            c.currentZone = 'habitat'
            c.currentAction = null
          }
        },
      )
      moon.tickOutposts(this.totalPlaytimeMs, dtMs, (text, sev) => this.pushMessage(text, sev))
      moon.tickLaunches(
        this.totalPlaytimeMs,
        (metals, ice) => {
          this.metals += metals
          this.ice += ice
        },
        (text, sev) => this.pushMessage(text, sev),
      )

      // Hazards
      this.checkHazards()

      // Periodic status messages
      this.ticksSinceLastReport++
      if (this.ticksSinceLastReport >= 10) {
        this.generateStatusMessages()
        this.ticksSinceLastReport = 0
      }
    },

    // ── Hazards ──
    checkHazards() {
      if (Date.now() < this.hazardCooldownUntil) return
      const now = Date.now()
      if (now - this.lastHazardAt < HAZARD_MIN_GAP_MS) return
      const mod = DIRECTIVE_MODIFIERS[this.activeDirective]
      const chance = (HAZARD_BASE_CHANCE + this.depth * HAZARD_DEPTH_SCALE) * (1 - mod.hazardResist)
      if (Math.random() > chance) return

      this.hazardCooldownUntil = Date.now() + HAZARD_CHECK_INTERVAL_MS
      this.lastHazardAt = Date.now()

      const roll = Math.random()
      if (roll < 0.4) {
        const undamaged = this.buildings.filter((b) => !b.damaged)
        if (undamaged.length > 0) {
          const target = undamaged[Math.floor(Math.random() * undamaged.length)]
          target.damaged = true
          const msg = `Micro-meteor struck a ${BLUEPRINTS.find((b) => b.type === target.type)?.label}!`
          this.lastHazard = { type: 'meteor', message: msg, timestamp: Date.now() }
          this.pushMessage(msg, 'critical')
        }
      } else if (roll < 0.7) {
        this.power = Math.max(0, this.power - this.powerMax * 0.3)
        const msg = 'Power surge! 30% power lost.'
        this.lastHazard = { type: 'powersurge', message: msg, timestamp: Date.now() }
        this.pushMessage(msg, 'critical')
      } else {
        this.air = Math.max(0, this.air - this.airMax * 0.25)
        const msg = 'Hit a gas pocket! Air venting!'
        this.lastHazard = { type: 'gaspocket', message: msg, timestamp: Date.now() }
        this.pushMessage(msg, 'critical')
      }

      // Urgent re-evaluation after hazard
      for (const c of this.colonists) {
        if (c.health > 0 && (!c.currentAction || c.currentAction.type === 'wander' || c.currentAction.type === 'extract')) {
          c.currentAction = selectAction(c, this.$state)
        }
      }

      // Morale impact from hazard
      applyHazardMorale(this.colonists)
    },

    // ── Directives ──
    setDirective(d: Directive) {
      if (this.activeDirective === d) return
      this.activeDirective = d
      const labels: Record<Directive, string> = {
        mining: 'Prioritize Mining',
        safety: 'Prioritize Safety',
        balanced: 'Balanced Operations',
        emergency: 'Emergency Protocol',
      }
      this.pushMessage(`Directive changed: ${labels[d]}.`, 'event')
    },

    // ── Shipments ──
    addToManifest(option: ShipmentOption) {
      if (this.manifest.length >= MANIFEST_MAX_SLOTS) return
      if (this.manifestWeight + option.weight > CARGO_CAPACITY) return
      if (this.credits < this.manifestCost + option.cost) return
      this.manifest.push(option)
    },

    removeFromManifest(index: number) {
      if (index >= 0 && index < this.manifest.length) {
        this.manifest.splice(index, 1)
      }
    },

    clearManifest() {
      this.manifest = []
    },

    launchShipment() {
      if (this.manifest.length === 0) return
      if (this.shipmentOnCooldown) return
      if (this.credits < this.manifestCost) return

      this.credits -= this.manifestCost
      const hasEmergency = this.manifest.some(
        (o) => o.type === 'emergencyO2' || o.type === 'emergencyPower',
      )
      const transit = hasEmergency ? EMERGENCY_TRANSIT_MS : SHIPMENT_TRANSIT_MS

      this.inTransitShipments.push({
        id: uid(),
        contents: [...this.manifest],
        totalWeight: this.manifestWeight,
        arrivalAt: this.totalPlaytimeMs + transit,
      })

      const itemCount = this.manifest.length
      const totalWeight = this.manifestWeight
      this.pushMessage(
        `Shipment launched: ${itemCount} ${itemCount === 1 ? 'item' : 'items'}, ${totalWeight}kg. ETA ${transit / 1000}s.`,
        'event',
      )
      this.lastManifest = [...this.manifest]
      this.manifest = []
      this.shipmentCooldownUntil = this.totalPlaytimeMs + SHIPMENT_COOLDOWN_MS
    },

    processShipments() {
      const arrived = this.inTransitShipments.filter((s) => this.totalPlaytimeMs >= s.arrivalAt)
      if (arrived.length === 0) return

      this.inTransitShipments = this.inTransitShipments.filter(
        (s) => this.totalPlaytimeMs < s.arrivalAt,
      )

      for (const pkg of arrived) {
        // Separate emergency items (apply instantly) from crate items
        const emergencyItems = pkg.contents.filter(
          (o) => o.type === 'emergencyO2' || o.type === 'emergencyPower',
        )
        const crateItems = pkg.contents.filter(
          (o) => o.type !== 'emergencyO2' && o.type !== 'emergencyPower',
        )

        for (const em of emergencyItems) {
          if (em.type === 'emergencyO2') {
            this.air = Math.min(this.airMax, this.air + 30)
            this.pushMessage('Emergency O2 airdrop: +30 air.', 'event')
          } else {
            this.power = Math.min(this.powerMax, this.power + 30)
            this.pushMessage('Emergency power airdrop: +30 power.', 'event')
          }
        }

        if (crateItems.length > 0) {
          const crateWeight = crateItems.reduce((sum, o) => sum + o.weight, 0)
          const landingPos = getLandingPosition()
          this.supplyDrops.push({
            id: uid(),
            contents: crateItems,
            totalWeight: crateWeight,
            x: landingPos.x,
            y: landingPos.y,
            state: 'landed',
            unpackProgress: 0,
            unpackDuration: crateWeight * UNPACK_MS_PER_KG,
            landedAt: this.totalPlaytimeMs,
          })
          const itemNames = crateItems.map((o) => o.label).join(', ')
          this.pushMessage(
            `Shipment landed (${crateWeight}kg): ${itemNames}. Send crew to unpack.`,
            'event',
          )

          // Urgent re-evaluation after supply drop
          for (const c of this.colonists) {
            if (c.health > 0 && (!c.currentAction || c.currentAction.type === 'wander')) {
              c.currentAction = selectAction(c, this.$state)
            }
          }
        }
      }
    },

    processSupplyDrops(_dtMs: number) {
      // Clean up completed drops after linger period
      // (Unpack progress is driven by the colonist movement composable)
      this.supplyDrops = this.supplyDrops.filter((drop) => {
        if (drop.state === 'done') {
          return this.totalPlaytimeMs - drop.landedAt < DONE_LINGER_MS
        }
        return true
      })
    },

    applySupplyDrop(drop: SupplyDrop) {
      for (const item of drop.contents) {
        switch (item.type) {
          case 'supplyCrate':
            this.metals += 15
            this.ice += 5
            this.pushMessage('Supply crate unpacked: +15 metals, +5 ice.', 'event')
            break
          case 'equipment':
            if (item.buildingType) {
              const pos = getBuildingPosition(item.buildingType, this.buildings)
              this.buildings.push({
                id: uid(),
                type: item.buildingType,
                damaged: false,
                x: pos.x,
                y: pos.y,
                rotation: pos.rotation,
              })
              const label =
                BLUEPRINTS.find((b) => b.type === item.buildingType)?.label || item.buildingType
              this.pushMessage(`${label} assembled and operational.`, 'event')
            }
            break
          case 'newColonist': {
            const usedNames = new Set(this.colonists.map((c) => c.name))
            const available = COLONIST_NAMES.filter((n) => !usedNames.has(n))
            const name =
              available.length > 0
                ? available[Math.floor(Math.random() * available.length)]
                : `Crew-${this.colonists.length + 1}`
            this.colonists.push({
              id: uid(), name, health: 100,
              energy: 80, morale: 70, trait: randomTrait(),
              skillTrait: randomSkillTrait(),
              extractionXP: 0, engineeringXP: 0, medicalXP: 0,
              specialization: null, bonds: {}, lastBreakdownAt: null,
              currentAction: null, currentZone: 'habitat',
            })
            this.pushMessage(`${name} has joined the colony.`, 'event')
            break
          }
          case 'repairKit': {
            this.repairKits++
            this.pushMessage(`Repair kit added to inventory. (${this.repairKits} in stock)`, 'event')
            break
          }
        }
      }
      this.pushMessage(
        `Shipment unpacked: ${drop.contents.length} ${drop.contents.length === 1 ? 'item' : 'items'} deployed.`,
        'event',
      )
    },

    // ── Messages ──
    pushMessage(text: string, severity: ConsoleMessage['severity']) {
      this.messages.push({ id: uid(), text, severity, timestamp: this.totalPlaytimeMs })
      if (this.messages.length > MAX_MESSAGES) {
        this.messages = this.messages.slice(-MAX_MESSAGES)
      }
    },

    generateStatusMessages() {
      if (this.air < this.airMax * 0.15) {
        this.pushMessage('WARNING: Air reserves critically low!', 'critical')
      } else if (this.air < this.airMax * 0.3) {
        this.pushMessage('Air reserves running low.', 'warning')
      }
      if (this.power < this.powerMax * 0.15) {
        this.pushMessage('WARNING: Power critically low!', 'critical')
      } else if (this.power < this.powerMax * 0.3) {
        this.pushMessage('Power reserves dropping.', 'warning')
      }
      const damaged = this.buildings.filter((b) => b.damaged)
      if (damaged.length > 0) {
        this.pushMessage(
          `${damaged.length} ${damaged.length === 1 ? 'building' : 'buildings'} damaged. Send a repair kit.`,
          'warning',
        )
      }
      const injured = this.colonists.filter((c) => c.health > 0 && c.health < 50)
      if (injured.length > 0) {
        this.pushMessage(
          `${injured.map((c) => c.name).join(', ')} injured. Consider a Med Bay.`,
          'warning',
        )
      }
      // Suggestions
      if (this.buildings.filter((b) => b.type === 'solar' && !b.damaged).length === 0) {
        this.pushMessage(
          'Colony has no working solar panels. Power production critical.',
          'critical',
        )
      }
      if (this.buildings.filter((b) => b.type === 'o2generator' && !b.damaged).length === 0) {
        this.pushMessage('No working O2 generators. Air production halted.', 'critical')
      }
    },

    // ── Hazard dismiss ──
    dismissHazard() {
      this.lastHazard = null
    },

    // ── Reset ──
    resetGame() {
      Object.assign(this, freshState())
      const moon = useMoonStore()
      moon.initialize(Date.now())
    },

    // ── Offline ──
    processOfflineTime(): OfflineResult | null {
      const now = Date.now()
      const elapsed = now - this.lastTickAt
      if (elapsed < 2000) return null

      const result = simulateOffline(this.$state, elapsed)
      const fs = result.finalState

      this.$patch({
        air: fs.air,
        airMax: fs.airMax,
        power: fs.power,
        powerMax: fs.powerMax,
        metals: fs.metals,
        ice: fs.ice,
        credits: fs.credits,
        totalCreditsEarned: fs.totalCreditsEarned,
        depth: fs.depth,
        maxDepth: fs.maxDepth,
        colonists: fs.colonists,
        buildings: fs.buildings,
        activeDirective: fs.activeDirective,
        inTransitShipments: fs.inTransitShipments,
        supplyDrops: fs.supplyDrops,
        totalPlaytimeMs: fs.totalPlaytimeMs,
        hazardCooldownUntil: fs.hazardCooldownUntil,
        offlineEvents: result.events,
      })

      this.lastTickAt = now
      this.lastSavedAt = now

      return result
    },

    dismissShiftReport() {
      this.offlineEvents = []
    },

    // ── Persistence ──
    async save() {
      const moon = useMoonStore()
      const econState = getEconomyState()
      const saveData = {
        colony: this.$state,
        moon: moon.$state,
        economy: econState,
      }
      try {
        await Preferences.set({ key: SAVE_KEY, value: JSON.stringify(saveData) })
        this.lastSavedAt = Date.now()
      } catch {
        try {
          localStorage.setItem(SAVE_KEY, JSON.stringify(saveData))
          this.lastSavedAt = Date.now()
        } catch { /* silent */ }
      }
    },

    async load() {
      let raw: string | null = null
      try {
        const res = await Preferences.get({ key: SAVE_KEY })
        raw = res.value
      } catch {
        raw = localStorage.getItem(SAVE_KEY)
      }
      // Try legacy key if nothing found
      if (!raw) {
        try {
          const res = await Preferences.get({ key: LEGACY_SAVE_KEY })
          raw = res.value
        } catch {
          raw = localStorage.getItem(LEGACY_SAVE_KEY)
        }
      }
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          const moon = useMoonStore()
          if (parsed.colony) {
            // New format: { colony, moon }
            this.$patch(parsed.colony)
            if (parsed.moon) {
              moon.$patch(parsed.moon)
            } else {
              moon.initialize(Date.now())
            }
          } else {
            // Legacy format: flat colony state
            this.$patch(parsed)
            moon.initialize(Date.now())
          }
          this.migrateState()
          if (parsed.economy) {
            restoreEconomyState(parsed.economy)
          } else {
            initEconomy(this.totalPlaytimeMs)
          }
        } catch { /* corrupt save, use fresh state */ }
      } else {
        // No save found — new game
        const moon = useMoonStore()
        moon.initialize(Date.now())
        initEconomy(0)
      }
    },

    migrateState() {
      // v2→v3: Add new colonist fields
      for (const c of this.colonists) {
        if ((c as any).energy === undefined) c.energy = 80
        if ((c as any).morale === undefined) c.morale = 70
        if ((c as any).trait === undefined) c.trait = randomTrait()
        if ((c as any).currentAction === undefined) c.currentAction = null
        if ((c as any).currentZone === undefined) c.currentZone = 'habitat'
        delete (c as any).role
        // v4→v5: Add identity fields
        if ((c as any).skillTrait === undefined) c.skillTrait = randomSkillTrait()
        if ((c as any).extractionXP === undefined) (c as any).extractionXP = 0
        if ((c as any).engineeringXP === undefined) (c as any).engineeringXP = 0
        if ((c as any).medicalXP === undefined) (c as any).medicalXP = 0
        if ((c as any).specialization === undefined) (c as any).specialization = null
        if ((c as any).bonds === undefined) (c as any).bonds = {}
        if ((c as any).lastBreakdownAt === undefined) (c as any).lastBreakdownAt = null
      }

      // Recalculate building positions with organic scatter
      for (const b of this.buildings) {
        const pos = getBuildingPosition(
          b.type,
          this.buildings.filter(ob => ob.id !== b.id),
        )
        b.x = pos.x
        b.y = pos.y
        ;(b as any).rotation = pos.rotation
      }

      // Backfill other fields
      if (this.credits === undefined) this.credits = 50
      if (this.totalCreditsEarned === undefined) this.totalCreditsEarned = 50
      if (this.activeDirective === undefined) this.activeDirective = 'balanced'
      if (!this.messages) this.messages = []
      if (!this.inTransitShipments) this.inTransitShipments = []
      if (!this.supplyDrops) this.supplyDrops = []
      if (!this.manifest) this.manifest = []
      if (this.shipmentCooldownUntil === undefined) this.shipmentCooldownUntil = 0
      if (this.ticksSinceLastReport === undefined) this.ticksSinceLastReport = 0
      if (!this.offlineEvents) this.offlineEvents = []

      // v5→v6: Economy rework
      if (this.credits < 500 && this.totalCreditsEarned < 500) {
        this.credits = Math.round(this.credits * 10)
        this.totalCreditsEarned = Math.round(this.totalCreditsEarned * 10)
      }

      if ((this as any).rareMinerals === undefined) (this as any).rareMinerals = 0

      if (!this.exportPlatform) {
        (this as any).exportPlatform = {
          built: false,
          status: 'docked',
          cargo: { metals: 0, ice: 0, rareMinerals: 0 },
          capacity: 100,
          launchTime: null,
          returnTime: null,
          estimatedCredits: null,
          autoLaunch: false,
          forceLaunched: false,
          reserves: { metals: null, ice: null, rareMinerals: null },
        }
      }

      if (this.lastManifest?.length > 0 && this.lastManifest[0].cost < 100) {
        for (const item of this.lastManifest) {
          item.cost = Math.round(item.cost * 10)
        }
      }
      if (this.manifest?.length > 0 && this.manifest[0].cost < 100) {
        for (const item of this.manifest) {
          item.cost = Math.round(item.cost * 10)
        }
      }
    },

    toggleAutoRelaunch() {
      this.autoRelaunch = !this.autoRelaunch
    },

    launchExport(force: boolean = false) {
      const ep = this.exportPlatform
      if (ep.status !== 'docked') return
      if (ep.cargo.metals + ep.cargo.ice + ep.cargo.rareMinerals === 0) return

      ep.status = 'in_transit'
      ep.launchTime = this.totalPlaytimeMs
      ep.forceLaunched = force
      ep.estimatedCredits = null

      const loaded = ep.cargo.metals + ep.cargo.ice + ep.cargo.rareMinerals
      if (force) {
        this.pushMessage(
          `Emergency export — platform launching at ${loaded}/${ep.capacity} capacity. Extended return time.`,
          'event',
        )
      } else {
        const est = this.estimateExportCredits()
        this.pushMessage(
          `Payload en route to HQ — ${ep.cargo.metals} metals, ${ep.cargo.ice} ice. Estimated ${est}cr at current rates.`,
          'event',
        )
      }
    },

    estimateExportCredits(): number {
      const c = this.exportPlatform.cargo
      return Math.round(c.metals * 15 + c.ice * 40 + c.rareMinerals * 100)
    },

    setExportReserve(resource: 'metals' | 'ice' | 'rareMinerals', value: number | null) {
      this.exportPlatform.reserves[resource] = value
    },

    toggleAutoLaunch() {
      this.exportPlatform.autoLaunch = !this.exportPlatform.autoLaunch
    },
  },
})
