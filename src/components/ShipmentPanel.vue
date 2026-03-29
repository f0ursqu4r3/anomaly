<template>
  <div class="shipment-panel">
    <!-- In-transit -->
    <div v-if="game.inTransitShipments.length > 0" class="transit-section">
      <div class="section-label">EN ROUTE</div>
      <div
        v-for="s in game.inTransitShipments"
        :key="s.id"
        class="transit-item"
      >
        <span class="transit-label">{{ s.label }}</span>
        <span class="transit-eta mono">{{ formatEta(s.arrivalAt) }}</span>
      </div>
    </div>

    <!-- Shipment options -->
    <div class="section-label">SEND SHIPMENT</div>
    <div class="shipment-grid">
      <button
        v-for="opt in options"
        :key="opt.label"
        class="shipment-card"
        :disabled="game.credits < opt.cost"
        @click="game.orderShipment(opt)"
      >
        <SvgIcon :name="shipmentIcon(opt)" size="md" class="ship-icon" />
        <span class="ship-label">{{ opt.label }}</span>
        <span class="ship-desc">{{ opt.description }}</span>
        <span class="ship-cost mono">
          <SvgIcon name="credits" size="xs" />{{ opt.cost }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore, SHIPMENT_OPTIONS } from '@/stores/gameStore'
import type { ShipmentOption } from '@/stores/gameStore'
import SvgIcon from './SvgIcon.vue'

const game  = useGameStore()
const options = SHIPMENT_OPTIONS

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
}

.transit-section {
  margin-bottom: 12px;
}

.transit-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: rgba(126, 207, 255, 0.08);
  border: 1px solid rgba(126, 207, 255, 0.15);
  border-radius: var(--radius-sm);
  margin-bottom: 4px;
}

.transit-label {
  font-size: 12px;
  color: var(--cyan);
}

.transit-eta {
  font-size: 11px;
  color: var(--cyan);
}

.shipment-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.shipment-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
  text-align: left;
  width: 100%;
}

.shipment-card:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ship-icon {
  color: var(--text-muted);
  margin-bottom: 2px;
}

.ship-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
}

.ship-desc {
  font-size: 10px;
  color: var(--text-muted);
}

.ship-cost {
  font-size: 11px;
  color: var(--amber);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 2px;
}
</style>
