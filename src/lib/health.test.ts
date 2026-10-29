import { describe, expect, it } from 'vitest'
import { baselineActiveKcal, parseHealthText, parseLocaleNumber } from './health'
import type { Profile } from './types'
import { dayBurn } from './store'

const profile: Profile = { sex: 'male', age: 30, heightCm: 180, startWeightKg: 90, goalWeightKg: 80, activity: 'light', ratePerWeekKg: 0.5, startDate: '2026-10-01' }

describe('Apple Health import', () => {
  it('reads numbers in any phone format', () => {
    expect(parseLocaleNumber('640.48')).toBeCloseTo(640.48)
    expect(parseLocaleNumber('640,5')).toBeCloseTo(640.5)
    expect(parseLocaleNumber('9,123')).toBe(9123)
    expect(parseLocaleNumber('9 123')).toBe(9123)
    expect(parseLocaleNumber('1.234,5')).toBeCloseTo(1234.5)
    expect(parseLocaleNumber('1,234.5')).toBeCloseTo(1234.5)
  })

  it('parses what the shortcut copies', () => {
    expect(parseHealthText('plate active=640.48 steps=9,123')).toEqual({ date: undefined, activeKcal: 640, steps: 9123 })
    expect(parseHealthText('plate active: 1 234,5\nsteps: 12 001 date=2026-10-29')).toEqual({ date: '2026-10-29', activeKcal: 1235, steps: 12001 })
    expect(parseHealthText('plate steps=8000')).toEqual({ date: undefined, steps: 8000 })
    expect(parseHealthText('shopping list: eggs, milk')).toBeNull()
  })

  it('reads a smart scale weight in kg or lb, ignoring impossible values', () => {
    expect(parseHealthText('plate date=2026-10-29 steps=9123 weight=89,4 kg')).toEqual({ date: '2026-10-29', steps: 9123, weightKg: 89.4 })
    expect(parseHealthText('plate weight=197.1 lb')).toEqual({ date: undefined, weightKg: 89.4 })
    expect(parseHealthText('plate steps=500 weight=8')).toEqual({ date: undefined, steps: 500 })
    expect(parseHealthText('plate weight=')).toBeNull()
  })

  it('only counts watch calories above a normal day', () => {
    // BMR 1880 × 0.375 = 705, minus 10% of 2585 for digestion ≈ 446
    expect(baselineActiveKcal(profile, 90)).toBe(447)
    expect(baselineActiveKcal({ ...profile, activity: 'sedentary' }, 90)).toBeLessThan(200)
  })
})

describe('calories burned on a day', () => {
  const base = { profile, weights: [{ date: '2026-10-29', kg: 90 }], steps: {}, deviceActivity: {}, exercises: [] }
  const run = { id: 'r', date: '2026-10-29', name: 'Running', minutes: 30, kcal: 380 }

  it('adds logged workouts and extra steps without a watch', () => {
    const b = dayBurn({ ...base, exercises: [run], steps: { '2026-10-29': 10000 } }, '2026-10-29')
    expect(b.burned).toBe(380 + 173)
  })

  it('uses only the watch, above a normal day, when watch data exists', () => {
    const b = dayBurn(
      { ...base, exercises: [run], steps: { '2026-10-29': 10000 }, deviceActivity: { '2026-10-29': { activeKcal: 900, steps: 12000, source: 'health', at: 0 } } },
      '2026-10-29',
    )
    expect(b.burned).toBe(900 - 447)
    expect(b.steps).toBe(12000)
    expect(b.fromSteps).toBe(0)
  })

  it('never goes below zero on a quiet day', () => {
    const b = dayBurn({ ...base, deviceActivity: { '2026-10-29': { activeKcal: 200, source: 'manual', at: 0 } } }, '2026-10-29')
    expect(b.burned).toBe(0)
  })
})
