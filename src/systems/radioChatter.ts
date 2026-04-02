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

const CHECKIN_EXTRACT: string[] = [
  '{name}: On site at the extractor. Starting shift.',
  '{name} checking in — extraction rig looks good.',
  '{name}: At the dig. Let\'s see what we find.',
  '{name} here. Resuming extraction ops.',
  '{name}: Back at it. Rig running smooth.',
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

const WORK_CHATTER_EXTRACT: string[] = [
  '{name}: Interesting formations out here.',
  '{name}: Yield\'s looking good. Steady progress.',
  '{name}: Found some ice deposits. Nice.',
  '{name}: Rig\'s humming along.',
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

const BREAKDOWN: string[] = [
  '{name}: I can\'t keep going. Need to stop.',
  '{name}: ...I just need a minute. Please.',
  '{name}: Everything\'s too much right now.',
]

const DEATH_GRIEF: string[] = [
  '{name}: ...I can\'t believe {dead} is gone.',
  '{name}: {dead}... no. Not like this.',
  '{name}: We lost {dead}. I don\'t... I can\'t...',
]

const DEATH_BOND_GRIEF: string[] = [
  '{name}: {dead} and I... we had a good thing going.',
  '{name}: I keep looking for {dead} at the station. They\'re not coming back.',
  '{name}: {dead} was the only one who made this place bearable.',
]

const HIGH_MORALE: string[] = [
  '{name}: Feeling sharp today. Let\'s get it done.',
  '{name}: Good shift. Crew\'s solid.',
  '{name}: You know what, I think we\'re gonna be alright.',
]

const BOND_FORMED: string[] = [
  '{name} and {other} seem to have each other\'s rhythm down.',
  '{name} and {other} make a good team.',
]

const BOND_WORKING: string[] = [
  '{name}: Good to have {other} on shift.',
  '{name}: Working with {other} — always better.',
]

const SPECIALIZATION_UNLOCK: string[] = [
  '{name} has earned the rank of {spec}.',
]

const LOADING_START: string[] = [
  '{name}: Hauling cargo to the platform.',
  '{name}: Loading up the export platform.',
  '{name}: Moving materials to the LZ.',
]

const STORAGE_FULL: string[] = [
  '{name}: Storage full — we\'re losing metals out here.',
  '{name}: No room for more. We need another silo.',
  '{name}: Overflow — materials going to waste.',
]

const CONSTRUCT_START: string[] = [
  '{name}: Starting work on the new structure.',
  '{name}: Got the blueprints. Let\'s build.',
  '{name}: Assembling the prefab. This\'ll take a bit.',
]

export { BREAKDOWN, DEATH_GRIEF, DEATH_BOND_GRIEF, BOND_FORMED, SPECIALIZATION_UNLOCK, STORAGE_FULL }

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
    case 'extraction': return 'extraction site'
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
  chatterEnabled: boolean = true,
) {
  if (!chatterEnabled) return
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
      if (currType === 'extract' && prevType !== 'extract') {
        emitMessage(c.id, now, emit, fill(pick(CHECKIN_EXTRACT), { name: c.name }))
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
      } else if (currType === 'load') {
        emitMessage(c.id, now, emit, fill(pick(LOADING_START), { name: c.name }))
      } else if (currType === 'construct') {
        emitMessage(c.id, now, emit, fill(pick(CONSTRUCT_START), { name: c.name }))
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
        if (currType === 'extract') {
          emitMessage(c.id, now, emit, fill(pick(WORK_CHATTER_EXTRACT), { name: c.name }))
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

    // ── High morale chatter (rare) ──
    if (!actionChanged && canMessage(c.id, now)) {
      if (c.morale > 85 && Math.random() < 0.015) {
        emitMessage(c.id, now, emit, fill(pick(HIGH_MORALE), { name: c.name }))
      }
    }

    // ── Bond working chatter ──
    if (!actionChanged && curr && !curr.walkPath?.length && canMessage(c.id, now)) {
      if (Math.random() < 0.01) {
        // Check if bonded partner is in same zone
        const bondPartner = allColonists.find(o =>
          o.id !== c.id && o.health > 0 &&
          o.currentZone === c.currentZone &&
          c.bonds[o.id] >= 20
        )
        if (bondPartner) {
          emitMessage(c.id, now, emit, fill(pick(BOND_WORKING), {
            name: c.name,
            other: bondPartner.name,
          }))
        }
      }
    }

    // Update tracking
    prevActions.set(c.id, curr ? { type: curr.type, targetId: curr.targetId } : null)
  }
}
