import { ACTIVITY, bmr } from './calc'
import type { Profile } from './types'

/**
 * Active calories a watch shows on an ordinary day at this activity level. The daily
 * target already includes them (activity factor minus about 10% for digesting food),
 * so only what a watch records above this adds to the budget.
 */
export function baselineActiveKcal(profile: Profile, weightKg: number) {
  const b = bmr(profile.sex, weightKg, profile.heightCm, profile.age)
  const factor = ACTIVITY[profile.activity].factor
  return Math.max(0, Math.round(b * (factor - 1) - 0.1 * b * factor))
}

/** Reads a number however the phone formatted it: "640.48", "640,5", "9,123", "9 123", "1.234,5". */
export function parseLocaleNumber(raw: string): number {
  const s = raw.replace(/[\s  ']/g, '')
  if (!s) return NaN
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    // Whichever comes last is the decimal mark.
    const dec = lastComma > lastDot ? ',' : '.'
    const thou = dec === ',' ? '.' : ','
    return parseFloat(s.split(thou).join('').replace(dec, '.'))
  }
  const sep = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : ''
  if (!sep) return parseFloat(s)
  const parts = s.split(sep)
  // "9,123" or "1.234.567": groups of three digits are thousands, not decimals.
  if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) return parseFloat(parts.join(''))
  return parseFloat(parts.join('.'))
}

export interface HealthImport {
  date?: string
  activeKcal?: number
  steps?: number
  weightKg?: number
  /** Last night's sleep. */
  sleepMinutes?: number
  /** Walking and running distance. */
  distanceKm?: number
  /** Calories of the day's workouts from a tracker that records only workouts, like WHOOP. */
  workoutKcal?: number
  /** Resting heart rate, beats per minute. */
  restingHr?: number
}

/**
 * A number expected between min and max. "7.354" reads as 7,354 by the usual rules, but if
 * that's out of range and there's a single separator, it's taken as a decimal: 7.354.
 */
function parseInRange(raw: string, min: number, max: number): number | undefined {
  const v = parseLocaleNumber(raw)
  if (Number.isFinite(v) && v >= min && v <= max) return v
  if (raw.match(/[.,]/g)?.length === 1) {
    const d = parseFloat(raw.replace(/[\s\u00a0\u202f']/g, '').replace(',', '.'))
    if (Number.isFinite(d) && d >= min && d <= max) return d
  }
  return undefined
}

/** Sleep as hours ("7.4", "7,4"), hours and minutes ("7:24") or minutes ("444"). */
function parseSleep(raw: string): number | undefined {
  const hm = raw.match(/^(\d{1,2}):(\d{2})/)
  if (hm) return Number(hm[1]) * 60 + Number(hm[2])
  const v = parseInRange(raw, 0, 24 * 60)
  if (v == null) return undefined
  return Math.round(v <= 24 ? v * 60 : v)
}

const MI_TO_KM = 1.609344

const LB_TO_KG = 0.45359237

/**
 * Parses what the Plate shortcut copies, e.g. "plate date=2026-10-29 active=640.5 steps=9,123 sleep=7.4 distance=6.2 weight=89.4 kg",
 * plus workout= (a tracker's workout calories, like WHOOP's) and rhr= (resting heart rate).
 * Also accepts ":" instead of "=". Weight may be in kg or lb, as a smart scale wrote it to Apple Health.
 */
export function parseHealthText(text: string): HealthImport | null {
  const grab = (key: string, extra = '') => text.match(new RegExp(`${key}\\s*[=:]\\s*([0-9][0-9\\s\\u00a0\\u202f.,'${extra}]*)`, 'i'))?.[1]
  const active = grab('active')
  const steps = grab('steps')
  const date = text.match(/date\s*[=:]\s*(\d{4}-\d{2}-\d{2})/i)?.[1]
  const out: HealthImport = { date }
  if (active != null) {
    const v = parseInRange(active.trim(), 0, 9999)
    if (v != null) out.activeKcal = Math.round(v)
  }
  if (steps != null) {
    const v = parseInt(steps.replace(/\D/g, ''), 10)
    if (Number.isFinite(v) && v >= 0 && v < 200000) out.steps = v
  }
  const weight = text.match(/weight\s*[=:]\s*([0-9][0-9.,]*)\s*(kg|lbs?)?/i)
  if (weight) {
    const v = parseLocaleNumber(weight[1]) * (weight[2]?.toLowerCase().startsWith('lb') ? LB_TO_KG : 1)
    if (Number.isFinite(v) && v >= 30 && v <= 300) out.weightKg = Math.round(v * 10) / 10
  }
  const sleep = grab('sleep', ':')
  if (sleep != null) {
    const v = parseSleep(sleep.trim())
    if (v != null && v > 0) out.sleepMinutes = v
  }
  const distance = text.match(/distance\s*[=:]\s*([0-9][0-9\s\u00a0\u202f.,']*?)\s*(km|mi)?(?=\s|$)/i)
  if (distance) {
    const v = parseInRange(distance[1].trim(), 0, 300)
    if (v != null) out.distanceKm = Math.round(v * (distance[2]?.toLowerCase() === 'mi' ? MI_TO_KM : 1) * 100) / 100
  }
  const workout = grab('workout')
  if (workout != null) {
    const v = parseInRange(workout.trim(), 0, 5000)
    if (v != null) out.workoutKcal = Math.round(v)
  }
  const rhr = grab('rhr')
  if (rhr != null) {
    const v = parseInRange(rhr.trim(), 25, 150)
    if (v != null) out.restingHr = Math.round(v)
  }
  const found = [out.activeKcal, out.steps, out.weightKg, out.sleepMinutes, out.distanceKm, out.workoutKcal, out.restingHr].some((v) => v != null)
  return found ? out : null
}
