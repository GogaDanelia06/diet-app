import { addDays, uid } from './date'
import { normalize } from './search'
import type { Meal, MealPlan, PlanDay, PlanItem, PlanMeal, PlanPrefs } from './types'

export const DEFAULT_PLAN_PREFS: PlanPrefs = {
  diet: 'any',
  snacks: 1,
  cooking: 'quick',
  likes: '',
  avoid: '',
  days: 7,
}

/** How the day's calories are shared between meals. */
export function mealSlots(snacks: PlanPrefs['snacks'], targetKcal: number): { meal: Meal; kcal: number }[] {
  const shares: [Meal, number][] =
    snacks === 0
      ? [['breakfast', 0.3], ['lunch', 0.4], ['dinner', 0.3]]
      : snacks === 1
        ? [['breakfast', 0.25], ['lunch', 0.35], ['dinner', 0.3], ['snack', 0.1]]
        : [['breakfast', 0.25], ['lunch', 0.3], ['dinner', 0.25], ['snack', 0.1], ['snack', 0.1]]
  return shares.map(([meal, share]) => ({ meal, kcal: Math.round((targetKcal * share) / 10) * 10 }))
}

export function mealTotals(m: Pick<PlanMeal, 'items'>) {
  return m.items.reduce(
    (t, i) => ({ kcal: t.kcal + i.kcal, protein: t.protein + i.protein, carbs: t.carbs + i.carbs, fat: t.fat + i.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export function dayTotals(d: PlanDay) {
  return mealTotals({ items: d.meals.flatMap((m) => m.items) })
}

function toMeal(value: unknown): Meal {
  const s = String(value ?? '').toLowerCase()
  if (s.includes('break')) return 'breakfast'
  if (s.includes('lunch')) return 'lunch'
  if (s.includes('dinner') || s.includes('supper')) return 'dinner'
  return 'snack'
}

function cleanItem(raw: Partial<PlanItem>): PlanItem {
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0)
  return {
    name: String(raw.name || 'Food'),
    portion: String(raw.portion || ''),
    grams: n(raw.grams) || 100,
    kcal: n(raw.kcal),
    protein: n(raw.protein),
    carbs: n(raw.carbs),
    fat: n(raw.fat),
  }
}

export interface RawPlanMeal {
  meal?: string
  name?: string
  description?: string
  items?: Partial<PlanItem>[]
}

export function cleanPlanMeal(raw: RawPlanMeal, fallbackMeal?: Meal): PlanMeal {
  return {
    id: uid(),
    meal: raw.meal ? toMeal(raw.meal) : (fallbackMeal ?? 'snack'),
    name: String(raw.name || 'Meal'),
    description: String(raw.description || ''),
    items: (raw.items ?? []).map(cleanItem),
  }
}

/** Turns the AI's answer into a plan with real dates, starting at startDate. */
export function buildPlan(
  raw: { days?: { meals?: RawPlanMeal[] }[]; tips?: string },
  startDate: string,
  targetKcal: number,
): MealPlan {
  const days = (raw.days ?? [])
    .map((d, i) => ({ date: addDays(startDate, i), meals: (d.meals ?? []).map((m) => cleanPlanMeal(m)) }))
    .filter((d) => d.meals.length > 0)
  if (!days.length) throw new Error('The AI returned an empty plan. Try again.')
  return { createdAt: Date.now(), targetKcal, days, tips: raw.tips, shoppingChecked: [] }
}

/** Everything the plan uses from fromDate on, merged by name, biggest amounts first. */
export function shoppingList(plan: MealPlan, fromDate = ''): { key: string; name: string; grams: number; count: number }[] {
  const map = new Map<string, { key: string; name: string; grams: number; count: number }>()
  for (const day of plan.days) {
    if (day.date < fromDate) continue
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const key = normalize(item.name)
        if (!key || /^water$/.test(key)) continue
        const cur = map.get(key) ?? { key, name: item.name, grams: 0, count: 0 }
        cur.grams += item.grams
        cur.count += 1
        map.set(key, cur)
      }
    }
  }
  return [...map.values()].sort((a, b) => b.grams - a.grams)
}
