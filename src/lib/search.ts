import type { Food } from './types'
import { kaName } from './i18n'

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ა-ჿЀ-ӿ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Spellings people type for the same food, in Latin letters and Georgian.
const SPELLINGS = [
  ['shawarma', 'shaurma', 'shaverma', 'shawerma', 'shwarma', 'shoarma', 'შაურმა', 'შავერმა'],
  ['doner', 'donner', 'dener', 'დონერი'],
  ['khachapuri', 'xachapuri', 'hachapuri', 'khachapur'],
  ['khinkali', 'xinkali', 'hinkali', 'chinkali'],
  ['mtsvadi', 'mcvadi', 'mwvadi'],
  ['fries', 'chips', 'kartofili', 'ფრი'],
].map((group) => group.map(normalize))

/** The query word and the other spellings of it; partly typed words count from four letters. */
function spellings(word: string): string[] {
  const group = SPELLINGS.find((g) => g.includes(word) || (word.length >= 4 && g.some((s) => s.startsWith(word) || word.startsWith(s))))
  return group ? [word, ...group] : [word]
}

/** Every word of the query (or another spelling of it) must appear in the food's name, brand, category or aliases. */
export function searchFoods(foods: Food[], query: string, limit = 40): Food[] {
  const q = normalize(query)
  if (!q) return []
  const words = q.split(/\s+/).map(spellings)
  const scored: { food: Food; score: number }[] = []
  for (const food of foods) {
    const name = normalize(food.name)
    // Built-in foods can be found by their Georgian name too.
    const hay = `${name} ${normalize(kaName(food.name) ?? '')} ${normalize(food.brand ?? '')} ${normalize(food.category ?? '')} ${normalize(food.aliases ?? '')}`
    if (!words.every((alts) => alts.some((w) => hay.includes(w)))) continue
    let score = 0
    if (name === q) score += 100
    if (name.startsWith(q)) score += 50
    if (name.split(' ').some((part) => words[0].some((w) => part.startsWith(w)))) score += 20
    if (food.brand && words.some((alts) => alts.some((w) => normalize(`${food.brand} ${food.aliases ?? ''}`).includes(w)))) score += 30
    if (normalize(kaName(food.name) ?? '').startsWith(q)) score += 50
    if (food.source === 'custom' || food.source === 'recipe') score += 15
    score -= name.length / 10
    scored.push({ food, score })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.food)
}
