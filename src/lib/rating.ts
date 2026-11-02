import type { FoodHealth, NutrientLevel } from './types'

export type Verdict = 'good' | 'okay' | 'limit'

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
  return health
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
