import { addDays, dateKey } from './date'
import { hoursBetween } from './insights'
import type { AppData } from './store'

/** The last 7 days, summed up as plain text for the AI to review. */
export function weekForReport(st: AppData, targets: { kcal: number; protein: number }, end: string) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(end, i - 6))
  const lines: string[] = []
  let loggedDays = 0
  for (const d of days) {
    const es = st.entries.filter((e) => e.date === d)
    const ex = st.exercises.filter((e) => e.date === d)
    if (es.length) loggedDays++
    const kcal = es.reduce((n, e) => n + e.nutrients.kcal, 0)
    const protein = es.reduce((n, e) => n + e.nutrients.protein, 0)
    const fiber = es.reduce((n, e) => n + (e.nutrients.fiber ?? 0), 0)
    const foods = es.map((e) => e.name).slice(0, 12).join(', ')
    lines.push(
      es.length
        ? `${d}: ${Math.round(kcal)} kcal, ${Math.round(protein)} g protein, ${Math.round(fiber)} g fibre. Ate: ${foods}.` +
            (ex.length ? ` Exercise: ${ex.map((e) => `${e.name} ${e.minutes} min`).join(', ')}.` : '') +
            (st.deviceActivity[d] ? ` Watch: ${st.deviceActivity[d].activeKcal} active kcal.` : '') +
            ((st.deviceActivity[d]?.steps ?? st.steps[d]) ? ` Steps: ${st.deviceActivity[d]?.steps ?? st.steps[d]}.` : '')
        : `${d}: nothing logged.`,
    )
  }
  const weights = st.weights.filter((w) => w.date >= days[0] && w.date <= end)
  const fasts = st.fasting.history.filter((f) => dateKey(new Date(f.start)) >= days[0])
  const p = st.profile!
  const text = [
    `Person: ${p.sex}, ${p.age} years, ${p.heightCm} cm, goal ${p.goalWeightKg} kg, planned loss ${p.ratePerWeekKg} kg/week.`,
    `Daily target: ${targets.kcal} kcal and ${targets.protein} g protein. Logged ${loggedDays} of 7 days.`,
    weights.length ? `Weigh-ins this week: ${weights.map((w) => `${w.date} ${w.kg} kg`).join(', ')}.` : 'No weigh-ins this week.',
    fasts.length ? `Fasts: ${fasts.map((f) => `${hoursBetween(f.start, f.end).toFixed(1)} h of ${f.hours} h goal`).join(', ')}.` : '',
    ...lines,
  ]
    .filter(Boolean)
    .join('\n')
  return { text, loggedDays }
}
