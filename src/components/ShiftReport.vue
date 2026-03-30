<template>
  <Transition name="modal">
    <div v-if="visible" class="modal-overlay">
      <div class="report-card">
        <h2 class="report-title">Shift Report</h2>
        <p class="report-duration mono">{{ fmtDuration(durationMs) }} offline</p>

        <div v-if="events.length > 0" class="report-events">
          <div
            v-for="(event, i) in events"
            :key="i"
            class="report-event"
            :class="'severity-' + event.severity"
          >
            <span class="event-time mono">{{ fmtOffsetTime(event.offsetMs) }}</span>
            <span class="event-message">{{ event.message }}</span>
          </div>
        </div>
        <div v-else class="report-quiet">
          All systems nominal. No incidents while you were away.
        </div>

        <div class="report-deltas">
          <div class="delta">
            <span class="delta-label">CREDITS</span>
            <span class="delta-value mono" :class="deltaCredits >= 0 ? 'positive' : 'negative'">
              {{ deltaCredits >= 0 ? '+' : '' }}{{ Math.floor(deltaCredits) }}
            </span>
          </div>
          <div class="delta">
            <span class="delta-label">METALS</span>
            <span class="delta-value mono positive">+{{ Math.floor(deltaMetals) }}</span>
          </div>
          <div class="delta">
            <span class="delta-label">ICE</span>
            <span class="delta-value mono positive">+{{ Math.floor(deltaIce) }}</span>
          </div>
          <div class="delta">
            <span class="delta-label">DEPTH</span>
            <span class="delta-value mono positive">+{{ fmtDepth(deltaDepth) }}</span>
          </div>
        </div>

        <div class="report-status" :class="'status-' + colonyStatus">
          Colony Status: {{ colonyStatus.toUpperCase() }}
        </div>

        <button class="resume-btn" @click="$emit('dismiss')">Resume Operations</button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { fmtDepth, fmtDuration } from '@/utils/format'

defineProps<{
  visible: boolean
  durationMs: number
  deltaCredits: number
  deltaMetals: number
  deltaIce: number
  deltaDepth: number
}>()

defineEmits<{
  dismiss: []
}>()

const game = useGameStore()

const events = computed(() => game.offlineEvents)

const colonyStatus = computed(() => {
  if (game.air <= game.airMax * 0.15 || game.power <= game.powerMax * 0.15) return 'critical'
  if (game.air <= game.airMax * 0.3 || game.power <= game.powerMax * 0.3) return 'warning'
  return 'nominal'
})

function fmtOffsetTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `+${h}h${String(m).padStart(2, '0')}m`
  if (m > 0) return `+${m}m${String(s).padStart(2, '0')}s`
  return `+${s}s`
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.report-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 28px 22px;
  text-align: center;
  max-width: 360px;
  width: 100%;
  animation: slide-up 0.3s ease;
  border: 1px solid var(--cyan-glow);
  max-height: 80vh;
  overflow-y: auto;
}

.report-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--cyan);
  margin-bottom: 4px;
}

.report-duration {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.report-events {
  text-align: left;
  margin-bottom: 16px;
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.report-event {
  font-size: 12px;
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: var(--accent-faint);
}

.event-time {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
  min-width: 52px;
}

.event-message {
  color: var(--text-secondary);
}

.severity-critical .event-message {
  color: var(--red);
  font-weight: 600;
}

.severity-warning .event-message {
  color: var(--amber);
}

.report-quiet {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 16px;
  font-style: italic;
}

.report-deltas {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.delta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.delta-label {
  font-size: 9px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.delta-value {
  font-size: 15px;
  font-weight: 600;
}

.positive {
  color: var(--green);
}

.negative {
  color: var(--red);
}

.report-status {
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 8px;
  border-radius: var(--radius-sm);
  margin-bottom: 20px;
}

.status-nominal {
  color: var(--green);
  background: color-mix(in srgb, var(--green) 10%, transparent);
}

.status-warning {
  color: var(--amber);
  background: color-mix(in srgb, var(--amber) 10%, transparent);
}

.status-critical {
  color: var(--red);
  background: color-mix(in srgb, var(--red) 10%, transparent);
  animation: pulse 1.5s ease infinite;
}

.resume-btn {
  width: 100%;
  padding: 14px;
  font-size: 16px;
  font-weight: 700;
  background: var(--cyan);
  color: var(--bg-deep);
  border-radius: var(--radius-md);
}

.modal-enter-active {
  animation: slide-up 0.3s ease;
}
.modal-leave-active {
  animation: slide-up 0.3s ease reverse forwards;
}
</style>
