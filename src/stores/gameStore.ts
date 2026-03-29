import { defineStore } from 'pinia'
import { Preferences } from '@capacitor/preferences'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CrewRole = 'driller' | 'refiner' | 'researcher'
export type Station = 'drill' | 'refinery' | 'lab' | 'scout' | 'idle'

export interface CrewMember {
  id: string
  name: string
  role: CrewRole
  station: Station
  level: number
  xp: number
  xpToNext: number
  stamina: number  // 0-100
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

export interface AnomalyChoice {
  label: string
  description: string
  risk: number           // 0-1, probability of FAILURE
  reward: Partial<GameResources>
  penalty: Partial<GameResources> & { hullDamage?: number }
}

export interface Anomaly {
  id: string
  depth: number
  title: string
  description: string
  resolved: boolean
  reward: Partial<GameResources>     // legacy fallback
  choices: AnomalyChoice[]
}

export interface AnomalyOutcome {
  success: boolean
  choiceLabel: string
  reward?: Partial<GameResources>
  penalty?: Partial<GameResources> & { hullDamage?: number }
}

export interface HazardEvent {
  id: string
  title: string
  description: string
  hullDamage: number
  staminaHit: number   // applied to random crew
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

export interface Artifact {
  id: string
  name: string
  description: string
  icon: string
  rarity: 'common' | 'rare' | 'legendary'
  bonus: { type: string; value: number }
  found: boolean
}

export interface GameState {
  // Core
  depth: number
  maxDepth: number
  prestigeCount: number

  // Resources
  resources: GameResources
  resourceRates: GameResources

  // Hull
  hullIntegrity: number  // 0-100
  gameOver: boolean

  // Crew
  crew: CrewMember[]

  // Upgrades
  upgrades: Upgrade[]

  // Anomalies
  activeAnomaly: Anomaly | null
  lastAnomalyOutcome: AnomalyOutcome | null
  resolvedAnomalies: string[]
  nextAnomalyDepth: number

  // Hazards
  lastHazard: HazardEvent | null
  hazardCooldownUntil: number  // no hazards until this time

  // Combo system
  comboCount: number
  comboLastTapAt: number
  totalTaps: number

  // Milestones
  claimedMilestones: number[]
  lastMilestoneDepth: number | null

  // Exploration
  scoutPoints: number
  currentPathId: string | null
  exploredPaths: string[]
  nextPathGateDepth: number
  pathChoicePending: boolean
  pathOptions: TunnelPath[]

  // Artifacts
  artifacts: Artifact[]

  // Prestige bonuses (permanent)
  prestigeBonus: PrestigeBonus

  // Monetization
  removeAds: boolean
  offlineBoostUntil: number

  // Meta
  lastSavedAt: number
  lastTickAt: number
  totalPlaytimeMs: number
  offlineEarningCapMs: number
}

// ─── Exploration Types ────────────────────────────────────────────────────────

export interface TunnelPath {
  id: string
  name: string
  description: string
  depthStart: number
  depthEnd: number
  modifiers: {
    drillSpeedMult: number
    oreBonus: number
    crystalBonus: number
    hazardRate: number
  }
  scouted: boolean      // whether full info is revealed
  artifactId?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_OFFLINE_CAP_MS = 8 * 60 * 60 * 1000
const BASE_DRILL_SPEED = 0.1
const PRESTIGE_DEPTH_THRESHOLD = 1000
const COMBO_WINDOW_MS = 2000
const COMBO_MAX_MULTIPLIER = 5
const STAMINA_DRAIN_PER_SEC = 0.08       // working crew lose stamina (~21 min to drain)
const STAMINA_RECOVER_PER_SEC = 0.4      // idle crew recover stamina (~4 min full)
const STAMINA_LOW_THRESHOLD = 40         // efficiency drops below this
const HULL_EMERGENCY_THRESHOLD = 20      // drill speed halved
const ROLE_MATCH_BONUS = 1.5             // bonus when role matches station
const HAZARD_CHECK_INTERVAL_MS = 10_000  // check for hazard every 10s
const HAZARD_BASE_CHANCE = 0.025         // 2.5% per check
const SCOUT_POINTS_PER_SEC = 0.1         // per scout crew member (base)

const STARTING_CREW: CrewMember[] = [
  { id: 'crew-1', name: 'Mara', role: 'driller', station: 'drill', level: 1, xp: 0, xpToNext: 100, stamina: 100 },
  { id: 'crew-2', name: 'Fen',  role: 'refiner', station: 'refinery', level: 1, xp: 0, xpToNext: 100, stamina: 100 },
]

// ─── Role-to-Station mapping ─────────────────────────────────────────────────

function roleMatchesStation(role: CrewRole, station: Station): boolean {
  return (role === 'driller' && station === 'drill') ||
         (role === 'refiner' && station === 'refinery') ||
         (role === 'researcher' && station === 'lab')
}

function defaultStationForRole(role: CrewRole): Station {
  switch (role) {
    case 'driller': return 'drill'
    case 'refiner': return 'refinery'
    case 'researcher': return 'lab'
  }
}

// ─── Upgrades ─────────────────────────────────────────────────────────────────

interface UpgradeDef extends Omit<Upgrade, 'purchased'> {
  prestigeReq: number
}

const ALL_UPGRADES: UpgradeDef[] = [
  // Tier 0
  { id: 'drill-1', name: 'Tungsten Bit', description: 'Drill speed +50%',
    cost: 30, costResource: 'ore', multiplier: 1.5, target: 'drillSpeed', prestigeReq: 0 },
  { id: 'drill-2', name: 'Plasma Cutter', description: 'Drill speed x2',
    cost: 150, costResource: 'ore', multiplier: 2.0, target: 'drillSpeed', prestigeReq: 0 },
  { id: 'refine-1', name: 'Ore Sifter', description: 'Crystal yield +40%',
    cost: 40, costResource: 'ore', multiplier: 1.4, target: 'refineRate', prestigeReq: 0 },
  { id: 'research-1', name: 'Signal Decoder', description: 'Research data x2',
    cost: 60, costResource: 'crystals', multiplier: 2.0, target: 'researchRate', prestigeReq: 0 },
  { id: 'offline-1', name: 'Autonomous Systems', description: 'Offline cap +50%',
    cost: 300, costResource: 'crystals', multiplier: 1.5, target: 'offlineCap', prestigeReq: 0 },
  // Tier 1
  { id: 'drill-3', name: 'Diamond Bore', description: 'Drill speed +80%',
    cost: 200, costResource: 'ore', multiplier: 1.8, target: 'drillSpeed', prestigeReq: 1 },
  { id: 'refine-2', name: 'Centrifuge', description: 'Crystal yield x2',
    cost: 400, costResource: 'ore', multiplier: 2.0, target: 'refineRate', prestigeReq: 1 },
  { id: 'research-2', name: 'Deep Scanner', description: 'Research data +60%',
    cost: 300, costResource: 'crystals', multiplier: 1.6, target: 'researchRate', prestigeReq: 1 },
  // Tier 2
  { id: 'drill-4', name: 'Graviton Drill', description: 'Drill speed x2.5',
    cost: 800, costResource: 'ore', multiplier: 2.5, target: 'drillSpeed', prestigeReq: 3 },
  { id: 'refine-3', name: 'Molecular Forge', description: 'Crystal yield +75%',
    cost: 600, costResource: 'crystals', multiplier: 1.75, target: 'refineRate', prestigeReq: 3 },
  { id: 'research-3', name: 'Quantum Array', description: 'Research data x2.5',
    cost: 1000, costResource: 'data', multiplier: 2.5, target: 'researchRate', prestigeReq: 3 },
  { id: 'offline-2', name: 'Sleepless Engine', description: 'Offline cap x2',
    cost: 1500, costResource: 'crystals', multiplier: 2.0, target: 'offlineCap', prestigeReq: 3 },
  // Tier 3
  { id: 'drill-5', name: 'Singularity Core', description: 'Drill speed x3',
    cost: 3000, costResource: 'ore', multiplier: 3.0, target: 'drillSpeed', prestigeReq: 5 },
  { id: 'refine-4', name: 'Atomic Smelter', description: 'Crystal yield x3',
    cost: 2500, costResource: 'crystals', multiplier: 3.0, target: 'refineRate', prestigeReq: 5 },
  { id: 'research-4', name: 'Neural Nexus', description: 'Research data x3',
    cost: 2000, costResource: 'data', multiplier: 3.0, target: 'researchRate', prestigeReq: 5 },
  // Tier 4
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
  // Higher tier upgrades cost more to prevent instant-buy in late game
  const tierCostMult: Record<number, number> = { 0: 1, 1: 1.5, 3: 2, 5: 3, 10: 5 }
  return ALL_UPGRADES
    .filter(u => u.prestigeReq <= prestigeCount)
    .map(u => {
      const costMult = tierCostMult[u.prestigeReq] ?? 1
      return { id: u.id, name: u.name, description: u.description, cost: Math.floor(u.cost * costMult), costResource: u.costResource, multiplier: u.multiplier, target: u.target, purchased: false }
    })
}

// ─── Story Anomalies (with choices) ──────────────────────────────────────────

function makeStoryAnomalies(): Omit<Anomaly, 'resolved'>[] {
  return [
    { id: 'story-fossil', depth: 100, title: 'Ancient Fossil Layer',
      description: 'Your crew uncovered a dense fossil bed. How do you proceed?',
      reward: { data: 50 },
      choices: [
        { label: 'Careful study', description: 'Send researchers to catalog everything', risk: 0, reward: { data: 80 }, penalty: {} },
        { label: 'Quick extraction', description: 'Grab what you can and keep drilling', risk: 0.1, reward: { data: 40, ore: 30 }, penalty: { data: 10 } },
        { label: 'Blast through', description: 'Explosives clear the way fast', risk: 0.3, reward: { ore: 60 }, penalty: { hullDamage: 10 } },
      ]},
    { id: 'story-void', depth: 250, title: 'Hollow Void',
      description: 'A massive underground cavity. The structural risk is real.',
      reward: { crystals: 80 },
      choices: [
        { label: 'Reinforce walls', description: 'Slow but safe — costs ore to shore up', risk: 0, reward: { crystals: 60 }, penalty: {} },
        { label: 'Rappel down', description: 'Send crew to explore the cavity floor', risk: 0.2, reward: { crystals: 150, data: 40 }, penalty: { hullDamage: 15 } },
        { label: 'Collapse it', description: 'Seal the void and push through', risk: 0.15, reward: { ore: 100 }, penalty: { hullDamage: 20 } },
      ]},
    { id: 'story-signal', depth: 500, title: 'Unknown Signal',
      description: 'Deep frequency detected. Origin unknown. Your researchers are excited.',
      reward: { data: 200, crystals: 50 },
      choices: [
        { label: 'Trace the signal', description: 'Divert all researchers to decoding', risk: 0.1, reward: { data: 350 }, penalty: { data: 50 } },
        { label: 'Follow it deeper', description: 'The signal leads to a crystal pocket', risk: 0.25, reward: { crystals: 200, data: 100 }, penalty: { hullDamage: 10 } },
        { label: 'Ignore it', description: 'Too risky. Keep drilling.', risk: 0, reward: { ore: 80 }, penalty: {} },
      ]},
    { id: 'story-ruins', depth: 1000, title: 'Buried Structure',
      description: 'Geometric patterns in the stone. This was built by someone — or something.',
      reward: { data: 500, crystals: 200 },
      choices: [
        { label: 'Excavate carefully', description: 'Slow archaeological approach', risk: 0, reward: { data: 600, crystals: 100 }, penalty: {} },
        { label: 'Breach the walls', description: 'Force entry to the inner chambers', risk: 0.3, reward: { crystals: 500, data: 300 }, penalty: { hullDamage: 25 } },
        { label: 'Scan and leave', description: 'Record data from outside', risk: 0, reward: { data: 400 }, penalty: {} },
      ]},
    { id: 'story-gravity', depth: 2000, title: 'Gravitational Anomaly',
      description: 'Tools float. The crew feels lighter. Physics is breaking down here.',
      reward: { data: 1000, crystals: 500 },
      choices: [
        { label: 'Study the field', description: 'Researchers could learn incredible things', risk: 0.15, reward: { data: 1500 }, penalty: { hullDamage: 10 } },
        { label: 'Mine the boundary', description: 'The gravity edge concentrates rare minerals', risk: 0.25, reward: { crystals: 1000, ore: 500 }, penalty: { hullDamage: 20 } },
        { label: 'Push through fast', description: 'Get out before things get worse', risk: 0.1, reward: { ore: 300 }, penalty: { hullDamage: 5 } },
      ]},
    { id: 'story-void-deep', depth: 3000, title: 'The Deep Void',
      description: 'Light stops working. The darkness feels alive. Your instruments show... nothing.',
      reward: { crystals: 2000, data: 2000 },
      choices: [
        { label: 'Send a probe', description: 'Unmanned drone into the darkness', risk: 0.2, reward: { data: 3000 }, penalty: { data: 500 } },
        { label: 'Full expedition', description: 'Crew ventures in. High risk, legendary rewards.', risk: 0.4, reward: { crystals: 3000, data: 2000, ore: 1000 }, penalty: { hullDamage: 30 } },
        { label: 'Seal and record', description: 'Mark coordinates for future runs', risk: 0, reward: { data: 1000 }, penalty: {} },
      ]},
  ]
}

// ─── Procedural Anomaly Generation (with choices) ────────────────────────────

const PROCEDURAL_TEMPLATES = [
  { title: 'Seismic Tremor', description: 'The walls are shaking. Something massive shifted below.', bias: 'ore' as const },
  { title: 'Bioluminescent Colony', description: 'Glowing organisms cling to the rock. They pulse in unison.', bias: 'data' as const },
  { title: 'Crystal Megavein', description: 'A vein unlike anything logged before.', bias: 'crystals' as const },
  { title: 'Magma Pocket', description: 'Temperature spiking. The drill tip is glowing red.', bias: 'ore' as const },
  { title: 'The Echo Chamber', description: 'Every sound returns distorted. Someone swears they heard their name.', bias: 'data' as const },
  { title: 'Pressure Spike', description: 'Hull integrity warning. The rock is under incredible compression.', bias: 'ore' as const },
  { title: 'Mineral Cascade', description: 'A seam cracked open. Gems are tumbling down the walls.', bias: 'crystals' as const },
  { title: 'Encrypted Signal', description: 'Patterns in the interference. Definitely not natural.', bias: 'data' as const },
  { title: 'Thermal Vent', description: 'Superheated gas from a fissure. Rich deposits line the edges.', bias: 'ore' as const },
  { title: 'Frozen Cavern', description: 'Ice crystals coat every surface. Temperature dropped 80 degrees.', bias: 'crystals' as const },
  { title: 'Magnetic Storm', description: 'Compass spinning. But the sensors are picking up something valuable.', bias: 'data' as const },
  { title: 'Collapsed Shaft', description: 'An old bore hole. Someone was here before you.', bias: 'ore' as const },
  { title: 'Living Rock', description: 'The stone is pulsing. Geological impossibility.', bias: 'data' as const },
  { title: 'Geode Chamber', description: 'A cathedral-sized hollow lined with enormous crystals.', bias: 'crystals' as const },
  { title: 'Core Resonance', description: 'A deep hum vibrates through everything.', bias: 'crystals' as const },
]

function getNextAnomalyDepth(lastDepth: number, drillSpeed: number): number {
  // Target: one anomaly every ~45-90 seconds of real time
  // At low speeds this means short distance gaps; at high speeds, huge gaps
  const targetSeconds = 45 + Math.random() * 45  // 45-90s between anomalies
  const speedBasedGap = drillSpeed * targetSeconds
  // Floor: at least 200m between anomalies even at very low speed
  const minGap = 200
  return Math.floor(lastDepth + Math.max(minGap, speedBasedGap))
}

function generateProceduralAnomaly(depth: number): Anomaly {
  const template = PROCEDURAL_TEMPLATES[Math.floor(Math.random() * PROCEDURAL_TEMPLATES.length)]
  const scale = depth / 100
  const base = Math.floor(15 * scale + 5 * Math.pow(scale, 1.2))

  const biasKey = template.bias
  const safeReward: Partial<GameResources> = { [biasKey]: Math.floor(base * 0.8) }
  const riskyReward: Partial<GameResources> = { [biasKey]: Math.floor(base * 2.0) }
  const secondaryKey = biasKey === 'ore' ? 'crystals' : biasKey === 'crystals' ? 'data' : 'ore'
  riskyReward[secondaryKey] = Math.floor(base * 0.5)

  const hullRisk = Math.floor(5 + depth / 500)

  return {
    id: `proc-${depth}-${Date.now()}`,
    depth,
    title: template.title,
    description: template.description,
    resolved: false,
    reward: safeReward,
    choices: [
      { label: 'Cautious approach', description: 'Take it slow, minimize risk',
        risk: 0.05, reward: safeReward, penalty: {} },
      { label: 'Aggressive extraction', description: 'Push hard for maximum yield',
        risk: 0.25 + Math.min(depth / 10000, 0.2), reward: riskyReward,
        penalty: { [biasKey]: Math.floor(base * 0.3), hullDamage: hullRisk } },
      { label: 'Reroute around', description: 'Skip the anomaly entirely',
        risk: 0, reward: { ore: Math.floor(base * 0.2) }, penalty: {} },
    ],
  }
}

// ─── Hazard Templates ─────────────────────────────────────────────────────────

const HAZARD_TEMPLATES = [
  { title: 'Rock Slide', description: 'Loose rocks cascaded down the shaft.', hullDamage: 8, staminaHit: 15 },
  { title: 'Gas Pocket', description: 'Toxic fumes venting from a fissure.', hullDamage: 5, staminaHit: 25 },
  { title: 'Equipment Jam', description: 'The drill seized up. Crew had to fix it manually.', hullDamage: 3, staminaHit: 10 },
  { title: 'Pressure Burst', description: 'A high-pressure cavity ruptured nearby.', hullDamage: 12, staminaHit: 20 },
  { title: 'Electrical Short', description: 'Water seeped into the wiring.', hullDamage: 6, staminaHit: 8 },
  { title: 'Minor Quake', description: 'Ground shook for a few seconds. Some cracks appeared.', hullDamage: 10, staminaHit: 12 },
  { title: 'Heat Spike', description: 'Temperature surged. Crew had to pull back briefly.', hullDamage: 4, staminaHit: 18 },
]

// ─── Exploration Path Generation ──────────────────────────────────────────────

const PATH_NAMES = [
  { name: 'Granite Corridor', desc: 'Dense rock, slow going but plenty of ore.' },
  { name: 'Crystal Tributary', desc: 'Veins of crystals line the walls.' },
  { name: 'Unstable Fissure', desc: 'Fast drilling but constant danger.' },
  { name: 'Ancient Tunnel', desc: 'Someone carved this long ago. What did they find?' },
  { name: 'Flooded Passage', desc: 'Water everywhere. Slippery but mineral-rich.' },
  { name: 'Volcanic Channel', desc: 'Heat rising from below. Rare minerals nearby.' },
  { name: 'Fungal Network', desc: 'Organic growth coats everything. Strange readings.' },
  { name: 'Compressed Seam', desc: 'Tight quarters. The rock is incredibly dense.' },
]

function generatePathOptions(gateDepth: number, scoutPoints: number): TunnelPath[] {
  const count = 2 + (Math.random() > 0.6 ? 1 : 0) // 2-3 options
  const span = 250 + Math.floor(gateDepth * 0.1)    // path length grows with depth
  const paths: TunnelPath[] = []
  const usedNames = new Set<number>()

  for (let i = 0; i < count; i++) {
    let nameIdx: number
    do { nameIdx = Math.floor(Math.random() * PATH_NAMES.length) } while (usedNames.has(nameIdx))
    usedNames.add(nameIdx)
    const template = PATH_NAMES[nameIdx]

    // Randomize modifiers with tighter trade-offs
    const drillMult = 0.8 + Math.random() * 0.4     // 0.8x - 1.2x
    const oreMult = 0.7 + Math.random() * 0.8       // 0.7x - 1.5x
    const crystalMult = 0.7 + Math.random() * 0.8
    const hazardMult = 0.5 + Math.random() * 1.3    // 0.5x - 1.8x

    // If drill is fast, hazard should be higher (trade-off)
    const balancedHazard = hazardMult * (drillMult > 1 ? 1.3 : 0.7)

    const scouted = scoutPoints >= (30 + gateDepth * 0.02) // more scouting needed deeper

    paths.push({
      id: `path-${gateDepth}-${i}-${Date.now()}`,
      name: template.name,
      description: scouted ? template.desc : '??? (need more scouting)',
      depthStart: gateDepth,
      depthEnd: gateDepth + span,
      modifiers: {
        drillSpeedMult: Math.round(drillMult * 100) / 100,
        oreBonus: Math.round(oreMult * 100) / 100,
        crystalBonus: Math.round(crystalMult * 100) / 100,
        hazardRate: Math.round(balancedHazard * 100) / 100,
      },
      scouted,
    })
  }
  return paths
}

function getNextPathGateDepth(currentDepth: number): number {
  const base = 300
  const scaling = Math.min(currentDepth * 0.08, 200)
  return Math.floor(currentDepth + base + scaling)
}

// ─── Milestones ───────────────────────────────────────────────────────────────

function generateMilestoneDepths(): number[] {
  const depths: number[] = []
  const earlyDepths = [10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 650, 800, 1000]
  depths.push(...earlyDepths)
  let prev = 1000
  let gap = 250
  while (prev < 100_000) {
    const next = Math.round((prev + gap) / 50) * 50
    depths.push(next)
    prev = next
    gap = Math.floor(gap * 1.25)
  }
  return depths
}

const MILESTONE_DEPTHS = generateMilestoneDepths()

function milestoneReward(depth: number, prestigeCount: number): { ore: number; crystals: number; data: number } {
  const t = depth / 100
  const pMult = 1 + prestigeCount * 0.5 // 1x at P0, 3.5x at P5, 6x at P10
  return {
    ore: Math.floor((10 * t + 5 * Math.pow(t, 1.3)) * pMult),
    crystals: depth >= 75 ? Math.floor((3 * t + 2 * Math.pow(t, 1.2)) * pMult) : 0,
    data: depth >= 200 ? Math.floor((t + Math.pow(t, 1.15)) * pMult) : 0,
  }
}

// ─── Artifacts ────────────────────────────────────────────────────────────────

const ARTIFACT_DEFS: Omit<Artifact, 'found'>[] = [
  // Common
  { id: 'art-drill-bit', name: 'Fossilized Drill Bit', description: '+5% drill speed', icon: '\u26CF', rarity: 'common', bonus: { type: 'drillSpeed', value: 0.05 } },
  { id: 'art-ore-chunk', name: 'Dense Ore Chunk', description: '+10% ore generation', icon: '\uD83E\uDEA8', rarity: 'common', bonus: { type: 'oreRate', value: 0.10 } },
  { id: 'art-crystal-shard', name: 'Prismatic Shard', description: '+10% crystal generation', icon: '\u2728', rarity: 'common', bonus: { type: 'crystalRate', value: 0.10 } },
  { id: 'art-data-chip', name: 'Ancient Data Chip', description: '+10% data generation', icon: '\uD83D\uDCBE', rarity: 'common', bonus: { type: 'dataRate', value: 0.10 } },
  { id: 'art-hull-plate', name: 'Hardened Hull Plate', description: '-10% hazard damage', icon: '\uD83D\uDEE1', rarity: 'common', bonus: { type: 'hazardResist', value: 0.10 } },
  { id: 'art-ration-pack', name: 'Nutrient Pack', description: '+20% stamina recovery', icon: '\uD83C\uDF5E', rarity: 'common', bonus: { type: 'staminaRegen', value: 0.20 } },
  { id: 'art-lantern', name: 'Glow Lantern', description: '+15% scout efficiency', icon: '\uD83D\uDD26', rarity: 'common', bonus: { type: 'scoutRate', value: 0.15 } },
  { id: 'art-toolkit', name: 'Repair Toolkit', description: '-20% repair cost', icon: '\uD83D\uDD27', rarity: 'common', bonus: { type: 'repairDiscount', value: 0.20 } },
  // Rare
  { id: 'art-resonance', name: 'Resonance Crystal', description: '+25% crystal generation', icon: '\uD83D\uDC8E', rarity: 'rare', bonus: { type: 'crystalRate', value: 0.25 } },
  { id: 'art-core-sample', name: 'Core Sample', description: '+20% drill speed', icon: '\uD83C\uDF0B', rarity: 'rare', bonus: { type: 'drillSpeed', value: 0.20 } },
  { id: 'art-signal-amp', name: 'Signal Amplifier', description: '+25% data generation', icon: '\uD83D\uDCE1', rarity: 'rare', bonus: { type: 'dataRate', value: 0.25 } },
  { id: 'art-exo-armor', name: 'Exo-Armor Fragment', description: '-25% hazard damage', icon: '\uD83E\uDD16', rarity: 'rare', bonus: { type: 'hazardResist', value: 0.25 } },
  { id: 'art-stim-injector', name: 'Stim Injector', description: '-30% stamina drain', icon: '\uD83D\uDC89', rarity: 'rare', bonus: { type: 'staminaDrain', value: 0.30 } },
  { id: 'art-compass', name: 'Deep Compass', description: '+40% scout efficiency', icon: '\uD83E\uDDED', rarity: 'rare', bonus: { type: 'scoutRate', value: 0.40 } },
  { id: 'art-ore-magnet', name: 'Ore Magnet', description: '+30% ore generation', icon: '\uD83E\uDDF2', rarity: 'rare', bonus: { type: 'oreRate', value: 0.30 } },
  { id: 'art-prestige-gem', name: 'Prestige Gem', description: '+50 starting ore on prestige', icon: '\uD83D\uDC8D', rarity: 'rare', bonus: { type: 'startingOre', value: 50 } },
  // Legendary
  { id: 'art-void-compass', name: 'Void Compass', description: 'All paths fully scouted', icon: '\uD83C\uDF0C', rarity: 'legendary', bonus: { type: 'autoScout', value: 1 } },
  { id: 'art-infinity-drill', name: 'Infinity Drill', description: '+50% drill speed', icon: '\u267E', rarity: 'legendary', bonus: { type: 'drillSpeed', value: 0.50 } },
  { id: 'art-philosophers-stone', name: "Philosopher's Stone", description: '+25% all resource rates', icon: '\uD83D\uDD2E', rarity: 'legendary', bonus: { type: 'allRates', value: 0.25 } },
  { id: 'art-eternal-engine', name: 'Eternal Engine', description: 'Hull degrades 50% slower', icon: '\u2699', rarity: 'legendary', bonus: { type: 'hazardResist', value: 0.50 } },
]

function initArtifacts(): Artifact[] {
  return ARTIFACT_DEFS.map(a => ({ ...a, found: false }))
}

// ─── Helpers (station-based calculations) ─────────────────────────────────────

function crewEfficiency(member: CrewMember): number {
  let eff = 1.0
  if (member.stamina < STAMINA_LOW_THRESHOLD) {
    eff *= 0.5 // tired crew work at half speed
  }
  return eff
}

function calcDrillSpeed(state: GameState): number {
  const drillCrew = state.crew.filter(c => c.station === 'drill')
  let crewBonus = 1
  for (const c of drillCrew) {
    const roleBonus = roleMatchesStation(c.role, 'drill') ? ROLE_MATCH_BONUS : 1
    crewBonus += c.level * 0.1 * roleBonus * crewEfficiency(c)
  }
  const upgradeMultiplier = state.upgrades
    .filter(u => u.purchased && u.target === 'drillSpeed')
    .reduce((acc, u) => acc * u.multiplier, 1)

  // Artifact bonuses
  const artifactBonus = 1 + getArtifactBonus(state.artifacts, 'drillSpeed')
    + getArtifactBonus(state.artifacts, 'allRates')

  // Hull penalty
  const hullMult = state.hullIntegrity < HULL_EMERGENCY_THRESHOLD ? 0.5 : 1

  // Path modifier
  const pathMult = getActivePathModifier(state, 'drillSpeedMult')

  return BASE_DRILL_SPEED * crewBonus * upgradeMultiplier * state.prestigeBonus.drillMultiplier * artifactBonus * hullMult * pathMult
}

function calcRefineRate(state: GameState): number {
  const refCrew = state.crew.filter(c => c.station === 'refinery')
  let crewBonus = 0.2 // base even with no crew
  for (const c of refCrew) {
    const roleBonus = roleMatchesStation(c.role, 'refinery') ? ROLE_MATCH_BONUS : 1
    crewBonus += c.level * 0.05 * roleBonus * crewEfficiency(c)
  }
  const upgradeMultiplier = state.upgrades
    .filter(u => u.purchased && u.target === 'refineRate')
    .reduce((acc, u) => acc * u.multiplier, 1)
  const artifactBonus = 1 + getArtifactBonus(state.artifacts, 'crystalRate')
    + getArtifactBonus(state.artifacts, 'allRates')
  const pathMult = getActivePathModifier(state, 'crystalBonus')
  return crewBonus * upgradeMultiplier * artifactBonus * pathMult
}

function calcResearchRate(state: GameState): number {
  const labCrew = state.crew.filter(c => c.station === 'lab')
  let crewBonus = 0.1 // base
  for (const c of labCrew) {
    const roleBonus = roleMatchesStation(c.role, 'lab') ? ROLE_MATCH_BONUS : 1
    crewBonus += c.level * 0.05 * roleBonus * crewEfficiency(c)
  }
  const upgradeMultiplier = state.upgrades
    .filter(u => u.purchased && u.target === 'researchRate')
    .reduce((acc, u) => acc * u.multiplier, 1)
  const artifactBonus = 1 + getArtifactBonus(state.artifacts, 'dataRate')
    + getArtifactBonus(state.artifacts, 'allRates')
  return crewBonus * upgradeMultiplier * artifactBonus
}

function getArtifactBonus(artifacts: Artifact[], type: string): number {
  const raw = artifacts
    .filter(a => a.found && a.bonus.type === type)
    .reduce((sum, a) => sum + a.bonus.value, 0)
  return Math.min(raw, 1.0) // Cap at +100% per bonus type
}

function getActivePathModifier(state: GameState, key: keyof TunnelPath['modifiers']): number {
  if (!state.currentPathId) return 1
  // Path data stored in pathOptions when chosen
  // We search through current state
  const path = state.pathOptions.find(p => p.id === state.currentPathId)
  if (!path) return 1
  if (state.depth < path.depthStart || state.depth > path.depthEnd) return 1
  return path.modifiers[key]
}

function checkForStoryAnomaly(depth: number, resolved: string[]): Anomaly | null {
  const STORY = makeStoryAnomalies()
  const candidate = STORY.find(a => depth >= a.depth && !resolved.includes(a.id))
  return candidate ? { ...candidate, resolved: false } : null
}

function crewXpForTick(member: CrewMember): number {
  return member.station !== 'idle' ? member.level * 2 : member.level * 0.5
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useGameStore = defineStore('game', {
  state: (): GameState => ({
    depth: 0,
    maxDepth: 0,
    prestigeCount: 0,

    resources: { ore: 0, crystals: 0, data: 0 },
    resourceRates: { ore: 0, crystals: 0, data: 0 },

    hullIntegrity: 100,
    gameOver: false,

    crew: STARTING_CREW.map(c => ({ ...c })),
    upgrades: getUpgradesForPrestige(0),

    activeAnomaly: null,
    lastAnomalyOutcome: null,
    resolvedAnomalies: [],
    nextAnomalyDepth: 100,

    lastHazard: null,
    hazardCooldownUntil: 0,

    comboCount: 0,
    comboLastTapAt: 0,
    totalTaps: 0,

    claimedMilestones: [],
    lastMilestoneDepth: null,

    scoutPoints: 0,
    currentPathId: null,
    exploredPaths: [],
    nextPathGateDepth: 300,
    pathChoicePending: false,
    pathOptions: [],

    artifacts: initArtifacts(),

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
    canPrestige: (state) => {
      // Depth requirement scales with prestige count
      let required = PRESTIGE_DEPTH_THRESHOLD // 1000m for first
      if (state.prestigeCount >= 10) required = 5000
      else if (state.prestigeCount >= 5) required = 3000
      else if (state.prestigeCount >= 3) required = 2000
      return state.depth >= required
    },
    prestigeDepthRequired: (state): number => {
      if (state.prestigeCount >= 10) return 5000
      if (state.prestigeCount >= 5) return 3000
      if (state.prestigeCount >= 3) return 2000
      return PRESTIGE_DEPTH_THRESHOLD
    },
    offlineCapHours: (state) => state.offlineEarningCapMs / (60 * 60 * 1000),
    hasOfflineBoost: (state) => state.offlineBoostUntil > Date.now(),
    comboMultiplier: (state) => {
      if (state.comboCount <= 1) return 1
      return Math.min(1 + state.comboCount * 0.1, COMBO_MAX_MULTIPLIER)
    },
    comboActive: (state) => {
      if (state.activeAnomaly || state.pathChoicePending) return state.comboCount > 1
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
    stationCounts: (state) => {
      const counts = { drill: 0, refinery: 0, lab: 0, scout: 0, idle: 0 }
      for (const c of state.crew) counts[c.station]++
      return counts
    },
    activePath: (state): TunnelPath | null => {
      if (!state.currentPathId) return null
      return state.pathOptions.find(p => p.id === state.currentPathId) ?? null
    },
    artifactCount: (state) => state.artifacts.filter(a => a.found).length,
  },

  actions: {
    // ── Tick ──────────────────────────────────────────────────────────────────

    tick(deltaMs: number) {
      const deltaS = deltaMs / 1000

      // Game over — hull destroyed
      if (this.gameOver || this.hullIntegrity <= 0) {
        if (!this.gameOver && this.hullIntegrity <= 0) {
          this.gameOver = true
        }
        this.lastTickAt = Date.now()
        this.totalPlaytimeMs += deltaMs
        return
      }

      // Don't drill if path choice pending
      if (this.pathChoicePending) {
        this.lastTickAt = Date.now()
        this.totalPlaytimeMs += deltaMs
        return
      }

      // Drill deeper
      const drillSpeed = calcDrillSpeed(this.$state)
      this.depth += drillSpeed * deltaS
      if (this.depth > this.maxDepth) this.maxDepth = this.depth

      // Generate resources
      const oreRate = drillSpeed * 2 * (1 + getArtifactBonus(this.artifacts, 'oreRate'))
      const pathOreMult = getActivePathModifier(this.$state, 'oreBonus')

      this.resources.ore += oreRate * pathOreMult * deltaS
      this.resources.crystals += calcRefineRate(this.$state) * deltaS
      this.resources.data += calcResearchRate(this.$state) * deltaS

      this.resourceRates = {
        ore: oreRate * pathOreMult,
        crystals: calcRefineRate(this.$state),
        data: calcResearchRate(this.$state),
      }

      // Crew stamina + XP
      const staminaDrainMult = 1 - getArtifactBonus(this.artifacts, 'staminaDrain')
      const staminaRegenMult = 1 + getArtifactBonus(this.artifacts, 'staminaRegen')

      this.crew = this.crew.map(member => {
        let { xp, xpToNext, level, stamina, station } = member

        // XP (idle crew gain less)
        const xpGain = crewXpForTick(member) * deltaS
        xp += xpGain
        while (xp >= xpToNext) {
          xp -= xpToNext
          level += 1
          xpToNext = Math.floor(xpToNext * 1.5)
        }

        // Stamina
        if (station === 'idle') {
          stamina = Math.min(100, stamina + STAMINA_RECOVER_PER_SEC * staminaRegenMult * deltaS)
        } else {
          stamina = Math.max(0, stamina - STAMINA_DRAIN_PER_SEC * staminaDrainMult * deltaS)
        }

        // Auto-idle if exhausted
        if (stamina <= 0 && station !== 'idle') {
          station = 'idle'
        }

        return { ...member, xp, xpToNext, level, stamina, station }
      })

      // Scout points
      const scoutCrew = this.crew.filter(c => c.station === 'scout')
      const scoutMult = 1 + getArtifactBonus(this.artifacts, 'scoutRate')
      for (const c of scoutCrew) {
        const roleBonus = c.role === 'researcher' ? ROLE_MATCH_BONUS : 1
        this.scoutPoints += SCOUT_POINTS_PER_SEC * c.level * roleBonus * crewEfficiency(c) * scoutMult * deltaS
      }

      // Check path gates
      if (!this.pathChoicePending && this.depth >= this.nextPathGateDepth) {
        // Check if current path has ended
        const active = this.pathOptions.find(p => p.id === this.currentPathId)
        if (!active || this.depth >= active.depthEnd || !this.currentPathId) {
          const hasAutoScout = this.artifacts.some(a => a.found && a.bonus.type === 'autoScout')
          this.pathOptions = generatePathOptions(this.depth, hasAutoScout ? 99999 : this.scoutPoints)
          this.pathChoicePending = true
          this.scoutPoints = Math.max(0, this.scoutPoints * 0.3) // spend most scout points
        }
      }

      // Check anomalies
      if (!this.activeAnomaly && !this.pathChoicePending) {
        const storyAnomaly = checkForStoryAnomaly(this.depth, this.resolvedAnomalies)
        if (storyAnomaly) {
          this.activeAnomaly = storyAnomaly
        } else if (this.depth >= this.nextAnomalyDepth) {
          this.activeAnomaly = generateProceduralAnomaly(this.depth)
          this.nextAnomalyDepth = getNextAnomalyDepth(this.depth, calcDrillSpeed(this.$state))
        }
      }

      // Check milestones
      this.lastMilestoneDepth = null
      for (const msDepth of MILESTONE_DEPTHS) {
        if (msDepth > this.depth) break
        if (!this.claimedMilestones.includes(msDepth)) {
          this.claimedMilestones.push(msDepth)
          const reward = milestoneReward(msDepth, this.prestigeCount)
          this.resources.ore += reward.ore
          this.resources.crystals += reward.crystals
          this.resources.data += reward.data
          this.lastMilestoneDepth = msDepth
        }
      }

      // Hazard check (only during real-time play, not offline catch-up)
      if (deltaMs <= 2000 && Date.now() > this.hazardCooldownUntil) {
        const pathHazardMult = getActivePathModifier(this.$state, 'hazardRate')
        const hazardChance = HAZARD_BASE_CHANCE * pathHazardMult * (deltaMs / HAZARD_CHECK_INTERVAL_MS)
        if (Math.random() < hazardChance) {
          this.triggerHazard()
        }
      }

      // Combo decay
      if (this.comboCount > 0 && !this.activeAnomaly && !this.pathChoicePending && (Date.now() - this.comboLastTapAt) > COMBO_WINDOW_MS) {
        this.comboCount = 0
      }

      this.lastTickAt = Date.now()
      this.totalPlaytimeMs += deltaMs
    },

    // ── Hazards ──────────────────────────────────────────────────────────────

    triggerHazard() {
      const template = HAZARD_TEMPLATES[Math.floor(Math.random() * HAZARD_TEMPLATES.length)]
      const hazardResist = getArtifactBonus(this.artifacts, 'hazardResist')
      const actualDamage = Math.floor(template.hullDamage * (1 - hazardResist))

      this.hullIntegrity = Math.max(0, this.hullIntegrity - actualDamage)

      // Hit a random working crew member's stamina
      const workingCrew = this.crew.filter(c => c.station !== 'idle')
      if (workingCrew.length > 0 && template.staminaHit > 0) {
        const target = workingCrew[Math.floor(Math.random() * workingCrew.length)]
        this.crew = this.crew.map(c =>
          c.id === target.id ? { ...c, stamina: Math.max(0, c.stamina - template.staminaHit) } : c
        )
      }

      this.lastHazard = {
        id: `hazard-${Date.now()}`,
        title: template.title,
        description: template.description,
        hullDamage: actualDamage,
        staminaHit: template.staminaHit,
      }

      this.hazardCooldownUntil = Date.now() + 15_000 // 15s cooldown between hazards
    },

    clearHazard() {
      this.lastHazard = null
    },

    repairHull(amount: number = 100) {
      const missing = 100 - this.hullIntegrity
      const toRepair = Math.min(amount, missing)
      const discount = getArtifactBonus(this.artifacts, 'repairDiscount')
      const costPerPoint = Math.max(2, this.depth * 0.01) // Scales with depth
      const cost = Math.floor(toRepair * costPerPoint * (1 - discount))
      if (this.resources.ore < cost) return false
      this.resources.ore -= cost
      this.hullIntegrity = Math.min(100, this.hullIntegrity + toRepair)
      return true
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

    // ── Tap ──────────────────────────────────────────────────────────────────

    tap(): number {
      if (this.hullIntegrity <= 0 || this.pathChoicePending) return 0

      const now = Date.now()
      this.totalTaps += 1

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

    // ── Crew management ──────────────────────────────────────────────────────

    assignCrew(crewId: string, station: Station) {
      this.crew = this.crew.map(c =>
        c.id === crewId ? { ...c, station } : c
      )
    },

    assignAllByRole() {
      this.crew = this.crew.map(c => ({ ...c, station: defaultStationForRole(c.role) }))
    },

    // ── Purchases ────────────────────────────────────────────────────────────

    purchaseUpgrade(upgradeId: string): boolean {
      const upgrade = this.upgrades.find(u => u.id === upgradeId)
      if (!upgrade || upgrade.purchased) return false
      if (this.resources[upgrade.costResource] < upgrade.cost) return false

      this.resources[upgrade.costResource] -= upgrade.cost
      this.upgrades = this.upgrades.map(u =>
        u.id === upgradeId ? { ...u, purchased: true } : u
      )

      if (upgrade.target === 'offlineCap') {
        this.offlineEarningCapMs = Math.floor(this.offlineEarningCapMs * upgrade.multiplier)
      }

      return true
    },

    hireCrew(role: CrewRole, cost: number): boolean {
      if (this.resources.ore < cost) return false
      this.resources.ore -= cost

      const names = ['Syd', 'Rook', 'Cael', 'Vex', 'Nori', 'Trace', 'Kira', 'Jett', 'Ash', 'Zephyr']
      const name = names[Math.floor(Math.random() * names.length)]
      const id = `crew-${Date.now()}`

      this.crew.push({
        id, name, role,
        station: defaultStationForRole(role),
        level: 1, xp: 0, xpToNext: 100, stamina: 100,
      })
      return true
    },

    // ── Anomaly resolution (choice-based) ────────────────────────────────────

    resolveAnomalyChoice(choiceIndex: number) {
      if (!this.activeAnomaly) return

      const choice = this.activeAnomaly.choices[choiceIndex]
      if (!choice) return

      const roll = Math.random()
      const success = roll >= choice.risk

      if (success) {
        if (choice.reward.ore) this.resources.ore += choice.reward.ore
        if (choice.reward.crystals) this.resources.crystals += choice.reward.crystals
        if (choice.reward.data) this.resources.data += choice.reward.data
        this.lastAnomalyOutcome = { success: true, choiceLabel: choice.label, reward: choice.reward }
      } else {
        if (choice.penalty.ore) this.resources.ore = Math.max(0, this.resources.ore - choice.penalty.ore)
        if (choice.penalty.crystals) this.resources.crystals = Math.max(0, this.resources.crystals - choice.penalty.crystals)
        if (choice.penalty.data) this.resources.data = Math.max(0, this.resources.data - choice.penalty.data)
        if (choice.penalty.hullDamage) {
          const resist = getArtifactBonus(this.artifacts, 'hazardResist')
          this.hullIntegrity = Math.max(0, this.hullIntegrity - Math.floor(choice.penalty.hullDamage * (1 - resist)))
        }
        this.lastAnomalyOutcome = { success: false, choiceLabel: choice.label, penalty: choice.penalty }
      }

      // Track story anomalies
      if (this.activeAnomaly.id.startsWith('story-')) {
        this.resolvedAnomalies.push(this.activeAnomaly.id)
      }
      this.activeAnomaly = null

      if (this.comboCount > 0) {
        this.comboLastTapAt = Date.now()
      }
    },

    // Legacy resolve (fallback)
    resolveAnomaly() {
      if (!this.activeAnomaly) return
      // Use first choice if available, otherwise legacy behavior
      if (this.activeAnomaly.choices.length > 0) {
        this.resolveAnomalyChoice(0)
        return
      }
      const { reward, id } = this.activeAnomaly
      if (reward.ore) this.resources.ore += reward.ore
      if (reward.crystals) this.resources.crystals += reward.crystals
      if (reward.data) this.resources.data += reward.data
      if (id.startsWith('story-')) this.resolvedAnomalies.push(id)
      this.activeAnomaly = null
      if (this.comboCount > 0) this.comboLastTapAt = Date.now()
    },

    clearAnomalyOutcome() {
      this.lastAnomalyOutcome = null
    },

    // ── Path choice ──────────────────────────────────────────────────────────

    choosePath(pathId: string) {
      this.currentPathId = pathId
      this.pathChoicePending = false
      this.exploredPaths.push(pathId)
      this.nextPathGateDepth = getNextPathGateDepth(this.depth)

      // Check if path has an artifact
      const path = this.pathOptions.find(p => p.id === pathId)
      if (path?.artifactId) {
        this.discoverArtifact(path.artifactId)
      }
    },

    // ── Artifacts ─────────────────────────────────────────────────────────────

    discoverArtifact(artifactId: string) {
      this.artifacts = this.artifacts.map(a =>
        a.id === artifactId ? { ...a, found: true } : a
      )
    },

    // ── Game Over (hull destroyed) ──────────────────────────────────────────

    gameOverRestart() {
      // Restart the run — no prestige bonuses gained, but keep permanent stuff
      const survivingCrew = this.crew.map(c => ({
        ...c,
        station: defaultStationForRole(c.role) as Station,
        stamina: 100,
      }))

      const startingOre = this.prestigeBonus.startingOre + getArtifactBonus(this.artifacts, 'startingOre')

      this.depth = 0
      this.gameOver = false
      this.hullIntegrity = 100
      this.resources = { ore: Math.floor(startingOre * 0.5), crystals: 0, data: 0 } // only half starting ore as penalty
      this.upgrades = getUpgradesForPrestige(this.prestigeCount)
      this.activeAnomaly = null
      this.lastAnomalyOutcome = null
      this.nextAnomalyDepth = 100
      this.lastHazard = null
      this.hazardCooldownUntil = 0
      this.claimedMilestones = []
      this.lastMilestoneDepth = null
      this.comboCount = 0
      this.scoutPoints = 0
      this.currentPathId = null
      this.pathChoicePending = false
      this.pathOptions = []
      this.nextPathGateDepth = 300
      this.crew = survivingCrew
      this.offlineEarningCapMs = this.prestigeBonus.offlineCapHours * 60 * 60 * 1000
    },

    // ── Prestige ─────────────────────────────────────────────────────────────

    prestige() {
      if (!this.canPrestige) return

      this.prestigeCount += 1
      // Flat +0.15 drill multiplier per prestige (not depth-scaled)
      this.prestigeBonus.drillMultiplier += 0.15
      this.prestigeBonus.offlineCapHours = Math.min(24, this.prestigeBonus.offlineCapHours + 1)
      // Starting ore scales with depth reached (rewards deeper runs)
      const depthBonus = Math.floor(this.depth / 500)
      this.prestigeBonus.startingOre += depthBonus * 10

      const startingOre = this.prestigeBonus.startingOre + getArtifactBonus(this.artifacts, 'startingOre')
      const survivingCrew = this.crew.map(c => ({
        ...c,
        station: defaultStationForRole(c.role),
        stamina: 100,
      }))

      // Reset run state
      this.depth = 0
      this.gameOver = false
      this.hullIntegrity = 100
      this.resources = { ore: startingOre, crystals: 0, data: 0 }
      this.upgrades = getUpgradesForPrestige(this.prestigeCount)
      this.activeAnomaly = null
      this.lastAnomalyOutcome = null
      this.nextAnomalyDepth = 100
      this.lastHazard = null
      this.hazardCooldownUntil = 0
      this.claimedMilestones = []
      this.lastMilestoneDepth = null
      this.comboCount = 0
      this.scoutPoints = 0
      this.currentPathId = null
      this.pathChoicePending = false
      this.pathOptions = []
      this.nextPathGateDepth = 300
      this.crew = survivingCrew
      this.offlineEarningCapMs = this.prestigeBonus.offlineCapHours * 60 * 60 * 1000
      // Artifacts preserved — they're permanent
    },

    // ── Persistence ──────────────────────────────────────────────────────────

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
