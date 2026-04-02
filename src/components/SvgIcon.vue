<template>
  <svg
    :class="['svg-icon', `icon-${size}`]"
    :viewBox="icon?.viewBox || '0 0 16 16'"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    v-html="icon?.path || ''"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  { size: 'sm' },
)

interface IconDef {
  viewBox: string
  path: string
}

const ICONS: Record<string, IconDef> = {
  // ── Resources ──
  air: {
    viewBox: '0 0 16 16',
    path: `<path d="M2 5.5c2-2 4 0 6-2s3-1 6 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
           <path d="M2 10.5c2-2 4 0 6-2s3-1 6 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/>`,
  },
  power: {
    viewBox: '0 0 16 16',
    path: `<path d="M9.5 1L5 9h3.5L7 15l6-8H9.5L11.5 1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`,
  },
  metals: {
    viewBox: '0 0 16 16',
    path: `<path d="M8 2L14 6v5L8 15 2 11V6z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
           <path d="M8 2v6L2 6M8 8l6-2M8 8v7" stroke="currentColor" stroke-width="1" opacity="0.4"/>`,
  },
  ice: {
    viewBox: '0 0 16 16',
    path: `<path d="M8 1v14M1 8h14M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
           <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1" opacity="0.5"/>`,
  },
  credits: {
    viewBox: '0 0 16 16',
    path: `<circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2"/>
           <path d="M9.5 5.5C9 5 8 4.8 7.2 5.2 6 5.8 6 7.2 7.5 7.8c1.5.6 2 1.5 1 2.5-.5.5-1.5.7-2.5.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
           <path d="M8 4v1M8 11v1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,
  },
  depth: {
    viewBox: '0 0 16 16',
    path: `<path d="M8 2v10M4.5 9L8 12.5 11.5 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  // ── Buildings ──
  solar: {
    viewBox: '0 0 16 16',
    path: `<circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.3"/>
           <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,
  },
  o2generator: {
    viewBox: '0 0 16 16',
    path: `<circle cx="6" cy="6" r="2.5" stroke="currentColor" stroke-width="1.2"/>
           <circle cx="11" cy="6" r="1.5" stroke="currentColor" stroke-width="1" opacity="0.6"/>
           <circle cx="8.5" cy="11" r="2" stroke="currentColor" stroke-width="1.1"/>
           <path d="M7.5 4L9.5 5M8.5 9L6.5 8M10 7.5l-1 1.5" stroke="currentColor" stroke-width="0.8" opacity="0.4"/>`,
  },
  extractionrig: {
    viewBox: '0 0 16 16',
    path: `<path d="M8 2v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
           <path d="M8 10l-2 4h4z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
           <path d="M5 4h6M6 6.5h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,
  },
  medbay: {
    viewBox: '0 0 16 16',
    path: `<path d="M6.5 3h3v3.5H13v3H9.5V13h-3V9.5H3v-3h3.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`,
  },
  partsfactory: {
    viewBox: '0 0 16 16',
    path: `<circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.2"/>
           <circle cx="8" cy="8" r="1" fill="currentColor" opacity="0.6"/>
           <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" stroke-width="0.8" opacity="0.4"/>
           <path d="M8 3v-1M8 14v-1M3 8h-1M14 8h-1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,
  },
  storageSilo: {
    viewBox: '0 0 16 16',
    path: `<rect x="4" y="3" width="8" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
           <path d="M4 6h8M4 9h8" stroke="currentColor" stroke-width="0.8" opacity="0.4"/>
           <path d="M6.5 11.5h3" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.6"/>`,
  },
  launchplatform: {
    viewBox: '0 0 16 16',
    path: `<path d="M8 2l3 5H5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
           <path d="M8 7v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
           <path d="M4 14h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
           <path d="M5.5 12h5" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.5"/>`,
  },

  // ── Directives ──
  mining: {
    viewBox: '0 0 16 16',
    path: `<path d="M3 13l5-5M8 8l5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
           <path d="M10 2l4 4-2 1-3-3z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>`,
  },
  safety: {
    viewBox: '0 0 16 16',
    path: `<path d="M8 1.5L2.5 4v4c0 3.5 2.5 5.5 5.5 7 3-1.5 5.5-3.5 5.5-7V4z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`,
  },
  balanced: {
    viewBox: '0 0 16 16',
    path: `<path d="M8 2v12M4 14h8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
           <path d="M3 6l5-2 5 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
           <path d="M3 6c0 1.5 1 2 2 2s2-.5 2-2M9 6c0 1.5 1 2 2 2s2-.5 2-2" stroke="currentColor" stroke-width="1" opacity="0.5"/>`,
  },
  emergency: {
    viewBox: '0 0 16 16',
    path: `<path d="M8 1.5L1.5 13.5h13z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
           <path d="M8 6v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
           <circle cx="8" cy="11.5" r="0.8" fill="currentColor"/>`,
  },

  // ── Hazards ──
  'hazard-meteor': {
    viewBox: '0 0 16 16',
    path: `<circle cx="9" cy="9" r="4" stroke="currentColor" stroke-width="1.2"/>
           <path d="M6 6L2 2M5.5 7.5L2 5M7 5.5L5 2" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.6"/>`,
  },
  'hazard-surge': {
    viewBox: '0 0 16 16',
    path: `<path d="M9.5 1L5 9h3.5L7 15l6-8H9.5L11.5 1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="currentColor" fill-opacity="0.15"/>`,
  },
  'hazard-gas': {
    viewBox: '0 0 16 16',
    path: `<path d="M3 11c0-2.5 2-3 3-3s2-1 2-2.5S9.5 3 11 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
           <path d="M5 13c1.5 0 2.5-1 4-1s3 1 4 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>`,
  },

  // ── UI ──
  skull: {
    viewBox: '0 0 16 16',
    path: `<path d="M4 10V7c0-3 1.5-5 4-5s4 2 4 5v3c0 1-1 2-2 2H6c-1 0-2-1-2-2z" stroke="currentColor" stroke-width="1.2"/>
           <circle cx="6.5" cy="7.5" r="1" fill="currentColor"/>
           <circle cx="9.5" cy="7.5" r="1" fill="currentColor"/>
           <path d="M7 14v-2M9 14v-2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,
  },
  shipment: {
    viewBox: '0 0 16 16',
    path: `<path d="M2.5 5.5L8 3l5.5 2.5v6L8 14l-5.5-2.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
           <path d="M8 8v6M2.5 5.5L8 8l5.5-2.5" stroke="currentColor" stroke-width="1" opacity="0.4"/>`,
  },
  colonist: {
    viewBox: '0 0 16 16',
    path: `<circle cx="8" cy="5" r="2.5" stroke="currentColor" stroke-width="1.2"/>
           <path d="M3.5 14c0-3 2-4.5 4.5-4.5s4.5 1.5 4.5 4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,
  },
  repair: {
    viewBox: '0 0 16 16',
    path: `<path d="M10.5 2.5c-1.5-.5-3 0-3.8 1.2-.6 1-.5 2.2.1 3.1L3 10.5c-.7.7-.7 1.8 0 2.5s1.8.7 2.5 0l3.7-3.8c.9.6 2.1.7 3.1.1 1.2-.8 1.7-2.3 1.2-3.8l-2 2-1.5-.5-.5-1.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`,
  },
  'o2-emergency': {
    viewBox: '0 0 16 16',
    path: `<path d="M2 5.5c2-2 4 0 6-2s3-1 6 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
           <path d="M8 9v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
           <circle cx="8" cy="14.5" r="0.7" fill="currentColor"/>`,
  },
  'power-emergency': {
    viewBox: '0 0 16 16',
    path: `<path d="M9.5 1L5 9h3.5L7 15l6-8H9.5L11.5 1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
           <path d="M2 8h2M12 8h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>`,
  },
  crew: {
    viewBox: '0 0 16 16',
    path: `<circle cx="6" cy="5" r="2" stroke="currentColor" stroke-width="1.1"/>
           <circle cx="11" cy="5" r="2" stroke="currentColor" stroke-width="1.1"/>
           <path d="M2 13c0-2.5 1.5-3.5 4-3.5M9 9.5c2.5 0 4 1 4 3.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>`,
  },
}

const icon = computed(() => ICONS[props.name])
</script>

<style scoped>
.svg-icon {
  display: inline-block;
  vertical-align: middle;
  color: inherit;
  flex-shrink: 0;
}
.icon-xs {
  width: 12px;
  height: 12px;
}
.icon-sm {
  width: 16px;
  height: 16px;
}
.icon-md {
  width: 20px;
  height: 20px;
}
.icon-lg {
  width: 28px;
  height: 28px;
}
.icon-xl {
  width: 40px;
  height: 40px;
}
</style>
