import type { Sector, TerrainType, TerrainConfig } from '@/types/moon'

// ── Terrain Definitions ──

export const TERRAIN_CONFIGS: Record<TerrainType, TerrainConfig> = {
  rocky: {
    type: 'rocky',
    label: 'Rocky Plains',
    color: '#8a8a7a',
    bgColor: '#1a1a16',
    depositTypes: ['metals'],
    surveyRiskBase: 0.05,
    description: 'Flat terrain with scattered boulders. Low risk, common metals.',
  },
  ice: {
    type: 'ice',
    label: 'Ice Flats',
    color: '#7ecfff',
    bgColor: '#0c1a22',
    depositTypes: ['ice', 'metals'],
    surveyRiskBase: 0.10,
    description: 'Smooth frozen plains. Ice deposits with some metals.',
  },
  volcanic: {
    type: 'volcanic',
    label: 'Volcanic Ridge',
    color: '#e94560',
    bgColor: '#1f0a0f',
    depositTypes: ['rareMinerals', 'metals'],
    surveyRiskBase: 0.25,
    description: 'Jagged volcanic terrain. Rare minerals, high risk.',
  },
  crater: {
    type: 'crater',
    label: 'Crater Basin',
    color: '#a0a0b0',
    bgColor: '#12121a',
    depositTypes: ['metals'],
    surveyRiskBase: 0.15,
    description: 'Deep impact craters. Rich metal deposits.',
  },
  canyon: {
    type: 'canyon',
    label: 'Canyon Network',
    color: '#c8a070',
    bgColor: '#1a150e',
    depositTypes: ['metals', 'ice'],
    surveyRiskBase: 0.20,
    description: 'Narrow canyon systems. Mixed deposits, moderate risk.',
  },
}

// ── Seeded PRNG (same as offlineEngine) ──

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Hex Grid Utilities ──
// Using axial coordinates (q, r). Center at (0, 0).

const HEX_DIRECTIONS: [number, number][] = [
  [1, 0], [1, -1], [0, -1],
  [-1, 0], [-1, 1], [0, 1],
]

function hexRing(center: [number, number], radius: number): [number, number][] {
  if (radius === 0) return [center]
  const results: [number, number][] = []
  let [q, r] = [center[0] + HEX_DIRECTIONS[4][0] * radius, center[1] + HEX_DIRECTIONS[4][1] * radius]
  for (let dir = 0; dir < 6; dir++) {
    for (let step = 0; step < radius; step++) {
      results.push([q, r])
      q += HEX_DIRECTIONS[dir][0]
      r += HEX_DIRECTIONS[dir][1]
    }
  }
  return results
}

function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2
}

// ── Terrain Assignment ──

const TERRAIN_WEIGHTS: { terrain: TerrainType; weight: number }[] = [
  { terrain: 'rocky', weight: 0.35 },
  { terrain: 'ice', weight: 0.25 },
  { terrain: 'crater', weight: 0.20 },
  { terrain: 'canyon', weight: 0.12 },
  { terrain: 'volcanic', weight: 0.08 },
]

function pickTerrain(rand: () => number): TerrainType {
  let roll = rand()
  for (const { terrain, weight } of TERRAIN_WEIGHTS) {
    roll -= weight
    if (roll <= 0) return terrain
  }
  return 'rocky'
}

// ── Public API ──

export const COLONY_SECTOR_ID = 'sector-0-0'

/**
 * Generate moon surface sectors. Ring 0 = colony (always rocky).
 * Rings 1-maxRing radiate outward with procedural terrain.
 * For medium lens, we generate rings 0-3 (37 sectors).
 */
export function generateSectors(seed: number, maxRing: number = 3): Sector[] {
  const rand = mulberry32(seed)
  const sectors: Sector[] = []

  for (let ring = 0; ring <= maxRing; ring++) {
    const coords = hexRing([0, 0], ring)
    for (const [q, r] of coords) {
      const id = `sector-${q}-${r}`
      const isColony = q === 0 && r === 0
      const terrain: TerrainType = isColony ? 'rocky' : pickTerrain(rand)
      // Ring 0 is surveyed (colony), ring 1 starts scanned, rest hidden
      const status = ring <= 1 ? 'scanned' : 'hidden'

      sectors.push({
        id,
        q,
        r,
        terrain,
        status: isColony ? 'surveyed' : status,
        deposit: null,
        scanSignature: null,
        outpostId: null,
      })
    }
  }

  return sectors
}

/**
 * Get sectors adjacent to a given sector.
 */
export function getAdjacentSectorIds(q: number, r: number): string[] {
  return HEX_DIRECTIONS.map(([dq, dr]) => `sector-${q + dq}-${r + dr}`)
}

/**
 * Calculate travel time in ms from colony to sector based on hex distance.
 */
export function travelTimeMs(q: number, r: number): number {
  const dist = hexDistance(0, 0, q, r)
  return dist * 15_000 // 15 seconds per hex
}

/**
 * Convert axial hex coords to pixel position for rendering.
 * Returns { x, y } as percentages (0-100) for the medium lens viewport.
 */
export function hexToPixel(q: number, r: number): { x: number; y: number } {
  const size = 10 // hex size in viewport %
  const x = 50 + size * (3 / 2 * q)
  const y = 50 + size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r)
  return { x, y }
}

export { hexDistance }
