<template>
  <div class="game-view">
    <DepthBackground />

    <!-- Top: depth + resources + hull -->
    <div class="top-section">
      <DepthGauge />
      <HullBar />
      <ResourceBar />
    </div>

    <!-- Active path banner -->
    <div v-if="game.activePath" class="path-banner">
      <span class="path-banner-icon">&#x1F6E4;</span>
      <span class="path-banner-name">{{ game.activePath.name }}</span>
    </div>

    <!-- Center: tap button + effects -->
    <div class="center-section">
      <TapEffects ref="tapEffectsRef" />
      <TapButton @tap="onTap" />
    </div>

    <MilestoneFlash />

    <!-- Bottom: crew summary + tab bar -->
    <div class="bottom-section">
      <CrewSummary @open="toggleTab('crew')" />
      <div class="tab-bar">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-btn"
          :class="{ active: sheetOpen && activeTab === tab.id }"
          @click="toggleTab(tab.id)"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </div>
    </div>

    <BottomSheet v-model="sheetOpen" :title="activeTabTitle">
      <CrewList v-if="activeTab === 'crew'" />
      <UpgradesPanel v-if="activeTab === 'upgrades'" />
      <HirePanel v-if="activeTab === 'hire'" />
      <StorePanel v-if="activeTab === 'store'" />
      <AchievementsPanel v-if="activeTab === 'achievements'" />
      <ArtifactsPanel v-if="activeTab === 'artifacts'" />
    </BottomSheet>

    <PathChoiceModal />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import DepthGauge from './DepthGauge.vue'
import HullBar from './HullBar.vue'
import ResourceBar from './ResourceBar.vue'
import TapButton from './TapButton.vue'
import TapEffects from './TapEffects.vue'
import DepthBackground from './DepthBackground.vue'
import MilestoneFlash from './MilestoneFlash.vue'
import CrewSummary from './CrewSummary.vue'
import CrewList from './CrewList.vue'
import BottomSheet from './BottomSheet.vue'
import UpgradesPanel from './UpgradesPanel.vue'
import HirePanel from './HirePanel.vue'
import StorePanel from './StorePanel.vue'
import AchievementsPanel from './AchievementsPanel.vue'
import ArtifactsPanel from './ArtifactsPanel.vue'
import PathChoiceModal from './PathChoiceModal.vue'

const game = useGameStore()

type TabId = 'upgrades' | 'crew' | 'hire' | 'store' | 'achievements' | 'artifacts'

const activeTab = ref<TabId>('upgrades')
const sheetOpen = ref(false)
const tapEffectsRef = ref<InstanceType<typeof TapEffects> | null>(null)

const tabs = [
  { id: 'upgrades' as const, icon: '\u2B06', label: 'Upgrades' },
  { id: 'crew' as const, icon: '\uD83D\uDC64', label: 'Crew' },
  { id: 'hire' as const, icon: '\u2795', label: 'Hire' },
  { id: 'artifacts' as const, icon: '\uD83D\uDD2E', label: 'Relics' },
  { id: 'store' as const, icon: '\uD83D\uDED2', label: 'Store' },
  { id: 'achievements' as const, icon: '\uD83C\uDFC5', label: 'Awards' },
]

const activeTabTitle = computed(() => {
  return tabs.find(t => t.id === activeTab.value)?.label ?? ''
})

function toggleTab(tabId: TabId) {
  if (sheetOpen.value && activeTab.value === tabId) {
    sheetOpen.value = false
  } else {
    activeTab.value = tabId
    sheetOpen.value = true
  }
}

function onTap(depthGain: number) {
  tapEffectsRef.value?.spawnNumber(depthGain)
}
</script>

<style scoped>
.game-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-top: var(--safe-top);
  padding-bottom: var(--safe-bottom);
  position: relative;
}

.top-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 16px 6px;
  position: relative;
  z-index: 1;
  background: linear-gradient(to bottom, var(--bg-deep) 0%, var(--bg-deep) 85%, transparent 100%);
}

.path-banner {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 4px 16px;
  position: relative;
  z-index: 1;
}

.path-banner-icon { font-size: 0.8rem; }
.path-banner-name {
  font-size: 0.65rem;
  color: var(--cyan);
  font-weight: 600;
  letter-spacing: 0.08em;
}

.center-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  position: relative;
  z-index: 1;
}

.bottom-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 8px;
  position: relative;
  z-index: 1;
}

.tab-bar {
  display: flex;
  gap: 3px;
  padding: 0 16px;
}

.tab-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 6px 2px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  transition: background 0.15s, color 0.15s;
  border: 1px solid transparent;
}

.tab-btn:active {
  background: var(--bg-elevated);
  transform: scale(0.95);
}

.tab-btn.active {
  background: var(--bg-elevated);
  color: var(--amber);
  border-color: rgba(245, 158, 11, 0.2);
}

.tab-icon { font-size: 0.9rem; }

.tab-label {
  font-size: 0.45rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
</style>
