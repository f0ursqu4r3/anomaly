# Ideas

Deep Station is an asteroid colony idle game where you're a remote operator watching through a satellite feed, sending supplies and directives to keep a colony alive as it drills deeper into hostile rock.

## What We Have Now

Core loop: drill → earn metals/ice/credits → order shipments → build infrastructure → manage hazards → drill deeper. Four directives shift colonist roles between mining, safety, balanced, and emergency. Three hazard types scale with depth. Offline simulation catches you up when you return.

---

## P0 — Fix the Core Loop

The game can't idle. A playtester left for 45 minutes on the safest directive and returned to a dead colony. Hazards fire too often, there's no passive repair, and the player is forced into permanent emergency protocol. These must land together.

### ~~Pause Button~~ ✓

~~No way to pause. Essential until the idle loop actually works. Simple toggle that freezes the tick loop.~~

### ~~Hazard Rate Tuning~~ ✓

~~Hazards fire roughly every 10 seconds at depth (15s interval × 3% base + depth scaling, but in practice it feels relentless). The base rate needs a survivable floor. Depth scaling should ramp *from* comfortable, not *into* overwhelming. Consider: longer base interval, lower base chance, or a cooldown between consecutive hazards.~~

### Parts Factory

New building type: converts metals into repair kits over time. Without passive repair generation, the colony has zero self-healing — the player must manually ship repair kits every cooldown cycle or everything decays. This is the single most important building to add.

- Cost: ~20 metals, 5 ice
- Requires power, engineer assignment
- Produces 1 repair kit per ~30-45s

### Standing Orders

"Always maintain N repair kits" or "auto-ship supply crates when metals < X" — auto-orders from credits when conditions are met. Without this, the player rebuilds the same manifest every 60 seconds. Could start simple: just auto-relaunch last manifest when cooldown expires.

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

- **Traits**: 1-2 on arrival ("Steady Hands" +20% repair speed, "Claustrophobic" health drains below 500m, "Geologist" +10% ice find)
- **Experience**: XP in current role over time. Leveled drillers drill faster, leveled engineers repair quicker
- **Morale**: Affected by deaths, hazards, crowding, idle time. Low = slower. High = small bonus. Events in message log ("Riko and Juno argued", "Sable found a crystal — crew spirits lifted")
- **Relationships**: Co-workers in same zone build rapport → small efficiency bonus
- **Specializations**: At level thresholds (Driller → Blaster, Engineer → Medic)

### Depth Zones & Biomes

Drilling should feel like exploration, not just a number going up:

- **0–100m**: Regolith — baseline, tutorial-safe
- **100–300m**: Iron Vein — 1.5× metals, new hazard: cave-in
- **300–600m**: Crystal Shelf — 2× ice chance, more gas pockets
- **600–1000m**: Thermal Layer — power drain increase, magma breach hazard
- **1000m+**: Core Proximity — extreme hazards, rare minerals worth 10× credits
- Visual shift per zone (color tint, particles on drill site)
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

- **Cave-In**: Blocks drill site 30-60s, drillers must clear rubble
- **Dust Storm**: Solar panels offline 30s
- **Radiation Burst**: Health damage to colonists outside habitat, 15s
- **Equipment Failure**: One building at 50% efficiency for 60s (degraded, not broken)
- **Seismic Tremor**: All production pauses 5-10s, small building damage chance
- **Magma Breach** (600m+): Damages 2-3 buildings, extremely rare shallow
- **Comms Blackout**: No shipments for 90s, static on satellite feed
- **Oxygen Leak**: Air drains 3× for 20s, engineers can patch faster
- **Compound Events**: Two hazards chain (tremor → cave-in)
- **Hazard Warning**: Research unlock — see incoming hazard 15-30s early

### Research & Tech Tree

Progression is currently flat (more of same building). Research gives the colony something to work toward:

- **Research Station** building — engineers generate research points
- Tiers gated by depth milestones + research points
- Example unlocks: Reinforced Hulls (-50% meteor damage), Deep Core Scanners (hazard preview), Efficient Recyclers (less air per colonist), Automated Drills (2× output, more power), Cryo Storage (ice capacity + value)
- Branching choices — can't unlock everything, so runs feel different

---

## P2 — Quality of Life

Polish and convenience. Can be sprinkled in alongside P0/P1 work.

- **Tap colonist** to see stats/role/health tooltip
- **Tap building** to see production rates, damage, assigned workers
- **Fast-forward**: 2× and 4× game speed for active sessions
- **Statistics screen**: Total metals mined, hazards survived, deepest drill, longest survival
- **Message filters**: Toggle message types in comms tab
- **Undo last shipment**: Remove a manifest item without clearing all
- **Pinch-to-zoom** on colony map
- **Launch Window vs Cooldown**: Windows of cheaper/faster transit as a timing layer on top of cooldown
- **Directive Flavor Names**: Personality renames (e.g., "Prioritize Mining" → "Drill Baby Drill")
- **Drill income scaling**: Currently takes too many drills to noticeably increase income — review the curve

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
- **Thermal Vent Tap** (600m+): Power without solar dependency
- **Terraforming Module**: Long-term project, -20% hazard frequency in zone
- **Emergency Shelter**: Colonists auto-shelter during hazards, reduced health damage
- **Mining Outpost**: Secondary drill site, simultaneous drilling in two zones

---

## P4 — Zoom Levels & Expansion

Major scope expansion. Don't start until P0-P1 are solid.

### Surrounding Area (Zoom Level 2)

Medium zoom reveals terrain around the colony:

- **Surface Expeditions**: Send teams to explore nearby POIs (abandoned equipment, ice deposits, ruins)
- **Expedition Risk**: Farther = longer travel + higher risk
- **Salvage**: Find broken equipment, repair instead of order (cheaper, needs engineer time)
- **Radar Ping**: Periodic scan reveals new POIs. Research extends range
- **Rival Outpost**: Trade or compete with another corporation's colony

### Multi-Colony (Zoom Level 3)

Far view shows multiple colony sites:

- **Multiple sites** on asteroid surface, semi-independent
- **Resource sharing**: Shuttle between colonies (transit time by distance)
- **Specialization**: Mining colony, life support colony, research colony
- **Colony founding**: Large resource cost to establish new site
- **Shared hazards**: Asteroid-wide events affect all colonies
- **Leaderboard**: Per-colony stats comparison

---

## P5 — Endgame & Replayability

Once the core loop has enough depth:

### Prestige / New Game+

- **Evacuation**: At extreme depth, trigger voluntary end. Score = depth + credits + colonists + time
- **Operator Rating**: Accumulates across runs, unlocks cosmetic satellite feed filters
- **Starting Bonuses**: Completed runs give persistent bonuses (extra credits, faster first shipment, free building)
- **Asteroid Selection**: Different compositions (ice-rich, metal-heavy, volatile) change strategy
- **Mission Objectives**: Optional per-run goals ("Reach 500m without losing a colonist") for bonus prestige

### Notifications & Engagement

- **Push Notifications**: "Colony air critical", "Shipment arrived", "New depth milestone"
- **Daily Briefing**: Summary notification of overnight performance
- **Scheduled Shipments**: Queue auto-launch on timer while away
- **Shift Reports**: Expand with graphs (resource levels over time, depth progress curve)
