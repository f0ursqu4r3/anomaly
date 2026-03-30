import type { Colonist } from '@/stores/gameStore'
import type { ActionType } from '@/types/colonist'
import { ZONE_MAP } from '@/systems/mapLayout'

/**
 * Radio chatter system — generates organic colonist communications
 * based on state transitions. Called each tick from the game loop.
 *
 * Tracks previous action per colonist to detect transitions.
 */

// Track previous state per colonist to detect changes
const prevActions = new Map<string, { type: ActionType; targetId?: string } | null>()

// Throttle: don't spam messages. Track last message time per colonist
const lastMessageAt = new Map<string, number>()
const MIN_MESSAGE_GAP_MS = 8_000 // at least 8s between messages from same colonist

// Global chatter cooldown — at most one chatter message per N ms
let lastChatterAt = 0
const MIN_CHATTER_GAP_MS = 3_000 // at most one chatter every 3s

type MessageEmitter = (text: string, severity: 'info' | 'event') => void

// ── Message Templates ──

const CHECKIN_DRILL: string[] = [
  '{name}: On site at the drill. Starting shift.',
  '{name} checking in — drill rig looks good.',
  '{name}: At the dig. Let\'s see what we find.',
  '{name} here. Resuming drill ops.',
  '{name}: Back at it. Drill running smooth.',
]

const CHECKIN_ENGINEER: string[] = [
  '{name}: Running diagnostics on {zone}.',
  '{name} checking in at {zone}. Systems nominal.',
  '{name}: On {zone} duty. Keeping the lights on.',
  '{name} here. Monitoring {zone} output.',
  '{name}: {zone} station — all readings stable.',
]

const CHECKIN_REPAIR: string[] = [
  '{name}: I see the damage. Starting repairs.',
  '{name} on it — patching up the {building}.',
  '{name}: Got my tools. Fixing the {building} now.',
  '{name} here. {building} took a hit, I\'ll sort it.',
]

const REPAIR_DONE: string[] = [
  '{name}: {building} is back online.',
  '{name}: Repairs complete on the {building}. Good as new.',
  '{name} here — {building} patched up and operational.',
]

const CHECKIN_UNPACK: string[] = [
  '{name}: Supply drop spotted. Heading to LZ.',
  '{name}: On my way to unpack the shipment.',
  '{name} here. I\'ll get that crate open.',
]

const UNPACK_ASSIST: string[] = [
  '{name}: {other} could use a hand at the LZ.',
  '{name}: Heavy crate — heading over to help {other}.',
]

const REST_START: string[] = [
  '{name}: Taking five. Need to recharge.',
  '{name}: Heading to hab for a rest.',
  '{name} here — running on fumes. Break time.',
  '{name}: Clocking out for a bit.',
]

const SOCIAL_START: string[] = [
  '{name}: Anyone at hab? Could use some company.',
  '{name}: Taking a breather with the crew.',
  '{name}: Good to see a friendly face.',
]

const MEDICAL_START: string[] = [
  '{name}: Not feeling great. Heading to med bay.',
  '{name}: Need to get checked out. On my way to med.',
  '{name} here — could use some patching up.',
]

const WORK_CHATTER_DRILL: string[] = [
  '{name}: Interesting formations down here.',
  '{name}: Depth\'s looking good. Steady progress.',
  '{name}: Found some ice deposits. Nice.',
  '{name}: Drill\'s humming along.',
]

const WORK_CHATTER_ENGINEER: string[] = [
  '{name}: Output holding steady at {zone}.',
  '{name}: Tweaked the efficiency a bit. Looking better.',
  '{name}: All green on {zone} monitors.',
]

const LOW_ENERGY: string[] = [
  '{name}: Getting tired... might need a break soon.',
  '{name}: Running low on steam here.',
]

const LOW_MORALE: string[] = [
  '{name}: Could really use some downtime.',
  '{name}: Starting to feel the grind.',
]

// ── Helpers ──

function pick(templates: string[]): string {
  return templates[Math.floor(Math.random() * templates.length)]
}

function fill(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, val] of Object.entries(vars)) {
    result = result.split(`{${key}}`).join(val)
  }
  return result
}

function zoneName(zoneId: string): string {
  const z = ZONE_MAP[zoneId]
  if (!z) return zoneId
  // Return short readable name
  switch (zoneId) {
    case 'power': return 'power grid'
    case 'lifeSup': return 'life support'
    case 'drill': return 'drill site'
    case 'medical': return 'med bay'
    case 'habitat': return 'hab'
    case 'landing': return 'the LZ'
    default: return zoneId
  }
}

function canMessage(colonistId: string, now: number): boolean {
  const last = lastMessageAt.get(colonistId) ?? 0
  if (now - last < MIN_MESSAGE_GAP_MS) return false
  if (now - lastChatterAt < MIN_CHATTER_GAP_MS) return false
  return true
}

function emitMessage(colonistId: string, now: number, emit: MessageEmitter, text: string, severity: 'info' | 'event' = 'info') {
  lastMessageAt.set(colonistId, now)
  lastChatterAt = now
  emit(text, severity)
}

// ── Main Tick ──

export function generateChatter(
  colonists: Colonist[],
  allColonists: Colonist[],
  buildingLabel: (id: string) => string,
  emit: MessageEmitter,
  now: number,
) {
  for (const c of colonists) {
    if (c.health <= 0) continue

    const prev = prevActions.get(c.id) ?? null
    const curr = c.currentAction
    const prevType = prev?.type ?? null
    const currType = curr?.type ?? null

    // Detect transition: action changed
    const actionChanged = prevType !== currType || prev?.targetId !== curr?.targetId

    if (actionChanged && canMessage(c.id, now)) {
      // ── Arrival / Start messages ──
      if (currType === 'drill' && prevType !== 'drill') {
        emitMessage(c.id, now, emit, fill(pick(CHECKIN_DRILL), { name: c.name }))
      } else if (currType === 'engineer') {
        const zone = curr!.targetZone
        emitMessage(c.id, now, emit, fill(pick(CHECKIN_ENGINEER), { name: c.name, zone: zoneName(zone) }))
      } else if (currType === 'repair' && curr?.targetId) {
        emitMessage(c.id, now, emit, fill(pick(CHECKIN_REPAIR), {
          name: c.name,
          building: buildingLabel(curr.targetId),
        }))
      } else if (currType === 'unpack') {
        // Check if someone else is already unpacking — if so, it's an assist
        const otherUnpacker = allColonists.find(
          o => o.id !== c.id && o.currentAction?.type === 'unpack'
        )
        if (otherUnpacker) {
          emitMessage(c.id, now, emit, fill(pick(UNPACK_ASSIST), {
            name: c.name,
            other: otherUnpacker.name,
          }))
        } else {
          emitMessage(c.id, now, emit, fill(pick(CHECKIN_UNPACK), { name: c.name }))
        }
      } else if (currType === 'rest' && prevType !== 'rest' && prevType !== null) {
        emitMessage(c.id, now, emit, fill(pick(REST_START), { name: c.name }))
      } else if (currType === 'socialize') {
        emitMessage(c.id, now, emit, fill(pick(SOCIAL_START), { name: c.name }))
      } else if (currType === 'seek_medical') {
        emitMessage(c.id, now, emit, fill(pick(MEDICAL_START), { name: c.name }))
      }

      // ── Completion messages ──
      if (prevType === 'repair' && prev?.targetId && currType !== 'repair') {
        // Repair just finished
        emitMessage(c.id, now, emit, fill(pick(REPAIR_DONE), {
          name: c.name,
          building: buildingLabel(prev.targetId),
        }), 'event')
      }
    }

    // ── Mid-work chatter (random, low frequency) ──
    if (!actionChanged && curr && !curr.walkPath?.length && canMessage(c.id, now)) {
      const chatterChance = 0.02 // 2% per tick = roughly every 50s
      if (Math.random() < chatterChance) {
        if (currType === 'drill') {
          emitMessage(c.id, now, emit, fill(pick(WORK_CHATTER_DRILL), { name: c.name }))
        } else if (currType === 'engineer') {
          emitMessage(c.id, now, emit, fill(pick(WORK_CHATTER_ENGINEER), {
            name: c.name,
            zone: zoneName(curr.targetZone),
          }))
        }
      }
    }

    // ── Low needs warnings (rare) ──
    if (!actionChanged && canMessage(c.id, now)) {
      if (c.energy < 25 && c.energy > 15 && Math.random() < 0.03) {
        emitMessage(c.id, now, emit, fill(pick(LOW_ENERGY), { name: c.name }))
      }
      if (c.morale < 20 && c.morale > 10 && Math.random() < 0.03) {
        emitMessage(c.id, now, emit, fill(pick(LOW_MORALE), { name: c.name }))
      }
    }

    // Update tracking
    prevActions.set(c.id, curr ? { type: curr.type, targetId: curr.targetId } : null)
  }
}
