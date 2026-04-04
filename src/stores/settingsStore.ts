import { defineStore } from 'pinia'
import { Preferences } from '@capacitor/preferences'

const SETTINGS_KEY = 'colony-settings-v1'

export interface Settings {
  // Game
  autoSave: boolean
  notifications: boolean
  // Display
  scanlines: boolean
  zoneLabels: boolean
  pathLines: boolean
  radioChatter: boolean
  // Accessibility
  textSize: 'small' | 'normal' | 'large'
  reduceAnimations: boolean
  highContrast: boolean
  // Onboarding
  manualOpened: boolean
  // Debug
  showFps: boolean
  showActionStates: boolean
  timeMultiplier: 0.125 | 0.25 | 0.5 | 1 | 2 | 5
}

const DEFAULTS: Settings = {
  autoSave: true,
  notifications: true,
  scanlines: true,
  zoneLabels: true,
  pathLines: true,
  radioChatter: true,
  textSize: 'normal',
  reduceAnimations: false,
  highContrast: false,
  manualOpened: false,
  showFps: false,
  showActionStates: false,
  timeMultiplier: 1,
}

export const useSettingsStore = defineStore('settings', {
  state: (): Settings => ({ ...DEFAULTS }),

  actions: {
    async load() {
      try {
        const { value } = await Preferences.get({ key: SETTINGS_KEY })
        if (value) {
          const parsed = JSON.parse(value) as Partial<Settings>
          this.$patch(parsed)
          return
        }
      } catch { /* fall through */ }
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>
        this.$patch(parsed)
      }
    },

    async save() {
      const data = JSON.stringify(this.$state)
      try {
        await Preferences.set({ key: SETTINGS_KEY, value: data })
      } catch {
        localStorage.setItem(SETTINGS_KEY, data)
      }
    },

    reset() {
      this.$patch({ ...DEFAULTS })
      this.save()
    },

    toggle(key: keyof Settings) {
      const val = this[key]
      if (typeof val === 'boolean') {
        (this as any)[key] = !val
        this.save()
      }
    },

    set<K extends keyof Settings>(key: K, value: Settings[K]) {
      (this as any)[key] = value
      this.save()
    },
  },
})
