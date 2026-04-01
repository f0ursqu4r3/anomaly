export type Trait = 'hardy' | 'diligent' | 'social' | 'cautious' | 'efficient' | 'stoic'

export type ActionType =
  | 'extract'
  | 'engineer'
  | 'repair'
  | 'unpack'
  | 'rest'
  | 'socialize'
  | 'seek_medical'
  | 'wander'

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
