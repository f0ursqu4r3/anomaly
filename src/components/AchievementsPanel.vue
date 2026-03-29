<template>
  <div class="achievements-panel">
    <div class="achievements-header">
      <span class="achievements-count mono">{{ store.unlockedCount }}/{{ store.totalCount }}</span>
      <span v-if="store.secretsFound > 0" class="secrets-count mono">
        {{ store.secretsFound }} secret{{ store.secretsFound > 1 ? 's' : '' }} found
      </span>
    </div>
    <div class="achievements-grid">
      <template v-for="a in displayedAchievements" :key="a.id">
        <div
          class="achievement-badge"
          :class="{ unlocked: a.unlocked, secret: a.secret && !a.unlocked }"
        >
          <div class="badge-icon">{{ a.unlocked || !a.secret ? a.icon : '\uD83D\uDD12' }}</div>
          <div class="badge-info">
            <div class="badge-name">{{ a.unlocked ? a.name : (a.secret ? '???' : a.name) }}</div>
            <div class="badge-desc">{{ a.secret && !a.unlocked ? 'Secret achievement' : a.description }}</div>
          </div>
        </div>
      </template>
      <!-- Undiscovered secrets teaser -->
      <div v-if="hiddenSecretsCount > 0" class="secrets-teaser">
        <span class="secrets-icon">&#x1F512;</span>
        <span class="secrets-text">{{ hiddenSecretsCount }} more secret{{ hiddenSecretsCount > 1 ? 's' : '' }} to discover...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAchievementStore } from '@/stores/achievementStore'

const store = useAchievementStore()

// Show all non-secret achievements, plus any secrets that are unlocked
// Hide undiscovered secrets entirely (just show a count teaser)
const displayedAchievements = computed(() => {
  return store.achievements.filter(a => !a.secret || a.unlocked)
})

const hiddenSecretsCount = computed(() => {
  return store.achievements.filter(a => a.secret && !a.unlocked).length
})
</script>

<style scoped>
.achievements-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.achievements-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.achievements-count {
  font-size: 0.85rem;
  color: var(--amber);
  font-weight: 700;
}

.secrets-count {
  font-size: 0.65rem;
  color: var(--purple);
  font-weight: 600;
}

.achievements-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.achievement-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.04);
  opacity: 0.4;
  filter: grayscale(1);
  transition: opacity 0.3s, filter 0.3s;
}

.achievement-badge.unlocked {
  opacity: 1;
  filter: none;
  border-color: rgba(245, 158, 11, 0.15);
}

.achievement-badge.unlocked.secret {
  border-color: rgba(167, 139, 250, 0.3);
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.06), var(--bg-surface));
}

.badge-icon {
  font-size: 1.4rem;
  width: 32px;
  text-align: center;
  flex-shrink: 0;
}

.badge-info {
  flex: 1;
  min-width: 0;
}

.badge-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.badge-desc {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-top: 1px;
}

.secrets-teaser {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border-radius: var(--radius-md);
  border: 1px dashed rgba(167, 139, 250, 0.2);
  background: rgba(167, 139, 250, 0.03);
}

.secrets-icon {
  font-size: 1rem;
}

.secrets-text {
  font-size: 0.75rem;
  color: var(--purple);
  font-style: italic;
}
</style>
