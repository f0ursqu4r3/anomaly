<template>
  <div ref="logEl" class="message-log" @scroll="onScroll">
    <div v-for="msg in game.messages" :key="msg.id" class="log-entry" :class="msg.severity">
      <span class="log-time mono">{{ fmtMissionTime(msg.timestamp) }}</span>
      <span class="log-text">{{ msg.text }}</span>
    </div>
    <div v-if="game.messages.length === 0" class="log-empty">Awaiting colony transmissions...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const game = useGameStore()
const logEl = ref<HTMLElement | null>(null)
const userScrolledUp = ref(false)

function fmtMissionTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `T+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function isAtBottom(): boolean {
  if (!logEl.value) return true
  const el = logEl.value
  return el.scrollHeight - el.scrollTop - el.clientHeight < 30
}

function onScroll() {
  userScrolledUp.value = !isAtBottom()
}

function scrollToBottom() {
  if (logEl.value) {
    logEl.value.scrollTop = logEl.value.scrollHeight
  }
}

// Auto-scroll on new messages only if user hasn't scrolled up
watch(
  () => game.messages.length,
  () => {
    if (userScrolledUp.value) return
    nextTick(scrollToBottom)
  },
)

// Scroll to bottom on mount
onMounted(() => {
  nextTick(scrollToBottom)
})
</script>

<style scoped>
.message-log {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 8px 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.6;
}

.log-entry {
  display: flex;
  gap: 8px;
  padding: 2px 0;
}

.log-time {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.log-text {
  color: var(--text-secondary);
}

.log-entry.event .log-text {
  color: var(--cyan);
}

.log-entry.warning .log-text {
  color: var(--amber);
}

.log-entry.critical .log-text {
  color: var(--red);
  font-weight: 600;
}

.log-empty {
  color: var(--text-muted);
  text-align: center;
  padding: 20px;
  font-style: italic;
}
</style>
