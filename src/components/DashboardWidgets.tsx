import { useId, useState } from 'react'
import { intakeWeek, parseWeight, reportedNutrient, weightOnOrBefore } from '../lib/dashboard'
import { dateKey, parseKey, shortDate } from '../lib/date'
import { kcal } from '../lib/format'
import { locale, t } from '../lib/i18n'
import { useStore } from '../lib/store'
// Used by the Little daily wins widget, which is commented out below.
// import type { DashboardHabit } from '../lib/types'
import { ForecastWidget, /* GardenWidget, */ NextMealWidget, WidgetHeading } from './Gadgets'
import { Card, Icon } from './ui'
import './dashboard-widgets.css'

const WIDGETS = [
  { id: 'nextMeal', label: 'Next meal' },
  // Hidden for now: { id: 'garden', label: 'Veggie garden' },
  { id: 'forecast', label: 'Goal forecast' },
  { id: 'week', label: 'Weekly intake' },
  { id: 'nutrients', label: 'Beyond macros' },
  { id: 'weight', label: 'Weight check-in' },
  // Hidden for now: { id: 'habits', label: 'Little daily wins' },
] as const
// const HABITS: { id: DashboardHabit; label: string }[] = [
//   { id: 'color', label: 'Add something colorful' },
//   { id: 'movement', label: 'Take a movement break' },
//   { id: 'unwind', label: 'Make time to unwind' },
// ]

export function DashboardWidgets({ date }: { date: string }) {
  const visible = useStore((state) => state.dashboard.visible)
  const toggle = useStore((state) => state.toggleDashboardWidget)
  const [customizing, setCustomizing] = useState(false)
  const optionsId = useId()

  return <section className="dashboard-widgets" aria-label={t('Your widgets')}>
    <div className="widget-section-heading">
      <h2>{t('Your widgets')}</h2>
      <button type="button" aria-expanded={customizing} aria-controls={optionsId} onClick={() => setCustomizing(!customizing)}>
        <Icon name={customizing ? 'check' : 'plus'} className="h-3.5 w-3.5" />{t(customizing ? 'Done' : 'Customize')}
      </button>
    </div>
    {customizing && <fieldset id={optionsId} className="widget-customize">
      <legend className="sr-only">{t('Choose your widgets')}</legend>
      {WIDGETS.map(({ id, label }) => <label key={id}>
        <input type="checkbox" checked={visible[id]} onChange={() => toggle(id)} />
        <span>{t(label)}</span>
      </label>)}
      <p>{t('Your layout is saved on this device.')}</p>
    </fieldset>}
    <div className="widget-stack">
      {visible.nextMeal && date === dateKey() && <NextMealWidget />}
      {/* Hidden for now: {visible.garden && <GardenWidget date={date} />} */}
      {visible.forecast && <ForecastWidget />}
      {visible.week && <WeeklyIntake date={date} />}
      {visible.nutrients && <NutrientSnapshot date={date} />}
      {visible.weight && <QuickWeight key={date} date={date} />}
      {/* Hidden for now: {visible.habits && <DailyHabits key={date} date={date} />} */}
    </div>
    {!WIDGETS.some(({ id }) => visible[id]) && <div className="widget-empty">{t('Make this space yours. Choose a widget above.')}</div>}
  </section>
}

function WeeklyIntake({ date }: { date: string }) {
  const entries = useStore((state) => state.entries)
  const week = intakeWeek(entries, date)
  const logged = week.filter((day) => day.entries > 0)
  const average = logged.length ? logged.reduce((total, day) => total + day.kcal, 0) / logged.length : null
  const max = Math.max(...week.map((day) => day.kcal), 1)

  return <Card className="dashboard-widget widget-intake">
    <WidgetHeading icon="chart" title={t('Weekly intake')} detail={t('7 days')} />
    <div className="widget-number-row"><strong className="num">{average === null ? '—' : kcal(average)}</strong><span>{t('kcal / logged day')}</span></div>
    <ul className="intake-bars" aria-label={t('Daily calorie intake')}>
      {week.map((day) => {
        const description = day.entries > 0 ? t('{date}: {n} kcal recorded', { date: shortDate(day.date), n: kcal(day.kcal) }) : t('{date}: no food logged', { date: shortDate(day.date) })
        return <li key={day.date} aria-label={description} title={description}>
          <div className={`intake-bar-track ${day.date === date ? 'is-current' : ''}`}>
            {day.entries > 0 && <span className="intake-bar" style={{ height: `${Math.max(3, day.kcal / max * 100)}%` }} />}
            {day.entries === 0 && <span className="intake-bar-missing" />}
          </div>
          <span aria-hidden="true">{parseKey(day.date).toLocaleDateString(locale(), { weekday: 'narrow' })}</span>
        </li>
      })}
    </ul>
    <p className="widget-note">{logged.length ? t('{n} of 7 days logged · unfinished days included', { n: logged.length }) : t('Your first food log starts the picture.')}</p>
  </Card>
}

function NutrientSnapshot({ date }: { date: string }) {
  const allEntries = useStore((state) => state.entries)
  const entries = allEntries.filter((entry) => entry.date === date)
  return <Card className="dashboard-widget widget-nutrients">
    <WidgetHeading icon="sparkle" title={t('Beyond macros')} />
    <p className="widget-note widget-intro">{t('A closer look at your food.')}</p>
    <dl className="nutrient-rows">
      {(['fiber', 'sugar'] as const).map((nutrient) => {
        const report = reportedNutrient(entries, nutrient)
        return <div key={nutrient}>
          <dt><span className={`nutrient-dot nutrient-${nutrient}`} />{t(nutrient === 'fiber' ? 'Fiber' : 'Total sugar')}</dt>
          <dd>
            <strong className="num">{report.value === null ? '—' : `${Math.round(report.value * 10) / 10} ${t('g')}`}</strong>
            <span>{report.known === 0 ? t('Not reported') : t('{n}/{total} foods report this', { n: report.known, total: report.total })}</span>
          </dd>
        </div>
      })}
    </dl>
    <p className="widget-note">{entries.length ? t('Reported totals only. Missing values are unknown, not zero.') : t('Log a food to see your nutrient details.')}</p>
  </Card>
}

function QuickWeight({ date }: { date: string }) {
  const weights = useStore((state) => state.weights)
  const logWeight = useStore((state) => state.logWeight)
  const latest = weightOnOrBefore(weights, date)
  const existing = weights.find((weight) => weight.date === date)
  const [input, setInput] = useState(existing ? String(existing.kg) : '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)
  const fieldId = useId()
  const statusId = useId()

  return <Card className="dashboard-widget widget-weight">
    <WidgetHeading icon="chart" title={t('Weight check-in')} detail={shortDate(date)} />
    <div className="widget-number-row"><strong className="num">{latest ? latest.kg.toFixed(1) : '—'}</strong><span>{t('kg')}</span></div>
    <p className="widget-note">{latest ? t('Last entry · {date}', { date: shortDate(latest.date) }) : t('A small check-in. A clearer picture.')}</p>
    <form className="weight-widget-form" onSubmit={(event) => {
      event.preventDefault()
      const value = parseWeight(input)
      if (value === null) { setError(true); setSaved(false); return }
      logWeight(date, value)
      setInput(String(value))
      setError(false)
      setSaved(true)
    }}>
      <label className="sr-only" htmlFor={fieldId}>{t('Weight, kg')}</label>
      <input id={fieldId} inputMode="decimal" className="field num" placeholder={latest ? latest.kg.toFixed(1) : t('Weight, kg')} value={input} aria-invalid={error} aria-describedby={statusId} onChange={(event) => { setInput(event.target.value); setError(false); setSaved(false) }} />
      <button className="btn btn-quiet" type="submit" disabled={!input.trim()}>{saved ? <Icon name="check" className="h-4 w-4" /> : null}{t(saved ? 'Saved' : existing ? 'Update' : 'Save')}</button>
    </form>
    <p id={statusId} className={`widget-note ${error ? 'text-over' : ''}`} role="status">{error ? t('Enter a weight between 30 and 300 kg.') : saved ? t('Weight saved for {date}.', { date: shortDate(date) }) : existing ? t('Saving replaces the entry for this date.') : ''}</p>
  </Card>
}

// Hidden for now; restore together with the habits entries above.
// function DailyHabits({ date }: { date: string }) {
//   const records = useStore((state) => state.dashboard.habits)
//   const toggleHabit = useStore((state) => state.toggleDashboardHabit)
//   const checked = records[date] ?? []
//
//   return <Card className="dashboard-widget widget-habits">
//     <WidgetHeading icon="star" title={t('Little daily wins')} detail={`${checked.length}/${HABITS.length}`} />
//     <p className="widget-note widget-intro">{t('More than a number on the scale.')}</p>
//     <div className="habit-checklist">
//       {HABITS.map(({ id, label }) => <label key={id} className={checked.includes(id) ? 'is-checked' : ''}>
//         <input type="checkbox" checked={checked.includes(id)} onChange={() => toggleHabit(date, id)} />
//         <span className="habit-checkmark" aria-hidden="true">{checked.includes(id) && <Icon name="check" className="h-3 w-3" />}</span>
//         <span>{t(label)}</span>
//       </label>)}
//     </div>
//   </Card>
// }

