import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mealTime, useStore } from './store'
import type { DiaryEntry } from './types'

vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}))

const food = (name: string, meal: DiaryEntry['meal'], date = '2026-10-29') =>
  ({ date, meal, name, grams: 100, amountLabel: '100 g', nutrients: { kcal: 100, protein: 1, carbs: 1, fat: 1 } }) as const

describe('meal times', () => {
  beforeEach(() => useStore.setState({ entries: [] }))

  it('sets and clears the time for every food in one meal only', () => {
    const { addEntry, setMealTime } = useStore.getState()
    addEntry(food('Lobio', 'dinner'))
    addEntry(food('Bread', 'dinner'))
    addEntry(food('Oatmeal', 'breakfast'))
    setMealTime('2026-10-29', 'dinner', '22:00')
    const times = () => useStore.getState().entries.map((e) => `${e.name}:${e.time ?? '-'}`)
    expect(times()).toEqual(['Lobio:22:00', 'Bread:22:00', 'Oatmeal:-'])
    setMealTime('2026-10-29', 'dinner', '')
    expect(times()).toEqual(['Lobio:-', 'Bread:-', 'Oatmeal:-'])
  })

  it('gives foods added later the meal’s time, and moved foods their new meal’s time', () => {
    const { addEntry, setMealTime, updateEntry } = useStore.getState()
    addEntry(food('Lobio', 'dinner'))
    setMealTime('2026-10-29', 'dinner', '22:00')
    addEntry(food('Wine', 'dinner'))
    addEntry(food('Apple', 'snack'))
    const entries = () => useStore.getState().entries
    expect(entries().find((e) => e.name === 'Wine')?.time).toBe('22:00')
    updateEntry(entries().find((e) => e.name === 'Apple')!.id, { meal: 'dinner' })
    expect(mealTime(entries(), '2026-10-29', 'dinner')).toBe('22:00')
    expect(entries().find((e) => e.name === 'Apple')?.time).toBe('22:00')
  })

  it('does not copy yesterday’s time with Same as yesterday', () => {
    const { addEntry, setMealTime, copyMeal } = useStore.getState()
    addEntry(food('Lobio', 'dinner', '2026-10-28'))
    setMealTime('2026-10-28', 'dinner', '22:00')
    copyMeal('2026-10-28', 'dinner', '2026-10-29')
    expect(mealTime(useStore.getState().entries, '2026-10-29', 'dinner')).toBeUndefined()
  })
})
