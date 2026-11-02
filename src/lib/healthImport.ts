import { dateKey } from './date'
import { kcal } from './format'
import { parseHealthText } from './health'
import { locale, t } from './i18n'
import { useStore } from './store'

/**
 * The Plate shortcut's text from the link it opens Plate with ("…/#health=plate%20date%3D…"),
 * or null for any other link.
 */
export function healthTextFromHash(hash: string): string | null {
  const m = hash.match(/^#health=(.+)$/)
  if (!m) return null
  try {
    return decodeURIComponent(m[1].replace(/\+/g, ' '))
  } catch {
    return null
  }
}

/** Saves what the Plate shortcut sent; returns the day it was saved to and a short summary, or null. */
export function applyHealthText(text: string, fallbackDate: string) {
  const r = parseHealthText(text)
  if (!r) return null
  const st = useStore.getState()
  // The shortcut collects today; an explicit date in the text wins if it isn't in the future.
  const day = r.date && r.date <= dateKey() ? r.date : fallbackDate
  const device = st.deviceActivity[day]
  // Without an Apple Watch the active calories come through as 0; the steps count instead, as in the iPhone app.
  if (r.activeKcal != null && r.activeKcal > 0) {
    st.setDeviceDay(day, { activeKcal: r.activeKcal, steps: r.steps, source: 'health', at: Date.now() })
  } else if (r.steps != null && device) {
    // Watch calories already saved for the day stay; only the steps are refreshed.
    st.setDeviceDay(day, { ...device, steps: r.steps, at: Date.now() })
  } else if (r.steps != null) {
    st.setSteps(day, r.steps)
  }
  if (r.weightKg != null) st.logWeight(day, r.weightKg)
  if (r.sleepMinutes != null || r.distanceKm != null || r.restingHr != null) {
    st.setHealthDay(day, {
      ...(r.sleepMinutes != null && { sleepMinutes: r.sleepMinutes }),
      ...(r.distanceKm != null && { distanceKm: r.distanceKm }),
      ...(r.restingHr != null && { restingHr: r.restingHr }),
    })
  }
  if (r.workoutKcal != null) st.setTrackerWorkouts(day, r.workoutKcal)
  const summary = [
    r.steps != null && t('{n} steps', { n: r.steps.toLocaleString(locale()) }),
    r.activeKcal != null && t('{n} active kcal', { n: kcal(r.activeKcal) }),
    r.sleepMinutes != null && t('{time} sleep', { time: sleepText(r.sleepMinutes) }),
    r.distanceKm != null && t('{n} km', { n: r.distanceKm.toLocaleString(locale(), { maximumFractionDigits: 1 }) }),
    r.workoutKcal != null && t('{n} kcal from WHOOP workouts', { n: kcal(r.workoutKcal) }),
    r.restingHr != null && t('resting heart rate {n}', { n: r.restingHr }),
    r.weightKg != null && `${r.weightKg} ${t('kg')}`,
  ].filter(Boolean).join(' · ')
  return { day, summary }
}

/** "7 h 24 min" */
export function sleepText(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? (m ? t('{h} h {m} min', { h, m }) : t('{h} h', { h })) : t('{n} min', { n: m })
}
