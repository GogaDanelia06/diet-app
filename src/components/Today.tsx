import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { addDays, clockTime, dateKey, dayLabel, parseKey, shortDate } from '../lib/date'
import { kcal, num } from '../lib/format'
import { locale, t, tName } from '../lib/i18n'
import { currentWeight, useDay, useStore, useTargets } from '../lib/store'
import { buildWeek, sessionKcal, weekdayIndex, workoutGoal } from '../lib/workouts'
import { sleepText } from '../lib/healthImport'
import { clock } from '../lib/training'
import { useNow } from './ActiveWorkout'
import { toPer100 } from '../lib/calc'
import { mealTotals } from '../lib/plan'
import { logStreak } from '../lib/insights'
import { MEAL_ICON, MEALS, type DiaryEntry, type Food, type Meal, type Nutrients } from '../lib/types'
import { dayQuality, foodVerdict } from '../lib/rating'
import { VERDICT } from './HealthRating'
import { Card, Field, Icon, Sheet } from './ui'
import type { AddFoodMode } from './AddFood'
import FoodDetail from './FoodDetail'
import ExerciseSheet from './ExerciseSheet'
import WatchSheet, { HealthSync } from './Watch'
import MealTimeSheet from './MealTimeSheet'
import FastingCard from './Fasting'
import { BowlView } from './ThreeViews'
import { mealForHour } from '../lib/gadgets'
import { CalendarMonth } from './Calendar'
import { useReportDue } from './WeeklyReport'
import { DashboardWidgets } from './DashboardWidgets'

function useCountUp(value: number, ms = 700) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value)
      from.current = value
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms)
      const v = a + (value - a) * (1 - Math.pow(1 - p, 3))
      setShown(v)
      from.current = v
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return shown
}

export default function Today({ date, setDate, onAdd, onOpenCoach, onOpenWorkouts }: {
  date: string
  setDate: (d: string) => void
  onAdd: (m: Meal, mode?: AddFoodMode, photo?: File) => void
  onOpenCoach: () => void
  onOpenWorkouts: () => void
}) {
  const targets = useTargets()!
  const day = useDay(date)
  const settings = useStore((s) => s.settings)
  const entries = useStore((s) => s.entries)
  const [editing, setEditing] = useState<DiaryEntry | null>(null)
  const [exerciseOpen, setExerciseOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [watchOpen, setWatchOpen] = useState(false)
  const reportDue = useReportDue()
  const photoInput = useRef<HTMLInputElement>(null)
  const budget = targets.kcal + day.bonus
  const remaining = budget - day.totals.kcal
  const over = remaining < 0
  const shownRemaining = useCountUp(Math.abs(remaining))
  const isToday = date === dateKey()
  const streak = logStreak(entries, dateKey())
  const progress = budget > 0 ? day.totals.kcal / budget * 100 : 0
  const meal = mealForHour(new Date().getHours())
  const week = Array.from({ length: 7 }, (_, i) => addDays(date, i - 3))

  return (
    <div className="today-dashboard">
      <header className="dashboard-heading">
        <div><p className="eyebrow">{t('MAKE ROOM FOR YOU')}</p><h1>{t('Your day, in balance.')}<span className="heading-dot"> </span></h1><p className="heading-subtitle">{t('Small steps. A healthier everyday.')}</p></div>
        <button className="date-picker" onClick={() => setCalendarOpen(true)} aria-label={t('Open calendar')}><Icon name="calendar" /><span>{parseKey(date).toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' })}</span><Icon name="down" className="h-3 w-3" /></button>
      </header>

      <div className="day-toolbar">
        <div className="day-navigation"><button className="icon-button" onClick={() => setDate(addDays(date, -1))} aria-label={t('Previous day')}><Icon name="left" className="h-4 w-4" /></button><button className="day-label" onClick={() => setDate(dateKey())}>{dayLabel(date)}</button><button className="icon-button" onClick={() => setDate(addDays(date, 1))} aria-label={t('Next day')}><Icon name="right" className="h-4 w-4" /></button></div>
        <div className="week-strip" aria-label={t('Pick a day')}>{week.map((d) => <button key={d} onClick={() => setDate(d)} aria-current={d === date ? 'date' : undefined} aria-label={shortDate(d)}><span>{parseKey(d).toLocaleDateString(locale(), { weekday: 'short' })}</span><b>{parseKey(d).getDate()}</b><i className={entries.some((e) => e.date === d) ? 'has-log' : ''} /></button>)}</div>
        <span className="streak-chip"><Icon name="flame" className="h-4 w-4" />{streak > 0 ? t('{n}-day streak', { n: streak }) : t('A fresh start')}</span>
      </div>

      <div className="overview-grid">
        <section className={`energy-card ${over ? 'energy-over' : ''}`} aria-label={t('Calories today')}>
          <div className="energy-topline"><span><Icon name="bolt" className="h-4 w-4" />{t('Daily energy')}</span><span className="live-label">{t('YOUR DAILY TARGET')}</span></div>
          <div className="energy-content">
            <div className="energy-numbers"><div className="energy-value num">{kcal(shownRemaining)}<span>kcal</span></div><div className="energy-caption">{over ? t('kcal over budget') : t('kcal left today')}</div><div className="energy-meter"><span style={{ width: `${Math.min(100, progress)}%` }} /></div><p className="energy-target">{t('{n}% of your daily budget', { n: Math.round(progress) })}</p></div>
            <div className="energy-orb"><div className="orb-halo" /><BowlView fill={budget > 0 ? day.totals.kcal / budget : 0} over={over} /><span className="orb-caption">{t('A little perspective.')}</span></div>
          </div>
          <div className="energy-stats"><div><span><i className="stat-dot eaten-dot" />{t('Eaten')}</span><strong className="num">{kcal(day.totals.kcal)}<small>kcal</small></strong></div><div><span><i className="stat-dot budget-dot" />{t('Budget')}</span><strong className="num">{kcal(budget)}<small>kcal</small></strong></div><div><span><i className="stat-dot burned-dot" />{t('Burned')}</span><strong className="num">{kcal(day.burned)}<small>kcal</small></strong></div></div>
          {day.bonus > 0 && <p className="energy-bonus">{t('+{n} exercise', { n: kcal(day.bonus) })}</p>}
        </section>
        <MacroSummary totals={day.totals} targets={targets} />
      </div>

      {/* Snap meal opens the camera straight away; the photo then goes to the AI in the add-food sheet. */}
      <input ref={photoInput} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) onAdd(meal, 'photo', file) }} />
      <div className="quick-tools" aria-label={t('Quick tools')}>
        <button onClick={() => settings.geminiKey ? photoInput.current?.click() : onAdd(meal, 'photo')}><span className="quick-tool-icon"><Icon name="camera" /></span><span>{t('Snap meal')}<small>{t('AI counts the calories')}</small></span><Icon name="right" className="tool-arrow h-4 w-4" /></button>
        <button onClick={() => onAdd(meal)}><span className="quick-tool-icon"><Icon name="search" /></span><span>{t('Log food')}<small>{t('Find your favorites')}</small></span><Icon name="right" className="tool-arrow h-4 w-4" /></button>
        <button onClick={() => onAdd(meal, 'barcode')}><span className="quick-tool-icon"><Icon name="barcode" /></span><span>{t('Scan barcode')}<small>{t('Scan. Log. Done.')}</small></span><Icon name="right" className="tool-arrow h-4 w-4" /></button>
        <button onClick={() => onAdd(meal, 'quick')}><span className="quick-tool-icon"><Icon name="bolt" /></span><span>{t('Quick add')}<small>{t('Calories in a tap')}</small></span><Icon name="right" className="tool-arrow h-4 w-4" /></button>
      </div>

      <div className="dashboard-columns">
        <div className="diary-column">
          <div className="section-heading"><div><span className="eyebrow">{t('ONE MEAL AT A TIME')}</span><h2>{t('Food diary')}</h2></div><button onClick={() => onAdd(meal)} className="text-action"><Icon name="plus" className="h-4 w-4" />{t('Add food')}</button></div>
          <FoodQuality entries={day.entries} />
          <div className="diary-meals">{MEALS.map((m) => <MealCard key={m.id} date={date} meal={m.id} label={t(m.label)} entries={day.entries.filter((e) => e.meal === m.id)} onAdd={() => onAdd(m.id)} onCopy={() => onAdd(m.id, 'past')} onOpen={setEditing} />)}</div>
          <div className="section-heading habit-heading"><div><span className="eyebrow">{t('BEYOND THE PLATE')}</span><h2>{t('Your daily rhythm')}</h2></div><span className="subtle-label">{t('A little care goes a long way')}</span></div>
          <WaterCard key={date} date={date} />
          <Card className="activity-card">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Icon name="run" className="text-accent" />{t('Exercise')}</h2><span className="num text-sm text-muted">{t('{n} kcal burned', { n: kcal(day.burned) })}</span></div>
            {day.device && <button onClick={() => setWatchOpen(true)} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-accent/[0.07] px-3 py-2.5 text-left"><Icon name="watch" className="h-6 w-6 shrink-0 text-accent" /><span className="min-w-0 flex-1"><span className="block font-semibold">{t('Watch: {n} active kcal', { n: kcal(day.device.activeKcal) })}</span><span className="block text-xs text-muted">{t('{n} kcal above a normal day count toward your budget', { n: kcal(day.burned) })}</span></span><Icon name="right" className="h-5 w-5 text-muted" /></button>}
            {isToday && <PlannedWorkout onOpen={onOpenWorkouts} />}
            <HealthExtrasRow date={date} />
            <StepsRow steps={day.steps} goal={settings.stepGoal} kcalFromSteps={day.fromSteps} onEdit={() => day.device ? setWatchOpen(true) : setExerciseOpen(true)} />
            {day.device && day.exercises.length > 0 && <p className="mt-3 text-xs text-muted">{t('Workouts below are already part of your watch’s calories, so they aren’t counted twice.')}</p>}
            <ExerciseList date={date} covered={!!day.device} />
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1"><button onClick={() => setExerciseOpen(true)} className="text-action"><Icon name="plus" className="h-4 w-4" />{t('Add exercise')}</button><HealthSync key={date} date={date} onSetup={() => setWatchOpen(true)} /></div>
          </Card>
          {isToday && settings.showFasting && <FastingCard />}
        </div>
        <aside className="widgets-column" aria-label={t('Your widgets')}>
          <DashboardWidgets date={date} />
          {isToday && reportDue && <button onClick={onOpenCoach} className="report-link glass"><Icon name="report" className="text-violet" /><span><strong>{t('Your weekly report is ready')}</strong><small>{t('See how this week went and what to change')}</small></span><Icon name="right" /></button>}
          <div className="dashboard-footnote"><LogoMark /><p>{t('Built around you.')}<span>{t('No ads. No premium tier. Just progress.')}</span></p></div>
        </aside>
      </div>
      {editing && <FoodDetail food={editing.food ?? { id: editing.id, name: editing.name, per100: perHundred(editing), servings: [], source: 'quick' }} initialGrams={editing.grams} initialMeal={editing.meal} entry={editing} onClose={() => setEditing(null)} />}
      {exerciseOpen && <ExerciseSheet date={date} onClose={() => setExerciseOpen(false)} />}
      {watchOpen && <WatchSheet date={date} onClose={() => setWatchOpen(false)} />}
      {calendarOpen && <Sheet title={t('Pick a day')} onClose={() => setCalendarOpen(false)}><CalendarMonth selected={date} onPick={(d) => { setDate(d); setCalendarOpen(false) }} /></Sheet>}
    </div>
  )
}

function LogoMark() { return <Icon name="sparkle" className="h-7 w-7 text-accent" /> }

function MacroSummary({ totals, targets }: { totals: Nutrients; targets: { protein: number; carbs: number; fat: number } }) {
  const [mode, setMode] = useState<'eaten' | 'left' | 'energy'>('eaten')
  const macros = [{ id: 'protein' as const, label: 'Protein', color: 'var(--protein)', energy: 4 }, { id: 'carbs' as const, label: 'Carbs', color: 'var(--carbs)', energy: 4 }, { id: 'fat' as const, label: 'Fat', color: 'var(--fat)', energy: 9 }]
  const totalEnergy = totals.protein * 4 + totals.carbs * 4 + totals.fat * 9
  return <section className="macro-card glass" aria-label={t('Macronutrients')}>
    <div className="macro-heading"><h2>{t('Macronutrients')}</h2><span className="tiny-pill">{t('Daily')}</span></div>
    <div className="macro-tabs" role="group" aria-label={t('Macro display')}>{([{ value: 'eaten', label: 'Eaten' }, { value: 'left', label: 'Remaining' }, { value: 'energy', label: 'Energy %' }] as const).map((m) => <button key={m.value} aria-pressed={mode === m.value} onClick={() => setMode(m.value)}>{t(m.label)}</button>)}</div>
    <div className="macro-columns">{macros.map((m) => {
      const pct = targets[m.id] > 0 ? Math.min(100, totals[m.id] / targets[m.id] * 100) : 0
      const energyPct = totalEnergy > 0 ? Math.round(totals[m.id] * m.energy / totalEnergy * 100) : 0
      const value = mode === 'left' ? Math.max(0, targets[m.id] - totals[m.id]) : mode === 'energy' ? energyPct : totals[m.id]
      return <div className="macro-column" key={m.id}><div className="macro-track" aria-hidden="true" style={{ '--macro-fill': `${pct}%` } as CSSProperties}><div style={{ height: `${pct}%`, background: m.color }} /><span style={{ background: m.color }} /></div><span className="macro-label"><i style={{ background: m.color }} />{t(m.label)}</span><strong className="num">{Math.round(value)}<small>{mode === 'energy' ? '%' : t('g')}</small></strong><span className="macro-target">{mode === 'energy' ? t('of macro energy') : t('Goal {n} g', { n: targets[m.id] })}</span></div>
    })}</div>
    <p className="macro-note"><Icon name="chart" className="h-4 w-4" />{t('A balanced view of what fuels you.')}</p>
  </section>
}

function perHundred(e: DiaryEntry) {
  return toPer100(e.nutrients, e.grams > 0 ? e.grams : 100)
}

/** The time a meal was eaten, as a chip that opens the meal time sheet. */
function MealTime({ label, time, onOpen }: { label: string; time?: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      className={`meal-time ${time ? 'has-time' : ''}`}
      onClick={onOpen}
      aria-label={time ? t('{meal} eaten at {time}. Change the time', { meal: label, time: clockTime(time) }) : t('Add the time you ate {meal}', { meal: label })}
    >
      <Icon name="clock" className="h-3.5 w-3.5" />
      <span>{time ? clockTime(time) : t('Add time')}</span>
    </button>
  )
}

function MealCard({
  date,
  meal,
  label,
  entries,
  onAdd,
  onCopy,
  onOpen,
}: {
  date: string
  meal: Meal
  label: string
  entries: DiaryEntry[]
  onAdd: () => void
  /** Opens Add food on Past meals for this meal. */
  onCopy: () => void
  onOpen: (e: DiaryEntry) => void
}) {
  const copyMeal = useStore((s) => s.copyMeal)
  const allEntries = useStore((s) => s.entries)
  const mealPlan = useStore((s) => s.mealPlan)
  const logPlanMeal = useStore((s) => s.logPlanMeal)
  const planned = (mealPlan?.days.find((d) => d.date === date)?.meals ?? []).filter((m) => m.meal === meal && !m.logged)
  const [saving, setSaving] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const yesterday = addDays(date, -1)
  const yesterdayCount = entries.length === 0 ? allEntries.filter((e) => e.date === yesterday && e.meal === meal).length : 0
  // Anything from the last two weeks (or today's other meals) to copy into an empty meal.
  const canCopy = entries.length === 0 && allEntries.some((e) => e.date <= date && e.date >= addDays(date, -14))
  const total = entries.reduce((n, e) => n + e.nutrients.kcal, 0)

  return (
    <>
    <Card>
      <div className="flex items-center gap-3">
        <span className={`meal-symbol meal-symbol-${meal}`} aria-hidden="true">
          {MEAL_ICON[meal]}
        </span>
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold">{label}</h2>
          {/* No eating time for days that haven't happened yet. */}
          {entries.length > 0 && date <= dateKey() && <MealTime label={label} time={entries.find((e) => e.time)?.time} onOpen={() => setTimeOpen(true)} />}
        </div>
        <span className="num text-sm">
          <span className="font-semibold">{kcal(total)}</span> <span className="text-muted">kcal</span>
        </span>
        <button onClick={onAdd} className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent" aria-label={t('Add food to {meal}', { meal: label })}>
          <Icon name="plus" className="h-5 w-5" />
        </button>
      </div>
      {entries.length === 0 && planned.length === 0 && <p className="meal-empty">{t('No foods logged yet')}</p>}
      {entries.length > 0 && (
        <ul className="mt-2 divide-y divide-line">
          {entries.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => onOpen(e)}
                aria-label={[tName(e.name), e.amountLabel, `${kcal(e.nutrients.kcal)} kcal`, verdictLabel(e.food)].filter(Boolean).join(', ')}
                className="flex w-full items-center gap-3 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{tName(e.name)}</span>
                    <VerdictDot food={e.food} />
                  </div>
                  <div className="truncate text-sm text-muted">
                    {e.brand ? `${e.brand}, ` : ''}
                    {e.amountLabel}
                  </div>
                </div>
                <span className="num font-semibold">{kcal(e.nutrients.kcal)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {entries.length > 0 && <div className="meal-macros">{(['protein', 'carbs', 'fat'] as const).map((key) => <span key={key}><i style={{ background: `var(--${key})` }} />{t(key === 'protein' ? 'Protein' : key === 'carbs' ? 'Carbs' : 'Fat')} {Math.round(entries.reduce((n, e) => n + e.nutrients[key], 0))} {t('g')}</span>)}</div>}
      {planned.map((p) => (
        <div key={p.id} className="mt-2 flex items-center gap-3 rounded-2xl border border-dashed border-accent/30 bg-accent/[0.04] px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-accent">{t('On your plan')}</div>
            <div className="truncate font-medium">{p.name}</div>
          </div>
          <span className="num text-sm text-muted">{kcal(mealTotals(p).kcal)}</span>
          <button onClick={() => logPlanMeal(date, p.id)} className="btn btn-primary px-3 py-1.5 text-sm">
            {t('I ate this')}
          </button>
        </div>
      ))}
      {(canCopy || entries.length >= 2) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-4">
          {yesterdayCount > 0 && (
            <button onClick={() => copyMeal(yesterday, meal, date)} className="flex items-center gap-1.5 py-1.5 text-sm text-muted">
              <Icon name="copy" className="h-4 w-4" /> {t('Same as yesterday')}
            </button>
          )}
          {canCopy && (
            <button onClick={onCopy} className="flex items-center gap-1.5 py-1.5 text-sm text-muted">
              <Icon name="calendar" className="h-4 w-4" /> {t(yesterdayCount > 0 ? 'Another day…' : 'Copy a past meal')}
            </button>
          )}
          {entries.length >= 2 && (
            <button onClick={() => setSaving(true)} className="ml-auto flex items-center gap-1.5 py-1.5 text-sm text-muted">
              <Icon name="bookmark" className="h-4 w-4" /> {t('Save meal')}
            </button>
          )}
        </div>
      )}
      {saving && <SaveMealSheet entries={entries} defaultName={`${label}, ${shortDate(date)}`} onClose={() => setSaving(false)} />}
    </Card>
    {/* Outside the card, so dragging in the sheet doesn't tilt the card behind it. */}
    {timeOpen && <MealTimeSheet date={date} meal={meal} label={label} onClose={() => setTimeOpen(false)} />}
    </>
  )
}

const verdictLabel = (food?: Food) => {
  const verdict = foodVerdict(food)
  return verdict ? t(VERDICT[verdict].label) : ''
}

/** A small dot in the diary showing whether a food is a good pick; nothing for quick-add calories. */
function VerdictDot({ food }: { food?: Food }) {
  const verdict = foodVerdict(food)
  if (!verdict) return null
  return <span className={`h-2 w-2 shrink-0 rounded-full ${VERDICT[verdict].dot}`} aria-hidden="true" />
}

/** How much of the day's food was a good pick, by calories. */
function FoodQuality({ entries }: { entries: DiaryEntry[] }) {
  const q = dayQuality(entries)
  if (!q.total) return null
  const pct = (n: number) => (n / q.total) * 100
  const parts = (['good', 'okay', 'limit'] as const).filter((v) => q[v] > 0)
  return (
    <Card className="mb-3 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="font-display text-lg font-semibold">{t('Food quality')}</h3>
        <span className="text-sm text-muted">{t('{n}% from good choices', { n: Math.round(pct(q.good)) })}</span>
      </div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={parts.map((v) => `${t(QUALITY_LABEL[v])} ${Math.round(pct(q[v]))}%`).join(', ')}>
        {parts.map((v) => <span key={v} className={VERDICT[v].dot} style={{ width: `${pct(q[v])}%` }} />)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {parts.map((v) => (
          <span key={v} className="flex items-center gap-1.5">
            <i className={`h-2 w-2 rounded-full ${VERDICT[v].dot}`} />
            {t(QUALITY_LABEL[v])} <span className="num text-muted">{kcal(q[v])} {t('kcal')}</span>
          </span>
        ))}
      </div>
    </Card>
  )
}

const QUALITY_LABEL = { good: 'Good', okay: 'Moderate', limit: 'Limit' } as const

function SaveMealSheet({ entries, defaultName, onClose }: { entries: DiaryEntry[]; defaultName: string; onClose: () => void }) {
  const saveMeal = useStore((s) => s.saveMeal)
  const [name, setName] = useState('')
  const total = entries.reduce((n, e) => n + e.nutrients.kcal, 0)
  return (
    <Sheet
      title={t('Save meal')}
      onClose={onClose}
      footer={
        <button
          className="btn btn-primary w-full text-lg"
          onClick={() => {
            saveMeal(name.trim() || defaultName, entries)
            onClose()
          }}
        >
          {t('Save meal')}
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-muted">{t('Save these {n} foods ({kcal} kcal) together. Next time, add them all at once from Add food → My foods.', { n: entries.length, kcal: kcal(total) })}</p>
        <Field label={t('Name')}>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultName} />
        </Field>
        <ul className="divide-y divide-line rounded-[18px] bg-surface px-4 text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex justify-between gap-3 py-2.5">
              <span className="min-w-0 truncate">{tName(e.name)}</span>
              <span className="num text-muted">{kcal(e.nutrients.kcal)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  )
}

const CUPS = [
  { ml: 150, label: 'Small glass' },
  { ml: 250, label: 'Glass' },
  { ml: 330, label: 'Can' },
  { ml: 500, label: 'Bottle' },
  { ml: 750, label: 'Large bottle' },
  { ml: 1000, label: 'Litre' },
]

const litres = (ml: number) => String(Math.round(ml / 10) / 100)

/** Outline of a cup or bottle, taller for bigger amounts. */
function CupIcon({ ml }: { ml: number }) {
  const h = 12 + Math.min(ml, 1000) / 1000 * 14
  const top = 30 - h
  const bottle = ml >= 500
  return (
    <svg viewBox="0 0 24 32" className="h-8 w-6" aria-hidden="true">
      {bottle ? (
        <path
          d={`M9 ${top} h6 v3 l2 3 v${h - 6} a2 2 0 0 1 -2 2 h-6 a2 2 0 0 1 -2 -2 v${h - 6} l2 -3 z`}
          fill="rgb(79 216 255 / 0.25)"
          stroke="var(--water)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      ) : (
        <path d={`M5 ${top} h14 l-2 ${h} h-10 z`} fill="rgb(79 216 255 / 0.25)" stroke="var(--water)" strokeWidth="1.5" strokeLinejoin="round" />
      )}
    </svg>
  )
}

function WaterCard({ date }: { date: string }) {
  const ml = useStore((s) => s.water[date] ?? 0)
  const goal = useStore((s) => s.settings.waterGoalMl)
  const addWater = useStore((s) => s.addWater)
  // Drinks added since this card opened, so − takes off exactly the last one.
  const [added, setAdded] = useState<number[]>([])
  const [custom, setCustom] = useState<string | null>(null)
  const pct = goal > 0 ? ml / goal : 0
  const extra = ml - goal

  function add(amount: number) {
    if (amount <= 0) return
    addWater(date, amount)
    setAdded((a) => [...a, amount])
  }

  function undo() {
    const last = added.at(-1) ?? 250
    addWater(date, -Math.min(last, ml))
    setAdded((a) => a.slice(0, -1))
  }

  return (
    <Card className="water-card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{t('Water')}</h2>
        <span className="num text-sm">
          <span className="text-lg font-semibold text-water">{litres(ml)}</span>
          <span className="text-muted"> / {litres(goal)} {t('L')}</span>
        </span>
      </div>

      <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-3 rounded-full bg-gradient-to-r from-water/60 to-water transition-[width] duration-500"
          style={{ width: `${Math.min(100, pct * 100)}%`, boxShadow: pct >= 1 ? '0 0 16px var(--water)' : undefined }}
        />
        {/* A tick every half litre up to the goal. */}
        {Array.from({ length: Math.max(0, Math.floor(goal / 500) - 1) }, (_, i) => (
          <span key={i} className="absolute top-0 h-3 w-px bg-bg/60" style={{ left: `${(((i + 1) * 500) / goal) * 100}%` }} />
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">
        {ml === 0
          ? t('Recommended {goal} L a day. Tap a cup to add it.', { goal: litres(goal) })
          : extra >= 0
            ? extra > 0
              ? t('Goal reached! +{extra} ml more, nice.', { extra: Math.round(extra) })
              : t('Goal reached!')
            : t('Recommended {goal} L · {left} ml to go', { goal: litres(goal), left: Math.round(-extra) })}
      </p>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          onClick={undo}
          disabled={ml === 0}
          className="glass flex w-12 shrink-0 flex-col items-center justify-center rounded-2xl text-xl font-semibold text-muted transition-transform active:scale-90 disabled:opacity-30"
          aria-label={t('Remove {ml} ml', { ml: added.at(-1) ?? 250 })}
        >
          −
        </button>
        {CUPS.map((c) => (
          <button
            key={c.ml}
            onClick={() => add(c.ml)}
            className="glass flex w-[68px] shrink-0 flex-col items-center rounded-2xl px-1 pb-2 pt-1.5 transition-transform active:scale-90"
            aria-label={`${t(c.label)}, ${t('Add {ml} ml', { ml: c.ml })}`}
          >
            <CupIcon ml={c.ml} />
            <span className="num text-sm font-semibold">{c.ml >= 1000 ? `1 ${t('L')}` : c.ml}</span>
            <span className="w-full truncate text-center text-[10px] text-muted">{t(c.label)}</span>
          </button>
        ))}
        <button
          onClick={() => setCustom('')}
          className="glass flex w-[68px] shrink-0 flex-col items-center justify-center rounded-2xl px-1 text-sm font-semibold text-water transition-transform active:scale-90"
        >
          <Icon name="plus" className="h-5 w-5" />
          {t('Other')}
        </button>
      </div>

      {custom !== null && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            add(Math.round(num(custom)))
            setCustom(null)
          }}
        >
          <input
            className="field num"
            inputMode="numeric"
            autoFocus
            placeholder={t('Amount, ml')}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <button className="btn btn-primary shrink-0" disabled={num(custom) <= 0}>
            {t('Add')}
          </button>
          <button type="button" className="btn btn-quiet shrink-0" onClick={() => setCustom(null)}>
            {t('Cancel')}
          </button>
        </form>
      )}
    </Card>
  )
}

/** Today's session from the workout plan, until it's done; or a nudge to make a plan. */
function PlannedWorkout({ onOpen }: { onOpen: () => void }) {
  const active = useStore((s) => s.activeWorkout)
  if (active) return <RunningWorkout title={active.title} startedAt={active.startedAt} onOpen={onOpen} />
  return <NextWorkout onOpen={onOpen} />
}

function RunningWorkout({ title, startedAt, onOpen }: { title: string; startedAt: number; onOpen: () => void }) {
  const now = useNow(1000)
  return (
    <button onClick={onOpen} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-accent px-3 py-2.5 text-left text-accent-ink">
      <Icon name="bolt" className="h-6 w-6 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t('Workout in progress')}</span>
        <span className="block truncate text-xs opacity-80">
          {tName(title)} · {clock(now - startedAt)}
        </span>
      </span>
      <span className="text-sm font-semibold">{t('Resume')}</span>
    </button>
  )
}

function NextWorkout({ onOpen }: { onOpen: () => void }) {
  const prefs = useStore((s) => s.workoutPrefs)
  const profile = useStore((s) => s.profile)!
  const weight = useStore((s) => currentWeight(s))
  const exercises = useStore((s) => s.exercises)
  const today = dateKey()
  const session = prefs ? buildWeek(prefs, workoutGoal(weight, profile.goalWeightKg, profile.ratePerWeekKg))[weekdayIndex(new Date())] : null
  if (prefs && (!session || exercises.some((e) => e.date === today && e.name === session.title))) return null
  return (
    <button onClick={onOpen} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-accent/[0.07] px-3 py-2.5 text-left">
      <Icon name="bolt" className="h-6 w-6 shrink-0 text-accent" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{session ? t('Today’s workout: {title}', { title: tName(session.title) }) : t('Get a workout plan')}</span>
        <span className="block text-xs text-muted">
          {session ? t('{min} min · about {kcal} kcal', { min: session.minutes, kcal: kcal(sessionKcal(session, weight)) }) : t('Strength and cardio that fit your goal and diet')}
        </span>
      </span>
      <Icon name="right" className="h-5 w-5 text-muted" />
    </button>
  )
}

/** Last night's sleep and the day's walking distance, when Apple Health sent them. */
function HealthExtrasRow({ date }: { date: string }) {
  const extras = useStore((s) => s.healthDays[date])
  if (!extras || (extras.sleepMinutes == null && extras.distanceKm == null && extras.restingHr == null)) return null
  const short = extras.sleepMinutes != null && extras.sleepMinutes < 7 * 60
  return (
    <div className="mt-3 rounded-2xl bg-surface-2 px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {extras.sleepMinutes != null && (
          <span className="flex items-center gap-1.5">
            <Icon name="moon" className="h-4 w-4 text-violet" />
            {t('Slept {time}', { time: sleepText(extras.sleepMinutes) })}
          </span>
        )}
        {extras.restingHr != null && (
          <span className="flex items-center gap-1.5">
            <Icon name="heart" className="h-4 w-4 text-over" />
            {t('Resting heart rate {n}', { n: extras.restingHr })}
          </span>
        )}
        {extras.distanceKm != null && (
          <span className="flex items-center gap-1.5">
            <Icon name="run" className="h-4 w-4 text-accent" />
            {t('{n} km walked', { n: extras.distanceKm.toLocaleString(locale(), { maximumFractionDigits: 1 }) })}
          </span>
        )}
      </div>
      {short && <p className="mt-1 text-xs text-muted">{t('Less than 7 hours of sleep often makes you hungrier the next day. An earlier night helps your diet too.')}</p>}
    </div>
  )
}

function StepsRow({ steps, goal, kcalFromSteps, onEdit }: { steps: number; goal: number; kcalFromSteps: number; onEdit: () => void }) {
  const pct = goal > 0 ? Math.min(100, (steps / goal) * 100) : 0
  return (
    <button onClick={onEdit} className="mt-3 block w-full text-left" aria-label={t('Steps: {n} of {goal}. Edit steps', { n: steps, goal })}>
      <div className="flex items-baseline justify-between text-sm">
        <span>
          <span className="num font-semibold">{steps.toLocaleString()}</span> <span className="text-muted">/ {goal.toLocaleString()} {t('steps')}</span>
        </span>
        <span className="num text-muted">{kcalFromSteps > 0 ? `${kcal(kcalFromSteps)} kcal` : steps ? '' : t('Tap to add')}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.07]">
        <div className="h-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" style={{ width: `${pct}%` }} />
      </div>
    </button>
  )
}

function ExerciseList({ date, covered }: { date: string; covered: boolean }) {
  const exercises = useStore((s) => s.exercises).filter((e) => e.date === date)
  const remove = useStore((s) => s.removeExercise)
  if (!exercises.length) return null
  return (
    <ul className="mt-2 divide-y divide-line">
      {exercises.map((e) => (
        <li key={e.id} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{tName(e.name)}</div>
            <div className="text-sm text-muted">
              {/* A tracker's day of workouts comes without a length. */}
              {e.minutes > 0 ? t('{n} min', { n: e.minutes }) : t('From Apple Health')}
              {e.distanceKm ? ` · ${e.distanceKm} km` : ''}
            </div>
          </div>
          <span className={`num font-semibold ${covered ? 'text-muted line-through decoration-1' : ''}`}>{kcal(e.kcal)}</span>
          <button onClick={() => remove(e.id)} className="p-1 text-muted" aria-label={t('Remove {name}', { name: tName(e.name) })}>
            <Icon name="trash" className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  )
}
