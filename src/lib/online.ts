import { t } from './i18n'
import type { Food, FoodHealth, Nutrients, Serving } from './types'
import { OFF_HEALTH_FIELDS, healthFromOff } from './rating'
import { FAST_FOOD } from './foods'

const round1 = (n: number) => Math.round(n * 10) / 10

/** Looks up a packaged product by barcode in Open Food Facts. Returns null if not found. */
export async function lookupBarcode(code: string): Promise<Food | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_en,brands,nutriments,serving_quantity,serving_size,quantity,${OFF_HEALTH_FIELDS}`
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(t('Open Food Facts answered {s}. Try again in a minute.', { s: res.status }))
  const data = await res.json()
  if (data.status !== 1 || !data.product) return null
  const p = data.product
  const n = p.nutriments ?? {}
  let kcal = n['energy-kcal_100g']
  if (kcal == null && n['energy_100g'] != null) kcal = n['energy_100g'] / 4.184
  if (kcal == null) return null
  const per100: Nutrients = {
    kcal: Math.round(kcal),
    protein: round1(n.proteins_100g ?? 0),
    carbs: round1(n.carbohydrates_100g ?? 0),
    fat: round1(n.fat_100g ?? 0),
    fiber: n.fiber_100g != null ? round1(n.fiber_100g) : undefined,
    sugar: n.sugars_100g != null ? round1(n.sugars_100g) : undefined,
  }
  const servings: Serving[] = []
  const sq = Number(p.serving_quantity)
  if (sq > 0) servings.push({ label: `1 serving${p.serving_size ? ` (${p.serving_size})` : ''}`, grams: sq })
  const pack = parseFloat(p.quantity)
  if (pack > 0 && /\b(g|ml)\b/i.test(p.quantity ?? '') && pack !== sq) servings.push({ label: `whole pack (${p.quantity})`, grams: pack })
  return {
    id: `bc-${code}`,
    name: p.product_name || p.product_name_en || t('Unnamed product'),
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    per100,
    servings,
    source: 'barcode',
    barcode: code,
    health: healthFromOff(p),
  }
}

export interface Alternative {
  code: string
  name: string
  brand?: string
  nutriScore: 'a' | 'b'
  image?: string
}

/** Products from an Open Food Facts search answer that are rated `grade`, leaving out the scanned one. */
export function parseAlternatives(data: unknown, grade: 'a' | 'b', exclude?: string): Alternative[] {
  const products = (data as { products?: Record<string, unknown>[] } | null)?.products
  if (!Array.isArray(products)) return []
  const out: Alternative[] = []
  for (const p of products) {
    const code = String(p.code ?? '')
    const name = String(p.product_name || p.product_name_en || '').trim()
    if (!code || code === exclude || !name || p.nutriscore_grade !== grade) continue
    const brand = typeof p.brands === 'string' ? p.brands.split(',')[0].trim() : ''
    const image = typeof p.image_front_small_url === 'string' && p.image_front_small_url.startsWith('https://') ? p.image_front_small_url : undefined
    out.push({ code, name, brand: brand || undefined, nutriScore: grade, image })
  }
  return out
}

const alternativesCache = new Map<string, Alternative[]>()

/**
 * Better-rated products in the same category: Nutri-Score A first, then B, most popular first.
 * Tries the product's most specific category, then the one above it. Searches are slow and
 * sometimes fail on Open Food Facts' side, so results are kept for the session.
 */
export async function findAlternatives(health: FoodHealth, exclude?: string, want = 5): Promise<Alternative[]> {
  const categories = (health.categories ?? []).slice(-2).reverse()
  const key = `${categories[0]}|${exclude}`
  const cached = alternativesCache.get(key)
  if (cached) return cached
  const found: Alternative[] = []
  for (const category of categories) {
    for (const grade of ['a', 'b'] as const) {
      const params = new URLSearchParams({
        categories_tags: category,
        nutrition_grades_tags: grade,
        fields: 'code,product_name,product_name_en,brands,nutriscore_grade,image_front_small_url',
        sort_by: 'popularity_key',
        page_size: String(want * 2),
      })
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/search?${params}`)
      if (!res.ok) throw new Error(t('Open Food Facts answered {s}. Try again in a minute.', { s: res.status }))
      for (const alt of parseAlternatives(await res.json(), grade, exclude)) {
        if (!found.some((f) => f.code === alt.code)) found.push(alt)
      }
      if (found.length >= want) break
    }
    if (found.length >= 3) break
  }
  const result = found.slice(0, want)
  alternativesCache.set(key, result)
  return result
}

interface UsdaNutrient {
  nutrientId: number
  value: number
}

// Kept out of the code (USDA deactivates keys found in public repositories); the deploy adds it from a secret.
const SHARED_USDA_KEY = import.meta.env.VITE_USDA_KEY ?? ''

export const hasSharedUsdaKey = () => !!SHARED_USDA_KEY

/** Keys to try, in order: the person's own key, Plate's shared key, then USDA's demo key. */
export function usdaKeys(own: string, shared = SHARED_USDA_KEY) {
  return [...new Set([own.trim(), shared.trim(), 'DEMO_KEY'].filter(Boolean))]
}

/** The key a search starts with. */
export const activeUsdaKey = (own: string) => usdaKeys(own)[0]

const usdaSearchUrl = (params: Record<string, string>) => `https://api.nal.usda.gov/fdc/v1/foods/search?${new URLSearchParams(params)}`

/** Tries a USDA key with a one-result search; returns null when it works, otherwise what went wrong. */
export async function checkUsdaKey(key: string): Promise<string | null> {
  try {
    const res = await fetch(usdaSearchUrl({ query: 'apple', pageSize: '1', api_key: key }))
    if (res.ok) return null
    if (res.status === 403) return t('That USDA key was rejected. Copy it again from the email.')
    if (res.status === 429) return t('That key reached its hourly limit. Try again in an hour.')
    return t('USDA search answered {s}.', { s: res.status })
  } catch {
    return t('Online search failed. Check your internet connection.')
  }
}

// Chains whose menu items USDA has measured in its lab: how USDA writes them, how Plate shows them,
// and how people type them (lowercase, without apostrophes), in Latin letters and Georgian.
const CHAINS: { usda: string; brand: string; typed: string[] }[] = [
  { usda: "McDONALD'S", brand: "McDonald's", typed: ['mcdonalds', 'mcdonald', 'mc donalds', 'macdonalds', 'mac donalds', 'მაკდონალდსი', 'მაკდონალდს', 'მაკდონალდი'] },
  { usda: 'BURGER KING', brand: 'Burger King', typed: ['burger king', 'burgerking', 'ბურგერ კინგი', 'ბურგერკინგი'] },
  { usda: 'KFC', brand: 'KFC', typed: ['kfc', 'kentucky fried', 'კეიეფსი', 'კფს'] },
  { usda: "WENDY'S", brand: "Wendy's", typed: ['wendys', 'wendy', 'ვენდისი', 'ვენდის'] },
  { usda: "DOMINO'S", brand: "Domino's", typed: ['dominos', 'domino', 'დომინოსი', 'დომინოს'] },
  { usda: "PAPA JOHN'S", brand: "Papa John's", typed: ['papa johns', 'papa john', 'პაპა ჯონსი', 'პაპა ჯონს'] },
  { usda: 'PIZZA HUT', brand: 'Pizza Hut', typed: ['pizza hut', 'pizzahut', 'პიცა ჰატი'] },
  { usda: 'POPEYES', brand: 'Popeyes', typed: ['popeyes', 'popeye', 'პოპაისი', 'პოპაის'] },
  { usda: 'SUBWAY', brand: 'Subway', typed: ['subway', 'საბვეი'] },
  { usda: 'TACO BELL', brand: 'Taco Bell', typed: ['taco bell', 'ტაკო ბელი'] },
  { usda: 'LITTLE CAESARS', brand: 'Little Caesars', typed: ['little caesars', 'little caesar'] },
]

export const CHAIN_BRANDS = CHAINS.map((c) => c.brand)

export const USDA_CHAIN_NOTE = 'USDA lab analysis of this chain’s US recipe. Georgian restaurants can use different recipes and portions.'

/** The query with a typed chain name swapped for USDA's spelling, and which chain it was; null if none. */
export function chainQuery(query: string): { query: string; brand: string } | null {
  const q = query.toLowerCase().replace(/['’`]/g, '').replace(/\s+/g, ' ').trim()
  for (const chain of CHAINS) {
    const typed = [...chain.typed].sort((a, b) => b.length - a.length).find((t) => q.includes(t))
    if (typed) return { query: q.replace(typed, chain.usda).trim(), brand: chain.brand }
  }
  return null
}

/** Splits USDA's "McDONALD'S, BIG MAC" into the chain and the item; null when it isn't a chain's item. */
export function splitChain(description: string): { brand: string; name: string } | null {
  for (const chain of CHAINS) {
    const m = description.match(new RegExp(`^${chain.usda.replace(/'/g, "['’]")}[,\\s]+(.+)$`, 'i'))
    if (m) return { brand: chain.brand, name: titleCase(m[1].trim()) }
  }
  return null
}

/** Searches USDA FoodData Central. Values in search results are per 100 g. */
export async function searchUsda(query: string, apiKey: string): Promise<Food[]> {
  let res: Response | undefined
  for (const key of usdaKeys(apiKey)) {
    res = await fetch(usdaSearchUrl({ query: chainQuery(query)?.query ?? query, pageSize: '25', dataType: 'Foundation,SR Legacy,Branded', api_key: key }))
    // A rejected or rate-limited key falls through to the next one.
    if (res.status !== 403 && res.status !== 429) break
  }
  if (!res) throw new Error(t('Online search failed. Check your internet connection.'))
  if (res.status === 429)
    throw new Error(t('The free shared USDA key hit its hourly limit. Add your own free key in Me → Online food search.'))
  if (!res.ok) throw new Error(t('USDA search answered {s}.', { s: res.status }))
  const data = await res.json()
  return ((data.foods ?? []) as UsdaFood[]).map(fromUsda)
}

interface UsdaFood {
  fdcId: number
  description: string
  brandName?: string
  brandOwner?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  foodNutrients: UsdaNutrient[]
  /** Standard portions, like "1 item" with its weight; sent for USDA's own (non-branded) foods. */
  foodMeasures?: { disseminationText?: string; gramWeight?: number; rank?: number }[]
}

/** A USDA search result as a Plate food. Values are per 100 g. */
export function fromUsda(f: UsdaFood): Food {
  const byId = new Map<number, number>(f.foodNutrients.map((n) => [n.nutrientId, n.value]))
  const protein = byId.get(1003) ?? 0
  const fat = byId.get(1004) ?? 0
  const carbs = byId.get(1005) ?? 0
  const kcal = byId.get(1008) ?? byId.get(2047) ?? byId.get(2048) ?? protein * 4 + carbs * 4 + fat * 9
  const servings: Serving[] = []
  if (f.servingSize && /^(g|grm|ml|mlt)$/i.test(f.servingSizeUnit ?? '')) {
    const label = f.householdServingFullText ? `1 serving (${f.householdServingFullText.toLowerCase()})` : '1 serving'
    servings.push({ label, grams: round1(f.servingSize) })
  }
  // Portions like "1 item" make a Big Mac one tap instead of a guess in grams.
  const measures = (f.foodMeasures ?? [])
    .filter((m) => (m.gramWeight ?? 0) > 0 && m.disseminationText && !/quantity not specified/i.test(m.disseminationText))
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
  for (const m of measures.slice(0, 4)) {
    const label = m.disseminationText!.trim().toLowerCase()
    if (!servings.some((s) => s.label === label)) servings.push({ label, grams: round1(m.gramWeight!) })
  }
  const chain = splitChain(f.description)
  return {
    id: `usda-${f.fdcId}`,
    name: chain?.name ?? titleCase(f.description),
    brand: chain?.brand ?? (f.brandName ? titleCase(f.brandName) : f.brandOwner ? titleCase(f.brandOwner) : undefined),
    ...(chain ? { category: FAST_FOOD, dataNote: { kind: 'official' as const, text: USDA_CHAIN_NOTE } } : {}),
    per100: {
      kcal: Math.round(kcal),
      protein: round1(protein),
      carbs: round1(carbs),
      fat: round1(fat),
      fiber: byId.has(1079) ? round1(byId.get(1079)!) : undefined,
      sugar: byId.has(2000) ? round1(byId.get(2000)!) : undefined,
    },
    servings,
    source: 'usda',
  }
}

function titleCase(s: string) {
  if (s !== s.toUpperCase()) return s
  return s.toLowerCase().replace(/(^|[\s,(/-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())
}
