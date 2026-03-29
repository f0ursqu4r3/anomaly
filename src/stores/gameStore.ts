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
  resolvedAnomalies: string[]       // tracks story anomaly IDs (permanent across prestiges)
  nextAnomalyDepth: number          // depth at which next procedural anomaly triggers

  // Combo system
  comboCount: number
  comboLastTapAt: number     // unix ms
  totalTaps: number

  // Milestones
  claimedMilestones: number[]
  lastMilestoneDepth: number | null  // for UI flash trigger

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

interface UpgradeDef extends Omit<Upgrade, 'purchased'> {
  prestigeReq: number  // minimum prestige count to appear
}

const ALL_UPGRADES: UpgradeDef[] = [
  // ── Tier 0 (always available) ──────────────────────────────────────────────
  { id: 'drill-1', name: 'Tungsten Bit', description: 'Drill speed +50%',
    cost: 50, costResource: 'ore', multiplier: 1.5, target: 'drillSpeed', prestigeReq: 0 },
  { id: 'drill-2', name: 'Plasma Cutter', description: 'Drill speed x2',
    cost: 300, costResource: 'ore', multiplier: 2.0, target: 'drillSpeed', prestigeReq: 0 },
  { id: 'refine-1', name: 'Ore Sifter', description: 'Crystal yield +40%',
    cost: 80, costResource: 'ore', multiplier: 1.4, target: 'refineRate', prestigeReq: 0 },
  { id: 'research-1', name: 'Signal Decoder', description: 'Research data x2',
    cost: 120, costResource: 'crystals', multiplier: 2.0, target: 'researchRate', prestigeReq: 0 },
  { id: 'offline-1', name: 'Autonomous Systems', description: 'Offline cap +50%',
    cost: 500, costResource: 'crystals', multiplier: 1.5, target: 'offlineCap', prestigeReq: 0 },

  // ── Tier 1 (prestige 1+) ───────────────────────────────────────────────────
  { id: 'drill-3', name: 'Diamond Bore', description: 'Drill speed +80%',
    cost: 200, costResource: 'ore', multiplier: 1.8, target: 'drillSpeed', prestigeReq: 1 },
  { id: 'refine-2', name: 'Centrifuge', description: 'Crystal yield x2',
    cost: 400, costResource: 'ore', multiplier: 2.0, target: 'refineRate', prestigeReq: 1 },
  { id: 'research-2', name: 'Deep Scanner', description: 'Research data +60%',
    cost: 300, costResource: 'crystals', multiplier: 1.6, target: 'researchRate', prestigeReq: 1 },

  // ── Tier 2 (prestige 3+) ───────────────────────────────────────────────────
  { id: 'drill-4', name: 'Graviton Drill', description: 'Drill speed x2.5',
    cost: 800, costResource: 'ore', multiplier: 2.5, target: 'drillSpeed', prestigeReq: 3 },
  { id: 'refine-3', name: 'Molecular Forge', description: 'Crystal yield +75%',
    cost: 600, costResource: 'crystals', multiplier: 1.75, target: 'refineRate', prestigeReq: 3 },
  { id: 'research-3', name: 'Quantum Array', description: 'Research data x2.5',
    cost: 1000, costResource: 'data', multiplier: 2.5, target: 'researchRate', prestigeReq: 3 },
  { id: 'offline-2', name: 'Sleepless Engine', description: 'Offline cap x2',
    cost: 1500, costResource: 'crystals', multiplier: 2.0, target: 'offlineCap', prestigeReq: 3 },

  // ── Tier 3 (prestige 5+) ───────────────────────────────────────────────────
  { id: 'drill-5', name: 'Singularity Core', description: 'Drill speed x3',
    cost: 3000, costResource: 'ore', multiplier: 3.0, target: 'drillSpeed', prestigeReq: 5 },
  { id: 'refine-4', name: 'Atomic Smelter', description: 'Crystal yield x3',
    cost: 2500, costResource: 'crystals', multiplier: 3.0, target: 'refineRate', prestigeReq: 5 },
  { id: 'research-4', name: 'Neural Nexus', description: 'Research data x3',
    cost: 2000, costResource: 'data', multiplier: 3.0, target: 'researchRate', prestigeReq: 5 },

  // ── Tier 4 (prestige 10+) ──────────────────────────────────────────────────
  { id: 'drill-6', name: 'Void Piercer', description: 'Drill speed x5',
    cost: 10000, costResource: 'ore', multiplier: 5.0, target: 'drillSpeed', prestigeReq: 10 },
  { id: 'refine-5', name: 'Crystal Synthesizer', description: 'Crystal yield x5',
    cost: 8000, costResource: 'crystals', multiplier: 5.0, target: 'refineRate', prestigeReq: 10 },
  { id: 'research-5', name: 'Omniscience Engine', description: 'Research data x5',
    cost: 8000, costResource: 'data', multiplier: 5.0, target: 'researchRate', prestigeReq: 10 },
  { id: 'offline-3', name: 'Perpetual Motion', description: 'Offline cap x3',
    cost: 15000, costResource: 'crystals', multiplier: 3.0, target: 'offlineCap', prestigeReq: 10 },
]

function getUpgradesForPrestige(prestigeCount: number): Upgrade[] {
  return ALL_UPGRADES
    .filter(u => u.prestigeReq <= prestigeCount)
    .map(u => ({ id: u.id, name: u.name, description: u.description, cost: u.cost, costResource: u.costResource, multiplier: u.multiplier, target: u.target, purchased: false }))
}

// Story anomalies — one-time encounters, never repeat across prestiges
const STORY_ANOMALIES: Omit<Anomaly, 'resolved'>[] = [
  { id: 'story-fossil', depth: 100, title: 'Ancient Fossil Layer', resolved: false,
    description: 'Your crew uncovered a dense fossil bed. Extracting samples...',
    reward: { data: 50 } },
  { id: 'story-void', depth: 250, title: 'Hollow Void', resolved: false,
    description: 'A large underground cavity. Structural risk — reinforce or push through?',
    reward: { crystals: 80 } },
  { id: 'story-signal', depth: 500, title: 'Unknown Signal', resolved: false,
    description: 'Deep frequency detected. Origin unknown. Your researchers are excited.',
    reward: { data: 200, crystals: 50 } },
  { id: 'story-ruins', depth: 1000, title: 'Buried Structure', resolved: false,
    description: 'Geometric patterns in the stone. This was built by someone — or something.',
    reward: { data: 500, crystals: 200 } },
  { id: 'story-gravity', depth: 2000, title: 'Gravitational Anomaly', resolved: false,
    description: 'Tools float. The crew feels lighter. Physics is breaking down here.',
    reward: { data: 1000, crystals: 500 } },
  { id: 'story-void-deep', depth: 3000, title: 'The Deep Void', resolved: false,
    description: 'Light stops working. The darkness feels alive. Your instruments show... nothing.',
    reward: { crystals: 2000, data: 2000 } },
]

// Procedural anomaly templates — randomly picked, scale with depth
const PROCEDURAL_TEMPLATES = [
  { title: 'Seismic Tremor', description: 'The walls are shaking. Something massive shifted below.', bias: 'ore' },
  { title: 'Bioluminescent Colony', description: 'Glowing organisms cling to the rock. They pulse in unison.', bias: 'data' },
  { title: 'Crystal Megavein', description: 'A vein unlike anything logged before. This could change everything.', bias: 'crystals' },
  { title: 'Magma Pocket', description: 'Temperature spiking. The drill tip is glowing red. Proceed with caution.', bias: 'ore' },
  { title: 'The Echo Chamber', description: 'Every sound returns distorted. Someone swears they heard their name.', bias: 'data' },
  { title: 'Core Resonance', description: 'A deep hum vibrates through everything. The readings are off the charts.', bias: 'crystals' },
  { title: 'Pressure Spike', description: 'Hull integrity warning. The rock here is under incredible compression.', bias: 'ore' },
  { title: 'Mineral Cascade', description: 'A seam cracked open. Gems are tumbling down the shaft walls.', bias: 'crystals' },
  { title: 'Encrypted Signal', description: 'Patterns in the interference. Definitely not natural.', bias: 'data' },
  { title: 'Thermal Vent', description: 'Superheated gas is escaping from a fissure. Rich mineral deposits line the edges.', bias: 'ore' },
  { title: 'Frozen Cavern', description: 'Ice crystals coat every surface. The temperature dropped 80 degrees in seconds.', bias: 'crystals' },
  { title: 'Magnetic Storm', description: 'Compass spinning. Equipment going haywire. But the sensors are picking up something valuable.', bias: 'data' },
  { title: 'Collapsed Shaft', description: 'An old bore hole. Someone — or something — was here before you.', bias: 'ore' },
  { title: 'Living Rock', description: 'The stone is pulsing. Geological impossibility. Your researchers need samples.', bias: 'data' },
  { title: 'Geode Chamber', description: 'A cathedral-sized hollow lined with enormous crystals.', bias: 'crystals' },
]

// Procedural anomaly spacing: triggers every N meters, where N grows with depth
// Early: ~every 150m, Late: ~every 400-600m
function getNextAnomalyDepth(lastAnomalyDepth: number): number {
  const base = 120
  const scaling = Math.min(lastAnomalyDepth * 0.15, 400)
  const jitter = (Math.random() - 0.3) * 60  // slight randomness, biased slightly shorter
  return Math.floor(lastAnomalyDepth + base + scaling + jitter)
}

function generateProceduralAnomaly(depth: number): Anomaly {
  const template = PROCEDURAL_TEMPLATES[Math.floor(Math.random() * PROCEDURAL_TEMPLATES.length)]
  const scale = depth / 100
  const baseReward = Math.floor(15 * scale + 5 * Math.pow(scale, 1.2))

  const reward: Partial<GameResources> = {}
  switch (template.bias) {
    case 'ore':
      reward.ore = Math.floor(baseReward * 1.5)
      reward.crystals = Math.floor(baseReward * 0.3)
      break
    case 'crystals':
      reward.crystals = Math.floor(baseReward * 1.5)
      reward.data = Math.floor(baseReward * 0.3)
      break
    case 'data':
      reward.data = Math.floor(baseReward * 1.5)
      reward.ore = Math.floor(baseReward * 0.3)
      break
  }

  return {
    id: `proc-${depth}-${Date.now()}`,
    depth,
    title: template.title,
    description: template.description,
    resolved: false,
    reward,
  }
}

// ─── Milestones (procedural curve) ───────────────────────────────────────────

// Generates milestone depths on an exponential curve:
//   10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 650, 800, 1000,
//   1250, 1500, 1800, 2200, 2700, 3300, 4000, 5000, 6200, 7800, 10000, ...
// Early milestones come fast, then gaps widen.
function generateMilestoneDepths(): number[] {
  const depths: number[] = []
  // Hand-tuned early game (fast dopamine hits)
  const earlyDepths = [10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 650, 800, 1000]
  depths.push(...earlyDepths)
  // After 1000m, each gap grows ~25%
  let prev = 1000
  let gap = 250
  while (prev < 100_000) {
    const next = Math.round((prev + gap) / 50) * 50  // snap to nearest 50
    depths.push(next)
    prev = next
    gap = Math.floor(gap * 1.25)
  }
  return depths
}

const MILESTONE_DEPTHS = generateMilestoneDepths()

function milestoneReward(depth: number): { ore: number; crystals: number; data: number } {
  // Rewards scale with depth on a curve
  const t = depth / 100  // scale factor
  return {
    ore: Math.floor(10 * t + 5 * Math.pow(t, 1.3)),
    crystals: depth >= 75 ? Math.floor(3 * t + 2 * Math.pow(t, 1.2)) : 0,
    data: depth >= 200 ? Math.floor(t + Math.pow(t, 1.15)) : 0,
  }
}

const COMBO_WINDOW_MS = 2000
const COMBO_MAX_MULTIPLIER = 5

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

function checkForStoryAnomaly(depth: number, resolved: string[]): Anomaly | null {
  const candidate = STORY_ANOMALIES.find(
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
    upgrades: getUpgradesForPrestige(0),

    activeAnomaly: null,
    resolvedAnomalies: [],
    nextAnomalyDepth: 100,

    comboCount: 0,
    comboLastTapAt: 0,
    totalTaps: 0,

    claimedMilestones: [],
    lastMilestoneDepth: null,

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
    comboMultiplier: (state) => {
      if (state.comboCount <= 1) return 1
      return Math.min(1 + state.comboCount * 0.1, COMBO_MAX_MULTIPLIER)
    },
    comboActive: (state) => {
      if (state.activeAnomaly) return state.comboCount > 1 // freeze while anomaly showing
      return state.comboCount > 1 && (Date.now() - state.comboLastTapAt) < COMBO_WINDOW_MS
    },
    depthZone: (state): string => {
      if (state.depth < 100) return 'surface'
      if (state.depth < 500) return 'rock'
      if (state.depth < 1000) return 'crystal'
      if (state.depth < 2000) return 'magma'
      return 'void'
    },
    depthZoneName: (state): string => {
      if (state.depth < 100) return 'Surface Layer'
      if (state.depth < 500) return 'Shallow Rock'
      if (state.depth < 1000) return 'Crystal Caves'
      if (state.depth < 2000) return 'Magma Depths'
      return 'Deep Void'
    },
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

      // Check anomalies — story first, then procedural
      if (!this.activeAnomaly) {
        const storyAnomaly = checkForStoryAnomaly(this.depth, this.resolvedAnomalies)
        if (storyAnomaly) {
          this.activeAnomaly = storyAnomaly
        } else if (this.depth >= this.nextAnomalyDepth) {
          this.activeAnomaly = generateProceduralAnomaly(this.depth)
          this.nextAnomalyDepth = getNextAnomalyDepth(this.depth)
        }
      }

      // Check milestones (curved spacing)
      this.lastMilestoneDepth = null
      for (const msDepth of MILESTONE_DEPTHS) {
        if (msDepth > this.depth) break  // sorted, no need to check further
        if (!this.claimedMilestones.includes(msDepth)) {
          this.claimedMilestones.push(msDepth)
          const reward = milestoneReward(msDepth)
          this.resources.ore += reward.ore
          this.resources.crystals += reward.crystals
          this.resources.data += reward.data
          this.lastMilestoneDepth = msDepth
        }
      }

      // Decay combo if expired (paused during anomalies)
      if (this.comboCount > 0 && !this.activeAnomaly && (Date.now() - this.comboLastTapAt) > COMBO_WINDOW_MS) {
        this.comboCount = 0
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

    // ── Tap boost with combo ──────────────────────────────────────────────────

    tap(): number {
      const now = Date.now()
      this.totalTaps += 1

      // Combo logic
      if (now - this.comboLastTapAt < COMBO_WINDOW_MS) {
        this.comboCount += 1
      } else {
        this.comboCount = 1
      }
      this.comboLastTapAt = now

      const comboMult = Math.min(1 + this.comboCount * 0.1, COMBO_MAX_MULTIPLIER)
      const tapBonus = calcDrillSpeed(this.$state) * 2 * comboMult
      this.depth += tapBonus
      this.resources.ore += tapBonus * 2

      return tapBonus
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

      // Only track story anomalies (they never repeat)
      if (id.startsWith('story-')) {
        this.resolvedAnomalies.push(id)
      }
      this.activeAnomaly = null

      // Reset combo timer so player has full window to resume tapping
      if (this.comboCount > 0) {
        this.comboLastTapAt = Date.now()
      }
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
      this.upgrades = getUpgradesForPrestige(this.prestigeCount)
      this.activeAnomaly = null
      // Keep story anomaly resolutions — they're permanent
      // Reset procedural anomaly trigger for the new run
      this.nextAnomalyDepth = 100
      this.claimedMilestones = []
      this.lastMilestoneDepth = null
      this.comboCount = 0
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
