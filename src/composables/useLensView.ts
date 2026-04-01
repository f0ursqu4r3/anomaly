import { ref, computed } from 'vue'

export type LensMode = 'close' | 'medium'

const currentLens = ref<LensMode>('close')
const isTransitioning = ref(false)
const TRANSITION_MS = 600

export function useLensView() {
  const lens = computed(() => currentLens.value)

  function switchLens(target: LensMode) {
    if (target === currentLens.value || isTransitioning.value) return

    isTransitioning.value = true
    setTimeout(() => {
      currentLens.value = target
      setTimeout(() => {
        isTransitioning.value = false
      }, TRANSITION_MS / 2)
    }, TRANSITION_MS / 2)
  }

  function toggleLens() {
    switchLens(currentLens.value === 'close' ? 'medium' : 'close')
  }

  return {
    lens,
    isTransitioning,
    switchLens,
    toggleLens,
    TRANSITION_MS,
  }
}
