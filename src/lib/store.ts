import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { del, get, set } from 'idb-keyval'
import { dateKey, uid } from './date'
import { caloriePlan, macroTargets, scaleNutrients, sumNutrients, toPer100 } from './calc'
import { aiItemToFood } from './ai'
import { DEFAULT_PLAN_PREFS } from './plan'
import { stepsKcal } from './exercises'
import { baselineActiveKcal } from './health'
import { defaultDashboard, discardLegacyDashboardStorage, normalizeDashboard } from './dashboard'
import type {
  BodyLog,
  DashboardHabit,
  DashboardState,
  DashboardWidget,
  DeviceDay,
  DiaryEntry,
  ExerciseLog,
  FastingState,
  Food,
  Meal,
  MealPlan,
  PhotoMeta,
  PlanMeal,
  PlanPrefs,
  Profile,
  Recipe,
  SavedMeal,
  Settings,
  WeeklyReport,
  WeightLog,
} from './types'

const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: (name, value) => set(name, value),
  removeItem: (name) => del(name),
}

export const DEFAULT_SETTINGS: Settings = {
  calorieOverride: null,
  macroPreset: 'balanced',
  waterGoalMl: 2000,
  glassMl: 250,
  exerciseEatBack: 1,
  stepGoal: 8000,
  showFasting: true,
  fastingHours: 16,
  language: 'en',
  geminiKey: '',
  geminiModel: 'gemini-3.8-flash',
  usdaKey: '',
}

export interface AppData {
  profile: Profile | null
  settings: Settings
  entries: DiaryEntry[]
  customFoods: Food[]
  recipes: Recipe[]
  favorites: Food[]
  weights: WeightLog[]
  water: Record<string, number>
  exercises: ExerciseLog[]
  planPrefs: PlanPrefs
  mealPlan: MealPlan | null
  steps: Record<string, number>
  fasting: FastingState
  measurements: BodyLog[]
  photos: PhotoMeta[]
  savedMeals: SavedMeal[]
  /** Achievement id → when it was unlocked. */
  achievements: Record<string, number>
  reports: WeeklyReport[]
  /** Watch data per date (Apple Watch / WHOOP through Apple Health). */
  deviceActivity: Record<string, DeviceDay>
  /** Dashboard layout and optional daily check-ins, included in backups and reset. */
  dashboard: DashboardState
}

const DATA_KEYS = [
  'profile', 'settings', 'entries', 'customFoods', 'recipes', 'favorites', 'weights', 'water', 'exercises',
  'planPrefs', 'mealPlan', 'steps', 'fasting', 'measurements', 'photos', 'savedMeals', 'achievements', 'reports', 'deviceActivity', 'dashboard',
] as const satisfies readonly (keyof AppData)[]

function pickData(st: AppData): AppData {
  return Object.fromEntries(DATA_KEYS.map((k) => [k, st[k]])) as unknown as AppData
}

interface Actions {
  setProfile: (p: Profile) => void
  updateSettings: (s: Partial<Settings>) => void
  addEntry: (e: Omit<DiaryEntry, 'id' | 'createdAt'>) => void
  updateEntry: (id: string, e: Partial<DiaryEntry>) => void
  removeEntry: (id: string) => void
  copyMeal: (fromDate: string, meal: Meal, toDate: string) => void
  /** Sets (or with '' clears) the time a meal was eaten on a day. */
  setMealTime: (date: string, meal: Meal, time: string) => void
  saveCustomFood: (f: Food) => void
  removeCustomFood: (id: string) => void
  saveRecipe: (r: Recipe) => void
  removeRecipe: (id: string) => void
  toggleFavorite: (food: Food) => void
  logWeight: (date: string, kg: number) => void
  removeWeight: (date: string) => void
  addWater: (date: string, ml: number) => void
  addExercise: (e: Omit<ExerciseLog, 'id'>) => void
  removeExercise: (id: string) => void
  setPlanPrefs: (p: Partial<PlanPrefs>) => void
  setMealPlan: (plan: MealPlan | null) => void
  replacePlanMeal: (date: string, mealId: string, meal: PlanMeal) => void
  logPlanMeal: (date: string, mealId: string) => void
  toggleShoppingItem: (key: string) => void
  setSteps: (date: string, steps: number) => void
  startFast: (hours: number, start?: number) => void
  endFast: () => void
  cancelFast: () => void
  removeFast: (start: number) => void
  logMeasurements: (log: BodyLog) => void
  removeMeasurements: (date: string) => void
  addPhoto: (meta: PhotoMeta, dataUrl: string) => Promise<void>
  removePhoto: (id: string) => void
  saveMeal: (name: string, entries: DiaryEntry[]) => void
  removeSavedMeal: (id: string) => void
  logSavedMeal: (id: string, date: string, meal: Meal) => void
  unlockAchievements: (ids: string[]) => void
  addReport: (r: WeeklyReport) => void
  setDeviceDay: (date: string, day: DeviceDay | null) => void
  toggleDashboardWidget: (widget: DashboardWidget) => void
  toggleDashboardHabit: (date: string, habit: DashboardHabit) => void
  importData: (data: Partial<AppData>) => void
  resetAll: () => void
}

const EMPTY: AppData = {
  profile: null,
  settings: DEFAULT_SETTINGS,
  entries: [],
  customFoods: [],
  recipes: [],
  favorites: [],
  weights: [],
  water: {},
  exercises: [],
  planPrefs: DEFAULT_PLAN_PREFS,
  mealPlan: null,
  steps: {},
  fasting: { active: null, history: [] },
  measurements: [],
  photos: [],
  savedMeals: [],
  achievements: {},
  reports: [],
  deviceActivity: {},
  dashboard: defaultDashboard(),
}

discardLegacyDashboardStorage()

/** Progress photos are kept as separate records so the main data stays small. */
export const photoKey = (id: string) => `plate-photo-${id}`
export const loadPhoto = (id: string) => get<string>(photoKey(id))

function mapPlanMeal(plan: MealPlan, date: string, mealId: string, fn: (m: PlanMeal) => PlanMeal): MealPlan {
  return {
    ...plan,
    days: plan.days.map((d) => (d.date !== date ? d : { ...d, meals: d.meals.map((m) => (m.id === mealId ? fn(m) : m)) })),
  }
}

export const useStore = create<AppData & Actions>()(
  persist(
    (setState) => ({
      ...EMPTY,
      setProfile: (profile) => setState({ profile }),
      updateSettings: (s) => setState((st) => ({ settings: { ...st.settings, ...s } })),
      addEntry: (e) =>
        setState((st) => ({ entries: [...st.entries, { ...e, time: e.time ?? mealTime(st.entries, e.date, e.meal), id: uid(), createdAt: Date.now() }] })),
      updateEntry: (id, e) =>
        setState((st) => ({
          entries: st.entries.map((x) => {
            if (x.id !== id) return x
            const next = { ...x, ...e }
            // Moved to another meal: it was eaten with that meal.
            if (e.meal && e.meal !== x.meal) next.time = mealTime(st.entries, next.date, next.meal)
            return next
          }),
        })),
      removeEntry: (id) => setState((st) => ({ entries: st.entries.filter((x) => x.id !== id) })),
      copyMeal: (fromDate, meal, toDate) =>
        setState((st) => {
          const copies = st.entries
            .filter((x) => x.date === fromDate && x.meal === meal)
            .map((x) => ({ ...x, id: uid(), date: toDate, time: mealTime(st.entries, toDate, meal), createdAt: Date.now() }))
          return { entries: [...st.entries, ...copies] }
        }),
      setMealTime: (date, meal, time) =>
        setState((st) => ({
          entries: st.entries.map((x) => (x.date === date && x.meal === meal ? { ...x, time: /^\d{2}:\d{2}$/.test(time) ? time : undefined } : x)),
        })),
      saveCustomFood: (f) =>
        setState((st) => ({ customFoods: [f, ...st.customFoods.filter((x) => x.id !== f.id)] })),
      removeCustomFood: (id) => setState((st) => ({ customFoods: st.customFoods.filter((x) => x.id !== id) })),
      saveRecipe: (r) => setState((st) => ({ recipes: [r, ...st.recipes.filter((x) => x.id !== r.id)] })),
      removeRecipe: (id) => setState((st) => ({ recipes: st.recipes.filter((x) => x.id !== id) })),
      toggleFavorite: (food) =>
        setState((st) => ({
          favorites: st.favorites.some((x) => x.id === food.id)
            ? st.favorites.filter((x) => x.id !== food.id)
            : [food, ...st.favorites],
        })),
      logWeight: (date, kg) =>
        setState((st) => ({
          weights: [...st.weights.filter((w) => w.date !== date), { date, kg }].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        })),
      removeWeight: (date) => setState((st) => ({ weights: st.weights.filter((w) => w.date !== date) })),
      addWater: (date, ml) =>
        setState((st) => ({ water: { ...st.water, [date]: Math.max(0, (st.water[date] ?? 0) + ml) } })),
      addExercise: (e) => setState((st) => ({ exercises: [...st.exercises, { ...e, id: uid() }] })),
      removeExercise: (id) => setState((st) => ({ exercises: st.exercises.filter((x) => x.id !== id) })),
      setPlanPrefs: (p) => setState((st) => ({ planPrefs: { ...st.planPrefs, ...p } })),
      setMealPlan: (mealPlan) => setState({ mealPlan }),
      replacePlanMeal: (date, mealId, meal) =>
        setState((st) => (st.mealPlan ? { mealPlan: mapPlanMeal(st.mealPlan, date, mealId, () => meal) } : {})),
      logPlanMeal: (date, mealId) =>
        setState((st) => {
          const planMeal = st.mealPlan?.days.find((d) => d.date === date)?.meals.find((m) => m.id === mealId)
          if (!st.mealPlan || !planMeal) return {}
          const added: DiaryEntry[] = planMeal.items.map((item) => ({
            id: uid(),
            createdAt: Date.now(),
            date,
            meal: planMeal.meal,
            name: item.name,
            grams: item.grams,
            amountLabel: item.portion ? `${item.portion} (${Math.round(item.grams)} g)` : `${Math.round(item.grams)} g`,
            nutrients: { kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat },
            food: aiItemToFood(item),
            time: mealTime(st.entries, date, planMeal.meal),
          }))
          return {
            entries: [...st.entries, ...added],
            mealPlan: mapPlanMeal(st.mealPlan, date, mealId, (m) => ({ ...m, logged: true })),
          }
        }),
      toggleShoppingItem: (key) =>
        setState((st) =>
          st.mealPlan
            ? {
                mealPlan: {
                  ...st.mealPlan,
                  shoppingChecked: st.mealPlan.shoppingChecked.includes(key)
                    ? st.mealPlan.shoppingChecked.filter((k) => k !== key)
                    : [...st.mealPlan.shoppingChecked, key],
                },
              }
            : {},
        ),
      setSteps: (date, steps) => setState((st) => ({ steps: { ...st.steps, [date]: Math.max(0, Math.round(steps)) } })),
      startFast: (hours, start = Date.now()) => setState((st) => ({ fasting: { ...st.fasting, active: { start, hours } } })),
      endFast: () =>
        setState((st) => {
          const a = st.fasting.active
          if (!a) return {}
          // A fast ended within 15 minutes was most likely started by mistake.
          if (Date.now() - a.start < 15 * 60_000) return { fasting: { ...st.fasting, active: null } }
          return { fasting: { active: null, history: [{ start: a.start, end: Date.now(), hours: a.hours }, ...st.fasting.history].slice(0, 200) } }
        }),
      cancelFast: () => setState((st) => ({ fasting: { ...st.fasting, active: null } })),
      removeFast: (start) =>
        setState((st) => ({ fasting: { ...st.fasting, history: st.fasting.history.filter((f) => f.start !== start) } })),
      logMeasurements: (log) =>
        setState((st) => ({
          measurements: [...st.measurements.filter((m) => m.date !== log.date), log].sort((a, b) => a.date.localeCompare(b.date)),
        })),
      removeMeasurements: (date) => setState((st) => ({ measurements: st.measurements.filter((m) => m.date !== date) })),
      addPhoto: async (meta, dataUrl) => {
        await set(photoKey(meta.id), dataUrl)
        setState((st) => ({ photos: [...st.photos, meta].sort((a, b) => a.date.localeCompare(b.date)) }))
      },
      removePhoto: (id) => {
        del(photoKey(id)).catch(() => {})
        setState((st) => ({ photos: st.photos.filter((p) => p.id !== id) }))
      },
      saveMeal: (name, entries) =>
        setState((st) => ({
          savedMeals: [
            {
              id: `m-${uid()}`,
              name,
              items: entries.map(({ name, brand, grams, amountLabel, nutrients, food }) => ({ name, brand, grams, amountLabel, nutrients, food })),
            },
            ...st.savedMeals,
          ],
        })),
      removeSavedMeal: (id) => setState((st) => ({ savedMeals: st.savedMeals.filter((m) => m.id !== id) })),
      logSavedMeal: (id, date, meal) =>
        setState((st) => {
          const saved = st.savedMeals.find((m) => m.id === id)
          if (!saved) return {}
          const added = saved.items.map((i) => ({ ...i, id: uid(), date, meal, time: mealTime(st.entries, date, meal), createdAt: Date.now() }))
          return { entries: [...st.entries, ...added] }
        }),
      unlockAchievements: (ids) =>
        setState((st) => ({ achievements: { ...st.achievements, ...Object.fromEntries(ids.map((id) => [id, Date.now()])) } })),
      addReport: (r) => setState((st) => ({ reports: [r, ...st.reports].slice(0, 26) })),
      setDeviceDay: (date, day) =>
        setState((st) => {
          const next = { ...st.deviceActivity }
          if (day) next[date] = day
          else delete next[date]
          return { deviceActivity: next }
        }),
      toggleDashboardWidget: (widget) =>
        setState((st) => ({ dashboard: {
          ...st.dashboard,
          visible: { ...st.dashboard.visible, [widget]: !st.dashboard.visible[widget] },
        } })),
      toggleDashboardHabit: (date, habit) =>
        setState((st) => {
          const checked = st.dashboard.habits[date] ?? []
          return { dashboard: {
            ...st.dashboard,
            habits: { ...st.dashboard.habits, [date]: checked.includes(habit) ? checked.filter((item) => item !== habit) : [...checked, habit] },
          } }
        }),
      importData: (data) =>
        setState((st) => ({
          ...EMPTY,
          ...data,
          // Backups leave API keys out, so keep the ones already on this phone.
          settings: {
            ...DEFAULT_SETTINGS,
            ...data.settings,
            geminiKey: data.settings?.geminiKey || st.settings.geminiKey,
            usdaKey: data.settings?.usdaKey || st.settings.usdaKey,
          },
          planPrefs: { ...DEFAULT_PLAN_PREFS, ...data.planPrefs },
          dashboard: normalizeDashboard(data.dashboard),
          // Photos aren't in backups; keep the ones on this phone.
          photos: st.photos,
        })),
      resetAll: () => {
        discardLegacyDashboardStorage()
        setState({ ...EMPTY, dashboard: defaultDashboard() })
      },
    }),
    {
      name: 'plate-data',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (st) => pickData(st),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppData>
        const old = p.settings as (Partial<Settings> & { addExerciseCalories?: boolean }) | undefined
        const { addExerciseCalories, ...settings } = old ?? {}
        return {
          ...current,
          ...p,
          // Version 1 had an on/off switch for adding exercise calories back.
          settings: { ...DEFAULT_SETTINGS, ...(addExerciseCalories === false ? { exerciseEatBack: 0 as const } : {}), ...settings },
          planPrefs: { ...DEFAULT_PLAN_PREFS, ...p.planPrefs },
          dashboard: normalizeDashboard(p.dashboard),
        }
      },
    },
  ),
)

/** When a meal on a day was eaten, if a time was set for it. */
export function mealTime(entries: DiaryEntry[], date: string, meal: Meal) {
  return entries.find((e) => e.date === date && e.meal === meal && e.time)?.time
}

/** Latest logged weight, falling back to the starting weight. */
export function currentWeight(st: Pick<AppData, 'weights' | 'profile'>) {
  return st.weights.at(-1)?.kg ?? st.profile?.startWeightKg ?? 70
}

export function useTargets() {
  const profile = useStore((s) => s.profile)
  const settings = useStore((s) => s.settings)
  const weights = useStore((s) => s.weights)
  if (!profile) return null
  const plan = caloriePlan(profile, currentWeight({ profile, weights }))
  const kcal = settings.calorieOverride ?? plan.target
  return { plan, kcal, ...macroTargets(kcal, settings.macroPreset) }
}

/**
 * Calories burned on a day, counted above an ordinary day so nothing is double-counted.
 * With watch data, the watch's active calories (minus what the activity level already
 * covers) replace logged workouts and typed-in steps, which the watch includes anyway.
 */
export function dayBurn(st: Pick<AppData, 'exercises' | 'steps' | 'deviceActivity' | 'profile' | 'weights'>, date: string) {
  const exercises = st.exercises.filter((e) => e.date === date)
  const device = st.deviceActivity[date]
  const steps = device?.steps ?? st.steps[date] ?? 0
  const weight = currentWeight(st)
  if (device && st.profile) {
    const baseline = baselineActiveKcal(st.profile, weight)
    return { exercises, steps, fromSteps: 0, device, baseline, burned: Math.max(0, device.activeKcal - baseline) }
  }
  const fromSteps = st.profile ? stepsKcal(steps, weight, st.profile.activity) : 0
  return { exercises, steps, fromSteps, device: undefined, baseline: 0, burned: exercises.reduce((n, e) => n + e.kcal, 0) + fromSteps }
}

export function useDay(date: string) {
  const entries = useStore((s) => s.entries)
  const exercises = useStore((s) => s.exercises)
  const steps = useStore((s) => s.steps)
  const deviceActivity = useStore((s) => s.deviceActivity)
  const profile = useStore((s) => s.profile)
  const weights = useStore((s) => s.weights)
  const eatBack = useStore((s) => s.settings.exerciseEatBack)
  const dayEntries = entries.filter((e) => e.date === date)
  const burn = dayBurn({ exercises, steps, deviceActivity, profile, weights }, date)
  return {
    ...burn,
    entries: dayEntries,
    totals: sumNutrients(dayEntries.map((e) => e.nutrients)),
    /** Exercise calories added to today's budget. */
    bonus: Math.round(burn.burned * eatBack),
  }
}

/** Turns a recipe into a food whose servings are portions of the finished dish. */
export function recipeToFood(r: Recipe): Food {
  const totalGrams = r.ingredients.reduce((n, i) => n + i.grams, 0)
  const totals = sumNutrients(r.ingredients.map((i) => scaleNutrients(i.food.per100, i.grams)))
  const portion = r.portions > 0 ? totalGrams / r.portions : totalGrams
  return {
    id: r.id,
    name: r.name,
    category: 'My recipes',
    per100: toPer100(totals, totalGrams),
    servings: [
      { label: '1 portion', grams: Math.round(portion) },
      { label: 'whole recipe', grams: Math.round(totalGrams) },
    ],
    source: 'recipe',
  }
}

/** Foods logged most recently, newest first, without duplicates. */
export function recentFoods(entries: DiaryEntry[], limit = 25): Food[] {
  const seen = new Set<string>()
  const out: Food[] = []
  for (let i = entries.length - 1; i >= 0 && out.length < limit; i--) {
    const f = entries[i].food
    if (!f || seen.has(f.id)) continue
    seen.add(f.id)
    out.push(f)
  }
  return out
}

export function exportData(): string {
  const st = useStore.getState()
  return JSON.stringify({
    app: 'plate',
    exportedAt: new Date().toISOString(),
    ...pickData(st),
    settings: { ...st.settings, geminiKey: '', usdaKey: '' },
  })
}

export const today = () => dateKey()
