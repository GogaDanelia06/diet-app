import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pastMeals } from './pastMeals'
import { useStore } from './store'
import type { DiaryEntry, Meal } from './types'

vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}))

const entry = (id: string, date: string, meal: Meal, name: string, kcal: number, time?: string): DiaryEntry => ({
  id, date, meal, name, grams: 100, amountLabel: '100 g', nutrients: { kcal, protein: 0, carbs: 0, fat: 0 }, createdAt: 0, ...(time && { time }),
})

const entries = [
  entry('a', '2026-11-10', 'breakfast', 'Oats, dry', 300),
  entry('b', '2026-11-09', 'lunch', 'Khinkali, meat', 590),
  entry('c', '2026-11-09', 'lunch', 'Tomato & cucumber salad with oil', 120),
  entry('d', '2026-11-09', 'dinner', 'Lobio (bean stew)', 340),
  entry('e', '2026-10-20', 'lunch', 'Pizza, cheese', 800),
]

describe('past meals', () => {
  it('lists today’s other meals, then earlier days, newest first, for two weeks', () => {
    expect(pastMeals(entries, '2026-11-10', 'lunch').map((m) => [m.date, m.meal, m.kcal])).toEqual([
      ['2026-11-10', 'breakfast', 300],
      ['2026-11-09', 'lunch', 710],
      ['2026-11-09', 'dinner', 340],
    ])
  })

  it('leaves out the meal being filled', () => {
    expect(pastMeals(entries, '2026-11-10', 'breakfast').some((m) => m.date === '2026-11-10')).toBe(false)
  })

  it('finds meals by a food in them, in English or Georgian', () => {
    expect(pastMeals(entries, '2026-11-10', 'lunch', 14, 'khinkali').map((m) => m.meal)).toEqual(['lunch'])
    expect(pastMeals(entries, '2026-11-10', 'lunch', 14, 'ხინკალი').map((m) => m.meal)).toEqual(['lunch'])
    expect(pastMeals(entries, '2026-11-10', 'lunch', 14, 'pizza')).toEqual([])
  })
})

describe('copying past foods', () => {
  beforeEach(() => useStore.setState({ entries: [...entries, entry('f', '2026-11-10', 'dinner', 'Kefir', 120, '19:30')] }))

  it('copies the chosen foods into another day and meal, with that meal’s time', () => {
    useStore.getState().copyEntries(['b', 'c'], '2026-11-10', 'dinner')
    const copies = useStore.getState().entries.filter((e) => e.date === '2026-11-10' && e.meal === 'dinner' && e.name !== 'Kefir')
    expect(copies.map((e) => [e.name, e.nutrients.kcal, e.time])).toEqual([
      ['Khinkali, meat', 590, '19:30'],
      ['Tomato & cucumber salad with oil', 120, '19:30'],
    ])
    expect(copies.every((e) => !['b', 'c'].includes(e.id))).toBe(true)
    // The originals stay where they were.
    expect(useStore.getState().entries.filter((e) => e.date === '2026-11-09' && e.meal === 'lunch')).toHaveLength(2)
  })
})
