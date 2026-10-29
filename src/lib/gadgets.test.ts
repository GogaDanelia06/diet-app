import { describe, expect, it } from 'vitest'
import { gardenPlots, gardenStreak, goalForecast, mealForHour, mealIdeas, nextGardenReward, nextMealTarget } from './gadgets'
import type { DiaryEntry, Meal } from './types'

const entry = (date: string, meal: Meal, name: string, kcal: number, protein = 10): DiaryEntry => ({
  id: `${date}-${meal}-${name}`,
  date,
  meal,
  name,
  grams: 100,
  amountLabel: '100 g',
  nutrients: { kcal, protein, carbs: 0, fat: 0 },
  createdAt: 0,
})

describe('next meal', () => {
  it('follows the clock', () => {
    expect(mealForHour(8)).toBe('breakfast')
    expect(mealForHour(13)).toBe('lunch')
    expect(mealForHour(19)).toBe('dinner')
    expect(mealForHour(23)).toBe('snack')
  })

  it('shares what is left between the meals still to come', () => {
    // Lunch, dinner and a snack are left: lunch gets 0.35 / 0.75 of 1500 kcal.
    expect(nextMealTarget(12, ['breakfast'], { kcal: 1500, protein: 90 })).toEqual({ meal: 'lunch', kcal: 700, protein: 42 })
  })

  it('moves on when the meal is already logged', () => {
    expect(nextMealTarget(12, ['breakfast', 'lunch'], { kcal: 800, protein: 40 }).meal).toBe('dinner')
    expect(nextMealTarget(22, ['snack'], { kcal: 200, protein: 0 }).meal).toBe('snack')
  })

  it('never asks for negative calories', () => {
    expect(nextMealTarget(19, [], { kcal: -300, protein: -10 })).toEqual({ meal: 'dinner', kcal: 0, protein: 0 })
  })
})

describe('meal ideas', () => {
  const entries = [
    entry('2026-10-20', 'dinner', 'Chicken breast', 330, 60),
    entry('2026-10-20', 'dinner', 'Rice', 200, 4),
    entry('2026-10-21', 'breakfast', 'Oatmeal', 520, 15),
    entry('2026-10-22', 'dinner', 'Khachapuri', 1100, 40),
    entry('2026-10-29', 'dinner', 'Soup', 500, 20),
  ]

  it('picks past meals that fit, preferring the same meal and more protein', () => {
    const ideas = mealIdeas(entries, [], '2026-10-29', { meal: 'dinner', kcal: 550, protein: 45 })
    expect(ideas.map((i) => i.names)).toEqual([['Chicken breast', 'Rice'], ['Oatmeal']])
    expect(ideas[0].kcal).toBe(530)
  })

  it('leaves out today, oversized meals and saved duplicates', () => {
    const saved = [{ id: 's1', name: 'Usual dinner', items: entries.slice(0, 2) }]
    const ideas = mealIdeas(entries, saved, '2026-10-29', { meal: 'dinner', kcal: 550, protein: 45 })
    expect(ideas[0].title).toBe('Usual dinner')
    expect(ideas).toHaveLength(2)
    expect(ideas.some((i) => i.names.includes('Soup') || i.names.includes('Khachapuri'))).toBe(false)
  })

  it('suggests nothing when there is no room left', () => {
    expect(mealIdeas(entries, [], '2026-10-29', { meal: 'dinner', kcal: 50, protein: 0 })).toEqual([])
  })
})

describe('goal forecast', () => {
  const base = { currentKg: 90, goalKg: 85, today: '2026-10-29', weighRate: null, loggedGaps: [], planRate: 0.5 }

  it('uses the plan until there is real data', () => {
    expect(goalForecast(base)).toMatchObject({ source: 'plan', status: 'onTrack', days: 70, date: '2027-01-07' })
  })

  it('prefers logged calorie gaps, then weigh-ins', () => {
    expect(goalForecast({ ...base, loggedGaps: [1100, 1100, 1100] })).toMatchObject({ source: 'logs', days: 35 })
    expect(goalForecast({ ...base, loggedGaps: [1100, 1100, 1100], weighRate: -0.25 })).toMatchObject({ source: 'weighIns', days: 140 })
  })

  it('moves the date with a what-if change', () => {
    expect(goalForecast({ ...base, extraKcal: 550 }).days).toBe(35)
  })

  it('says when the scale is not moving, the goal is far, or reached', () => {
    expect(goalForecast({ ...base, weighRate: 0.2 }).status).toBe('stalled')
    expect(goalForecast({ ...base, currentKg: 120, planRate: 0.1 }).status).toBe('far')
    expect(goalForecast({ ...base, currentKg: 84.5 }).status).toBe('reached')
  })
})

describe('veggie garden', () => {
  const day = (date: string, kcal: number, logged = true) => ({ date, kcal, budget: 2000, logged })

  it('grows a vegetable for each full day within budget', () => {
    const plots = gardenPlots([day('2026-10-25', 0, false), day('2026-10-26', 600), day('2026-10-27', 2300), day('2026-10-28', 1800), day('2026-10-29', 900)], '2026-10-29')
    expect(plots.map((p) => p.state)).toEqual(['empty', 'sprout', 'wilt', 'veg', 'growing'])
    expect(plots[4].progress).toBeCloseTo(0.45)
    expect(gardenPlots([day('2026-10-28', 1800)], '2026-10-29')[0].kind).toBe(plots[3].kind)
  })

  it('counts the streak up to the newest finished day', () => {
    const plots = gardenPlots([day('2026-10-26', 2300), day('2026-10-27', 1500), day('2026-10-28', 1800), day('2026-10-29', 0, false)], '2026-10-29')
    expect(gardenStreak(plots)).toBe(2)
    expect(gardenStreak(plots.slice(0, 1))).toBe(0)
  })

  it('names the next streak reward and how far away it is', () => {
    expect(nextGardenReward(0)).toMatchObject({ label: 'Butterflies', daysLeft: 3 })
    expect(nextGardenReward(8)).toMatchObject({ label: 'Golden veggie', daysLeft: 6 })
    expect(nextGardenReward(30)).toBeNull()
  })
})
