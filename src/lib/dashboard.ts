import { addDays, dateKey, parseKey } from './date'
import type { DashboardHabit, DashboardState, DashboardWidget, DiaryEntry, WeightLog } from './types'

export const DASHBOARD_WIDGET_IDS: DashboardWidget[] = ['week', 'nutrients', 'weight', 'habits']
export const DASHBOARD_HABIT_IDS: DashboardHabit[] = ['color', 'movement', 'unwind']

/** Fresh nested values prevent resets or older imports from sharing mutable defaults. */
export function defaultDashboard(): DashboardState {
  return { visible: { week: true, nutrients: true, weight: true, habits: true }, habits: {} }
}

/** Older backups omit dashboard state; malformed optional fields fall back independently. */
export function normalizeDashboard(value: unknown): DashboardState {
  const next = defaultDashboard()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return next
  const saved = value as Record<string, unknown>
  if (saved.visible && typeof saved.visible === 'object' && !Array.isArray(saved.visible)) {
    for (const id of DASHBOARD_WIDGET_IDS) {
      const visible = (saved.visible as Record<string, unknown>)[id]
      if (typeof visible === 'boolean') next.visible[id] = visible
    }
  }
  if (saved.habits && typeof saved.habits === 'object' && !Array.isArray(saved.habits)) {
    for (const [date, values] of Object.entries(saved.habits)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || dateKey(parseKey(date)) !== date || !Array.isArray(values)) continue
      next.habits[date] = [...new Set(values.filter((habit): habit is DashboardHabit => DASHBOARD_HABIT_IDS.includes(habit)))]
    }
  }
  return next
}

/** Remove temporary storage used during development; it is never imported or resurrected. */
export function discardLegacyDashboardStorage() {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem('plate-dashboard-widgets-v1')
    localStorage.removeItem('plate-dashboard-habits-v1')
  } catch { /* The app's IndexedDB store remains the only source of widget state. */ }
}

/** Missing days stay explicitly unlogged; they are never treated as zero-calorie days. */
export function intakeWeek(entries: DiaryEntry[], endDate: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(endDate, index - 6)
    const logged = entries.filter((entry) => entry.date === date)
    return { date, kcal: logged.reduce((total, entry) => total + entry.nutrients.kcal, 0), entries: logged.length }
  })
}

/** An absent optional nutrient is unknown, including when other foods report a real zero. */
export function reportedNutrient(entries: DiaryEntry[], nutrient: 'fiber' | 'sugar') {
  const reported = entries.map((entry) => entry.nutrients[nutrient]).filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0,
  )
  return {
    value: reported.length > 0 ? reported.reduce((total, value) => total + value, 0) : null,
    known: reported.length,
    total: entries.length,
  }
}

export function weightOnOrBefore(weights: WeightLog[], date: string) {
  return weights.filter((weight) => weight.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
}

/** Reject partial parses such as "75kg" rather than silently accepting bad input. */
export function parseWeight(input: string): number | null {
  const normalized = input.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) && value >= 30 && value <= 300 ? Math.round(value * 10) / 10 : null
}

