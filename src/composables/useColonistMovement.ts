import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useMoonStore } from '@/stores/moonStore'
import type { Colonist } from '@/stores/gameStore'
import { ZONE_MAP } from '@/systems/mapLayout'
import type { ActionType } from '@/types/colonist'

export type VisualState = 'walking' | 'working' | 'resting' | 'socializing' | 'injured' | 'idle'

export interface ColonistMapState {
  colonistId: string
  x: number            // current interpolated position (what renders)
  y: number
  targetX: number      // where we're heading
  targetY: number
  visualState: VisualState
  assignedDropId: string | null
  _settledAction: string | null
  _walkStartX: number  // origin of current walk
  _walkStartY: number
  _walkStartTime: number
  _walkDuration: number // ms
}

const WALK_SPEED = 3 // % of map per second

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
    case 'load': return 'working'
    case 'construct': return 'working'
    default: return 'working'
  }
}

function actionKey(colonist: Colonist): string | null {
  const a = colonist.currentAction
  if (!a) return null
  return `${a.type}:${a.targetZone}:${a.targetId ?? ''}`
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function useColonistMovement() {
  const game = useGameStore()
  const positions = ref<Map<string, ColonistMapState>>(new Map())
  let rafId = 0

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
        assignedDropId: null,
        _settledAction: null,
        _walkStartX: startX,
        _walkStartY: startY,
        _walkStartTime: 0,
        _walkDuration: 0,
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

  function startWalk(ms: ColonistMapState, toX: number, toY: number) {
    const tx = clamp(toX, 5, 95)
    const ty = clamp(toY, 12, 92)
    const d = dist(ms.x, ms.y, tx, ty)
    if (d < 0.5) {
      ms._walkDuration = 0
      return
    }
    ms._walkStartX = ms.x
    ms._walkStartY = ms.y
    ms.targetX = tx
    ms.targetY = ty
    ms._walkDuration = (d / WALK_SPEED) * 1000
    ms._walkStartTime = Date.now()
  }

  function isWalking(ms: ColonistMapState): boolean {
    return ms._walkDuration > 0 && Date.now() < ms._walkStartTime + ms._walkDuration
  }

  function checkArrival(ms: ColonistMapState): boolean {
    if (ms._walkDuration > 0 && Date.now() >= ms._walkStartTime + ms._walkDuration) {
      ms.x = ms.targetX
      ms.y = ms.targetY
      ms._walkDuration = 0
      return true
    }
    return ms._walkDuration === 0
  }

  function snapToCurrentPos(ms: ColonistMapState) {
    if (ms._walkDuration <= 0) return
    const now = Date.now()
    const elapsed = now - ms._walkStartTime
    const t = clamp(elapsed / ms._walkDuration, 0, 1)
    ms.x = lerp(ms._walkStartX, ms.targetX, t)
    ms.y = lerp(ms._walkStartY, ms.targetY, t)
    ms.targetX = ms.x
    ms.targetY = ms.y
    ms._walkDuration = 0
  }

  /** rAF loop — interpolate x/y each frame */
  function animationFrame() {
    const now = Date.now()
    let changed = false

    for (const ms of positions.value.values()) {
      if (ms._walkDuration <= 0) continue
      const elapsed = now - ms._walkStartTime
      const t = clamp(elapsed / ms._walkDuration, 0, 1)
      const newX = lerp(ms._walkStartX, ms.targetX, t)
      const newY = lerp(ms._walkStartY, ms.targetY, t)
      if (newX !== ms.x || newY !== ms.y) {
        ms.x = newX
        ms.y = newY
        changed = true
      }
      if (t >= 1) {
        ms._walkDuration = 0
        changed = true
      }
    }

    if (changed) {
      positions.value = new Map(positions.value)
    }

    rafId = requestAnimationFrame(animationFrame)
  }

  const UNPACK_WORK_TIME = 1500

  function update(_dtMs: number) {
    const moonStore = useMoonStore()
    const awayIds = moonStore.awayColonistIds

    for (const colonist of game.colonists) {
      if (awayIds.has(colonist.id)) {
        positions.value.delete(colonist.id)
        continue
      }

      const ms = getOrCreate(colonist.id)

      if (colonist.health <= 0) {
        ms.visualState = 'idle'
        ms._walkDuration = 0
        ms.assignedDropId = null
        ms._settledAction = null
        continue
      }

      const action = colonist.currentAction

      if (!action) {
        snapToCurrentPos(ms)
        ms.visualState = 'idle'
        ms.assignedDropId = null
        ms._settledAction = null
        continue
      }

      // Walking between zones
      if (action.walkPath && action.walkPath.length > 1) {
        const nextZoneId = action.walkPath[1]
        const walkKey = `walk:${nextZoneId}`

        if (ms._settledAction !== walkKey) {
          snapToCurrentPos(ms)
          const nextZone = ZONE_MAP[nextZoneId]
          if (nextZone) {
            startWalk(ms, jitter(nextZone.x, 3), jitter(nextZone.y, 3))
          }
          ms._settledAction = walkKey
        } else {
          checkArrival(ms)
        }

        ms.visualState = colonist.health < 40 ? 'injured' : 'walking'
        ms.assignedDropId = null
        continue
      }

      // At target zone
      const currentKey = actionKey(colonist)
      const alreadySettled = ms._settledAction === currentKey

      if (!alreadySettled) {
        snapToCurrentPos(ms)

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

        const jitterRange = action.targetId ? 1.5 : 4
        startWalk(ms, jitter(targetX, jitterRange), jitter(targetY, jitterRange))
        ms.visualState = 'walking'
        ms._settledAction = currentKey

        if (action.type === 'unpack' && action.targetId) {
          ms.assignedDropId = action.targetId
        } else {
          ms.assignedDropId = null
        }
      } else {
        const arrived = checkArrival(ms)
        if (arrived) {
          ms.visualState = actionToVisualState(action.type, colonist)
        } else {
          ms.visualState = 'walking'
        }
      }

      // Unpack progress
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

    // Trigger reactivity for tick-based updates
    positions.value = new Map(positions.value)
  }

  watch(
    () => game.lastTickAt,
    () => update(1000),
  )

  onMounted(() => {
    rafId = requestAnimationFrame(animationFrame)
  })

  onUnmounted(() => {
    cancelAnimationFrame(rafId)
  })

  return { positions, getOrCreate }
}
