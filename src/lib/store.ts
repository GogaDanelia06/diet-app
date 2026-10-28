import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { del, get, set } from 'idb-keyval'
import { dateKey, uid } from './date'
import { caloriePlan, macroTargets, scaleNutrients, sumNutrients, toPer100 } from './calc'
import type { DiaryEntry, ExerciseLog, Food, Meal, Profile, Recipe, Settings, WeightLog } from './types'

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
  addExerciseCalories: true,
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
}

interface Actions {
  setProfile: (p: Profile) => void
  updateSettings: (s: Partial<Settings>) => void
  addEntry: (e: Omit<DiaryEntry, 'id' | 'createdAt'>) => void
  updateEntry: (id: string, e: Partial<DiaryEntry>) => void
  removeEntry: (id: string) => void
  copyMeal: (fromDate: string, meal: Meal, toDate: string) => void
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
}

export const useStore = create<AppData & Actions>()(
  persist(
    (setState) => ({
      ...EMPTY,
      setProfile: (profile) => setState({ profile }),
      updateSettings: (s) => setState((st) => ({ settings: { ...st.settings, ...s } })),
      addEntry: (e) =>
        setState((st) => ({ entries: [...st.entries, { ...e, id: uid(), createdAt: Date.now() }] })),
      updateEntry: (id, e) =>
        setState((st) => ({ entries: st.entries.map((x) => (x.id === id ? { ...x, ...e } : x)) })),
      removeEntry: (id) => setState((st) => ({ entries: st.entries.filter((x) => x.id !== id) })),
      copyMeal: (fromDate, meal, toDate) =>
        setState((st) => {
          const copies = st.entries
            .filter((x) => x.date === fromDate && x.meal === meal)
            .map((x) => ({ ...x, id: uid(), date: toDate, createdAt: Date.now() }))
          return { entries: [...st.entries, ...copies] }
        }),
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
        })),
      resetAll: () => setState(EMPTY),
    }),
    {
      name: 'plate-data',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (st) => {
        const data: AppData = {
          profile: st.profile,
          settings: st.settings,
          entries: st.entries,
          customFoods: st.customFoods,
          recipes: st.recipes,
          favorites: st.favorites,
          weights: st.weights,
          water: st.water,
          exercises: st.exercises,
        }
        return data
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppData>
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } }
      },
    },
  ),
)

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

export function useDay(date: string) {
  const entries = useStore((s) => s.entries)
  const exercises = useStore((s) => s.exercises)
  const dayEntries = entries.filter((e) => e.date === date)
  const dayExercises = exercises.filter((e) => e.date === date)
  return {
    entries: dayEntries,
    exercises: dayExercises,
    totals: sumNutrients(dayEntries.map((e) => e.nutrients)),
    burned: dayExercises.reduce((n, e) => n + e.kcal, 0),
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
  const data: AppData & { exportedAt: string; app: string } = {
    app: 'plate',
    exportedAt: new Date().toISOString(),
    profile: st.profile,
    settings: { ...st.settings, geminiKey: '', usdaKey: '' },
    entries: st.entries,
    customFoods: st.customFoods,
    recipes: st.recipes,
    favorites: st.favorites,
    weights: st.weights,
    water: st.water,
    exercises: st.exercises,
  }
  return JSON.stringify(data)
}

export const today = () => dateKey()
