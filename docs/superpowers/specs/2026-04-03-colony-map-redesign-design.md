# Colony Map Redesign — Satellite Feed

## Overview

Transform the colony map from an abstract data visualization into a detailed orbital satellite feed. The player is a remote operator watching a live camera — the map should feel like processed satellite imagery, not a game UI. Buildings read as top-down structures, terrain has geological depth, and information layers give the operator at-a-glance situational awareness.

## Terrain

### Detailed Orbital Style

Replace the current layered radial gradients with terrain that reads as a real lunar surface viewed from orbit:

- **Craters:** Shadow gradients on interior walls, rim highlights on the sun-facing edge. Multiple sizes — a few large craters and scattered small ones.
- **Rock formations:** Ridge lines, boulder clusters rendered as subtle ellipses with faint stroke outlines.
- **Dust patterns:** Low-opacity streaks suggesting wind-blown regolith.
- **Elevation shading:** Gentle gradient bands suggesting topography without explicit contour lines.
- **Color palette:** Stay within the existing dark navy/charcoal range (#080c14 to #101828). Terrain features are distinguished by subtle value shifts, not hue.

### Diegetic Zone Cues

Remove artificial zone boundaries (dashed circles) entirely. Zones are communicated through terrain modifications that colonists have made to the surface:

| Zone | Ground Cue |
|------|-----------|
| Habitat | Cleared, flattened regolith patch — smoother than surroundings |
| Extraction | Disturbed earth — faint drill marks, loose debris scatter |
| Landing | Scorch marks — darkened/browned circular blast pattern |
| Power | Flat cleared area — prepared surface for panel placement |
| Life Support | Flat cleared area — similar to power but in its own location |
| Medical | Small cleared patch |
| Workshop | Disturbed ground with material scatter |

These cues are subtle — they suggest human activity without drawing explicit boundaries. The player learns the layout through observation.

### Worn Paths

Keep the existing worn path system (colonist zone transitions tracked in `zonePaths`). Render as before: faint lines between zones with intensity tiers based on traffic count. These are the only structural hint connecting zones — they emerge organically from colonist behavior.

## Buildings

### Geometric Footprints

Replace 30px circles with distinct top-down shapes that suggest each building's function:

| Building | Shape | Description |
|----------|-------|-------------|
| Solar Panel | 3x2 grid of small squares | Panel array footprint |
| O2 Generator | Circle with inner ring | Dome with pressure ring |
| Habitat | Larger circle with inner ring | Main dome, largest building |
| Extraction Rig | Rectangle with protruding arm | Drill housing + boom arm |
| Med Bay | Circle with cross marker | Dome with medical cross |
| Storage Silo | Small rectangle | Compact storage unit |
| Launch Platform | Square with H marking and inner border | Landing pad |
| Parts Factory | Rectangle | Industrial footprint |

These are placeholder geometries. They will eventually be replaced with sprite art, so the layout and info layer system must work independently of the specific visual.

### Shadow Casting

Each building casts a small offset shadow (2-3px, blurred) to ground it on the terrain surface. Shadow direction should be consistent (suggesting a fixed light source — the sun angle).

### Color-Coded Glow

Maintain the existing system-color mapping on building borders and box-shadows:
- Amber: power (solar, launch platform, parts factory)
- Cyan: life support (O2 generator, habitat)
- Green: extraction (extraction rig)
- Red: medical (med bay)
- Muted gray: storage (storage silo)

### Zoom-Dependent Labels

Building labels (SOL, O2, HAB, RIG, MED, SILO, PAD, FAC) appear when zoomed in past a threshold (e.g., zoom > 1.2x). Labels are monospace, small, positioned below the building footprint. At default zoom, the footprint shape and color are sufficient for identification.

## Information Layers

Four layers that compound into an operational picture. Each is subtle individually — they work together through color-coding and spatial association.

### 1. Building Status Pips

Small dot (5px) on the top-right corner of each building:

- **Green:** Operational, no issues
- **Red (pulsing):** Damaged, needs repair
- **Amber with !:** Needs attention — no workers assigned, low output, or other warning condition

Pips are always visible regardless of zoom level (scale inversely with zoom like current markers).

### 2. Resource Flow Lines

Faint animated dashed lines from producer buildings to consumers:

- **Amber dashes:** Power flow from solar panels
- **Cyan dashes:** Air flow from O2 generators
- Animation: slow dash offset movement suggesting flow direction
- Opacity: very low (~0.08) — visible but not distracting
- **Zoom behavior:** Visible at default zoom and above. Fade out when zoomed out below 0.9x.

### 3. Colonist Activity Summary

Compact readout at the bottom-left edge of the map:

```
2 MINING  1 ENGINEER  1 IDLE  1 RESTING
```

- Each count is color-coded to its action color (green for mining, amber for engineering, cyan for idle, etc.)
- Monospace font, small size (~9px), low opacity (~0.3)
- Updates each tick
- Sits alongside existing edge chrome (CREW + DEPTH top-left, LIVE top-center)

### 4. Alert Markers

Persistent pulsing indicators on buildings that need operator attention:

- **Red pulsing circle:** Building is damaged (same as status pip but larger, more prominent — the pip is the steady state, the alert is the "look at me" state)
- **Amber pulsing square with !:** Warning condition (no workers, critically low output)
- Markers pulse with a 1.5s ease-in-out cycle
- These are the "glance and act" signals — see a pulse, tap it, address the issue

## Colonists

### Dots with Movement Trails

- Keep as small dots (5-6px circles)
- Color matches current action (green=mining, amber=engineering, red=medical, cyan=idle, etc.)
- **Movement trail:** When a colonist is walking, render a short fading trail (8px expanding circle that fades out) behind them showing direction of travel
- Existing behavior for hiding colonists during interior actions (extract, engineer, repair, etc.) stays the same
- Individual identity comes from tapping (existing BuildingInfo/ColonistTracker) or comms tab tracking

## Edge Chrome

Unchanged from current implementation:
- **Top-left:** CREW count, DEPTH in meters (monospace, muted)
- **Top-center:** LIVE indicator with blinking red dot
- **Top-right:** Settings gear
- **Bottom-left (new):** Activity summary readout
- **Away indicator:** "N CREW DEPLOYED" when colonists are on survey missions

## Interaction

No changes to existing interaction model:
- Tap building to select and show BuildingInfo overlay with 45-degree elbow connector
- Tap supply drop to show DropInfo
- Pan and zoom (0.8x to 2.0x range)
- Double-tap to reset view
- Colonist tracking triggered from comms tab

## Scope Notes

- **Scanlines overlay:** Keep as a settings toggle (existing behavior)
- **Hazard flash vignette:** Keep as-is
- **MoonMap:** Out of scope for this redesign — colony map (close lens) only
- **Sprites:** Building footprints are geometric placeholders. Sprite replacement is a separate future effort — the info layer system (pips, alerts, labels, flow lines) must work with any building visual.
- **Zone labels toggle:** Remove the zone labels setting since zones are now implicit. The worn path lines setting can stay.
- **Performance:** Resource flow lines use SVG dash animation. If this causes performance issues on mobile, they can be made static or togglable.
