import type { Action, ActionType, Trait } from '@/types/colonist'
import type { ColonyState, Building, Directive, SupplyDrop } from '@/stores/gameStore'
import { ZONE_FOR_BUILDING, ZONE_MAP, findPath } from '@/systems/mapLayout'

// ── Constants ──

const ENERGY_DRAIN_WORKING = 1.5
const ENERGY_DRAIN_WALKING = 0.5
const ENERGY_RECOVERY_RESTING = 3.0

const MORALE_DRAIN_PASSIVE = 0.2
const MORALE_DRAIN_HAZARD = 1.0
const MORALE_RECOVERY_SOCIAL = 2.0
const MORALE_RECOVERY_RESTING = 0.5

const ENERGY_TIRED = 30
const ENERGY_EXHAUSTED = 10
const MORALE_STRESSED = 25
const MORALE_BREAKING = 10
const HEALTH_SEEK_MEDICAL = 70
const HEALTH_SEEK_MEDICAL_URGENT = 40

const DURATION: Record<ActionType, [number, number]> = {
  drill:        [12, 25],
  engineer:     [12, 25],
  repair:       [15, 30],
  unpack:       [5, 10],
  rest:         [15, 35],
  socialize:    [10, 20],
  seek_medical: [20, 40],
  wander:       [8, 18],
}

interface TraitMod {
  energyDrainMult: number
  moraleDrainMult: number
  workUtilityMult: number
  socialUtilityMult: number
  repairUtilityMult: number
  medicalThresholdBonus: number
  durationMult: number
  walkSpeedMult: number
}

const TRAIT_MODS: Record<Trait, TraitMod> = {
  hardy:     { energyDrainMult: 0.75, moraleDrainMult: 1.0,  workUtilityMult: 1.0,  socialUtilityMult: 1.0,  repairUtilityMult: 1.0,  medicalThresholdBonus: 0,  durationMult: 1.0,  walkSpeedMult: 1.0 },
  diligent:  { energyDrainMult: 1.0,  moraleDrainMult: 1.0,  workUtilityMult: 1.2,  socialUtilityMult: 0.7,  repairUtilityMult: 1.0,  medicalThresholdBonus: 0,  durationMult: 1.0,  walkSpeedMult: 1.0 },
  social:    { energyDrainMult: 1.0,  moraleDrainMult: 1.3,  workUtilityMult: 1.0,  socialUtilityMult: 1.5,  repairUtilityMult: 1.0,  medicalThresholdBonus: 0,  durationMult: 1.0,  walkSpeedMult: 1.0 },
  cautious:  { energyDrainMult: 1.0,  moraleDrainMult: 1.0,  workUtilityMult: 1.0,  socialUtilityMult: 1.0,  repairUtilityMult: 1.5,  medicalThresholdBonus: 15, durationMult: 1.0,  walkSpeedMult: 1.0 },
  efficient: { energyDrainMult: 1.0,  moraleDrainMult: 1.0,  workUtilityMult: 1.0,  socialUtilityMult: 1.0,  repairUtilityMult: 1.0,  medicalThresholdBonus: 0,  durationMult: 0.85, walkSpeedMult: 1.1 },
  stoic:     { energyDrainMult: 1.0,  moraleDrainMult: 0.7,  workUtilityMult: 1.0,  socialUtilityMult: 0.6,  repairUtilityMult: 1.0,  medicalThresholdBonus: 0,  durationMult: 1.0,  walkSpeedMult: 1.0 },
}

const DIRECTIVE_UTILITY: Record<Directive, { drill: number; engineer: number; repair: number }> = {
  mining:    { drill: 1.5, engineer: 0.6, repair: 1.0 },
  safety:    { drill: 0.6, engineer: 1.5, repair: 1.5 },
  balanced:  { drill: 1.0, engineer: 1.0, repair: 1.0 },
  emergency: { drill: 0.5, engineer: 2.0, repair: 2.0 },
}

// ── Needs Update ──

export interface ColonistLike {
  id: string
  health: number
  energy: number
  morale: number
  trait: Trait
  currentAction: Action | null
  currentZone: string
}

export function updateNeeds(colonist: ColonistLike): void {
  if (colonist.health <= 0) return
  const mod = TRAIT_MODS[colonist.trait]
  const action = colonist.currentAction

  // Energy
  if (action) {
    if (action.walkPath && action.walkPath.length > 0) {
      colonist.energy = Math.max(0, colonist.energy - ENERGY_DRAIN_WALKING * mod.energyDrainMult)
    } else if (action.type === 'rest') {
      colonist.energy = Math.min(100, colonist.energy + ENERGY_RECOVERY_RESTING)
    } else if (action.type === 'socialize') {
      colonist.energy = Math.min(100, colonist.energy + ENERGY_RECOVERY_RESTING * 0.3)
    } else if (action.type === 'wander') {
      // No drain while wandering
    } else {
      colonist.energy = Math.max(0, colonist.energy - ENERGY_DRAIN_WORKING * mod.energyDrainMult)
    }
  }

  // Morale
  if (action?.type === 'socialize') {
    colonist.morale = Math.min(100, colonist.morale + MORALE_RECOVERY_SOCIAL)
  } else if (action?.type === 'rest') {
    colonist.morale = Math.min(100, colonist.morale + MORALE_RECOVERY_RESTING)
  } else {
    colonist.morale = Math.max(0, colonist.morale - MORALE_DRAIN_PASSIVE * mod.moraleDrainMult)
  }
}

// ── Forced Interrupts ──

export function checkInterrupt(colonist: ColonistLike): boolean {
  if (colonist.health <= 0) return false
  if (colonist.energy <= ENERGY_EXHAUSTED && colonist.currentAction?.type !== 'rest') {
    colonist.currentAction = null
    return true
  }
  if (colonist.morale <= MORALE_BREAKING && colonist.currentAction?.type !== 'rest' && colonist.currentAction?.type !== 'socialize') {
    colonist.currentAction = null
    return true
  }
  return false
}

// ── Action Advancement ──

const WALK_SPEED_PCT = 3 // % of map per second — must match useColonistMovement

/** Calculate how many ticks to walk between two zones */
function walkTicksBetween(fromId: string, toId: string): number {
  const from = ZONE_MAP[fromId]
  const to = ZONE_MAP[toId]
  if (!from || !to) return 3
  const dx = to.x - from.x
  const dy = to.y - from.y
  const d = Math.sqrt(dx * dx + dy * dy)
  // Each tick = 1 second. At WALK_SPEED_PCT per second, how many ticks to cover distance?
  return Math.max(2, Math.ceil(d / WALK_SPEED_PCT))
}

export function advanceAction(colonist: ColonistLike): boolean {
  const action = colonist.currentAction
  if (!action) return true

  // Walking between zones — count down ticks for current segment
  if (action.walkPath && action.walkPath.length > 1) {
    action.remainingTicks--
    if (action.remainingTicks <= 0) {
      // Arrived at next zone in path
      action.walkPath.shift()
      colonist.currentZone = action.walkPath[0]
      if (action.walkPath.length <= 1) {
        // Reached final zone — start the actual work action
        action.walkPath = undefined
        action.remainingTicks = getActionDuration(action.type, colonist.trait)
      } else {
        // More segments — set ticks for next hop
        action.remainingTicks = walkTicksBetween(action.walkPath[0], action.walkPath[1])
      }
    }
    return false
  }

  action.remainingTicks--
  if (action.remainingTicks <= 0) {
    colonist.currentAction = null
    return true
  }
  return false
}

function getActionDuration(type: ActionType, trait: Trait): number {
  const [min, max] = DURATION[type]
  const base = min + Math.floor(Math.random() * (max - min + 1))
  return Math.max(1, Math.round(base * TRAIT_MODS[trait].durationMult))
}

// ── Utility Scoring ──

interface ScoredAction {
  type: ActionType
  targetZone: string
  targetId?: string
  score: number
}

/** Count colonists already doing a specific action, optionally on a specific target */
function countWorkers(state: ColonyState, actionType: ActionType, targetId?: string): number {
  return state.colonists.filter(c => {
    if (c.health <= 0 || !c.currentAction) return false
    if (c.currentAction.type !== actionType) return false
    if (targetId && c.currentAction.targetId !== targetId) return false
    return true
  }).length
}

export function selectAction(
  colonist: ColonistLike,
  state: ColonyState,
): Action | null {
  if (colonist.health <= 0) return null

  const mod = TRAIT_MODS[colonist.trait]
  const dirMod = DIRECTIVE_UTILITY[state.activeDirective]
  const candidates: ScoredAction[] = []

  // DRILL
  if (colonist.energy > 20) {
    const rigs = state.buildings.filter(b => b.type === 'drillrig' && !b.damaged)
    if (rigs.length > 0) {
      const rig = rigs[Math.floor(Math.random() * rigs.length)]
      candidates.push({
        type: 'drill',
        targetZone: 'drill',
        targetId: rig.id,
        score: 50 * dirMod.drill * mod.workUtilityMult,
      })
    }
  }

  // ENGINEER
  if (colonist.energy > 20) {
    const powerPct = state.powerMax > 0 ? state.power / state.powerMax : 1
    const airPct = state.airMax > 0 ? state.air / state.airMax : 1
    const hasSolar = state.buildings.some(b => b.type === 'solar' && !b.damaged)
    const hasO2 = state.buildings.some(b => b.type === 'o2generator' && !b.damaged)

    if (hasSolar || hasO2) {
      let zone: string
      let targetBuilding: Building | undefined
      if (powerPct <= airPct && hasSolar) {
        zone = 'power'
        const solars = state.buildings.filter(b => b.type === 'solar' && !b.damaged)
        targetBuilding = solars[Math.floor(Math.random() * solars.length)]
      } else if (hasO2) {
        zone = 'lifeSup'
        const o2s = state.buildings.filter(b => b.type === 'o2generator' && !b.damaged)
        targetBuilding = o2s[Math.floor(Math.random() * o2s.length)]
      } else {
        zone = 'power'
        const solars = state.buildings.filter(b => b.type === 'solar' && !b.damaged)
        targetBuilding = solars[Math.floor(Math.random() * solars.length)]
      }

      let emergencyMult = 1.0
      if (powerPct < 0.2) emergencyMult = zone === 'power' ? 3.0 : emergencyMult
      if (airPct < 0.2) emergencyMult = zone === 'lifeSup' ? 3.0 : emergencyMult

      // Soft diminishing returns — don't pile everyone into one zone
      const engineersInZone = countWorkers(state, 'engineer')
      const buildingsInZone = state.buildings.filter(b => !b.damaged && ZONE_FOR_BUILDING[b.type] === zone).length
      const saturation = buildingsInZone > 0 ? Math.min(1, engineersInZone / (buildingsInZone * 2)) : 0
      const saturationDiscount = 1 - saturation * 0.6 // at most 60% reduction

      candidates.push({
        type: 'engineer',
        targetZone: zone,
        targetId: targetBuilding?.id,
        score: 45 * dirMod.engineer * mod.workUtilityMult * emergencyMult * saturationDiscount,
      })
    }
  }

  // REPAIR — only if repair kits in stock
  const damaged = state.buildings.filter(b => b.damaged)
  if (damaged.length > 0 && state.repairKits > 0) {
    const target = damaged[0]
    const targetZone = ZONE_FOR_BUILDING[target.type]
    const repairersOnTarget = countWorkers(state, 'repair', target.id)
    // First repairer gets full score, second gets 20%, third+ basically zero
    const workerDiscount = repairersOnTarget === 0 ? 1.0 : repairersOnTarget === 1 ? 0.2 : 0.05
    candidates.push({
      type: 'repair',
      targetZone,
      targetId: target.id,
      score: 80 * dirMod.repair * mod.repairUtilityMult * workerDiscount,
    })
  }

  // UNPACK — diminishes as more colonists are already unpacking
  const activeDrops = state.supplyDrops.filter(d => d.state === 'landed' || d.state === 'unpacking')
  if (activeDrops.length > 0) {
    const drop = activeDrops[0]
    const unpackers = countWorkers(state, 'unpack', drop.id)
    // First unpacker high priority, 2nd moderate, 3+ low
    const unpackDiscount = unpackers === 0 ? 1.0 : unpackers === 1 ? 0.5 : unpackers === 2 ? 0.15 : 0.05
    candidates.push({
      type: 'unpack',
      targetZone: 'landing',
      targetId: drop.id,
      score: 70 * unpackDiscount,
    })
  }

  // REST
  {
    let restScore = 10
    if (colonist.energy < ENERGY_TIRED) {
      restScore = 30 + (ENERGY_TIRED - colonist.energy) * 3
    }
    if (colonist.energy <= ENERGY_EXHAUSTED) {
      restScore = 200
    }
    candidates.push({ type: 'rest', targetZone: 'habitat', score: restScore })
  }

  // SOCIALIZE
  {
    let socialScore = 5
    if (colonist.morale < MORALE_STRESSED) {
      socialScore = 25 + (MORALE_STRESSED - colonist.morale) * 2
    }
    if (colonist.morale <= MORALE_BREAKING) {
      socialScore = 150
    }
    socialScore *= mod.socialUtilityMult
    candidates.push({ type: 'socialize', targetZone: 'habitat', score: socialScore })
  }

  // SEEK_MEDICAL
  const medThreshold = HEALTH_SEEK_MEDICAL + mod.medicalThresholdBonus
  if (colonist.health < medThreshold && state.buildings.some(b => b.type === 'medbay' && !b.damaged)) {
    let medScore = 20
    if (colonist.health < HEALTH_SEEK_MEDICAL_URGENT) {
      medScore = 60 + (HEALTH_SEEK_MEDICAL_URGENT - colonist.health) * 3
    }
    candidates.push({ type: 'seek_medical', targetZone: 'medical', score: medScore })
  }

  // WANDER — gives colonists natural downtime between tasks
  candidates.push({ type: 'wander', targetZone: colonist.currentZone, score: 8 })

  if (candidates.length === 0) return null

  // Add noise (±10%)
  for (const c of candidates) {
    c.score *= 0.9 + Math.random() * 0.2
  }

  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]

  const walkPath = colonist.currentZone !== best.targetZone
    ? findPath(colonist.currentZone, best.targetZone)
    : undefined

  const needsWalk = walkPath && walkPath.length > 1

  // Walk ticks = time to traverse first segment (distance-based)
  const firstSegmentTicks = needsWalk
    ? walkTicksBetween(walkPath![0], walkPath![1])
    : 0

  return {
    type: best.type,
    targetZone: best.targetZone,
    targetId: best.targetId,
    remainingTicks: needsWalk ? firstSegmentTicks : getActionDuration(best.type, colonist.trait),
    walkPath: needsWalk ? walkPath : undefined,
  }
}
