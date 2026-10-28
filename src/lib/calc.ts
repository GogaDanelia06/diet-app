import type { Activity, MacroPreset, Nutrients, Profile, Sex } from './types'

export const KCAL_PER_KG_FAT = 7700

export const ACTIVITY: Record<Activity, { label: string; detail: string; factor: number }> = {
  sedentary: { label: 'Mostly sitting', detail: 'Desk job, little walking', factor: 1.2 },
  light: { label: 'Lightly active', detail: 'Walking or light exercise 1–3 days a week', factor: 1.375 },
  moderate: { label: 'Active', detail: 'Exercise 3–5 days a week', factor: 1.55 },
  active: { label: 'Very active', detail: 'Hard exercise 6–7 days a week', factor: 1.725 },
  very: { label: 'Athlete', detail: 'Physical job plus daily training', factor: 1.9 },
}

export const MACRO_PRESETS: Record<MacroPreset, { label: string; protein: number; carbs: number; fat: number }> = {
  balanced: { label: 'Balanced', protein: 0.3, carbs: 0.4, fat: 0.3 },
  highProtein: { label: 'High protein', protein: 0.4, carbs: 0.35, fat: 0.25 },
  lowCarb: { label: 'Low carb', protein: 0.35, carbs: 0.2, fat: 0.45 },
}

/** Lowest daily target the app will suggest without a manual override. */
export function calorieFloor(sex: Sex) {
  return sex === 'male' ? 1500 : 1200
}

/** Basal metabolic rate, Mifflin–St Jeor equation. */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

export function tdee(p: Pick<Profile, 'sex' | 'heightCm' | 'age' | 'activity'>, weightKg: number) {
  return bmr(p.sex, weightKg, p.heightCm, p.age) * ACTIVITY[p.activity].factor
}

export interface CaloriePlan {
  bmr: number
  maintenance: number
  deficit: number
  target: number
  floored: boolean
}

export function caloriePlan(p: Profile, currentWeightKg: number): CaloriePlan {
  const b = bmr(p.sex, currentWeightKg, p.heightCm, p.age)
  const maintenance = b * ACTIVITY[p.activity].factor
  const losing = p.goalWeightKg < currentWeightKg && p.ratePerWeekKg > 0
  const deficit = losing ? (p.ratePerWeekKg * KCAL_PER_KG_FAT) / 7 : 0
  const raw = maintenance - deficit
  const floor = calorieFloor(p.sex)
  const floored = losing && raw < floor
  return {
    bmr: Math.round(b),
    maintenance: Math.round(maintenance),
    deficit: Math.round(deficit),
    target: roundTo(floored ? floor : raw, 10),
    floored,
  }
}

export function macroTargets(kcal: number, preset: MacroPreset) {
  const m = MACRO_PRESETS[preset]
  return {
    protein: Math.round((kcal * m.protein) / 4),
    carbs: Math.round((kcal * m.carbs) / 4),
    fat: Math.round((kcal * m.fat) / 9),
  }
}

/** Weeks needed to reach the goal at the planned pace, or null when not losing. */
export function weeksToGoal(currentKg: number, goalKg: number, ratePerWeekKg: number) {
  if (ratePerWeekKg <= 0 || goalKg >= currentKg) return null
  return Math.ceil((currentKg - goalKg) / ratePerWeekKg)
}

export function bmi(weightKg: number, heightCm: number) {
  const m = heightCm / 100
  return weightKg / (m * m)
}

export function scaleNutrients(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100
  const out: Nutrients = {
    kcal: per100.kcal * f,
    protein: per100.protein * f,
    carbs: per100.carbs * f,
    fat: per100.fat * f,
  }
  if (per100.fiber != null) out.fiber = per100.fiber * f
  if (per100.sugar != null) out.sugar = per100.sugar * f
  return out
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  const total: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
  for (const n of list) {
    total.kcal += n.kcal
    total.protein += n.protein
    total.carbs += n.carbs
    total.fat += n.fat
    total.fiber! += n.fiber ?? 0
    total.sugar! += n.sugar ?? 0
  }
  return total
}

/** Converts totals for a known weight into per-100 g values. */
export function toPer100(totals: Nutrients, grams: number): Nutrients {
  if (grams <= 0) return { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  return scaleNutrients(totals, (100 / grams) * 100)
}

export function roundTo(n: number, step: number) {
  return Math.round(n / step) * step
}

/** Calories burned for an activity, using MET × body weight × hours. */
export function exerciseKcal(met: number, weightKg: number, minutes: number) {
  return Math.round(met * weightKg * (minutes / 60))
}
