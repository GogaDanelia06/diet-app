import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultDashboard, intakeWeek, normalizeDashboard, parseWeight, reportedNutrient, weightOnOrBefore } from './dashboard'
import { exportData, useStore } from './store'
import { set } from 'idb-keyval'
import type { DiaryEntry } from './types'

vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}))

const entry = (date: string, kcal: number, extra: { fiber?: number; sugar?: number } = {}): DiaryEntry => ({
  id: `${date}-${kcal}`, date, meal: 'breakfast', name: 'Food', grams: 100, amountLabel: '100 g',
  nutrients: { kcal, protein: 0, carbs: 0, fat: 0, ...extra }, createdAt: 0,
})

describe('dashboard data', () => {
  it('keeps unlogged days distinct from recorded zero and crosses month boundaries', () => {
    const week = intakeWeek([entry('2026-10-30', 120), entry('2026-10-30', 80), entry('2026-11-01', 0), entry('2026-11-02', 900)], '2026-11-01')
    expect(week.map((day) => day.date)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
    expect(week[4]).toEqual({ date: '2026-10-30', kcal: 200, entries: 2 })
    expect(week[5]).toEqual({ date: '2026-10-31', kcal: 0, entries: 0 })
    expect(week[6]).toEqual({ date: '2026-11-01', kcal: 0, entries: 1 })
  })

  it('reports nutrient coverage instead of replacing unknowns with zero', () => {
    const entries = [entry('2026-10-29', 100, { fiber: 0 }), entry('2026-10-29', 200, { fiber: 4 }), entry('2026-10-29', 300)]
    expect(reportedNutrient(entries, 'fiber')).toEqual({ value: 4, known: 2, total: 3 })
    expect(reportedNutrient(entries, 'sugar')).toEqual({ value: null, known: 0, total: 3 })
    expect(reportedNutrient([], 'fiber')).toEqual({ value: null, known: 0, total: 0 })
    expect(reportedNutrient([entry('2026-10-29', 100, { sugar: 0 })], 'sugar').value).toBe(0)
  })

  it('does not leak future weights into a historical date or mutate logs', () => {
    const weights = [{ date: '2026-10-30', kg: 80 }, { date: '2026-10-24', kg: 82 }, { date: '2026-10-28', kg: 81 }]
    expect(weightOnOrBefore(weights, '2026-10-29')).toEqual({ date: '2026-10-28', kg: 81 })
    expect(weightOnOrBefore(weights, '2026-10-20')).toBeNull()
    expect(weights[0].date).toBe('2026-10-30')
  })

  it('validates weight input with decimal comma support and consistent bounds', () => {
    expect(parseWeight(' 72,45 ')).toBe(72.5)
    expect(parseWeight('30')).toBe(30)
    expect(parseWeight('300')).toBe(300)
    for (const input of ['', '29.9', '300.1', '80kg', '1e2', 'NaN', '-70', '70..5']) expect(parseWeight(input)).toBeNull()
  })

  it('defaults missing widget state and sanitizes optional backup fields independently', () => {
    expect(normalizeDashboard(undefined)).toEqual(defaultDashboard())
    expect(normalizeDashboard({
      visible: { week: false, weight: 'false', unrelated: false },
      habits: { '2026-10-29': ['color', 'movement', 'color', 'unknown', 2], '2026-02-30': ['unwind'], bad: ['color'] },
    })).toEqual({
      visible: { week: false, nutrients: true, weight: true, habits: true },
      habits: { '2026-10-29': ['color', 'movement'] },
    })
  })
})

describe('dashboard persistence, backup and reset', () => {
  beforeAll(async () => { await useStore.persist.rehydrate() })
  beforeEach(() => { useStore.getState().resetAll() })

  it('persists widgets and date-specific habits with the rest of the app data', () => {
    const state = useStore.getState()
    state.toggleDashboardWidget('week')
    state.toggleDashboardHabit('2026-10-29', 'color')
    state.toggleDashboardHabit('2026-10-28', 'unwind')
    state.toggleDashboardHabit('2026-10-29', 'movement')
    state.toggleDashboardHabit('2026-10-29', 'color')

    const dashboard = useStore.getState().dashboard
    expect(dashboard.visible.week).toBe(false)
    expect(dashboard.habits).toEqual({ '2026-10-29': ['movement'], '2026-10-28': ['unwind'] })
    const write = vi.mocked(set).mock.lastCall
    expect(write?.[0]).toBe('plate-data')
    expect(JSON.parse(String(write?.[1])).state.dashboard).toEqual(dashboard)
  })

  it('round-trips widget data through backup and clears it on reset and older imports', () => {
    useStore.getState().toggleDashboardWidget('nutrients')
    useStore.getState().toggleDashboardHabit('2026-10-29', 'unwind')
    const backup = JSON.parse(exportData())
    useStore.getState().resetAll()
    expect(useStore.getState().dashboard).toEqual(defaultDashboard())
    useStore.getState().importData(backup)
    expect(useStore.getState().dashboard).toEqual(backup.dashboard)
    useStore.getState().importData({ entries: [] })
    expect(useStore.getState().dashboard).toEqual(defaultDashboard())
  })

  it('restores older persisted app data with complete widget defaults', () => {
    useStore.getState().toggleDashboardWidget('week')
    const merged = useStore.persist.getOptions().merge!({ entries: [] }, useStore.getState())
    expect(merged.dashboard).toEqual(defaultDashboard())
  })
})
