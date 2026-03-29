<template>
  <div class="crew-section">
    <div class="section-header">
      <span class="section-title">CREW</span>
      <button class="auto-assign" @click="game.assignAllByRole()">Auto-assign</button>
    </div>
    <div class="crew-list">
      <div v-for="member in game.crew" :key="member.id" class="crew-card">
        <div class="crew-left">
          <div class="crew-role-icon">{{ roleIcon(member.role) }}</div>
          <div class="crew-info">
            <div class="crew-top">
              <span class="crew-name">{{ member.name }}</span>
              <span class="crew-level mono">Lv.{{ member.level }}</span>
            </div>
            <div class="crew-bars">
              <div class="bar-row">
                <span class="bar-label">XP</span>
                <div class="bar-track">
                  <div class="bar-fill xp-fill" :style="{ width: xpPercent(member) + '%' }"></div>
                </div>
              </div>
              <div class="bar-row">
                <span class="bar-label">STA</span>
                <div class="bar-track">
                  <div class="bar-fill stamina-fill" :class="staminaClass(member)" :style="{ width: member.stamina + '%' }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="crew-station">
          <button
            class="station-btn"
            :class="{ matched: isMatched(member) }"
            @click="cycleStation(member.id, member.station)"
          >
            <span class="station-icon">{{ stationIcon(member.station) }}</span>
            <span class="station-label">{{ member.station }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'
import type { CrewMember, CrewRole, Station } from '@/stores/gameStore'

const game = useGameStore()

const STATIONS: Station[] = ['drill', 'refinery', 'lab', 'scout', 'idle']

function roleIcon(role: CrewRole): string {
  switch (role) {
    case 'driller': return '\u26CF'
    case 'refiner': return '\u2697'
    case 'researcher': return '\uD83D\uDD2C'
  }
}

function stationIcon(station: Station): string {
  switch (station) {
    case 'drill': return '\u26CF'
    case 'refinery': return '\u2697'
    case 'lab': return '\uD83D\uDD2C'
    case 'scout': return '\uD83E\uDDED'
    case 'idle': return '\uD83D\uDCA4'
  }
}

function xpPercent(member: CrewMember): number {
  return Math.min((member.xp / member.xpToNext) * 100, 100)
}

function staminaClass(member: CrewMember): string {
  if (member.stamina < 30) return 'stamina-low'
  if (member.stamina < 60) return 'stamina-mid'
  return 'stamina-high'
}

function isMatched(member: CrewMember): boolean {
  return (member.role === 'driller' && member.station === 'drill') ||
         (member.role === 'refiner' && member.station === 'refinery') ||
         (member.role === 'researcher' && member.station === 'lab')
}

function cycleStation(crewId: string, current: Station) {
  const idx = STATIONS.indexOf(current)
  const next = STATIONS[(idx + 1) % STATIONS.length]
  game.assignCrew(crewId, next)
}
</script>

<style scoped>
.crew-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.section-title {
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  color: var(--text-muted);
}

.auto-assign {
  font-size: 0.6rem;
  padding: 4px 8px;
  min-height: 28px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
}

.auto-assign:active {
  background: var(--bg-surface);
}

.crew-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.crew-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.crew-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.crew-role-icon {
  font-size: 1.1rem;
  width: 24px;
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
  margin-bottom: 3px;
}

.crew-name {
  font-size: 0.8rem;
  font-weight: 600;
}

.crew-level {
  font-size: 0.65rem;
  color: var(--amber);
  font-weight: 600;
}

.crew-bars {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.bar-label {
  font-size: 0.45rem;
  color: var(--text-muted);
  width: 18px;
  flex-shrink: 0;
  letter-spacing: 0.05em;
}

.bar-track {
  flex: 1;
  height: 3px;
  background: var(--bg-deep);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.3s ease-out;
}

.xp-fill { background: linear-gradient(90deg, var(--amber-dim), var(--amber)); }
.stamina-high { background: var(--green); }
.stamina-mid { background: var(--amber); }
.stamina-low { background: var(--red); animation: pulse-glow 1s ease-in-out infinite; --amber-glow: var(--red-glow); }

.crew-station {
  flex-shrink: 0;
}

.station-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 6px 10px;
  min-height: 40px;
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  transition: background 0.15s;
}

.station-btn.matched {
  color: var(--green);
  background: rgba(52, 211, 153, 0.08);
}

.station-btn:active {
  background: var(--bg-surface);
  transform: scale(0.93);
}

.station-icon {
  font-size: 0.9rem;
}

.station-label {
  font-size: 0.45rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
</style>
