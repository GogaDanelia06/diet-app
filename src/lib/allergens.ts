import type { Allergen, DietStatus, DietStyle, FoodHealth } from './types'

/** The 14 allergens food labels must declare in Europe, with their Open Food Facts tags. */
export const ALLERGENS: { id: Allergen; tag: string; label: string }[] = [
  { id: 'gluten', tag: 'en:gluten', label: 'Gluten' },
  { id: 'milk', tag: 'en:milk', label: 'Milk' },
  { id: 'eggs', tag: 'en:eggs', label: 'Eggs' },
  { id: 'nuts', tag: 'en:nuts', label: 'Tree nuts' },
  { id: 'peanuts', tag: 'en:peanuts', label: 'Peanuts' },
  { id: 'soy', tag: 'en:soybeans', label: 'Soy' },
  { id: 'fish', tag: 'en:fish', label: 'Fish' },
  { id: 'shellfish', tag: 'en:crustaceans', label: 'Shellfish' },
  { id: 'molluscs', tag: 'en:molluscs', label: 'Molluscs' },
  { id: 'sesame', tag: 'en:sesame-seeds', label: 'Sesame' },
  { id: 'celery', tag: 'en:celery', label: 'Celery' },
  { id: 'mustard', tag: 'en:mustard', label: 'Mustard' },
  { id: 'lupin', tag: 'en:lupin', label: 'Lupin' },
  { id: 'sulphites', tag: 'en:sulphur-dioxide-and-sulphites', label: 'Sulphites' },
]

export const allergenLabel = (id: Allergen) => ALLERGENS.find((a) => a.id === id)!.label

/** The allergens among a list of Open Food Facts tags, in the order of ALLERGENS. */
export function allergensFromTags(tags: unknown): Allergen[] {
  if (!Array.isArray(tags)) return []
  return ALLERGENS.filter((a) => tags.includes(a.tag)).map((a) => a.id)
}

/** Reads "en:vegan" / "en:non-vegan" / "en:maybe-vegan" style tags from ingredients_analysis_tags. */
export function dietStatus(tags: unknown, diet: 'vegan' | 'vegetarian'): DietStatus | undefined {
  if (!Array.isArray(tags)) return undefined
  if (tags.includes(`en:${diet}`)) return 'yes'
  if (tags.includes(`en:non-${diet}`)) return 'no'
  if (tags.includes(`en:maybe-${diet}`)) return 'maybe'
  return undefined
}

export interface DietWarnings {
  contains: Allergen[]
  traces: Allergen[]
  /** English text, translated where it's shown. */
  diet?: string
}

const SEAFOOD: Allergen[] = ['fish', 'shellfish', 'molluscs']

/** What on a product clashes with the person's allergies and way of eating. */
export function dietWarnings(h: FoodHealth | undefined, allergies: Allergen[], diet: DietStyle): DietWarnings {
  const contains = (h?.allergens ?? []).filter((a) => allergies.includes(a))
  const traces = (h?.traces ?? []).filter((a) => allergies.includes(a) && !contains.includes(a))
  let dietNote: string | undefined
  if (diet === 'vegan') {
    dietNote = h?.vegan === 'no' ? 'Not vegan' : h?.vegan === 'maybe' ? 'May not be vegan' : undefined
  } else if (diet === 'vegetarian') {
    dietNote = h?.vegetarian === 'no' ? 'Not vegetarian' : h?.vegetarian === 'maybe' ? 'May not be vegetarian' : undefined
  } else if (diet === 'pescatarian') {
    // Open Food Facts can't tell fish from meat, but a non-vegetarian product without seafood allergens likely has meat.
    if (h?.vegetarian === 'no' && !h.allergens?.some((a) => SEAFOOD.includes(a))) dietNote = 'May contain meat'
  }
  return { contains, traces, diet: dietNote }
}
