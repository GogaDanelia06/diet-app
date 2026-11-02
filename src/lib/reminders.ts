import { LocalNotifications } from '@capacitor/local-notifications'
import { addDays, dateKey, parseKey } from './date'
import { t } from './i18n'
import { isNativeApp } from './nativeHealth'
import { useStore } from './store'
import type { DiaryEntry, ReminderSettings } from './types'

export const REMINDER_MEALS = ['breakfast', 'lunch', 'dinner'] as const
export const WATER_TIMES = ['11:00', '15:00', '18:00']
const DAYS_AHEAD = 7

// Plate's notification ids; anything else pending on the phone is left alone.
const MEAL_ID = 1000
const WATER_ID = 2000
const FAST_ID = 3000
const isOurs = (id: number) => id >= MEAL_ID && id < FAST_ID + 100

export type PlannedReminder =
  | { id: number; at: Date; kind: 'meal'; meal: (typeof REMINDER_MEALS)[number] }
  | { id: number; at: Date; kind: 'water' }
  | { id: number; at: Date; kind: 'fast'; hours: number }

function at(date: string, time: string) {
  const [h, m] = time.split(':').map(Number)
  const d = parseKey(date)
  d.setHours(h || 0, m || 0, 0, 0)
  return d
}

/**
 * The notifications to have pending for the next week. Notifications can't check anything when
 * they fire, so they're planned ahead and planned again whenever something changes: a meal that's
 * already logged, or a day whose water goal is reached, gets no reminder.
 */
export function planReminders(o: {
  settings: ReminderSettings
  now: Date
  entries: DiaryEntry[]
  water: Record<string, number>
  waterGoalMl: number
  fast: { start: number; hours: number } | null
}): PlannedReminder[] {
  const out: PlannedReminder[] = []
  const today = dateKey(o.now)
  for (let day = 0; day < DAYS_AHEAD; day++) {
    const date = addDays(today, day)
    if (o.settings.meals) {
      REMINDER_MEALS.forEach((meal, i) => {
        const when = at(date, o.settings.times[meal])
        if (when > o.now && !o.entries.some((e) => e.date === date && e.meal === meal)) out.push({ id: MEAL_ID + day * 10 + i, at: when, kind: 'meal', meal })
      })
    }
    if (o.settings.water && (o.water[date] ?? 0) < o.waterGoalMl) {
      WATER_TIMES.forEach((time, i) => {
        const when = at(date, time)
        if (when > o.now) out.push({ id: WATER_ID + day * 10 + i, at: when, kind: 'water' })
      })
    }
  }
  if (o.settings.fasting && o.fast) {
    const end = new Date(o.fast.start + o.fast.hours * 3_600_000)
    if (end > o.now) out.push({ id: FAST_ID, at: end, kind: 'fast', hours: o.fast.hours })
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime())
}

const MEAL_TEXT: Record<(typeof REMINDER_MEALS)[number], [string, string]> = {
  breakfast: ['Breakfast time', 'Log your breakfast in Plate while you remember it.'],
  lunch: ['Lunch time', 'Log your lunch in Plate while you remember it.'],
  dinner: ['Dinner time', 'Log your dinner in Plate while you remember it.'],
}

function text(r: PlannedReminder): { title: string; body: string } {
  if (r.kind === 'meal') {
    const [title, body] = MEAL_TEXT[r.meal]
    return { title: t(title), body: t(body) }
  }
  if (r.kind === 'water') return { title: t('Time for some water'), body: t('A glass now keeps you on track for today’s goal.') }
  return { title: t('Your fast is done'), body: t('You reached your {h}-hour goal. Nice work!', { h: r.hours }) }
}

export type ReminderPermission = 'granted' | 'denied' | 'unavailable'

/** Asks iOS for permission to show notifications; iOS asks the person only once. */
export async function allowReminders(): Promise<ReminderPermission> {
  if (!isNativeApp()) return 'unavailable'
  const { display } = await LocalNotifications.requestPermissions()
  return display === 'granted' ? 'granted' : 'denied'
}

async function sync() {
  if (!isNativeApp()) return
  const st = useStore.getState()
  const { notifications } = await LocalNotifications.getPending()
  const ours = notifications.filter((n) => isOurs(n.id))
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
  const r = st.settings.reminders
  if (!r.meals && !r.water && !r.fasting) return
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return
  const plan = planReminders({
    settings: r,
    now: new Date(),
    entries: st.entries,
    water: st.water,
    waterGoalMl: st.settings.waterGoalMl,
    fast: st.fasting.active,
  })
  if (!plan.length) return
  await LocalNotifications.schedule({
    notifications: plan.map((p) => ({ id: p.id, ...text(p), schedule: { at: p.at, allowWhileIdle: true } })),
  })
}

let queue: Promise<void> = Promise.resolve()

/** Replaces Plate's pending notifications with a fresh plan; calls run one after another. */
export function syncReminders(): Promise<void> {
  queue = queue.then(sync).catch(() => {})
  return queue
}
