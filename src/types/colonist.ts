export type Trait = 'hardy' | 'diligent' | 'social' | 'cautious' | 'efficient' | 'stoic'

export type SkillTrait =
  | 'steadyHands'
  | 'geologist'
  | 'pathfinder'
  | 'fieldMedic'
  | 'claustrophobic'
  | 'ironStomach'
  | 'tinkerer'
  | 'nightOwl'

export type Specialization = 'prospector' | 'mechanic' | 'medic'

export type XPTrack = 'extractionXP' | 'engineeringXP' | 'medicalXP'

export type ActionType =
  | 'extract'
  | 'engineer'
  | 'repair'
  | 'unpack'
  | 'rest'
  | 'socialize'
  | 'seek_medical'
  | 'wander'
  | 'load'

export interface Action {
  type: ActionType
  targetZone: string
  targetId?: string
  remainingTicks: number
  walkPath?: string[]
}

export const TRAITS: Trait[] = ['hardy', 'diligent', 'social', 'cautious', 'efficient', 'stoic']

export function randomTrait(): Trait {
  return TRAITS[Math.floor(Math.random() * TRAITS.length)]
}

export const SKILL_TRAITS: SkillTrait[] = [
  'steadyHands', 'geologist', 'pathfinder', 'fieldMedic',
  'ironStomach', 'tinkerer', 'nightOwl',
]

const NEGATIVE_SKILL_TRAITS: SkillTrait[] = ['claustrophobic']

export function randomSkillTrait(): SkillTrait {
  // 15% chance of negative trait
  if (Math.random() < 0.15 && NEGATIVE_SKILL_TRAITS.length > 0) {
    return NEGATIVE_SKILL_TRAITS[Math.floor(Math.random() * NEGATIVE_SKILL_TRAITS.length)]
  }
  return SKILL_TRAITS[Math.floor(Math.random() * SKILL_TRAITS.length)]
}

export const SKILL_TRAIT_LABELS: Record<SkillTrait, string> = {
  steadyHands: 'Steady Hands',
  geologist: 'Geologist',
  pathfinder: 'Pathfinder',
  fieldMedic: 'Field Medic',
  claustrophobic: 'Claustrophobic',
  ironStomach: 'Iron Stomach',
  tinkerer: 'Tinkerer',
  nightOwl: 'Night Owl',
}

export const SPECIALIZATION_LABELS: Record<Specialization, string> = {
  prospector: 'Prospector',
  mechanic: 'Mechanic',
  medic: 'Medic',
}

export const XP_THRESHOLDS = [0, 10, 25, 50, 100] as const

export function xpLevel(xp: number): number {
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) return i + 1
  }
  return 1
}
