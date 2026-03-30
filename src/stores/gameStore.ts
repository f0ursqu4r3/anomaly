import { defineStore } from 'pinia'
import { Preferences } from '@capacitor/preferences'

// ── Types ──────────────────────────────────────────────────────────

export type ColonistRole = 'driller' | 'engineer' | 'idle'

export interface Colonist {
  id: string
  name: string
  role: ColonistRole
  health: number // 0–100
}

export type BuildingType = 'o2generator' | 'solar' | 'drillrig' | 'medbay'

export interface Building {
  id: string
  type: BuildingType
  damaged: boolean
  x: number
  y: number
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

const UNPACK_MS_PER_KG = 150 // 150ms per kg with 1 colonist (e.g. 45kg = 6.75s)
const LANDING_ZONE = { x: 45, y: 50 }
const DONE_LINGER_MS = 1500

export interface ColonyState {
  air: number
  airMax: number
  power: number
  powerMax: number
  metals: number
  ice: number

  colonists: Colonist[]
  buildings: Building[]
  depth: number
  maxDepth: number

  lastHazard: HazardEvent | null
  hazardCooldownUntil: number

  credits: number
  totalCreditsEarned: number
  activeDirective: Directive
  messages: ConsoleMessage[]
  inTransitShipments: InTransitShipment[]
  supplyDrops: SupplyDrop[]
  manifest: ShipmentOption[] // items queued for next shipment
  shipmentCooldownUntil: number // totalPlaytimeMs when next shipment can launch
  ticksSinceLastReport: number

  gameOver: boolean
  gameOverReason: string
  totalPlaytimeMs: number
  lastTickAt: number
  lastSavedAt: number
}

// ── Constants ──────────────────────────────────────────────────────

const SAVE_KEY = 'colony-save-v2'

const AIR_CONSUMPTION_PER_COLONIST = 0.5
const O2_PRODUCTION_PER_GENERATOR = 2.0
const POWER_PRODUCTION_PER_SOLAR = 1.5
const POWER_CONSUMPTION_PER_BUILDING = 0.3
const DRILL_SPEED_PER_DRILLER = 0.15
const DRILL_SPEED_PER_RIG = 0.08
const METALS_PER_DEPTH = 2.0
const ICE_CHANCE_PER_TICK = 0.15
const ICE_PER_FIND = 1.0
const ENGINEER_EFFICIENCY_BONUS = 0.15
const MEDBAY_HEAL_PER_SEC = 0.5
const HEALTH_DRAIN_PER_SEC = 2.0

const HAZARD_CHECK_INTERVAL_MS = 15_000
const HAZARD_BASE_CHANCE = 0.03
const HAZARD_DEPTH_SCALE = 0.00002

const STARTING_AIR = 60
const STARTING_AIR_MAX = 125
const STARTING_POWER = 50
const STARTING_POWER_MAX = 125
const STARTING_METALS = 10
const STARTING_ICE = 0

// Credit economy
const BASE_CREDITS_PER_TICK = 1.0
const CREDITS_PER_METAL_MINED = 0.1
const CREDITS_PER_ICE_FOUND = 2.0
const SHIPMENT_TRANSIT_MS = 10_000
const EMERGENCY_TRANSIT_MS = 3_000
const MAX_MESSAGES = 50
const SHIPMENT_COOLDOWN_MS = 60_000
const MANIFEST_MAX_SLOTS = 4
const CARGO_CAPACITY = 100

// Directive config
const DIRECTIVE_RATIOS: Record<Directive, { driller: number; engineer: number }> = {
  mining: { driller: 0.7, engineer: 0.2 },
  safety: { driller: 0.2, engineer: 0.6 },
  balanced: { driller: 0.4, engineer: 0.4 },
  emergency: { driller: 0.1, engineer: 0.8 },
}

const DIRECTIVE_MODIFIERS: Record<
  Directive,
  { drillMult: number; hazardResist: number; prodMult: number }
> = {
  mining: { drillMult: 1.3, hazardResist: 0.0, prodMult: 1.0 },
  safety: { drillMult: 0.7, hazardResist: 0.4, prodMult: 1.2 },
  balanced: { drillMult: 1.0, hazardResist: 0.15, prodMult: 1.0 },
  emergency: { drillMult: 0.5, hazardResist: 0.1, prodMult: 1.5 },
}

export const SHIPMENT_OPTIONS: ShipmentOption[] = [
  {
    type: 'supplyCrate',
    label: 'Supply Crate',
    description: '+15 metals, +5 ice',
    cost: 30,
    weight: 20,
  },
  {
    type: 'equipment',
    label: 'Solar Panel',
    description: 'Prefab solar panel',
    cost: 40,
    weight: 18,
    buildingType: 'solar',
  },
  {
    type: 'equipment',
    label: 'O2 Generator',
    description: 'Prefab O2 generator',
    cost: 50,
    weight: 32,
    buildingType: 'o2generator',
  },
  {
    type: 'equipment',
    label: 'Drill Rig',
    description: 'Prefab drill rig',
    cost: 65,
    weight: 55,
    buildingType: 'drillrig',
  },
  {
    type: 'equipment',
    label: 'Med Bay',
    description: 'Prefab medical bay',
    cost: 80,
    weight: 40,
    buildingType: 'medbay',
  },
  {
    type: 'newColonist',
    label: 'New Colonist',
    description: 'Recruit crew member',
    cost: 90,
    weight: 35,
  },
  {
    type: 'repairKit',
    label: 'Repair Kit',
    description: 'Fix one damaged building',
    cost: 15,
    weight: 5,
  },
  {
    type: 'emergencyO2',
    label: 'Emergency O2',
    description: '+30 air (fast delivery)',
    cost: 20,
    weight: 25,
  },
  {
    type: 'emergencyPower',
    label: 'Emergency Power',
    description: '+30 power (fast delivery)',
    cost: 20,
    weight: 15,
  },
]

export { MANIFEST_MAX_SLOTS, CARGO_CAPACITY, SHIPMENT_COOLDOWN_MS }

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
    type: 'drillrig',
    label: 'Drill Rig',
    description: 'Auto-drills for resources',
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
]

const COLONIST_NAMES = ['Kael', 'Mira', 'Tarn', 'Vex', 'Lira', 'Cade', 'Nyx', 'Orin', 'Zara', 'Pax']

// ── Map Zones ──────────────────────────────────────────────────────

export const MAP_ZONES: Record<string, { x: number; y: number }> = {
  habitat: { x: 50, y: 45 },
  drillSite: { x: 50, y: 78 },
  powerField: { x: 28, y: 28 },
  lifeSup: { x: 72, y: 28 },
  medical: { x: 72, y: 58 },
}

const ZONE_FOR_TYPE: Record<BuildingType, string> = {
  solar: 'powerField',
  o2generator: 'lifeSup',
  drillrig: 'drillSite',
  medbay: 'medical',
}

const SLOT_OFFSETS = [
  { dx: 0, dy: 0 },
  { dx: 14, dy: 0 },
  { dx: -14, dy: 0 },
  { dx: 0, dy: 14 },
  { dx: 14, dy: 14 },
  { dx: -14, dy: 14 },
]

function getBuildingPosition(
  type: BuildingType,
  existingBuildings: Building[],
): { x: number; y: number } {
  const zoneName = ZONE_FOR_TYPE[type]
  const zone = MAP_ZONES[zoneName]
  const sameZone = existingBuildings.filter((b) => ZONE_FOR_TYPE[b.type] === zoneName)
  const slotIndex = Math.min(sameZone.length, SLOT_OFFSETS.length - 1)
  const offset = SLOT_OFFSETS[slotIndex]
  return { x: zone.x + offset.dx, y: zone.y + offset.dy }
}

// ── Helpers ─────────────────────────────────────────────────────────

let nextId = 1
function uid(): string {
  return `${Date.now()}-${nextId++}`
}

function makeStartingColonists(): Colonist[] {
  return [
    { id: uid(), name: 'Riko', role: 'driller', health: 100 },
    { id: uid(), name: 'Sable', role: 'engineer', health: 100 },
    { id: uid(), name: 'Juno', role: 'idle', health: 100 },
  ]
}

function makeStartingBuildings(): Building[] {
  const b: Building[] = []
  const types: BuildingType[] = ['solar', 'o2generator', 'drillrig']
  for (const t of types) {
    const pos = getBuildingPosition(t, b)
    b.push({ id: uid(), type: t, damaged: false, x: pos.x, y: pos.y })
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
    colonists: makeStartingColonists(),
    buildings: makeStartingBuildings(),
    depth: 0,
    maxDepth: 0,
    lastHazard: null,
    hazardCooldownUntil: 0,
    credits: 50,
    totalCreditsEarned: 50,
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
        text: 'Starting structures deployed: Solar, O2 Gen, Drill Rig.',
        severity: 'info',
        timestamp: 0,
      },
    ],
    inTransitShipments: [],
    supplyDrops: [],
    manifest: [],
    shipmentCooldownUntil: 0,
    ticksSinceLastReport: 0,
    gameOver: false,
    gameOverReason: '',
    totalPlaytimeMs: 0,
    lastTickAt: Date.now(),
    lastSavedAt: Date.now(),
  }
}

// ── Store ───────────────────────────────────────────────────────────

export const useGameStore = defineStore('game', {
  state: (): ColonyState => freshState(),

  getters: {
    aliveColonists: (s) => s.colonists.filter((c) => c.health > 0),
    drillers: (s) => s.colonists.filter((c) => c.health > 0 && c.role === 'driller'),
    engineers: (s) => s.colonists.filter((c) => c.health > 0 && c.role === 'engineer'),

    engineerBonus(s): number {
      const count = s.colonists.filter((c) => c.health > 0 && c.role === 'engineer').length
      const mod = DIRECTIVE_MODIFIERS[s.activeDirective].prodMult
      return (1 + count * ENGINEER_EFFICIENCY_BONUS) * mod
    },

    airRate(s): number {
      const alive = s.colonists.filter((c) => c.health > 0).length
      const consumption = alive * AIR_CONSUMPTION_PER_COLONIST
      const generators = s.buildings.filter((b) => b.type === 'o2generator' && !b.damaged).length
      const engCount = s.colonists.filter((c) => c.health > 0 && c.role === 'engineer').length
      const mod = DIRECTIVE_MODIFIERS[s.activeDirective].prodMult
      const engBonus = (1 + engCount * ENGINEER_EFFICIENCY_BONUS) * mod
      const production = s.power > 0 ? generators * O2_PRODUCTION_PER_GENERATOR * engBonus : 0
      return production - consumption
    },

    powerRate(s): number {
      const solars = s.buildings.filter((b) => b.type === 'solar' && !b.damaged).length
      const engCount = s.colonists.filter((c) => c.health > 0 && c.role === 'engineer').length
      const mod = DIRECTIVE_MODIFIERS[s.activeDirective].prodMult
      const engBonus = (1 + engCount * ENGINEER_EFFICIENCY_BONUS) * mod
      const production = solars * POWER_PRODUCTION_PER_SOLAR * engBonus
      const activeBuildings = s.buildings.filter((b) => !b.damaged).length
      const consumption = activeBuildings * POWER_CONSUMPTION_PER_BUILDING
      return production - consumption
    },

    drillRate(s): number {
      const drillerCount = s.colonists.filter((c) => c.health > 0 && c.role === 'driller').length
      const rigCount = s.buildings.filter((b) => b.type === 'drillrig' && !b.damaged).length
      const engCount = s.colonists.filter((c) => c.health > 0 && c.role === 'engineer').length
      const mod = DIRECTIVE_MODIFIERS[s.activeDirective].drillMult
      const engBonus = 1 + engCount * ENGINEER_EFFICIENCY_BONUS
      return (
        (drillerCount * DRILL_SPEED_PER_DRILLER + rigCount * DRILL_SPEED_PER_RIG) * engBonus * mod
      )
    },

    creditRate(s): number {
      const drillerCount = s.colonists.filter((c) => c.health > 0 && c.role === 'driller').length
      const rigCount = s.buildings.filter((b) => b.type === 'drillrig' && !b.damaged).length
      const engCount = s.colonists.filter((c) => c.health > 0 && c.role === 'engineer').length
      const mod = DIRECTIVE_MODIFIERS[s.activeDirective].drillMult
      const engBonus = 1 + engCount * ENGINEER_EFFICIENCY_BONUS
      const rate =
        (drillerCount * DRILL_SPEED_PER_DRILLER + rigCount * DRILL_SPEED_PER_RIG) * engBonus * mod
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
  },

  actions: {
    // ── Tick ──
    tick(dtMs: number) {
      if (this.gameOver) return
      const dt = dtMs / 1000

      this.totalPlaytimeMs += dtMs
      this.lastTickAt = Date.now()

      const alive = this.aliveColonists
      if (alive.length === 0) {
        this.gameOver = true
        this.gameOverReason = 'All colonists have perished.'
        return
      }

      // Colonist AI
      this.reassignRoles()

      // Power
      const solars = this.buildings.filter((b) => b.type === 'solar' && !b.damaged).length
      const activeBuildings = this.buildings.filter((b) => !b.damaged).length
      const powerProd = solars * POWER_PRODUCTION_PER_SOLAR * this.engineerBonus
      const powerCons = activeBuildings * POWER_CONSUMPTION_PER_BUILDING
      this.power = Math.min(this.powerMax, Math.max(0, this.power + (powerProd - powerCons) * dt))

      // Air
      const generators = this.buildings.filter((b) => b.type === 'o2generator' && !b.damaged).length
      const airProd =
        this.power > 0 ? generators * O2_PRODUCTION_PER_GENERATOR * this.engineerBonus : 0
      const airCons = alive.length * AIR_CONSUMPTION_PER_COLONIST
      this.air = Math.min(this.airMax, Math.max(0, this.air + (airProd - airCons) * dt))

      // Drilling + credit income
      const metalsBefore = this.metals
      const drillSpeed = this.drillRate
      let iceFound = false
      if (drillSpeed > 0) {
        const depthGain = drillSpeed * dt
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

      // Health drain when critical
      if (this.air <= 0 || this.power <= 0) {
        for (const c of this.colonists) {
          if (c.health > 0) {
            c.health = Math.max(0, c.health - HEALTH_DRAIN_PER_SEC * dt)
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

      // Update capacities
      this.airMax = STARTING_AIR_MAX + generators * 25
      this.powerMax = STARTING_POWER_MAX + solars * 25

      // Process shipments and supply drops
      this.processShipments()
      this.processSupplyDrops(dtMs)

      // Hazards
      this.checkHazards()

      // Periodic status messages
      this.ticksSinceLastReport++
      if (this.ticksSinceLastReport >= 10) {
        this.generateStatusMessages()
        this.ticksSinceLastReport = 0
      }
    },

    // ── Colonist AI ──
    reassignRoles() {
      const alive = this.colonists.filter((c) => c.health > 0)
      if (alive.length === 0) return

      const ratio = DIRECTIVE_RATIOS[this.activeDirective]
      let targetDrillers = Math.round(alive.length * ratio.driller)
      let targetEngineers = Math.round(alive.length * ratio.engineer)

      // Emergency overrides
      if (
        this.air < this.airMax * 0.2 &&
        this.buildings.some((b) => b.type === 'o2generator' && !b.damaged)
      ) {
        targetEngineers = Math.min(alive.length, targetEngineers + 1)
        targetDrillers = Math.max(0, targetDrillers - 1)
      }
      if (this.power < this.powerMax * 0.2) {
        targetEngineers = Math.min(alive.length, targetEngineers + 1)
        targetDrillers = Math.max(0, targetDrillers - 1)
      }
      if (
        this.buildings.some((b) => b.damaged) &&
        alive.filter((c) => c.role === 'engineer').length === 0
      ) {
        targetEngineers = Math.max(1, targetEngineers)
      }

      // Clamp totals
      if (targetDrillers + targetEngineers > alive.length) {
        targetEngineers = Math.min(targetEngineers, alive.length)
        targetDrillers = Math.min(targetDrillers, alive.length - targetEngineers)
      }

      const currentDrillers = alive.filter((c) => c.role === 'driller').length
      const currentEngineers = alive.filter((c) => c.role === 'engineer').length

      if (currentDrillers === targetDrillers && currentEngineers === targetEngineers) return

      // Reassign: collect who needs to change
      const pool = [...alive]
      // Shuffle for personality variation
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[pool[i], pool[j]] = [pool[j], pool[i]]
      }

      let drillerSlots = targetDrillers
      let engineerSlots = targetEngineers

      for (const c of pool) {
        const oldRole = c.role
        if (drillerSlots > 0) {
          c.role = 'driller'
          drillerSlots--
        } else if (engineerSlots > 0) {
          c.role = 'engineer'
          engineerSlots--
        } else {
          c.role = 'idle'
        }
        if (c.role !== oldRole) {
          this.pushMessage(`${c.name} reassigned to ${c.role}.`, 'info')
        }
      }
    },

    // ── Hazards ──
    checkHazards() {
      if (Date.now() < this.hazardCooldownUntil) return
      const mod = DIRECTIVE_MODIFIERS[this.activeDirective]
      const chance = (HAZARD_BASE_CHANCE + this.depth * HAZARD_DEPTH_SCALE) * (1 - mod.hazardResist)
      if (Math.random() > chance) return

      this.hazardCooldownUntil = Date.now() + HAZARD_CHECK_INTERVAL_MS

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
        `Care package launched: ${itemCount} item(s), ${totalWeight}kg. ETA ${transit / 1000}s.`,
        'event',
      )
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
          const jitterX = (Math.random() - 0.5) * 8
          const jitterY = (Math.random() - 0.5) * 6
          this.supplyDrops.push({
            id: uid(),
            contents: crateItems,
            totalWeight: crateWeight,
            x: LANDING_ZONE.x + jitterX,
            y: LANDING_ZONE.y + jitterY,
            state: 'landed',
            unpackProgress: 0,
            unpackDuration: crateWeight * UNPACK_MS_PER_KG,
            landedAt: this.totalPlaytimeMs,
          })
          const itemNames = crateItems.map((o) => o.label).join(', ')
          this.pushMessage(
            `Care package landed (${crateWeight}kg): ${itemNames}. Crew needed.`,
            'event',
          )
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
            this.colonists.push({ id: uid(), name, role: 'idle', health: 100 })
            this.pushMessage(`${name} has joined the colony.`, 'event')
            break
          }
          case 'repairKit': {
            const damaged = this.buildings.find((b) => b.damaged)
            if (damaged) {
              damaged.damaged = false
              const label = BLUEPRINTS.find((b) => b.type === damaged.type)?.label || damaged.type
              this.pushMessage(`${label} repaired with kit.`, 'event')
            } else {
              this.pushMessage('Repair kit unpacked but nothing to fix.', 'info')
            }
            break
          }
        }
      }
      this.pushMessage(`Care package fully unpacked (${drop.contents.length} items).`, 'event')
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
        this.pushMessage(`${damaged.length} building(s) damaged. Send a repair kit.`, 'warning')
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
    },

    // ── Offline ──
    processOfflineTime() {
      const now = Date.now()
      const elapsed = now - this.lastTickAt
      if (elapsed > 2000) {
        const capped = Math.min(elapsed, 5 * 60 * 1000)
        this.tick(capped)
      }
    },

    // ── Persistence ──
    async save() {
      this.lastSavedAt = Date.now()
      const data = JSON.stringify(this.$state)
      try {
        await Preferences.set({ key: SAVE_KEY, value: data })
      } catch {
        localStorage.setItem(SAVE_KEY, data)
      }
    },

    async load() {
      try {
        const { value } = await Preferences.get({ key: SAVE_KEY })
        if (value) {
          const parsed = JSON.parse(value) as Partial<ColonyState>
          this.$patch(parsed)
          this.migrateState()
          return
        }
      } catch {
        /* fall through */
      }
      const raw = localStorage.getItem(SAVE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ColonyState>
        this.$patch(parsed)
        this.migrateState()
      }
    },

    migrateState() {
      // Backfill building positions
      for (const b of this.buildings) {
        if (b.x === undefined || b.y === undefined) {
          const pos = getBuildingPosition(
            b.type,
            this.buildings.filter((ob) => ob.id !== b.id && ob.x !== undefined),
          )
          b.x = pos.x
          b.y = pos.y
        }
      }
      // Backfill new fields
      if (this.credits === undefined) this.credits = 50
      if (this.totalCreditsEarned === undefined) this.totalCreditsEarned = 50
      if (this.activeDirective === undefined) this.activeDirective = 'balanced'
      if (!this.messages) this.messages = []
      if (!this.inTransitShipments) this.inTransitShipments = []
      if (!this.supplyDrops) this.supplyDrops = []
      if (!this.manifest) this.manifest = []
      if (this.shipmentCooldownUntil === undefined) this.shipmentCooldownUntil = 0
      if (this.ticksSinceLastReport === undefined) this.ticksSinceLastReport = 0
    },
  },
})
