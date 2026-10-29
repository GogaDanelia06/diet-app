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
}

/**
 * Parses what the Plate shortcut copies, e.g. "plate active=640.5 steps=9,123".
 * Also accepts ":" instead of "=" and an optional "date=2026-10-29".
 */
export function parseHealthText(text: string): HealthImport | null {
  const grab = (key: string) => text.match(new RegExp(`${key}\\s*[=:]\\s*([0-9][0-9\\s\\u00a0\\u202f.,']*)`, 'i'))?.[1]
  const active = grab('active')
  const steps = grab('steps')
  const date = text.match(/date\s*[=:]\s*(\d{4}-\d{2}-\d{2})/i)?.[1]
  const out: HealthImport = { date }
  if (active != null) {
    const v = parseLocaleNumber(active.trim())
    if (Number.isFinite(v) && v >= 0 && v < 10000) out.activeKcal = Math.round(v)
  }
  if (steps != null) {
    const v = parseInt(steps.replace(/\D/g, ''), 10)
    if (Number.isFinite(v) && v >= 0 && v < 200000) out.steps = v
  }
  return out.activeKcal == null && out.steps == null ? null : out
}
