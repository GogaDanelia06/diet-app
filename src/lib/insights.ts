import { addDays, parseKey } from './date'
import type { DiaryEntry, FastLog, WeightLog } from './types'

/** Days in a row with at least one food logged, ending today (or yesterday if today is still empty). */
export function logStreak(entries: DiaryEntry[], today: string) {
  const days = new Set(entries.map((e) => e.date))
  let day = days.has(today) ? today : addDays(today, -1)
  let n = 0
  while (days.has(day)) {
    n++
    day = addDays(day, -1)
  }
  return n
}

/** Each weigh-in with the average of the weigh-ins in the 7 days up to it, which smooths out water swings. */
export function weightTrend(weights: WeightLog[]) {
  return weights.map((w) => {
    const from = addDays(w.date, -6)
    const window = weights.filter((x) => x.date >= from && x.date <= w.date)
    return { ...w, trend: window.reduce((n, x) => n + x.kg, 0) / window.length }
  })
}

const dayNumber = (key: string) => parseKey(key).getTime() / 86_400_000

/** Kilograms per week over the last `days` days (least-squares slope), or null without enough data. */
export function weeklyRate(weights: WeightLog[], today: string, days = 28) {
  const recent = weights.filter((w) => w.date > addDays(today, -days))
  if (recent.length < 2) return null
  const xs = recent.map((w) => dayNumber(w.date))
  if (Math.max(...xs) - Math.min(...xs) < 6) return null
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = recent.reduce((a, w) => a + w.kg, 0) / recent.length
  let num = 0
  let den = 0
  recent.forEach((w, i) => {
    num += (xs[i] - mx) * (w.kg - my)
    den += (xs[i] - mx) ** 2
  })
  return (num / den) * 7
}

export function hoursBetween(start: number, end: number) {
  return Math.max(0, (end - start) / 3_600_000)
}

export function formatDuration(hours: number) {
  const h = Math.floor(hours)
  const m = Math.floor((hours - h) * 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

/** Finished fasts that reached their goal, counted back from the latest. */
export function fastStreak(history: FastLog[]) {
  let n = 0
  for (const f of history) {
    if (hoursBetween(f.start, f.end) >= f.hours) n++
    else break
  }
  return n
}
