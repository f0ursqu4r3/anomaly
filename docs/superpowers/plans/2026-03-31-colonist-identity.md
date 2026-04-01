# Colonist Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give colonists individual identity through skill traits, XP/leveling, morale events, lightweight bonds, and specializations.

**Architecture:** Extend the existing `Colonist` interface with new fields. Add a `colonistIdentity.ts` system module for XP accrual, bond updates, morale events, and specialization checks — keeping `colonistAI.ts` focused on action selection. Wire efficiency multipliers through a single `getEfficiencyMultiplier()` helper used by gameStore rate calculations. Update radioChatter with new message templates.

**Tech Stack:** Vue 3, Pinia, TypeScript (existing stack, no new dependencies)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/types/colonist.ts` | Modify | Add `SkillTrait`, `Specialization` types, skill trait definitions |
| `src/systems/colonistIdentity.ts` | Create | XP accrual, bond updates, morale event triggers, specialization checks, efficiency multiplier calculation |
| `src/systems/colonistAI.ts` | Modify | Import efficiency multiplier, apply to action duration and utility scoring; add breakdown interrupt |
| `src/systems/radioChatter.ts` | Modify | Add bond, morale, breakdown, specialization message templates |
| `src/stores/gameStore.ts` | Modify | Extend `Colonist` interface, update creation sites, wire identity tick, detect deaths for morale, save migration |
| `src/stores/offlineEngine.ts` | Modify | Add skill traits to colonist creation, approximate XP accrual |
| `src/components/CommandConsole.vue` | Modify | Show skill trait + expertise in crew selector |

---

### Task 1: Types & Skill Trait Definitions

**Files:**
- Modify: `src/types/colonist.ts`

- [ ] **Step 1: Add SkillTrait and Specialization types**

In `src/types/colonist.ts`, add after the `Trait` type (line 1):

```typescript
export type SkillTrait =
  | 'steadyHands'
  | 'geologist'
  | 'pathfinder'
  | 'fieldMedic'
  | 'claustrophobic'
  | 'ironStomach'
  | 'tinkerer'
  | 'nightOwl'

export type Specialization = 'prospector' | 'mechanic' | 'medic'

export type XPTrack = 'extractionXP' | 'engineeringXP' | 'medicalXP'
```

- [ ] **Step 2: Add skill trait definitions and helpers**

After the `randomTrait()` function (line 25), add:

```typescript
export const SKILL_TRAITS: SkillTrait[] = [
  'steadyHands', 'geologist', 'pathfinder', 'fieldMedic',
  'ironStomach', 'tinkerer', 'nightOwl',
]

const NEGATIVE_SKILL_TRAITS: SkillTrait[] = ['claustrophobic']

export function randomSkillTrait(): SkillTrait {
  // 15% chance of negative trait
  if (Math.random() < 0.15 && NEGATIVE_SKILL_TRAITS.length > 0) {
    return NEGATIVE_SKILL_TRAITS[Math.floor(Math.random() * NEGATIVE_SKILL_TRAITS.length)]
  }
  return SKILL_TRAITS[Math.floor(Math.random() * SKILL_TRAITS.length)]
}

export const SKILL_TRAIT_LABELS: Record<SkillTrait, string> = {
  steadyHands: 'Steady Hands',
  geologist: 'Geologist',
  pathfinder: 'Pathfinder',
  fieldMedic: 'Field Medic',
  claustrophobic: 'Claustrophobic',
  ironStomach: 'Iron Stomach',
  tinkerer: 'Tinkerer',
  nightOwl: 'Night Owl',
}

export const SPECIALIZATION_LABELS: Record<Specialization, string> = {
  prospector: 'Prospector',
  mechanic: 'Mechanic',
  medic: 'Medic',
}

export const XP_THRESHOLDS = [0, 10, 25, 50, 100] as const

export function xpLevel(xp: number): number {
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) return i + 1
  }
  return 1
}
```

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds (new types are unused but valid)

- [ ] **Step 4: Commit**

```bash
git add src/types/colonist.ts
git commit -m "feat(identity): add SkillTrait, Specialization types and helpers"
```

---

### Task 2: Extend Colonist Interface & Creation

**Files:**
- Modify: `src/stores/gameStore.ts`

- [ ] **Step 1: Update Colonist interface**

In `src/stores/gameStore.ts`, update the import (line 5) to include new types:

```typescript
import type { Trait, Action, SkillTrait, Specialization } from '@/types/colonist'
import { randomTrait, randomSkillTrait } from '@/types/colonist'
```

Update the `Colonist` interface (lines 15-24) to:

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
}
```

- [ ] **Step 2: Update makeStartingColonists**

Update `makeStartingColonists()` (lines 329-334):

```typescript
function makeStartingColonists(): Colonist[] {
  return [
    { id: uid(), name: 'Riko', health: 100, energy: 80, morale: 70, trait: randomTrait(), skillTrait: randomSkillTrait(), extractionXP: 0, engineeringXP: 0, medicalXP: 0, specialization: null, bonds: {}, lastBreakdownAt: null, currentAction: null, currentZone: 'habitat' },
    { id: uid(), name: 'Sable', health: 100, energy: 80, morale: 70, trait: randomTrait(), skillTrait: randomSkillTrait(), extractionXP: 0, engineeringXP: 0, medicalXP: 0, specialization: null, bonds: {}, lastBreakdownAt: null, currentAction: null, currentZone: 'habitat' },
  ]
}
```

- [ ] **Step 3: Update newColonist shipment handler**

Update the `newColonist` case (lines 944-958):

```typescript
          case 'newColonist': {
            const usedNames = new Set(this.colonists.map((c) => c.name))
            const available = COLONIST_NAMES.filter((n) => !usedNames.has(n))
            const name =
              available.length > 0
                ? available[Math.floor(Math.random() * available.length)]
                : `Crew-${this.colonists.length + 1}`
            this.colonists.push({
              id: uid(), name, health: 100,
              energy: 80, morale: 70, trait: randomTrait(),
              skillTrait: randomSkillTrait(),
              extractionXP: 0, engineeringXP: 0, medicalXP: 0,
              specialization: null, bonds: {}, lastBreakdownAt: null,
              currentAction: null, currentZone: 'habitat',
            })
            this.pushMessage(`${name} has joined the colony.`, 'event')
            break
          }
```

- [ ] **Step 4: Update save migration**

In `migrateState()` (after line 1138), add new field backfills:

```typescript
        // v4→v5: Add identity fields
        if ((c as any).skillTrait === undefined) c.skillTrait = randomSkillTrait()
        if ((c as any).extractionXP === undefined) (c as any).extractionXP = 0
        if ((c as any).engineeringXP === undefined) (c as any).engineeringXP = 0
        if ((c as any).medicalXP === undefined) (c as any).medicalXP = 0
        if ((c as any).specialization === undefined) (c as any).specialization = null
        if ((c as any).bonds === undefined) (c as any).bonds = {}
        if ((c as any).lastBreakdownAt === undefined) (c as any).lastBreakdownAt = null
```

- [ ] **Step 5: Verify build**

Run: `bun run build`
Expected: Build succeeds. Type errors in colonistAI.ts `ColonistLike` are expected (it doesn't have the new fields yet) — these will be resolved in Task 4.

- [ ] **Step 6: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat(identity): extend Colonist interface with identity fields"
```

---

### Task 3: Colonist Identity System Module

**Files:**
- Create: `src/systems/colonistIdentity.ts`

- [ ] **Step 1: Create the identity system module**

Create `src/systems/colonistIdentity.ts`:

```typescript
import type { Colonist } from '@/stores/gameStore'
import type { ActionType, SkillTrait, Specialization, XPTrack } from '@/types/colonist'
import { xpLevel } from '@/types/colonist'

// ── Constants ──

const BOND_ACCRUAL_INTERVAL_S = 60
const BOND_DECAY_INTERVAL_S = 120
const BOND_THRESHOLD = 20
const MAX_BONDS = 3
const SPECIALIZATION_LEVEL = 3 // XP level required (25 XP)

const MORALE_ON_DEATH = -15
const MORALE_ON_BOND_DEATH = -30
const MORALE_ON_HAZARD = -5
const MORALE_ON_SURVEY_RETURN = 5
const MORALE_OUTPOST_DRAIN_PER_60S = -1
const MORALE_BOND_COLOC_PER_60S = 1
const MORALE_IDLE_DRAIN_PER_30T = -2

const BREAKDOWN_THRESHOLD = 15
const BREAKDOWN_COOLDOWN_MS = 300_000 // 5 minutes
const BREAKDOWN_DURATION_TICKS_MIN = 30
const BREAKDOWN_DURATION_TICKS_MAX = 60

// ── XP Accrual ──

const ACTION_TO_XP_TRACK: Partial<Record<ActionType, XPTrack>> = {
  extract: 'extractionXP',
  engineer: 'engineeringXP',
  repair: 'engineeringXP',
  seek_medical: 'medicalXP',
}

export function awardXP(colonist: Colonist, completedAction: ActionType): void {
  const track = ACTION_TO_XP_TRACK[completedAction]
  if (!track) return
  colonist[track] += 1
}

// ── Specialization ──

const TRACK_TO_SPEC: Record<XPTrack, Specialization> = {
  extractionXP: 'prospector',
  engineeringXP: 'mechanic',
  medicalXP: 'medic',
}

export function checkSpecialization(colonist: Colonist): Specialization | null {
  if (colonist.specialization) return null // already specialized

  const tracks: XPTrack[] = ['extractionXP', 'engineeringXP', 'medicalXP']
  for (const track of tracks) {
    if (xpLevel(colonist[track]) >= SPECIALIZATION_LEVEL) {
      colonist.specialization = TRACK_TO_SPEC[track]
      return colonist.specialization
    }
  }
  return null
}

// ── Efficiency Multiplier ──

export function getEfficiencyMultiplier(colonist: Colonist, actionType: ActionType): number {
  let mult = 1.0

  // XP level bonus: +5% per level in matching track
  const track = ACTION_TO_XP_TRACK[actionType]
  if (track) {
    mult += (xpLevel(colonist[track]) - 1) * 0.05
  }

  // Skill trait bonus
  mult += getSkillTraitBonus(colonist.skillTrait, actionType)

  // Specialization bonus
  mult += getSpecializationBonus(colonist.specialization, actionType)

  // Morale bonus/penalty
  if (colonist.morale > 80) mult += 0.10
  else if (colonist.morale < 30) mult -= 0.20

  return mult
}

function getSkillTraitBonus(skillTrait: SkillTrait, actionType: ActionType): number {
  switch (skillTrait) {
    case 'steadyHands': return actionType === 'repair' ? 0.20 : 0
    case 'geologist': return actionType === 'extract' ? 0.10 : 0
    case 'fieldMedic': return actionType === 'seek_medical' ? 0.15 : 0
    case 'tinkerer': return actionType === 'engineer' ? 0.15 : 0
    default: return 0
  }
}

function getSpecializationBonus(spec: Specialization | null, actionType: ActionType): number {
  if (!spec) return 0
  switch (spec) {
    case 'prospector': return actionType === 'extract' ? 0.10 : 0
    case 'mechanic': return actionType === 'repair' ? 0.50 : 0 // "50% fewer ticks" = +50% speed
    case 'medic': return actionType === 'seek_medical' ? 1.0 : 0 // 2x healing
    default: return 0
  }
}

// ── Bond Bonus (co-located bonded partner) ──

export function getBondBonus(colonist: Colonist, allColonists: Colonist[]): number {
  if (!colonist.bonds) return 0
  for (const [partnerId, affinity] of Object.entries(colonist.bonds)) {
    if (affinity < BOND_THRESHOLD) continue
    const partner = allColonists.find(c => c.id === partnerId && c.health > 0)
    if (partner && partner.currentZone === colonist.currentZone) {
      return 0.10
    }
  }
  return 0
}

// ── Bond Updates (call once per tick) ──

let bondAccrualCounter = 0
let bondDecayCounter = 0

export function updateBonds(colonists: Colonist[]): void {
  bondAccrualCounter++
  bondDecayCounter++

  const alive = colonists.filter(c => c.health > 0)

  // Accrue affinity every 60s
  if (bondAccrualCounter >= BOND_ACCRUAL_INTERVAL_S) {
    bondAccrualCounter = 0

    // Group colonists by zone
    const byZone = new Map<string, Colonist[]>()
    for (const c of alive) {
      const zone = c.currentZone
      if (!byZone.has(zone)) byZone.set(zone, [])
      byZone.get(zone)!.push(c)
    }

    for (const group of byZone.values()) {
      if (group.length < 2) continue
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i]
          const b = group[j]
          if (!a.bonds) a.bonds = {}
          if (!b.bonds) b.bonds = {}
          a.bonds[b.id] = (a.bonds[b.id] ?? 0) + 1
          b.bonds[a.id] = (b.bonds[a.id] ?? 0) + 1
        }
      }
    }
  }

  // Decay affinity every 120s for non-co-located pairs
  if (bondDecayCounter >= BOND_DECAY_INTERVAL_S) {
    bondDecayCounter = 0
    for (const c of alive) {
      if (!c.bonds) continue
      for (const [partnerId, affinity] of Object.entries(c.bonds)) {
        const partner = alive.find(p => p.id === partnerId)
        if (!partner || partner.currentZone !== c.currentZone) {
          c.bonds[partnerId] = affinity - 1
          if (c.bonds[partnerId] <= 0) delete c.bonds[partnerId]
        }
      }
    }
  }

  // Enforce max bonds
  for (const c of alive) {
    if (!c.bonds) continue
    const entries = Object.entries(c.bonds).filter(([, v]) => v >= BOND_THRESHOLD)
    if (entries.length > MAX_BONDS) {
      entries.sort((a, b) => a[1] - b[1])
      // Remove weakest bonds over the limit
      for (let i = 0; i < entries.length - MAX_BONDS; i++) {
        c.bonds[entries[i][0]] = BOND_THRESHOLD - 1 // drop below threshold
      }
    }
  }
}

// ── Bond Queries ──

export function isBonded(colonist: Colonist, otherId: string): boolean {
  return (colonist.bonds?.[otherId] ?? 0) >= BOND_THRESHOLD
}

export function getBondedPartners(colonist: Colonist): string[] {
  if (!colonist.bonds) return []
  return Object.entries(colonist.bonds)
    .filter(([, v]) => v >= BOND_THRESHOLD)
    .map(([id]) => id)
}

export function getNewBonds(colonist: Colonist): string[] {
  // Check if any partner just crossed the threshold (value exactly 20)
  if (!colonist.bonds) return []
  return Object.entries(colonist.bonds)
    .filter(([, v]) => v === BOND_THRESHOLD)
    .map(([id]) => id)
}

// ── Morale Events ──

export function applyDeathMorale(deadColonist: Colonist, allColonists: Colonist[]): void {
  for (const c of allColonists) {
    if (c.health <= 0 || c.id === deadColonist.id) continue
    if (isBonded(c, deadColonist.id)) {
      c.morale = Math.max(0, c.morale + MORALE_ON_BOND_DEATH)
    } else {
      c.morale = Math.max(0, c.morale + MORALE_ON_DEATH)
    }
    // Clean up bond to dead colonist
    if (c.bonds?.[deadColonist.id]) {
      delete c.bonds[deadColonist.id]
    }
  }
}

export function applyHazardMorale(colonists: Colonist[]): void {
  for (const c of colonists) {
    if (c.health <= 0) continue
    c.morale = Math.max(0, c.morale + MORALE_ON_HAZARD)
  }
}

export function applySurveyReturnMorale(colonistIds: string[], allColonists: Colonist[]): void {
  for (const c of allColonists) {
    if (colonistIds.includes(c.id) && c.health > 0) {
      c.morale = Math.min(100, c.morale + MORALE_ON_SURVEY_RETURN)
    }
  }
}

export function applyOutpostIsolationMorale(colonist: Colonist): void {
  const drain = colonist.skillTrait === 'claustrophobic'
    ? MORALE_OUTPOST_DRAIN_PER_60S * 2
    : MORALE_OUTPOST_DRAIN_PER_60S
  colonist.morale = Math.max(0, colonist.morale + drain)
}

// ── Breakdown Check ──

export function checkBreakdown(colonist: Colonist, nowMs: number): number | null {
  if (colonist.health <= 0) return null
  if (colonist.morale >= BREAKDOWN_THRESHOLD) return null
  if (colonist.lastBreakdownAt && nowMs - colonist.lastBreakdownAt < BREAKDOWN_COOLDOWN_MS) return null
  if (colonist.currentAction?.type === 'rest' || colonist.currentAction?.type === 'socialize') return null

  colonist.lastBreakdownAt = nowMs
  const duration = BREAKDOWN_DURATION_TICKS_MIN +
    Math.floor(Math.random() * (BREAKDOWN_DURATION_TICKS_MAX - BREAKDOWN_DURATION_TICKS_MIN + 1))
  return duration
}

// ── Expertise Label ──

export function getExpertiseLabel(colonist: Colonist): string {
  if (colonist.specialization) {
    const labels: Record<Specialization, string> = {
      prospector: 'Prospector',
      mechanic: 'Mechanic',
      medic: 'Medic',
    }
    return labels[colonist.specialization]
  }

  const tracks: { key: XPTrack; label: string }[] = [
    { key: 'extractionXP', label: 'Extractor' },
    { key: 'engineeringXP', label: 'Engineer' },
    { key: 'medicalXP', label: 'Medic' },
  ]

  let best = tracks[0]
  for (const t of tracks) {
    if (colonist[t.key] > colonist[best.key]) best = t
  }

  if (colonist[best.key] === 0) return ''
  return `${best.label} Lv${xpLevel(colonist[best.key])}`
}
```

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/systems/colonistIdentity.ts
git commit -m "feat(identity): add colonistIdentity system — XP, bonds, morale events, specializations"
```

---

### Task 4: Wire Identity Into Colonist AI

**Files:**
- Modify: `src/systems/colonistAI.ts`

- [ ] **Step 1: Update ColonistLike interface and imports**

Update imports (line 1) to:

```typescript
import type { Action, ActionType, Trait, SkillTrait, Specialization } from '@/types/colonist'
import type { ColonyState, Building, Directive, SupplyDrop } from '@/stores/gameStore'
import { ZONE_FOR_BUILDING, ZONE_MAP, findPath } from '@/systems/mapLayout'
import { getEfficiencyMultiplier, getBondBonus } from '@/systems/colonistIdentity'
```

Update `ColonistLike` (lines 63-71) to include new fields:

```typescript
export interface ColonistLike {
  id: string
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
}
```

- [ ] **Step 2: Apply efficiency multiplier to action duration**

Update `getActionDuration` (lines 165-169) to accept and use the colonist:

```typescript
function getActionDuration(type: ActionType, colonist: ColonistLike): number {
  const [min, max] = DURATION[type]
  const base = min + Math.floor(Math.random() * (max - min + 1))
  const traitMult = TRAIT_MODS[colonist.trait].durationMult
  const efficiency = getEfficiencyMultiplier(colonist as any, type)
  // Higher efficiency = shorter duration
  return Math.max(1, Math.round(base * traitMult / efficiency))
}
```

- [ ] **Step 3: Update advanceAction to pass colonist to getActionDuration**

In `advanceAction` (line 148), update the call:

```typescript
        action.remainingTicks = getActionDuration(action.type, colonist)
```

- [ ] **Step 4: Update selectAction to pass colonist to getActionDuration**

In `selectAction` (line 351), update the call:

```typescript
    remainingTicks: needsWalk ? firstSegmentTicks : getActionDuration(best.type, colonist),
```

- [ ] **Step 5: Add bond utility bonus to selectAction**

In `selectAction`, after the noise loop (after line 330), add bond partner zone preference:

```typescript
  // Bond partner proximity bonus — prefer actions in partner's zone
  if (colonist.bonds) {
    for (const c of candidates) {
      for (const [partnerId, affinity] of Object.entries(colonist.bonds)) {
        if (affinity < 20) continue
        const partner = state.colonists.find(p => p.id === partnerId && p.health > 0)
        if (partner && partner.currentZone === c.targetZone) {
          c.score *= 1.1 // small preference
          break
        }
      }
    }
  }
```

- [ ] **Step 6: Apply Night Owl trait in updateNeeds**

In `updateNeeds` (line 89), wrap the working energy drain with a Night Owl check:

```typescript
      // Working energy drain — Night Owl ignores low-energy penalty
      const nightOwlActive = colonist.skillTrait === 'nightOwl' && colonist.energy < 30
      if (!nightOwlActive) {
        colonist.energy = Math.max(0, colonist.energy - ENERGY_DRAIN_WORKING * mod.energyDrainMult)
      } else {
        colonist.energy = Math.max(0, colonist.energy - ENERGY_DRAIN_WORKING * mod.energyDrainMult * 0.3)
      }
```

Note: This requires adding `skillTrait` to the `ColonistLike` interface (already done in Step 1). The `updateNeeds` function signature takes `ColonistLike` which now includes `skillTrait`.

- [ ] **Step 7: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 8: Commit**

```bash
git add src/systems/colonistAI.ts
git commit -m "feat(identity): wire efficiency multiplier, bond preference, Night Owl into AI"
```

---

### Task 5: Wire Identity Tick Into Game Loop

**Files:**
- Modify: `src/stores/gameStore.ts`

- [ ] **Step 1: Import identity functions**

Add to the imports at the top of `gameStore.ts` (after line 8):

```typescript
import {
  awardXP,
  checkSpecialization,
  updateBonds,
  applyDeathMorale,
  applyHazardMorale,
  checkBreakdown,
  getExpertiseLabel,
} from '@/systems/colonistIdentity'
import { SPECIALIZATION_LABELS } from '@/types/colonist'
```

- [ ] **Step 2: Track deaths and fire morale events**

In the `tick()` action, right before the colonist AI loop (before line 543), add death detection:

```typescript
      // Detect deaths this tick — fire morale events
      const previouslyAlive = this.colonists.filter(c => c.health > 0)
```

Then after the health drain block (after line 651), add:

```typescript
      // Check for deaths that happened this tick
      const nowDead = previouslyAlive.filter(c => c.health <= 0)
      for (const dead of nowDead) {
        applyDeathMorale(dead, this.colonists)
        this.pushMessage(`${dead.name} has died.`, 'critical')
      }
```

- [ ] **Step 3: Add XP accrual on action completion**

In the colonist AI loop (lines 543-555), update the `needsDecision` branch to award XP when an action completes:

```typescript
      // Colonist AI
      for (const c of alive) {
        updateNeeds(c)
        const interrupted = checkInterrupt(c)
        if (!interrupted) {
          const prevAction = c.currentAction?.type
          const needsDecision = advanceAction(c)
          if (needsDecision) {
            // Action just completed — award XP
            if (prevAction) {
              awardXP(c, prevAction)
              const newSpec = checkSpecialization(c)
              if (newSpec) {
                this.pushMessage(`${c.name} has earned the rank of ${SPECIALIZATION_LABELS[newSpec]}.`, 'event')
              }
            }
            // Check for breakdown before selecting next action
            const breakdownTicks = checkBreakdown(c, this.totalPlaytimeMs)
            if (breakdownTicks) {
              c.currentAction = { type: 'rest', targetZone: 'habitat', remainingTicks: breakdownTicks }
              c.currentZone = 'habitat'
              this.pushMessage(`${c.name}: I can't keep going. Need to stop.`, 'info')
            } else {
              c.currentAction = selectAction(c, this.$state)
            }
          }
        } else {
          c.currentAction = selectAction(c, this.$state)
        }
      }
```

- [ ] **Step 4: Add bond updates and idle morale drain to tick**

After the radio chatter call (after line 569), add:

```typescript
      // Update colonist bonds (co-location affinity)
      updateBonds(this.colonists)

      // Idle morale drain — colonists with no productive work lose morale
      for (const c of alive) {
        if (c.currentAction?.type === 'wander' || !c.currentAction) {
          // Track idle time via a simple tick check (every 30 ticks)
          if (this.ticksSinceLastReport % 30 === 0) {
            c.morale = Math.max(0, c.morale - 2)
          }
        }
      }
```

- [ ] **Step 5: Apply hazard morale in checkHazards**

In `checkHazards()`, after the hazard message is pushed (after line 782), add:

```typescript
      // Morale impact from hazard
      applyHazardMorale(this.colonists)
```

- [ ] **Step 6: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat(identity): wire XP accrual, death morale, bonds, breakdowns into game loop"
```

---

### Task 6: Radio Chatter — Identity Messages

**Files:**
- Modify: `src/systems/radioChatter.ts`

- [ ] **Step 1: Add identity-related message templates**

After the `LOW_MORALE` templates (after line 107), add:

```typescript
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
```

- [ ] **Step 2: Add bond and morale chatter to generateChatter**

In `generateChatter`, after the low needs warnings block (after line 239), add:

```typescript
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
          (c as any).bonds?.[o.id] >= 20
        )
        if (bondPartner) {
          emitMessage(c.id, now, emit, fill(pick(BOND_WORKING), {
            name: c.name,
            other: bondPartner.name,
          }))
        }
      }
    }
```

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/systems/radioChatter.ts
git commit -m "feat(identity): add bond, morale, and specialization radio chatter"
```

---

### Task 7: Offline Engine — Identity Support

**Files:**
- Modify: `src/stores/offlineEngine.ts`

- [ ] **Step 1: Update imports**

Add to imports (after line 33):

```typescript
import { randomSkillTrait } from '@/types/colonist'
```

- [ ] **Step 2: Update offline colonist creation**

Update the `newColonist` case (lines 170-178) to include identity fields:

```typescript
        case 'newColonist': {
          const usedNames = new Set(state.colonists.map(c => c.name))
          const available = COLONIST_NAMES.filter(n => !usedNames.has(n))
          const name = available.length > 0
            ? available[Math.floor(rand() * available.length)]
            : `Crew-${state.colonists.length + 1}`
          const traits = ['hardy', 'diligent', 'social', 'cautious', 'efficient', 'stoic'] as const
          state.colonists.push({
            id: uid(), name, health: 100, energy: 80, morale: 70,
            trait: traits[Math.floor(rand() * traits.length)],
            skillTrait: randomSkillTrait(),
            extractionXP: 0, engineeringXP: 0, medicalXP: 0,
            specialization: null, bonds: {}, lastBreakdownAt: null,
            currentAction: null, currentZone: 'habitat',
          })
          break
        }
```

- [ ] **Step 3: Approximate XP accrual during offline simulation**

In `simulateOffline`, find where the per-phase tick loop runs (look for the phase iteration that handles extraction/engineering rates). After the resource calculations in each phase step, add XP approximation.

Find the phase loop that iterates offline ticks and add after resource accumulation:

```typescript
    // Approximate XP accrual during offline
    const alive = state.colonists.filter(c => c.health > 0)
    const ratios = DIRECTIVE_RATIOS[state.activeDirective]
    const extractorCount = Math.round(alive.length * ratios.extractors)
    const engineerCount = Math.round(alive.length * ratios.engineers)

    // Award ~1 XP per 20 ticks (average action duration) to workers
    if (ticksInPhase % 20 === 0) {
      let awarded = 0
      for (const c of alive) {
        if (awarded < extractorCount) {
          c.extractionXP = (c.extractionXP ?? 0) + 1
          awarded++
        } else if (awarded < extractorCount + engineerCount) {
          c.engineeringXP = (c.engineeringXP ?? 0) + 1
          awarded++
        }
      }
    }
```

Note: The exact insertion point depends on the offline engine's phase loop structure. Place this inside the main simulation loop where per-tick work is calculated, using the `ticksThisPhase` or equivalent counter.

- [ ] **Step 4: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/stores/offlineEngine.ts
git commit -m "feat(identity): add identity fields to offline colonist creation and XP approximation"
```

---

### Task 8: Moon Store — Skill Trait Effects on Surveys

**Files:**
- Modify: `src/stores/moonStore.ts`

- [ ] **Step 1: Apply Pathfinder trait to survey travel time**

Find where survey travel time is calculated (in the survey launch function). After travel time is computed, add:

```typescript
    // Pathfinder trait reduces travel time by 25%
    const gameStore = useGameStore()
    const crewColonists = selectedIds.map(id => gameStore.colonists.find(c => c.id === id)).filter(Boolean)
    const hasPathfinder = crewColonists.some(c => c!.skillTrait === 'pathfinder')
    if (hasPathfinder) {
      travelTicks = Math.max(1, Math.round(travelTicks * 0.75))
    }
```

- [ ] **Step 2: Apply Prospector specialization to survey results**

Find where survey deposit quality is determined (in the survey completion handler). After the deposit value/quality is calculated, add:

```typescript
    // Prospector bonus: +15% deposit yield
    const hasProspector = crewColonists.some(c => c!.specialization === 'prospector')
    if (hasProspector) {
      depositAmount = Math.round(depositAmount * 1.15)
    }
```

- [ ] **Step 3: Apply survey return morale**

Import and call `applySurveyReturnMorale` and `applyOutpostIsolationMorale` when a survey mission returns successfully. Add to imports:

```typescript
import { applySurveyReturnMorale, applyOutpostIsolationMorale } from '@/systems/colonistIdentity'
```

In the survey completion handler, after returning colonists to the colony:

```typescript
    applySurveyReturnMorale(mission.colonistIds, gameStore.colonists)
```

- [ ] **Step 4: Apply outpost isolation morale drain**

In `tickOutposts`, inside the per-outpost loop where crew extraction is calculated, add isolation morale drain on a 60s interval:

```typescript
    // Outpost isolation morale drain (every 60s)
    if (outpost.tickCounter % 60 === 0) {
      const gameStore = useGameStore()
      for (const crewId of outpost.crewIds) {
        const colonist = gameStore.colonists.find(c => c.id === crewId)
        if (colonist && colonist.health > 0) {
          applyOutpostIsolationMorale(colonist)
        }
      }
    }
```

Note: If `tickOutposts` doesn't have a per-tick counter on the outpost, use the elapsed time / dtMs to check 60s intervals instead.

- [ ] **Step 5: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/stores/moonStore.ts
git commit -m "feat(identity): apply Pathfinder, Prospector, outpost isolation, and survey return morale"
```

---

### Task 9: Crew Selector — Show Identity Info

**Files:**
- Modify: `src/components/CommandConsole.vue`

- [ ] **Step 1: Import identity helpers**

Add to the script imports:

```typescript
import { getExpertiseLabel } from '@/systems/colonistIdentity'
import { SKILL_TRAIT_LABELS } from '@/types/colonist'
```

- [ ] **Step 2: Update crew selector template**

In the crew selector (the `v-for="col in availableColonists"` loop), update the label content to show trait and expertise:

Replace:
```html
      {{ col.name }}
```

With:
```html
      {{ col.name }}
      <span class="crew-trait">{{ SKILL_TRAIT_LABELS[col.skillTrait] }}</span>
      <span v-if="getExpertiseLabel(col)" class="crew-expertise">{{ getExpertiseLabel(col) }}</span>
```

- [ ] **Step 3: Add minimal styling**

Add to the component's `<style>` block:

```css
.crew-trait {
  color: var(--cyan, #4ecdc4);
  font-size: 0.7rem;
  margin-left: 0.3rem;
  opacity: 0.7;
}

.crew-expertise {
  color: var(--amber, #f5a623);
  font-size: 0.7rem;
  margin-left: 0.3rem;
  opacity: 0.7;
}
```

- [ ] **Step 4: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/components/CommandConsole.vue
git commit -m "feat(identity): show skill trait and expertise in crew selector"
```

---

### Task 10: Iron Stomach Trait & Bond Chatter Integration

**Files:**
- Modify: `src/stores/gameStore.ts`
- Modify: `src/systems/colonistIdentity.ts`

- [ ] **Step 1: Apply Iron Stomach trait to health drain**

In `gameStore.ts`, in the health drain block (around line 640-641), update:

```typescript
          if (c.health > 0) {
            const drainMult = c.skillTrait === 'ironStomach' ? 0.7 : 1.0
            c.health = Math.max(0, c.health - HEALTH_DRAIN_PER_SEC * dt * drainMult)
          }
```

- [ ] **Step 2: Emit bond formation messages from game loop**

In the `tick()` action, after the `updateBonds()` call, add bond formation detection:

```typescript
      // Check for newly formed bonds and emit messages
      for (const c of alive) {
        if (!c.bonds) continue
        for (const [partnerId, affinity] of Object.entries(c.bonds)) {
          if (affinity === 20) { // just crossed threshold
            const partner = this.colonists.find(p => p.id === partnerId)
            if (partner && partner.health > 0) {
              this.pushMessage(`${c.name} and ${partner.name} seem to have each other's rhythm down.`, 'info')
              // Only emit once — partner will have affinity 20 too, skip their message
              break
            }
          }
        }
      }
```

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/stores/gameStore.ts src/systems/colonistIdentity.ts
git commit -m "feat(identity): add Iron Stomach health drain reduction and bond formation messages"
```

---

### Task 11: Final Integration Verification

- [ ] **Step 1: Full build check**

Run: `bun run build`
Expected: Build succeeds with no type errors

- [ ] **Step 2: Manual smoke test**

Run: `bun run dev`

Verify in browser:
1. Start new game — colonists should have skill traits visible
2. Watch colonists work — after ~12-25 ticks of extraction, they should gain 1 XP
3. Open crew selector — should see skill trait and expertise labels
4. Let colonists work in the same zone — bonds should form after ~20 minutes (or test by temporarily lowering `BOND_ACCRUAL_INTERVAL_S`)
5. Trigger a hazard — all colonist morale should drop by 5
6. Check that radio chatter includes high morale messages when morale > 85

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(identity): address integration issues from smoke testing"
```
