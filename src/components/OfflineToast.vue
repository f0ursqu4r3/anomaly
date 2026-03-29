<template>
  <Transition name="toast">
    <div v-if="visible" class="offline-toast" @click="dismiss">
      <div class="toast-icon">&#x26CF;</div>
      <div class="toast-text">
        <div class="toast-title">Welcome back</div>
        <div class="toast-detail">Your crew drilled {{ depthGained }} while you were gone</div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fmtDepth } from '@/utils/format'

const props = defineProps<{
  depthGained: string
}>()

const visible = ref(true)

function dismiss() {
  visible.value = false
}

onMounted(() => {
  setTimeout(() => {
    visible.value = false
  }, 5000)
})
</script>

<style scoped>
.offline-toast {
  position: fixed;
  bottom: calc(20px + var(--safe-bottom));
  left: 16px;
  right: 16px;
  padding: 14px 16px;
  background: var(--bg-card);
  border: 1px solid var(--amber-dim);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 500;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
}

.toast-icon {
  font-size: 1.4rem;
  flex-shrink: 0;
}

.toast-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--amber);
}

.toast-detail {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 1px;
}

.toast-enter-active {
  animation: toast-in 0.4s ease-out;
}

.toast-leave-active {
  animation: toast-out 0.3s ease-in forwards;
}
</style>
