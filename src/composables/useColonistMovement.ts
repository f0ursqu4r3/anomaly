import { ref, watch } from 'vue'
import { useGameStore, MAP_ZONES } from '@/stores/gameStore'

export interface ColonistMapState {
  colonistId: string
  x: number
  y: number
  targetX: number
  targetY: number
  state: 'walking' | 'working' | 'idle'
  stateTimer: number // ms remaining
  transitionMs: number
  assignedDropId: string | null // supply drop this colonist is heading to
}

const WALK_SPEED = 8
const WORK_DURATION_MIN = 3000
const WORK_DURATION_MAX = 8000
const IDLE_WANDER_RANGE = 6
const DROP_ARRIVAL_DIST = 4 // % distance to consider "at" the drop
const UNPACK_WORK_TIME = 1500 // how long colonist works at drop before re-checking

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function jitter(base: number, range: number): number {
  return base + (Math.random() - 0.5) * range
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

export function useColonistMovement() {
  const game = useGameStore()
  const positions = ref<Map<string, ColonistMapState>>(new Map())

  // Track how many colonists are assigned to each drop
  function colonistsAtDrop(dropId: string): number {
    let count = 0
    for (const ms of positions.value.values()) {
      if (ms.assignedDropId === dropId) count++
    }
    return count
  }

  function getOrCreate(colonistId: string): ColonistMapState {
    let state = positions.value.get(colonistId)
    if (!state) {
      const startX = jitter(MAP_ZONES.habitat.x, 10)
      const startY = jitter(MAP_ZONES.habitat.y, 10)
      state = {
        colonistId,
        x: startX,
        y: startY,
        targetX: startX,
        targetY: startY,
        state: 'idle',
        stateTimer: 500,
        transitionMs: 0,
        assignedDropId: null,
      }
      positions.value.set(colonistId, state)
    }
    return state
  }

  function findAvailableDrop(colonistId: string): { x: number; y: number; dropId: string } | null {
    const activeDrops = game.supplyDrops.filter(d => d.state === 'landed' || d.state === 'unpacking')
    if (activeDrops.length === 0) return null

    // Prefer drops with fewer colonists assigned
    const sorted = [...activeDrops].sort((a, b) => colonistsAtDrop(a.id) - colonistsAtDrop(b.id))
    const drop = sorted[0]

    return { x: jitter(drop.x, 3), y: jitter(drop.y, 3), dropId: drop.id }
  }

  function pickTarget(colonistId: string, ms: ColonistMapState): { x: number; y: number } {
    const colonist = game.colonists.find(c => c.id === colonistId)
    if (!colonist || colonist.health <= 0) {
      ms.assignedDropId = null
      return { x: MAP_ZONES.habitat.x, y: MAP_ZONES.habitat.y }
    }

    // Priority: supply drops need unpacking
    const dropTarget = findAvailableDrop(colonistId)
    if (dropTarget) {
      ms.assignedDropId = dropTarget.dropId
      return { x: dropTarget.x, y: dropTarget.y }
    }

    // Clear any stale drop assignment
    ms.assignedDropId = null

    const role = colonist.role

    if (role === 'driller') {
      const rigs = game.buildings.filter(b => b.type === 'drillrig' && !b.damaged)
      if (rigs.length > 0) {
        const rig = rigs[Math.floor(Math.random() * rigs.length)]
        return { x: jitter(rig.x, 6), y: jitter(rig.y, 6) }
      }
      return { x: jitter(MAP_ZONES.drillSite.x, 10), y: jitter(MAP_ZONES.drillSite.y, 8) }
    }

    if (role === 'engineer') {
      const buildings = game.buildings.filter(b => !b.damaged)
      if (buildings.length > 0) {
        const b = buildings[Math.floor(Math.random() * buildings.length)]
        return { x: jitter(b.x, 5), y: jitter(b.y, 5) }
      }
      return { x: jitter(MAP_ZONES.habitat.x, 12), y: jitter(MAP_ZONES.habitat.y, 12) }
    }

    return {
      x: jitter(MAP_ZONES.habitat.x, IDLE_WANDER_RANGE),
      y: jitter(MAP_ZONES.habitat.y, IDLE_WANDER_RANGE),
    }
  }

  function update(dtMs: number) {
    for (const colonist of game.colonists) {
      const ms = getOrCreate(colonist.id)

      if (colonist.health <= 0) {
        ms.state = 'idle'
        ms.transitionMs = 0
        ms.assignedDropId = null
        continue
      }

      ms.stateTimer -= dtMs
      if (ms.stateTimer > 0) continue

      if (ms.state === 'walking') {
        // Arrived at target
        ms.x = ms.targetX
        ms.y = ms.targetY

        // Check if we arrived at a supply drop
        if (ms.assignedDropId) {
          const drop = game.supplyDrops.find(d => d.id === ms.assignedDropId)
          if (drop && (drop.state === 'landed' || drop.state === 'unpacking')) {
            // Start unpacking
            if (drop.state === 'landed') {
              drop.state = 'unpacking'
            }
            // Advance unpack progress based on number of colonists here
            const workers = colonistsAtDrop(drop.id)
            const rate = workers * Math.pow(0.8, workers - 1)
            drop.unpackProgress = Math.min(1, drop.unpackProgress + (UNPACK_WORK_TIME / drop.unpackDuration) * rate)

            ms.state = 'working'
            ms.stateTimer = UNPACK_WORK_TIME
            ms.transitionMs = 0

            if (drop.unpackProgress >= 1 && drop.state === 'unpacking') {
              game.applySupplyDrop(drop)
              drop.state = 'done'
              drop.landedAt = game.totalPlaytimeMs // reset for linger timing
              ms.assignedDropId = null
            }
            continue
          } else {
            // Drop is gone or done
            ms.assignedDropId = null
          }
        }

        ms.state = 'working'
        ms.stateTimer = randRange(WORK_DURATION_MIN, WORK_DURATION_MAX)
        ms.transitionMs = 0
      } else {
        // Pick new target
        const target = pickTarget(colonist.id, ms)
        ms.targetX = clamp(target.x, 5, 95)
        ms.targetY = clamp(target.y, 12, 92)

        const d = dist(ms.x, ms.y, ms.targetX, ms.targetY)
        const walkTimeMs = (d / WALK_SPEED) * 1000

        ms.x = ms.targetX
        ms.y = ms.targetY
        ms.state = 'walking'
        ms.stateTimer = walkTimeMs
        ms.transitionMs = walkTimeMs
      }
    }

    // Trigger reactivity
    positions.value = new Map(positions.value)
  }

  function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v))
  }

  watch(() => game.lastTickAt, () => {
    update(1000)
  })

  return { positions, getOrCreate }
}
