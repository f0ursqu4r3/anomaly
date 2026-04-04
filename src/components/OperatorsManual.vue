<template>
  <Teleport to="body">
    <div v-if="visible" class="manual-overlay" @click.self="$emit('close')">
      <div class="manual-modal">
        <div class="manual-header">
          <h2 class="manual-title">OPERATOR'S MANUAL</h2>
          <button class="manual-close" @click="$emit('close')">&times;</button>
        </div>

        <div class="manual-nav">
          <button
            v-for="cat in categories"
            :key="cat.id"
            class="nav-btn"
            :class="{ active: activeCategory === cat.id }"
            @click="activeCategory = cat.id"
          >
            {{ cat.label }}
          </button>
        </div>

        <div class="manual-content">
          <div v-for="entry in activeEntries" :key="entry.label" class="manual-entry">
            <div class="entry-header">
              <SvgIcon :name="entry.icon" size="md" />
              <h3 class="entry-name">{{ entry.label }}</h3>
            </div>
            <p class="entry-desc">{{ entry.description }}</p>
            <div class="entry-stats">
              <span v-if="entry.cost" class="stat">Cost: {{ entry.cost }}cr</span>
              <span v-if="entry.weight" class="stat">Weight: {{ entry.weight }}kg</span>
              <span v-if="entry.buildTime" class="stat">Build: {{ entry.buildTime }}s</span>
              <span v-if="entry.costMetals" class="stat">
                Materials: {{ entry.costMetals }}m{{
                  entry.costIce ? ' ' + entry.costIce + 'i' : ''
                }}
              </span>
            </div>
            <p v-if="entry.flavorText" class="entry-flavor">{{ entry.flavorText }}</p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { BUILDING_CONFIGS } from '@/config/buildings'
import { SHIPMENT_OPTIONS } from '@/stores/gameStore'
import SvgIcon from './SvgIcon.vue'

defineProps<{ visible: boolean }>()
defineEmits<{ close: [] }>()

interface ManualEntry {
  label: string
  icon: string
  description: string
  cost?: number
  weight?: number
  buildTime?: number
  costMetals?: number
  costIce?: number
  flavorText?: string
  category: string
}

const categories = [
  { id: 'buildings', label: 'BUILDINGS' },
  { id: 'supplies', label: 'SUPPLIES' },
  { id: 'crew', label: 'CREW' },
  { id: 'systems', label: 'SYSTEMS' },
]

const activeCategory = ref('buildings')

const iconForBuilding = (type: string): string => {
  const map: Record<string, string> = {
    solar: 'power',
    o2generator: 'air',
    extractionrig: 'mining',
    medbay: 'medbay',
    partsfactory: 'repair',
    storageSilo: 'storageSilo',
    launchplatform: 'launchplatform',
  }
  return map[type] ?? 'shipment'
}

const iconForSupply = (type: string): string => {
  const map: Record<string, string> = {
    supplyCrate: 'metals',
    newColonist: 'crew',
    repairKit: 'repair',
    emergencyO2: 'air',
    emergencyPower: 'power',
  }
  return map[type] ?? 'shipment'
}

const entries: ManualEntry[] = [
  ...BUILDING_CONFIGS.map((c) => ({
    label: c.label,
    icon: iconForBuilding(c.type),
    description: c.description,
    buildTime: c.constructionTime,
    costMetals: c.costMetals,
    costIce: c.costIce || undefined,
    cost: c.shipmentCost ?? undefined,
    weight: c.shipmentWeight ?? undefined,
    category: 'buildings',
  })),
  ...SHIPMENT_OPTIONS.filter((o) => o.type !== 'equipment').map((o) => ({
    label: o.label,
    icon: iconForSupply(o.type),
    description: o.description,
    cost: o.cost,
    weight: o.weight,
    category: 'supplies',
  })),
  // ── Crew entries ──
  {
    label: 'Needs & Actions',
    icon: 'colonist',
    description:
      'Colonists manage their own energy, focus, hunger, morale, and health. They choose actions autonomously — extracting, engineering, repairing, eating, resting, socializing — based on their current needs and colony priorities. When focus or hunger drops too low, work efficiency suffers. Critical energy or morale triggers forced rest.',
    category: 'crew',
  },
  {
    label: 'Personality Traits',
    icon: 'colonist',
    description:
      'Each colonist has a personality trait that shapes behavior. Hardy colonists drain less energy. Diligent ones work harder but transition slower. Social types recover morale fast. Cautious crew favor repairs and medical. Efficient workers move and transition faster. Stoic colonists resist morale drain and restlessness.',
    category: 'crew',
  },
  {
    label: 'Skill Traits',
    icon: 'colonist',
    description:
      'Colonists also carry a skill trait granting specific bonuses. Steady Hands boosts repair speed. Geologist improves extraction. Pathfinder speeds survey travel. Field Medic enhances healing. Tinkerer accelerates construction. Night Owl reduces energy drain when fatigued. Iron Stomach resists health drain. Claustrophobic colonists suffer extra isolation stress at outposts.',
    category: 'crew',
  },
  {
    label: 'XP & Specialization',
    icon: 'colonist',
    description:
      'Colonists earn XP in three tracks — extraction, engineering, and medical — each time they complete a relevant action. Higher levels grant cumulative efficiency bonuses. At level 3, a colonist unlocks a specialization: Prospector (extraction yield), Mechanic (repair speed), or Medic (healing speed).',
    category: 'crew',
  },
  {
    label: 'Bonds',
    icon: 'crew',
    description:
      'Colonists working in the same zone build affinity over time. When affinity reaches the threshold, a bond forms (max 3 per colonist). Bonded colonists work more efficiently together, may detour to visit each other between tasks, and suffer deeper morale loss if their partner dies.',
    category: 'crew',
  },
  {
    label: 'Morale & Breakdowns',
    icon: 'skull',
    description:
      'Morale drains passively and drops sharply from deaths, hazards, and isolation. Rest and socializing restore it. If morale falls critically low, a colonist may have a breakdown — becoming unable to work for 30–60 seconds. Keeping crew rested, social, and fed prevents spirals.',
    category: 'crew',
  },
  // ── System entries ──
  {
    label: 'Export Operations',
    icon: 'launchplatform',
    description:
      'Launch platforms export colony resources to HQ in exchange for credits. Colonists automatically load cargo onto docked platforms. Platforms cycle: loading, in transit (120s), returning (180s). Force-launching skips the full-capacity wait but extends the return trip. HQ rates fluctuate — event-driven demand spikes reward timing your launches.',
    category: 'systems',
  },
  {
    label: 'Directives',
    icon: 'balanced',
    description:
      'Directives control the extractor-to-engineer work ratio and modify extraction speed, hazard resistance, and production output. Mining pushes extraction hard. Safety prioritizes engineers and hazard resistance. Emergency maximizes repair urgency. Balanced is the default. Changes take effect immediately.',
    category: 'systems',
  },
  {
    label: 'Colony Depth',
    icon: 'depth',
    description:
      'Extraction operations gradually increase colony depth. Greater depth unlocks rare mineral deposits but increases hazard frequency. Depth cannot be reduced — every meter is permanent.',
    category: 'systems',
  },
  {
    label: 'Hazards',
    icon: 'skull',
    description:
      'The colony faces three hazard types: meteor impacts (damage a building), power surges (target solar panels), and gas pockets (injure a colonist). Hazard frequency scales with depth. The Safety directive provides the most resistance. Damaged buildings require repair kits to fix.',
    category: 'systems',
  },
  {
    label: 'Moon Exploration',
    icon: 'mining',
    description:
      'Use orbital pings to reveal hidden sectors on the moon surface. Discovered sectors show terrain and deposit signatures. Dispatch survey teams to confirm deposit quality and yield. Pathfinder-traited colonists travel faster. Survey missions carry risk — injuries, delays, and lost crew are possible.',
    category: 'systems',
  },
  {
    label: 'Outposts',
    icon: 'extractionrig',
    description:
      'Establish outposts at surveyed sectors with confirmed deposits. Outpost crew extract resources continuously but suffer isolation morale drain. Stockpiled resources can be launched back to the colony. Claustrophobic colonists suffer double isolation stress. Deposits eventually deplete.',
    category: 'systems',
  },
]

const activeEntries = computed(() => entries.filter((e) => e.category === activeCategory.value))
</script>

<style scoped>
.manual-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--safe-top) + 16px) calc(var(--safe-right) + 16px)
    calc(var(--safe-bottom) + 16px) calc(var(--safe-left) + 16px);
}

.manual-modal {
  background: var(--bg-primary);
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-md);
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.manual-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid var(--accent-muted);
}

.manual-title {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--text-primary);
}

.manual-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.25rem;
  cursor: pointer;
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

.manual-nav {
  display: flex;
  border-bottom: 1px solid var(--accent-dim);
  flex-shrink: 0;
}

.nav-btn {
  flex: 1;
  padding: 10px 4px;
  min-height: 44px;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-secondary);
  background: transparent;
  border-bottom: 2px solid transparent;
}

.nav-btn.active {
  color: var(--cyan);
  border-bottom-color: var(--cyan);
}

.manual-content {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 10px 14px;
}

.manual-entry {
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--accent-dim);
}

.manual-entry:last-child {
  border-bottom: none;
}

.entry-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  color: var(--text-secondary);
}

.entry-name {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-primary);
}

.entry-desc {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 6px;
}

.entry-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.625rem;
}

.stat {
  color: var(--text-muted);
  background: var(--bg-surface);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
}

.entry-flavor {
  font-size: 0.6875rem;
  color: var(--text-muted);
  font-style: italic;
  margin-top: 6px;
  line-height: 1.5;
}
</style>
