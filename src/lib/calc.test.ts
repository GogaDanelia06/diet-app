import { describe, expect, it } from 'vitest'
import { bmr, caloriePlan, macroTargets, scaleNutrients, sumNutrients, toPer100, weeksToGoal } from './calc'
import { exerciseKcal, metForSpeed, stepsKcal } from './exercises'
import { recipeToFood } from './store'
import { BUILTIN_FOODS } from './foods'
import { searchFoods } from './search'
import { amountLabel } from '../components/FoodDetail'
import type { Profile } from './types'

const profile: Profile = {
  sex: 'male',
  age: 30,
  heightCm: 180,
  startWeightKg: 90,
  goalWeightKg: 80,
  activity: 'light',
  ratePerWeekKg: 0.5,
  startDate: '2026-10-01',
}

describe('calorie math', () => {
  it('matches the Mifflin–St Jeor formula', () => {
    expect(bmr('male', 90, 180, 30)).toBe(1880)
    expect(bmr('female', 70, 165, 40)).toBeCloseTo(1370.25)
  })

  it('subtracts 550 kcal a day for 0.5 kg a week', () => {
    const plan = caloriePlan(profile, 90)
    expect(plan.maintenance).toBe(2585)
    expect(plan.deficit).toBe(550)
    expect(plan.target).toBe(2040)
    expect(plan.floored).toBe(false)
  })

  it('never suggests less than the safe minimum', () => {
    const plan = caloriePlan({ ...profile, sex: 'female', heightCm: 150, age: 60, activity: 'sedentary', ratePerWeekKg: 1, goalWeightKg: 45 }, 55)
    expect(plan.target).toBe(1200)
    expect(plan.floored).toBe(true)
  })

  it('keeps weight steady when the goal is not lower', () => {
    const plan = caloriePlan({ ...profile, goalWeightKg: 95 }, 90)
    expect(plan.deficit).toBe(0)
  })

  it('splits macros by calories', () => {
    expect(macroTargets(2000, 'balanced')).toEqual({ protein: 150, carbs: 200, fat: 67 })
  })

  it('estimates weeks to goal', () => {
    expect(weeksToGoal(90, 80, 0.5)).toBe(20)
    expect(weeksToGoal(80, 85, 0.5)).toBeNull()
  })

  it('counts exercise calories above resting', () => {
    expect(exerciseKcal(3.5, 80, 60)).toBe(200)
    expect(exerciseKcal(0.9, 80, 60)).toBe(0)
  })

  it('works out effort from speed', () => {
    expect(metForSpeed('run', 10)).toBeCloseTo(10.0, 0)
    expect(metForSpeed('walk', 2)).toBe(2.8)
    expect(metForSpeed('cycle', 40)).toBe(15.8)
  })

  it('only counts steps above a normal day for the activity level', () => {
    expect(stepsKcal(3000, 80, 'sedentary')).toBe(0)
    expect(stepsKcal(10000, 80, 'sedentary')).toBe(215)
    expect(stepsKcal(10000, 80, 'active')).toBe(31)
  })
})

describe('nutrients', () => {
  it('scales per-100 g values', () => {
    expect(scaleNutrients({ kcal: 200, protein: 10, carbs: 20, fat: 5 }, 150)).toEqual({ kcal: 300, protein: 15, carbs: 30, fat: 7.5 })
  })

  it('round-trips totals through per-100 g', () => {
    const per100 = toPer100({ kcal: 300, protein: 15, carbs: 30, fat: 7.5 }, 150)
    expect(per100.kcal).toBeCloseTo(200)
  })

  it('sums entries', () => {
    expect(sumNutrients([{ kcal: 100, protein: 1, carbs: 2, fat: 3 }, { kcal: 50, protein: 1, carbs: 1, fat: 1 }]).kcal).toBe(150)
  })

  it('preserves reported optional nutrient totals, including a real zero', () => {
    const totals = sumNutrients([
      { kcal: 100, protein: 1, carbs: 2, fat: 3, fiber: 0, sugar: 2.5 },
      { kcal: 50, protein: 1, carbs: 1, fat: 1, fiber: 0, sugar: 0 },
    ])
    expect(totals).toEqual({ kcal: 150, protein: 2, carbs: 3, fat: 4, fiber: 0, sugar: 2.5 })
  })

  it('omits an incomplete nutrient independently of other complete nutrients', () => {
    const base = { kcal: 100, protein: 1, carbs: 2, fat: 3 }
    const incompleteFiber = sumNutrients([{ ...base, fiber: 2, sugar: 3 }, { ...base, sugar: 4 }])
    expect(incompleteFiber).not.toHaveProperty('fiber')
    expect(incompleteFiber.sugar).toBe(7)
    const incompleteSugar = sumNutrients([{ ...base, fiber: 2, sugar: 3 }, { ...base, fiber: 4 }])
    expect(incompleteSugar).not.toHaveProperty('sugar')
    expect(incompleteSugar.fiber).toBe(6)
  })

  it('does not invent optional nutrients for empty or unreported inputs', () => {
    expect(sumNutrients([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
    expect(sumNutrients([{ kcal: 100, protein: 1, carbs: 2, fat: 3 }])).toEqual({ kcal: 100, protein: 1, carbs: 2, fat: 3 })
  })

  it.each([NaN, Infinity, -Infinity])('omits non-finite optional nutrient data (%s)', (invalid) => {
    const totals = sumNutrients([{ kcal: 100, protein: 1, carbs: 2, fat: 3, fiber: invalid, sugar: invalid }])
    expect(totals).not.toHaveProperty('fiber')
    expect(totals).not.toHaveProperty('sugar')
    expect(totals.kcal).toBe(100)
  })

  it('keeps incomplete recipe nutrients unknown through per-100 g and portion scaling', () => {
    const base = { kcal: 100, protein: 1, carbs: 2, fat: 3 }
    const food = recipeToFood({
      id: 'r-unknown', name: 'Mixed data', portions: 2,
      ingredients: [
        { food: { id: 'known', name: 'Known', per100: { ...base, fiber: 2, sugar: 3 }, servings: [], source: 'custom' }, grams: 100, amountLabel: '100 g' },
        { food: { id: 'partial', name: 'Partial', per100: { ...base, sugar: 1 }, servings: [], source: 'custom' }, grams: 100, amountLabel: '100 g' },
      ],
    })
    expect(food.per100).not.toHaveProperty('fiber')
    expect(food.per100.sugar).toBe(2)
    const portion = scaleNutrients(food.per100, food.servings[0].grams)
    expect(portion).not.toHaveProperty('fiber')
    expect(portion.sugar).toBe(2)
    expect(portion.kcal).toBe(100)
  })

  it('works out recipe portions', () => {
    const beans = BUILTIN_FOODS.find((f) => f.name === 'Kidney beans, cooked')!
    const oil = BUILTIN_FOODS.find((f) => f.name === 'Sunflower oil')!
    const food = recipeToFood({
      id: 'r1',
      name: 'Lobio',
      portions: 4,
      ingredients: [
        { food: beans, grams: 800, amountLabel: '800 g' },
        { food: oil, grams: 40, amountLabel: '40 g' },
      ],
    })
    expect(food.servings[0]).toEqual({ label: '1 portion', grams: 210 })
    const portionKcal = (food.per100.kcal * 210) / 100
    expect(portionKcal).toBeCloseTo((127 * 8 + 884 * 0.4) / 4, 0)
  })

  it('labels amounts', () => {
    const khinkali = BUILTIN_FOODS.find((f) => f.name === 'Khinkali, meat')!
    expect(amountLabel(khinkali, 0, 3, 165)).toBe('3 × 1 piece (165 g)')
    expect(amountLabel(khinkali, -1, 120, 120)).toBe('120 g')
  })
})

describe('food database', () => {
  it('has consistent calories for its macros', () => {
    for (const f of BUILTIN_FOODS) {
      const { kcal, protein, carbs, fat } = f.per100
      // Alcohol has calories that aren't in the macros, so skip drinks with alcohol.
      if (/wine|beer|chacha|vodka/i.test(f.name)) continue
      const fromMacros = protein * 4 + carbs * 4 + fat * 9
      expect(Math.abs(fromMacros - kcal), f.name).toBeLessThan(Math.max(25, kcal * 0.15))
    }
  })

  it('has unique ids and sensible servings', () => {
    const ids = new Set(BUILTIN_FOODS.map((f) => f.id))
    expect(ids.size).toBe(BUILTIN_FOODS.length)
    for (const f of BUILTIN_FOODS) for (const s of f.servings) expect(s.grams, f.name).toBeGreaterThan(0)
  })

  it('finds Georgian dishes', () => {
    expect(searchFoods(BUILTIN_FOODS, 'khach')[0].name).toMatch(/Khachapuri/)
    expect(searchFoods(BUILTIN_FOODS, 'khinkali cheese')[0].name).toBe('Khinkali, cheese')
    expect(searchFoods(BUILTIN_FOODS, 'apple')[0].name).toBe('Apple')
  })
})
