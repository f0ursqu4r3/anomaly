<template>
  <div class="store-panel">
    <!-- Rewarded Ad -->
    <div class="store-card featured">
      <div class="store-icon">&#x25B6;</div>
      <div class="store-info">
        <div class="store-name">2x Offline Earnings</div>
        <div class="store-desc">Watch an ad for 4 hours of boosted offline income</div>
      </div>
      <button
        class="store-btn ad-btn"
        :disabled="hasActiveBoost"
        @click="watchAd"
      >
        {{ hasActiveBoost ? 'ACTIVE' : 'WATCH' }}
      </button>
    </div>

    <!-- Remove Ads -->
    <div class="store-card" v-if="!game.removeAds">
      <div class="store-icon">&#x26D4;</div>
      <div class="store-info">
        <div class="store-name">Remove Ads</div>
        <div class="store-desc">Permanently remove all ad placements</div>
      </div>
      <button class="store-btn iap-btn" @click="buyRemoveAds">$2.99</button>
    </div>

    <!-- Drill Pack -->
    <div class="store-card">
      <div class="store-icon">&#x26CF;</div>
      <div class="store-info">
        <div class="store-name">Drill Pack</div>
        <div class="store-desc">1,000 ore + 200 crystals instant boost</div>
      </div>
      <button class="store-btn iap-btn" @click="buyDrillPack">$0.99</button>
    </div>

    <!-- Season Pass -->
    <div class="store-card">
      <div class="store-icon">&#x2B50;</div>
      <div class="store-info">
        <div class="store-name">Season Pass</div>
        <div class="store-desc">Permanent 2x all resource rates</div>
      </div>
      <button class="store-btn iap-btn" @click="buySeasonPass">$4.99</button>
    </div>

    <!-- Restore -->
    <button class="restore-btn" @click="restore">Restore Purchases</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { showRewardedAd } from '@/services/ads'
import { purchase, restorePurchases, PRODUCT_IDS } from '@/services/iap'

const game = useGameStore()

const hasActiveBoost = computed(() => {
  return game.offlineBoostUntil > Date.now()
})

async function watchAd() {
  const rewarded = await showRewardedAd()
  if (rewarded) {
    game.offlineBoostUntil = Date.now() + 4 * 60 * 60 * 1000 // 4 hours
    console.log('[Store] 2x offline boost activated for 4 hours')
  }
}

async function buyRemoveAds() {
  const success = await purchase(PRODUCT_IDS.REMOVE_ADS)
  if (success) {
    game.removeAds = true
  }
}

async function buyDrillPack() {
  const success = await purchase(PRODUCT_IDS.DRILL_PACK_1)
  if (success) {
    game.resources.ore += 1000
    game.resources.crystals += 200
  }
}

async function buySeasonPass() {
  await purchase(PRODUCT_IDS.SEASON_PASS)
}

async function restore() {
  const restored = await restorePurchases()
  if (restored.includes(PRODUCT_IDS.REMOVE_ADS)) {
    game.removeAds = true
  }
}
</script>

<style scoped>
.store-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.store-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.store-card.featured {
  border-color: var(--amber-dim);
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.06), var(--bg-surface));
}

.store-icon {
  font-size: 1.3rem;
  width: 32px;
  text-align: center;
  flex-shrink: 0;
}

.store-info {
  flex: 1;
  min-width: 0;
}

.store-name {
  font-size: 0.85rem;
  font-weight: 600;
}

.store-desc {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.store-btn {
  flex-shrink: 0;
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  transition: background 0.15s, transform 0.1s;
}

.ad-btn {
  background: var(--amber);
  color: #000;
}

.ad-btn:active {
  background: var(--amber-dim);
  transform: scale(0.93);
}

.ad-btn:disabled {
  background: var(--green);
  color: #000;
  opacity: 0.8;
  cursor: default;
  transform: none !important;
  filter: none !important;
}

.iap-btn {
  background: var(--bg-elevated);
  color: var(--cyan);
  border: 1px solid rgba(126, 207, 255, 0.2);
}

.iap-btn:active {
  background: var(--bg-surface);
  transform: scale(0.93);
}

.restore-btn {
  margin-top: 8px;
  padding: 12px;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.75rem;
  text-decoration: underline;
}
</style>
