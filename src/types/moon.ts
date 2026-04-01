// ── Terrain & Biomes ──

export type TerrainType = 'rocky' | 'ice' | 'volcanic' | 'crater' | 'canyon'

export interface TerrainConfig {
  type: TerrainType
  label: string
  color: string        // false-color tint for medium lens
  bgColor: string      // sector background
  depositTypes: DepositType[]
  surveyRiskBase: number  // 0-1, base chance of incident per survey
  description: string
}

export type DepositType = 'metals' | 'ice' | 'rareMinerals'

export type DepositQuality = 'poor' | 'moderate' | 'rich'

// ── Sectors ──

export type SectorStatus = 'hidden' | 'scanned' | 'surveyed'

export interface Sector {
  id: string
  q: number            // axial hex coordinate
  r: number            // axial hex coordinate
  terrain: TerrainType
  status: SectorStatus
  deposit: Deposit | null           // null until surveyed
  scanSignature: ScanSignature | null  // set after orbital scan
  outpostId: string | null          // link to outpost if one exists
  _pendingDeposit?: { type: DepositType; quality: DepositQuality } // preserved during scan→survey gap
}

export interface ScanSignature {
  depositType: DepositType
  qualityHint: string   // "Faint traces" | "Moderate signatures" | "Strong readings"
}

export interface Deposit {
  type: DepositType
  quality: DepositQuality
  totalYield: number     // total extractable units
  remainingYield: number // depletes over time
}

// ── Survey Missions ──

export type SurveyStatus = 'traveling' | 'surveying' | 'returning' | 'complete' | 'failed'

export interface SurveyMission {
  id: string
  sectorId: string
  colonistIds: string[]     // 2-3 colonists sent
  status: SurveyStatus
  departedAt: number        // totalPlaytimeMs
  arrivalAt: number         // when team reaches sector
  surveyCompleteAt: number  // when survey finishes
  returnAt: number          // when team gets back to colony
  incident: SurveyIncident | null
}

export interface SurveyIncident {
  type: 'injury' | 'delay' | 'lost'
  colonistId: string       // affected colonist
  message: string
}

// ── Outposts ──

export type OutpostStatus = 'active' | 'damaged' | 'depleted' | 'abandoned'

export interface Outpost {
  id: string
  sectorId: string
  name: string
  deposit: Deposit
  extractionLevel: number  // 1, 2, 3... higher = richer but riskier
  crewIds: string[]        // colonists stationed here
  stockpile: OutpostStockpile
  status: OutpostStatus
  lastHazardAt: number
  establishedAt: number    // totalPlaytimeMs
}

export interface OutpostStockpile {
  metals: number
  ice: number
  rareMinerals: number
}

// ── Outpost Launches ──

export interface OutpostLaunch {
  id: string
  outpostId: string
  payload: OutpostStockpile
  launchedAt: number       // totalPlaytimeMs
  arrivalAt: number        // when payload reaches colony
}

// ── Moon State ──

export interface MoonState {
  sectors: Sector[]
  outposts: Outpost[]
  surveyMissions: SurveyMission[]
  outpostLaunches: OutpostLaunch[]
  pingCooldownUntil: number    // totalPlaytimeMs when next ping is available
  pingCharging: boolean
  pingChargeStartedAt: number
}
