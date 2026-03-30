import { LocalNotifications } from '@capacitor/local-notifications'
import type { OfflineEvent } from '@/stores/offlineEngine'

const OFFLINE_NOTIFICATION_ID_BASE = 10000
const OFFLINE_NOTIFICATION_ID_MAX = 10099
const BATCH_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

async function ensurePermissions(): Promise<boolean> {
  try {
    const permission = await LocalNotifications.requestPermissions()
    return permission.display === 'granted'
  } catch {
    return false
  }
}

export async function scheduleOfflineNotifications(
  events: OfflineEvent[],
  backgroundedAt: number,
): Promise<void> {
  if (!(await ensurePermissions())) return

  await cancelAllOfflineNotifications()

  const notifications: Array<{
    id: number
    title: string
    body: string
    schedule: { at: Date }
  }> = []

  let nextId = OFFLINE_NOTIFICATION_ID_BASE

  // Critical events get immediate notifications
  const criticalEvents = events.filter(e => e.severity === 'critical')
  for (const event of criticalEvents) {
    if (nextId > OFFLINE_NOTIFICATION_ID_MAX) break
    notifications.push({
      id: nextId++,
      title: 'Colony Alert',
      body: event.message,
      schedule: { at: new Date(backgroundedAt + event.offsetMs) },
    })
  }

  // Batch non-critical events into 30-min windows
  const nonCritical = events.filter(e => e.severity !== 'critical')
  if (nonCritical.length > 0) {
    const maxOffset = Math.max(...events.map(e => e.offsetMs))
    const numBatches = Math.ceil(maxOffset / BATCH_INTERVAL_MS)

    for (let i = 0; i < numBatches && nextId <= OFFLINE_NOTIFICATION_ID_MAX; i++) {
      const windowStart = i * BATCH_INTERVAL_MS
      const windowEnd = (i + 1) * BATCH_INTERVAL_MS
      const batchEvents = nonCritical.filter(
        e => e.offsetMs >= windowStart && e.offsetMs < windowEnd,
      )
      if (batchEvents.length === 0) continue

      const summary = batchEvents.map(e => e.message).join(', ')
      notifications.push({
        id: nextId++,
        title: 'Colony Report',
        body: `${batchEvents.length} update${batchEvents.length > 1 ? 's' : ''}: ${summary}`,
        schedule: { at: new Date(backgroundedAt + windowEnd) },
      })
    }
  }

  if (notifications.length === 0) return

  try {
    await LocalNotifications.schedule({
      notifications: notifications.map(n => ({
        ...n,
        smallIcon: 'ic_stat_icon',
        iconColor: '#f59e0b',
      })),
    })
  } catch (e) {
    console.warn('[Notifications] Failed to schedule:', e)
  }
}

export async function cancelAllOfflineNotifications(): Promise<void> {
  try {
    const ids = Array.from(
      { length: OFFLINE_NOTIFICATION_ID_MAX - OFFLINE_NOTIFICATION_ID_BASE + 1 },
      (_, i) => ({ id: OFFLINE_NOTIFICATION_ID_BASE + i }),
    )
    await LocalNotifications.cancel({ notifications: ids })
  } catch {
    // Ignore — notifications may not exist
  }
}
