import type { Meal } from './types'

export const DAY_MINUTES = 24 * 60

/** "22:00" → 1320 minutes after midnight. */
export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Minutes after midnight → "HH:mm", wrapping around midnight. */
export const fromMinutes = (minutes: number) => {
  const v = ((Math.round(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`
}

/** When each meal is usually eaten, the starting point for days other than today. */
export const USUAL_TIME: Record<Meal, string> = { breakfast: '08:00', lunch: '13:00', dinner: '19:00', snack: '16:00' }

/** The first and last meal of a day and the minutes between them; needs at least two times. */
export function eatingWindow(times: string[]) {
  if (times.length < 2) return null
  const sorted = times.map(toMinutes).sort((a, b) => a - b)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  return { start: fromMinutes(first), end: fromMinutes(last), minutes: last - first }
}

/** When a fast of `hours` that starts at `last` ends, and whether that is the next day. */
export function fastEnd(last: string, hours: number) {
  const end = toMinutes(last) + hours * 60
  return { time: fromMinutes(end), nextDay: end >= DAY_MINUTES }
}

/**
 * When a fast began, from a clock time picked after the fact: today if that time has passed,
 * otherwise yesterday (a fast started after last night's dinner).
 */
export function fastStartAt(minutes: number, now: Date): number {
  const d = new Date(now)
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  if (d.getTime() > now.getTime()) d.setDate(d.getDate() - 1)
  return d.getTime()
}

/** The latest meal time logged today, or null. */
export function lastMealTime(entries: { date: string; time?: string }[], today: string): string | null {
  const times = entries.filter((e) => e.date === today && e.time).map((e) => e.time!)
  return times.length ? times.reduce((a, b) => (toMinutes(b) > toMinutes(a) ? b : a)) : null
}

