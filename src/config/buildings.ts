import type { BuildingType } from '@/stores/gameStore'

export interface BuildingConfig {
  type: BuildingType
  label: string
  description: string
  zone: string
  constructionTime: number // seconds
  costMetals: number
  costIce: number
  shipmentCost: number | null // null = colony-built, not orderable from HQ
  shipmentWeight: number | null
  abbrevStat: string
}

export const BUILDING_CONFIGS: BuildingConfig[] = [
  {
    type: 'solar',
    label: 'Solar Panel',
    description: 'Generates power for the colony',
    zone: 'power',
    constructionTime: 45,
    costMetals: 15,
    costIce: 0,
    shipmentCost: 800,
    shipmentWeight: 18,
    abbrevStat: '+4 pwr',
  },
  {
    type: 'o2generator',
    label: 'O2 Generator',
    description: 'Produces breathable air',
    zone: 'lifeSup',
    constructionTime: 60,
    costMetals: 20,
    costIce: 5,
    shipmentCost: 1000,
    shipmentWeight: 32,
    abbrevStat: '+2 O2',
  },
  {
    type: 'extractionrig',
    label: 'Extraction Rig',
    description: 'Automated resource extraction',
    zone: 'extraction',
    constructionTime: 50,
    costMetals: 25,
    costIce: 0,
    shipmentCost: 1300,
    shipmentWeight: 55,
    abbrevStat: '+extract',
  },
  {
    type: 'medbay',
    label: 'Med Bay',
    description: 'Heals injured crew over time',
    zone: 'medical',
    constructionTime: 75,
    costMetals: 30,
    costIce: 10,
    shipmentCost: 1500,
    shipmentWeight: 40,
    abbrevStat: 'heals',
  },
  {
    type: 'partsfactory',
    label: 'Parts Factory',
    description: 'Produces repair kits (requires operator)',
    zone: 'workshop',
    constructionTime: 60,
    costMetals: 15,
    costIce: 0,
    shipmentCost: 800,
    shipmentWeight: 30,
    abbrevStat: '+repairs',
  },
  {
    type: 'storageSilo',
    label: 'Storage Silo',
    description: 'Increases resource storage capacity',
    zone: 'extraction',
    constructionTime: 20,
    costMetals: 20,
    costIce: 0,
    shipmentCost: 600,
    shipmentWeight: 20,
    abbrevStat: '+storage',
  },
  {
    type: 'launchplatform',
    label: 'Launch Platform',
    description: 'Export resources to HQ for credits',
    zone: 'landing',
    constructionTime: 90,
    costMetals: 30,
    costIce: 0,
    shipmentCost: 2000,
    shipmentWeight: 60,
    abbrevStat: 'exports',
  },
]

// Derived lookups
export const BUILDING_CONFIG_MAP: Record<string, BuildingConfig> = Object.fromEntries(
  BUILDING_CONFIGS.map(c => [c.type, c])
)

export function getBuildingConfig(type: BuildingType): BuildingConfig {
  return BUILDING_CONFIG_MAP[type] ?? BUILDING_CONFIGS[0]
}

export function getBuildingLabel(type: BuildingType): string {
  return BUILDING_CONFIG_MAP[type]?.label ?? type
}
