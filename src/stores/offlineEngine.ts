import type { ColonyState } from './gameStore'
import {
  AIR_CONSUMPTION_PER_COLONIST,
  O2_PRODUCTION_PER_GENERATOR,
  POWER_PRODUCTION_PER_SOLAR,
  POWER_CONSUMPTION_PER_BUILDING,
  DRILL_SPEED_PER_DRILLER,
  DRILL_SPEED_PER_RIG,
  METALS_PER_DEPTH,
  ICE_CHANCE_PER_TICK,
  ICE_PER_FIND,
  ENGINEER_EFFICIENCY_BONUS,
  MEDBAY_HEAL_PER_SEC,
  HEALTH_DRAIN_PER_SEC,
  HAZARD_CHECK_INTERVAL_MS,
  HAZARD_BASE_CHANCE,
  HAZARD_DEPTH_SCALE,
  BASE_CREDITS_PER_TICK,
  CREDITS_PER_METAL_MINED,
  CREDITS_PER_ICE_FOUND,
  DIRECTIVE_MODIFIERS,
  DIRECTIVE_RATIOS,
  STARTING_AIR_MAX,
  STARTING_POWER_MAX,
  COLONIST_NAMES,
  BLUEPRINTS,
  uid,
  PARTS_FACTORY_INTERVAL_MS,
  PARTS_FACTORY_METAL_COST,
  SHIPMENT_COOLDOWN_MS,
  SHIPMENT_TRANSIT_MS,
  EMERGENCY_TRANSIT_MS,
} from './gameStore'
import { getBuildingPosition } from '@/systems/mapLayout'

// ── Types ──────────────────────────────────────────────────────────

export interface OfflineEvent {
  type: 'hazard' | 'shipment' | 'resource_critical' | 'auto_directive' | 'milestone'
  message: string
  severity: 'info' | 'warning' | 'critical'
  offsetMs: number
}

export interface OfflineResult {
  events: OfflineEvent[]
  deltaCredits: number
  deltaMetals: number
  deltaIce: number
  deltaDepth: number
  durationMs: number
  finalState: ColonyState
}

// ── PRNG ───────────────────────────────────────────────────────────

export function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Rate Computation ───────────────────────────────────────────────

interface Rates {
  powerNet: number
  airNet: number
  drillRate: number
  creditRate: number
  healRate: number
  healthDrain: number
  engineerBonus: number
}

function computeRates(state: ColonyState): Rates {
  const aliveCount = state.colonists.filter(c => c.health > 0).length
  const ratio = DIRECTIVE_RATIOS[state.activeDirective]
  const engineers = Math.round(aliveCount * ratio.engineer)
  const drillers = Math.round(aliveCount * ratio.driller)
  const mod = DIRECTIVE_MODIFIERS[state.activeDirective]
  const engBonus = (1 + engineers * ENGINEER_EFFICIENCY_BONUS) * mod.prodMult

  const undamagedSolars = state.buildings.filter(b => b.type === 'solar' && !b.damaged).length
  const undamagedGenerators = state.buildings.filter(b => b.type === 'o2generator' && !b.damaged).length
  const undamagedMedbays = state.buildings.filter(b => b.type === 'medbay' && !b.damaged).length
  const activeBuildings = state.buildings.filter(b => !b.damaged).length
  const undamagedRigs = state.buildings.filter(b => b.type === 'drillrig' && !b.damaged).length

  const powerProd = undamagedSolars * POWER_PRODUCTION_PER_SOLAR * engBonus
  const powerCons = activeBuildings * POWER_CONSUMPTION_PER_BUILDING
  const powerNet = powerProd - powerCons

  const airProd = state.power > 0
    ? undamagedGenerators * O2_PRODUCTION_PER_GENERATOR * engBonus
    : 0
  const airCons = aliveCount * AIR_CONSUMPTION_PER_COLONIST
  const airNet = airProd - airCons

  const drillMult = DIRECTIVE_MODIFIERS[state.activeDirective].drillMult
  const drillEngBonus = 1 + engineers * ENGINEER_EFFICIENCY_BONUS
  const drillRate = (drillers * DRILL_SPEED_PER_DRILLER + undamagedRigs * DRILL_SPEED_PER_RIG) * drillEngBonus * drillMult

  const creditRate = BASE_CREDITS_PER_TICK + drillRate * METALS_PER_DEPTH * CREDITS_PER_METAL_MINED

  const healRate = (state.power > 0 && undamagedMedbays > 0)
    ? undamagedMedbays * MEDBAY_HEAL_PER_SEC * engBonus
    : 0

  const healthDrain = (state.air <= 0 || state.power <= 0) ? HEALTH_DRAIN_PER_SEC : 0

  return { powerNet, airNet, drillRate, creditRate, healRate, healthDrain, engineerBonus: engBonus }
}

// ── Helpers ────────────────────────────────────────────────────────

function applyHazard(state: ColonyState, rand: () => number, events: OfflineEvent[], offsetMs: number): void {
  const mod = DIRECTIVE_MODIFIERS[state.activeDirective]
  const chance = (HAZARD_BASE_CHANCE + state.depth * HAZARD_DEPTH_SCALE) * (1 - mod.hazardResist)
  if (rand() > chance) return

  const roll = rand()
  if (roll < 0.4) {
    const undamaged = state.buildings.filter(b => !b.damaged)
    if (undamaged.length > 0) {
      const target = undamaged[Math.floor(rand() * undamaged.length)]
      target.damaged = true
      const label = BLUEPRINTS.find(bp => bp.type === target.type)?.label || target.type
      events.push({ type: 'hazard', severity: 'critical', offsetMs, message: `Micro-meteor struck a ${label}!` })
    }
  } else if (roll < 0.7) {
    state.power = Math.max(0, state.power - state.powerMax * 0.3)
    events.push({ type: 'hazard', severity: 'critical', offsetMs, message: 'Power surge! 30% power lost.' })
  } else {
    state.air = Math.max(0, state.air - state.airMax * 0.25)
    events.push({ type: 'hazard', severity: 'critical', offsetMs, message: 'Hit a gas pocket! Air venting!' })
  }
}

function landShipments(state: ColonyState, rand: () => number, events: OfflineEvent[], offsetMs: number): void {
  const arrived = state.inTransitShipments.filter(s => state.totalPlaytimeMs >= s.arrivalAt)
  if (arrived.length === 0) return

  state.inTransitShipments = state.inTransitShipments.filter(s => state.totalPlaytimeMs < s.arrivalAt)

  for (const pkg of arrived) {
    for (const item of pkg.contents) {
      switch (item.type) {
        case 'emergencyO2':
          state.air = Math.min(state.airMax, state.air + 30)
          break
        case 'emergencyPower':
          state.power = Math.min(state.powerMax, state.power + 30)
          break
        case 'supplyCrate':
          state.metals += 15
          state.ice += 5
          break
        case 'equipment':
          if (item.buildingType) {
            const pos = getBuildingPosition(item.buildingType, state.buildings)
            state.buildings.push({ id: uid(), type: item.buildingType, damaged: false, x: pos.x, y: pos.y })
            if (item.buildingType === 'o2generator') state.airMax += 25
            if (item.buildingType === 'solar') state.powerMax += 25
          }
          break
        case 'newColonist': {
          const usedNames = new Set(state.colonists.map(c => c.name))
          const available = COLONIST_NAMES.filter(n => !usedNames.has(n))
          const name = available.length > 0
            ? available[Math.floor(rand() * available.length)]
            : `Crew-${state.colonists.length + 1}`
          const traits = ['hardy', 'diligent', 'social', 'cautious', 'efficient', 'stoic'] as const
          state.colonists.push({ id: uid(), name, health: 100, energy: 80, morale: 70, trait: traits[Math.floor(rand() * traits.length)], currentAction: null, currentZone: 'habitat' })
          break
        }
        case 'repairKit': {
          state.repairKits++
          break
        }
      }
    }
    const itemNames = pkg.contents.map(o => o.label).join(', ')
    events.push({ type: 'shipment', severity: 'info', offsetMs, message: `Shipment arrived: ${itemNames}` })
  }
}

// ── Main Simulation ────────────────────────────────────────────────

export function simulateOffline(inputState: ColonyState, elapsedMs: number): OfflineResult {
  const state: ColonyState = JSON.parse(JSON.stringify(inputState))
  const rand = mulberry32(state.lastTickAt)
  const events: OfflineEvent[] = []

  const before = { credits: state.credits, metals: state.metals, ice: state.ice, depth: state.depth }

  let remaining = elapsedMs / 1000
  let elapsedSoFar = 0
  let timeSinceHazardCheck = 0
  let lastMilestoneDepth = Math.floor(state.depth / 50)
  const HAZARD_INTERVAL_S = HAZARD_CHECK_INTERVAL_MS / 1000
  const MAX_ITERATIONS = 100_000
  let iterations = 0

  while (remaining > 0.01 && iterations < MAX_ITERATIONS) {
    iterations++
    const rates = computeRates(state)

    let nextPhase = remaining
    let phaseReason: 'end' | 'power_zero' | 'air_zero' | 'hazard' | 'shipment' = 'end'

    if (rates.powerNet < 0 && state.power > 0) {
      const t = state.power / Math.abs(rates.powerNet)
      if (t < nextPhase) { nextPhase = t; phaseReason = 'power_zero' }
    }

    if (rates.airNet < 0 && state.air > 0) {
      const t = state.air / Math.abs(rates.airNet)
      if (t < nextPhase) { nextPhase = t; phaseReason = 'air_zero' }
    }

    const timeToHazard = HAZARD_INTERVAL_S - timeSinceHazardCheck
    if (timeToHazard > 0 && timeToHazard < nextPhase) {
      nextPhase = timeToHazard
      phaseReason = 'hazard'
    }

    for (const s of state.inTransitShipments) {
      const arrivalIn = (s.arrivalAt - state.totalPlaytimeMs) / 1000
      if (arrivalIn > 0 && arrivalIn < nextPhase) {
        nextPhase = arrivalIn
        phaseReason = 'shipment'
      }
    }

    const phaseDt = Math.max(nextPhase, 0.001)

    state.power = Math.min(state.powerMax, Math.max(0, state.power + rates.powerNet * phaseDt))
    state.air = Math.min(state.airMax, Math.max(0, state.air + rates.airNet * phaseDt))

    if (rates.drillRate > 0) {
      const depthGain = rates.drillRate * phaseDt
      state.depth += depthGain
      if (state.depth > state.maxDepth) state.maxDepth = state.depth
      const metalGain = depthGain * METALS_PER_DEPTH
      state.metals += metalGain
      const iceGain = ICE_CHANCE_PER_TICK * phaseDt * ICE_PER_FIND
      state.ice += iceGain
      const creditGain = rates.creditRate * phaseDt + iceGain * CREDITS_PER_ICE_FOUND
      state.credits += creditGain
      state.totalCreditsEarned += creditGain
    } else {
      const creditGain = BASE_CREDITS_PER_TICK * phaseDt
      state.credits += creditGain
      state.totalCreditsEarned += creditGain
    }

    if (rates.healRate > 0) {
      for (const c of state.colonists) {
        if (c.health > 0 && c.health < 100) {
          c.health = Math.min(100, c.health + rates.healRate * phaseDt)
        }
      }
    }

    if (rates.healthDrain > 0) {
      for (const c of state.colonists) {
        if (c.health > 10) {
          c.health = Math.max(10, c.health - rates.healthDrain * phaseDt)
        }
      }
    }

    state.totalPlaytimeMs += phaseDt * 1000
    remaining -= phaseDt
    elapsedSoFar += phaseDt * 1000
    timeSinceHazardCheck += phaseDt

    if (phaseReason === 'power_zero') {
      state.power = 0
      events.push({ type: 'resource_critical', severity: 'critical', offsetMs: elapsedSoFar, message: 'Power depleted! Air production offline.' })
    }

    if (phaseReason === 'air_zero') {
      state.air = 0
      events.push({ type: 'resource_critical', severity: 'critical', offsetMs: elapsedSoFar, message: 'Air reserves depleted! Crew health declining.' })
    }

    if (phaseReason === 'hazard') {
      timeSinceHazardCheck = 0
      applyHazard(state, rand, events, elapsedSoFar)
    }

    if (phaseReason === 'shipment') {
      landShipments(state, rand, events, elapsedSoFar)
    }

    // Offline repair — consume kits to fix damaged buildings
    if (state.repairKits > 0) {
      const damaged = state.buildings.find((b) => b.damaged)
      if (damaged) {
        damaged.damaged = false
        state.repairKits--
      }
    }

    // Parts Factory production (offline)
    const factoryCount = state.buildings.filter(b => b.type === 'partsfactory' && !b.damaged).length
    if (factoryCount > 0 && state.power > 0 && state.metals >= PARTS_FACTORY_METAL_COST) {
      const interval = PARTS_FACTORY_INTERVAL_MS / factoryCount
      if (state.totalPlaytimeMs - state.lastPartsProducedAt >= interval) {
        state.metals -= PARTS_FACTORY_METAL_COST
        state.repairKits++
        state.lastPartsProducedAt = state.totalPlaytimeMs
      }
    }

    // Auto-relaunch (offline)
    if (state.autoRelaunch && state.lastManifest.length > 0 && state.totalPlaytimeMs >= state.shipmentCooldownUntil) {
      const cost = state.lastManifest.reduce((sum, o) => sum + o.cost, 0)
      if (state.credits >= cost) {
        state.credits -= cost
        const hasEmergency = state.lastManifest.some(
          (o) => o.type === 'emergencyO2' || o.type === 'emergencyPower',
        )
        const transit = hasEmergency ? EMERGENCY_TRANSIT_MS : SHIPMENT_TRANSIT_MS
        state.inTransitShipments.push({
          id: uid(),
          contents: [...state.lastManifest],
          totalWeight: state.lastManifest.reduce((sum, o) => sum + o.weight, 0),
          arrivalAt: state.totalPlaytimeMs + transit,
        })
        state.shipmentCooldownUntil = state.totalPlaytimeMs + SHIPMENT_COOLDOWN_MS
        events.push({ type: 'shipment', severity: 'info', offsetMs: elapsedSoFar, message: 'Auto-relaunched shipment.' })
      } else {
        state.autoRelaunch = false
      }
    }

    if (state.activeDirective !== 'emergency') {
      if (state.air < state.airMax * 0.2 || state.power < state.powerMax * 0.2) {
        state.activeDirective = 'emergency'
        events.push({ type: 'auto_directive', severity: 'warning', offsetMs: elapsedSoFar, message: 'Auto-switched to Emergency Protocol — resources critical.' })
      }
    }

    const currentMilestone = Math.floor(state.depth / 50)
    if (currentMilestone > lastMilestoneDepth) {
      events.push({ type: 'milestone', severity: 'info', offsetMs: elapsedSoFar, message: `Reached ${currentMilestone * 50}m depth.` })
      lastMilestoneDepth = currentMilestone
    }
  }

  const generators = state.buildings.filter(b => b.type === 'o2generator' && !b.damaged).length
  const solars = state.buildings.filter(b => b.type === 'solar' && !b.damaged).length
  state.airMax = STARTING_AIR_MAX + generators * 25
  state.powerMax = STARTING_POWER_MAX + solars * 25
  state.supplyDrops = []
  state.hazardCooldownUntil = Date.now() + (HAZARD_CHECK_INTERVAL_MS - timeSinceHazardCheck * 1000)

  return {
    events,
    deltaCredits: state.credits - before.credits,
    deltaMetals: state.metals - before.metals,
    deltaIce: state.ice - before.ice,
    deltaDepth: state.depth - before.depth,
    durationMs: elapsedMs,
    finalState: state,
  }
}
