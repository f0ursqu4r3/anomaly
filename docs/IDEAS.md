# Ideas

Deep Station is an asteroid colony idle game where you're a remote operator watching through a satellite feed, sending supplies and directives to keep a colony alive as it drills deeper into hostile rock.

## What We Have Now

Core loop: drill → earn metals/ice/credits → order shipments → build infrastructure → manage hazards → drill deeper. Four directives shift colonist roles between mining, safety, balanced, and emergency. Three hazard types scale with depth. Offline simulation catches you up when you return.

---

## Future Depth Ideas

### Research & Tech Tree

Right now progression is flat — more buildings of the same type. A research system would give the colony something to work toward:

- **Research Station** building type — engineers assigned here generate research points over time
- Unlock tiers gated by depth milestones + research points
- Example unlocks:
  - Reinforced Hulls (reduce meteor damage chance by 50%)
  - Deep Core Scanners (preview hazards 30s before they hit)
  - Efficient Recyclers (reduce air consumption per colonist)
  - Automated Drills (drill rigs produce at 2× but consume more power)
  - Cryo Storage (increase ice capacity, ice sells for more)
- Tech choices create branching strategies — you can't unlock everything, so runs feel different

### Depth Zones & Biomes

Drilling should feel like exploration, not just a number going up:

- **0–100m**: Regolith — baseline rates, tutorial-safe zone
- **100–300m**: Iron Vein — metals per depth increases 1.5×, new hazard: cave-in (traps drillers for 30s)
- **300–600m**: Crystal Shelf — ice chance doubles, but gas pocket frequency increases
- **600–1000m**: Thermal Layer — power drain increases, new hazard: magma breach (damages multiple buildings)
- **1000m+**: Core Proximity — extreme hazards but rare minerals worth 10× credits
- Each zone has a visual shift on the map (color tint, particle effects on the drill site)
- Zone transitions trigger a satellite alert/event

### Colonist Depth

Colonists are currently interchangeable stat-less workers. Give them identity:

- **Traits**: Each colonist gets 1-2 traits on arrival (e.g., "Steady Hands" +20% repair speed, "Claustrophobic" health drains faster below 500m, "Geologist" +10% ice find chance when drilling)
- **Experience**: Colonists gain XP in their current role over time. Leveled drillers drill faster, leveled engineers repair quicker
- **Morale**: Affected by deaths, hazards, crowding, idle time. Low morale = slower work. High morale = small production bonus. Morale events in the message log ("Riko and Juno had an argument", "Sable found a crystal formation — crew spirits lifted")
- **Relationships**: Colonists who work the same zone together build rapport. Paired colonists get a small efficiency bonus
- **Specializations**: At level thresholds, colonists can specialize (Driller → Blaster for faster but riskier drilling, Engineer → Medic for healing bonus)

### Advanced Hazards

Three hazard types gets repetitive. Expand the threat model:

- **Seismic Tremor**: All production pauses for 5-10s, chance to damage buildings scales with depth
- **Dust Storm** (surface): Solar panels produce 0 power for 30s
- **Radiation Burst**: Colonists outside habitat take health damage, engineers must shelter
- **Equipment Malfunction**: Random building operates at 50% for 60s (not fully broken, just degraded)
- **Cave-In**: Blocks drill site — drillers must dig out before drilling resumes (time-based)
- **Compound Events**: Two hazards can chain (tremor → cave-in, radiation → equipment malfunction)
- **Hazard Warning System**: Research unlock that shows incoming hazard type 15-30s before it hits, letting you switch directives proactively

### Economy & Trading

Credits are currently just a shipment currency. Make them more interesting:

- **Market Prices**: Ice and metal prices fluctuate on a cycle (displayed as a ticker in the comms tab)
- **Sell Orders**: Manually sell stockpiled metals/ice at current market rate via uplink
- **Contracts**: Timed objectives ("Deliver 50 metals within 5 minutes" → bonus credits). Appear in comms tab, accept/decline
- **Corporate Sponsors**: Spend credits on persistent upgrades to your orbital supply chain (faster transit, cheaper shipments, larger cargo capacity, shorter cooldowns)
- **Insurance**: Pay a recurring credit cost to auto-repair one building per hazard

### Multi-Colony (Zoom Level 3)

The satellite has three planned zoom levels. The far view could show:

- **Multiple colony sites** on the asteroid surface — each one is a semi-independent operation
- **Resource sharing**: Shuttle metals/ice between colonies (transit time based on distance)
- **Specialization**: One colony focused on mining, another on life support production, a third on research
- **Colony founding**: Spend a large amount of resources to establish a new colony site
- **Shared hazards**: Asteroid-wide events (solar flare, orbital debris field) affect all colonies simultaneously
- **Leaderboard**: Each colony has stats — compare depth, efficiency, survival time

### Surrounding Area (Zoom Level 2)

The medium zoom could reveal the terrain around the colony:

- **Surface Expeditions**: Send a colonist team to explore nearby points of interest (abandoned equipment, ice deposits, alien ruins)
- **Expedition Risk**: Farther targets = longer travel + higher risk of encounter/hazard
- **Salvage**: Find broken equipment that can be repaired instead of ordered (cheaper but needs engineer time)
- **Radar Ping**: Periodic scan reveals new POIs. Research upgrades extend radar range
- **Rival Outpost**: Another corporation's colony — trade with them or compete for resources in shared zones

### Notifications & Engagement

For an idle game, the return loop matters:

- **Push Notifications**: "Colony air critical — intervene now", "Shipment arrived", "New depth milestone reached"
- **Daily Briefing**: Summary notification of overnight colony performance
- **Scheduled Shipments**: Queue shipments to auto-launch on a timer while away
- **Standing Orders**: "Always maintain 2 repair kits in reserve" — auto-orders when credits allow
- **Shift Reports**: Already have this — expand with graphs (resource levels over time, depth progress curve)

### Prestige / New Game+

Once the core loop is deep enough, add replayability:

- **Evacuation**: At extreme depth, trigger colony evacuation (voluntary end). Score based on max depth, total credits, colonists alive, time survived
- **Operator Rating**: Accumulated across runs, unlocks cosmetic satellite feed filters (night vision, thermal, retro green CRT)
- **Starting Bonuses**: Each completed run gives a small persistent bonus (start with extra credits, faster first shipment, one free building)
- **Asteroid Selection**: Different asteroids with different compositions (ice-rich, metal-heavy, volatile) change the meta-strategy
- **Mission Objectives**: Optional goals per run ("Reach 500m without losing a colonist", "Complete a run using only emergency directive") for bonus prestige

### Quality of Life

Small things that would make the game feel more polished:

- **Pinch-to-zoom** on the colony map (smooth zoom between detail levels)
- **Tap colonist** to see their stats/role/health in a tooltip
- **Tap building** to see production rates and damage status
- **Fast-forward**: 2× and 4× game speed for active play sessions
- **Statistics screen**: Total metals mined, hazards survived, colonists recruited, deepest drill, longest survival
- **Message filters**: Toggle message types in comms (hide status updates, show only hazards)
- **Undo last shipment**: Cancel a manifest item without clearing everything

## Building Types

Potential new buildings beyond the current four:

- **Research Station**: Generates research points when engineers are assigned
- **Storage Silo**: Increases metal/ice capacity (currently uncapped — add caps first?)
- **Shield Generator**: Reduces hazard damage in its zone. Consumes heavy power
- **Comms Relay**: Increases credit income rate. Unlocks market trading at tier 2
- **Crew Quarters**: Increases colonist cap (if we add one). Passive morale boost
- **Automated Turret**: Chance to deflect meteor strikes before they hit. Requires power + ammo (new resource?)
- **Thermal Vent Tap**: Only buildable in thermal zone (600m+). Generates power without solar dependency

## Hazards

Expanded hazard roster beyond meteor/surge/gas:

- **Cave-In**: Blocks drill site for 30-60s. Drillers must clear rubble
- **Dust Storm**: Surface event — solar panels offline for 30s
- **Radiation Burst**: Health damage to all colonists not in habitat. Lasts 15s
- **Equipment Failure**: One building at 50% efficiency for 60s
- **Seismic Tremor**: All production pauses 5-10s. Small chance of building damage
- **Magma Breach** (deep): Damages 2-3 buildings. Extremely rare above 600m
- **Comms Blackout**: No shipments can be launched for 90s. Satellite feed gets static overlay
- **Oxygen Leak**: Air drains at 3× rate for 20s. Engineers can find and patch the leak faster
