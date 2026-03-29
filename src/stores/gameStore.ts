import { defineStore } from 'pinia'
import { Preferences } from '@capacitor/preferences'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CrewRole = 'driller' | 'refiner' | 'researcher'

export interface CrewMember {
  id: string
  name: string
  role: CrewRole
  level: number
  xp: number
  xpToNext: number
}

export interface Upgrade {
  id: string
  name: string
  description: string
  cost: number
  costResource: 'ore' | 'crystals' | 'data'
  purchased: boolean
  multiplier: number
  target: 'drillSpeed' | 'refineRate' | 'researchRate' | 'offlineCap'
}

export interface Anomaly {
  id: string
  depth: number
  title: string
  description: string
  resolved: boolean
  reward: Partial<GameResources>
}

export interface GameResources {
  ore: number
  crystals: number
  data: number
}

export interface PrestigeBonus {
  drillMultiplier: number
  offlineCapHours: number
  startingOre: number
}

export interface GameState {
  // Core
  depth: number              // current depth in meters
  maxDepth: number           // all-time deepest
  prestigeCount: number

  // Resources
  resources: GameResources
  resourceRates: GameResources  // per-second

  // Crew
  crew: CrewMember[]

  // Upgrades
  upgrades: Upgrade[]

  // Anomalies
  activeAnomaly: Anomaly | null
  resolvedAnomalies: string[]

  // Prestige bonuses (permanent)
  prestigeBonus: PrestigeBonus

  // Monetization
  removeAds: boolean
  offlineBoostUntil: number  // unix ms — 2x offline earnings active until this time

  // Meta
  lastSavedAt: number        // unix ms
  lastTickAt: number
  totalPlaytimeMs: number
  offlineEarningCapMs: number  // max offline time to credit (default 8hr)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_INTERVAL_MS = 1000
const DEFAULT_OFFLINE_CAP_MS = 8 * 60 * 60 * 1000  // 8 hours
const SAVE_INTERVAL_MS = 30_000                      // auto-save every 30s
const BASE_DRILL_SPEED = 0.1                         // meters per second base
const PRESTIGE_DEPTH_THRESHOLD = 1000               // meters to unlock prestige

const STARTING_CREW: CrewMember[] = [
  { id: 'crew-1', name: 'Mara', role: 'driller', level: 1, xp: 0, xpToNext: 100 },
  { id: 'crew-2', name: 'Fen',  role: 'refiner', level: 1, xp: 0, xpToNext: 100 },
]

const INITIAL_UPGRADES: Upgrade[] = [
  {
    id: 'drill-1',
    name: 'Tungsten Bit',
    description: 'Increases drill speed by 50%',
    cost: 50, costResource: 'ore',
    purchased: false, multiplier: 1.5, target: 'drillSpeed',
  },
  {
    id: 'drill-2',
    name: 'Plasma Cutter',
    description: 'Doubles drill speed',
    cost: 300, costResource: 'ore',
    purchased: false, multiplier: 2.0, target: 'drillSpeed',
  },
  {
    id: 'refine-1',
    name: 'Ore Sifter',
    description: 'Refinery yields 40% more crystals',
    cost: 80, costResource: 'ore',
    purchased: false, multiplier: 1.4, target: 'refineRate',
  },
  {
    id: 'research-1',
    name: 'Signal Decoder',
    description: 'Research generates 2x data',
    cost: 120, costResource: 'crystals',
    purchased: false, multiplier: 2.0, target: 'researchRate',
  },
  {
    id: 'offline-1',
    name: 'Autonomous Systems',
    description: 'Offline earning cap extended to 12 hours',
    cost: 500, costResource: 'crystals',
    purchased: false, multiplier: 1.5, target: 'offlineCap',
  },
]

const ANOMALY_POOL: Omit<Anomaly, 'resolved'>[] = [
  {
    id: 'anomaly-fossil',
    depth: 100,
    title: 'Ancient Fossil Layer',
    description: 'Your crew uncovered a dense fossil bed. Extracting samples...',
    resolved: false,
    reward: { data: 50 },
  },
  {
    id: 'anomaly-void',
    depth: 250,
    title: 'Hollow Void',
    description: 'A large underground cavity. Structural risk — reinforce or push through?',
    resolved: false,
    reward: { crystals: 80 },
  },
  {
    id: 'anomaly-signal',
    depth: 500,
    title: 'Unknown Signal',
    description: 'Deep frequency detected. Origin unknown. Your researchers are excited.',
    resolved: false,
    reward: { data: 200, crystals: 50 },
  },
  {
    id: 'anomaly-vein',
    depth: 750,
    title: 'Crystal Megavein',
    description: 'A vein unlike anything logged before. This could change everything.',
    resolved: false,
    reward: { crystals: 500 },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcDrillSpeed(state: GameState): number {
  const drillers = state.crew.filter(c => c.role === 'driller')
  const crewBonus = drillers.reduce((acc, c) => acc + (c.level * 0.1), 1)
  const upgradeMultiplier = state.upgrades
    .filter(u => u.purchased && u.target === 'drillSpeed')
    .reduce((acc, u) => acc * u.multiplier, 1)
  return BASE_DRILL_SPEED * crewBonus * upgradeMultiplier * state.prestigeBonus.drillMultiplier
}

function calcRefineRate(state: GameState): number {
  const refiners = state.crew.filter(c => c.role === 'refiner')
  const crewBonus = refiners.reduce((acc, c) => acc + (c.level * 0.05), 0.5)
  const upgradeMultiplier = state.upgrades
    .filter(u => u.purchased && u.target === 'refineRate')
    .reduce((acc, u) => acc * u.multiplier, 1)
  return crewBonus * upgradeMultiplier
}

function calcResearchRate(state: GameState): number {
  const researchers = state.crew.filter(c => c.role === 'researcher')
  const crewBonus = researchers.reduce((acc, c) => acc + (c.level * 0.05), 0.2)
  const upgradeMultiplier = state.upgrades
    .filter(u => u.purchased && u.target === 'researchRate')
    .reduce((acc, u) => acc * u.multiplier, 1)
  return crewBonus * upgradeMultiplier
}

function checkForAnomaly(depth: number, resolved: string[]): Anomaly | null {
  const candidate = ANOMALY_POOL.find(
    a => depth >= a.depth && !resolved.includes(a.id)
  )
  return candidate ? { ...candidate, resolved: false } : null
}

function crewXpForTick(member: CrewMember): number {
  return member.level * 2
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useGameStore = defineStore('game', {
  state: (): GameState => ({
    depth: 0,
    maxDepth: 0,
    prestigeCount: 0,

    resources: { ore: 0, crystals: 0, data: 0 },
    resourceRates: { ore: 0, crystals: 0, data: 0 },

    crew: [...STARTING_CREW],
    upgrades: [...INITIAL_UPGRADES],

    activeAnomaly: null,
    resolvedAnomalies: [],

    prestigeBonus: {
      drillMultiplier: 1,
      offlineCapHours: 8,
      startingOre: 0,
    },

    removeAds: false,
    offlineBoostUntil: 0,

    lastSavedAt: Date.now(),
    lastTickAt: Date.now(),
    totalPlaytimeMs: 0,
    offlineEarningCapMs: DEFAULT_OFFLINE_CAP_MS,
  }),

  getters: {
    drillSpeed: (state) => calcDrillSpeed(state),
    refineRate: (state) => calcRefineRate(state),
    researchRate: (state) => calcResearchRate(state),
    canPrestige: (state) => state.depth >= PRESTIGE_DEPTH_THRESHOLD,
    offlineCapHours: (state) => state.offlineEarningCapMs / (60 * 60 * 1000),
    hasOfflineBoost: (state) => state.offlineBoostUntil > Date.now(),
  },

  actions: {
    // ── Tick (called every second by the game loop) ──────────────────────────

    tick(deltaMs: number) {
      const deltaS = deltaMs / 1000

      // Drill deeper
      const drillSpeed = calcDrillSpeed(this.$state)
      this.depth += drillSpeed * deltaS
      if (this.depth > this.maxDepth) this.maxDepth = this.depth

      // Generate resources
      const oreGain = drillSpeed * 2 * deltaS
      const crystalGain = calcRefineRate(this.$state) * deltaS
      const dataGain = calcResearchRate(this.$state) * deltaS

      this.resources.ore += oreGain
      this.resources.crystals += crystalGain
      this.resources.data += dataGain

      // Update display rates
      this.resourceRates = {
        ore: drillSpeed * 2,
        crystals: calcRefineRate(this.$state),
        data: calcResearchRate(this.$state),
      }

      // Crew XP
      this.crew = this.crew.map(member => {
        const xpGain = crewXpForTick(member) * deltaS
        let { xp, xpToNext, level } = member
        xp += xpGain
        while (xp >= xpToNext) {
          xp -= xpToNext
          level += 1
          xpToNext = Math.floor(xpToNext * 1.5)
        }
        return { ...member, xp, xpToNext, level }
      })

      // Check anomalies
      if (!this.activeAnomaly) {
        const anomaly = checkForAnomaly(this.depth, this.resolvedAnomalies)
        if (anomaly) this.activeAnomaly = anomaly
      }

      this.lastTickAt = Date.now()
      this.totalPlaytimeMs += deltaMs
    },

    // ── Offline catch-up ─────────────────────────────────────────────────────

    processOfflineTime() {
      const now = Date.now()
      const elapsed = Math.min(now - this.lastTickAt, this.offlineEarningCapMs)
      if (elapsed > 5000) {
        this.tick(elapsed)
      }
      this.lastTickAt = now
    },

    // ── Tap boost (early game) ────────────────────────────────────────────────

    tap() {
      const tapBonus = calcDrillSpeed(this.$state) * 2
      this.depth += tapBonus
      this.resources.ore += tapBonus * 2
    },

    // ── Purchases ────────────────────────────────────────────────────────────

    purchaseUpgrade(upgradeId: string): boolean {
      const upgrade = this.upgrades.find(u => u.id === upgradeId)
      if (!upgrade || upgrade.purchased) return false

      const balance = this.resources[upgrade.costResource]
      if (balance < upgrade.cost) return false

      this.resources[upgrade.costResource] -= upgrade.cost
      this.upgrades = this.upgrades.map(u =>
        u.id === upgradeId ? { ...u, purchased: true } : u
      )

      // Extend offline cap if applicable
      if (upgrade.target === 'offlineCap') {
        this.offlineEarningCapMs = Math.floor(this.offlineEarningCapMs * upgrade.multiplier)
      }

      return true
    },

    hireCrew(role: CrewRole, cost: number): boolean {
      if (this.resources.ore < cost) return false
      this.resources.ore -= cost

      const names = ['Syd', 'Rook', 'Cael', 'Vex', 'Nori', 'Trace']
      const name = names[Math.floor(Math.random() * names.length)]
      const id = `crew-${Date.now()}`

      this.crew.push({ id, name, role, level: 1, xp: 0, xpToNext: 100 })
      return true
    },

    // ── Anomaly resolution ───────────────────────────────────────────────────

    resolveAnomaly() {
      if (!this.activeAnomaly) return

      const { reward, id } = this.activeAnomaly
      if (reward.ore)      this.resources.ore      += reward.ore
      if (reward.crystals) this.resources.crystals += reward.crystals
      if (reward.data)     this.resources.data      += reward.data

      this.resolvedAnomalies.push(id)
      this.activeAnomaly = null
    },

    // ── Prestige ─────────────────────────────────────────────────────────────

    prestige() {
      if (!this.canPrestige) return

      const depthBonus = Math.floor(this.depth / 500)

      this.prestigeCount += 1
      this.prestigeBonus.drillMultiplier += depthBonus * 0.1
      this.prestigeBonus.offlineCapHours = Math.min(24, this.prestigeBonus.offlineCapHours + 1)
      this.prestigeBonus.startingOre += depthBonus * 10

      // Preserve crew XP and levels across prestige
      const survivingCrew = this.crew.map(c => ({ ...c }))

      // Reset run state
      this.depth = 0
      this.resources = {
        ore: this.prestigeBonus.startingOre,
        crystals: 0,
        data: 0,
      }
      this.upgrades = INITIAL_UPGRADES.map(u => ({ ...u, purchased: false }))
      this.activeAnomaly = null
      this.resolvedAnomalies = []
      this.crew = survivingCrew
      this.offlineEarningCapMs = this.prestigeBonus.offlineCapHours * 60 * 60 * 1000
    },

    // ── Persistence ───────────────────────────────────────────────────────────

    async save() {
      const snapshot = JSON.stringify(this.$state)
      await Preferences.set({ key: 'deepstation_save', value: snapshot })
      this.lastSavedAt = Date.now()
    },

    async load() {
      const { value } = await Preferences.get({ key: 'deepstation_save' })
      if (!value) return

      try {
        const saved = JSON.parse(value) as GameState
        this.$patch(saved)
        this.processOfflineTime()
      } catch (e) {
        console.warn('Save data corrupt, starting fresh', e)
      }
    },

    resetSave() {
      Preferences.remove({ key: 'deepstation_save' })
      this.$reset()
    },
  },
})
