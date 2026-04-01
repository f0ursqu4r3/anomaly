# Colonist Identity — Design Spec

## Overview

Transform colonists from interchangeable workers into individuals the player cares about. Five interlocking sub-systems layered onto the existing colonist architecture (personality traits, AI-driven action selection, radio chatter).

## 1. Skill Traits

The existing 6 personality traits (`hardy`, `diligent`, `social`, `cautious`, `efficient`, `stoic`) remain — they drive AI utility scoring. A new **skill trait** layer is added: each colonist receives 1 skill trait on arrival.

| Skill Trait | Effect |
|---|---|
| Steady Hands | +20% repair speed |
| Geologist | +10% extraction yield |
| Pathfinder | -25% survey travel time |
| Field Medic | +15% med bay healing rate |
| Claustrophobic | Morale drains 2x at outposts |
| Iron Stomach | -30% health drain from resource crises |
| Tinkerer | +15% parts factory output when assigned to workshop |
| Night Owl | No energy drain penalty at low energy (works longer before resting) |

- Negative traits (Claustrophobic) have ~15% spawn chance.
- Skill traits are immutable after assignment.
- Stored as a new `skillTrait` field on the `Colonist` interface (separate from existing `trait`).

## 2. Experience / XP System

Each colonist tracks XP across three action categories:

- `extractionXP` — earned by completing `extract` actions
- `engineeringXP` — earned by completing `engineer` or `repair` actions
- `medicalXP` — earned by completing med bay healing actions

**Accrual**: 1 XP per completed action (not per tick).

**Levels**: Thresholds `[0, 10, 25, 50, 100]` → levels 1–5. Each level grants +5% efficiency to that action type (additive).

**Dominant track**: Highest XP track determines displayed expertise label (e.g., "Extractor Lv3").

**Persistence**: XP carries across outpost assignments. Offline simulation approximates XP accrual using directive ratios.

## 3. Morale Rework

Morale (existing 0–100 field) becomes reactive to colony events instead of draining/recovering passively.

### Morale Modifiers

| Event | Effect |
|---|---|
| Colonist death | -15 all colonists, -30 bonded partners |
| Hazard event | -5 colonists at affected location |
| Successful survey return | +5 returning crew |
| Outpost isolation | -1 per 60s (x2 for Claustrophobic) |
| Idle 30+ ticks | -2 per 30 ticks |
| Socializing (completed action) | +3 (existing behavior, unchanged) |
| Co-located with bonded partner | +1 per 60s |

### Work Speed Multiplier

- Morale > 80: +10% efficiency
- Morale 30–80: no modifier
- Morale < 30: -20% efficiency
- Morale < 15: **breakdown** — refuses work 30–60s, walks to habitat. Max once per 5 minutes per colonist.

### Radio Chatter

- Death grief: `"{name}: ...I can't believe {dead} is gone."`
- Low morale: `"{name}: What's the point of all this."`
- High morale: `"{name}: Feeling sharp today. Let's get it done."`
- Breakdown: `"{name}: I can't keep going. Need to stop."`

## 4. Relationships (Lightweight Bonds)

### Affinity Tracking

Each colonist has a `bonds: Record<string, number>` map keyed by other colonist IDs. Starts at 0.

### Accrual & Decay

- Co-located in same zone or outpost: +1 affinity per 60s toward each other.
- Not co-located: -1 per 120s (bonds can break over long separation).
- Bond threshold: affinity >= 20 (~20 minutes co-location).
- Max 3 bonds per colonist. If a 4th would form, oldest excess bond decays.

### Effects

- Bonded pair in same zone: +10% efficiency for both (additive with other bonuses).
- Death of bonded partner: -30 morale (replaces standard -15).
- Bonded colonists get small utility bonus toward actions in partner's zone (AI scoring).

### Radio Chatter

- Bond formed: `"{name} and {other} seem to have each other's rhythm down."`
- Working with bond: `"{name}: Good to have {other} on shift."`
- Bond partner death: `"{name}: {dead} and I... we had a good thing going."`

### Display

Bonds visible via future tap-to-inspect colonist feature (P2). No dedicated relationship screen.

## 5. Specializations

When a colonist's dominant XP track reaches level 3 (25 XP), they auto-unlock a specialization.

| Track | Specialization | Effect |
|---|---|---|
| Extraction | Prospector | +15% survey deposit yield, +10% extraction rate |
| Engineering | Mechanic | Repairs cost 50% fewer ticks, -10% hazard damage to buildings in their zone |
| Medical | Medic | 2x healing rate, passively heals adjacent colonists in same zone (1 HP/60s) |

- One specialization per colonist (first track to hit 25 locks in).
- Replaces generic expertise label ("Extractor Lv3" → "Prospector").
- Effects stack with skill traits and XP bonuses (all additive).
- Colonists can still perform any action; specialization only applies to matching type.
- Radio message on unlock: `"{name} has earned the rank of Prospector."` (event severity)

### Outpost/Survey Interactions

- Prospectors on survey teams → better deposit quality.
- Mechanics at outposts → reduced hazard damage.
- Medics at outposts → crew stays healthier.

## 6. Bonus Stacking

All efficiency bonuses are **additive** to avoid runaway scaling:

```
totalMultiplier = 1.0
  + (xpLevel * 0.05)          // +5% per level, max +25%
  + skillTraitBonus            // e.g., +0.10 for Geologist
  + moraleBonus                // +0.10 or -0.20
  + bondBonus                  // +0.10 if bonded partner co-located
  + specializationBonus        // e.g., +0.10 for Prospector
```

Maximum theoretical bonus: ~70% (level 5 + matching skill trait + high morale + bond + specialization). Realistic in practice: 30-40%.

## 7. Data Model Changes

### Colonist Interface (additions)

```typescript
export interface Colonist {
  // ... existing fields ...
  skillTrait: SkillTrait
  extractionXP: number
  engineeringXP: number
  medicalXP: number
  specialization: Specialization | null
  bonds: Record<string, number>
  lastBreakdownAt: number | null  // timestamp, for 5-min cooldown
}
```

### New Types

```typescript
type SkillTrait = 'steadyHands' | 'geologist' | 'pathfinder' | 'fieldMedic'
  | 'claustrophobic' | 'ironStomach' | 'tinkerer' | 'nightOwl'

type Specialization = 'prospector' | 'mechanic' | 'medic'
```

### Save Migration (v4 → v5)

Backfill existing colonists:
- `skillTrait`: assign random
- XP fields: 0
- `specialization`: null
- `bonds`: {}
- `lastBreakdownAt`: null

## 8. Systems Affected

- **colonistAI.ts**: XP accrual on action completion, morale event modifiers, bond utility bonus, specialization efficiency multipliers, breakdown state handling
- **gameStore.ts**: Morale event triggers (death, hazard), colonist creation with skill traits, save migration, bonus calculation helpers
- **moonStore.ts**: Skill trait effects on survey travel time (Pathfinder), specialization effects on survey results (Prospector) and outpost operations (Mechanic, Medic)
- **radioChatter.ts**: New message templates for bonds, morale states, breakdowns, specialization unlocks
- **offlineEngine.ts**: XP approximation, specialization unlock checks during offline catch-up
- **types/colonist.ts**: New types (SkillTrait, Specialization), skill trait definitions with effect values
- **UI components**: Colonist labels/tooltips showing skill trait + expertise/specialization (minimal — detailed display deferred to P2 tap-to-inspect)
