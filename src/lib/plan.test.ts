import { describe, expect, it } from 'vitest'
import { buildPlan, cleanPlanMeal, dayTotals, mealSlots, shoppingList } from './plan'

const item = (name: string, grams: number, kcal: number) => ({ name, portion: '', grams, kcal, protein: 10, carbs: 10, fat: 5 })

describe('meal plan', () => {
  it('splits the day roughly into the target', () => {
    for (const snacks of [0, 1, 2] as const) {
      const slots = mealSlots(snacks, 1800)
      const sum = slots.reduce((n, s) => n + s.kcal, 0)
      expect(Math.abs(sum - 1800)).toBeLessThanOrEqual(20)
      expect(slots.filter((s) => s.meal === 'snack')).toHaveLength(snacks)
    }
  })

  it('dates the days from the start date and maps meal names', () => {
    const plan = buildPlan(
      {
        days: [
          { meals: [{ meal: 'Breakfast', name: 'Oats', items: [item('Oats', 40, 150)] }, { meal: 'supper', name: 'Fish', items: [] }] },
          { meals: [{ meal: 'Lunch', name: 'Lobio', items: [item('Lobio', 300, 400)] }] },
          { meals: [] },
        ],
        tips: 'Drink water',
      },
      '2026-10-31',
      1800,
    )
    expect(plan.days.map((d) => d.date)).toEqual(['2026-10-31', '2026-11-01'])
    expect(plan.days[0].meals.map((m) => m.meal)).toEqual(['breakfast', 'dinner'])
    expect(dayTotals(plan.days[1]).kcal).toBe(400)
    expect(plan.targetKcal).toBe(1800)
  })

  it('rejects an empty answer', () => {
    expect(() => buildPlan({ days: [] }, '2026-10-31', 1800)).toThrow()
  })

  it('keeps a swapped meal in its slot and cleans bad numbers', () => {
    const m = cleanPlanMeal({ name: 'Eggs', items: [{ name: 'Egg', grams: -5, kcal: Number.NaN }] }, 'breakfast')
    expect(m.meal).toBe('breakfast')
    expect(m.items[0]).toMatchObject({ grams: 100, kcal: 0 })
  })

  it('merges the shopping list by name from a date on', () => {
    const plan = buildPlan(
      {
        days: [
          { meals: [{ meal: 'lunch', name: 'A', items: [item('Chicken breast', 150, 250), item('Water', 250, 0)] }] },
          { meals: [{ meal: 'lunch', name: 'B', items: [item('chicken  breast', 200, 330), item('Rice', 150, 195)] }] },
        ],
      },
      '2026-10-31',
      1800,
    )
    expect(shoppingList(plan)).toEqual([
      { key: 'chicken breast', name: 'Chicken breast', grams: 350, count: 2 },
      { key: 'rice', name: 'Rice', grams: 150, count: 1 },
    ])
    expect(shoppingList(plan, '2026-11-01').map((i) => i.grams)).toEqual([200, 150])
  })
})
