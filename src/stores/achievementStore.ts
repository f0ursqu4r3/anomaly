import { defineStore } from 'pinia'
import { useGameStore } from './gameStore'

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: 'tapping' | 'depth' | 'resources' | 'crew' | 'prestige' | 'secret'
  secret: boolean
  unlocked: boolean
  unlockedAt: number | null
}

interface AchievementDef {
  id: string
  name: string
  description: string
  icon: string
  category: Achievement['category']
  secret?: boolean
  check: (game: ReturnType<typeof useGameStore>) => boolean
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // ── Tapping ─────────────────────────────────────────────────────────────────
  { id: 'tap-10', name: 'First Strike', description: 'Tap 10 times', icon: '\uD83D\uDC46', category: 'tapping',
    check: (g) => g.totalTaps >= 10 },
  { id: 'tap-100', name: 'Relentless', description: 'Tap 100 times', icon: '\uD83D\uDCA5', category: 'tapping',
    check: (g) => g.totalTaps >= 100 },
  { id: 'tap-500', name: 'Calloused', description: 'Tap 500 times', icon: '\u270A', category: 'tapping',
    check: (g) => g.totalTaps >= 500 },
  { id: 'tap-1000', name: 'Machine Gun', description: 'Tap 1,000 times', icon: '\uD83D\uDD25', category: 'tapping',
    check: (g) => g.totalTaps >= 1000 },
  { id: 'tap-5000', name: 'Jackhammer', description: 'Tap 5,000 times', icon: '\uD83D\uDCA2', category: 'tapping',
    check: (g) => g.totalTaps >= 5000 },
  { id: 'tap-10000', name: 'Fingertip Legend', description: 'Tap 10,000 times', icon: '\uD83E\uDD1E', category: 'tapping',
    check: (g) => g.totalTaps >= 10000 },
  { id: 'combo-5', name: 'Combo Starter', description: 'Reach a 5x combo', icon: '\u26A1', category: 'tapping',
    check: (g) => g.comboCount >= 5 },
  { id: 'combo-10', name: 'Combo King', description: 'Reach a 10x combo', icon: '\uD83D\uDC51', category: 'tapping',
    check: (g) => g.comboCount >= 10 },
  { id: 'combo-20', name: 'Combo God', description: 'Reach a 20x combo', icon: '\uD83C\uDF1F', category: 'tapping',
    check: (g) => g.comboCount >= 20 },
  { id: 'combo-50', name: 'Untouchable', description: 'Reach a 50x combo', icon: '\uD83C\uDF08', category: 'tapping',
    check: (g) => g.comboCount >= 50 },

  // ── Depth ───────────────────────────────────────────────────────────────────
  { id: 'depth-50', name: 'Scratching the Surface', description: 'Reach 50m depth', icon: '\uD83E\uDEA8', category: 'depth',
    check: (g) => g.maxDepth >= 50 },
  { id: 'depth-100', name: 'Getting Started', description: 'Reach 100m depth', icon: '\u2B07', category: 'depth',
    check: (g) => g.maxDepth >= 100 },
  { id: 'depth-250', name: 'Underground', description: 'Reach 250m depth', icon: '\uD83D\uDEE4', category: 'depth',
    check: (g) => g.maxDepth >= 250 },
  { id: 'depth-500', name: 'Deep Diver', description: 'Reach 500m depth', icon: '\uD83E\uDD3F', category: 'depth',
    check: (g) => g.maxDepth >= 500 },
  { id: 'depth-1000', name: 'Kilometer Club', description: 'Reach 1,000m depth', icon: '\uD83C\uDFC6', category: 'depth',
    check: (g) => g.maxDepth >= 1000 },
  { id: 'depth-2000', name: 'Abyss Walker', description: 'Reach 2,000m depth', icon: '\uD83C\uDF0C', category: 'depth',
    check: (g) => g.maxDepth >= 2000 },
  { id: 'depth-3000', name: 'Void Touched', description: 'Reach 3,000m depth', icon: '\uD83D\uDD73', category: 'depth',
    check: (g) => g.maxDepth >= 3000 },
  { id: 'depth-5000', name: 'Core Breaker', description: 'Reach 5,000m depth', icon: '\u2604', category: 'depth',
    check: (g) => g.maxDepth >= 5000 },
  { id: 'depth-10000', name: 'Mantle Piercer', description: 'Reach 10,000m depth', icon: '\uD83C\uDF0B', category: 'depth',
    check: (g) => g.maxDepth >= 10000 },
  { id: 'speed-1', name: 'Cruising', description: 'Reach 1 m/s drill speed', icon: '\uD83D\uDE80', category: 'depth',
    check: (g) => g.drillSpeed >= 1 },
  { id: 'speed-5', name: 'Speed Demon', description: 'Reach 5 m/s drill speed', icon: '\uD83D\uDCA8', category: 'depth',
    check: (g) => g.drillSpeed >= 5 },
  { id: 'speed-10', name: 'Terminal Velocity', description: 'Reach 10 m/s drill speed', icon: '\u2622', category: 'depth',
    check: (g) => g.drillSpeed >= 10 },
  { id: 'speed-25', name: 'Ludicrous Speed', description: 'Reach 25 m/s drill speed', icon: '\uD83C\uDF00', category: 'depth',
    check: (g) => g.drillSpeed >= 25 },

  // ── Resources ───────────────────────────────────────────────────────────────
  { id: 'ore-1k', name: 'Ore Collector', description: 'Accumulate 1,000 ore', icon: '\u26CF', category: 'resources',
    check: (g) => g.resources.ore >= 1000 },
  { id: 'ore-10k', name: 'Ore Baron', description: 'Accumulate 10,000 ore', icon: '\uD83D\uDCB0', category: 'resources',
    check: (g) => g.resources.ore >= 10000 },
  { id: 'ore-100k', name: 'Ore Tycoon', description: 'Accumulate 100,000 ore', icon: '\uD83D\uDCB4', category: 'resources',
    check: (g) => g.resources.ore >= 100000 },
  { id: 'crystal-500', name: 'Crystal Finder', description: 'Accumulate 500 crystals', icon: '\u2728', category: 'resources',
    check: (g) => g.resources.crystals >= 500 },
  { id: 'crystal-1k', name: 'Crystal Hoarder', description: 'Accumulate 1,000 crystals', icon: '\uD83D\uDC8E', category: 'resources',
    check: (g) => g.resources.crystals >= 1000 },
  { id: 'crystal-10k', name: 'Crystal Magnate', description: 'Accumulate 10,000 crystals', icon: '\uD83D\uDC0E', category: 'resources',
    check: (g) => g.resources.crystals >= 10000 },
  { id: 'data-500', name: 'Data Novice', description: 'Accumulate 500 data', icon: '\uD83D\uDCCA', category: 'resources',
    check: (g) => g.resources.data >= 500 },
  { id: 'data-1k', name: 'Data Miner', description: 'Accumulate 1,000 data', icon: '\uD83D\uDCE1', category: 'resources',
    check: (g) => g.resources.data >= 1000 },
  { id: 'data-10k', name: 'Data Architect', description: 'Accumulate 10,000 data', icon: '\uD83E\uDDE0', category: 'resources',
    check: (g) => g.resources.data >= 10000 },
  { id: 'upgrade-all', name: 'Fully Loaded', description: 'Purchase all upgrades', icon: '\uD83D\uDEE0', category: 'resources',
    check: (g) => g.upgrades.every(u => u.purchased) },

  // ── Crew ────────────────────────────────────────────────────────────────────
  { id: 'crew-3', name: 'Squad Up', description: 'Have 3 crew members', icon: '\uD83D\uDC65', category: 'crew',
    check: (g) => g.crew.length >= 3 },
  { id: 'crew-5', name: 'Full House', description: 'Have 5 crew members', icon: '\uD83C\uDFE0', category: 'crew',
    check: (g) => g.crew.length >= 5 },
  { id: 'crew-10', name: 'Army', description: 'Have 10 crew members', icon: '\uD83C\uDFF0', category: 'crew',
    check: (g) => g.crew.length >= 10 },
  { id: 'crew-20', name: 'Legion', description: 'Have 20 crew members', icon: '\uD83C\uDFDF', category: 'crew',
    check: (g) => g.crew.length >= 20 },
  { id: 'crew-lv5', name: 'Trained', description: 'Level up a crew member to Lv.5', icon: '\uD83C\uDF96', category: 'crew',
    check: (g) => g.crew.some(c => c.level >= 5) },
  { id: 'crew-lv10', name: 'Veteran', description: 'Level up a crew member to Lv.10', icon: '\u2B50', category: 'crew',
    check: (g) => g.crew.some(c => c.level >= 10) },
  { id: 'crew-lv25', name: 'Elite', description: 'Level up a crew member to Lv.25', icon: '\uD83C\uDF1F', category: 'crew',
    check: (g) => g.crew.some(c => c.level >= 25) },
  { id: 'crew-lv50', name: 'Legendary', description: 'Level up a crew member to Lv.50', icon: '\uD83D\uDC8E', category: 'crew',
    check: (g) => g.crew.some(c => c.level >= 50) },
  { id: 'crew-all-roles', name: 'Balanced Team', description: 'Have at least one of each role', icon: '\u2696', category: 'crew',
    check: (g) => {
      const roles = new Set(g.crew.map(c => c.role))
      return roles.has('driller') && roles.has('refiner') && roles.has('researcher')
    }},
  { id: 'crew-3drill', name: 'Drill Team', description: 'Have 3 drillers', icon: '\u26CF', category: 'crew',
    check: (g) => g.crew.filter(c => c.role === 'driller').length >= 3 },

  // ── Prestige ────────────────────────────────────────────────────────────────
  { id: 'prestige-1', name: 'Reborn', description: 'Prestige for the first time', icon: '\u267B', category: 'prestige',
    check: (g) => g.prestigeCount >= 1 },
  { id: 'prestige-3', name: 'Seasoned', description: 'Prestige 3 times', icon: '\uD83D\uDD04', category: 'prestige',
    check: (g) => g.prestigeCount >= 3 },
  { id: 'prestige-5', name: 'Eternal', description: 'Prestige 5 times', icon: '\u267E', category: 'prestige',
    check: (g) => g.prestigeCount >= 5 },
  { id: 'prestige-10', name: 'Ascended', description: 'Prestige 10 times', icon: '\uD83D\uDD31', category: 'prestige',
    check: (g) => g.prestigeCount >= 10 },

  // ── Anomalies ───────────────────────────────────────────────────────────────
  { id: 'anomaly-1', name: 'First Contact', description: 'Resolve your first anomaly', icon: '\u26A0', category: 'depth',
    check: (g) => g.resolvedAnomalies.length >= 1 },
  { id: 'anomaly-5', name: 'Anomaly Hunter', description: 'Resolve 5 anomalies', icon: '\uD83D\uDD0D', category: 'depth',
    check: (g) => g.resolvedAnomalies.length >= 5 },
  { id: 'anomaly-all', name: 'Seen It All', description: 'Resolve all story anomalies', icon: '\uD83D\uDCDC', category: 'depth',
    check: (g) => g.resolvedAnomalies.filter(id => id.startsWith('story-')).length >= 6 },

  // ── Playtime ────────────────────────────────────────────────────────────────
  { id: 'time-10m', name: 'Settling In', description: 'Play for 10 minutes', icon: '\u23F0', category: 'depth',
    check: (g) => g.totalPlaytimeMs >= 10 * 60 * 1000 },
  { id: 'time-1h', name: 'Hooked', description: 'Play for 1 hour', icon: '\u231A', category: 'depth',
    check: (g) => g.totalPlaytimeMs >= 60 * 60 * 1000 },
  { id: 'time-8h', name: 'Night Shift', description: 'Play for 8 hours', icon: '\uD83C\uDF19', category: 'depth',
    check: (g) => g.totalPlaytimeMs >= 8 * 60 * 60 * 1000 },

  // ── SECRET ACHIEVEMENTS ─────────────────────────────────────────────────────
  { id: 'secret-broke', name: 'Rock Bottom', description: 'Have 0 ore, 0 crystals, and 0 data at once', icon: '\uD83D\uDCB8', category: 'secret', secret: true,
    check: (g) => g.resources.ore < 1 && g.resources.crystals < 1 && g.resources.data < 1 && g.totalPlaytimeMs > 60000 },
  { id: 'secret-hoarder', name: 'Dragon', description: 'Hold 50K of every resource simultaneously', icon: '\uD83D\uDC09', category: 'secret', secret: true,
    check: (g) => g.resources.ore >= 50000 && g.resources.crystals >= 50000 && g.resources.data >= 50000 },
  { id: 'secret-speedrun', name: 'Speedrunner', description: 'Reach 1,000m in under 10 minutes of playtime', icon: '\u23F1', category: 'secret', secret: true,
    check: (g) => g.depth >= 1000 && g.totalPlaytimeMs < 10 * 60 * 1000 },
  { id: 'secret-patient', name: 'The Patient One', description: 'Reach 500m without tapping once', icon: '\uD83E\uDDD8', category: 'secret', secret: true,
    check: (g) => g.depth >= 500 && g.totalTaps === 0 },
  { id: 'secret-mara', name: "Mara's Legacy", description: 'Level Mara to Lv.20', icon: '\uD83C\uDF39', category: 'secret', secret: true,
    check: (g) => g.crew.some(c => c.name === 'Mara' && c.level >= 20) },
  { id: 'secret-named', name: 'Double Trouble', description: 'Have two crew members with the same name', icon: '\uD83D\uDC6F', category: 'secret', secret: true,
    check: (g) => {
      const names = g.crew.map(c => c.name)
      return names.length !== new Set(names).size
    }},
  { id: 'secret-deep-prestige', name: 'Overkill', description: 'Prestige at 5,000m or deeper', icon: '\uD83E\uDE90', category: 'secret', secret: true,
    check: (g) => g.prestigeCount > 0 && g.maxDepth >= 5000 },
  { id: 'secret-crew-army', name: 'Overstaffed', description: 'Have 30 crew members', icon: '\uD83C\uDFED', category: 'secret', secret: true,
    check: (g) => g.crew.length >= 30 },
  { id: 'secret-void-zone', name: 'Into the Void', description: 'Enter the Deep Void zone', icon: '\uD83D\uDD76', category: 'secret', secret: true,
    check: (g) => g.depth >= 2000 },
  { id: 'secret-combo-anomaly', name: 'Unbreakable', description: 'Have a 10+ combo when an anomaly appears', icon: '\uD83D\uDEE1', category: 'secret', secret: true,
    check: (g) => g.comboCount >= 10 && g.activeAnomaly !== null },
  { id: 'secret-milestone-10', name: 'Completionist', description: 'Claim 10 milestones in a single run', icon: '\u2705', category: 'secret', secret: true,
    check: (g) => g.claimedMilestones.length >= 10 },
  { id: 'secret-prestige-rich', name: 'Head Start', description: 'Start a prestige run with 100+ ore', icon: '\uD83C\uDFC1', category: 'secret', secret: true,
    check: (g) => g.prestigeBonus.startingOre >= 100 },
]

interface AchievementState {
  achievements: Achievement[]
  lastUnlocked: string | null
}

export const useAchievementStore = defineStore('achievements', {
  state: (): AchievementState => ({
    achievements: ACHIEVEMENT_DEFS.map(d => ({
      id: d.id,
      name: d.name,
      description: d.description,
      icon: d.icon,
      category: d.category,
      secret: d.secret ?? false,
      unlocked: false,
      unlockedAt: null,
    })),
    lastUnlocked: null,
  }),

  getters: {
    unlockedCount: (state) => state.achievements.filter(a => a.unlocked).length,
    totalCount: (state) => state.achievements.length,
    // Count secrets separately for display
    visibleTotal: (state) => state.achievements.filter(a => !a.secret || a.unlocked).length,
    secretsFound: (state) => state.achievements.filter(a => a.secret && a.unlocked).length,
    secretsTotal: (state) => state.achievements.filter(a => a.secret).length,
    recentUnlock: (state): Achievement | null => {
      if (!state.lastUnlocked) return null
      return state.achievements.find(a => a.id === state.lastUnlocked) ?? null
    },
  },

  actions: {
    checkAll() {
      const game = useGameStore()
      for (const def of ACHIEVEMENT_DEFS) {
        const achievement = this.achievements.find(a => a.id === def.id)
        if (achievement && !achievement.unlocked && def.check(game)) {
          achievement.unlocked = true
          achievement.unlockedAt = Date.now()
          this.lastUnlocked = def.id
        }
      }
    },

    clearLastUnlocked() {
      this.lastUnlocked = null
    },
  },
})
