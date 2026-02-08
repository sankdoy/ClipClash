import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

const TIMER_NOTIFICATION_ID = 9001

/** Returns true if running inside a native Capacitor shell (iOS/Android). */
export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

/**
 * Request notification permission on native platforms.
 * Call once early (e.g. on app mount or first room join).
 * No-op on web.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false
  const { display } = await LocalNotifications.checkPermissions()
  if (display === 'granted') return true
  const result = await LocalNotifications.requestPermissions()
  return result.display === 'granted'
}

/**
 * Schedule a local notification for when a game timer finishes.
 * `delaySeconds` — how many seconds from now the notification should fire.
 * Cancels any previously scheduled timer notification first.
 */
export async function scheduleTimerNotification(
  title: string,
  body: string,
  delaySeconds: number
): Promise<void> {
  if (!isNative()) return
  // Cancel any existing timer notification
  await cancelTimerNotification()

  await LocalNotifications.schedule({
    notifications: [
      {
        id: TIMER_NOTIFICATION_ID,
        title,
        body,
        schedule: { at: new Date(Date.now() + delaySeconds * 1000) },
        sound: 'timer_done.wav',
        actionTypeId: 'TIMER_DONE'
      }
    ]
  })
}

/** Cancel any pending timer notification. */
export async function cancelTimerNotification(): Promise<void> {
  if (!isNative()) return
  await LocalNotifications.cancel({
    notifications: [{ id: TIMER_NOTIFICATION_ID }]
  })
}
