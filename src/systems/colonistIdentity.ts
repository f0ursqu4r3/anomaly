import type { Colonist } from '@/stores/gameStore'
import type { ActionType, SkillTrait, Specialization, XPTrack } from '@/types/colonist'
import { xpLevel } from '@/types/colonist'

// ── Constants ──

const BOND_ACCRUAL_INTERVAL_S = 60
const BOND_DECAY_INTERVAL_S = 120
const BOND_THRESHOLD = 20
const MAX_BONDS = 3
const SPECIALIZATION_LEVEL = 3 // XP level required (25 XP)

const MORALE_ON_DEATH = -15
const MORALE_ON_BOND_DEATH = -30
const MORALE_ON_HAZARD = -5
const MORALE_ON_SURVEY_RETURN = 5
const MORALE_OUTPOST_DRAIN_PER_60S = -1
const MORALE_BOND_COLOC_PER_60S = 1
const MORALE_IDLE_DRAIN_PER_30T = -2

const BREAKDOWN_THRESHOLD = 15
const BREAKDOWN_COOLDOWN_MS = 300_000 // 5 minutes
const BREAKDOWN_DURATION_TICKS_MIN = 30
const BREAKDOWN_DURATION_TICKS_MAX = 60

// ── XP Accrual ──

const ACTION_TO_XP_TRACK: Partial<Record<ActionType, XPTrack>> = {
  extract: 'extractionXP',
  engineer: 'engineeringXP',
  repair: 'engineeringXP',
  seek_medical: 'medicalXP',
}

export function awardXP(colonist: Colonist, completedAction: ActionType): void {
  const track = ACTION_TO_XP_TRACK[completedAction]
  if (!track) return
  colonist[track] += 1
}

// ── Specialization ──

const TRACK_TO_SPEC: Record<XPTrack, Specialization> = {
  extractionXP: 'prospector',
  engineeringXP: 'mechanic',
  medicalXP: 'medic',
}

export function checkSpecialization(colonist: Colonist): Specialization | null {
  if (colonist.specialization) return null // already specialized

  const tracks: XPTrack[] = ['extractionXP', 'engineeringXP', 'medicalXP']
  for (const track of tracks) {
    if (xpLevel(colonist[track]) >= SPECIALIZATION_LEVEL) {
      colonist.specialization = TRACK_TO_SPEC[track]
      return colonist.specialization
    }
  }
  return null
}

// ── Efficiency Multiplier ──

export function getEfficiencyMultiplier(colonist: Colonist, actionType: ActionType): number {
  let mult = 1.0

  // XP level bonus: +5% per level in matching track
  const track = ACTION_TO_XP_TRACK[actionType]
  if (track) {
    mult += (xpLevel(colonist[track]) - 1) * 0.05
  }

  // Skill trait bonus
  mult += getSkillTraitBonus(colonist.skillTrait, actionType)

  // Specialization bonus
  mult += getSpecializationBonus(colonist.specialization, actionType)

  // Morale bonus/penalty
  if (colonist.morale > 80) mult += 0.10
  else if (colonist.morale < 30) mult -= 0.20

  return mult
}

function getSkillTraitBonus(skillTrait: SkillTrait, actionType: ActionType): number {
  switch (skillTrait) {
    case 'steadyHands': return actionType === 'repair' ? 0.20 : 0
    case 'geologist': return actionType === 'extract' ? 0.10 : 0
    case 'fieldMedic': return actionType === 'seek_medical' ? 0.15 : 0
    case 'tinkerer': return actionType === 'engineer' ? 0.15 : 0
    default: return 0
  }
}

function getSpecializationBonus(spec: Specialization | null, actionType: ActionType): number {
  if (!spec) return 0
  switch (spec) {
    case 'prospector': return actionType === 'extract' ? 0.10 : 0
    case 'mechanic': return actionType === 'repair' ? 0.50 : 0 // "50% fewer ticks" = +50% speed
    case 'medic': return actionType === 'seek_medical' ? 1.0 : 0 // 2x healing
    default: return 0
  }
}

// ── Bond Bonus (co-located bonded partner) ──

export function getBondBonus(colonist: Colonist, allColonists: Colonist[]): number {
  if (!colonist.bonds) return 0
  for (const [partnerId, affinity] of Object.entries(colonist.bonds)) {
    if (affinity < BOND_THRESHOLD) continue
    const partner = allColonists.find(c => c.id === partnerId && c.health > 0)
    if (partner && partner.currentZone === colonist.currentZone) {
      return 0.10
    }
  }
  return 0
}

// ── Bond Updates (call once per tick) ──

let bondAccrualCounter = 0
let bondDecayCounter = 0

export function updateBonds(colonists: Colonist[]): void {
  bondAccrualCounter++
  bondDecayCounter++

  const alive = colonists.filter(c => c.health > 0)

  // Accrue affinity every 60s
  if (bondAccrualCounter >= BOND_ACCRUAL_INTERVAL_S) {
    bondAccrualCounter = 0

    // Group colonists by zone
    const byZone = new Map<string, Colonist[]>()
    for (const c of alive) {
      const zone = c.currentZone
      if (!byZone.has(zone)) byZone.set(zone, [])
      byZone.get(zone)!.push(c)
    }

    for (const group of byZone.values()) {
      if (group.length < 2) continue
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i]
          const b = group[j]
          if (!a.bonds) a.bonds = {}
          if (!b.bonds) b.bonds = {}
          a.bonds[b.id] = (a.bonds[b.id] ?? 0) + 1
          b.bonds[a.id] = (b.bonds[a.id] ?? 0) + 1
        }
      }
    }
  }

  // Decay affinity every 120s for non-co-located pairs
  if (bondDecayCounter >= BOND_DECAY_INTERVAL_S) {
    bondDecayCounter = 0
    for (const c of alive) {
      if (!c.bonds) continue
      for (const [partnerId, affinity] of Object.entries(c.bonds)) {
        const partner = alive.find(p => p.id === partnerId)
        if (!partner || partner.currentZone !== c.currentZone) {
          c.bonds[partnerId] = affinity - 1
          if (c.bonds[partnerId] <= 0) delete c.bonds[partnerId]
        }
      }
    }
  }

  // Enforce max bonds
  for (const c of alive) {
    if (!c.bonds) continue
    const entries = Object.entries(c.bonds).filter(([, v]) => v >= BOND_THRESHOLD)
    if (entries.length > MAX_BONDS) {
      entries.sort((a, b) => a[1] - b[1])
      // Remove weakest bonds over the limit
      for (let i = 0; i < entries.length - MAX_BONDS; i++) {
        c.bonds[entries[i][0]] = BOND_THRESHOLD - 1 // drop below threshold
      }
    }
  }
}

// ── Bond Queries ──

export function isBonded(colonist: Colonist, otherId: string): boolean {
  return (colonist.bonds?.[otherId] ?? 0) >= BOND_THRESHOLD
}

export function getBondedPartners(colonist: Colonist): string[] {
  if (!colonist.bonds) return []
  return Object.entries(colonist.bonds)
    .filter(([, v]) => v >= BOND_THRESHOLD)
    .map(([id]) => id)
}

export function getNewBonds(colonist: Colonist): string[] {
  // Check if any partner just crossed the threshold (value exactly 20)
  if (!colonist.bonds) return []
  return Object.entries(colonist.bonds)
    .filter(([, v]) => v === BOND_THRESHOLD)
    .map(([id]) => id)
}

// ── Morale Events ──

export function applyDeathMorale(deadColonist: Colonist, allColonists: Colonist[]): void {
  for (const c of allColonists) {
    if (c.health <= 0 || c.id === deadColonist.id) continue
    if (isBonded(c, deadColonist.id)) {
      c.morale = Math.max(0, c.morale + MORALE_ON_BOND_DEATH)
    } else {
      c.morale = Math.max(0, c.morale + MORALE_ON_DEATH)
    }
    // Clean up bond to dead colonist
    if (c.bonds?.[deadColonist.id]) {
      delete c.bonds[deadColonist.id]
    }
  }
}

export function applyHazardMorale(colonists: Colonist[]): void {
  for (const c of colonists) {
    if (c.health <= 0) continue
    c.morale = Math.max(0, c.morale + MORALE_ON_HAZARD)
  }
}

export function applySurveyReturnMorale(colonistIds: string[], allColonists: Colonist[]): void {
  for (const c of allColonists) {
    if (colonistIds.includes(c.id) && c.health > 0) {
      c.morale = Math.min(100, c.morale + MORALE_ON_SURVEY_RETURN)
    }
  }
}

export function applyOutpostIsolationMorale(colonist: Colonist): void {
  const drain = colonist.skillTrait === 'claustrophobic'
    ? MORALE_OUTPOST_DRAIN_PER_60S * 2
    : MORALE_OUTPOST_DRAIN_PER_60S
  colonist.morale = Math.max(0, colonist.morale + drain)
}

// ── Breakdown Check ──

export function checkBreakdown(colonist: Colonist, nowMs: number): number | null {
  if (colonist.health <= 0) return null
  if (colonist.morale >= BREAKDOWN_THRESHOLD) return null
  if (colonist.lastBreakdownAt && nowMs - colonist.lastBreakdownAt < BREAKDOWN_COOLDOWN_MS) return null
  if (colonist.currentAction?.type === 'rest' || colonist.currentAction?.type === 'socialize') return null

  colonist.lastBreakdownAt = nowMs
  const duration = BREAKDOWN_DURATION_TICKS_MIN +
    Math.floor(Math.random() * (BREAKDOWN_DURATION_TICKS_MAX - BREAKDOWN_DURATION_TICKS_MIN + 1))
  return duration
}

// ── Expertise Label ──

export function getExpertiseLabel(colonist: Colonist): string {
  if (colonist.specialization) {
    const labels: Record<Specialization, string> = {
      prospector: 'Prospector',
      mechanic: 'Mechanic',
      medic: 'Medic',
    }
    return labels[colonist.specialization]
  }

  const tracks: { key: XPTrack; label: string }[] = [
    { key: 'extractionXP', label: 'Extractor' },
    { key: 'engineeringXP', label: 'Engineer' },
    { key: 'medicalXP', label: 'Medic' },
  ]

  let best = tracks[0]
  for (const t of tracks) {
    if (colonist[t.key] > colonist[best.key]) best = t
  }

  if (colonist[best.key] === 0) return ''
  return `${best.label} Lv${xpLevel(colonist[best.key])}`
}
