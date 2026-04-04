# Colony Map Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the colony map from abstract circles and dashed zones into a detailed orbital satellite feed with terrain depth, building footprints, and operational info layers.

**Architecture:** The map is one component tree rooted at `ColonyMap.vue`. We'll replace terrain CSS, swap `MapBuilding.vue` from circles to footprint shapes, add a new `MapTerrain.vue` SVG layer for craters/rocks/zone cues, add info layers (status pips, flow lines, activity summary, alert markers) as new SVG/HTML within `ColonyMap.vue`, and update `MapColonist.vue` dot sizes.

**Tech Stack:** Vue 3 + TypeScript, inline SVG, CSS custom properties

---

### Task 1: Replace Map Background with Orbital Terrain

**Files:**
- Create: `src/components/MapTerrain.vue`
- Modify: `src/components/ColonyMap.vue`

The terrain layer is an SVG that renders craters, rock formations, boulders, dust streaks, and diegetic zone cues. It replaces the current CSS background gradients and dashed zone circles.

- [ ] **Step 1: Create MapTerrain.vue**

This component renders the full terrain SVG. It uses the zone positions from `mapLayout.ts` to place diegetic cues at the right locations.

```vue
<template>
  <svg class="map-terrain" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
    <defs>
      <!-- Crater shadow gradient -->
      <radialGradient id="crater-shadow" cx="45%" cy="40%">
        <stop offset="0%" stop-color="rgba(8,12,20,0.5)" />
        <stop offset="70%" stop-color="rgba(15,20,30,0.2)" />
        <stop offset="100%" stop-color="transparent" />
      </radialGradient>
      <radialGradient id="crater-shadow-sm" cx="45%" cy="40%">
        <stop offset="0%" stop-color="rgba(8,12,20,0.35)" />
        <stop offset="100%" stop-color="transparent" />
      </radialGradient>
    </defs>

    <!-- Large craters -->
    <circle cx="82" cy="78" r="8" fill="url(#crater-shadow)" />
    <circle cx="82" cy="78" r="7.5" fill="none" stroke="rgba(80,90,110,0.12)" stroke-width="0.3" />
    <!-- Rim highlight (sun-facing edge, upper-left) -->
    <path d="M76,73 Q78,71 81,72" fill="none" stroke="rgba(100,110,130,0.1)" stroke-width="0.4" stroke-linecap="round" />

    <circle cx="15" cy="15" r="5" fill="url(#crater-shadow-sm)" />
    <circle cx="15" cy="15" r="4.5" fill="none" stroke="rgba(80,90,110,0.08)" stroke-width="0.2" />

    <!-- Small craters scattered -->
    <circle cx="60" cy="88" r="2.5" fill="url(#crater-shadow-sm)" stroke="rgba(80,90,110,0.06)" stroke-width="0.15" />
    <circle cx="90" cy="30" r="2" fill="url(#crater-shadow-sm)" stroke="rgba(80,90,110,0.06)" stroke-width="0.15" />
    <circle cx="8" cy="55" r="1.5" fill="url(#crater-shadow-sm)" stroke="rgba(80,90,110,0.05)" stroke-width="0.1" />

    <!-- Rock ridges -->
    <path d="M5,82 Q12,78 20,80 Q25,82 30,79" fill="none" stroke="rgba(80,90,110,0.08)" stroke-width="0.5" stroke-linecap="round" />
    <path d="M70,92 Q78,88 85,90 Q90,92 95,88" fill="none" stroke="rgba(80,90,110,0.07)" stroke-width="0.4" stroke-linecap="round" />
    <path d="M88,45 Q92,42 96,44" fill="none" stroke="rgba(80,90,110,0.06)" stroke-width="0.3" stroke-linecap="round" />

    <!-- Boulder clusters -->
    <ellipse cx="92" cy="60" rx="1.2" ry="0.8" fill="rgba(30,35,45,0.4)" stroke="rgba(80,90,110,0.06)" stroke-width="0.1" />
    <ellipse cx="93.5" cy="61.5" rx="0.8" ry="0.5" fill="rgba(28,33,43,0.3)" stroke="rgba(80,90,110,0.05)" stroke-width="0.08" />
    <ellipse cx="10" cy="35" rx="1" ry="0.6" fill="rgba(30,35,45,0.35)" stroke="rgba(80,90,110,0.05)" stroke-width="0.08" />
    <ellipse cx="42" cy="12" rx="0.9" ry="0.5" fill="rgba(28,33,43,0.3)" stroke="rgba(80,90,110,0.05)" stroke-width="0.08" />

    <!-- Elevation shading bands -->
    <path d="M0,75 Q25,68 50,72 Q75,76 100,70" fill="none" stroke="rgba(70,80,100,0.04)" stroke-width="1.5" />
    <path d="M0,35 Q20,30 45,33 Q70,37 100,32" fill="none" stroke="rgba(70,80,100,0.03)" stroke-width="1.2" />

    <!-- Dust streaks -->
    <line x1="35" y1="8" x2="45" y2="12" stroke="rgba(70,80,100,0.03)" stroke-width="0.8" stroke-linecap="round" />
    <line x1="75" y1="55" x2="82" y2="58" stroke="rgba(70,80,100,0.025)" stroke-width="0.7" stroke-linecap="round" />
    <line x1="55" y1="90" x2="48" y2="95" stroke="rgba(70,80,100,0.03)" stroke-width="0.6" stroke-linecap="round" />

    <!-- Diegetic zone cues -->
    <!-- Habitat: cleared regolith -->
    <ellipse :cx="zones.habitat.x" :cy="zones.habitat.y" rx="11" ry="8" fill="rgba(20,25,35,0.25)" stroke="rgba(60,70,85,0.04)" stroke-width="0.3" />

    <!-- Extraction: disturbed earth with drill marks -->
    <ellipse :cx="zones.extraction.x" :cy="zones.extraction.y" rx="11" ry="8" fill="rgba(22,28,38,0.2)" />
    <line :x1="zones.extraction.x - 5" :y1="zones.extraction.y - 2" :x2="zones.extraction.x - 3" :y2="zones.extraction.y + 3" stroke="rgba(52,211,153,0.03)" stroke-width="0.4" />
    <line :x1="zones.extraction.x + 2" :y1="zones.extraction.y - 3" :x2="zones.extraction.x + 4" :y2="zones.extraction.y + 2" stroke="rgba(52,211,153,0.03)" stroke-width="0.3" />

    <!-- Landing: scorch marks -->
    <ellipse :cx="zones.landing.x" :cy="zones.landing.y" rx="7" ry="6" fill="rgba(25,20,15,0.15)" />
    <circle :cx="zones.landing.x" :cy="zones.landing.y" r="3" fill="none" stroke="rgba(80,60,30,0.06)" stroke-width="0.6" />

    <!-- Power: flat cleared area -->
    <ellipse :cx="zones.power.x" :cy="zones.power.y" rx="9" ry="6" fill="rgba(20,25,35,0.18)" />

    <!-- Life Support: flat cleared area -->
    <ellipse :cx="zones.lifeSup.x" :cy="zones.lifeSup.y" rx="9" ry="6" fill="rgba(20,25,35,0.18)" />

    <!-- Medical: small cleared patch -->
    <ellipse :cx="zones.medical.x" :cy="zones.medical.y" rx="7" ry="5" fill="rgba(20,25,35,0.15)" />

    <!-- Workshop: disturbed ground -->
    <ellipse :cx="zones.workshop.x" :cy="zones.workshop.y" rx="8" ry="6" fill="rgba(22,28,38,0.18)" />
    <line :x1="zones.workshop.x - 3" :y1="zones.workshop.y + 1" :x2="zones.workshop.x + 2" :y2="zones.workshop.y - 2" stroke="rgba(245,158,11,0.02)" stroke-width="0.3" />
  </svg>
</template>

<script setup lang="ts">
import { ZONE_MAP } from '@/systems/mapLayout'

const zones = ZONE_MAP
</script>

<style scoped>
.map-terrain {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}
</style>
```

- [ ] **Step 2: Update ColonyMap.vue background and add terrain layer**

In `ColonyMap.vue`, replace the complex radial gradient background with a simpler orbital base, remove the noise pseudo-element, remove the dashed zone circles from the SVG overlay, and remove the habitat ring. Add `MapTerrain` as the first child inside `.map-content`.

In the template, add the import and component:

After the `<div class="map-content" :style="transformStyle">` opening tag, before the zone overlay SVG, add:
```vue
<MapTerrain />
```

Remove the zone boundary circles from the SVG overlay (keep only worn paths):
```vue
<!-- Zone boundaries and paths (SVG) -->
<svg
  class="zone-overlay"
  :class="{ 'high-contrast': settings.highContrast }"
  viewBox="0 0 100 100"
  preserveAspectRatio="xMidYMid meet"
>
  <!-- Worn paths from colonist traffic -->
  <line
    v-for="(p, i) in wornPaths"
    :key="'path-' + i"
    :x1="p.x1"
    :y1="p.y1"
    :x2="p.x2"
    :y2="p.y2"
    :stroke="`rgba(200, 200, 200, ${p.opacity})`"
    :stroke-width="p.width"
    stroke-linecap="round"
  />
</svg>
```

Remove the zone labels template block (lines 65-79), the habitat ring div (line 81), and the static path edge lines (the `v-if="settings.pathLines"` template block).

In the script, remove the `pathEdges` computed since it's no longer used. Remove `zones` const since zone labels are gone.

In the style section, replace the `.colony-map` background with:
```css
.colony-map {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  container-type: size;
  background:
    radial-gradient(ellipse at 30% 60%, rgba(25,30,40,0.95) 0%, transparent 35%),
    radial-gradient(ellipse at 70% 35%, rgba(20,25,35,0.85) 0%, transparent 30%),
    radial-gradient(ellipse at 50% 50%, rgba(18,22,32,0.4) 0%, transparent 60%),
    linear-gradient(160deg, #080c14 0%, #0c1220 40%, #101828 60%, #080e18 100%);
  box-shadow: inset 0 0 120px rgba(0, 0, 0, 0.6);
}
```

Remove the `::before` pseudo-element (noise texture, lines 383-401).

Remove these CSS rules that are no longer needed:
- `.zone-marker` (zone labels)
- `.habitat-ring`
- `.zone-overlay.high-contrast line` and `.zone-overlay.high-contrast circle` (simplify to just the line variant since circles are gone)

Add the import in the script section:
```ts
import MapTerrain from './MapTerrain.vue'
```

- [ ] **Step 3: Remove zoneLabels setting reference**

In `src/stores/settingsStore.ts`, the `zoneLabels` setting can remain in the interface for now (removing it would break saved settings). But remove the `v-if="settings.zoneLabels"` template usage already handled in step 2.

- [ ] **Step 4: Verify the map renders**

Run: `bun run dev`

Open the app. Confirm:
- Orbital terrain background shows (dark with subtle gradients)
- Craters and rock features are visible but subtle
- Zone cues (cleared patches, scorch marks) appear at zone locations
- No dashed zone circles or zone labels visible
- No habitat ring
- Worn paths still render between zones
- Buildings and colonists still display correctly

- [ ] **Step 5: Commit**

```bash
git add src/components/MapTerrain.vue src/components/ColonyMap.vue
git commit -m "feat: replace map background with orbital terrain and diegetic zone cues"
```

---

### Task 2: Building Footprints

**Files:**
- Modify: `src/components/MapBuilding.vue`

Replace the 30px circle sprites with distinct geometric footprints per building type. Each has a shadow, type-specific shape, and consistent color glow.

- [ ] **Step 1: Rewrite MapBuilding template**

Replace the entire template with footprint-based rendering. Each building type gets a unique SVG shape inside the sprite container.

```vue
<template>
  <div
    class="map-building"
    :class="[typeClass, { damaged: building.damaged, constructing: isConstructing, 'just-completed': justCompleted }]"
    :style="{ left: building.x + '%', top: building.y + '%', transform: `translate(-50%, -50%) scale(var(--marker-scale, 1)) rotate(${building.rotation || 0}deg)` }"
    @click.stop="emit('select', building)"
  >
    <div class="building-shadow" />
    <div class="building-footprint">
      <!-- Solar: 3x2 panel grid -->
      <svg v-if="building.type === 'solar'" class="fp-svg" viewBox="0 0 28 20">
        <rect v-for="r in 2" v-bind:key="'r'+r" v-for-second="c in 3" :x="1 + (c-1)*9" :y="1 + (r-1)*10" width="8" height="9" rx="0.5" fill="currentColor" fill-opacity="0.5" stroke="currentColor" stroke-opacity="0.7" stroke-width="0.5" />
      </svg>
      <!-- O2 Generator: dome with inner ring -->
      <svg v-else-if="building.type === 'o2generator'" class="fp-svg fp-circle" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="10" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-opacity="0.6" stroke-width="1" />
        <circle cx="11" cy="11" r="5" fill="none" stroke="currentColor" stroke-opacity="0.3" stroke-width="0.5" />
      </svg>
      <!-- Extraction Rig: rect with arm -->
      <svg v-else-if="building.type === 'extractionrig'" class="fp-svg" viewBox="0 0 32 18">
        <rect x="1" y="1" width="24" height="16" rx="1.5" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-opacity="0.6" stroke-width="1" />
        <rect x="25" y="5" width="6" height="2" rx="0.5" fill="currentColor" fill-opacity="0.5" />
      </svg>
      <!-- Med Bay: dome with cross -->
      <svg v-else-if="building.type === 'medbay'" class="fp-svg fp-circle" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="9" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-opacity="0.5" stroke-width="1" />
        <path d="M10 5v10M5 10h10" stroke="currentColor" stroke-opacity="0.6" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <!-- Storage Silo: small rect -->
      <svg v-else-if="building.type === 'storageSilo'" class="fp-svg" viewBox="0 0 16 12">
        <rect x="1" y="1" width="14" height="10" rx="1" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-opacity="0.5" stroke-width="0.8" />
        <line x1="1" y1="5" x2="15" y2="5" stroke="currentColor" stroke-opacity="0.2" stroke-width="0.5" />
      </svg>
      <!-- Launch Platform: square with H -->
      <svg v-else-if="building.type === 'launchplatform'" class="fp-svg" viewBox="0 0 26 26">
        <rect x="1" y="1" width="24" height="24" rx="2" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.5" stroke-width="1.2" />
        <rect x="5" y="5" width="16" height="16" rx="1" fill="none" stroke="currentColor" stroke-opacity="0.25" stroke-width="0.5" />
        <text x="13" y="17" text-anchor="middle" fill="currentColor" fill-opacity="0.35" font-family="var(--font-mono)" font-size="10" font-weight="700">H</text>
      </svg>
      <!-- Parts Factory: rectangle -->
      <svg v-else-if="building.type === 'partsfactory'" class="fp-svg" viewBox="0 0 24 16">
        <rect x="1" y="1" width="22" height="14" rx="1.5" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-opacity="0.6" stroke-width="1" />
        <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-opacity="0.25" stroke-width="0.5" />
        <circle cx="16" cy="8" r="2" fill="none" stroke="currentColor" stroke-opacity="0.25" stroke-width="0.5" />
      </svg>
      <!-- Fallback: simple rect -->
      <svg v-else class="fp-svg" viewBox="0 0 20 20">
        <rect x="1" y="1" width="18" height="18" rx="2" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-opacity="0.5" stroke-width="1" />
      </svg>
    </div>
    <!-- Status pip -->
    <div class="status-pip" :class="statusClass" />
    <!-- Zoom-dependent label -->
    <div v-if="showLabel" class="building-label">{{ shortLabel }}</div>
    <div v-if="building.damaged" class="dmg-badge">
      <SvgIcon name="repair" size="xs" />
    </div>
    <div v-if="isConstructing" class="construction-bar">
      <div class="construction-fill" :style="{ width: (building.constructionProgress! * 100) + '%' }" />
    </div>
    <div v-if="workerCount > 0" class="worker-pips">
      <span v-for="n in workerCount" :key="n" class="worker-pip" :class="typeClass" />
    </div>
  </div>
</template>
```

Note: The solar panel grid uses nested loops. Since Vue doesn't support `v-for` nesting on the same element, render the 6 rects explicitly:

```vue
<!-- Solar: 3x2 panel grid -->
<svg v-if="building.type === 'solar'" class="fp-svg" viewBox="0 0 28 20">
  <rect x="1" y="1" width="8" height="8" rx="0.5" fill="currentColor" fill-opacity="0.5" stroke="currentColor" stroke-opacity="0.7" stroke-width="0.5" />
  <rect x="10" y="1" width="8" height="8" rx="0.5" fill="currentColor" fill-opacity="0.5" stroke="currentColor" stroke-opacity="0.7" stroke-width="0.5" />
  <rect x="19" y="1" width="8" height="8" rx="0.5" fill="currentColor" fill-opacity="0.5" stroke="currentColor" stroke-opacity="0.7" stroke-width="0.5" />
  <rect x="1" y="11" width="8" height="8" rx="0.5" fill="currentColor" fill-opacity="0.5" stroke="currentColor" stroke-opacity="0.7" stroke-width="0.5" />
  <rect x="10" y="11" width="8" height="8" rx="0.5" fill="currentColor" fill-opacity="0.5" stroke="currentColor" stroke-opacity="0.7" stroke-width="0.5" />
  <rect x="19" y="11" width="8" height="8" rx="0.5" fill="currentColor" fill-opacity="0.5" stroke="currentColor" stroke-opacity="0.7" stroke-width="0.5" />
</svg>
```

- [ ] **Step 2: Update MapBuilding script**

Add the new computed properties and keep existing ones. Add after existing computed properties:

```ts
const SHORT_LABELS: Record<string, string> = {
  solar: 'SOL',
  o2generator: 'O2',
  extractionrig: 'RIG',
  medbay: 'MED',
  storageSilo: 'SILO',
  launchplatform: 'PAD',
  partsfactory: 'FAC',
}

const shortLabel = computed(() => SHORT_LABELS[props.building.type] || '???')

const showLabel = computed(() => {
  // Label visibility controlled by parent via CSS custom property --marker-scale
  // At zoom > 1.2, marker-scale < 0.83, labels show via CSS
  // For now, always render — CSS controls visibility via zoom threshold
  return true
})

const statusClass = computed(() => {
  if (props.building.damaged) return 'status-damaged'
  if (isConstructing.value) return 'status-constructing'
  if (workerCount.value === 0 && !isConstructing.value && props.building.constructionProgress === null) {
    // Operational but no workers — warn for buildings that need workers
    const needsWorkers = ['extractionrig', 'launchplatform'].includes(props.building.type)
    if (needsWorkers) return 'status-warning'
  }
  return 'status-ok'
})
```

Remove the `iconName` computed (no longer using SvgIcon for the sprite). Remove the SvgIcon import if it's only used for the building sprite — but keep it since the dmg-badge still uses it.

- [ ] **Step 3: Rewrite MapBuilding styles**

Replace the entire `<style scoped>` section:

```css
.map-building {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: auto;
  cursor: pointer;
  z-index: 2;
}

.building-shadow {
  position: absolute;
  inset: -1px;
  transform: translate(1.5px, 1.5px);
  filter: blur(3px);
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
  pointer-events: none;
}

.building-footprint {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fp-svg {
  width: 30px;
  height: auto;
  display: block;
}

/* Type colors */
.type-solar { color: var(--amber); }
.type-o2generator { color: var(--cyan); }
.type-extractionrig { color: var(--green); }
.type-medbay { color: var(--red); }
.type-partsfactory { color: var(--amber); }
.type-storageSilo { color: var(--text-secondary, #888); }
.type-launchplatform { color: var(--amber); }

/* Glow per type */
.type-solar .building-footprint { filter: drop-shadow(0 0 4px var(--amber-glow)); }
.type-o2generator .building-footprint { filter: drop-shadow(0 0 4px var(--cyan-glow)); }
.type-extractionrig .building-footprint { filter: drop-shadow(0 0 4px var(--green-glow)); }
.type-medbay .building-footprint { filter: drop-shadow(0 0 4px var(--red-glow)); }
.type-partsfactory .building-footprint { filter: drop-shadow(0 0 4px var(--amber-glow)); }
.type-launchplatform .building-footprint { filter: drop-shadow(0 0 4px var(--amber-glow)); }
.type-storageSilo .building-footprint { filter: drop-shadow(0 0 3px rgba(136,136,136,0.1)); }

/* Status pip */
.status-pip {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  z-index: 1;
}

.status-ok {
  background: var(--green);
  box-shadow: 0 0 4px rgba(52, 211, 153, 0.5);
}

.status-damaged {
  background: var(--red);
  box-shadow: 0 0 6px rgba(233, 69, 96, 0.6);
  animation: pip-pulse 1.5s ease-in-out infinite;
}

.status-warning {
  background: var(--amber);
  box-shadow: 0 0 5px rgba(245, 158, 11, 0.5);
}

.status-constructing {
  background: var(--amber);
  box-shadow: 0 0 4px rgba(245, 158, 11, 0.4);
  opacity: 0.6;
}

@keyframes pip-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.3); }
}

/* Building label (zoom-dependent via CSS) */
.building-label {
  position: absolute;
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-mono);
  font-size: 0.5rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: currentColor;
  opacity: 0.6;
  white-space: nowrap;
  pointer-events: none;
  /* Hidden at default zoom, visible when zoomed in (marker-scale < 0.83 means zoom > 1.2) */
  display: none;
}

/* Show labels when zoomed in — parent sets --marker-scale */
@container (min-width: 1px) {
  /* Can't query custom properties in container queries, so we use a class toggle instead.
     The parent ColonyMap will add .zoomed-in class when zoom > 1.2 */
}

/* Construction */
.constructing .building-footprint {
  opacity: 0.35;
  animation: construct-pulse 2s ease-in-out infinite;
}

.just-completed .building-footprint {
  animation: complete-burst 1.2s ease-out forwards;
}

@keyframes complete-burst {
  0% { filter: drop-shadow(0 0 15px currentColor); transform: scale(1.15); }
  40% { filter: drop-shadow(0 0 25px currentColor); }
  100% { filter: drop-shadow(0 0 4px currentColor); transform: scale(1); }
}

@keyframes construct-pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.5; }
}

/* Damage */
.damaged .building-footprint {
  animation: dmg-pulse 1.5s ease-in-out infinite;
}

@keyframes dmg-pulse {
  0%, 100% { filter: drop-shadow(0 0 6px var(--red-glow)); }
  50% { filter: drop-shadow(0 0 15px var(--red-glow)); }
}

.dmg-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 14px;
  height: 14px;
  border-radius: var(--radius-xs);
  background: var(--red);
  color: var(--bg-deep);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 6px var(--red);
  animation: feed-blink 1s ease-in-out infinite;
  z-index: 2;
}

.dmg-badge .svg-icon {
  width: 10px;
  height: 10px;
}

@keyframes feed-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

/* Construction bar */
.construction-bar {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 3px;
  background: rgba(100, 100, 100, 0.3);
  border-radius: 2px;
  overflow: hidden;
}

.construction-fill {
  height: 100%;
  background: var(--amber);
  border-radius: var(--radius-xs);
  transition: width 1s linear;
}

/* Worker pips */
.worker-pips {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
}

.worker-pip {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 4px currentColor;
}

.worker-pip.type-solar { color: var(--amber); }
.worker-pip.type-o2generator { color: var(--cyan); }
.worker-pip.type-extractionrig { color: var(--green); }
.worker-pip.type-medbay { color: var(--red); }
.worker-pip.type-partsfactory { color: var(--amber); }
.worker-pip.type-launchplatform { color: var(--amber); }
.worker-pip.type-storageSilo { color: var(--text-secondary); }
```

- [ ] **Step 4: Add zoom class toggle in ColonyMap.vue**

In `ColonyMap.vue`, add a computed for the zoomed-in state and pass it as a class on `.map-content`:

In the script:
```ts
const isZoomedIn = computed(() => zoom.value > 1.2)
```

In the template, update the `.map-content` div:
```vue
<div class="map-content" :class="{ 'zoomed-in': isZoomedIn }" :style="transformStyle">
```

In ColonyMap's style section, add:
```css
.zoomed-in .building-label {
  display: block;
}
```

- [ ] **Step 5: Verify buildings render**

Run: `bun run dev`

Confirm:
- Each building type shows a distinct geometric footprint
- Solar panels show a 3x2 grid
- Extraction rigs show rectangle + arm
- Launch platform shows square with H
- Med bay shows dome with cross
- Buildings have shadows offset slightly
- Status pips appear (green for operational, red pulsing for damaged)
- Labels appear when zoomed in past 1.2x
- Construction and damage animations still work

- [ ] **Step 6: Commit**

```bash
git add src/components/MapBuilding.vue src/components/ColonyMap.vue
git commit -m "feat: replace building circles with geometric footprints, add status pips and zoom labels"
```

---

### Task 3: Resource Flow Lines

**Files:**
- Modify: `src/components/ColonyMap.vue`

Add faint animated dashed SVG lines from power/air producers to consumer buildings.

- [ ] **Step 1: Add flow lines computed**

In `ColonyMap.vue` script, add after the `wornPaths` computed:

```ts
const flowLines = computed(() => {
  const lines: { x1: number; y1: number; x2: number; y2: number; color: string }[] = []
  const producers = game.buildings.filter(b => b.constructionProgress === null)
  const solarPanels = producers.filter(b => b.type === 'solar')
  const o2Generators = producers.filter(b => b.type === 'o2generator')
  const consumers = producers.filter(b => !['solar', 'o2generator', 'storageSilo'].includes(b.type))

  for (const solar of solarPanels) {
    for (const consumer of consumers) {
      lines.push({
        x1: solar.x, y1: solar.y,
        x2: consumer.x, y2: consumer.y,
        color: 'rgba(245, 158, 11, 0.07)',
      })
    }
  }
  for (const o2 of o2Generators) {
    for (const consumer of consumers) {
      lines.push({
        x1: o2.x, y1: o2.y,
        x2: consumer.x, y2: consumer.y,
        color: 'rgba(126, 207, 255, 0.07)',
      })
    }
  }
  return lines
})

const showFlowLines = computed(() => zoom.value >= 0.9)
```

- [ ] **Step 2: Add flow lines to the SVG overlay**

In the zone-overlay SVG in the template, after the worn paths, add:

```vue
<!-- Resource flow lines -->
<template v-if="showFlowLines">
  <line
    v-for="(fl, i) in flowLines"
    :key="'flow-' + i"
    :x1="fl.x1"
    :y1="fl.y1"
    :x2="fl.x2"
    :y2="fl.y2"
    :stroke="fl.color"
    stroke-width="0.15"
    stroke-dasharray="0.8,1.2"
    stroke-linecap="round"
  >
    <animate attributeName="stroke-dashoffset" from="2" to="0" dur="3s" repeatCount="indefinite" />
  </line>
</template>
```

- [ ] **Step 3: Verify flow lines**

Run: `bun run dev`

Confirm:
- Faint amber dashed lines from solar panels to consumer buildings
- Faint cyan dashed lines from O2 generators to consumers
- Lines animate slowly (dash offset)
- Lines disappear when zoomed out below 0.9x
- Lines don't connect to buildings under construction

- [ ] **Step 4: Commit**

```bash
git add src/components/ColonyMap.vue
git commit -m "feat: add resource flow lines from producers to consumers"
```

---

### Task 4: Colonist Activity Summary

**Files:**
- Modify: `src/components/ColonyMap.vue`

Add a compact readout at the bottom-left showing colonist counts by current activity.

- [ ] **Step 1: Add activity summary computed**

In `ColonyMap.vue` script, add:

```ts
const activitySummary = computed(() => {
  const counts: { label: string; count: number; color: string }[] = []
  const alive = game.aliveColonists
  const mining = alive.filter(c => c.currentAction?.type === 'extract').length
  const engineering = alive.filter(c => ['engineer', 'construct', 'repair'].includes(c.currentAction?.type ?? '')).length
  const medical = alive.filter(c => c.currentAction?.type === 'seek_medical').length
  const loading = alive.filter(c => c.currentAction?.type === 'load').length
  const resting = alive.filter(c => c.currentAction?.type === 'rest').length
  const idle = alive.filter(c => !c.currentAction || c.currentAction.type === 'idle').length

  if (mining) counts.push({ label: 'MINING', count: mining, color: 'var(--green)' })
  if (engineering) counts.push({ label: 'ENGINEER', count: engineering, color: 'var(--amber)' })
  if (medical) counts.push({ label: 'MEDICAL', count: medical, color: 'var(--red)' })
  if (loading) counts.push({ label: 'LOADING', count: loading, color: 'var(--cyan)' })
  if (resting) counts.push({ label: 'RESTING', count: resting, color: 'var(--text-secondary)' })
  if (idle) counts.push({ label: 'IDLE', count: idle, color: 'var(--text-muted)' })
  return counts
})
```

- [ ] **Step 2: Add activity summary to template**

After the away-indicator div and before the feed-indicator div, add:

```vue
<!-- Activity summary -->
<div class="activity-summary">
  <span
    v-for="a in activitySummary"
    :key="a.label"
    class="activity-item mono"
  >
    <span :style="{ color: a.color }">{{ a.count }}</span> {{ a.label }}
  </span>
</div>
```

- [ ] **Step 3: Add activity summary styles**

In the `<style scoped>` section, add:

```css
.activity-summary {
  position: absolute;
  bottom: calc(var(--safe-bottom, 0px) + 8px);
  left: calc(var(--safe-left, 0px) + 8px);
  z-index: 5;
  display: flex;
  gap: 8px;
  pointer-events: none;
}

.activity-item {
  font-family: var(--font-mono);
  font-size: 0.5625rem;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  opacity: 0.5;
}
```

- [ ] **Step 4: Move FPS counter to avoid overlap**

The fps counter currently sits at `bottom: 8px; left: 8px`. Move it above the activity summary:

Update `.fps-counter` style:
```css
.fps-counter {
  position: absolute;
  bottom: calc(var(--safe-bottom, 0px) + 24px);
  left: calc(var(--safe-left, 0px) + 8px);
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--text-secondary);
  z-index: 9;
  pointer-events: none;
}
```

- [ ] **Step 5: Verify activity summary**

Run: `bun run dev`

Confirm:
- Bottom-left shows activity counts like "2 MINING  1 ENGINEER  1 IDLE"
- Each count number is color-coded
- Only non-zero activities appear
- Updates as colonists change actions
- Doesn't overlap with FPS counter or away indicator

- [ ] **Step 6: Commit**

```bash
git add src/components/ColonyMap.vue
git commit -m "feat: add colonist activity summary to map bottom-left"
```

---

### Task 5: Alert Markers on Buildings

**Files:**
- Modify: `src/components/MapBuilding.vue`

The status pip already shows state. Alert markers are the "look at me" escalation — larger pulsing indicators for damaged buildings and warning conditions.

- [ ] **Step 1: Add alert marker to template**

In `MapBuilding.vue`, after the status-pip div, add:

```vue
<!-- Alert marker (escalated from pip for critical states) -->
<div v-if="alertType" class="alert-marker" :class="alertType" />
```

- [ ] **Step 2: Add alertType computed**

In the script, add:

```ts
const alertType = computed(() => {
  if (props.building.damaged) return 'alert-damage'
  if (props.building.constructionProgress !== null) return null
  // Operational buildings that need workers
  const needsWorkers = ['extractionrig', 'launchplatform'].includes(props.building.type)
  if (needsWorkers && workerCount.value === 0) return 'alert-warning'
  return null
})
```

- [ ] **Step 3: Add alert marker styles**

In the `<style scoped>`, add:

```css
.alert-marker {
  position: absolute;
  top: -6px;
  right: -6px;
  z-index: 3;
  border-radius: 50%;
  pointer-events: none;
}

.alert-damage {
  width: 10px;
  height: 10px;
  background: var(--red);
  box-shadow: 0 0 8px rgba(233, 69, 96, 0.6);
  animation: alert-pulse 1.5s ease-in-out infinite;
}

.alert-warning {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  background: var(--amber);
  box-shadow: 0 0 6px rgba(245, 158, 11, 0.5);
  animation: alert-pulse 1.5s ease-in-out infinite;
}

@keyframes alert-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.4); }
}
```

When an alert marker is present, hide the status pip to avoid overlap. Add:

```css
.alert-marker ~ .status-pip,
.map-building:has(.alert-marker) > .status-pip {
  display: none;
}
```

Actually, simpler: reorder template so alert-marker replaces pip visually. Or just conditionally render the pip when there's no alert. Update the status-pip in the template:

```vue
<div v-if="!alertType" class="status-pip" :class="statusClass" />
<div v-if="alertType" class="alert-marker" :class="alertType" />
```

- [ ] **Step 4: Verify alerts**

Run: `bun run dev`

Trigger damage (wait for hazard, or use dev tools to set `building.damaged = true`). Confirm:
- Damaged buildings show larger red pulsing alert marker
- Extraction rigs with no workers show amber pulsing alert
- Operational buildings with workers show green status pip
- Alert markers pulse with 1.5s cycle

- [ ] **Step 5: Commit**

```bash
git add src/components/MapBuilding.vue
git commit -m "feat: add alert markers for damaged buildings and worker warnings"
```

---

### Task 6: Update Colonist Dot Size

**Files:**
- Modify: `src/components/MapColonist.vue`

Reduce colonist dot from 8px to 6px to better fit the more detailed map. The existing movement trail and action coloring stay the same.

- [ ] **Step 1: Update dot and trail sizes**

In `MapColonist.vue`, update the CSS:

Change `.colonist-dot` width/height from `8px` to `6px`.

Change `.colonist-trail` width/height from `8px` to `6px`.

Change `.dead .colonist-dot` width/height from `5px` to `4px`.

Change `.health-pip` width from `12px` to `10px`.

- [ ] **Step 2: Verify colonist rendering**

Run: `bun run dev`

Confirm:
- Colonist dots are slightly smaller
- Movement trails still animate correctly
- Dead colonist dots are smaller and faded
- Health bars still visible on injured colonists

- [ ] **Step 3: Commit**

```bash
git add src/components/MapColonist.vue
git commit -m "style: reduce colonist dot size for satellite feed aesthetic"
```

---

### Task 7: Clean Up Settings References

**Files:**
- Modify: `src/components/ColonyMap.vue`
- Modify: `src/stores/settingsStore.ts` (optional)

Remove references to `settings.pathLines` and `settings.zoneLabels` from ColonyMap since zone boundaries and static path edges are gone.

- [ ] **Step 1: Clean up ColonyMap imports**

In `ColonyMap.vue`, the `pathEdges` computed and the `v-if="settings.pathLines"` block were removed in Task 1. Verify that the `ZONES` import is also removed if no longer used (it was used for zone labels and zone circles, both removed). Keep `ZONE_MAP` if used by `wornPaths` — check: `wornPaths` uses `ZONE_MAP` directly, so keep that import.

Update the import line:
```ts
import { ZONE_MAP } from '@/systems/mapLayout'
```

Remove `PATH_EDGES` and `ZONES` from the import since they're no longer used in ColonyMap (only in MapTerrain, which imports `ZONE_MAP` directly).

- [ ] **Step 2: Verify nothing is broken**

Run: `bun run build`

Expected: No TypeScript errors, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ColonyMap.vue
git commit -m "chore: clean up unused zone/path imports from ColonyMap"
```
