import { t } from './i18n'
import type { Food, Nutrients, Serving } from './types'

const round1 = (n: number) => Math.round(n * 10) / 10

/** Looks up a packaged product by barcode in Open Food Facts. Returns null if not found. */
export async function lookupBarcode(code: string): Promise<Food | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_en,brands,nutriments,serving_quantity,serving_size,quantity`
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
  }
}

interface UsdaNutrient {
  nutrientId: number
  value: number
}

/** Searches USDA FoodData Central. Values in search results are per 100 g. */
export async function searchUsda(query: string, apiKey: string): Promise<Food[]> {
  const params = new URLSearchParams({
    query,
    pageSize: '25',
    dataType: 'Foundation,SR Legacy,Branded',
    api_key: apiKey || 'DEMO_KEY',
  })
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?${params}`)
  if (res.status === 429)
    throw new Error(t('The free shared USDA key hit its hourly limit. Add your own free key in Me → Online food search.'))
  if (!res.ok) throw new Error(t('USDA search answered {s}.', { s: res.status }))
  const data = await res.json()
  const foods: Food[] = []
  for (const f of data.foods ?? []) {
    const byId = new Map<number, number>((f.foodNutrients as UsdaNutrient[]).map((n) => [n.nutrientId, n.value]))
    const protein = byId.get(1003) ?? 0
    const fat = byId.get(1004) ?? 0
    const carbs = byId.get(1005) ?? 0
    const kcal = byId.get(1008) ?? byId.get(2047) ?? byId.get(2048) ?? protein * 4 + carbs * 4 + fat * 9
    const servings: Serving[] = []
    if (f.servingSize && /^(g|grm|ml|mlt)$/i.test(f.servingSizeUnit ?? '')) {
      const label = f.householdServingFullText ? `1 serving (${f.householdServingFullText.toLowerCase()})` : '1 serving'
      servings.push({ label, grams: round1(f.servingSize) })
    }
    foods.push({
      id: `usda-${f.fdcId}`,
      name: titleCase(f.description),
      brand: f.brandName ? titleCase(f.brandName) : f.brandOwner ? titleCase(f.brandOwner) : undefined,
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
    })
  }
  return foods
}

function titleCase(s: string) {
  if (s !== s.toUpperCase()) return s
  return s.toLowerCase().replace(/(^|[\s,(/-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())
}
