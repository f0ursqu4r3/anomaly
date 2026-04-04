import type { Zone, PathEdge } from '@/types/map'
import type { Building, BuildingType } from '@/stores/gameStore'
import { BUILDING_CONFIGS } from '@/config/buildings'

// ── Zone Definitions ──

export const ZONES: Zone[] = [
  {
    id: 'habitat',
    x: 50,
    y: 40,
    radius: 10,
    label: 'SEC-A HABITAT',
    color: '#4af',
    buildingTypes: [],
  },
  {
    id: 'power',
    x: 30,
    y: 25,
    radius: 9,
    label: 'SEC-B POWER',
    color: '#f80',
    buildingTypes: ['solar'],
  },
  {
    id: 'lifeSup',
    x: 70,
    y: 25,
    radius: 9,
    label: 'SEC-C LIFESUP',
    color: '#0ff',
    buildingTypes: ['o2generator'],
  },
  {
    id: 'extraction',
    x: 50,
    y: 65,
    radius: 10,
    label: 'SEC-D EXTRACT',
    color: '#0f8',
    buildingTypes: ['extractionrig'],
  },
  {
    id: 'storage',
    x: 65,
    y: 75,
    radius: 7,
    label: 'SEC-E STORAGE',
    color: '#888',
    buildingTypes: ['storageSilo'],
  },
  {
    id: 'medical',
    x: 75,
    y: 48,
    radius: 7,
    label: 'SEC-F MED',
    color: '#f44',
    buildingTypes: ['medbay'],
  },
  {
    id: 'workshop',
    x: 25,
    y: 70,
    radius: 8,
    label: 'SEC-G WORKSHOP',
    color: '#fa0',
    buildingTypes: ['partsfactory'],
  },
  {
    id: 'landing',
    x: 25,
    y: 50,
    radius: 7,
    label: 'LZ-1',
    color: '#f80',
    buildingTypes: ['launchplatform'],
  },
]

export const ZONE_MAP: Record<string, Zone> = Object.fromEntries(ZONES.map((z) => [z.id, z]))

export const ZONE_FOR_BUILDING: Record<string, string> = Object.fromEntries(
  BUILDING_CONFIGS.map((c) => [c.type, c.zone]),
)

// ── Path Graph ──

export const PATH_EDGES: PathEdge[] = [
  { from: 'habitat', to: 'power', weight: 1 },
  { from: 'habitat', to: 'lifeSup', weight: 1 },
  { from: 'habitat', to: 'extraction', weight: 1 },
  { from: 'habitat', to: 'storage', weight: 1 },
  { from: 'extraction', to: 'storage', weight: 0.8 },
  { from: 'habitat', to: 'medical', weight: 1 },
  { from: 'habitat', to: 'landing', weight: 1 },
  { from: 'habitat', to: 'workshop', weight: 1 },
  { from: 'power', to: 'lifeSup', weight: 1.2 },
]

const adjacency: Record<string, { zone: string; weight: number }[]> = {}
for (const z of ZONES) adjacency[z.id] = []
for (const e of PATH_EDGES) {
  adjacency[e.from].push({ zone: e.to, weight: e.weight })
  adjacency[e.to].push({ zone: e.from, weight: e.weight })
}

export function findPath(from: string, to: string): string[] {
  if (from === to) return [from]
  const visited = new Set<string>([from])
  const queue: { zone: string; path: string[] }[] = [{ zone: from, path: [from] }]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const neighbor of adjacency[current.zone] || []) {
      if (neighbor.zone === to) return [...current.path, to]
      if (!visited.has(neighbor.zone)) {
        visited.add(neighbor.zone)
        queue.push({ zone: neighbor.zone, path: [...current.path, neighbor.zone] })
      }
    }
  }
  return [from, to]
}

// ── Organic Building Placement ──

const ANCHOR_OFFSET = 6 // distance from anchor building
const MIN_BUILDING_DISTANCE = 5.5

export function getBuildingPosition(
  type: BuildingType,
  existingBuildings: Building[],
): { x: number; y: number; rotation: number } {
  const zoneId = ZONE_FOR_BUILDING[type]
  const zone = ZONE_MAP[zoneId]
  if (!zone) return { x: 50, y: 50, rotation: 0 }

  const sameZone = existingBuildings.filter((b) => ZONE_FOR_BUILDING[b.type] === zoneId)

  // Check clearance against ALL buildings, not just same zone
  function clearOfAll(x: number, y: number): boolean {
    return !existingBuildings.some((b) => {
      const dx = b.x - x
      const dy = b.y - y
      return Math.sqrt(dx * dx + dy * dy) < MIN_BUILDING_DISTANCE
    })
  }

  // First building: near zone center with slight offset
  if (sameZone.length === 0) {
    const jitter = 2
    const x = zone.x + (Math.random() - 0.5) * jitter
    const y = zone.y + (Math.random() - 0.5) * jitter
    if (clearOfAll(x, y)) {
      return { x, y, rotation: (Math.random() - 0.5) * 6 }
    }
  }

  // Cluster growth: anchor to a random existing building in same zone
  for (let attempt = 0; attempt < 40; attempt++) {
    const anchor =
      sameZone.length > 0
        ? sameZone[Math.floor(Math.random() * sameZone.length)]
        : { x: zone.x, y: zone.y }
    const angle = Math.random() * Math.PI * 2
    const x = anchor.x + Math.cos(angle) * ANCHOR_OFFSET
    const y = anchor.y + Math.sin(angle) * ANCHOR_OFFSET

    // Allow spreading beyond zone radius for tight zones
    const dx = x - zone.x
    const dy = y - zone.y
    if (Math.sqrt(dx * dx + dy * dy) > zone.radius * 1.5) continue

    if (!clearOfAll(x, y)) continue

    return { x, y, rotation: (Math.random() - 0.5) * 10 }
  }

  // Fallback: golden angle spiral with wider spread
  const count = sameZone.length + 1
  const angle = (count * 2.4) % (Math.PI * 2)
  const ring = Math.min(zone.radius * 1.2, 4 + count * 2)
  return {
    x: zone.x + Math.cos(angle) * ring,
    y: zone.y + Math.sin(angle) * ring,
    rotation: (Math.random() - 0.5) * 10,
  }
}

export function getLandingPosition(avoid: { x: number; y: number }[] = []): {
  x: number
  y: number
} {
  const zone = ZONE_MAP.landing
  const minDist = 7
  const spread = zone.radius * 1.8

  for (let attempt = 0; attempt < 30; attempt++) {
    const x = zone.x + (Math.random() - 0.5) * spread
    const y = zone.y + (Math.random() - 0.5) * spread
    const tooClose = avoid.some((a) => {
      const dx = a.x - x
      const dy = a.y - y
      return Math.sqrt(dx * dx + dy * dy) < minDist
    })
    if (!tooClose) return { x, y }
  }

  // Fallback: place below the zone
  return {
    x: zone.x + (Math.random() - 0.5) * 4,
    y: zone.y + zone.radius + 3,
  }
}
