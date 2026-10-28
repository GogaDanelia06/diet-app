import type { Food } from './types'

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ა-ჿЀ-ӿ ]+/g, ' ')
    .trim()
}

/** Every word of the query must appear in the food's name, brand or category. */
export function searchFoods(foods: Food[], query: string, limit = 40): Food[] {
  const q = normalize(query)
  if (!q) return []
  const words = q.split(/\s+/)
  const scored: { food: Food; score: number }[] = []
  for (const food of foods) {
    const name = normalize(food.name)
    const hay = `${name} ${normalize(food.brand ?? '')} ${normalize(food.category ?? '')}`
    if (!words.every((w) => hay.includes(w))) continue
    let score = 0
    if (name === q) score += 100
    if (name.startsWith(q)) score += 50
    if (name.split(' ').some((part) => part.startsWith(words[0]))) score += 20
    if (food.source === 'custom' || food.source === 'recipe') score += 15
    score -= name.length / 10
    scored.push({ food, score })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.food)
}
