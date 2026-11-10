import { addDays } from './date'
import { kaName } from './i18n'
import { normalize } from './search'
import { MEALS, type DiaryEntry, type Meal } from './types'

export interface PastMeal {
  date: string
  meal: Meal
  entries: DiaryEntry[]
  kcal: number
}

/**
 * Meals logged in the `days` days up to `date`, newest first, to copy into `meal` on `date`:
 * that day's other meals, then the days before. A search keeps the meals with a matching food.
 */
export function pastMeals(entries: DiaryEntry[], date: string, meal: Meal, days = 14, query = ''): PastMeal[] {
  const from = addDays(date, -days)
  const words = normalize(query).split(' ').filter(Boolean)
  const matches = (e: DiaryEntry) => {
    const hay = `${normalize(e.name)} ${normalize(kaName(e.name) ?? '')} ${normalize(e.brand ?? '')}`
    return words.every((w) => hay.includes(w))
  }
  const out: PastMeal[] = []
  for (let d = date; d >= from; d = addDays(d, -1)) {
    for (const m of MEALS) {
      if (d === date && m.id === meal) continue
      const items = entries.filter((e) => e.date === d && e.meal === m.id)
      if (!items.length || (words.length && !items.some(matches))) continue
      out.push({ date: d, meal: m.id, entries: items, kcal: items.reduce((n, e) => n + e.nutrients.kcal, 0) })
    }
  }
  return out
}
