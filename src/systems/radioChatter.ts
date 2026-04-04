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
  '{name}: {name} checking in — extraction rig looks good.',
  "{name}: At the dig. Let's see what we find.",
  '{name}: {name} here. Resuming extraction ops.',
  '{name}: Back at it. Rig running smooth.',
  '{name}: Boots on regolith. Rig looks primed.',
  '{name}: At the bore head. Spinning up.',
  "{name}: Drill's warm. Let's go deep.",
  '{name}: Extraction station. Clocking in.',
  '{name}: Good vibrations from the rig today. Starting up.',
  '{name}: Down in the trench. Ready to pull.',
  "{name}: Picking up where last shift left off. Let's go.",
]

const CHECKIN_ENGINEER: string[] = [
  '{name}: Running diagnostics on {zone}.',
  '{name} checking in at {zone}. Systems nominal.',
  '{name}: On {zone} duty. Keeping the lights on.',
  '{name} here. Monitoring {zone} output.',
  '{name}: {zone} station — all readings stable.',
  '{name}: Eyes on {zone}. Looks clean so far.',
  '{name}: At {zone}. Running baseline checks.',
  '{name}: {zone} boards are green. Holding steady.',
  '{name}: Rotating to {zone}. Taking over the watch.',
  "{name}: {zone} panel's humming. I'll babysit it.",
  '{name}: Settling in at {zone}. Coffee would be nice.',
  '{name}: {zone} duty. Not glamorous, but someone has to.',
]

const CHECKIN_REPAIR: string[] = [
  '{name}: I see the damage. Starting repairs.',
  "{name}: I'm on it — patching up the {building}.",
  '{name}: Got my tools. Fixing the {building} now.',
  "{name}: {name} here. {building} took a hit, I'll sort it.",
  '{name}: {building} is in rough shape. Working on it.',
  "{name}: This won't fix itself. On the {building}.",
  '{name}: Damage report on {building} — not great. Starting now.',
  '{name}: Pulling panels on the {building}. Gonna be a minute.',
  "{name}: {building}'s leaking power. I see the fault line.",
]

const REPAIR_DONE: string[] = [
  '{name}: {building} is back online.',
  '{name}: Repairs complete on the {building}. Good as new.',
  '{name}: {name} here — {building} patched up and operational.',
  '{name}: {building} sealed and running. We got lucky.',
  '{name}: Done with {building}. Should hold... for now.',
  "{name}: {building}'s fixed. Wasn't pretty, but it works.",
  '{name}: Wrapped up {building} repairs. Back in the green.',
]

const CHECKIN_UNPACK: string[] = [
  '{name}: Supply drop spotted. Heading to LZ.',
  '{name}: On my way to unpack the shipment.',
  "{name}: {name} here. I'll get that crate open.",
  '{name}: Crate on the ground. Moving to unpack.',
  "{name}: Shipment's here. About time.",
  '{name}: New delivery. Hope it is something useful.',
  "{name}: Let's see what HQ sent us this time.",
  '{name}: Supply pod down. On my way.',
]

const UNPACK_ASSIST: string[] = [
  '{name}: {other} could use a hand at the LZ.',
  '{name}: Heavy crate — heading over to help {other}.',
  "{name}: {other}'s got their hands full. On my way.",
  '{name}: Two pairs of hands beats one. Coming, {other}.',
  '{name}: Backup on the way, {other}.',
]

const REST_START: string[] = [
  '{name}: Taking five. Need to recharge.',
  '{name}: Heading to hab for a rest.',
  '{name}: {name} here — running on fumes. Break time.',
  '{name}: Clocking out for a bit.',
  "{name}: Eyes won't stay open. Rack time.",
  '{name}: Done for now. Hitting the bunk.',
  '{name}: My body says stop. Listening for once.',
  '{name}: Need horizontal time. Back in a bit.',
  '{name}: Tapping out. Wake me if something explodes.',
  '{name}: Gravity feels heavier today. Rest mode.',
]

const SOCIAL_START: string[] = [
  '{name}: Anyone at hab? Could use some company.',
  '{name}: Taking a breather with the crew.',
  '{name}: Good to see a friendly face.',
  "{name}: Need to hear a voice that isn't mine.",
  '{name}: Heading to hab. Walls were closing in.',
  '{name}: Crew time. Best part of the cycle.',
  '{name}: Gonna go bother someone at hab for a while.',
  "{name}: If I stare at one more panel I'll lose it. Social break.",
  '{name}: Human contact time. Remember those?',
]

const MEDICAL_START: string[] = [
  '{name}: Not feeling great. Heading to med bay.',
  '{name}: Need to get checked out. On my way to med.',
  '{name}: {name} here — could use some patching up.',
  "{name}: Something's not right. Going to med.",
  '{name}: Feeling rough. Med bay it is.',
  '{name}: Probably nothing, but I should get looked at.',
  "{name}: Pain won't quit. Heading to medical.",
  '{name}: Rather catch it early. Checking in at med.',
]

const WORK_CHATTER_EXTRACT: string[] = [
  '{name}: Interesting formations out here.',
  "{name}: {name} here. Yield's looking good. Steady progress.",
  '{name}: Found some ice deposits. Nice.',
  "{name}: {name} here. Rig's humming along.",
  '{name}: Regolith out here tells a story. Billions of years of nothing.',
  '{name}: Vibration pattern shifted. Might be hitting a new vein.',
  '{name}: Quiet down here. Just me and the drill.',
  "{name}: Pulled some rare stuff this shift. HQ'll be happy.",
  '{name}: Dust everywhere. Filters are earning their keep.',
  "{name}: Drill bit's singing. Good sign.",
  '{name}: Another meter down. Another day on the moon.',
  '{name}: Subsurface density is changing. Could be interesting.',
  "{name}: Not gonna lie, the view from the trench isn't bad.",
  '{name}: Steady yield. No complaints.',
]

const WORK_CHATTER_ENGINEER: string[] = [
  '{name}: Output holding steady at {zone}.',
  '{name}: Tweaked the efficiency a bit. Looking better.',
  '{name}: All green on {zone} monitors.',
  '{name}: {zone} running smooth. Almost suspicious.',
  '{name}: Adjusted the intake on {zone}. Small gains.',
  "{name}: {zone}'s behaving. Knock on... whatever counts up here.",
  '{name}: Numbers are solid at {zone}. Textbook shift.',
  '{name}: Preventive check on {zone} — no issues.',
  '{name}: {zone} thermal readings nominal. We stay warm.',
  '{name}: Swapped a worn coupling at {zone}. Preventive.',
  "{name}: {zone} efficiency up 2%. I'll take it.",
]

const LOW_ENERGY: string[] = [
  '{name}: Getting tired... might need a break soon.',
  '{name}: Running low on steam here.',
  '{name}: Eyelids are heavy. Pushing through.',
  '{name}: How many hours has it been? Lost count.',
  '{name}: Body says stop. Mind says one more cycle.',
  "{name}: Can barely grip the wrench. That's... that's a sign.",
  '{name}: Shift blur setting in.',
]

const LOW_MORALE: string[] = [
  '{name}: Could really use some downtime.',
  '{name}: Starting to feel the grind.',
  '{name}: What are we even doing out here?',
  '{name}: Same walls. Same dust. Same everything.',
  "{name}: Don't remember the last time I laughed.",
  '{name}: This place gets smaller every day.',
  "{name}: Morale check? Don't ask.",
  '{name}: Starting to wonder if HQ even reads these logs.',
  "{name}: It's fine. Everything's fine.",
]

const BREAKDOWN: string[] = [
  "{name}: I can't keep going. Need to stop.",
  '{name}: ...I just need a minute. Please.',
  "{name}: Everything's too much right now.",
  '{name}: [breathing] ...give me a second.',
  "{name}: I can't feel my hands. Is that normal?",
  '{name}: Walls are closing in. Need air.',
  "{name}: I'm done. I'm just... done.",
  '{name}: ...sorry. I need to sit down.',
  "{name}: Can't think straight. Head's full of static.",
]

const DEATH_GRIEF: string[] = [
  "{name}: ...I can't believe {dead} is gone.",
  '{name}: {dead}... no. Not like this.',
  "{name}: We lost {dead}. I don't... I can't...",
  '{name}: {dead} was just here. They were just...',
  "{name}: Someone tell me that didn't happen.",
  '{name}: ...{dead}. Damn it.',
  '{name}: Kept thinking {dead} would walk through the airlock.',
  '{name}: We should have done more for {dead}.',
  '{name}: How do we just... keep working? After {dead}?',
]

const DEATH_BOND_GRIEF: string[] = [
  '{name}: {dead} and I... we had a good thing going.',
  "{name}: I keep looking for {dead} at the station. They're not coming back.",
  '{name}: {dead} was the only one who made this place bearable.',
  '{name}: I keep turning to say something to {dead}. Then I remember.',
  '{name}: {dead} had this way of making the silence feel okay.',
  '{name}: We had plans, {dead} and me. Stupid plans. Moon plans.',
  '{name}: Nobody else gets it. {dead} got it.',
  "{name}: Their bunk is still warm. ...no it isn't. Nothing's warm up here.",
]

const HIGH_MORALE: string[] = [
  "{name}: Feeling sharp today. Let's get it done.",
  "{name}: Good shift. Crew's solid.",
  "{name}: You know what, I think we're gonna be alright.",
  "{name}: Best I've felt since landing. Let's keep it going.",
  "{name}: Crew's clicking. Love to see it.",
  '{name}: Clear head, full tanks. Good day on the moon.',
  "{name}: Almost forgot we're 384,000 km from home. Almost.",
  "{name}: Productive shift. We're building something real up here.",
  '{name}: Someone was humming in the hab. Caught myself smiling.',
  '{name}: Not bad for a rock in space. Not bad at all.',
  '{name}: We got a rhythm going. Feels good.',
]

const BOND_FORMED: string[] = [
  "{name} and {other} seem to have each other's rhythm down.",
  '{name} and {other} make a good team.',
  '{name} and {other} have been inseparable on shift.',
  '{name} and {other} — those two just click.',
  'Noticed {name} and {other} covering for each other. Solid pair.',
]

const BOND_WORKING: string[] = [
  '{name}: Good to have {other} on shift.',
  '{name}: Working with {other} — always better.',
  '{name}: {other} and I got this covered.',
  '{name}: Shift flies by with {other} around.',
  "{name}: {other}'s here. Day just got easier.",
  "{name}: {other} handed me a tool before I asked. We're synced.",
  '{name}: Me and {other}, keeping this rock alive.',
]

const SPECIALIZATION_UNLOCK: string[] = [
  '{name} has earned the rank of {spec}.',
  '{name} certified as {spec}. Well deserved.',
  '{name} promoted to {spec}. The crew approves.',
]

const LOADING_START: string[] = [
  '{name}: Hauling cargo to the platform.',
  '{name}: Loading up the export platform.',
  '{name}: Moving materials to the LZ.',
  '{name}: Stacking payload. HQ better pay well for this.',
  '{name}: Export run. Loading her up.',
  "{name}: Platform's hungry. Feeding it metals.",
  '{name}: Schlepping crates. Glamorous work.',
  '{name}: Another load for the bean counters back home.',
]

const STORAGE_FULL: string[] = [
  "{name}: Storage full — we're losing metals out here.",
  '{name}: No room for more. We need another silo.',
  '{name}: Overflow — materials going to waste.',
  '{name}: Silos are maxed. Extraction yield just hitting the ground.',
  "{name}: We're capped. Either export or expand storage.",
  "{name}: Can't store any more. This is getting wasteful.",
  '{name}: Running out of places to put things.',
]

const CONSTRUCT_START: string[] = [
  '{name}: Starting work on the new structure.',
  "{name}: Got the blueprints. Let's build.",
  "{name}: Assembling the prefab. This'll take a bit.",
  '{name}: Construction time. My favorite.',
  "{name}: Cracking open the prefab kit. Let's see what we've got.",
  '{name}: New build going up. Colony grows.',
  '{name}: Bolts, welds, prayers. Standard procedure.',
  '{name}: Blueprints loaded. Hands ready.',
]

const EAT_START: string[] = [
  "{name} heading to the hab — stomach's growling.",
  '{name}: Taking a food break.',
  '{name} clocking out for a meal.',
  "{name}: Can't work on an empty stomach.",
  '{name} heading back for rations.',
  '{name}: Lunch break. Back in a few.',
  '{name}: Need fuel. Heading to hab.',
  '{name}: Ration time.',
]

const FOCUS_DEPLETED_MSGS: string[] = [
  '{name} clocking out for a breather.',
  "{name}: Brain's fried. Need a minute.",
  "{name}: Can't focus. Taking five.",
  '{name} stepping away from the {zone}.',
  "{name}: Eyes are crossing. Break time.",
  "{name}: Done for now. Need to reset.",
  "{name}: Head's not in it. Taking a break.",
]

const RESTLESS_SWITCH: string[] = [
  "{name} switching tasks — been at it too long.",
  '{name}: Need a change of pace.',
  '{name} heading somewhere else for a while.',
  '{name}: Same thing all day. Mixing it up.',
  '{name}: Gonna go do something different.',
  '{name}: Restless. Switching it up.',
]

const BOND_DETOUR: string[] = [
  "{name} swung by {zone} — checking on {other}.",
  '{name} stopped to see {other} real quick.',
  "{name} making a detour to {other}'s zone.",
  '{name}: Just checking in on {other}.',
  '{name} popped over to see {other}.',
]

const RETURN_FROM_BREAK: string[] = [
  '{name} back on it, looking sharp.',
  "{name}: Recharged. Let's go.",
  '{name} heading back to work.',
  "{name}: Break's over. Back at it.",
  '{name}: Feeling better. Where was I?',
]

export {
  BREAKDOWN,
  DEATH_GRIEF,
  DEATH_BOND_GRIEF,
  BOND_FORMED,
  SPECIALIZATION_UNLOCK,
  STORAGE_FULL,
}

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
    case 'power':
      return 'power grid'
    case 'lifeSup':
      return 'life support'
    case 'extraction':
      return 'extraction site'
    case 'medical':
      return 'med bay'
    case 'habitat':
      return 'hab'
    case 'landing':
      return 'the LZ'
    default:
      return zoneId
  }
}

function canMessage(colonistId: string, now: number): boolean {
  const last = lastMessageAt.get(colonistId) ?? 0
  if (now - last < MIN_MESSAGE_GAP_MS) return false
  if (now - lastChatterAt < MIN_CHATTER_GAP_MS) return false
  return true
}

function emitMessage(
  colonistId: string,
  now: number,
  emit: MessageEmitter,
  text: string,
  severity: 'info' | 'event' = 'info',
) {
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
        emitMessage(
          c.id,
          now,
          emit,
          fill(pick(CHECKIN_ENGINEER), { name: c.name, zone: zoneName(zone) }),
        )
      } else if (currType === 'repair' && curr?.targetId) {
        emitMessage(
          c.id,
          now,
          emit,
          fill(pick(CHECKIN_REPAIR), {
            name: c.name,
            building: buildingLabel(curr.targetId),
          }),
        )
      } else if (currType === 'unpack') {
        // Check if someone else is already unpacking — if so, it's an assist
        const otherUnpacker = allColonists.find(
          (o) => o.id !== c.id && o.currentAction?.type === 'unpack',
        )
        if (otherUnpacker) {
          emitMessage(
            c.id,
            now,
            emit,
            fill(pick(UNPACK_ASSIST), {
              name: c.name,
              other: otherUnpacker.name,
            }),
          )
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
      } else if (currType === 'eat') {
        emitMessage(c.id, now, emit, fill(pick(EAT_START), { name: c.name }))
      }

      // ── Completion messages ──
      if (prevType === 'repair' && prev?.targetId && currType !== 'repair') {
        // Repair just finished
        emitMessage(
          c.id,
          now,
          emit,
          fill(pick(REPAIR_DONE), {
            name: c.name,
            building: buildingLabel(prev.targetId),
          }),
          'event',
        )
      }
    }

    // ── Mid-work chatter (random, low frequency) ──
    if (!actionChanged && curr && !curr.walkPath?.length && canMessage(c.id, now)) {
      const chatterChance = 0.02 // 2% per tick = roughly every 50s
      if (Math.random() < chatterChance) {
        if (currType === 'extract') {
          emitMessage(c.id, now, emit, fill(pick(WORK_CHATTER_EXTRACT), { name: c.name }))
        } else if (currType === 'engineer') {
          emitMessage(
            c.id,
            now,
            emit,
            fill(pick(WORK_CHATTER_ENGINEER), {
              name: c.name,
              zone: zoneName(curr.targetZone),
            }),
          )
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
        const bondPartner = allColonists.find(
          (o) =>
            o.id !== c.id && o.health > 0 && o.currentZone === c.currentZone && c.bonds[o.id] >= 20,
        )
        if (bondPartner) {
          emitMessage(
            c.id,
            now,
            emit,
            fill(pick(BOND_WORKING), {
              name: c.name,
              other: bondPartner.name,
            }),
          )
        }
      }
    }

    // Update tracking
    prevActions.set(c.id, curr ? { type: curr.type, targetId: curr.targetId } : null)
  }
}

// ── Exported chatter triggers (called from tick loop) ──

export function emitFocusDepletedChatter(
  colonist: Colonist,
  allColonists: Colonist[],
  buildingLabel: (id: string) => string,
  emit: MessageEmitter,
  now: number,
): void {
  if (Math.random() > 0.3) return // 30% chance
  if (!canMessage(colonist.id, now)) return
  const zone = colonist.currentZone ? zoneName(colonist.currentZone) : 'station'
  emitMessage(colonist.id, now, emit, fill(pick(FOCUS_DEPLETED_MSGS), { name: colonist.name, zone }))
}

export function emitRestlessSwitchChatter(
  colonist: Colonist,
  allColonists: Colonist[],
  buildingLabel: (id: string) => string,
  emit: MessageEmitter,
  now: number,
): void {
  if (Math.random() > 0.3) return
  if (!canMessage(colonist.id, now)) return
  emitMessage(colonist.id, now, emit, fill(pick(RESTLESS_SWITCH), { name: colonist.name }))
}

export function emitBondDetourChatter(
  colonist: Colonist,
  allColonists: Colonist[],
  buildingLabel: (id: string) => string,
  emit: MessageEmitter,
  now: number,
): void {
  if (Math.random() > 0.3) return
  if (!canMessage(colonist.id, now)) return
  // Find a bonded partner for the {other} placeholder
  const bondPartner = allColonists.find(
    (o) => o.id !== colonist.id && o.health > 0 && colonist.bonds[o.id] >= 20,
  )
  const other = bondPartner?.name ?? 'a friend'
  const zone = colonist.currentZone ? zoneName(colonist.currentZone) : 'station'
  emitMessage(colonist.id, now, emit, fill(pick(BOND_DETOUR), { name: colonist.name, other, zone }))
}

export function emitReturnFromBreakChatter(
  colonist: Colonist,
  allColonists: Colonist[],
  buildingLabel: (id: string) => string,
  emit: MessageEmitter,
  now: number,
): void {
  if (Math.random() > 0.3) return
  if (!canMessage(colonist.id, now)) return
  emitMessage(colonist.id, now, emit, fill(pick(RETURN_FROM_BREAK), { name: colonist.name }))
}
