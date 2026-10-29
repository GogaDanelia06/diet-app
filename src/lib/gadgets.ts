import { KCAL_PER_KG_FAT } from './calc'
import { addDays } from './date'
import type { DiaryEntry, Meal, SavedMeal } from './types'

const ORDER: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack']

/** How a day's calories are usually shared between meals. */
export const MEAL_SHARE: Record<Meal, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 }

/** The meal the clock points to. */
export function mealForHour(hour: number): Meal {
  return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 21 ? 'dinner' : 'snack'
}

/**
 * The next meal and a fair share of what is left today: the calories and protein left are
 * split between this meal and the later meals that are still empty, in their usual proportions.
 */
export function nextMealTarget(hour: number, logged: Meal[], left: { kcal: number; protein: number }) {
  let index = ORDER.indexOf(mealForHour(hour))
  while (index < ORDER.length - 1 && logged.includes(ORDER[index])) index++
  const meal = ORDER[index]
  const open = ORDER.slice(index).filter((m) => m === meal || !logged.includes(m))
  const share = MEAL_SHARE[meal] / open.reduce((n, m) => n + MEAL_SHARE[m], 0)
  return {
    meal,
    kcal: Math.max(0, Math.round((left.kcal * share) / 10) * 10),
    protein: Math.max(0, Math.round(left.protein * share)),
  }
}

export interface MealIdea {
  key: string
  /** A saved meal's own name; history ideas are named by their foods. */
  title?: string
  names: string[]
  items: SavedMeal['items']
  kcal: number
  protein: number
}

/** Meals the user saved or ate in the last 60 days that fit the target, closest first. */
export function mealIdeas(
  entries: DiaryEntry[],
  saved: SavedMeal[],
  today: string,
  target: { meal: Meal; kcal: number; protein: number },
  limit = 3,
): MealIdea[] {
  if (target.kcal < 80) return []
  const since = addDays(today, -60)
  const meals = new Map<string, DiaryEntry[]>()
  for (const e of entries) {
    if (e.date >= today || e.date < since) continue
    const key = `${e.date}|${e.meal}`
    meals.set(key, [...(meals.get(key) ?? []), e])
  }
  const seen = new Set<string>()
  const ideas: (MealIdea & { score: number })[] = []
  const consider = (items: SavedMeal['items'], title?: string, meal?: Meal) => {
    const key = items.map((i) => i.name).sort().join(' + ')
    if (!items.length || seen.has(key)) return
    seen.add(key)
    const kcal = items.reduce((n, i) => n + i.nutrients.kcal, 0)
    const protein = items.reduce((n, i) => n + i.nutrients.protein, 0)
    if (kcal > target.kcal * 1.15 || kcal < target.kcal * 0.4) return
    const proteinGap = target.protein > 0 ? Math.max(0, target.protein - protein) / target.protein : 0
    // A breakfast is a poor dinner idea, so ideas from another meal rank lower.
    const score = Math.abs(kcal - target.kcal) / target.kcal + proteinGap * 0.3 + (meal && meal !== target.meal ? 0.4 : 0)
    ideas.push({ key, title, names: items.map((i) => i.name), items, kcal, protein, score })
  }
  for (const s of saved) consider(s.items, s.name)
  // Newest first, so a meal eaten several times keeps its latest portions.
  for (const [key, list] of [...meals].sort((a, b) => b[0].localeCompare(a[0]))) {
    consider(list.map(({ name, brand, grams, amountLabel, nutrients, food }) => ({ name, brand, grams, amountLabel, nutrients, food })), undefined, key.split('|')[1] as Meal)
  }
  return ideas.sort((a, b) => a.score - b.score).slice(0, limit).map(({ score: _score, ...idea }) => idea)
}

/** Kilograms a week that a daily calorie gap is worth. */
export const kgPerWeek = (kcalPerDay: number) => (kcalPerDay * 7) / KCAL_PER_KG_FAT

export type ForecastSource = 'weighIns' | 'logs' | 'plan'

export interface Forecast {
  source: ForecastSource
  kgPerWeek: number
  status: 'reached' | 'onTrack' | 'stalled' | 'far'
  days: number | null
  date: string | null
}

const MAX_FORECAST_DAYS = 3 * 365

/**
 * When the goal weight is reached at the current pace. The pace comes from the weigh-ins when
 * there are enough, else from the calorie gap on logged days, else from the plan.
 * `extraKcal` is a "what if" daily change on top of that pace.
 */
export function goalForecast(i: {
  currentKg: number
  goalKg: number
  today: string
  /** kg a week from the weigh-ins, negative when losing, or null without enough of them. */
  weighRate: number | null
  /** Maintenance + burned − eaten for each fully logged recent day. */
  loggedGaps: number[]
  planRate: number
  extraKcal?: number
}): Forecast {
  const source: ForecastSource = i.weighRate !== null ? 'weighIns' : i.loggedGaps.length >= 3 ? 'logs' : 'plan'
  const base =
    source === 'weighIns' ? -i.weighRate! : source === 'logs' ? kgPerWeek(i.loggedGaps.reduce((n, g) => n + g, 0) / i.loggedGaps.length) : i.planRate
  const rate = base + kgPerWeek(i.extraKcal ?? 0)
  const toLose = i.currentKg - i.goalKg
  if (toLose <= 0) return { source, kgPerWeek: rate, status: 'reached', days: 0, date: i.today }
  if (rate < 0.05) return { source, kgPerWeek: rate, status: 'stalled', days: null, date: null }
  const days = Math.ceil((toLose / rate) * 7)
  if (days > MAX_FORECAST_DAYS) return { source, kgPerWeek: rate, status: 'far', days: null, date: null }
  return { source, kgPerWeek: rate, status: 'onTrack', days, date: addDays(i.today, days) }
}

export const GARDEN_DAYS = 28
/** How far back a streak is counted, so rewards beyond the 28 days on show can be earned. */
export const STREAK_HISTORY_DAYS = 60
export const VEG_KINDS = 6

/** veg: a full day within budget · sprout: a light day · wilt: over budget · growing: today. */
export type PlotState = 'veg' | 'sprout' | 'wilt' | 'empty' | 'growing'

export interface Plot {
  date: string
  state: PlotState
  /** Which vegetable grows here, the same for a date on every visit. */
  kind: number
  /** Share of the day's budget eaten, 0–1. */
  progress: number
}

export function gardenPlots(days: { date: string; kcal: number; budget: number; logged: boolean }[], today: string): Plot[] {
  return days.map((d) => {
    const ratio = d.budget > 0 ? d.kcal / d.budget : 0
    const state: PlotState = d.logged && ratio > 1 ? 'wilt' : d.date === today ? 'growing' : !d.logged ? 'empty' : ratio >= 0.5 ? 'veg' : 'sprout'
    const hash = [...d.date].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 9973, 7)
    return { date: d.date, state, kind: hash % VEG_KINDS, progress: Math.min(1, ratio) }
  })
}

/** Vegetables grown in a row up to the newest finished day; today doesn't break it. */
export function gardenStreak(plots: Plot[]) {
  let n = 0
  for (let i = plots.length - 1; i >= 0; i--) {
    if (plots[i].state === 'growing' && i === plots.length - 1) continue
    if (plots[i].state !== 'veg') break
    n++
  }
  return n
}

/** What a garden streak unlocks, in order. */
export const GARDEN_REWARDS = [
  { days: 3, icon: '🦋', label: 'Butterflies' },
  { days: 7, icon: '🌸', label: 'Flowers' },
  { days: 14, icon: '🌟', label: 'Golden veggie' },
  { days: 30, icon: '🌾', label: 'Scarecrow' },
] as const

/** The next reward still to earn and the days left until it, or null when all are unlocked. */
export function nextGardenReward(streak: number) {
  const next = GARDEN_REWARDS.find((r) => r.days > streak)
  return next ? { ...next, daysLeft: next.days - streak } : null
}

/** Calories eaten on each day that has any food logged. */
export function dailyKcal(entries: DiaryEntry[]) {
  const days = new Map<string, number>()
  for (const e of entries) days.set(e.date, (days.get(e.date) ?? 0) + e.nutrients.kcal)
  return days
}
