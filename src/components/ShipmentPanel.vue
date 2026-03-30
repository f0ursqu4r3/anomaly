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
      <div v-for="s in game.inTransitShipments" :key="s.id" class="transit-item">
        <span class="transit-label">{{ s.contents.length }} items · {{ s.totalWeight }}kg</span>
        <span class="transit-eta mono">{{ formatEta(s.arrivalAt) }}</span>
      </div>
    </div>

    <!-- Manifest (only when items selected) -->
    <Transition name="manifest-reveal">
      <div
        v-if="game.manifest.length > 0"
        class="manifest-section"
        :class="{ launching: isLaunching }"
      >
        <div v-if="isLaunching" class="launch-scanline" />
        <div class="section-label">
          MANIFEST
          <span class="manifest-meta mono">
            <span :class="{ 'slots-full': game.manifest.length >= maxSlots }"
              >{{ game.manifest.length }}/{{ maxSlots }} slots</span
            >
            · {{ game.manifestWeight }}/{{ maxWeight }}kg
          </span>
        </div>

        <TransitionGroup name="manifest-row" tag="div" class="manifest-list">
          <div
            v-for="group in manifestGroups"
            :key="group.option.label"
            class="manifest-item"
            :class="{ pulse: pulsingItem === group.option.label }"
          >
            <SvgIcon :name="shipmentIcon(group.option)" size="sm" class="manifest-icon" />
            <span class="manifest-name">{{ group.option.label }}</span>
            <div class="qty-controls">
              <button class="qty-btn minus" @click="removeOne(group.option)">−</button>
              <span class="qty-count mono">{{ group.count }}</span>
              <button
                class="qty-btn plus"
                :disabled="!canAdd(group.option)"
                @click="game.addToManifest(group.option)"
              >
                +
              </button>
            </div>
            <span class="manifest-wt mono">{{ group.option.weight * group.count }}kg</span>
          </div>
        </TransitionGroup>

        <!-- Capacity bar -->
        <div class="capacity-bar-bg">
          <div
            class="capacity-bar-fill"
            :style="{ width: weightPct + '%' }"
            :class="{ full: weightPct > 90 }"
          />
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
              :class="{ ready: !game.shipmentOnCooldown && game.credits >= game.manifestCost }"
              :disabled="game.shipmentOnCooldown || game.credits < game.manifestCost || isLaunching"
              @click="handleLaunch()"
            >
              LAUNCH
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Item catalog — tap to add -->
    <div class="section-label" :style="game.manifest.length > 0 ? 'margin-top: 6px;' : ''">
      ITEMS
    </div>
    <div class="catalog-grid">
      <button
        v-for="opt in options"
        :key="opt.label"
        class="catalog-btn"
        :class="{ disabled: !canAdd(opt), tapped: tappedItem === opt.label }"
        :disabled="!canAdd(opt)"
        @click="addFromCatalog(opt)"
      >
        <SvgIcon :name="shipmentIcon(opt)" size="lg" class="cat-icon" />
        <span class="cat-label">{{ opt.label }}</span>
        <div class="cat-meta">
          <span class="cat-cost mono"><SvgIcon name="credits" size="xs" />{{ opt.cost }}</span>
          <span class="cat-weight mono">{{ opt.weight }}kg</span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  useGameStore,
  SHIPMENT_OPTIONS,
  MANIFEST_MAX_SLOTS,
  CARGO_CAPACITY,
  SHIPMENT_COOLDOWN_MS,
} from '@/stores/gameStore'
import type { ShipmentOption } from '@/stores/gameStore'
import SvgIcon from './SvgIcon.vue'

const game = useGameStore()
const options = SHIPMENT_OPTIONS
const maxSlots = MANIFEST_MAX_SLOTS
const maxWeight = CARGO_CAPACITY

const pulsingItem = ref<string | null>(null)
const tappedItem = ref<string | null>(null)
const isLaunching = ref(false)
let pulseTimeout: ReturnType<typeof setTimeout> | null = null
let tapTimeout: ReturnType<typeof setTimeout> | null = null

function addFromCatalog(opt: ShipmentOption) {
  if (!canAdd(opt)) return
  game.addToManifest(opt)
  // Trigger pulse on the manifest row
  if (pulseTimeout) clearTimeout(pulseTimeout)
  pulsingItem.value = opt.label
  pulseTimeout = setTimeout(() => {
    pulsingItem.value = null
  }, 400)
  // Trigger icon glow on catalog button
  if (tapTimeout) clearTimeout(tapTimeout)
  tappedItem.value = opt.label
  tapTimeout = setTimeout(() => {
    tappedItem.value = null
  }, 300)
}

function handleLaunch() {
  isLaunching.value = true
  setTimeout(() => {
    game.launchShipment()
    isLaunching.value = false
  }, 500)
}

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
    const existing = groups.find((g) => g.option.label === item.label)
    if (existing) {
      existing.count++
    } else {
      groups.push({ option: item, count: 1 })
    }
  }
  return groups
})

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
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
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
  background: var(--accent-muted);
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
.transit-section {
  margin-bottom: 8px;
}

.transit-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 10px;
  background: var(--accent-dim);
  border: 1px solid var(--accent-muted);
  border-radius: var(--radius-sm);
  margin-bottom: 3px;
}

.transit-label {
  font-size: 11px;
  color: var(--cyan);
}
.transit-eta {
  font-size: 10px;
  color: var(--cyan);
}

/* Manifest */
.manifest-section {
  position: relative;
  overflow: hidden;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  margin-bottom: 4px;
  border: 1px solid var(--accent-muted);
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
  padding: 6px 8px;
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
}

.manifest-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}
.manifest-name {
  font-size: 11px;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
}
.manifest-wt {
  font-size: 9px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.manifest-section.launching {
  animation: launch-flash 0.5s cubic-bezier(0.25, 1, 0.5, 1);
}

@keyframes launch-flash {
  0% {
    border-color: var(--accent-muted);
  }
  30% {
    border-color: var(--cyan);
  }
  100% {
    border-color: var(--accent-muted);
    opacity: 0;
    transform: translateY(-4px);
  }
}

.launch-scanline {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  animation: scanline-sweep 0.5s cubic-bezier(0.25, 1, 0.5, 1);
}

.launch-scanline::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--cyan);
  box-shadow: 0 0 12px 3px var(--cyan);
  animation: scanline-move 0.5s cubic-bezier(0.25, 1, 0.5, 1);
}

@keyframes scanline-move {
  from {
    top: 0;
    opacity: 1;
  }
  to {
    top: 100%;
    opacity: 0.3;
  }
}

/* Slots full indicator */
.slots-full {
  color: var(--amber);
}

/* Capacity bar glow when near full */
.capacity-bar-fill.full {
  box-shadow: 0 0 6px 1px color-mix(in srgb, var(--amber) 50%, transparent);
}

/* Manifest section reveal */
.manifest-reveal-enter-active {
  animation: manifest-in 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}
.manifest-reveal-leave-active {
  animation: manifest-in 0.2s cubic-bezier(0.25, 1, 0.5, 1) reverse;
}
@keyframes manifest-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Manifest row enter/leave */
.manifest-row-enter-active {
  animation: row-in 0.25s cubic-bezier(0.25, 1, 0.5, 1);
}
.manifest-row-leave-active {
  animation: row-in 0.15s cubic-bezier(0.25, 1, 0.5, 1) reverse;
}
.manifest-row-move {
  transition: transform 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}
@keyframes row-in {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Manifest item pulse on add */
.manifest-item.pulse {
  animation: manifest-pulse 0.35s cubic-bezier(0.25, 1, 0.5, 1);
}

@keyframes manifest-pulse {
  0% {
    background: var(--bg-elevated);
    box-shadow: inset 0 0 0 1px transparent;
  }
  25% {
    background: var(--accent-dim);
    box-shadow: inset 0 0 0 1px var(--cyan);
  }
  100% {
    background: var(--bg-elevated);
    box-shadow: inset 0 0 0 1px transparent;
  }
}

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

.capacity-bar-fill.full {
  background: var(--amber);
}

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
  padding: 8px 14px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  background: var(--bg-elevated);
  color: var(--text-muted);
  border-radius: var(--radius-sm);
}

.launch-btn {
  padding: 8px 22px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  background: var(--cyan);
  color: var(--bg-deep);
  border-radius: var(--radius-sm);
  transition:
    box-shadow 0.3s ease,
    opacity 0.2s ease;
}

.launch-btn.ready {
  animation: launch-glow 2s ease-in-out infinite;
}

@keyframes launch-glow {
  0%,
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
  50% {
    box-shadow: 0 0 8px 1px color-mix(in srgb, var(--cyan) 40%, transparent);
  }
}

.launch-btn:disabled,
.clear-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  animation: none;
}

/* Catalog grid */
.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 4px;
}

.catalog-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  aspect-ratio: 1;
  padding: 6px 4px;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 0.12s cubic-bezier(0.25, 1, 0.5, 1),
    background 0.15s ease,
    opacity 0.2s ease;
  text-align: center;
}

.catalog-btn:active:not(:disabled) {
  transform: scale(0.93);
  background: var(--bg-elevated);
}

.catalog-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.cat-icon {
  color: var(--text-muted);
  transition: color 0.15s ease;
}

.catalog-btn.tapped .cat-icon {
  color: var(--cyan);
}
.cat-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}

.cat-meta {
  display: flex;
  gap: 6px;
  align-items: center;
}

.cat-cost {
  font-size: 9px;
  color: var(--amber);
  display: flex;
  align-items: center;
  gap: 2px;
}

.cat-weight {
  font-size: 9px;
  color: var(--text-muted);
}

/* Qty controls (in manifest rows) */
.qty-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.qty-btn {
  width: 36px;
  height: 36px;
  min-height: 36px;
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: var(--radius-sm);
  background: var(--bg-deep);
  color: var(--text-primary);
  transition: transform 0.1s cubic-bezier(0.25, 1, 0.5, 1);
}

.qty-btn:active:not(:disabled) {
  transform: scale(0.88);
}

.qty-btn:disabled {
  opacity: 0.2;
  cursor: not-allowed;
}

.qty-btn.plus {
  color: var(--green);
}
.qty-btn.minus {
  color: var(--red);
}

.qty-count {
  width: 22px;
  text-align: center;
  font-size: 12px;
  color: var(--text-primary);
}

/* Landscape: narrow panel, ensure 2-col grid and compact manifest */
@media (orientation: landscape), (min-width: 768px) {
  .catalog-grid {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  }

  .catalog-btn {
    padding: 5px 3px;
    gap: 3px;
  }

  .manifest-item {
    padding: 3px 6px;
  }

  .qty-btn {
    width: 32px;
    height: 32px;
    min-height: 32px;
    font-size: 15px;
  }
}

/* Portrait: wide panel, let grid breathe */
@media (orientation: portrait) and (max-width: 767px) {
  .catalog-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }

  .launch-btn,
  .clear-btn {
    padding: 10px 18px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
