import { ref, watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { Colonist } from '@/stores/gameStore'
import { ZONE_MAP } from '@/systems/mapLayout'
import type { ActionType } from '@/types/colonist'

export type VisualState = 'walking' | 'working' | 'resting' | 'socializing' | 'injured' | 'idle'

export interface ColonistMapState {
  colonistId: string
  x: number            // current visual position (what CSS reads)
  y: number
  targetX: number      // where we're heading
  targetY: number
  visualState: VisualState
  transitionMs: number // CSS transition duration for current move
  assignedDropId: string | null
  _settledAction: string | null // tracks what action we've committed to visually
  _arrivalTime: number          // timestamp when current walk completes
}

const WALK_SPEED = 3 // % of map per second — realistic walking pace
const UNPACK_WORK_TIME = 1500

function jitter(base: number, range: number): number {
  return base + (Math.random() - 0.5) * range
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function actionToVisualState(action: ActionType | null, colonist: Colonist): VisualState {
  if (!action) return 'idle'
  switch (action) {
    case 'rest': return 'resting'
    case 'socialize': return 'socializing'
    case 'seek_medical': return colonist.health < 40 ? 'injured' : 'walking'
    case 'wander': return 'idle'
    default: return 'working'
  }
}

/** Build a key that identifies the current action+target combo */
function actionKey(colonist: Colonist): string | null {
  const a = colonist.currentAction
  if (!a) return null
  return `${a.type}:${a.targetZone}:${a.targetId ?? ''}`
}

export function useColonistMovement() {
  const game = useGameStore()
  const positions = ref<Map<string, ColonistMapState>>(new Map())

  function getOrCreate(colonistId: string): ColonistMapState {
    let state = positions.value.get(colonistId)
    if (!state) {
      const zone = ZONE_MAP.habitat
      const startX = jitter(zone.x, 8)
      const startY = jitter(zone.y, 8)
      state = {
        colonistId,
        x: startX,
        y: startY,
        targetX: startX,
        targetY: startY,
        visualState: 'idle',
        transitionMs: 0,
        assignedDropId: null,
        _settledAction: null,
        _arrivalTime: 0,
      }
      positions.value.set(colonistId, state)
    }
    return state
  }

  function colonistsAtDrop(dropId: string): number {
    let count = 0
    for (const ms of positions.value.values()) {
      if (ms.assignedDropId === dropId) count++
    }
    return count
  }

  /** Start a walk from current position to target. CSS handles the animation. */
  function startWalk(ms: ColonistMapState, toX: number, toY: number) {
    const tx = clamp(toX, 5, 95)
    const ty = clamp(toY, 12, 92)
    const d = dist(ms.x, ms.y, tx, ty)
    if (d < 0.5) {
      // Already there
      ms.transitionMs = 0
      return
    }
    ms.targetX = tx
    ms.targetY = ty
    ms.transitionMs = (d / WALK_SPEED) * 1000
    ms._arrivalTime = Date.now() + ms.transitionMs
    // DON'T set ms.x/ms.y yet — CSS animates from current to target
    // We'll snap ms.x/ms.y to target when the walk completes
  }

  /** Snap ms.x/ms.y to the estimated current visual position (lerped along the walk) */
  function snapToCurrentVisualPos(ms: ColonistMapState) {
    if (ms._arrivalTime <= 0 || ms.transitionMs <= 0) return
    const now = Date.now()
    const elapsed = ms.transitionMs - (ms._arrivalTime - now)
    const t = clamp(elapsed / ms.transitionMs, 0, 1)
    ms.x = ms.x + (ms.targetX - ms.x) * t
    ms.y = ms.y + (ms.targetY - ms.y) * t
    ms.targetX = ms.x
    ms.targetY = ms.y
    ms._arrivalTime = 0
    ms.transitionMs = 0
  }

  /** Check if current walk animation is done, snap position if so */
  function checkArrival(ms: ColonistMapState): boolean {
    if (ms._arrivalTime > 0 && Date.now() >= ms._arrivalTime) {
      ms.x = ms.targetX
      ms.y = ms.targetY
      ms._arrivalTime = 0
      ms.transitionMs = 0
      return true
    }
    return ms._arrivalTime === 0
  }

  function update(_dtMs: number) {
    for (const colonist of game.colonists) {
      const ms = getOrCreate(colonist.id)

      if (colonist.health <= 0) {
        ms.visualState = 'idle'
        ms.transitionMs = 0
        ms.assignedDropId = null
        ms._settledAction = null
        continue
      }

      const action = colonist.currentAction

      // No action — idle at current position
      if (!action) {
        snapToCurrentVisualPos(ms)
        ms.visualState = 'idle'
        ms.assignedDropId = null
        ms._settledAction = null
        continue
      }

      // Walking between zones (action has walkPath with >1 entries)
      if (action.walkPath && action.walkPath.length > 1) {
        const nextZoneId = action.walkPath[1]
        const walkKey = `walk:${nextZoneId}`

        if (ms._settledAction !== walkKey) {
          // Snap to interpolated position if previous walk was in progress
          snapToCurrentVisualPos(ms)
          const nextZone = ZONE_MAP[nextZoneId]
          if (nextZone) {
            startWalk(ms, jitter(nextZone.x, 3), jitter(nextZone.y, 3))
          }
          ms._settledAction = walkKey
        } else {
          // Check if this walk segment finished
          if (checkArrival(ms)) {
            ms.transitionMs = 0
          }
        }

        ms.visualState = colonist.health < 40 ? 'injured' : 'walking'
        ms.assignedDropId = null
        continue
      }

      // At target zone — check if we need to walk to our work spot
      const currentKey = actionKey(colonist)
      const alreadySettled = ms._settledAction === currentKey

      if (!alreadySettled) {
        // New action — figure out where to go and walk there
        snapToCurrentVisualPos(ms) // snap to interpolated position if mid-walk

        const zone = ZONE_MAP[action.targetZone] || ZONE_MAP.habitat
        let targetX = zone.x
        let targetY = zone.y

        if (action.targetId) {
          if (action.type === 'unpack') {
            const drop = game.supplyDrops.find(d => d.id === action.targetId)
            if (drop) { targetX = drop.x; targetY = drop.y }
          } else {
            const building = game.buildings.find(b => b.id === action.targetId)
            if (building) { targetX = building.x; targetY = building.y }
          }
        }

        // Walk to the work spot (jittered)
        startWalk(ms, jitter(targetX, 4), jitter(targetY, 4))
        ms.visualState = 'walking'
        ms._settledAction = currentKey

        if (action.type === 'unpack' && action.targetId) {
          ms.assignedDropId = action.targetId
        } else {
          ms.assignedDropId = null
        }
      } else {
        // Already settled — check if we've arrived at our work spot
        const arrived = checkArrival(ms)
        if (arrived) {
          ms.visualState = actionToVisualState(action.type, colonist)
        } else {
          ms.visualState = 'walking'
        }
      }

      // Handle unpack progress (runs every tick while at drop)
      if (action.type === 'unpack' && action.targetId && checkArrival(ms)) {
        const drop = game.supplyDrops.find(d => d.id === action.targetId)
        if (drop && (drop.state === 'landed' || drop.state === 'unpacking')) {
          ms.assignedDropId = drop.id
          if (drop.state === 'landed') drop.state = 'unpacking'
          if (drop.state === 'unpacking') {
            const workers = colonistsAtDrop(drop.id)
            const rate = workers * Math.pow(0.8, workers - 1)
            drop.unpackProgress = Math.min(
              1,
              drop.unpackProgress + (UNPACK_WORK_TIME / drop.unpackDuration) * rate,
            )
            if (drop.unpackProgress >= 1) {
              game.applySupplyDrop(drop)
              drop.state = 'done'
              drop.landedAt = game.totalPlaytimeMs
              ms.assignedDropId = null
            }
          }
        }
      }
    }

    // Trigger reactivity
    positions.value = new Map(positions.value)
  }

  watch(
    () => game.lastTickAt,
    () => update(1000),
  )

  return { positions, getOrCreate }
}
