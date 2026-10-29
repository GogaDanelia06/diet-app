import { addDays } from './date'
import { hoursBetween, logStreak } from './insights'
import type { AppData } from './store'

export interface Achievement {
  id: string
  icon: string
  title: string
  description: string
}

/** Everything a badge might need, worked out once per check. */
export interface Facts {
  loggedDays: Set<string>
  longestStreak: number
  kgLost: number
  goalReached: boolean
  proteinDays: number
  onTargetDays: number
  waterDays: number
  workouts: number
  maxSteps: number
  fastsReached: number
  barcodeFoods: number
  georgianFoods: number
  hasPlan: boolean
  recipes: number
  photos: number
}

export const ACHIEVEMENTS: (Achievement & { earned: (f: Facts) => boolean })[] = [
  { id: 'first-bite', icon: '🍽️', title: 'First bite', description: 'Log your first food.', earned: (f) => f.loggedDays.size >= 1 },
  { id: 'streak-3', icon: '🔥', title: 'Warming up', description: 'Log food 3 days in a row.', earned: (f) => f.longestStreak >= 3 },
  { id: 'streak-7', icon: '⚡', title: 'One week strong', description: 'Log food 7 days in a row.', earned: (f) => f.longestStreak >= 7 },
  { id: 'streak-30', icon: '🏆', title: 'Habit made', description: 'Log food 30 days in a row.', earned: (f) => f.longestStreak >= 30 },
  { id: 'kg-1', icon: '⚖️', title: 'First kilo', description: 'Lose your first kilogram.', earned: (f) => f.kgLost >= 1 },
  { id: 'kg-5', icon: '💪', title: 'Five down', description: 'Lose 5 kg.', earned: (f) => f.kgLost >= 5 },
  { id: 'kg-10', icon: '🚀', title: 'Ten down', description: 'Lose 10 kg.', earned: (f) => f.kgLost >= 10 },
  { id: 'goal', icon: '👑', title: 'Goal reached', description: 'Reach your goal weight.', earned: (f) => f.goalReached },
  { id: 'protein', icon: '🥚', title: 'Protein pro', description: 'Hit your protein target in a day.', earned: (f) => f.proteinDays >= 1 },
  { id: 'on-target-7', icon: '🎯', title: 'Bullseye week', description: 'Stay within your calories on 7 days.', earned: (f) => f.onTargetDays >= 7 },
  { id: 'water', icon: '💧', title: 'Hydrated', description: 'Drink your daily water goal.', earned: (f) => f.waterDays >= 1 },
  { id: 'workout-1', icon: '🏃', title: 'First workout', description: 'Log your first exercise.', earned: (f) => f.workouts >= 1 },
  { id: 'workout-10', icon: '🏋️', title: 'Ten workouts', description: 'Log 10 workouts.', earned: (f) => f.workouts >= 10 },
  { id: 'steps-10k', icon: '👟', title: '10K steps', description: 'Walk 10,000 steps in a day.', earned: (f) => f.maxSteps >= 10000 },
  { id: 'fast-1', icon: '⏳', title: 'First fast', description: 'Finish a fast that reaches its goal.', earned: (f) => f.fastsReached >= 1 },
  { id: 'fast-10', icon: '🧘', title: 'Fasting regular', description: 'Reach your fasting goal 10 times.', earned: (f) => f.fastsReached >= 10 },
  { id: 'scanner', icon: '📷', title: 'Scanner', description: 'Log a packaged food by its barcode.', earned: (f) => f.barcodeFoods >= 1 },
  { id: 'supra', icon: '🍷', title: 'Supra!', description: 'Log a Georgian dish.', earned: (f) => f.georgianFoods >= 1 },
  { id: 'planner', icon: '🤖', title: 'Planned ahead', description: 'Make an AI meal plan.', earned: (f) => f.hasPlan },
  { id: 'cook', icon: '👩‍🍳', title: 'Home cook', description: 'Create your own recipe.', earned: (f) => f.recipes >= 1 },
  { id: 'photo', icon: '📸', title: 'Before & after', description: 'Add a progress photo.', earned: (f) => f.photos >= 1 },
]

function longestStreak(days: Set<string>) {
  let best = 0
  for (const d of days) {
    if (days.has(addDays(d, -1))) continue // only count from the start of each run
    let n = 0
    let cur = d
    while (days.has(cur)) {
      n++
      cur = addDays(cur, 1)
    }
    best = Math.max(best, n)
  }
  return best
}

export function gatherFacts(st: AppData, targets: { kcal: number; protein: number }, today: string): Facts {
  const loggedDays = new Set(st.entries.map((e) => e.date))
  const byDay = new Map<string, { kcal: number; protein: number }>()
  for (const e of st.entries) {
    const d = byDay.get(e.date) ?? { kcal: 0, protein: 0 }
    d.kcal += e.nutrients.kcal
    d.protein += e.nutrients.protein
    byDay.set(e.date, d)
  }
  const days = [...byDay.values()]
  const start = st.profile?.startWeightKg ?? 0
  const latest = st.weights.at(-1)?.kg ?? start
  const losing = !!st.profile && st.profile.goalWeightKg < start
  return {
    loggedDays,
    longestStreak: Math.max(longestStreak(loggedDays), logStreak(st.entries, today)),
    kgLost: start - latest,
    goalReached: losing && st.weights.length > 0 && latest <= st.profile!.goalWeightKg,
    proteinDays: days.filter((d) => d.protein >= targets.protein).length,
    // A full day of eating that stayed within the budget (not a half-logged day).
    onTargetDays: days.filter((d) => d.kcal >= targets.kcal * 0.6 && d.kcal <= targets.kcal * 1.05).length,
    waterDays: Object.values(st.water).filter((ml) => ml >= st.settings.waterGoalMl).length,
    workouts: st.exercises.length,
    maxSteps: Math.max(0, ...Object.values(st.steps), ...Object.values(st.deviceActivity).map((d) => d.steps ?? 0)),
    fastsReached: st.fasting.history.filter((f) => hoursBetween(f.start, f.end) >= f.hours).length,
    barcodeFoods: st.entries.filter((e) => e.food?.source === 'barcode').length,
    georgianFoods: st.entries.filter((e) => e.food?.category === 'Georgian dishes').length,
    hasPlan: !!st.mealPlan,
    recipes: st.recipes.length,
    photos: st.photos.length,
  }
}

/** Ids of badges earned by this data that aren't unlocked yet. */
export function newlyEarned(st: AppData, targets: { kcal: number; protein: number }, today: string) {
  const facts = gatherFacts(st, targets, today)
  return ACHIEVEMENTS.filter((a) => !st.achievements[a.id] && a.earned(facts)).map((a) => a.id)
}
