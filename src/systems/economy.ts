// ── HQ Rate Bulletin System ──
// HQ sets resource purchase rates. Events shift rates periodically.
// The operator cannot control rates — only react by timing exports.

export interface RateEvent {
  type: string
  multipliers: { metals: number; ice: number; rareMinerals: number }
  message: string
  expiresAt: number // totalPlaytimeMs
}

// Base rates (credits per unit)
const BASE_RATES = {
  metals: 15,
  ice: 40,
  rareMinerals: 100,
}

// Rate event definitions
const RATE_EVENTS = [
  {
    type: 'metalDemand',
    weight: 25,
    multipliers: { metals: 2, ice: 1, rareMinerals: 1 },
    message: 'HQ: Metal reserves low. Premium rates authorized.',
  },
  {
    type: 'iceShortage',
    weight: 25,
    multipliers: { metals: 1, ice: 2, rareMinerals: 1 },
    message: 'HQ: Coolant shortage reported. Ice at premium.',
  },
  {
    type: 'rareMineralRush',
    weight: 15,
    multipliers: { metals: 1, ice: 1, rareMinerals: 2.5 },
    message: 'HQ: Research division requesting rare minerals. Top rates.',
  },
  {
    type: 'supplyGlut',
    weight: 15,
    multipliers: { metals: 1, ice: 1, rareMinerals: 1 }, // one resource set to 0.5 at runtime
    message: 'HQ: {resource} surplus on station. Rates adjusted down.',
  },
  {
    type: 'quarterlyPush',
    weight: 10,
    multipliers: { metals: 1.5, ice: 1.5, rareMinerals: 1.5 },
    message: 'HQ: Quarterly push. All export rates boosted.',
  },
  {
    type: 'normalization',
    weight: 10,
    multipliers: { metals: 1, ice: 1, rareMinerals: 1 },
    message: 'HQ: Market stabilized. Standard rates in effect.',
  },
]

const RATE_EVENT_MIN_INTERVAL_MS = 600_000 // 10 minutes
const RATE_EVENT_MAX_INTERVAL_MS = 900_000 // 15 minutes
const RATE_EVENT_DURATION_MIN_MS = 90_000 // 90 seconds
const RATE_EVENT_DURATION_MAX_MS = 120_000 // 120 seconds

// ── State ──

let activeEvent: RateEvent | null = null
let nextEventAt = 0

export function initEconomy(nowMs: number): void {
  activeEvent = null
  nextEventAt = nowMs + randomBetween(RATE_EVENT_MIN_INTERVAL_MS, RATE_EVENT_MAX_INTERVAL_MS)
}

export function getActiveEvent(): RateEvent | null {
  return activeEvent
}

export function getCurrentRates(nowMs: number): {
  metals: number
  ice: number
  rareMinerals: number
} {
  if (activeEvent && nowMs < activeEvent.expiresAt) {
    return {
      metals: BASE_RATES.metals * activeEvent.multipliers.metals,
      ice: BASE_RATES.ice * activeEvent.multipliers.ice,
      rareMinerals: BASE_RATES.rareMinerals * activeEvent.multipliers.rareMinerals,
    }
  }
  // Event expired
  if (activeEvent && nowMs >= activeEvent.expiresAt) {
    activeEvent = null
  }
  return { ...BASE_RATES }
}

export function getBaseRates(): { metals: number; ice: number; rareMinerals: number } {
  return { ...BASE_RATES }
}

export function tickEconomy(
  nowMs: number,
  emit: (text: string, severity: 'info' | 'event') => void,
): void {
  // Check if active event expired
  if (activeEvent && nowMs >= activeEvent.expiresAt) {
    activeEvent = null
  }

  // Check if it's time for a new event
  if (nowMs >= nextEventAt && !activeEvent) {
    const event = pickWeightedEvent()
    const duration = randomBetween(RATE_EVENT_DURATION_MIN_MS, RATE_EVENT_DURATION_MAX_MS)

    activeEvent = {
      type: event.type,
      multipliers: { ...event.multipliers },
      message: event.message,
      expiresAt: nowMs + duration,
    }

    // Special handling for supply glut — pick a random resource to halve
    if (event.type === 'supplyGlut') {
      const resources = ['metals', 'ice', 'rareMinerals'] as const
      const target = resources[Math.floor(Math.random() * resources.length)]
      activeEvent.multipliers[target] = 0.5
      const labels: Record<string, string> = {
        metals: 'Metals',
        ice: 'Ice',
        rareMinerals: 'Rare minerals',
      }
      activeEvent.message = event.message.replace('{resource}', labels[target])
    }

    emit(activeEvent.message, 'event')
    nextEventAt =
      nowMs + duration + randomBetween(RATE_EVENT_MIN_INTERVAL_MS, RATE_EVENT_MAX_INTERVAL_MS)
  }
}

export function calculatePayoutEstimate(
  cargo: { metals: number; ice: number; rareMinerals: number },
  nowMs: number,
): number {
  const rates = getCurrentRates(nowMs)
  return Math.round(
    cargo.metals * rates.metals + cargo.ice * rates.ice + cargo.rareMinerals * rates.rareMinerals,
  )
}

// Save/restore for persistence
export function getEconomyState(): { activeEvent: RateEvent | null; nextEventAt: number } {
  return { activeEvent, nextEventAt }
}

export function restoreEconomyState(state: {
  activeEvent: RateEvent | null
  nextEventAt: number
}): void {
  activeEvent = state.activeEvent
  nextEventAt = state.nextEventAt
}

// ── Helpers ──

function randomBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function pickWeightedEvent(): (typeof RATE_EVENTS)[number] {
  const totalWeight = RATE_EVENTS.reduce((sum, e) => sum + e.weight, 0)
  let roll = Math.random() * totalWeight
  for (const event of RATE_EVENTS) {
    roll -= event.weight
    if (roll <= 0) return event
  }
  return RATE_EVENTS[0]
}
