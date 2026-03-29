<template>
  <div class="shipment-panel">
    <!-- Cooldown bar -->
    <div v-if="game.shipmentOnCooldown" class="cooldown-bar">
      <div class="cooldown-fill" :style="{ width: cooldownPct + '%' }" />
      <span class="cooldown-text mono">NEXT WINDOW {{ cooldownText }}</span>
    </div>

    <!-- In-transit -->
    <div v-if="game.inTransitShipments.length > 0" class="transit-section">
      <div class="section-label">EN ROUTE</div>
      <div
        v-for="s in game.inTransitShipments"
        :key="s.id"
        class="transit-item"
      >
        <span class="transit-label">{{ s.contents.length }} items · {{ s.totalWeight }}kg</span>
        <span class="transit-eta mono">{{ formatEta(s.arrivalAt) }}</span>
      </div>
    </div>

    <!-- Manifest (only when items selected) -->
    <div v-if="game.manifest.length > 0" class="manifest-section">
      <div class="section-label">
        MANIFEST
        <span class="manifest-meta mono">
          {{ game.manifest.length }}/{{ maxSlots }} slots
          · {{ game.manifestWeight }}/{{ maxWeight }}kg
        </span>
      </div>

      <div class="manifest-list">
        <div v-for="(group, i) in manifestGroups" :key="i" class="manifest-item">
          <SvgIcon :name="shipmentIcon(group.option)" size="sm" class="manifest-icon" />
          <span class="manifest-name">{{ group.option.label }}</span>
          <span class="manifest-qty mono" v-if="group.count > 1">×{{ group.count }}</span>
          <span class="manifest-wt mono">{{ group.option.weight * group.count }}kg</span>
        </div>
      </div>

      <!-- Capacity bar -->
      <div class="capacity-bar-bg">
        <div class="capacity-bar-fill" :style="{ width: weightPct + '%' }" :class="{ full: weightPct > 90 }" />
      </div>

      <!-- Launch row -->
      <div class="manifest-footer">
        <span class="manifest-total mono">
          <SvgIcon name="credits" size="xs" />{{ Math.floor(game.manifestCost) }}
        </span>
        <div class="manifest-actions">
          <button class="clear-btn" @click="game.clearManifest()">CLEAR</button>
          <button
            class="launch-btn"
            :disabled="game.shipmentOnCooldown || game.credits < game.manifestCost"
            @click="game.launchShipment()"
          >
            LAUNCH
          </button>
        </div>
      </div>
    </div>

    <!-- Item catalog with +/- controls -->
    <div class="section-label" :style="game.manifest.length > 0 ? 'margin-top: 6px;' : ''">ITEMS</div>
    <div class="catalog-list">
      <div
        v-for="opt in options"
        :key="opt.label"
        class="catalog-item"
        :class="{ disabled: !canAdd(opt) && countInManifest(opt) === 0 }"
      >
        <SvgIcon :name="shipmentIcon(opt)" size="sm" class="cat-icon" />
        <div class="cat-info">
          <span class="cat-label">{{ opt.label }}</span>
          <span class="cat-desc">{{ opt.description }}</span>
          <div class="cat-meta">
            <span class="cat-cost mono"><SvgIcon name="credits" size="xs" />{{ opt.cost }}</span>
            <span class="cat-weight mono">{{ opt.weight }}kg</span>
          </div>
        </div>
        <div class="qty-controls">
          <button
            class="qty-btn minus"
            :disabled="countInManifest(opt) === 0"
            @click="removeOne(opt)"
          >−</button>
          <span class="qty-count mono">{{ countInManifest(opt) }}</span>
          <button
            class="qty-btn plus"
            :disabled="!canAdd(opt)"
            @click="game.addToManifest(opt)"
          >+</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore, SHIPMENT_OPTIONS, MANIFEST_MAX_SLOTS, CARGO_CAPACITY, SHIPMENT_COOLDOWN_MS } from '@/stores/gameStore'
import type { ShipmentOption } from '@/stores/gameStore'
import SvgIcon from './SvgIcon.vue'

const game = useGameStore()
const options = SHIPMENT_OPTIONS
const maxSlots = MANIFEST_MAX_SLOTS
const maxWeight = CARGO_CAPACITY

const weightPct = computed(() => (game.manifestWeight / CARGO_CAPACITY) * 100)

const cooldownPct = computed(() => {
  const remaining = game.shipmentCooldownRemaining
  return ((SHIPMENT_COOLDOWN_MS - remaining) / SHIPMENT_COOLDOWN_MS) * 100
})

const cooldownText = computed(() => {
  const s = Math.ceil(game.shipmentCooldownRemaining / 1000)
  return `${s}s`
})

// Group manifest items by label for display
const manifestGroups = computed(() => {
  const groups: { option: ShipmentOption; count: number }[] = []
  for (const item of game.manifest) {
    const existing = groups.find(g => g.option.label === item.label)
    if (existing) {
      existing.count++
    } else {
      groups.push({ option: item, count: 1 })
    }
  }
  return groups
})

function countInManifest(opt: ShipmentOption): number {
  return game.manifest.filter(m => m.label === opt.label).length
}

function removeOne(opt: ShipmentOption) {
  // Find last occurrence and remove it
  for (let i = game.manifest.length - 1; i >= 0; i--) {
    if (game.manifest[i].label === opt.label) {
      game.removeFromManifest(i)
      return
    }
  }
}

function canAdd(opt: ShipmentOption): boolean {
  if (game.manifest.length >= MANIFEST_MAX_SLOTS) return false
  if (game.manifestWeight + opt.weight > CARGO_CAPACITY) return false
  if (game.credits < game.manifestCost + opt.cost) return false
  return true
}

function shipmentIcon(opt: ShipmentOption): string {
  if (opt.buildingType) return opt.buildingType
  const map: Record<string, string> = {
    supplyCrate: 'shipment',
    newColonist: 'colonist',
    repairKit: 'repair',
    emergencyO2: 'air',
    emergencyPower: 'power',
  }
  return map[opt.type] || 'shipment'
}

function formatEta(arrivalAt: number): string {
  const remaining = Math.max(0, Math.ceil((arrivalAt - game.totalPlaytimeMs) / 1000))
  return `${remaining}s`
}
</script>

<style scoped>
.shipment-panel {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
}

.section-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--text-muted);
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.manifest-meta {
  font-size: 9px;
  font-weight: 400;
  letter-spacing: 0.05em;
}

/* Cooldown */
.cooldown-bar {
  position: relative;
  height: 22px;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
  overflow: hidden;
}

.cooldown-fill {
  height: 100%;
  background: rgba(126, 207, 255, 0.12);
  transition: width 1s linear;
}

.cooldown-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  letter-spacing: 0.12em;
  color: var(--cyan);
}

/* Transit */
.transit-section { margin-bottom: 8px; }

.transit-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 10px;
  background: rgba(126, 207, 255, 0.08);
  border: 1px solid rgba(126, 207, 255, 0.15);
  border-radius: var(--radius-sm);
  margin-bottom: 3px;
}

.transit-label { font-size: 11px; color: var(--cyan); }
.transit-eta { font-size: 10px; color: var(--cyan); }

/* Manifest */
.manifest-section {
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  margin-bottom: 4px;
  border: 1px solid rgba(126, 207, 255, 0.1);
}

.manifest-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 6px;
}

.manifest-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
}

.manifest-icon { color: var(--text-secondary); flex-shrink: 0; }
.manifest-name { font-size: 11px; color: var(--text-primary); flex: 1; }
.manifest-qty { font-size: 10px; color: var(--cyan); }
.manifest-wt { font-size: 9px; color: var(--text-muted); }

.capacity-bar-bg {
  height: 4px;
  background: var(--bg-deep);
  border-radius: 2px;
  margin-bottom: 8px;
  overflow: hidden;
}

.capacity-bar-fill {
  height: 100%;
  background: var(--cyan);
  border-radius: 2px;
  transition: width 0.2s ease;
}

.capacity-bar-fill.full { background: var(--amber); }

.manifest-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.manifest-total {
  font-size: 13px;
  color: var(--amber);
  display: flex;
  align-items: center;
  gap: 3px;
}

.manifest-actions {
  display: flex;
  gap: 6px;
}

.clear-btn {
  padding: 6px 12px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  background: var(--bg-elevated);
  color: var(--text-muted);
  border-radius: var(--radius-sm);
}

.launch-btn {
  padding: 6px 20px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  background: var(--cyan);
  color: var(--bg-deep);
  border-radius: var(--radius-sm);
}

.launch-btn:disabled, .clear-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Catalog */
.catalog-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.catalog-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
}

.catalog-item.disabled {
  opacity: 0.35;
}

.cat-icon { color: var(--text-muted); flex-shrink: 0; }

.cat-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.cat-label { font-size: 11px; font-weight: 600; color: var(--text-primary); }
.cat-desc { font-size: 9px; color: var(--text-muted); }

.cat-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 1px;
}

.cat-cost {
  font-size: 10px;
  color: var(--amber);
  display: flex;
  align-items: center;
  gap: 2px;
}

.cat-weight {
  font-size: 9px;
  color: var(--text-muted);
}

/* Qty controls */
.qty-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.qty-btn {
  width: 28px;
  height: 28px;
  min-height: 28px;
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.qty-btn:disabled {
  opacity: 0.2;
  cursor: not-allowed;
}

.qty-btn.plus { color: var(--green); }
.qty-btn.minus { color: var(--red); }

.qty-count {
  width: 20px;
  text-align: center;
  font-size: 12px;
  color: var(--text-primary);
}
</style>
