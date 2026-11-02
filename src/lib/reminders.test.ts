import { describe, expect, it, vi } from 'vitest'
import type { DiaryEntry, ReminderSettings } from './types'

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {} }))
const { planReminders } = await import('./reminders')

const settings: ReminderSettings = { meals: true, times: { breakfast: '09:00', lunch: '13:30', dinner: '19:30' }, water: false, fasting: false }
const entry = (date: string, meal: DiaryEntry['meal']) => ({ id: date + meal, date, meal }) as DiaryEntry
const base = { settings, entries: [] as DiaryEntry[], water: {}, waterGoalMl: 2000, fast: null }
const time = (d: Date) => `${d.toDateString().slice(4, 10)} ${d.toTimeString().slice(0, 5)}`

describe('reminders', () => {
  it('plans meal reminders for the coming week, skipping times already past', () => {
    const plan = planReminders({ ...base, now: new Date(2026, 10, 2, 12, 0) })
    expect(plan).toHaveLength(2 + 6 * 3)
    expect(plan.slice(0, 3).map((r) => time(r.at))).toEqual(['Nov 02 13:30', 'Nov 02 19:30', 'Nov 03 09:00'])
    expect(new Set(plan.map((r) => r.id)).size).toBe(plan.length)
  })

  it('skips meals that are already logged', () => {
    const plan = planReminders({ ...base, now: new Date(2026, 10, 2, 7, 0), entries: [entry('2026-11-02', 'lunch'), entry('2026-11-02', 'snack')] })
    expect(plan.filter((r) => r.at.getDate() === 2).map((r) => r.kind === 'meal' && r.meal)).toEqual(['breakfast', 'dinner'])
  })

  it('stops water reminders once the day’s goal is reached', () => {
    const plan = planReminders({ ...base, settings: { ...settings, meals: false, water: true }, now: new Date(2026, 10, 2, 8, 0), water: { '2026-11-02': 2000 } })
    expect(plan[0].kind).toBe('water')
    expect(time(plan[0].at)).toBe('Nov 03 11:00')
    expect(plan).toHaveLength(6 * 3)
  })

  it('reminds when the fast reaches its goal', () => {
    const start = new Date(2026, 10, 1, 20, 0).getTime()
    const plan = planReminders({ ...base, settings: { ...settings, meals: false, fasting: true }, now: new Date(2026, 10, 2, 9, 0), fast: { start, hours: 16 } })
    expect(plan).toEqual([{ id: 3000, at: new Date(2026, 10, 2, 12, 0), kind: 'fast', hours: 16 }])
    expect(planReminders({ ...base, settings: { ...settings, meals: false, fasting: true }, now: new Date(2026, 10, 2, 13, 0), fast: { start, hours: 16 } })).toEqual([])
  })

  it('plans nothing when everything is off', () => {
    expect(planReminders({ ...base, settings: { ...settings, meals: false }, now: new Date(2026, 10, 2, 7, 0) })).toEqual([])
  })
})

describe('workout reminders', () => {
  const workouts = [
    { date: '2026-11-02', time: '18:00', title: 'Full-body strength A', minutes: 30 },
    { date: '2026-11-04', time: '18:00', title: 'Brisk walk', minutes: 30 },
  ]
  it('reminds at the workout time on workout days', () => {
    const plan = planReminders({ ...base, settings: { ...settings, meals: false, workout: true }, now: new Date(2026, 10, 2, 12, 0), workouts })
    expect(plan).toEqual([
      { id: 4000, at: new Date(2026, 10, 2, 18, 0), kind: 'workout', title: 'Full-body strength A', minutes: 30 },
      { id: 4002, at: new Date(2026, 10, 4, 18, 0), kind: 'workout', title: 'Brisk walk', minutes: 30 },
    ])
  })

  it('skips them when turned off or already past', () => {
    expect(planReminders({ ...base, settings: { ...settings, meals: false }, now: new Date(2026, 10, 2, 12, 0), workouts })).toEqual([])
    expect(planReminders({ ...base, settings: { ...settings, meals: false, workout: true }, now: new Date(2026, 10, 2, 19, 0), workouts })).toHaveLength(1)
  })
})
