import type { BuildingType } from '@/stores/gameStore'

export interface Zone {
  id: string
  x: number
  y: number
  radius: number
  label: string
  color: string
  buildingTypes: BuildingType[]
}

export interface PathEdge {
  from: string
  to: string
  weight: number
}
