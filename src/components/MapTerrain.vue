<template>
  <svg class="map-terrain" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
    <defs>
      <radialGradient id="terrain-crater-shadow" cx="45%" cy="40%">
        <stop offset="0%" stop-color="rgba(8,12,20,0.5)" />
        <stop offset="70%" stop-color="rgba(15,20,30,0.2)" />
        <stop offset="100%" stop-color="transparent" />
      </radialGradient>
      <radialGradient id="terrain-crater-shadow-sm" cx="45%" cy="40%">
        <stop offset="0%" stop-color="rgba(8,12,20,0.35)" />
        <stop offset="100%" stop-color="transparent" />
      </radialGradient>
    </defs>

    <!-- Large craters -->
    <circle cx="82" cy="78" r="8" fill="url(#terrain-crater-shadow)" />
    <circle cx="82" cy="78" r="7.5" fill="none" stroke="rgba(80,90,110,0.12)" stroke-width="0.3" />
    <path d="M76,73 Q78,71 81,72" fill="none" stroke="rgba(100,110,130,0.1)" stroke-width="0.4" stroke-linecap="round" />

    <circle cx="15" cy="15" r="5" fill="url(#terrain-crater-shadow-sm)" />
    <circle cx="15" cy="15" r="4.5" fill="none" stroke="rgba(80,90,110,0.08)" stroke-width="0.2" />

    <!-- Small craters scattered -->
    <circle cx="60" cy="88" r="2.5" fill="url(#terrain-crater-shadow-sm)" stroke="rgba(80,90,110,0.06)" stroke-width="0.15" />
    <circle cx="90" cy="30" r="2" fill="url(#terrain-crater-shadow-sm)" stroke="rgba(80,90,110,0.06)" stroke-width="0.15" />
    <circle cx="8" cy="55" r="1.5" fill="url(#terrain-crater-shadow-sm)" stroke="rgba(80,90,110,0.05)" stroke-width="0.1" />

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
    <ellipse :cx="zones.habitat.x" :cy="zones.habitat.y" rx="11" ry="8" fill="rgba(20,25,35,0.25)" stroke="rgba(60,70,85,0.04)" stroke-width="0.3" />

    <!-- Habitat: connected dome cluster (visual landmark) -->
    <g :transform="`translate(${zones.habitat.x}, ${zones.habitat.y})`">
      <!-- Shadow -->
      <g transform="translate(0.2, 0.2)" opacity="0.25">
        <circle r="2.8" fill="rgba(0,0,0,0.4)" filter="url(#terrain-crater-shadow-sm)" />
        <circle cx="-3.5" cy="1" r="1.8" fill="rgba(0,0,0,0.3)" />
        <circle cx="3.2" cy="-0.8" r="2" fill="rgba(0,0,0,0.3)" />
      </g>
      <!-- Main dome -->
      <circle r="2.8" fill="rgba(126,207,255,0.08)" stroke="rgba(126,207,255,0.3)" stroke-width="0.2" />
      <circle r="1.4" fill="none" stroke="rgba(126,207,255,0.15)" stroke-width="0.1" />
      <!-- Left dome -->
      <circle cx="-3.5" cy="1" r="1.8" fill="rgba(126,207,255,0.06)" stroke="rgba(126,207,255,0.25)" stroke-width="0.15" />
      <circle cx="-3.5" cy="1" r="0.8" fill="none" stroke="rgba(126,207,255,0.1)" stroke-width="0.08" />
      <!-- Right dome -->
      <circle cx="3.2" cy="-0.8" r="2" fill="rgba(126,207,255,0.06)" stroke="rgba(126,207,255,0.25)" stroke-width="0.15" />
      <circle cx="3.2" cy="-0.8" r="1" fill="none" stroke="rgba(126,207,255,0.1)" stroke-width="0.08" />
      <!-- Corridors connecting domes -->
      <line x1="-1" y1="0.4" x2="-2" y2="0.7" stroke="rgba(126,207,255,0.2)" stroke-width="0.6" stroke-linecap="round" />
      <line x1="1.2" y1="-0.3" x2="1.8" y2="-0.5" stroke="rgba(126,207,255,0.2)" stroke-width="0.6" stroke-linecap="round" />
    </g>

    <ellipse :cx="zones.extraction.x" :cy="zones.extraction.y" rx="11" ry="8" fill="rgba(22,28,38,0.2)" />
    <line :x1="zones.extraction.x - 5" :y1="zones.extraction.y - 2" :x2="zones.extraction.x - 3" :y2="zones.extraction.y + 3" stroke="rgba(52,211,153,0.03)" stroke-width="0.4" />
    <line :x1="zones.extraction.x + 2" :y1="zones.extraction.y - 3" :x2="zones.extraction.x + 4" :y2="zones.extraction.y + 2" stroke="rgba(52,211,153,0.03)" stroke-width="0.3" />

    <ellipse :cx="zones.landing.x" :cy="zones.landing.y" rx="7" ry="6" fill="rgba(25,20,15,0.15)" />
    <circle :cx="zones.landing.x" :cy="zones.landing.y" r="3" fill="none" stroke="rgba(80,60,30,0.06)" stroke-width="0.6" />

    <ellipse :cx="zones.power.x" :cy="zones.power.y" rx="9" ry="6" fill="rgba(20,25,35,0.18)" />
    <ellipse :cx="zones.lifeSup.x" :cy="zones.lifeSup.y" rx="9" ry="6" fill="rgba(20,25,35,0.18)" />
    <ellipse :cx="zones.medical.x" :cy="zones.medical.y" rx="7" ry="5" fill="rgba(20,25,35,0.15)" />

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
