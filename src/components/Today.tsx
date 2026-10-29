import { useEffect, useRef, useState } from 'react'
import { addDays, dateKey, dayLabel, shortDate } from '../lib/date'
import { kcal, num } from '../lib/format'
import { t, tName } from '../lib/i18n'
import { useDay, useStore, useTargets } from '../lib/store'
import { mealTotals } from '../lib/plan'
import { logStreak } from '../lib/insights'
import { MEALS, type DiaryEntry, type Meal } from '../lib/types'
import { Card, Field, Icon, MacroBar, Sheet } from './ui'
import FoodDetail from './FoodDetail'
import ExerciseSheet from './ExerciseSheet'
import WatchSheet from './Watch'
import FastingCard from './Fasting'
import { OrbView } from './ThreeViews'
import { CalendarMonth } from './Calendar'
import { useReportDue } from './WeeklyReport'

/** Animates a number toward its new value so changes are easy to notice. */
function useCountUp(value: number, ms = 700) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
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

export default function Today({
  date,
  setDate,
  onAdd,
  onOpenCoach,
}: {
  date: string
  setDate: (d: string) => void
  onAdd: (m: Meal) => void
  onOpenCoach: () => void
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

  const budget = targets.kcal + day.bonus
  const remaining = budget - day.totals.kcal
  const over = remaining < 0
  const shownRemaining = useCountUp(Math.abs(remaining))
  const isToday = date === dateKey()
  const streak = logStreak(entries, dateKey())

  return (
    <div className="space-y-3 pt-1">
      <header className="flex items-center justify-between py-2">
        <button onClick={() => setCalendarOpen(true)} className="text-left" aria-label={t('Open calendar')}>
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
            {dayLabel(date)}
            <Icon name="calendar" className="h-5 w-5 text-muted" />
          </h1>
          {isToday && streak >= 2 && (
            <div className="flex items-center gap-1 text-sm font-semibold text-carbs">
              <Icon name="flame" className="h-4 w-4 drop-shadow-[0_0_6px_rgb(255_197_71/0.8)]" /> {t('{n}-day logging streak', { n: streak })}
            </div>
          )}
        </button>
        <div className="flex items-center gap-1.5">
          {!isToday && (
            <button onClick={() => setDate(dateKey())} className="mr-1 rounded-full px-3 py-1.5 text-sm font-semibold text-accent">
              {t('Today')}
            </button>
          )}
          <button onClick={() => setDate(addDays(date, -1))} className="glass rounded-full p-2" aria-label={t('Previous day')}>
            <Icon name="left" />
          </button>
          <button onClick={() => setDate(addDays(date, 1))} className="glass rounded-full p-2" aria-label={t('Next day')}>
            <Icon name="right" />
          </button>
        </div>
      </header>

      <section aria-label={t('Calories today')}>
        <div className="relative mx-auto -mt-2 h-[250px] w-[250px]">
          <div
            className="pointer-events-none absolute inset-6 rounded-full blur-2xl"
            style={{ background: over ? 'rgb(255 90 74 / 0.28)' : 'rgb(69 240 160 / 0.22)' }}
          />
          <OrbView fill={budget > 0 ? day.totals.kcal / budget : 0} over={over} />
        </div>
        <div className="-mt-1 text-center">
          <div className={`num text-[56px] font-bold leading-none tracking-tight ${over ? 'text-over' : 'glow-text'}`}>{kcal(shownRemaining)}</div>
          <div className="mt-1 text-sm font-medium text-muted">{over ? t('kcal over budget') : t('kcal left today')}</div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label={t('Eaten')} value={day.totals.kcal} />
          <Stat label={t('Budget')} value={budget} hint={day.bonus > 0 ? t('+{n} exercise', { n: kcal(day.bonus) }) : undefined} />
          <Stat label={t('Burned')} value={day.burned} />
        </div>
        <Card className="mt-3">
          <div className="flex gap-4">
            <MacroBar label={t('Protein')} value={day.totals.protein} target={targets.protein} color="var(--protein)" />
            <MacroBar label={t('Carbs')} value={day.totals.carbs} target={targets.carbs} color="var(--carbs)" />
            <MacroBar label={t('Fat')} value={day.totals.fat} target={targets.fat} color="var(--fat)" />
          </div>
        </Card>
      </section>

      {isToday && reportDue && (
        <button onClick={onOpenCoach} className="glass flex w-full items-center gap-3 rounded-[24px] p-4 text-left">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet/25 text-violet">
            <Icon name="report" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">{t('Your weekly report is ready')}</span>
            <span className="block text-sm text-muted">{t('See how this week went and what to change')}</span>
          </span>
          <Icon name="right" className="h-5 w-5 text-muted" />
        </button>
      )}

      {isToday && settings.showFasting && <FastingCard />}

      {MEALS.map((m) => (
        <MealCard
          key={m.id}
          date={date}
          meal={m.id}
          label={t(m.label)}
          entries={day.entries.filter((e) => e.meal === m.id)}
          onAdd={() => onAdd(m.id)}
          onOpen={setEditing}
        />
      ))}

      <WaterCard key={date} date={date} />

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t('Exercise')}</h2>
          <span className="num text-sm text-muted">{t('{n} kcal burned', { n: kcal(day.burned) })}</span>
        </div>
        {day.device && (
          <button onClick={() => setWatchOpen(true)} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-accent/[0.07] px-3 py-2.5 text-left">
            <Icon name="watch" className="h-6 w-6 shrink-0 text-accent drop-shadow-[0_0_6px_rgb(69_240_160/0.6)]" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t('Watch: {n} active kcal', { n: kcal(day.device.activeKcal) })}</span>
              <span className="block text-xs text-muted">{t('{n} kcal above a normal day count toward your budget', { n: kcal(day.burned) })}</span>
            </span>
            <Icon name="right" className="h-5 w-5 shrink-0 text-muted" />
          </button>
        )}
        <StepsRow
          steps={day.steps}
          goal={settings.stepGoal}
          kcalFromSteps={day.fromSteps}
          onEdit={() => (day.device ? setWatchOpen(true) : setExerciseOpen(true))}
        />
        {day.device && day.exercises.length > 0 && (
          <p className="mt-3 text-xs text-muted">{t('Workouts below are already part of your watch’s calories, so they aren’t counted twice.')}</p>
        )}
        <ExerciseList date={date} covered={!!day.device} />
        <div className="mt-2 flex items-center gap-5">
          <button onClick={() => setExerciseOpen(true)} className="flex items-center gap-1.5 py-1 font-semibold text-accent">
            <Icon name="plus" className="h-4 w-4" /> {t('Add exercise')}
          </button>
          {!day.device && (
            <button onClick={() => setWatchOpen(true)} className="flex items-center gap-1.5 py-1 font-semibold text-accent">
              <Icon name="watch" className="h-4 w-4" /> {t('Watch')}
            </button>
          )}
        </div>
      </Card>

      {editing && (
        <FoodDetail
          food={editing.food ?? { id: editing.id, name: editing.name, per100: perHundred(editing), servings: [], source: 'quick' }}
          initialGrams={editing.grams}
          initialMeal={editing.meal}
          entry={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {exerciseOpen && <ExerciseSheet date={date} onClose={() => setExerciseOpen(false)} />}
      {watchOpen && <WatchSheet date={date} onClose={() => setWatchOpen(false)} />}
      {calendarOpen && (
        <Sheet title={t('Pick a day')} onClose={() => setCalendarOpen(false)}>
          <CalendarMonth
            selected={date}
            onPick={(d) => {
              setDate(d)
              setCalendarOpen(false)
            }}
          />
        </Sheet>
      )}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="glass rounded-2xl px-2 py-2.5 text-center">
      <div className="num text-xl font-semibold">{kcal(value)}</div>
      <div className="text-[11px] font-medium text-muted">{label}</div>
      {hint && <div className="text-[10px] font-semibold text-accent">{hint}</div>}
    </div>
  )
}

function perHundred(e: DiaryEntry) {
  const f = e.grams > 0 ? 100 / e.grams : 1
  return { kcal: e.nutrients.kcal * f, protein: e.nutrients.protein * f, carbs: e.nutrients.carbs * f, fat: e.nutrients.fat * f }
}

const MEAL_ICON: Record<Meal, string> = { breakfast: '🍳', lunch: '🥗', dinner: '🍲', snack: '🍎' }

function MealCard({
  date,
  meal,
  label,
  entries,
  onAdd,
  onOpen,
}: {
  date: string
  meal: Meal
  label: string
  entries: DiaryEntry[]
  onAdd: () => void
  onOpen: (e: DiaryEntry) => void
}) {
  const copyMeal = useStore((s) => s.copyMeal)
  const allEntries = useStore((s) => s.entries)
  const mealPlan = useStore((s) => s.mealPlan)
  const logPlanMeal = useStore((s) => s.logPlanMeal)
  const planned = (mealPlan?.days.find((d) => d.date === date)?.meals ?? []).filter((m) => m.meal === meal && !m.logged)
  const [saving, setSaving] = useState(false)
  const yesterday = addDays(date, -1)
  const yesterdayCount = entries.length === 0 ? allEntries.filter((e) => e.date === yesterday && e.meal === meal).length : 0
  const total = entries.reduce((n, e) => n + e.nutrients.kcal, 0)

  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] text-xl" aria-hidden="true">
          {MEAL_ICON[meal]}
        </span>
        <h2 className="flex-1 font-display text-lg font-semibold">{label}</h2>
        <span className="num text-sm">
          <span className="font-semibold">{kcal(total)}</span> <span className="text-muted">kcal</span>
        </span>
        <button onClick={onAdd} className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent" aria-label={t('Add food to {meal}', { meal: label })}>
          <Icon name="plus" className="h-5 w-5" />
        </button>
      </div>
      {entries.length > 0 && (
        <ul className="mt-2 divide-y divide-line">
          {entries.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => onOpen(e)}
                aria-label={`${tName(e.name)}, ${e.amountLabel}, ${kcal(e.nutrients.kcal)} kcal`}
                className="flex w-full items-center gap-3 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{tName(e.name)}</div>
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
      {(yesterdayCount > 0 || entries.length >= 2) && (
        <div className="mt-1 flex items-center gap-4">
          {yesterdayCount > 0 && (
            <button onClick={() => copyMeal(yesterday, meal, date)} className="flex items-center gap-1.5 py-1.5 text-sm text-muted">
              <Icon name="copy" className="h-4 w-4" /> {t('Same as yesterday')}
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
  )
}

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
    <Card>
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
              {t('{n} min', { n: e.minutes })}
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
