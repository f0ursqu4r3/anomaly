import { LocalNotifications } from '@capacitor/local-notifications'

const OFFLINE_CAP_NOTIFICATION_ID = 9001

export async function scheduleOfflineCapNotification(capMs: number): Promise<void> {
  try {
    const permission = await LocalNotifications.requestPermissions()
    if (permission.display !== 'granted') {
      console.log('[Notifications] Permission not granted')
      return
    }

    // Cancel any existing notification first
    await cancelOfflineCapNotification()

    const triggerAt = new Date(Date.now() + capMs)

    await LocalNotifications.schedule({
      notifications: [
        {
          id: OFFLINE_CAP_NOTIFICATION_ID,
          title: 'Deep Station',
          body: 'Your offline earnings have maxed out! Come back to keep drilling.',
          schedule: { at: triggerAt },
          sound: undefined,
          smallIcon: 'ic_stat_icon',
          iconColor: '#f59e0b',
        },
      ],
    })
    console.log('[Notifications] Offline cap notification scheduled for', triggerAt.toISOString())
  } catch (e) {
    console.warn('[Notifications] Failed to schedule notification (expected in browser):', e)
  }
}

export async function cancelOfflineCapNotification(): Promise<void> {
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: OFFLINE_CAP_NOTIFICATION_ID }],
    })
  } catch (e) {
    // Ignore — might not exist
  }
}
