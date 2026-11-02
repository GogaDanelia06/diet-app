import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyHealthText, healthTextFromHash } from './healthImport'
import { dayBurn, useStore } from './store'

vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}))

describe('Health numbers from the Plate shortcut', () => {
  beforeEach(() => useStore.setState({ deviceActivity: {}, steps: {}, weights: [] }))

  it('reads the text from the link the shortcut opens', () => {
    expect(healthTextFromHash('#health=plate%20date%3D2026-10-30%20active%3D512%20steps%3D8%2C412')).toBe('plate date=2026-10-30 active=512 steps=8,412')
    expect(healthTextFromHash('#health=plate+steps%3D500')).toBe('plate steps=500')
    expect(healthTextFromHash('#other=1')).toBeNull()
    expect(healthTextFromHash('#health=%E0%A4%A')).toBeNull()
  })

  it('saves steps, watch calories and weight for the day in the text', () => {
    const r = applyHealthText('plate date=2026-10-30 active=512 steps=8412 weight=88.9 kg', '2026-10-31')
    expect(r?.day).toBe('2026-10-30')
    const st = useStore.getState()
    expect(st.deviceActivity['2026-10-30']).toMatchObject({ activeKcal: 512, steps: 8412, source: 'health' })
    expect(st.weights).toEqual([{ date: '2026-10-30', kg: 88.9 }])
  })

  it('keeps saved watch calories when only steps arrive', () => {
    applyHealthText('plate date=2026-10-30 active=512 steps=8412', '2026-10-30')
    applyHealthText('plate date=2026-10-30 steps=9000', '2026-10-30')
    expect(useStore.getState().deviceActivity['2026-10-30']).toMatchObject({ activeKcal: 512, steps: 9000 })
    expect(applyHealthText('shopping list', '2026-10-30')).toBeNull()
  })

  it('saves sleep and distance for the day and says so', () => {
    useStore.setState({ healthDays: {} })
    const r = applyHealthText('plate date=2026-10-30 steps=8000 sleep=6.5 distance=5.4', '2026-10-30')
    expect(useStore.getState().healthDays['2026-10-30']).toEqual({ sleepMinutes: 390, distanceKm: 5.4 })
    expect(r?.summary).toBe('8,000 steps · 6 h 30 min sleep · 5.4 km')
    applyHealthText('plate date=2026-10-30 steps=9000', '2026-10-30')
    expect(useStore.getState().healthDays['2026-10-30']).toEqual({ sleepMinutes: 390, distanceKm: 5.4 })
  })

  it('adds WHOOP workouts once per day, in full, and keeps a deleted one deleted', () => {
    useStore.setState({ exercises: [], healthDays: {}, settings: { ...useStore.getState().settings, hiddenHealthWorkouts: [] } })
    applyHealthText('plate date=2026-10-30 steps=8000 workout=300 rhr=54', '2026-10-30')
    applyHealthText('plate date=2026-10-30 steps=9000 workout=420 rhr=52', '2026-10-30')
    const st = useStore.getState()
    expect(st.exercises).toEqual([{ id: 'hk-tracker-2026-10-30', date: '2026-10-30', name: 'WHOOP workouts', minutes: 0, kcal: 420 }])
    expect(st.healthDays['2026-10-30'].restingHr).toBe(52)
    // Without watch calories, the workouts count in full on top of the steps.
    expect(dayBurn(useStore.getState(), '2026-10-30').burned).toBe(420 + dayBurn({ ...useStore.getState(), exercises: [] }, '2026-10-30').burned)
    st.removeExercise('hk-tracker-2026-10-30')
    applyHealthText('plate date=2026-10-30 workout=500', '2026-10-30')
    expect(useStore.getState().exercises).toEqual([])
  })

  it('counts steps when there’s no Apple Watch and active calories come through as 0', () => {
    applyHealthText('plate date=2026-10-30 active=0 steps=7 500', '2026-10-30')
    const st = useStore.getState()
    expect(st.deviceActivity['2026-10-30']).toBeUndefined()
    expect(st.steps['2026-10-30']).toBe(7500)
  })
})
