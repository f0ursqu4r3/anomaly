# Colonist AI Realism Overhaul

**Goal:** Make colonists feel like real people watched through a satellite feed — natural rhythms, human pacing, visible personality — without noticeably degrading colony productivity.

**Design priorities:**
1. Atmosphere/immersion (colony looks alive)
2. Subtle productivity impact (not punishing)
3. Key moments surface via chatter and movement; routine behavior is just patterns the player notices over time

---

## 1. Focus Meter

New per-colonist meter (0–100) representing mental stamina. Creates natural work streaks followed by break periods.

### Drain

- Working actions (extract, engineer, repair, construct, load): **-2.5/tick**
- Trait modifiers on drain rate:
  - Diligent: 0.8x drain (stays focused longer)
  - Social: 1.3x drain (loses focus faster)
  - Stoic: 0.9x drain
  - Others: 1.0x

### Recovery

| Activity   | Rate/tick |
|------------|-----------|
| Rest       | +2.0      |
| Socialize  | +1.5      |
| Eat        | +1.0      |
| Wander     | +0.5      |
| Transition | +0.3      |

### Thresholds

- **Focus < 25 ("unfocused"):** Work utility scores multiplied by 0.4x. Colonist naturally drifts toward a break.
- **Focus < 10 ("depleted"):** Colonist will not select work actions at all. Soft interrupt — not forced, but work scores effectively zero.
- Full recovery during a rest cycle (~30-40 ticks).

### Emergent Behavior

Colonists work in 40-80 tick streaks, then take 15-30 tick breaks. Different colonists desync due to trait variation and action timing, creating staggered shifts across the colony.

### Initialization

New colonists start with focus 80-100 (random) to desync from each other immediately.

---

## 2. Hunger & Eating

New per-colonist hunger meter (0–100) and `eat` action. Creates periodic foot traffic to the habitat.

### Drain

- Passive: **-0.3/tick** (~330 ticks / 5.5 minutes from full to hungry threshold)
- Iron Stomach trait: 0.7x drain rate (consistent with existing health drain reduction)

### Thresholds

- **Hunger < 40 ("hungry"):** Work utility penalty 0.8x. Colonist starts preferring a break soon.
- **Hunger < 15 ("starving"):** Work utility penalty 0.3x. Colonist will almost always go eat.

### Eat Action

- **New ActionType:** `eat`
- **Target zone:** habitat
- **Duration:** 8-15 ticks
- **Restores:** Hunger to 80-95 (random, not always full — adds variance)
- **Side effects:** +5-10 focus, +2-3 morale (meals are a natural reset)

### Utility Scoring

| Condition | Base Score |
|-----------|-----------|
| Hunger > 40 | 5 (background candidate, almost never wins) |
| Hunger 15-40 | 30 + (40 - hunger) * 1.5 |
| Hunger < 15 | 120 |

### Emergent Behavior

Every ~5 minutes, colonists trickle back to habitat in ones and twos. Not synchronized — different start hunger values and Iron Stomach trait create natural staggering.

### Initialization

New colonists start with hunger 70-100 (random) for immediate desync.

---

## 3. Transition Pauses

Brief idle period between completing one action and selecting the next. Colonists linger in their current zone before moving on.

### Duration

| Context | Pause (ticks) |
|---------|---------------|
| After long work action (>20 ticks) | 3-5 |
| After short action or rest | 2-3 |
| After socializing | 1-2 |

### Trait Modifiers

- Social: +1 tick (lingers)
- Efficient: always 1-2 ticks (moves quickly)

### Implementation

- New field `transitionTicks` on colonist (countdown, 0 = not in transition)
- When action completes, set `transitionTicks` based on context instead of immediately calling `selectAction()`
- Each tick, if `transitionTicks > 0`: decrement, apply trickle recovery (+0.3 energy, +0.3 focus)
- When `transitionTicks` hits 0: call `selectAction()` as normal

### Bond Detour

During a transition pause, if a bonded partner (affinity >= 20) is in an adjacent zone:
- ~20% chance the colonist walks to that zone (3-5 tick visit)
- After the visit, `selectAction()` runs from the partner's zone
- Creates visible "checking in on a friend" movement

---

## 4. Work Memory & Restlessness

Colonists track recent work and get restless doing the same thing repeatedly.

### Tracking

- New field `actionHistory: ActionType[]` — rolling last 5 completed actions
- Only **work actions** are tracked: extract, engineer, repair, construct, load
- Break actions (rest, eat, socialize, seek_medical, wander) are NOT tracked

### Restlessness Penalties

| Repetition (same type in last 5) | Utility Penalty |
|----------------------------------|-----------------|
| 3 of 5 | 0.7x on that action type |
| 4+ of 5 | 0.5x on that action type |

### Trait Modifiers

- **Diligent:** Threshold shifts to 4/5 (happy to grind longer)
- **Stoic:** No restlessness (doesn't care about variety)
- **Social:** Threshold shifts to 2/5 (bores easily)

### Emergent Behavior

Instead of a geologist mining 10 times in a row, they mine 3-4 times, rotate to engineering or loading for a cycle, then drift back. Colony looks like people naturally rotating between tasks.

### Override

Urgent needs still win. Repair (score 80), construct (75), and emergency multipliers (3x) easily override the 0.5-0.7x restlessness penalty. Colonists still respond to crises — they just don't robotically grind the same task during normal operations.

---

## 5. Surfacing to the Player

### Map Movement

- **Transition pauses:** Colonists linger in-zone after finishing work (visual layer sees them idle)
- **Eat breaks:** Periodic foot traffic toward habitat
- **Bond detours:** Brief visits to adjacent zones
- **Work rotation:** Colonists move between more zones over time instead of shuttling habitat ↔ one work zone

### Radio Chatter

New triggers added to existing chatter system. Each fires at ~30% probability to avoid spam.

| Trigger | Example |
|---------|---------|
| Hunger (going to eat) | "Park heading to the hab — stomach's growling." |
| Focus depleted | "Chen clocking out for a breather." |
| Restlessness task switch | "Reeves switching to the platform — been on the rigs all day." |
| Bond detour | "Martinez swung by life support — checking on Park." |
| Return from break | "Chen back on the rigs, looking sharp." |

### Colonist Detail Overlay

- Show **focus** and **hunger** bars alongside existing energy/morale/health
- Show a **mood label** derived from current state: "Focused", "Hungry", "Restless", "Tired", "Content"

Mood label derivation (first matching condition):
1. Hunger < 15 → "Starving"
2. Energy < 10 → "Exhausted"
3. Morale < 10 → "Breaking"
4. Hunger < 40 → "Hungry"
5. Focus < 10 → "Burned Out"
6. Energy < 30 → "Tired"
7. Morale < 25 → "Stressed"
8. Focus < 25 → "Unfocused"
9. Focus > 75 AND energy > 60 → "Focused"
10. Morale > 75 → "Content"
11. Default → "Okay"

### What Stays Invisible

- Exact utility scores and penalties
- Action history array
- Internal thresholds and multipliers
- Transition tick countdown

---

## 6. Data Model Changes

### New Colonist Fields

```typescript
focus: number        // 0-100, init 80-100 random
hunger: number       // 0-100, init 70-100 random
actionHistory: ActionType[]  // rolling last 5 work actions
transitionTicks: number      // countdown, 0 = not transitioning
```

### New ActionType

```typescript
'eat'  // added to ActionType union
```

### New Constants

```typescript
// Focus
FOCUS_DRAIN_WORKING = 2.5
FOCUS_RECOVERY_REST = 2.0
FOCUS_RECOVERY_SOCIAL = 1.5
FOCUS_RECOVERY_EAT = 1.0
FOCUS_RECOVERY_WANDER = 0.5
FOCUS_RECOVERY_TRANSITION = 0.3
FOCUS_LOW = 25
FOCUS_DEPLETED = 10

// Hunger
HUNGER_DRAIN = 0.3
HUNGER_HUNGRY = 40
HUNGER_STARVING = 15

// Transitions
TRANSITION_PAUSE_SHORT = [2, 3]   // [min, max] ticks
TRANSITION_PAUSE_LONG = [3, 5]
BOND_DETOUR_CHANCE = 0.2

// Restlessness
RESTLESS_THRESHOLD = 3
RESTLESS_PENALTY = 0.7
RESTLESS_HEAVY_THRESHOLD = 4
RESTLESS_HEAVY_PENALTY = 0.5
```

### Trait Modifiers (additions to TraitMod)

```typescript
focusDrainMult: number    // diligent 0.8, social 1.3, stoic 0.9, others 1.0
restlessThreshold: number // diligent 4, social 2, stoic 99 (immune), others 3
transitionMult: number    // social 1.5, efficient 0.5, others 1.0
```

### Save Compatibility

New fields get defaults on load for existing saves:
- `focus`: 80
- `hunger`: random 70-100
- `actionHistory`: `[]`
- `transitionTicks`: 0

No migration needed — missing fields are populated with defaults during save load.

---

## 7. Productivity Impact Assessment

| Mechanic | Time Off-Task | Offset Strategy |
|----------|--------------|-----------------|
| Focus breaks | ~15-30 ticks per 60-80 tick work streak | Already overlaps with existing rest cycles |
| Eat breaks | ~12 ticks per ~330 ticks | ~3-4% overhead |
| Transition pauses | ~3 ticks per action cycle | ~1-2% overhead |
| Restlessness rotation | Same work time, occasionally suboptimal task | Negligible — efficiency loss <5% |

**Total estimated overhead: ~5-7%.** Can be offset by a ~10% bump to extraction/engineering base rates if playtesting shows the colony feels sluggish. Recommend playtesting first before adjusting rates.

---

## 8. Files to Modify

1. **`src/types/colonist.ts`** — Add `eat` to ActionType, add new fields to colonist type
2. **`src/systems/colonistAI.ts`** — Focus/hunger in `updateNeeds()`, transition pause logic, eat action scoring, restlessness penalties in `selectAction()`, bond detour logic
3. **`src/stores/gameStore.ts`** — Initialize new fields on colonist creation, handle save/load defaults, add eat action to tick processing
4. **`src/systems/colonistIdentity.ts`** — Add focus drain multipliers to trait system
5. **`src/systems/radioChatter.ts`** (or equivalent) — New chatter triggers
6. **`src/components/ColonistOverlay.vue`** (or equivalent) — Focus/hunger bars, mood label
7. **`src/composables/useColonistMovement.ts`** — Handle transition idle state and bond detour movement
