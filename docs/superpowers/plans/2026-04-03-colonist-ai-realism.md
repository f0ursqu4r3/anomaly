# Colonist AI Realism Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make colonists feel like real people — natural work/rest rhythms, hunger breaks, human pacing between tasks, and restlessness from repetitive work — without noticeably degrading colony productivity.

**Architecture:** Four new simulation mechanics (focus, hunger, transitions, restlessness) layered onto the existing utility-scoring AI. New `focus` and `hunger` meters on each colonist, a new `eat` action type, transition pause state between actions, and a rolling action history for restlessness penalties. All surfaced via radio chatter and the colonist detail overlay.

**Tech Stack:** Vue 3 + Pinia + TypeScript (existing stack). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-03-colonist-ai-realism-design.md`

---

## Task 1: Add New Colonist Fields and `eat` ActionType

**Files:**
- Modify: `src/types/colonist.ts` (ActionType union, lines 17-28)
- Modify: `src/stores/gameStore.ts` (Colonist interface lines 31-47, makeStartingColonists lines 376-381, migrateState lines 1422-1444)

- [ ] **Step 1: Add `eat` to ActionType union**

In `src/types/colonist.ts`, add `'eat'` to the ActionType union:

```typescript
export type ActionType =
  | 'extract'
  | 'engineer'
  | 'repair'
  | 'unpack'
  | 'rest'
  | 'socialize'
  | 'seek_medical'
  | 'wander'
  | 'load'
  | 'construct'
  | 'eat'
```

- [ ] **Step 2: Add new fields to Colonist interface**

In `src/stores/gameStore.ts`, add four fields to the `Colonist` interface (after `currentZone`):

```typescript
export interface Colonist {
  id: string
  name: string
  health: number
  energy: number
  morale: number
  trait: Trait
  skillTrait: SkillTrait
  extractionXP: number
  engineeringXP: number
  medicalXP: number
  specialization: Specialization | null
  bonds: Record<string, number>
  lastBreakdownAt: number | null
  currentAction: Action | null
  currentZone: string
  focus: number
  hunger: number
  actionHistory: ActionType[]
  transitionTicks: number
}
```

- [ ] **Step 3: Update makeStartingColonists()**

In `src/stores/gameStore.ts`, add the new fields to both starting colonists in `makeStartingColonists()`. Use randomized initial values for desync:

```typescript
function makeStartingColonists(): Colonist[] {
  return [
    {
      id: uid(), name: 'Riko', health: 100, energy: 80, morale: 70,
      trait: randomTrait(), skillTrait: randomSkillTrait(),
      extractionXP: 0, engineeringXP: 0, medicalXP: 0,
      specialization: null, bonds: {}, lastBreakdownAt: null,
      currentAction: null, currentZone: 'habitat',
      focus: 80 + Math.floor(Math.random() * 21),
      hunger: 70 + Math.floor(Math.random() * 31),
      actionHistory: [],
      transitionTicks: 0,
    },
    {
      id: uid(), name: 'Sable', health: 100, energy: 80, morale: 70,
      trait: randomTrait(), skillTrait: randomSkillTrait(),
      extractionXP: 0, engineeringXP: 0, medicalXP: 0,
      specialization: null, bonds: {}, lastBreakdownAt: null,
      currentAction: null, currentZone: 'habitat',
      focus: 80 + Math.floor(Math.random() * 21),
      hunger: 70 + Math.floor(Math.random() * 31),
      actionHistory: [],
      transitionTicks: 0,
    },
  ]
}
```

- [ ] **Step 4: Add save migration for existing saves**

In `src/stores/gameStore.ts`, find the `migrateState()` method. Add a new migration block that backfills the four new fields on any colonist missing them:

```typescript
// In migrateState(), after the existing migration blocks:
for (const c of this.colonists) {
  if (c.focus === undefined) c.focus = 80
  if (c.hunger === undefined) c.hunger = 70 + Math.floor(Math.random() * 31)
  if (c.actionHistory === undefined) c.actionHistory = []
  if (c.transitionTicks === undefined) c.transitionTicks = 0
}
```

- [ ] **Step 5: Check for any other colonist creation sites**

Search for other places colonists are created (e.g., new colonist arrivals from shipments). Ensure they also include the four new fields. Look for patterns like `{ id: uid(), name:` in `gameStore.ts`. Add the new fields with the same randomized initialization pattern.

- [ ] **Step 6: Run `bun run build` to verify no type errors**

Run: `bun run build`
Expected: Clean build with no TypeScript errors. Fix any missing field errors that surface.

- [ ] **Step 7: Commit**

```bash
git add src/types/colonist.ts src/stores/gameStore.ts
git commit -m "feat: add focus, hunger, actionHistory, transitionTicks fields and eat ActionType"
```

---

## Task 2: Update ColonistLike Interface and TraitMod in colonistAI

**Files:**
- Modify: `src/systems/colonistAI.ts` (ColonistLike lines 120-135, TraitMod lines 36-45, TRAIT_MODS lines 47-108, DURATION lines 23-34)

- [ ] **Step 1: Add new fields to ColonistLike interface**

In `src/systems/colonistAI.ts`, update the `ColonistLike` interface to include the new colonist fields:

```typescript
export interface ColonistLike {
  id: string
  health: number
  energy: number
  morale: number
  focus: number
  hunger: number
  actionHistory: ActionType[]
  transitionTicks: number
  trait: Trait
  skillTrait: SkillTrait
  extractionXP: number
  engineeringXP: number
  medicalXP: number
  specialization: Specialization | null
  bonds: Record<string, number>
  lastBreakdownAt: number | null
  currentAction: Action | null
  currentZone: string
}
```

- [ ] **Step 2: Add new fields to TraitMod interface**

Add `focusDrainMult`, `restlessThreshold`, and `transitionMult` to the `TraitMod` interface:

```typescript
interface TraitMod {
  energyDrainMult: number
  moraleDrainMult: number
  workUtilityMult: number
  socialUtilityMult: number
  repairUtilityMult: number
  medicalThresholdBonus: number
  durationMult: number
  walkSpeedMult: number
  focusDrainMult: number
  restlessThreshold: number
  transitionMult: number
}
```

- [ ] **Step 3: Update all TRAIT_MODS entries**

Add the three new fields to every trait in the `TRAIT_MODS` record:

```typescript
const TRAIT_MODS: Record<Trait, TraitMod> = {
  hardy: {
    energyDrainMult: 0.75,
    moraleDrainMult: 1.0,
    workUtilityMult: 1.0,
    socialUtilityMult: 1.0,
    repairUtilityMult: 1.0,
    medicalThresholdBonus: 0,
    durationMult: 1.0,
    walkSpeedMult: 1.0,
    focusDrainMult: 1.0,
    restlessThreshold: 3,
    transitionMult: 1.0,
  },
  diligent: {
    energyDrainMult: 1.0,
    moraleDrainMult: 1.0,
    workUtilityMult: 1.2,
    socialUtilityMult: 0.7,
    repairUtilityMult: 1.0,
    medicalThresholdBonus: 0,
    durationMult: 1.0,
    walkSpeedMult: 1.0,
    focusDrainMult: 0.8,
    restlessThreshold: 4,
    transitionMult: 1.0,
  },
  social: {
    energyDrainMult: 1.0,
    moraleDrainMult: 1.3,
    workUtilityMult: 1.0,
    socialUtilityMult: 1.5,
    repairUtilityMult: 1.0,
    medicalThresholdBonus: 0,
    durationMult: 1.0,
    walkSpeedMult: 1.0,
    focusDrainMult: 1.3,
    restlessThreshold: 2,
    transitionMult: 1.5,
  },
  cautious: {
    energyDrainMult: 1.0,
    moraleDrainMult: 1.0,
    workUtilityMult: 1.0,
    socialUtilityMult: 1.0,
    repairUtilityMult: 1.5,
    medicalThresholdBonus: 15,
    durationMult: 1.0,
    walkSpeedMult: 1.0,
    focusDrainMult: 1.0,
    restlessThreshold: 3,
    transitionMult: 1.0,
  },
  efficient: {
    energyDrainMult: 1.0,
    moraleDrainMult: 1.0,
    workUtilityMult: 1.0,
    socialUtilityMult: 1.0,
    repairUtilityMult: 1.0,
    medicalThresholdBonus: 0,
    durationMult: 0.85,
    walkSpeedMult: 1.1,
    focusDrainMult: 1.0,
    restlessThreshold: 3,
    transitionMult: 0.5,
  },
  stoic: {
    energyDrainMult: 1.0,
    moraleDrainMult: 0.7,
    workUtilityMult: 1.0,
    socialUtilityMult: 0.6,
    repairUtilityMult: 1.0,
    medicalThresholdBonus: 0,
    durationMult: 1.0,
    walkSpeedMult: 1.0,
    focusDrainMult: 0.9,
    restlessThreshold: 99,
    transitionMult: 1.0,
  },
}
```

- [ ] **Step 4: Add `eat` to the DURATION record**

```typescript
const DURATION: Record<ActionType, [number, number]> = {
  extract: [12, 25],
  engineer: [12, 25],
  repair: [15, 30],
  unpack: [5, 10],
  rest: [15, 35],
  socialize: [10, 20],
  seek_medical: [20, 40],
  wander: [8, 18],
  load: [8, 15],
  construct: [20, 40],
  eat: [8, 15],
}
```

- [ ] **Step 5: Run `bun run build` to verify no type errors**

Run: `bun run build`
Expected: Clean build. All TraitMod usages should be satisfied.

- [ ] **Step 6: Commit**

```bash
git add src/systems/colonistAI.ts
git commit -m "feat: add focus/hunger/restlessness trait modifiers and eat duration"
```

---

## Task 3: Focus and Hunger in updateNeeds()

**Files:**
- Modify: `src/systems/colonistAI.ts` (updateNeeds function lines 137-173, constants lines 8-20)

- [ ] **Step 1: Add new constants**

Add the focus and hunger constants after the existing constant block (after line 20):

```typescript
// Focus
const FOCUS_DRAIN_WORKING = 2.5
const FOCUS_RECOVERY_REST = 2.0
const FOCUS_RECOVERY_SOCIAL = 1.5
const FOCUS_RECOVERY_EAT = 1.0
const FOCUS_RECOVERY_WANDER = 0.5
const FOCUS_RECOVERY_TRANSITION = 0.3
const FOCUS_LOW = 25
const FOCUS_DEPLETED = 10

// Hunger
const HUNGER_DRAIN = 0.3
const HUNGER_HUNGRY = 40
const HUNGER_STARVING = 15
```

- [ ] **Step 2: Add focus drain/recovery to updateNeeds()**

In the `updateNeeds()` function, after the existing morale block (after line 172), add focus update logic:

```typescript
  // Focus
  if (action) {
    if (action.walkPath && action.walkPath.length > 0) {
      // Walking — no focus drain
    } else if (action.type === 'rest') {
      colonist.focus = Math.min(100, colonist.focus + FOCUS_RECOVERY_REST)
    } else if (action.type === 'socialize') {
      colonist.focus = Math.min(100, colonist.focus + FOCUS_RECOVERY_SOCIAL)
    } else if (action.type === 'eat') {
      colonist.focus = Math.min(100, colonist.focus + FOCUS_RECOVERY_EAT)
    } else if (action.type === 'wander') {
      colonist.focus = Math.min(100, colonist.focus + FOCUS_RECOVERY_WANDER)
    } else {
      // Working — drain focus
      colonist.focus = Math.max(0, colonist.focus - FOCUS_DRAIN_WORKING * mod.focusDrainMult)
    }
  }

  // Hunger — drains passively every tick regardless of action
  const hungerDrainMult = colonist.skillTrait === 'ironStomach' ? 0.7 : 1.0
  colonist.hunger = Math.max(0, colonist.hunger - HUNGER_DRAIN * hungerDrainMult)
```

- [ ] **Step 3: Add eat action energy/morale recovery to updateNeeds()**

In the existing energy block of `updateNeeds()`, add an `eat` case alongside the existing `socialize` case. Find this block (lines 142-163) and add:

```typescript
    } else if (action.type === 'eat') {
      colonist.energy = Math.min(100, colonist.energy + ENERGY_RECOVERY_RESTING * 0.3)
```

Add this right after the `socialize` energy recovery case (line 149).

In the existing morale block, add eat recovery. Find the morale section (lines 165-172) and change it to:

```typescript
  // Morale
  if (action?.type === 'socialize') {
    colonist.morale = Math.min(100, colonist.morale + MORALE_RECOVERY_SOCIAL)
  } else if (action?.type === 'rest') {
    colonist.morale = Math.min(100, colonist.morale + MORALE_RECOVERY_RESTING)
  } else if (action?.type === 'eat') {
    colonist.morale = Math.min(100, colonist.morale + MORALE_RECOVERY_RESTING * 0.5)
  } else {
    colonist.morale = Math.max(0, colonist.morale - MORALE_DRAIN_PASSIVE * mod.moraleDrainMult)
  }
```

- [ ] **Step 4: Run `bun run build` to verify**

Run: `bun run build`
Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add src/systems/colonistAI.ts
git commit -m "feat: add focus/hunger drain and recovery to updateNeeds"
```

---

## Task 4: Transition Pause Logic

**Files:**
- Modify: `src/systems/colonistAI.ts` (new exported function)
- Modify: `src/stores/gameStore.ts` (tick method, colonist AI section lines 609-638)

- [ ] **Step 1: Add transition constants to colonistAI.ts**

Add after the hunger constants:

```typescript
// Transitions
const TRANSITION_PAUSE_SHORT: [number, number] = [2, 3]
const TRANSITION_PAUSE_LONG: [number, number] = [3, 5]
const BOND_DETOUR_CHANCE = 0.2
```

- [ ] **Step 2: Add getTransitionTicks() function to colonistAI.ts**

Add a new exported function after `advanceAction()`:

```typescript
/** Calculate how long a colonist pauses between actions */
export function getTransitionTicks(colonist: ColonistLike, completedActionTicks: number): number {
  const mod = TRAIT_MODS[colonist.trait]
  let [min, max] = completedActionTicks > 20 ? TRANSITION_PAUSE_LONG : TRANSITION_PAUSE_SHORT

  // Socializing → shorter pause (already refreshed)
  if (colonist.currentAction?.type === 'socialize') {
    min = 1
    max = 2
  }

  const base = min + Math.floor(Math.random() * (max - min + 1))
  return Math.max(1, Math.round(base * mod.transitionMult))
}
```

- [ ] **Step 3: Add checkBondDetour() function to colonistAI.ts**

Add after `getTransitionTicks()`:

```typescript
/** Check if colonist should detour to visit a bonded partner during transition */
export function checkBondDetour(colonist: ColonistLike, state: ColonyState): string | null {
  if (Math.random() > BOND_DETOUR_CHANCE) return null
  if (!colonist.bonds) return null

  // Find adjacent zones to current zone
  const currentZone = ZONE_MAP[colonist.currentZone]
  if (!currentZone) return null

  for (const [partnerId, affinity] of Object.entries(colonist.bonds)) {
    if (affinity < 20) continue
    const partner = state.colonists.find((p) => p.id === partnerId && p.health > 0)
    if (!partner || partner.currentZone === colonist.currentZone) continue

    // Check if partner is in an adjacent zone (direct path, 1 hop)
    const path = findPath(colonist.currentZone, partner.currentZone)
    if (path && path.length === 2) {
      return partner.currentZone
    }
  }
  return null
}
```

- [ ] **Step 4: Wire transition pauses into the tick loop**

In `src/stores/gameStore.ts`, modify the colonist AI section of `tick()`. Replace the block where `advanceAction` returns true and `selectAction` is called. The current logic (lines 609-638) becomes:

```typescript
// Colonist AI
for (const c of alive) {
  updateNeeds(c)
  const interrupted = checkInterrupt(c)
  if (!interrupted) {
    // Handle transition pause countdown
    if (c.transitionTicks > 0) {
      c.transitionTicks--
      // Trickle recovery during pause
      c.energy = Math.min(100, c.energy + 0.3)
      c.focus = Math.min(100, c.focus + 0.3)
      if (c.transitionTicks <= 0) {
        // Check for bond detour
        const detourZone = checkBondDetour(c, this.$state)
        if (detourZone) {
          const walkPath = findPath(c.currentZone, detourZone)
          const needsWalk = walkPath && walkPath.length > 1
          c.currentAction = {
            type: 'wander',
            targetZone: detourZone,
            remainingTicks: needsWalk ? walkTicksBetween(walkPath![0], walkPath![1]) : 4,
            walkPath: needsWalk ? walkPath : undefined,
          }
        } else {
          c.currentAction = selectAction(c, this.$state)
        }
      }
      continue
    }

    const prevAction = c.currentAction?.type
    const prevTicks = c.currentAction?.remainingTicks ?? 0
    const needsDecision = advanceAction(c)
    if (needsDecision) {
      // Action just completed — award XP
      if (prevAction) {
        awardXP(c, prevAction)
        const newSpec = checkSpecialization(c)
        if (newSpec) {
          this.pushMessage(
            `${c.name} has earned the rank of ${SPECIALIZATION_LABELS[newSpec]}`,
            'event',
          )
        }

        // Track work action in history
        const workActions: ActionType[] = ['extract', 'engineer', 'repair', 'construct', 'load']
        if (workActions.includes(prevAction)) {
          c.actionHistory.push(prevAction)
          if (c.actionHistory.length > 5) c.actionHistory.shift()
        }
      }

      // Check for breakdown
      const breakdownTicks = checkBreakdown(c, this.totalPlaytimeMs)
      if (breakdownTicks) {
        c.currentAction = {
          type: 'rest',
          targetZone: 'habitat',
          remainingTicks: breakdownTicks,
        }
        c.currentZone = 'habitat'
        this.pushMessage(`${c.name}: I can't keep going...`, 'info')
      } else {
        // Enter transition pause instead of immediately selecting next action
        const totalActionTicks = getActionDuration(prevAction ?? 'wander', c)
        c.transitionTicks = getTransitionTicks(c, totalActionTicks)
        c.currentAction = null
      }
    }
  } else {
    // Interrupted — select immediately (no pause for urgent needs)
    c.currentAction = selectAction(c, this.$state)
  }
}
```

- [ ] **Step 5: Export walkTicksBetween from colonistAI.ts**

The `walkTicksBetween` function is currently not exported. Add `export` to its declaration so the tick loop can use it for bond detours:

```typescript
export function walkTicksBetween(fromId: string, toId: string): number {
```

- [ ] **Step 6: Update imports in gameStore.ts**

Add the new imports from colonistAI:

```typescript
import {
  updateNeeds,
  checkInterrupt,
  advanceAction,
  selectAction,
  getTransitionTicks,
  checkBondDetour,
  walkTicksBetween,
} from '@/systems/colonistAI'
```

Also import `findPath` if not already imported:

```typescript
import { ZONE_FOR_BUILDING, ZONE_MAP, findPath } from '@/systems/mapLayout'
```

- [ ] **Step 7: Export getActionDuration from colonistAI.ts**

The `getActionDuration` function is used in the tick loop for transition tick calculation. Add `export`:

```typescript
export function getActionDuration(type: ActionType, colonist: ColonistLike): number {
```

- [ ] **Step 8: Run `bun run build` to verify**

Run: `bun run build`
Expected: Clean build.

- [ ] **Step 9: Commit**

```bash
git add src/systems/colonistAI.ts src/stores/gameStore.ts
git commit -m "feat: add transition pauses between actions with bond detours"
```

---

## Task 5: Eat Action and Restlessness in selectAction()

**Files:**
- Modify: `src/systems/colonistAI.ts` (selectAction function lines 269-533)

- [ ] **Step 1: Add restlessness constants**

Add after the transition constants:

```typescript
// Restlessness
const RESTLESS_THRESHOLD = 3
const RESTLESS_HEAVY_THRESHOLD = 4
const RESTLESS_PENALTY = 0.7
const RESTLESS_HEAVY_PENALTY = 0.5
const WORK_ACTIONS: ActionType[] = ['extract', 'engineer', 'repair', 'construct', 'load']
```

- [ ] **Step 2: Add restlessness helper function**

Add before `selectAction()`:

```typescript
/** Calculate restlessness penalty for a given action type based on recent history */
function getRestlessPenalty(colonist: ColonistLike, actionType: ActionType): number {
  if (!WORK_ACTIONS.includes(actionType)) return 1.0
  const mod = TRAIT_MODS[colonist.trait]
  if (mod.restlessThreshold >= 99) return 1.0 // stoic: immune

  const count = colonist.actionHistory.filter((a) => a === actionType).length
  if (count >= RESTLESS_HEAVY_THRESHOLD) {
    return RESTLESS_HEAVY_PENALTY
  }
  if (count >= mod.restlessThreshold) {
    return RESTLESS_PENALTY
  }
  return 1.0
}
```

- [ ] **Step 3: Add focus and hunger utility modifiers to selectAction()**

At the top of `selectAction()`, after `const candidates: ScoredAction[] = []`, compute the focus and hunger multipliers:

```typescript
  // Focus penalty on work actions
  let focusMult = 1.0
  if (colonist.focus < FOCUS_DEPLETED) {
    focusMult = 0.0 // won't select work at all
  } else if (colonist.focus < FOCUS_LOW) {
    focusMult = 0.4
  }

  // Hunger penalty on work actions
  let hungerMult = 1.0
  if (colonist.hunger < HUNGER_STARVING) {
    hungerMult = 0.3
  } else if (colonist.hunger < HUNGER_HUNGRY) {
    hungerMult = 0.8
  }
```

- [ ] **Step 4: Apply focus, hunger, and restlessness to all work action scores**

Multiply `focusMult * hungerMult * getRestlessPenalty(colonist, type)` into every work action candidate score. Update each work candidate push. For example, the EXTRACT candidate becomes:

```typescript
  // EXTRACT
  if (colonist.energy > 20) {
    const rigs = state.buildings.filter((b) => b.type === 'extractionrig' && !b.damaged)
    if (rigs.length > 0) {
      const rig = rigs[Math.floor(Math.random() * rigs.length)]
      candidates.push({
        type: 'extract',
        targetZone: 'extraction',
        targetId: rig.id,
        score:
          50 *
          dirMod.extract *
          mod.workUtilityMult *
          focusMult *
          hungerMult *
          getRestlessPenalty(colonist, 'extract'),
      })
    }
  }
```

Apply the same `focusMult * hungerMult * getRestlessPenalty(colonist, actionType)` pattern to:
- ENGINEER (both power/lifeSup and workshop candidates)
- REPAIR
- CONSTRUCT
- UNPACK (apply focusMult and hungerMult only, no restlessness — unpack is not in WORK_ACTIONS... actually unpack IS tracked? No — per spec, unpack is not a work action for restlessness. But focus/hunger still apply.)
- LOAD

For UNPACK, only apply `focusMult * hungerMult` (no restlessness — unpack is not in the work history).

- [ ] **Step 5: Add EAT candidate**

Add the eat scoring block after the SOCIALIZE block and before SEEK_MEDICAL:

```typescript
  // EAT
  {
    let eatScore = 5
    if (colonist.hunger < HUNGER_HUNGRY) {
      eatScore = 30 + (HUNGER_HUNGRY - colonist.hunger) * 1.5
    }
    if (colonist.hunger < HUNGER_STARVING) {
      eatScore = 120
    }
    candidates.push({ type: 'eat', targetZone: 'habitat', score: eatScore })
  }
```

- [ ] **Step 6: Add hunger restoration on eat action completion**

The eat action restores hunger when it completes. This needs to happen in the tick loop when `prevAction === 'eat'`. In `src/stores/gameStore.ts`, in the tick method, after the XP award block and before the breakdown check, add:

```typescript
        // Eat completion — restore hunger
        if (prevAction === 'eat') {
          c.hunger = 80 + Math.floor(Math.random() * 16) // 80-95
          c.focus = Math.min(100, c.focus + 5 + Math.floor(Math.random() * 6)) // +5-10
          c.morale = Math.min(100, c.morale + 2 + Math.floor(Math.random() * 2)) // +2-3
        }
```

- [ ] **Step 7: Run `bun run build` to verify**

Run: `bun run build`
Expected: Clean build.

- [ ] **Step 8: Commit**

```bash
git add src/systems/colonistAI.ts src/stores/gameStore.ts
git commit -m "feat: add eat action, focus/hunger penalties, and restlessness to action selection"
```

---

## Task 6: Radio Chatter for New Behaviors

**Files:**
- Modify: `src/systems/radioChatter.ts` (template arrays and generateChatter function)

- [ ] **Step 1: Add new chatter template arrays**

Add these template arrays alongside the existing ones (e.g., after the CONSTRUCT_START array):

```typescript
const EAT_START: string[] = [
  '{name} heading to the hab — stomach\'s growling.',
  '{name}: Taking a food break.',
  '{name} clocking out for a meal.',
  '{name}: Can\'t work on an empty stomach.',
  '{name} heading back for rations.',
  '{name}: Lunch break. Back in a few.',
  '{name}: Need fuel. Heading to hab.',
  '{name}: Ration time.',
]

const FOCUS_DEPLETED: string[] = [
  '{name} clocking out for a breather.',
  '{name}: Brain\'s fried. Need a minute.',
  '{name}: Can\'t focus. Taking five.',
  '{name} stepping away from the {zone}.',
  '{name}: Eyes are crossing. Break time.',
  '{name}: Done for now. Need to reset.',
  '{name}: Head\'s not in it. Taking a break.',
]

const RESTLESS_SWITCH: string[] = [
  '{name} switching tasks — been at it too long.',
  '{name}: Need a change of pace.',
  '{name} heading somewhere else for a while.',
  '{name}: Same thing all day. Mixing it up.',
  '{name}: Gonna go do something different.',
  '{name}: Restless. Switching it up.',
]

const BOND_DETOUR: string[] = [
  '{name} swung by {zone} — checking on {other}.',
  '{name} stopped to see {other} real quick.',
  '{name} making a detour to {other}\'s zone.',
  '{name}: Just checking in on {other}.',
  '{name} popped over to see {other}.',
]

const RETURN_FROM_BREAK: string[] = [
  '{name} back on it, looking sharp.',
  '{name}: Recharged. Let\'s go.',
  '{name} heading back to work.',
  '{name}: Break\'s over. Back at it.',
  '{name}: Feeling better. Where was I?',
]
```

- [ ] **Step 2: Add eat action arrival chatter to generateChatter()**

In the `generateChatter()` function, find the arrival message section that detects action transitions (where `prevActions` map is compared to current action). Add a case for the `eat` action alongside the existing action type checks:

```typescript
      if (action.type === 'eat' && canMessage(c.id, now)) {
        emitMessage(c.id, fill(pick(EAT_START), c, allColonists, buildingLabel), 'info', now)
      }
```

- [ ] **Step 3: Add focus/restlessness/bond chatter triggers**

These are triggered from the tick loop, not from `generateChatter()` directly. Export a set of targeted chatter functions from `radioChatter.ts`:

```typescript
export function emitFocusDepletedChatter(
  colonist: Colonist,
  allColonists: Colonist[],
  buildingLabel: (id: string) => string,
  emit: MessageEmitter,
  now: number,
): void {
  if (Math.random() > 0.3) return // 30% chance
  if (!canMessage(colonist.id, now)) return
  emitMessage(colonist.id, fill(pick(FOCUS_DEPLETED), colonist, allColonists, buildingLabel), 'info', now)
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
  emitMessage(colonist.id, fill(pick(RESTLESS_SWITCH), colonist, allColonists, buildingLabel), 'info', now)
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
  emitMessage(colonist.id, fill(pick(BOND_DETOUR), colonist, allColonists, buildingLabel), 'info', now)
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
  emitMessage(colonist.id, fill(pick(RETURN_FROM_BREAK), colonist, allColonists, buildingLabel), 'info', now)
}
```

- [ ] **Step 4: Verify the `fill()` and `canMessage()` functions are accessible**

Check that `canMessage` and `emitMessage` are module-level functions (not closures inside `generateChatter`). If they are closures, they need to be extracted to module scope so the new exported functions can use them. Based on the codebase exploration, `canMessage` and `emitMessage` are module-level — verify this and adjust if needed.

- [ ] **Step 5: Run `bun run build` to verify**

Run: `bun run build`
Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
git add src/systems/radioChatter.ts
git commit -m "feat: add radio chatter for eating, focus depletion, restlessness, bond detours"
```

---

## Task 7: Wire Chatter Triggers into Tick Loop

**Files:**
- Modify: `src/stores/gameStore.ts` (tick method)

- [ ] **Step 1: Import new chatter functions**

Add imports from radioChatter:

```typescript
import {
  generateChatter,
  emitFocusDepletedChatter,
  emitRestlessSwitchChatter,
  emitBondDetourChatter,
  emitReturnFromBreakChatter,
} from '@/systems/radioChatter'
```

- [ ] **Step 2: Add focus depletion chatter**

In the tick loop's colonist AI section, when a colonist enters transition pause and their focus was the reason (focus < FOCUS_LOW at the time they stopped working), emit focus chatter. Add this inside the transition tick assignment block, right after `c.transitionTicks = getTransitionTicks(...)`:

```typescript
        // Emit focus depletion chatter if that's why they stopped
        if (c.focus < 25 && prevAction && ['extract', 'engineer', 'repair', 'construct', 'load'].includes(prevAction)) {
          emitFocusDepletedChatter(
            c, this.colonists,
            (id) => { const b = this.buildings.find(b => b.id === id); return b ? (BLUEPRINTS.find(bp => bp.type === b.type)?.label ?? b.type) : 'building' },
            (text, severity) => this.pushMessage(text, severity),
            this.totalPlaytimeMs,
          )
        }
```

- [ ] **Step 3: Add bond detour chatter**

In the bond detour section (where `checkBondDetour` returns a zone), emit bond detour chatter:

```typescript
        if (detourZone) {
          emitBondDetourChatter(
            c, this.colonists,
            (id) => { const b = this.buildings.find(b => b.id === id); return b ? (BLUEPRINTS.find(bp => bp.type === b.type)?.label ?? b.type) : 'building' },
            (text, severity) => this.pushMessage(text, severity),
            this.totalPlaytimeMs,
          )
          // ... existing detour walk logic
        }
```

- [ ] **Step 4: Add return-from-break chatter**

When a colonist's transition ends and they select a work action, emit return chatter. In the transition countdown block, when `transitionTicks` reaches 0 and `selectAction` is called:

```typescript
        // After selectAction in the transition-complete block:
        if (c.currentAction && ['extract', 'engineer', 'repair', 'construct', 'load'].includes(c.currentAction.type)) {
          emitReturnFromBreakChatter(
            c, this.colonists,
            (id) => { const b = this.buildings.find(b => b.id === id); return b ? (BLUEPRINTS.find(bp => bp.type === b.type)?.label ?? b.type) : 'building' },
            (text, severity) => this.pushMessage(text, severity),
            this.totalPlaytimeMs,
          )
        }
```

- [ ] **Step 5: Extract buildingLabel helper to avoid repetition**

The `(id) => { const b = ...}` lambda is repeated. Extract it to a local variable at the top of the tick method:

```typescript
    const buildingLabel = (id: string) => {
      const b = this.buildings.find(b => b.id === id)
      return b ? (BLUEPRINTS.find(bp => bp.type === b.type)?.label ?? b.type) : 'building'
    }
    const emitMsg = (text: string, severity: string) => this.pushMessage(text, severity as any)
```

Then use `buildingLabel` and `emitMsg` in all chatter calls (including the existing `generateChatter` call).

- [ ] **Step 6: Run `bun run build` to verify**

Run: `bun run build`
Expected: Clean build.

- [ ] **Step 7: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat: wire focus/restlessness/bond chatter triggers into tick loop"
```

---

## Task 8: Visual Layer — Movement and Colonist Overlay

**Files:**
- Modify: `src/composables/useColonistMovement.ts` (actionToVisualState function)
- Modify: `src/components/ColonistInfo.vue` (add focus/hunger bars and mood label)

- [ ] **Step 1: Add `eat` to actionToVisualState()**

In `src/composables/useColonistMovement.ts`, find the `actionToVisualState()` function and add the `eat` case:

```typescript
function actionToVisualState(action: Action | null, colonist: any): VisualState {
  if (!action) return 'idle'
  switch (action.type) {
    case 'rest': return 'resting'
    case 'socialize': return 'socializing'
    case 'eat': return 'resting'  // visually same as resting — in habitat, taking a break
    case 'seek_medical': return colonist.health < 40 ? 'injured' : 'walking'
    case 'wander': return 'idle'
    case 'load':
    case 'construct':
    default: return 'working'
  }
}
```

- [ ] **Step 2: Handle transition idle in movement update**

In the `update()` function, colonists with `transitionTicks > 0` and `currentAction === null` should show as `idle` (they're lingering in their zone). This should already work since `actionToVisualState(null)` returns `'idle'`. Verify this is the case — if the movement system skips colonists with no action, ensure they still render at their current position with `idle` state.

- [ ] **Step 3: Add mood label derivation function**

In `src/components/ColonistInfo.vue`, add a computed or helper function for the mood label. First, read the current file to understand its structure, then add:

```typescript
function getMoodLabel(c: Colonist): string {
  if (c.hunger < 15) return 'Starving'
  if (c.energy < 10) return 'Exhausted'
  if (c.morale < 10) return 'Breaking'
  if (c.hunger < 40) return 'Hungry'
  if (c.focus < 10) return 'Burned Out'
  if (c.energy < 30) return 'Tired'
  if (c.morale < 25) return 'Stressed'
  if (c.focus < 25) return 'Unfocused'
  if (c.focus > 75 && c.energy > 60) return 'Focused'
  if (c.morale > 75) return 'Content'
  return 'Okay'
}
```

- [ ] **Step 4: Add focus and hunger bars to ColonistInfo template**

Add two new stat bars for focus and hunger alongside the existing health/energy/morale bars. Follow the existing pattern for bar rendering. Also display the mood label. The exact template changes depend on the current structure — read the file and add bars following the same pattern as existing ones.

Add `focus` bar with cyan/blue color, `hunger` bar with amber/orange color, and the mood label as a text element.

- [ ] **Step 5: Add `eat` to the action label mapping**

In `ColonistInfo.vue`, find the action label mapping (lines 31-44) and add:

```typescript
case 'eat': return 'eating'
```

- [ ] **Step 6: Run `bun run build` to verify**

Run: `bun run build`
Expected: Clean build.

- [ ] **Step 7: Run `bun run dev` and visually verify**

Run: `bun run dev`
Open the game and observe:
- Colonists should pause between actions (visible as brief idle moments)
- After ~5 minutes, colonists should start trickling to habitat for meals
- Focus bars should deplete during work and recover during breaks
- Mood labels should display correctly in the colonist overlay

- [ ] **Step 8: Commit**

```bash
git add src/composables/useColonistMovement.ts src/components/ColonistInfo.vue
git commit -m "feat: add eat visual state, focus/hunger bars, and mood labels to UI"
```

---

## Task 9: Playtest and Tune

**Files:**
- Potentially modify: `src/systems/colonistAI.ts` (constants)

- [ ] **Step 1: Run the game and observe for 10+ minutes**

Run: `bun run dev`

Watch for:
- Do colonists work in visible streaks then take breaks? (Focus working)
- Do colonists trickle to habitat for meals at staggered times? (Hunger working)
- Do colonists linger briefly between tasks? (Transitions working)
- Do colonists rotate between different work types? (Restlessness working)
- Does radio chatter fire for the new behaviors? (Chatter working)
- Is the colony still productive enough? (Balance check)

- [ ] **Step 2: Tune constants if needed**

If the colony feels too sluggish:
- Reduce `FOCUS_DRAIN_WORKING` from 2.5 to 2.0 (longer work streaks)
- Reduce `HUNGER_DRAIN` from 0.3 to 0.25 (less frequent meals)
- Reduce transition pause ranges by 1 tick each

If colonists seem to never take breaks:
- Increase `FOCUS_DRAIN_WORKING` to 3.0
- Increase `HUNGER_DRAIN` to 0.35

If restlessness is too aggressive:
- Change `RESTLESS_THRESHOLD` from 3 to 4

- [ ] **Step 3: Run `bun run build` to verify final state**

Run: `bun run build`
Expected: Clean build with all features integrated.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "tune: adjust colonist AI realism constants from playtesting"
```

Only commit if constants were actually changed. Skip if no tuning was needed.
