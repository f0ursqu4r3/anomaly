# Ideas

Deep Station is a moon colony idle game where you're a remote operator watching through a satellite feed, sending supplies and directives to keep a colony alive as it surveys and extracts resources from a hostile lunar surface.

## What We Have Now

Core loop: orbital ping (blind, cooldown-based) reveals nearby sectors with terrain and deposit signatures → send survey teams to confirm deposits (risk scales with distance + terrain) → establish outposts at confirmed deposits → outposts extract resources and launch payloads back to colony → order shipments → build infrastructure → manage hazards. Two satellite lenses: close (colony detail) and medium (moon surface with organic terrain rendering). Four directives shift colonist roles between extraction, safety, balanced, and emergency. Three hazard types. Offline simulation catches you up when you return.

Colony buildings: solar panels, O2 generators, extraction rigs, med bays, parts factories. Five terrain types on the moon surface: rocky plains, ice flats, volcanic ridges, craters, canyons — each with distinct deposits and survey risk. Colonists travel to outposts and survey sites, leaving the colony short-staffed. Outpost stockpiles must be launched back via platform.

---

## P0 — Fix the Core Loop

The game can't idle. A playtester left for 45 minutes on the safest directive and returned to a dead colony. Hazards fire too often, there's no passive repair, and the player is forced into permanent emergency protocol. These must land together.

### ~~Pause Button~~ ✓

~~No way to pause. Essential until the idle loop actually works. Simple toggle that freezes the tick loop.~~

### ~~Hazard Rate Tuning~~ ✓

~~Hazards fire roughly every 10 seconds at depth (15s interval × 3% base + depth scaling, but in practice it feels relentless). The base rate needs a survivable floor. Depth scaling should ramp *from* comfortable, not *into* overwhelming. Consider: longer base interval, lower base chance, or a cooldown between consecutive hazards.~~

### ~~Parts Factory~~ ✓

~~New building type: converts metals into repair kits over time.~~ Parts Factory added: 15 metals to build, passive production of 1 kit per 45s (costs 2 metals, requires power). Multiple factories reduce interval. Workshop zone on map.

### ~~Standing Orders~~ ✓

~~Auto-orders from credits when conditions are met.~~ Auto-relaunch implemented: saves last manifest, repeat toggle in shipment panel, auto-sends when cooldown expires. Disables on insufficient credits.

### ~~Repair Kit Targeting~~ ✓

~~Players can't choose which damaged building gets a repair kit.~~ Colonists now use repair kits from inventory and walk to damaged buildings autonomously. Manual targeting deferred to Drop 2.

### ~~Resource Drain Visibility~~ ✓

~~Players can't see: power/O2 consumption per building, total drain rate vs production rate, or repair kit stock.~~ HUD now shows production/consumption breakdown, repair kit count, and tap-to-inspect building info overlay.

### ~~Visual Indicator Clarity~~ ✓

~~Red pulsing dots/borders confused players.~~ Buildings now show wrench badge when damaged. Injured colonists show orange health pip (distinct from building red).

---

## P1 — Deepen What Exists

These add meaningful progression and decision-making to the existing systems without new major mechanics. Each is independently shippable.

### ~~Colonist Identity~~ ✓

~~Colonists are interchangeable. Give them reasons to care.~~ Colonists now have individual identity across five systems:

- **Skill Traits**: 8 traits assigned on arrival (Steady Hands, Geologist, Pathfinder, Field Medic, Claustrophobic, Iron Stomach, Tinkerer, Night Owl). 15% chance of negative trait. Visible in crew selector.
- **Experience**: 3 XP tracks (extraction, engineering, medical). +1 XP per completed action. Levels 1-5, +5% efficiency per level. XP carries across outpost assignments. Offline XP approximation via directive ratios.
- **Morale**: Reactive to colony events — deaths (-15, -30 bonded), hazards (-5), survey returns (+5), outpost isolation (-1/60s, -2 claustrophobic), idle drain. Continuous multiplier: >80 = +10%, <30 = -20%. Breakdown at <15 (30-60s forced rest, 5min cooldown).
- **Relationships**: Co-location affinity (+1/60s), decay when apart (-1/120s). Bond at 20+ affinity (max 3). Bonded pairs: +10% efficiency co-located, -30 morale on partner death, AI prefers partner's zone. Radio chatter on formation and co-working.
- **Specializations**: Auto-unlock at level 3 (25 XP). Prospector (+15% survey yield, +10% extraction), Mechanic (+50% repair speed, -10% hazard damage), Medic (2x healing, passive 1 HP/60s to zone). One per colonist.

### Terrain Mechanics

Five terrain types exist on the moon surface but currently only affect survey risk and deposit type. Make each terrain feel meaningfully different:

- **Rocky Plains**: Baseline. Low risk, common metals. No special mechanics — the "safe" terrain
- **Ice Flats**: Ice deposits primary. Outposts here suffer periodic thermal cycling (equipment degrades faster). Low gravity hazard: colonists move slower
- **Volcanic Ridge**: Rare minerals + metals. High risk. Outposts face magma vents (periodic power drain or building damage). Higher extraction yields to justify the danger
- **Crater Basin**: Rich metals. Moderate risk. Crater walls provide natural shielding (reduced hazard frequency at outposts). Limited visibility — pings reveal less detail in craters
- **Canyon Network**: Mixed deposits. Moderate-high risk. Long travel times (canyon navigation). But canyon outposts are sheltered from surface storms

Each terrain should have distinct visual character on the medium lens (already partially implemented with organic terrain features) and affect outpost operations differently.

### ~~Economy & Trading~~ ✓ (Core)

~~Credits are just shipment currency.~~ Economy reworked — credits now earned primarily through resource exports to HQ:

- ~~**Adjust Current Prices**~~: All prices scaled 10x. Passive income reduced (2cr/sec stipend). Credits are scarce and meaningful.
- ~~**Market Prices**~~: HQ rate bulletins — event-driven rate shifts every 10-15 min (metal demand, ice shortage, rare mineral rush, supply glut, quarterly push). Rates displayed on EXPORT tab.
- ~~**Sell Orders**~~: Export launch platform — colonists load resources, player launches to HQ, credits at current rates. Force-launch option with return penalty. Auto-launch when full.
- **Storage Silos**: Resource caps (50m/25i/10r base). Silos auto-built by engineers. Overflow discarded with warnings.
- **Contracts**: Timed objectives ("Deliver 50 metals in 5 min" → bonus credits). Deferred to future drop.
- **Corporate Sponsors**: Persistent supply chain upgrades. Deferred to future drop.
- **Insurance**: Recurring credit cost to auto-repair one building per hazard. Deferred to future drop.

### Environmental Hazards

Rethink hazards as environmental conditions you prepare for, not random punishment. Most hazards should be terrain-specific and mitigatable with infrastructure:

**Routine environmental conditions** (frequent, mitigatable):

- **High Winds**: Reduces solar output 30% for 30s. Windbreaks (building upgrade) negate this
- **Dust Storm**: Solar panels offline, reduced visibility on medium lens. More common on rocky plains
- **Thermal Cycling**: Equipment at ice flat outposts degrades. Insulated housing (upgrade) prevents it
- **Seismic Tremor**: Brief production pause (5-10s), small building damage chance. More common near volcanic sectors
- **Oxygen Seep**: Air drains 2× for 20s at outposts near canyon faults. Sealed airlocks (upgrade) prevent it

**Rare catastrophic events** (infrequent, high impact, can't fully prevent):

- **Meteor Strike**: Damages a building. Shields reduce damage but can't prevent it
- **Magma Breach** (volcanic sectors): Damages 2-3 buildings at outpost. Very rare
- **Comms Blackout**: No shipments or ping for 90s. Static on satellite feed. Comms relay building reduces duration
- **Compound Events**: Two conditions chain (tremor → surface collapse at nearby outpost)

**Design principle**: A well-prepared colony should handle routine hazards without player intervention. Catastrophic events should be rare enough to feel impactful but not constant.

### Research & Tech Tree

Progression is currently flat (more of same building). Research gives the colony something to work toward:

- **Research Station** building — engineers generate research points
- Tiers gated by sectors surveyed + outposts established + research points
- Example unlocks:
  - **Extended Ping Range**: Reveals sectors 2 rings out instead of 1
  - **Hardened Structures**: -50% damage from environmental hazards
  - **Efficient Recyclers**: Less air per colonist
  - **Automated Outpost Extraction**: Outposts produce at 50% with no crew (still need crew to launch)
  - **Advanced Surveying**: Survey teams return faster, lower incident rate
  - **Rare Mineral Processing**: Colony can refine rare minerals for 10× credit value
  - **Cryo Storage**: Ice capacity + preserved value over time
- Branching choices — can't unlock everything, so runs feel different

---

## P2 — Quality of Life

Polish and convenience. Can be sprinkled in alongside P0/P1 work.

- **Tap colonist** to see stats/role/health tooltip (especially important with Colonist Identity)
- **Tap building** to see production rates, damage, assigned workers
- **Fast-forward**: 2× and 4× game speed for active sessions
- **Statistics screen**: Total metals extracted, hazards survived, sectors surveyed, outposts established, colonists lost, longest survival
- **Message filters**: Toggle message types in comms tab
- **Undo last shipment**: Remove a manifest item without clearing all
- **Pinch-to-zoom** on colony map (medium lens already has pan/zoom)
- **Launch Window vs Cooldown**: Windows of cheaper/faster transit as a timing layer on top of cooldown
- **Directive Flavor Names**: Personality renames (e.g., "Prioritize Extraction" → "Full Extraction")
- **Extraction income scaling**: Currently takes too many rigs to noticeably increase income — review the curve
- **Outpost overview**: Quick-glance list of all outposts with status, crew, stockpile from the medium lens console
- **Survey team tracking**: Better visibility of active missions — ETA, risk level, crew names

---

## P3 — New Building Types

Beyond Parts Factory (P0), these add strategic depth. Some now serve the outpost/survey systems:

**Colony buildings:**

- **Shield Generator**: Reduces hazard damage in its zone. Heavy power draw
- **Comms Relay**: Increases credit income rate. Reduces comms blackout duration. Tier 2 unlocks market trading
- **Crew Quarters**: Increases colonist cap. Passive morale boost
- **Research Station**: Engineers generate research points (gates tech tree)
- ~~**Storage Silo**~~: ✓ Implemented — resource caps (50m/25i/10r base), orderable from HQ (600cr), +100m/+50i/+25r per silo
- **Parts Depot**: Stores repair kits, enables auto-repair if insurance purchased
- **Drone Bay**: Repair drones fix damaged buildings faster during hazards (power + credits)
- **Emergency Shelter**: Colonists auto-shelter during hazards, reduced health damage
- **Recycling Center**: Converts hazard scrap into small metals/ice trickle

**Outpost upgrades** (built at outpost sites, not colony):

- **Windbreak**: Negates wind hazard at outpost
- **Insulated Housing**: Prevents thermal cycling damage at ice flat outposts
- **Sealed Airlocks**: Prevents oxygen seep at canyon outposts
- **Automated Launcher**: Outpost auto-launches payload when stockpile is full
- **Hazard Sensor**: Early warning of incoming hazards at this outpost (15-30s)

---

## P4 — Expansion

### ~~Close Lens (Colony View)~~ ✓

Default isometric colony view — buildings, colonists, supply drops, HUD overlays. Fully implemented.

### ~~Medium Lens (Moon Surface)~~ ✓

Organic terrain map of the moon surface (hex grid under the hood, rendered as continuous terrain with biome-specific features). Blind orbital ping reveals sectors; survey teams confirm deposits; outposts extract and launch payloads. Colony miniature shows building/colonist positions. Pan/zoom with fixed-size markers. Controls in command console, not overlaid on map. Implemented and toggles from the HUD.

### Far Lens (Multi-Colony Overview)

Far view shows multiple colony sites across the moon — planned, not yet implemented:

- **Multiple sites** on moon surface, semi-independent
- **Resource sharing**: Shuttle between colonies (transit time by distance)
- **Specialization**: Extraction colony, life support colony, research colony
- **Colony founding**: Large resource cost to establish new site
- **Shared hazards**: Moon-wide events affect all colonies
- **Leaderboard**: Per-colony stats comparison

### Surface Expeditions

Send teams beyond outpost range to explore the moon:

- **Expedition system**: Multi-day missions to distant POIs (abandoned equipment, ice caves, ruins)
- **Expedition risk**: Farther = longer travel + higher risk. Terrain affects route difficulty
- **Salvage**: Find broken equipment, repair instead of ordering (cheaper, needs engineer time)
- **Radar upgrades**: Periodic scan reveals new POIs. Research extends range
- **Rival Outpost**: Discover another corporation's abandoned site. Salvage or compete

---

## P5 — Endgame & Replayability

Once the core loop has enough depth:

### Prestige / New Game+

- **Evacuation**: Trigger voluntary end when you've extracted enough value. Score = sectors surveyed + outposts established + credits + colonists alive + time survived
- **Operator Rating**: Accumulates across runs, unlocks cosmetic satellite feed filters
- **Starting Bonuses**: Completed runs give persistent bonuses (extra credits, faster first shipment, free building, pre-surveyed sectors)
- **Moon Selection**: Different surface compositions (ice-rich, metal-heavy, volatile) change strategy. Some moons have more volcanic terrain, others more canyons
- **Mission Objectives**: Optional per-run goals ("Survey 10 sectors without losing a colonist", "Establish 5 outposts in 30 minutes") for bonus prestige

### Notifications & Engagement

- **Push Notifications**: "Colony air critical", "Shipment arrived", "Survey team returned", "Outpost depleted"
- **Daily Briefing**: Summary notification of overnight performance
- **Scheduled Shipments**: Queue auto-launch on timer while away
- **Shift Reports**: Expand with graphs (resource levels over time, sectors surveyed curve, outpost production history)
