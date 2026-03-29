<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="modelValue" class="sheet-overlay" @click.self="close">
        <div
          class="sheet-panel"
          ref="panelRef"
          :style="dragStyle"
        >
          <div
            class="sheet-handle-area"
            @touchstart.passive="onTouchStart"
            @touchmove.passive="onTouchMove"
            @touchend="onTouchEnd"
          >
            <div class="sheet-handle"></div>
          </div>
          <div class="sheet-header">
            <span class="sheet-title">{{ title }}</span>
          </div>
          <div class="sheet-body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  title: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const panelRef = ref<HTMLElement | null>(null)
const dragOffsetY = ref(0)
const isDragging = ref(false)
let startY = 0

const dragStyle = computed(() => {
  if (!isDragging.value || dragOffsetY.value <= 0) return {}
  return {
    transform: `translateY(${dragOffsetY.value}px)`,
    transition: 'none',
  }
})

function close() {
  emit('update:modelValue', false)
}

function onTouchStart(e: TouchEvent) {
  startY = e.touches[0].clientY
  isDragging.value = true
  dragOffsetY.value = 0
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value) return
  const delta = e.touches[0].clientY - startY
  dragOffsetY.value = Math.max(0, delta)
}

function onTouchEnd() {
  if (dragOffsetY.value > 120) {
    close()
  }
  dragOffsetY.value = 0
  isDragging.value = false
}
</script>

<style scoped>
.sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 900;
  display: flex;
  align-items: flex-end;
}

.sheet-panel {
  width: 100%;
  max-height: 72vh;
  background: var(--bg-primary);
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
}

.sheet-handle-area {
  display: flex;
  justify-content: center;
  padding: 10px 0 4px;
  cursor: grab;
  touch-action: none;
}

.sheet-handle {
  width: 36px;
  height: 4px;
  background: var(--text-muted);
  border-radius: var(--radius-full);
}

.sheet-header {
  padding: 4px 20px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.sheet-title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.sheet-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 24px;
  -webkit-overflow-scrolling: touch;
}

/* Transitions */
.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform 0.3s ease;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: background 0.3s ease;
}

.sheet-enter-from {
  background: rgba(0, 0, 0, 0);
}

.sheet-enter-from .sheet-panel {
  transform: translateY(100%);
}

.sheet-leave-to {
  background: rgba(0, 0, 0, 0);
}

.sheet-leave-to .sheet-panel {
  transform: translateY(100%);
}
</style>
