import type { DiaryEntry, Food, FoodHealth, NutrientLevel } from './types'
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

export type Tone = 'good' | 'okay' | 'bad'

export interface Estimate {
  verdict: Verdict
  /** Why, in English; translated where shown. */
  reasons: { label: string; tone: Tone }[]
}

const PROCESSED_MEAT = /\b(salami|bacon|sausages?|frankfurters?|hot ?dogs?|pepperoni|ham|chorizo|kupaty)\b/i

/**
 * Plate's own rating for foods without Open Food Facts data (built-in foods, recipes, USDA and AI
 * foods), from nutrients per 100 g and, for built-in foods, their category. Salt and saturated fat
 * aren't known for these foods, so it's a rough guide: whole-food groups count as good, sweets and
 * processed meat count against, and the rest is scored on energy, sugar, fat, fiber and protein.
 */
export function estimateRating(food: Pick<Food, 'name' | 'per100' | 'category' | 'source'>): Estimate | null {
  if (food.source === 'quick') return null
  const n = food.per100
  if (!Number.isFinite(n.kcal) || n.kcal < 0) return null
  const cat = food.category
  const one = (verdict: Verdict, label: string, tone: Tone): Estimate => ({ verdict, reasons: [{ label, tone }] })

  if (cat === 'Fruit') return n.kcal > 200 ? one('okay', 'Dried fruit: very sweet', 'okay') : one('good', 'Fruit', 'good')
  // Fried and buttery dishes in the vegetable list are scored like any other food.
  if (cat === 'Vegetables' && n.fat <= 5) return one('good', 'Vegetables', 'good')
  if (cat === 'Nuts & seeds') {
    return { verdict: 'good', reasons: [{ label: 'Healthy fats and fiber', tone: 'good' }, { label: 'Energy-dense: a handful is enough', tone: 'okay' }] }
  }
  if (cat === 'Drinks') {
    if (n.kcal <= 5) return one('good', 'No calories', 'good')
    // Alcohol has calories that protein, carbs and fat don't account for.
    if (n.kcal - (n.protein * 4 + n.carbs * 4 + n.fat * 9) >= 15) return one('limit', 'Contains alcohol', 'bad')
    if (n.carbs >= 5 && n.protein < 1) return n.carbs >= 8 ? one('limit', 'Sugary drink', 'bad') : one('okay', 'Sugary drink', 'okay')
  }
  if (cat === 'Oils & sauces' && n.fat >= 90) return one('okay', 'Pure fat: use a little', 'okay')

  let score = 0
  const reasons: Estimate['reasons'] = []
  const add = (points: number, label: string, tone: Tone) => {
    score += points
    reasons.push({ label, tone })
  }
  if (n.kcal > 400) add(-2, 'Very energy-dense', 'bad')
  else if (n.kcal > 250) add(-1, 'Energy-dense', 'okay')
  else if (n.kcal < 100) add(1, 'Low in calories', 'good')
  if (n.sugar != null) {
    if (n.sugar > 22.5) add(-2, 'High sugar', 'bad')
  } else if (n.carbs >= 50 && (n.fiber ?? 0) < 2 && n.protein < 5) {
    add(-2, 'Mostly sugar or white starch', 'bad')
  }
  const proteinShare = n.kcal > 0 ? (n.protein * 4) / n.kcal : 0
  if (n.fat > 17.5) add(-2, 'High fat', 'bad')
  // Fish, eggs and meat carry some fat with lots of protein; fast food and pastries carry more fat than protein.
  else if (n.fat > 10 && proteinShare < 0.25) add(-1, 'Quite fatty', 'okay')
  const fiber = n.fiber ?? 0
  if (fiber >= 6) add(2, 'High fiber', 'good')
  else if (fiber >= 3) add(1, 'Source of fiber', 'good')
  if (n.protein >= 10 && proteinShare >= 0.2) add(2, 'High protein', 'good')
  else if (n.protein >= 5 && proteinShare >= 0.12) add(1, 'Source of protein', 'good')
  if (cat === 'Sweets & snacks') add(-2, 'Sweet treat or snack', 'bad')
  if (PROCESSED_MEAT.test(food.name)) add(-2, 'Processed meat', 'bad')

  let verdict: Verdict = score >= 2 ? 'good' : score <= -2 ? 'limit' : 'okay'
  // Sauces are eaten in small amounts and their salt isn't known, so they're never called good.
  if (cat === 'Oils & sauces' && verdict === 'good') verdict = 'okay'
  return { verdict, reasons }
}

/** Open Food Facts' rating when there is one, otherwise Plate's estimate. */
export function foodVerdict(food: Food | undefined): Verdict | null {
  if (!food) return null
  return rateFood(food.health) ?? estimateRating(food)?.verdict ?? null
}

/** How the day's calories split between good, okay and limit foods; foods without a rating are left out. */
export function dayQuality(entries: DiaryEntry[]): Record<Verdict, number> & { total: number } {
  const out = { good: 0, okay: 0, limit: 0, total: 0 }
  for (const e of entries) {
    const verdict = foodVerdict(e.food)
    if (!verdict || !(e.nutrients.kcal > 0)) continue
    out[verdict] += e.nutrients.kcal
    out.total += e.nutrients.kcal
  }
  return out
}
