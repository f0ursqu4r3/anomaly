import type { Zone, PathEdge } from '@/types/map'
import type { Building, BuildingType } from '@/stores/gameStore'

// ── Zone Definitions ──

export const ZONES: Zone[] = [
  { id: 'habitat',  x: 50, y: 40, radius: 10, label: 'SEC-A HABITAT', color: '#4af', buildingTypes: [] },
  { id: 'power',    x: 30, y: 25, radius: 9,  label: 'SEC-B POWER',   color: '#f80', buildingTypes: ['solar'] },
  { id: 'lifeSup',  x: 70, y: 25, radius: 9,  label: 'SEC-C LIFESUP', color: '#0ff', buildingTypes: ['o2generator'] },
  { id: 'drill',    x: 50, y: 65, radius: 10, label: 'SEC-D DRILL',   color: '#0f8', buildingTypes: ['drillrig'] },
  { id: 'medical',  x: 75, y: 48, radius: 7,  label: 'SEC-E MED',     color: '#f44', buildingTypes: ['medbay'] },
  { id: 'workshop', x: 25, y: 70, radius: 8,  label: 'SEC-F WORKSHOP', color: '#fa0', buildingTypes: ['partsfactory'] },
  { id: 'landing',  x: 25, y: 50, radius: 7,  label: 'LZ-1',          color: '#f80', buildingTypes: [] },
]

export const ZONE_MAP: Record<string, Zone> = Object.fromEntries(ZONES.map(z => [z.id, z]))

export const ZONE_FOR_BUILDING: Record<BuildingType, string> = {
  solar: 'power',
  o2generator: 'lifeSup',
  drillrig: 'drill',
  medbay: 'medical',
  partsfactory: 'workshop',
}

// ── Path Graph ──

export const PATH_EDGES: PathEdge[] = [
  { from: 'habitat', to: 'power',   weight: 1 },
  { from: 'habitat', to: 'lifeSup', weight: 1 },
  { from: 'habitat', to: 'drill',   weight: 1 },
  { from: 'habitat', to: 'medical', weight: 1 },
  { from: 'habitat', to: 'landing',  weight: 1 },
  { from: 'habitat', to: 'workshop', weight: 1 },
  { from: 'power',   to: 'lifeSup', weight: 1.2 },
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

const MIN_BUILDING_DISTANCE = 3.5 // minimum % between buildings (tight enough to fit many)

export function getBuildingPosition(
  type: BuildingType,
  existingBuildings: Building[],
): { x: number; y: number; rotation: number } {
  const zoneId = ZONE_FOR_BUILDING[type]
  const zone = ZONE_MAP[zoneId]
  if (!zone) return { x: 50, y: 50, rotation: 0 }

  const sameZone = existingBuildings.filter(
    b => ZONE_FOR_BUILDING[b.type] === zoneId
  )

  if (sameZone.length === 0) {
    return { x: zone.x, y: zone.y, rotation: (Math.random() - 0.5) * 6 }
  }

  // Try random positions within zone radius
  for (let attempt = 0; attempt < 40; attempt++) {
    const angle = Math.random() * Math.PI * 2
    const dist = Math.random() * zone.radius * 0.85
    const x = zone.x + Math.cos(angle) * dist
    const y = zone.y + Math.sin(angle) * dist

    const tooClose = sameZone.some(b => {
      const dx = b.x - x
      const dy = b.y - y
      return Math.sqrt(dx * dx + dy * dy) < MIN_BUILDING_DISTANCE
    })

    if (!tooClose) {
      return { x, y, rotation: (Math.random() - 0.5) * 10 }
    }
  }

  // Fallback: evenly space around zone center, CLAMPED to zone radius
  const count = sameZone.length
  const angle = (count * 2.4) % (Math.PI * 2) // golden angle spread
  const ring = Math.min(zone.radius * 0.7, 3 + count * 1.5) // grows slowly, capped at zone radius
  return {
    x: zone.x + Math.cos(angle) * ring,
    y: zone.y + Math.sin(angle) * ring,
    rotation: (Math.random() - 0.5) * 10,
  }
}

export function getLandingPosition(): { x: number; y: number } {
  const zone = ZONE_MAP.landing
  const jitterX = (Math.random() - 0.5) * zone.radius
  const jitterY = (Math.random() - 0.5) * zone.radius
  return { x: zone.x + jitterX, y: zone.y + jitterY }
}
