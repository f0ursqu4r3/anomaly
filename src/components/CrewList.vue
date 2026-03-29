<template>
  <div class="crew-section">
    <div class="section-header">
      <span class="section-title">CREW</span>
      <span class="section-count mono">{{ game.crew.length }}</span>
    </div>
    <div class="crew-list">
      <div v-for="member in game.crew" :key="member.id" class="crew-card">
        <div class="crew-role-icon">{{ roleIcon(member.role) }}</div>
        <div class="crew-info">
          <div class="crew-top">
            <span class="crew-name">{{ member.name }}</span>
            <span class="crew-level mono">Lv.{{ member.level }}</span>
          </div>
          <div class="crew-xp-track">
            <div class="crew-xp-fill" :style="{ width: xpPercent(member) + '%' }"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'
import type { CrewMember, CrewRole } from '@/stores/gameStore'

const game = useGameStore()

function roleIcon(role: CrewRole): string {
  switch (role) {
    case 'driller': return '\u26CF'
    case 'refiner': return '\u2697'
    case 'researcher': return '\uD83D\uDD2C'
  }
}

function xpPercent(member: CrewMember): number {
  return Math.min((member.xp / member.xpToNext) * 100, 100)
}
</script>

<style scoped>
.crew-section {
  padding: 0 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-title {
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  color: var(--text-muted);
}

.section-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.crew-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.crew-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.crew-role-icon {
  font-size: 1.3rem;
  width: 32px;
  text-align: center;
  flex-shrink: 0;
}

.crew-info {
  flex: 1;
  min-width: 0;
}

.crew-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}

.crew-name {
  font-size: 0.85rem;
  font-weight: 600;
}

.crew-level {
  font-size: 0.7rem;
  color: var(--amber);
  font-weight: 600;
}

.crew-xp-track {
  height: 4px;
  background: var(--bg-deep);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.crew-xp-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--amber-dim), var(--amber));
  border-radius: var(--radius-full);
  transition: width 0.3s ease-out;
}
</style>
