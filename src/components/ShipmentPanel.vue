<template>
  <div class="shipment-panel">
    <!-- Cooldown bar -->
    <div v-if="game.shipmentOnCooldown" class="cooldown-bar">
      <div class="cooldown-fill" :style="{ width: cooldownPct + '%' }" />
      <span class="cooldown-text mono">REFUELING {{ cooldownText }}</span>
    </div>

    <!-- In-transit -->
    <div v-if="game.inTransitShipments.length > 0" class="transit-section">
      <div class="section-label">EN ROUTE</div>
      <div v-for="s in game.inTransitShipments" :key="s.id" class="transit-item">
        <span class="transit-label">{{ s.contents.length }} items · {{ s.totalWeight }}kg</span>
        <span class="transit-eta mono">ETA {{ formatEta(s.arrivalAt) }}</span>
      </div>
    </div>

    <!-- Auto-relaunch toggle (visible when no manifest but previous exists) -->
    <div v-if="game.manifest.length === 0 && game.lastManifest.length > 0" class="relaunch-row">
      <button
        class="repeat-btn standalone"
        :class="{ active: game.autoRelaunch }"
        @click="game.toggleAutoRelaunch()"
      >
        {{ game.autoRelaunch ? '⟳ AUTO-REPEAT ON' : '⟳ AUTO-REPEAT' }}
      </button>
      <span class="relaunch-hint mono">Last: {{ game.lastManifest.length }} items</span>
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
            <span :class="{ 'weight-full': game.manifestWeight >= maxWeight }"
              >{{ game.manifestWeight }}/{{ maxWeight }}kg</span
            >
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
    <!-- Catalog rows -->
    <div class="catalog">
      <button
        v-for="opt in options"
        :key="opt.label"
        class="catalog-row"
        :class="{ disabled: !canAdd(opt), tapped: tappedItem === opt.label }"
        @click="addFromCatalog(opt)"
      >
        <SvgIcon :name="shipmentIcon(opt)" size="sm" class="catalog-icon" />
        <span class="catalog-name">{{ opt.label }}</span>
        <span class="catalog-stat mono">{{ opt.abbrevStat }}</span>
        <span class="catalog-cost mono">{{ opt.cost }}cr</span>
        <span class="catalog-weight mono">{{ opt.weight }}kg</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  useGameStore,
  SHIPMENT_OPTIONS,
  CARGO_CAPACITY,
  SHIPMENT_COOLDOWN_MS,
} from '@/stores/gameStore'
import type { ShipmentOption } from '@/stores/gameStore'
import SvgIcon from './SvgIcon.vue'

const game = useGameStore()
const options = SHIPMENT_OPTIONS
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
    // Keep isLaunching true briefly so the leave transition is suppressed
    // (the launch-flash animation already provides the visual exit)
    setTimeout(() => {
      isLaunching.value = false
    }, 50)
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
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--text-secondary);
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.manifest-meta {
  font-size: 0.625rem;
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
  font-size: 0.625rem;
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
  font-size: 0.6875rem;
  color: var(--cyan);
}
.transit-eta {
  font-size: 0.625rem;
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
  font-size: 0.6875rem;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
}
.manifest-wt {
  font-size: 0.625rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.manifest-section.launching {
  animation: launch-flash 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
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
.weight-full {
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
  animation: manifest-in 0.15s cubic-bezier(0.25, 1, 0.5, 1) reverse;
}
/* Skip leave animation after launch — launch-flash already handles the exit */
.manifest-section.launching.manifest-reveal-leave-active {
  animation: none;
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
  border-radius: var(--radius-xs);
  margin-bottom: 8px;
  overflow: hidden;
}

.capacity-bar-fill {
  height: 100%;
  background: var(--cyan);
  border-radius: var(--radius-xs);
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
  font-size: 0.8125rem;
  color: var(--amber);
  display: flex;
  align-items: center;
  gap: 3px;
}

.manifest-actions {
  display: flex;
  gap: 6px;
}

.repeat-btn {
  padding: 8px 14px;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  background: var(--bg-elevated);
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.repeat-btn.active {
  background: var(--accent-dim);
  color: var(--cyan);
  border: 1px solid var(--cyan);
}

.relaunch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 6px 8px;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
}

.relaunch-hint {
  font-size: 0.625rem;
  color: var(--text-secondary);
}

.repeat-btn.standalone {
  padding: 6px 12px;
}

.clear-btn {
  padding: 8px 14px;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  background: var(--bg-elevated);
  color: var(--text-muted);
  border-radius: var(--radius-sm);
}

.launch-btn {
  padding: 8px 22px;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
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

/* Catalog rows */
.catalog {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 8px;
}

.catalog-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px;
  min-height: 44px;
  background: var(--bg-surface);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  width: 100%;
  cursor: pointer;
  transition: all 0.1s;
  font-family: var(--font-mono);
}

.catalog-row:active:not(.disabled) {
  background: var(--accent-dim);
  border-color: var(--cyan);
}

.catalog-row.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.catalog-row.tapped {
  animation: row-flash 0.2s ease;
}

@keyframes row-flash {
  0% { background: var(--accent-dim); }
  100% { background: var(--bg-surface); }
}

.catalog-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.catalog-name {
  flex: 1;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  text-align: left;
}

.catalog-stat {
  font-size: 0.625rem;
  color: var(--amber);
  min-width: 50px;
  text-align: right;
}

.catalog-cost {
  font-size: 0.6875rem;
  color: var(--green);
  min-width: 50px;
  text-align: right;
}

.catalog-weight {
  font-size: 0.625rem;
  color: var(--text-muted);
  min-width: 30px;
  text-align: right;
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
  font-size: 1rem;
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
  font-size: 0.75rem;
  color: var(--text-primary);
}

/* Landscape: compact manifest */
@media (orientation: landscape), (min-width: 768px) {
  .manifest-item {
    padding: 3px 6px;
  }

  .qty-btn {
    width: 32px;
    height: 32px;
    min-height: 32px;
    font-size: 0.9375rem;
  }
}

/* Portrait: wider launch/clear buttons */
@media (orientation: portrait) and (max-width: 767px) {
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
