<template>
  <div class="personnel-panel">
    <div class="section-label">
      PERSONNEL
      <span class="crew-count">{{ colonists.length }}</span>
    </div>
    <div class="crew-list">
      <button
        v-for="c in sortedColonists"
        :key="c.id"
        class="crew-row"
        :class="{ urgent: c.health < 30 || c.morale < 20, tracked: game.trackedColonistId === c.id }"
        @click="$emit('trackColonist', c.id)"
      >
        <div class="col-name">
          <span class="colonist-name">{{ c.name }}</span>
          <span class="colonist-badge">
            <span v-if="c.specialization" class="spec">{{ SPECIALIZATION_LABELS[c.specialization] }}</span>
            <span v-if="c.specialization"> · </span>
            <span :class="{ negative: isNegativeTrait(c.skillTrait) }">{{
              SKILL_TRAIT_LABELS[c.skillTrait]
            }}</span>
          </span>
        </div>
        <div class="col-action" :class="actionClass(c)">{{ actionLabel(c) }}</div>
        <div class="col-stat">
          <span class="stat-label">HP</span>
          <span class="stat-val" :class="healthColor(c.health)">{{ Math.round(c.health) }}</span>
          <div class="bar-track">
            <div class="bar-fill" :class="healthColor(c.health)" :style="{ width: c.health + '%' }" />
          </div>
        </div>
        <div class="col-stat">
          <span class="stat-label">MRL</span>
          <span class="stat-val" :class="moraleColor(c.morale)">{{ Math.round(c.morale) }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              :class="moraleColor(c.morale)"
              :style="{ width: c.morale + '%' }"
            />
          </div>
        </div>
        <div class="col-zone mono">{{ zoneLabel(c.currentZone) }}</div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import type { Colonist } from '@/stores/gameStore'
import { SKILL_TRAIT_LABELS, SPECIALIZATION_LABELS } from '@/types/colonist'
import type { SkillTrait } from '@/types/colonist'

defineEmits<{ trackColonist: [id: string] }>()

const game = useGameStore()

const NEGATIVE_TRAITS: SkillTrait[] = ['claustrophobic']

const colonists = computed(() => game.colonists.filter((c) => c.health > 0))

const sortedColonists = computed(() => {
  return [...colonists.value].sort((a, b) => {
    const lastA = a.name.split(' ').pop()?.toLowerCase() ?? ''
    const lastB = b.name.split(' ').pop()?.toLowerCase() ?? ''
    return lastA.localeCompare(lastB)
  })
})

function isNegativeTrait(trait: SkillTrait): boolean {
  return NEGATIVE_TRAITS.includes(trait)
}

function actionLabel(c: Colonist): string {
  if (!c.currentAction) return 'idle'
  const map: Record<string, string> = {
    extract: 'extracting',
    engineer: 'engineering',
    repair: 'repairing',
    unpack: 'unpacking',
    rest: 'resting',
    seek_medical: 'seeking med',
    load: 'loading',
    construct: 'constructing',
    socialize: 'socializing',
    wander: 'wandering',
  }
  return map[c.currentAction.type] || c.currentAction.type
}

function actionClass(c: Colonist): string {
  if (!c.currentAction) return 'idle'
  if (c.currentAction.type === 'rest' || c.currentAction.type === 'seek_medical') return 'rest'
  return ''
}

function healthColor(health: number): string {
  if (health < 30) return 'red'
  if (health < 60) return 'amber'
  return 'green'
}

function moraleColor(morale: number): string {
  if (morale < 20) return 'red'
  if (morale < 40) return 'amber'
  return 'green'
}

const ZONE_LABELS: Record<string, string> = {
  habitat: 'HAB',
  extraction: 'EXT',
  power: 'PWR',
  lifeSup: 'O2',
  medical: 'MED',
  workshop: 'WORK',
  landing: 'PAD',
}

function zoneLabel(zone: string): string {
  return ZONE_LABELS[zone] || zone.toUpperCase().slice(0, 4)
}
</script>

<style scoped>
.personnel-panel {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 8px 10px;
}

.section-label {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--text-secondary);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.crew-count {
  background: var(--accent-dim);
  color: var(--text-secondary);
  font-size: 0.5625rem;
  padding: 1px 5px;
  border-radius: var(--radius-xs);
}

.crew-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.crew-row {
  display: grid;
  grid-template-columns: minmax(80px, 1fr) 70px 46px 46px auto;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: var(--bg-surface);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
  width: 100%;
  text-align: left;
  font-family: var(--font-mono);
  color: inherit;
}

.crew-row:hover {
  background: var(--bg-elevated);
}

.crew-row.urgent {
  background: color-mix(in srgb, var(--red) 6%, var(--bg-surface));
  border-color: color-mix(in srgb, var(--red) 15%, transparent);
}

.crew-row.tracked {
  background: var(--accent-dim);
  border-color: var(--accent-muted);
}

.col-name {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.colonist-name {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.colonist-badge {
  font-size: 0.5625rem;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}

.colonist-badge .spec {
  color: var(--cyan);
}

.colonist-badge .negative {
  color: var(--red);
}

.col-action {
  font-family: var(--font-mono);
  color: var(--text-secondary);
  font-size: 0.6875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-action.idle {
  color: var(--text-muted);
  font-style: italic;
}

.col-action.rest {
  color: var(--amber);
}

.col-stat {
  text-align: right;
  font-size: 0.6875rem;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.stat-label {
  font-size: 0.5rem;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.stat-val {
  font-family: var(--font-mono);
  font-weight: 600;
}

.stat-val.green {
  color: var(--green);
}
.stat-val.amber {
  color: var(--amber);
}
.stat-val.red {
  color: var(--red);
}

.bar-track {
  width: 100%;
  height: 3px;
  background: var(--bg-deep);
  border-radius: var(--radius-xs);
  margin-top: 2px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: var(--radius-xs);
  transition: width 0.3s ease;
}

.bar-fill.green {
  background: var(--green);
}
.bar-fill.amber {
  background: var(--amber);
}
.bar-fill.red {
  background: var(--red);
}

.col-zone {
  font-size: 0.5625rem;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  text-align: right;
  white-space: nowrap;
}
</style>
