import type { FoodHealth, NutrientLevel } from './types'
import { allergensFromTags, dietStatus } from './allergens'

export type Verdict = 'good' | 'okay' | 'limit'

/** Raised when Plate starts reading more from Open Food Facts, so saved products are looked up again. */
export const HEALTH_VERSION = 2

/** The Open Food Facts fields healthFromOff reads. */
export const OFF_HEALTH_FIELDS =
  'nutriscore_grade,nova_group,nutrient_levels,additives_n,allergens_tags,traces_tags,ingredients_n,ingredients_analysis_tags,categories_tags,compared_to_category'

const NUTRI_GRADES = ['a', 'b', 'c', 'd', 'e'] as const
const LEVELS: readonly NutrientLevel[] = ['low', 'moderate', 'high']
// Plate's names for Open Food Facts' nutrient_levels keys.
const LEVEL_KEYS = { sugars: 'sugars', salt: 'salt', fat: 'fat', saturatedFat: 'saturated-fat' } as const

/** Reads the health fields of an Open Food Facts product; anything missing or unknown is left out. */
export function healthFromOff(p: Record<string, unknown>): FoodHealth {
  const health: FoodHealth = {}
  const grade = NUTRI_GRADES.find((g) => g === String(p.nutriscore_grade ?? '').toLowerCase())
  if (grade) health.nutriScore = grade
  const nova = Number(p.nova_group)
  if (nova === 1 || nova === 2 || nova === 3 || nova === 4) health.nova = nova
  const raw = (p.nutrient_levels ?? {}) as Record<string, unknown>
  const levels: NonNullable<FoodHealth['levels']> = {}
  for (const [key, offKey] of Object.entries(LEVEL_KEYS) as [keyof typeof LEVEL_KEYS, string][]) {
    const level = LEVELS.find((l) => l === raw[offKey])
    if (level) levels[key] = level
  }
  if (Object.keys(levels).length) health.levels = levels
  const additives = Number(p.additives_n)
  if (p.additives_n != null && Number.isInteger(additives) && additives >= 0) health.additives = additives
  // No allergens means none only when Open Food Facts knows the ingredients.
  const allergens = allergensFromTags(p.allergens_tags)
  if (allergens.length || Number(p.ingredients_n) > 0) health.allergens = allergens
  const traces = allergensFromTags(p.traces_tags)
  if (traces.length) health.traces = traces
  const vegan = dietStatus(p.ingredients_analysis_tags, 'vegan')
  if (vegan) health.vegan = vegan
  const vegetarian = dietStatus(p.ingredients_analysis_tags, 'vegetarian')
  if (vegetarian) health.vegetarian = vegetarian
  const categories = productCategories(p)
  if (categories.length) health.categories = categories
  return { version: HEALTH_VERSION, ...health }
}

/** The product's most specific categories, ending with the one Open Food Facts compares it against. */
function productCategories(p: Record<string, unknown>): string[] {
  const tags = (Array.isArray(p.categories_tags) ? p.categories_tags : []).filter((c): c is string => typeof c === 'string' && c.startsWith('en:'))
  const compared = typeof p.compared_to_category === 'string' && p.compared_to_category.startsWith('en:') ? p.compared_to_category : undefined
  const ordered = compared ? [...tags.filter((c) => c !== compared), compared] : tags
  return ordered.slice(-3)
}

const BY_GRADE: Record<NonNullable<FoodHealth['nutriScore']>, Verdict> = { a: 'good', b: 'good', c: 'okay', d: 'limit', e: 'limit' }

/**
 * Plate's short answer to "is this good for me?": from the Nutri-Score when the product has one,
 * otherwise from its sugar, fat and salt levels. Ultra-processed food is never rated good.
 */
export function rateFood(h: FoodHealth | undefined): Verdict | null {
  if (!h) return null
  let verdict: Verdict | null = null
  if (h.nutriScore) {
    verdict = BY_GRADE[h.nutriScore]
  } else if (h.levels) {
    const values = Object.values(h.levels)
    const highs = values.filter((l) => l === 'high').length
    const lows = values.filter((l) => l === 'low').length
    verdict = highs >= 2 ? 'limit' : highs === 1 ? 'okay' : lows >= 2 ? 'good' : 'okay'
  }
  if (verdict === 'good' && h.nova === 4) verdict = 'okay'
  return verdict
}

/** Whether to look for better products: rated C or worse, or "limit" without a Nutri-Score, and with a category to search. */
export function shouldSuggestAlternatives(h: FoodHealth | undefined): boolean {
  if (!h?.categories?.length) return false
  return h.nutriScore ? ['c', 'd', 'e'].includes(h.nutriScore) : rateFood(h) === 'limit'
}
