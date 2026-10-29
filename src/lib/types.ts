export type Sex = 'female' | 'male'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very'
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type MacroPreset = 'balanced' | 'highProtein' | 'lowCarb'

export const MEALS: { id: Meal; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' },
]

/** Nutrition values. For foods these are per 100 g; for diary entries they are totals. */
export interface Nutrients {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  sugar?: number
}

export interface Serving {
  label: string
  grams: number
}

export type FoodSource = 'builtin' | 'custom' | 'recipe' | 'barcode' | 'usda' | 'ai' | 'quick'

export interface Food {
  id: string
  name: string
  brand?: string
  category?: string
  per100: Nutrients
  servings: Serving[]
  source: FoodSource
  barcode?: string
}

export interface DiaryEntry {
  id: string
  date: string // YYYY-MM-DD, local time
  meal: Meal
  name: string
  brand?: string
  grams: number
  amountLabel: string // e.g. "2 × 1 piece (55 g)"
  nutrients: Nutrients // totals for this entry
  food?: Food // snapshot so the entry can be re-scaled or re-added later
  createdAt: number
}

export interface RecipeIngredient {
  food: Food
  grams: number
  amountLabel: string
}

export interface Recipe {
  id: string
  name: string
  portions: number
  ingredients: RecipeIngredient[]
}

export interface Profile {
  sex: Sex
  age: number
  heightCm: number
  startWeightKg: number
  goalWeightKg: number
  activity: Activity
  ratePerWeekKg: number // 0 = maintain
  startDate: string
}

export interface Settings {
  calorieOverride: number | null
  macroPreset: MacroPreset
  waterGoalMl: number
  glassMl: number
  /** Share of exercise calories added back to the day's budget. */
  exerciseEatBack: 0 | 0.5 | 1
  stepGoal: number
  showFasting: boolean
  fastingHours: number
  geminiKey: string
  geminiModel: string
  usdaKey: string
  language: 'en' | 'ka'
}

export interface WeightLog {
  date: string
  kg: number
}

/** One food in an AI estimate or meal plan, with totals for its weight. */
export interface PlanItem {
  name: string
  portion: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface PlanMeal {
  id: string
  meal: Meal
  name: string
  description: string
  items: PlanItem[]
  logged?: boolean
}

export interface PlanDay {
  date: string
  meals: PlanMeal[]
}

export interface MealPlan {
  createdAt: number
  targetKcal: number
  days: PlanDay[]
  tips?: string
  shoppingChecked: string[]
}

export type DietStyle = 'any' | 'vegetarian' | 'pescatarian' | 'vegan'

export interface PlanPrefs {
  diet: DietStyle
  snacks: 0 | 1 | 2
  cooking: 'quick' | 'enjoy'
  likes: string
  avoid: string
  days: 1 | 3 | 7
}

export interface ExerciseLog {
  id: string
  date: string
  name: string
  minutes: number
  kcal: number
  met?: number
  distanceKm?: number
}

/** A day's numbers from a watch (via Apple Health) or typed in from one. */
export interface DeviceDay {
  activeKcal: number
  steps?: number
  source: 'health' | 'manual'
  at: number
}

export interface FastLog {
  start: number
  end: number
  hours: number // goal length
}

export interface FastingState {
  active: { start: number; hours: number } | null
  history: FastLog[]
}

export type BodyPart = 'waist' | 'hips' | 'chest' | 'arm' | 'thigh' | 'neck' | 'bodyFat'

export type BodyLog = { date: string } & Partial<Record<BodyPart, number>>

export interface PhotoMeta {
  id: string
  date: string
}

export interface WeeklyReport {
  id: string
  createdAt: number
  weekEnd: string
  score: number
  headline: string
  summary: string
  wins: string[]
  tips: string[]
  focus: string
}

export interface SavedMeal {
  id: string
  name: string
  items: Pick<DiaryEntry, 'name' | 'brand' | 'grams' | 'amountLabel' | 'nutrients' | 'food'>[]
}
