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
