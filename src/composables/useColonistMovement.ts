import { ref, watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { Colonist } from '@/stores/gameStore'
import { ZONE_MAP } from '@/systems/mapLayout'
import type { ActionType } from '@/types/colonist'

export type VisualState = 'walking' | 'working' | 'resting' | 'socializing' | 'injured' | 'idle'

export interface ColonistMapState {
  colonistId: string
  x: number
  y: number
  targetX: number
  targetY: number
  visualState: VisualState
  transitionMs: number
  assignedDropId: string | null
}

const WALK_SPEED = 8
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

  function update(_dtMs: number) {
    for (const colonist of game.colonists) {
      const ms = getOrCreate(colonist.id)

      if (colonist.health <= 0) {
        ms.visualState = 'idle'
        ms.transitionMs = 0
        ms.assignedDropId = null
        continue
      }

      const action = colonist.currentAction

      // No action — idle at current position
      if (!action) {
        ms.visualState = 'idle'
        ms.transitionMs = 0
        ms.assignedDropId = null
        continue
      }

      // Walking between zones (action has walkPath with >1 entries)
      if (action.walkPath && action.walkPath.length > 1) {
        const nextZoneId = action.walkPath[1]
        const nextZone = ZONE_MAP[nextZoneId]
        if (nextZone) {
          const tx = clamp(jitter(nextZone.x, 3), 5, 95)
          const ty = clamp(jitter(nextZone.y, 3), 12, 92)
          const d = dist(ms.x, ms.y, tx, ty) || 10
          ms.targetX = tx
          ms.targetY = ty
          ms.x = tx
          ms.y = ty
          ms.transitionMs = (d / WALK_SPEED) * 1000
        }
        ms.visualState = colonist.health < 40 ? 'injured' : 'walking'
        ms.assignedDropId = null
        continue
      }

      // At target zone, doing the action
      const zone = ZONE_MAP[action.targetZone] || ZONE_MAP.habitat

      // Find specific target (building or drop)
      let targetX = zone.x
      let targetY = zone.y

      if (action.targetId) {
        if (action.type === 'unpack') {
          const drop = game.supplyDrops.find(d => d.id === action.targetId)
          if (drop) {
            targetX = drop.x
            targetY = drop.y
            ms.assignedDropId = drop.id

            // Advance unpack progress
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
        } else {
          const building = game.buildings.find(b => b.id === action.targetId)
          if (building) {
            targetX = building.x
            targetY = building.y
          }
        }
      }

      // Add jitter around target
      const jx = clamp(jitter(targetX, 4), 5, 95)
      const jy = clamp(jitter(targetY, 4), 12, 92)

      // Move to target position if far enough away
      const d = dist(ms.x, ms.y, jx, jy)
      if (d > 2) {
        ms.targetX = jx
        ms.targetY = jy
        ms.x = jx
        ms.y = jy
        ms.transitionMs = (d / WALK_SPEED) * 1000
        ms.visualState = 'walking'
        continue
      }

      ms.x = jx
      ms.y = jy
      ms.targetX = jx
      ms.targetY = jy
      ms.transitionMs = 0
      ms.visualState = actionToVisualState(action.type, colonist)
      if (action.type !== 'unpack') ms.assignedDropId = null
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
