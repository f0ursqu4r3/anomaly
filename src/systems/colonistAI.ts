import type { Action, ActionType, Trait, SkillTrait, Specialization } from '@/types/colonist'
import type { ColonyState, Building, Directive } from '@/stores/gameStore'
import { ZONE_FOR_BUILDING, ZONE_MAP, findPath } from '@/systems/mapLayout'
import { getEfficiencyMultiplier } from '@/systems/colonistIdentity'

// ── Constants ──

const ENERGY_DRAIN_WORKING = 1.5
const ENERGY_DRAIN_WALKING = 0.5
const ENERGY_RECOVERY_RESTING = 3.0

const MORALE_DRAIN_PASSIVE = 0.2
const MORALE_RECOVERY_SOCIAL = 2.0
const MORALE_RECOVERY_RESTING = 0.5

// Focus
const FOCUS_DRAIN_WORKING = 2.5
const FOCUS_RECOVERY_REST = 2.0
const FOCUS_RECOVERY_SOCIAL = 1.5
const FOCUS_RECOVERY_EAT = 1.0
const FOCUS_RECOVERY_WANDER = 0.5
export const FOCUS_RECOVERY_TRANSITION = 0.3
const FOCUS_LOW = 25
const FOCUS_DEPLETED = 10

// Hunger
const HUNGER_DRAIN = 0.3
const HUNGER_HUNGRY = 40
const HUNGER_STARVING = 15

// Transitions
const TRANSITION_PAUSE_SHORT: [number, number] = [2, 3]
const TRANSITION_PAUSE_LONG: [number, number] = [3, 5]
const BOND_DETOUR_CHANCE = 0.2

// Restlessness
const RESTLESS_THRESHOLD = 3
const RESTLESS_HEAVY_THRESHOLD = 4
const RESTLESS_PENALTY = 0.7
const RESTLESS_HEAVY_PENALTY = 0.5
const WORK_ACTIONS: ActionType[] = ['extract', 'engineer', 'repair', 'construct', 'load']

const ENERGY_TIRED = 30
const ENERGY_EXHAUSTED = 10
const MORALE_STRESSED = 25
const MORALE_BREAKING = 10
const HEALTH_SEEK_MEDICAL = 70
const HEALTH_SEEK_MEDICAL_URGENT = 40

const DURATION: Record<ActionType, [number, number]> = {
  extract: [12, 25],
  engineer: [12, 25],
  repair: [15, 30],
  unpack: [5, 10],
  rest: [15, 35],
  socialize: [10, 20],
  seek_medical: [20, 40],
  wander: [8, 18],
  load: [8, 15],
  construct: [20, 40],
  eat: [8, 15],
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
  focusDrainMult: number
  restlessThreshold: number
  transitionMult: number
}

const TRAIT_MODS: Record<Trait, TraitMod> = {
  hardy: {
    energyDrainMult: 0.75,
    moraleDrainMult: 1.0,
    workUtilityMult: 1.0,
    socialUtilityMult: 1.0,
    repairUtilityMult: 1.0,
    medicalThresholdBonus: 0,
    durationMult: 1.0,
    walkSpeedMult: 1.0,
    focusDrainMult: 1.0,
    restlessThreshold: 3,
    transitionMult: 1.0,
  },
  diligent: {
    energyDrainMult: 1.0,
    moraleDrainMult: 1.0,
    workUtilityMult: 1.2,
    socialUtilityMult: 0.7,
    repairUtilityMult: 1.0,
    medicalThresholdBonus: 0,
    durationMult: 1.0,
    walkSpeedMult: 1.0,
    focusDrainMult: 0.8,
    restlessThreshold: 4,
    transitionMult: 1.0,
  },
  social: {
    energyDrainMult: 1.0,
    moraleDrainMult: 1.3,
    workUtilityMult: 1.0,
    socialUtilityMult: 1.5,
    repairUtilityMult: 1.0,
    medicalThresholdBonus: 0,
    durationMult: 1.0,
    walkSpeedMult: 1.0,
    focusDrainMult: 1.3,
    restlessThreshold: 2,
    transitionMult: 1.5,
  },
  cautious: {
    energyDrainMult: 1.0,
    moraleDrainMult: 1.0,
    workUtilityMult: 1.0,
    socialUtilityMult: 1.0,
    repairUtilityMult: 1.5,
    medicalThresholdBonus: 15,
    durationMult: 1.0,
    walkSpeedMult: 1.0,
    focusDrainMult: 1.0,
    restlessThreshold: 3,
    transitionMult: 1.0,
  },
  efficient: {
    energyDrainMult: 1.0,
    moraleDrainMult: 1.0,
    workUtilityMult: 1.0,
    socialUtilityMult: 1.0,
    repairUtilityMult: 1.0,
    medicalThresholdBonus: 0,
    durationMult: 0.85,
    walkSpeedMult: 1.1,
    focusDrainMult: 1.0,
    restlessThreshold: 3,
    transitionMult: 0.5,
  },
  stoic: {
    energyDrainMult: 1.0,
    moraleDrainMult: 0.7,
    workUtilityMult: 1.0,
    socialUtilityMult: 0.6,
    repairUtilityMult: 1.0,
    medicalThresholdBonus: 0,
    durationMult: 1.0,
    walkSpeedMult: 1.0,
    focusDrainMult: 0.9,
    restlessThreshold: 99,
    transitionMult: 1.0,
  },
}

const DIRECTIVE_UTILITY: Record<Directive, { extract: number; engineer: number; repair: number }> =
  {
    mining: { extract: 1.5, engineer: 0.6, repair: 1.0 },
    safety: { extract: 0.6, engineer: 1.5, repair: 1.5 },
    balanced: { extract: 1.0, engineer: 1.0, repair: 1.0 },
    emergency: { extract: 0.5, engineer: 2.0, repair: 2.0 },
  }

// ── Needs Update ──

export interface ColonistLike {
  id: string
  health: number
  energy: number
  morale: number
  focus: number
  hunger: number
  actionHistory: ActionType[]
  transitionTicks: number
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
    } else if (action.type === 'eat') {
      colonist.energy = Math.min(100, colonist.energy + ENERGY_RECOVERY_RESTING * 0.3)
    } else if (action.type === 'wander') {
      // No drain while wandering
    } else {
      // Working energy drain — Night Owl reduces drain at low energy
      if (colonist.skillTrait === 'nightOwl' && colonist.energy < 30) {
        colonist.energy = Math.max(
          0,
          colonist.energy - ENERGY_DRAIN_WORKING * mod.energyDrainMult * 0.3,
        )
      } else {
        colonist.energy = Math.max(0, colonist.energy - ENERGY_DRAIN_WORKING * mod.energyDrainMult)
      }
    }
  }

  // Morale
  if (action?.type === 'socialize') {
    colonist.morale = Math.min(100, colonist.morale + MORALE_RECOVERY_SOCIAL)
  } else if (action?.type === 'rest') {
    colonist.morale = Math.min(100, colonist.morale + MORALE_RECOVERY_RESTING)
  } else if (action?.type === 'eat') {
    colonist.morale = Math.min(100, colonist.morale + MORALE_RECOVERY_RESTING * 0.5)
  } else {
    colonist.morale = Math.max(0, colonist.morale - MORALE_DRAIN_PASSIVE * mod.moraleDrainMult)
  }

  // Focus
  if (action) {
    if (action.walkPath && action.walkPath.length > 0) {
      // Walking — no focus drain
    } else if (action.type === 'rest') {
      colonist.focus = Math.min(100, colonist.focus + FOCUS_RECOVERY_REST)
    } else if (action.type === 'socialize') {
      colonist.focus = Math.min(100, colonist.focus + FOCUS_RECOVERY_SOCIAL)
    } else if (action.type === 'eat') {
      colonist.focus = Math.min(100, colonist.focus + FOCUS_RECOVERY_EAT)
    } else if (action.type === 'wander') {
      colonist.focus = Math.min(100, colonist.focus + FOCUS_RECOVERY_WANDER)
    } else {
      // Working — drain focus
      colonist.focus = Math.max(0, colonist.focus - FOCUS_DRAIN_WORKING * mod.focusDrainMult)
    }
  }

  // Hunger — drains passively every tick regardless of action
  const hungerDrainMult = colonist.skillTrait === 'ironStomach' ? 0.7 : 1.0
  colonist.hunger = Math.max(0, colonist.hunger - HUNGER_DRAIN * hungerDrainMult)
}

// ── Forced Interrupts ──

export function checkInterrupt(colonist: ColonistLike): boolean {
  if (colonist.health <= 0) return false
  if (colonist.energy <= ENERGY_EXHAUSTED && colonist.currentAction?.type !== 'rest') {
    colonist.currentAction = null
    return true
  }
  if (
    colonist.morale <= MORALE_BREAKING &&
    colonist.currentAction?.type !== 'rest' &&
    colonist.currentAction?.type !== 'socialize'
  ) {
    colonist.currentAction = null
    return true
  }
  return false
}

// ── Action Advancement ──

const WALK_SPEED_PCT = 3 // % of map per second — must match useColonistMovement

/** Calculate how many ticks to walk between two zones */
export function walkTicksBetween(fromId: string, toId: string): number {
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
        action.remainingTicks = getActionDuration(action.type, colonist)
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

export function getActionDuration(type: ActionType, colonist: ColonistLike): number {
  const [min, max] = DURATION[type]
  const base = min + Math.floor(Math.random() * (max - min + 1))
  const traitMult = TRAIT_MODS[colonist.trait].durationMult
  const efficiency = getEfficiencyMultiplier(colonist as any, type)
  // Higher efficiency = shorter duration
  return Math.max(1, Math.round((base * traitMult) / efficiency))
}

/** Calculate how long a colonist pauses between actions */
export function getTransitionTicks(
  colonist: ColonistLike,
  completedActionTicks: number,
  completedActionType?: ActionType,
): number {
  const mod = TRAIT_MODS[colonist.trait]
  let [min, max] = completedActionTicks > 20 ? TRANSITION_PAUSE_LONG : TRANSITION_PAUSE_SHORT

  // Socializing → shorter pause (already refreshed)
  if (completedActionType === 'socialize') {
    min = 1
    max = 2
  }

  const base = min + Math.floor(Math.random() * (max - min + 1))
  return Math.max(1, Math.round(base * mod.transitionMult))
}

/** Check if colonist should detour to visit a bonded partner during transition */
export function checkBondDetour(colonist: ColonistLike, state: ColonyState): string | null {
  if (Math.random() > BOND_DETOUR_CHANCE) return null
  if (!colonist.bonds) return null

  const currentZone = ZONE_MAP[colonist.currentZone]
  if (!currentZone) return null

  for (const [partnerId, affinity] of Object.entries(colonist.bonds)) {
    if (affinity < 20) continue
    const partner = state.colonists.find((p) => p.id === partnerId && p.health > 0)
    if (!partner || partner.currentZone === colonist.currentZone) continue

    // Check if partner is in an adjacent zone (direct path, 1 hop)
    const path = findPath(colonist.currentZone, partner.currentZone)
    if (path && path.length === 2) {
      return partner.currentZone
    }
  }
  return null
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
  return state.colonists.filter((c) => {
    if (c.health <= 0 || !c.currentAction) return false
    if (c.currentAction.type !== actionType) return false
    if (targetId && c.currentAction.targetId !== targetId) return false
    return true
  }).length
}

/** Calculate restlessness penalty for a given action type based on recent history */
function getRestlessPenalty(colonist: ColonistLike, actionType: ActionType): number {
  if (!WORK_ACTIONS.includes(actionType)) return 1.0
  const mod = TRAIT_MODS[colonist.trait]
  if (mod.restlessThreshold >= 99) return 1.0 // stoic: immune

  const count = colonist.actionHistory.filter((a) => a === actionType).length
  if (count >= RESTLESS_HEAVY_THRESHOLD) {
    return RESTLESS_HEAVY_PENALTY
  }
  if (count >= mod.restlessThreshold) {
    return RESTLESS_PENALTY
  }
  return 1.0
}

export function selectAction(colonist: ColonistLike, state: ColonyState): Action | null {
  if (colonist.health <= 0) return null

  const mod = TRAIT_MODS[colonist.trait]
  const dirMod = DIRECTIVE_UTILITY[state.activeDirective]
  const candidates: ScoredAction[] = []

  // Focus penalty on work actions
  let focusMult = 1.0
  if (colonist.focus < FOCUS_DEPLETED) {
    focusMult = 0.0 // won't select work at all
  } else if (colonist.focus < FOCUS_LOW) {
    focusMult = 0.4
  }

  // Hunger penalty on work actions
  let hungerMult = 1.0
  if (colonist.hunger < HUNGER_STARVING) {
    hungerMult = 0.3
  } else if (colonist.hunger < HUNGER_HUNGRY) {
    hungerMult = 0.8
  }

  // EXTRACT
  if (colonist.energy > 20) {
    const rigs = state.buildings.filter((b) => b.type === 'extractionrig' && !b.damaged)
    if (rigs.length > 0) {
      const rig = rigs[Math.floor(Math.random() * rigs.length)]
      candidates.push({
        type: 'extract',
        targetZone: 'extraction',
        targetId: rig.id,
        score: 50 * dirMod.extract * mod.workUtilityMult * focusMult * hungerMult * getRestlessPenalty(colonist, 'extract'),
      })
    }
  }

  // ENGINEER
  if (colonist.energy > 20) {
    const powerPct = state.powerMax > 0 ? state.power / state.powerMax : 1
    const airPct = state.airMax > 0 ? state.air / state.airMax : 1
    const hasSolar = state.buildings.some((b) => b.type === 'solar' && !b.damaged)
    const hasO2 = state.buildings.some((b) => b.type === 'o2generator' && !b.damaged)

    if (hasSolar || hasO2) {
      let zone: string
      let targetBuilding: Building | undefined
      if (powerPct <= airPct && hasSolar) {
        zone = 'power'
        const solars = state.buildings.filter((b) => b.type === 'solar' && !b.damaged)
        targetBuilding = solars[Math.floor(Math.random() * solars.length)]
      } else if (hasO2) {
        zone = 'lifeSup'
        const o2s = state.buildings.filter((b) => b.type === 'o2generator' && !b.damaged)
        targetBuilding = o2s[Math.floor(Math.random() * o2s.length)]
      } else {
        zone = 'power'
        const solars = state.buildings.filter((b) => b.type === 'solar' && !b.damaged)
        targetBuilding = solars[Math.floor(Math.random() * solars.length)]
      }

      let emergencyMult = 1.0
      if (powerPct < 0.2) emergencyMult = zone === 'power' ? 3.0 : emergencyMult
      if (airPct < 0.2) emergencyMult = zone === 'lifeSup' ? 3.0 : emergencyMult

      // Soft diminishing returns — don't pile everyone into one zone
      const engineersInZone = countWorkers(state, 'engineer')
      const buildingsInZone = state.buildings.filter(
        (b) => !b.damaged && ZONE_FOR_BUILDING[b.type] === zone,
      ).length
      const saturation =
        buildingsInZone > 0 ? Math.min(1, engineersInZone / (buildingsInZone * 2)) : 0
      const saturationDiscount = 1 - saturation * 0.6 // at most 60% reduction

      candidates.push({
        type: 'engineer',
        targetZone: zone,
        targetId: targetBuilding?.id,
        score: 45 * dirMod.engineer * mod.workUtilityMult * emergencyMult * saturationDiscount * focusMult * hungerMult * getRestlessPenalty(colonist, 'engineer'),
      })
    }

    // WORKSHOP — Parts Factory needs an operator to produce repair kits
    const factories = state.buildings.filter(
      (b) => b.type === 'partsfactory' && !b.damaged && b.constructionProgress === null,
    )
    if (factories.length > 0) {
      const factory = factories[Math.floor(Math.random() * factories.length)]
      const workshopEngineers = countWorkers(state, 'engineer', factory.id)
      const workerDiscount = workshopEngineers === 0 ? 1.0 : workshopEngineers === 1 ? 0.1 : 0.02

      // Urgency: if buildings are damaged and no repair kits, prioritize kit production
      const damagedCount = state.buildings.filter((b) => b.damaged).length
      const kitUrgency = damagedCount > 0 && state.repairKits === 0 ? 2.5 : 1.0

      candidates.push({
        type: 'engineer',
        targetZone: 'workshop',
        targetId: factory.id,
        score: 35 * dirMod.engineer * mod.workUtilityMult * workerDiscount * kitUrgency * focusMult * hungerMult * getRestlessPenalty(colonist, 'engineer'),
      })
    }
  }

  // REPAIR — only if repair kits in stock
  const damaged = state.buildings.filter((b) => b.damaged)
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
      score: 80 * dirMod.repair * mod.repairUtilityMult * workerDiscount * focusMult * hungerMult * getRestlessPenalty(colonist, 'repair'),
    })
  }

  // CONSTRUCT — build under-construction buildings
  if (colonist.energy > 20) {
    const sites = state.buildings.filter(
      (b) => b.constructionProgress !== null && b.constructionProgress < 1,
    )
    if (sites.length > 0) {
      const site = sites[0]
      const targetZone = ZONE_FOR_BUILDING[site.type]
      const constructors = countWorkers(state, 'construct', site.id)
      // First constructor gets full score, second gets 30%, third+ negligible
      const workerDiscount = constructors === 0 ? 1.0 : constructors === 1 ? 0.3 : 0.05
      candidates.push({
        type: 'construct',
        targetZone,
        targetId: site.id,
        score: 75 * dirMod.engineer * mod.workUtilityMult * workerDiscount * focusMult * hungerMult * getRestlessPenalty(colonist, 'construct'),
      })
    }
  }

  // UNPACK — diminishes as more colonists are already unpacking
  const activeDrops = state.supplyDrops.filter(
    (d) => d.state === 'landed' || d.state === 'unpacking',
  )
  if (activeDrops.length > 0) {
    const drop = activeDrops[0]
    const unpackers = countWorkers(state, 'unpack', drop.id)
    // First unpacker high priority, 2nd moderate, 3+ low
    const unpackDiscount =
      unpackers === 0 ? 1.0 : unpackers === 1 ? 0.5 : unpackers === 2 ? 0.15 : 0.05
    candidates.push({
      type: 'unpack',
      targetZone: 'landing',
      targetId: drop.id,
      score: 70 * unpackDiscount * focusMult * hungerMult,
    })
  }

  // LOAD — haul resources to export platform (pick the best docked platform with space)
  if (colonist.energy > 20) {
    const platforms = state.buildings.filter(
      (b) => b.type === 'launchplatform' && !b.damaged && b.constructionProgress === null,
    )
    const hasResources = state.metals > 0 || state.ice > 0 || state.rareMinerals > 0
    if (hasResources) {
      for (const platform of platforms) {
        const ep = state.exportPlatforms?.[platform.id]
        if (!ep || ep.status !== 'docked') continue
        const loaded = ep.cargo.metals + ep.cargo.ice + ep.cargo.rareMinerals
        if (loaded >= ep.capacity) continue

        const loaders = countWorkers(state, 'load', platform.id)
        const loaderDiscount =
          loaders === 0 ? 1.0 : loaders === 1 ? 0.5 : loaders === 2 ? 0.15 : 0.05

        const siloCount = state.buildings.filter(
          (b) => b.type === 'storageSilo' && !b.damaged && b.constructionProgress === null,
        ).length
        const metalCap = 50 + siloCount * 100
        const storagePct = metalCap > 0 ? state.metals / metalCap : 0
        const urgency = storagePct > 0.8 ? 2.0 : storagePct > 0.5 ? 1.3 : 1.0

        candidates.push({
          type: 'load',
          targetZone: 'landing',
          targetId: platform.id,
          score: 45 * mod.workUtilityMult * loaderDiscount * urgency * focusMult * hungerMult * getRestlessPenalty(colonist, 'load'),
        })
        break // only consider one platform per colonist decision
      }
    }
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

  // EAT
  {
    let eatScore = 5
    if (colonist.hunger < HUNGER_HUNGRY) {
      eatScore = 30 + (HUNGER_HUNGRY - colonist.hunger) * 1.5
    }
    if (colonist.hunger < HUNGER_STARVING) {
      eatScore = 120
    }
    candidates.push({ type: 'eat', targetZone: 'habitat', score: eatScore })
  }

  // SEEK_MEDICAL
  const medThreshold = HEALTH_SEEK_MEDICAL + mod.medicalThresholdBonus
  const medbay = state.buildings.find(
    (b) => b.type === 'medbay' && !b.damaged && b.constructionProgress === null,
  )
  if (colonist.health < medThreshold && medbay) {
    let medScore = 20
    if (colonist.health < HEALTH_SEEK_MEDICAL_URGENT) {
      medScore = 60 + (HEALTH_SEEK_MEDICAL_URGENT - colonist.health) * 3
    }
    candidates.push({
      type: 'seek_medical',
      targetZone: 'medical',
      targetId: medbay.id,
      score: medScore,
    })
  }

  // WANDER — gives colonists natural downtime between tasks
  candidates.push({ type: 'wander', targetZone: colonist.currentZone, score: 8 })

  if (candidates.length === 0) return null

  // Add noise (±10%)
  for (const c of candidates) {
    c.score *= 0.9 + Math.random() * 0.2
  }

  // Bond partner proximity bonus — prefer actions in partner's zone
  if (colonist.bonds) {
    for (const c of candidates) {
      for (const [partnerId, affinity] of Object.entries(colonist.bonds)) {
        if (affinity < 20) continue
        const partner = state.colonists.find((p) => p.id === partnerId && p.health > 0)
        if (partner && partner.currentZone === c.targetZone) {
          c.score *= 1.1 // small preference
          break
        }
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]

  const walkPath =
    colonist.currentZone !== best.targetZone
      ? findPath(colonist.currentZone, best.targetZone)
      : undefined

  const needsWalk = walkPath && walkPath.length > 1

  // Walk ticks = time to traverse first segment (distance-based)
  const firstSegmentTicks = needsWalk ? walkTicksBetween(walkPath![0], walkPath![1]) : 0

  return {
    type: best.type,
    targetZone: best.targetZone,
    targetId: best.targetId,
    remainingTicks: needsWalk ? firstSegmentTicks : getActionDuration(best.type, colonist),
    walkPath: needsWalk ? walkPath : undefined,
  }
}
