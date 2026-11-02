import { describe, expect, it } from 'vitest'
import { HEALTH_VERSION, dayQuality, estimateRating, healthFromOff, rateFood, shouldSuggestAlternatives } from './rating'
import { BUILTIN_FOODS } from './foods'
import type { DiaryEntry, Food } from './types'

describe('Open Food Facts health fields', () => {
  it('reads Nutri-Score, NOVA group, nutrient levels and additives', () => {
    expect(
      healthFromOff({
        nutriscore_grade: 'E',
        nova_group: '4',
        nutrient_levels: { fat: 'high', 'saturated-fat': 'high', sugars: 'high', salt: 'low' },
        additives_n: 1,
      }),
    ).toEqual({
      version: HEALTH_VERSION,
      nutriScore: 'e',
      nova: 4,
      levels: { fat: 'high', saturatedFat: 'high', sugars: 'high', salt: 'low' },
      additives: 1,
    })
  })

  it('reads allergens, diet and categories', () => {
    expect(
      healthFromOff({
        allergens_tags: ['en:milk', 'en:nuts'],
        traces_tags: ['en:gluten'],
        ingredients_analysis_tags: ['en:non-vegan', 'en:vegetarian'],
        categories_tags: ['en:breakfasts', 'en:spreads', 'fr:pates', 'en:sweet-spreads', 'en:hazelnut-spreads', 'en:cocoa-and-hazelnuts-spreads'],
        compared_to_category: 'en:hazelnut-spreads',
      }),
    ).toEqual({
      version: HEALTH_VERSION,
      allergens: ['milk', 'nuts'],
      traces: ['gluten'],
      vegan: 'no',
      vegetarian: 'yes',
      categories: ['en:sweet-spreads', 'en:cocoa-and-hazelnuts-spreads', 'en:hazelnut-spreads'],
    })
  })

  it('counts no allergens as none only when the ingredients are known', () => {
    expect(healthFromOff({ allergens_tags: [], ingredients_n: 4 }).allergens).toEqual([])
    expect(healthFromOff({ allergens_tags: [] }).allergens).toBeUndefined()
  })

  it('leaves out what the product doesn’t have', () => {
    expect(healthFromOff({ nutriscore_grade: 'unknown', nutrient_levels: {}, additives_n: null })).toEqual({ version: HEALTH_VERSION })
    expect(healthFromOff({ nutriscore_grade: 'not-applicable', nova_group: 7, nutrient_levels: { sugars: 'lots' } })).toEqual({ version: HEALTH_VERSION })
    expect(healthFromOff({ additives_n: 0 })).toEqual({ version: HEALTH_VERSION, additives: 0 })
  })
})

describe('rating a product', () => {
  it('follows the Nutri-Score', () => {
    expect(rateFood({ nutriScore: 'a' })).toBe('good')
    expect(rateFood({ nutriScore: 'b' })).toBe('good')
    expect(rateFood({ nutriScore: 'c' })).toBe('okay')
    expect(rateFood({ nutriScore: 'd' })).toBe('limit')
    expect(rateFood({ nutriScore: 'e' })).toBe('limit')
  })

  it('never calls ultra-processed food a good choice', () => {
    expect(rateFood({ nutriScore: 'a', nova: 4 })).toBe('okay')
    expect(rateFood({ nutriScore: 'e', nova: 4 })).toBe('limit')
    expect(rateFood({ nutriScore: 'a', nova: 1 })).toBe('good')
  })

  it('uses sugar, fat and salt when there is no Nutri-Score', () => {
    expect(rateFood({ levels: { sugars: 'high', salt: 'high', fat: 'low' } })).toBe('limit')
    expect(rateFood({ levels: { sugars: 'high', salt: 'low', fat: 'low' } })).toBe('okay')
    expect(rateFood({ levels: { sugars: 'low', salt: 'low', fat: 'moderate' } })).toBe('good')
    expect(rateFood({ levels: { sugars: 'low', salt: 'low' }, nova: 4 })).toBe('okay')
    expect(rateFood({ levels: { sugars: 'moderate' } })).toBe('okay')
  })

  it('gives no rating without data', () => {
    expect(rateFood(undefined)).toBeNull()
    expect(rateFood({})).toBeNull()
    expect(rateFood({ nova: 1, additives: 0 })).toBeNull()
  })
})

describe('when to suggest better products', () => {
  const categories = ['en:spreads']
  it('suggests them for C or worse, or a poor rating without a Nutri-Score', () => {
    expect(shouldSuggestAlternatives({ nutriScore: 'c', categories })).toBe(true)
    expect(shouldSuggestAlternatives({ nutriScore: 'e', categories })).toBe(true)
    expect(shouldSuggestAlternatives({ nutriScore: 'b', categories })).toBe(false)
    expect(shouldSuggestAlternatives({ levels: { sugars: 'high', fat: 'high' }, categories })).toBe(true)
    expect(shouldSuggestAlternatives({ levels: { sugars: 'low', fat: 'low' }, categories })).toBe(false)
  })

  it('needs a category to search in', () => {
    expect(shouldSuggestAlternatives({ nutriScore: 'e' })).toBe(false)
    expect(shouldSuggestAlternatives(undefined)).toBe(false)
  })
})

describe('Plate’s estimate for foods without Open Food Facts data', () => {
  const food = (name: string) => {
    const f = BUILTIN_FOODS.find((b) => b.name === name)
    if (!f) throw new Error(`No built-in food called ${name}`)
    return f
  }
  const verdictOf = (name: string) => estimateRating(food(name))?.verdict

  it('calls whole foods good', () => {
    for (const name of ['Raspberries', 'Broccoli', 'Walnuts', 'Lentils, cooked', 'Chicken breast, cooked', 'Whole wheat bread', 'Greek yogurt, nonfat', 'Lobio (bean stew)', 'Water', 'Oats, dry'])
      expect(verdictOf(name), name).toBe('good')
  })

  it('puts everyday mixed foods in the middle', () => {
    for (const name of ['White bread', 'Khachapuri Imeruli', 'Khinkali, meat', 'French fries', 'Olive oil', 'Dates', 'Sulguni cheese', 'Latte', 'Ketchup', 'Soy sauce'])
      expect(verdictOf(name), name).toBe('okay')
  })

  it('flags sweets, sugary and alcoholic drinks, processed meat and very fatty foods', () => {
    for (const name of ['Cola', 'Red wine, dry', 'Chacha / vodka', 'Sugar', 'Honey', 'Milk chocolate', 'Gozinaki', 'Butter', 'Mayonnaise', 'Bacon, cooked', 'Salami', 'Sausage / frankfurter', 'Croissant'])
      expect(verdictOf(name), name).toBe('limit')
  })

  it('uses sugar when it is known', () => {
    const per100 = { kcal: 380, protein: 6, carbs: 80, fat: 3, fiber: 3, sugar: 35 }
    expect(estimateRating({ name: 'Breakfast cereal', per100, source: 'usda' })?.reasons.map((r) => r.label)).toEqual(['Energy-dense', 'High sugar', 'Source of fiber'])
  })

  it('has no rating for quick-add calories', () => {
    expect(estimateRating({ name: 'Snack', per100: { kcal: 200, protein: 0, carbs: 0, fat: 0 }, source: 'quick' })).toBeNull()
  })
})

describe('the day’s food quality', () => {
  const entry = (food: Food | undefined, kcal: number) =>
    ({ id: String(kcal), date: '2026-11-02', meal: 'lunch', name: 'x', grams: 100, amountLabel: '', nutrients: { kcal, protein: 0, carbs: 0, fat: 0 }, food, createdAt: 0 }) as DiaryEntry
  const apple = BUILTIN_FOODS.find((f) => f.name === 'Apple')!
  const cola = BUILTIN_FOODS.find((f) => f.name === 'Cola')!

  it('splits calories by rating, preferring Open Food Facts’ rating', () => {
    const scanned = { ...apple, health: { nutriScore: 'e' as const } }
    expect(dayQuality([entry(apple, 100), entry(cola, 140), entry(scanned, 60), entry(undefined, 300)])).toEqual({ good: 100, okay: 0, limit: 200, total: 300 })
  })
})
