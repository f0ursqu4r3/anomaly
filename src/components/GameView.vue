<template>
  <div class="game-view">
    <!-- Top section: depth + resources -->
    <div class="top-section">
      <DepthGauge />
      <ResourceBar />
    </div>

    <!-- Center: tap button -->
    <TapButton />

    <!-- Crew -->
    <CrewList />

    <!-- Prestige (conditional) -->
    <PrestigeButton />

    <!-- Bottom tabs -->
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>

    <!-- Tab content -->
    <div class="tab-content">
      <UpgradesPanel v-if="activeTab === 'upgrades'" />
      <HirePanel v-if="activeTab === 'hire'" />
      <StorePanel v-if="activeTab === 'store'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import DepthGauge from './DepthGauge.vue'
import ResourceBar from './ResourceBar.vue'
import TapButton from './TapButton.vue'
import CrewList from './CrewList.vue'
import PrestigeButton from './PrestigeButton.vue'
import UpgradesPanel from './UpgradesPanel.vue'
import HirePanel from './HirePanel.vue'
import StorePanel from './StorePanel.vue'

const activeTab = ref<'upgrades' | 'hire' | 'store'>('upgrades')

const tabs = [
  { id: 'upgrades' as const, icon: '\u2B06', label: 'Upgrades' },
  { id: 'hire' as const, icon: '\uD83D\uDC64', label: 'Hire' },
  { id: 'store' as const, icon: '\uD83D\uDED2', label: 'Store' },
]
</script>

<style scoped>
.game-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  padding-top: var(--safe-top);
  padding-bottom: calc(var(--safe-bottom) + 12px);
  gap: 12px;
}

.top-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
}

.tab-bar {
  display: flex;
  gap: 4px;
  padding: 0 16px;
  margin-top: 4px;
}

.tab-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  transition: background 0.2s, color 0.2s;
  border: 1px solid transparent;
}

.tab-btn.active {
  background: var(--bg-elevated);
  color: var(--amber);
  border-color: rgba(245, 158, 11, 0.2);
}

.tab-icon {
  font-size: 1.1rem;
}

.tab-label {
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.tab-content {
  padding: 0 16px;
  flex: 1;
  min-height: 0;
}
</style>
