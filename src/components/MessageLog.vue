<template>
  <div ref="logEl" class="message-log" @scroll="onScroll" @click="onLogClick">
    <div v-for="msg in game.messages" :key="msg.id" class="log-entry" :class="msg.severity">
      <span class="log-time mono">{{ fmtMissionTime(msg.timestamp) }}</span>
      <span class="log-text" v-html="renderMessage(msg.text)" />
    </div>
    <div v-if="game.messages.length === 0" class="log-empty">Awaiting colony transmissions...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
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

const colonistNames = computed(() =>
  game.colonists.map((c) => c.name).sort((a, b) => b.length - a.length),
)

function renderMessage(text: string): string {
  let result = escapeHtml(text)
  for (const name of colonistNames.value) {
    const escapedName = escapeHtml(name)
    const colonist = game.colonists.find((c) => c.name === name)
    if (colonist) {
      result = result.replace(
        new RegExp(`\\b${escapeRegex(escapedName)}\\b`, 'g'),
        `<span class="colonist-link" data-colonist-id="${colonist.id}">${escapedName}</span>`,
      )
    }
  }
  return result
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function onLogClick(e: Event) {
  const target = e.target as HTMLElement
  if (target.classList.contains('colonist-link')) {
    const id = target.dataset.colonistId
    if (id) {
      game.trackColonist(game.trackedColonistId === id ? null : id)
    }
  }
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
  font-size: 0.6875rem;
  line-height: 1.6;
}

.log-entry {
  display: flex;
  gap: 8px;
  padding: 2px 0 2px 6px;
  border-left: 2px solid transparent;
}

.log-entry.event {
  border-left-color: var(--cyan);
}

.log-entry.warning {
  border-left-color: var(--amber);
}

.log-entry.critical {
  border-left-color: var(--red);
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

:deep(.colonist-link) {
  color: var(--cyan);
  cursor: pointer;
  border-bottom: 1px dotted var(--cyan);
  padding: 4px 2px;
  margin: -4px -2px;
}

:deep(.colonist-link:active) {
  color: var(--text-primary);
  background: var(--accent-dim);
}
</style>
