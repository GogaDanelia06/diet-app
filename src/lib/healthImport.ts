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
  if (r.activeKcal != null) {
    st.setDeviceDay(day, { activeKcal: r.activeKcal, steps: r.steps, source: 'health', at: Date.now() })
  } else if (r.steps != null && device) {
    // Watch calories already saved for the day stay; only the steps are refreshed.
    st.setDeviceDay(day, { ...device, steps: r.steps, at: Date.now() })
  } else if (r.steps != null) {
    st.setSteps(day, r.steps)
  }
  if (r.weightKg != null) st.logWeight(day, r.weightKg)
  const summary = [
    r.steps != null && t('{n} steps', { n: r.steps.toLocaleString(locale()) }),
    r.activeKcal != null && t('{n} active kcal', { n: kcal(r.activeKcal) }),
    r.weightKg != null && `${r.weightKg} ${t('kg')}`,
  ].filter(Boolean).join(' · ')
  return { day, summary }
}
