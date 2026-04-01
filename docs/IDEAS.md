# Ideas

Deep Station is a moon colony idle game where you're a remote operator watching through a satellite feed, sending supplies and directives to keep a colony alive as it surveys and extracts resources from a hostile lunar surface.

## What We Have Now

Core loop: orbital ping (blind, cooldown-based) reveals nearby sectors with terrain and deposit signatures → send survey teams to confirm deposits (risk scales with distance + terrain) → establish outposts at confirmed deposits → outposts extract resources and launch payloads back to colony → order shipments → build infrastructure → manage hazards. Two satellite lenses: close (colony detail) and medium (moon surface hex grid with organic terrain rendering). Four directives shift colonist roles between extraction, safety, balanced, and emergency. Three hazard types scale with depth. Offline simulation catches you up when you return.

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

### Colonist Identity

Colonists are interchangeable. Give them reasons to care:

- **Traits**: 1-2 on arrival ("Steady Hands" +20% repair speed, "Claustrophobic" health drains in cramped outposts, "Geologist" +10% ice find)
- **Experience**: XP in current role over time. Leveled extractors extract faster, leveled engineers repair quicker
- **Morale**: Affected by deaths, hazards, crowding, idle time. Low = slower. High = small bonus. Events in message log ("Riko and Juno argued", "Sable found a crystal — crew spirits lifted")
- **Relationships**: Co-workers in same zone build rapport → small efficiency bonus
- **Specializations**: At level thresholds (Extractor → Blaster, Engineer → Medic)

### Depth Zones & Biomes

Partially implemented — sector terrain types on the moon surface already define distinct extraction environments. Expanding these into full biome progression:

- **Regolith Plains**: Baseline, tutorial-safe
- **Iron Vein Sectors**: 1.5× metals, new hazard: surface collapse
- **Crystal Shelf Sectors**: 2× ice chance, more gas pockets
- **Thermal Zone Sectors**: Power drain increase, magma breach hazard
- **Deep Core Sectors**: Extreme hazards, rare minerals worth 10× credits
- Visual shift per terrain type (color tint, particles on extraction zone)
- Zone transitions trigger satellite alerts

### Economy & Trading

Credits are just shipment currency. Make them interesting:

- **Market Prices**: Ice/metal prices fluctuate on a cycle (ticker in comms tab)
- **Sell Orders**: Sell stockpiled metals/ice at current market rate
- **Contracts**: Timed objectives ("Deliver 50 metals in 5 min" → bonus credits)
- **Corporate Sponsors**: Persistent upgrades to supply chain (faster transit, cheaper shipments, larger cargo, shorter cooldowns)
- **Insurance**: Recurring credit cost to auto-repair one building per hazard

### Expanded Hazards

Three types gets repetitive. Add variety that changes how you respond:

- **Surface Collapse**: Blocks extraction zone 30-60s, extractors must clear rubble
- **Dust Storm**: Solar panels offline 30s
- **Radiation Burst**: Health damage to colonists outside habitat, 15s
- **Equipment Failure**: One building at 50% efficiency for 60s (degraded, not broken)
- **Seismic Tremor**: All production pauses 5-10s, small building damage chance
- **Magma Breach** (deep sectors): Damages 2-3 buildings, extremely rare in surface sectors
- **Comms Blackout**: No shipments for 90s, static on satellite feed
- **Oxygen Leak**: Air drains 3× for 20s, engineers can patch faster
- **Compound Events**: Two hazards chain (tremor → collapse)
- **Hazard Warning**: Research unlock — see incoming hazard 15-30s early

### Research & Tech Tree

Progression is currently flat (more of same building). Research gives the colony something to work toward:

- **Research Station** building — engineers generate research points
- Tiers gated by sector depth milestones + research points
- Example unlocks: Reinforced Hulls (-50% meteor damage), Deep Core Scanners (hazard preview), Efficient Recyclers (less air per colonist), Automated Extraction (2× output, more power), Cryo Storage (ice capacity + value)
- Branching choices — can't unlock everything, so runs feel different

---

## P2 — Quality of Life

Polish and convenience. Can be sprinkled in alongside P0/P1 work.

- **Tap colonist** to see stats/role/health tooltip
- **Tap building** to see production rates, damage, assigned workers
- **Fast-forward**: 2× and 4× game speed for active sessions
- **Statistics screen**: Total metals extracted, hazards survived, sectors surveyed, longest survival
- **Message filters**: Toggle message types in comms tab
- **Undo last shipment**: Remove a manifest item without clearing all
- **Pinch-to-zoom** on colony map
- **Launch Window vs Cooldown**: Windows of cheaper/faster transit as a timing layer on top of cooldown
- **Directive Flavor Names**: Personality renames (e.g., "Prioritize Extraction" → "Full Extraction")
- **Extraction income scaling**: Currently takes too many rigs to noticeably increase income — review the curve

---

## P3 — New Building Types

Beyond Parts Factory (P0), these add strategic depth:

- **Shield Generator**: Reduces hazard damage in its zone. Heavy power draw
- **Comms Relay**: Increases credit income rate. Tier 2 unlocks market trading
- **Crew Quarters**: Increases colonist cap (if added). Passive morale boost
- **Research Station**: Engineers generate research points (gates tech tree)
- **Storage Silo**: Metal/ice capacity (requires adding caps first)
- **Parts Depot**: Stores repair kits, enables auto-repair if insurance purchased
- **Drone Bay**: Repair drones fix damaged buildings faster during hazards (power + credits)
- **Hazard Sensor**: Early warning of incoming hazards (research upgrade)
- **Recycling Center**: Converts hazard scrap into small metals/ice trickle
- **Automated Turret**: Chance to deflect meteors. Requires power + ammo
- **Thermal Vent Tap** (thermal sectors): Power without solar dependency
- **Terraforming Module**: Long-term project, -20% hazard frequency in zone
- **Emergency Shelter**: Colonists auto-shelter during hazards, reduced health damage
- **Extraction Outpost**: Secondary extraction site, simultaneous extraction in two zones

---

## P4 — Zoom Levels & Expansion

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

---

## P5 — Endgame & Replayability

Once the core loop has enough depth:

### Prestige / New Game+

- **Evacuation**: At extreme extraction depth, trigger voluntary end. Score = sectors surveyed + credits + colonists + time
- **Operator Rating**: Accumulates across runs, unlocks cosmetic satellite feed filters
- **Starting Bonuses**: Completed runs give persistent bonuses (extra credits, faster first shipment, free building)
- **Moon Selection**: Different surface compositions (ice-rich, metal-heavy, volatile) change strategy
- **Mission Objectives**: Optional per-run goals ("Survey 10 sectors without losing a colonist") for bonus prestige

### Notifications & Engagement

- **Push Notifications**: "Colony air critical", "Shipment arrived", "Survey complete"
- **Daily Briefing**: Summary notification of overnight performance
- **Scheduled Shipments**: Queue auto-launch on timer while away
- **Shift Reports**: Expand with graphs (resource levels over time, sectors surveyed curve)
