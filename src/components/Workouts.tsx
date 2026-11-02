import { useState } from 'react'
import { addDays, dateKey, parseKey, shortDate } from '../lib/date'
import { kcal } from '../lib/format'
import { getLang, locale, t, tName, tServing } from '../lib/i18n'
import { currentWeight, useStore, useTargets } from '../lib/store'
import {
  DEFAULT_WORKOUT_PREFS,
  buildWeek,
  fuelPicks,
  sessionKcal,
  weekdayIndex,
  workoutGoal,
  type Goal,
  type Session,
  type WorkoutPrefs,
} from '../lib/workouts'
import type { Food } from '../lib/types'
import { clock, startWorkout, volume, type ExerciseEntry, type WorkoutLog } from '../lib/training'
import { Card, Field, Icon, Segmented } from './ui'
import FoodDetail from './FoodDetail'
import ActiveWorkoutSheet, { WorkoutDone, useNow, type WorkoutSummary } from './ActiveWorkout'

const GOAL_TEXT: Record<Goal, string> = {
  lose: 'Strength days keep your muscle while you eat less, so the weight you lose is mostly fat. Cardio adds to your deficit.',
  maintain: 'A mix of strength and cardio keeps you strong and fit at the weight you’re at.',
  gain: 'More lifting and only a little cardio help the extra calories become muscle.',
}

/** Doses are numbers and units; only the units need translating. */
const tDose = (dose: string) => (getLang() === 'ka' ? dose.replace(/ min\b/, ' წთ').replace(/ s\b/g, ' წმ') : dose)

const KIND_ICON: Record<Session['kind'], 'bolt' | 'run' | 'leaf'> = { strength: 'bolt', cardio: 'run', intervals: 'run', mobility: 'leaf' }

/** A weekly workout plan that fits the person's goal, with each session's calories and food to go with it. */
export default function Workouts() {
  const profile = useStore((s) => s.profile)!
  const weight = useStore((s) => currentWeight(s))
  const prefs = useStore((s) => s.workoutPrefs)
  const active = useStore((s) => s.activeWorkout)
  const history = useStore((s) => s.workoutLog)
  const setActive = useStore((s) => s.setActiveWorkout)
  const [editing, setEditing] = useState(false)
  // A workout in progress opens straight away when coming back to this page.
  const [tracking, setTracking] = useState(!!active)
  const [summary, setSummary] = useState<WorkoutSummary | null>(null)
  const goal = workoutGoal(weight, profile.goalWeightKg, profile.ratePerWeekKg)

  const start = (session: Session | null) => {
    if (!active) setActive(startWorkout(session, history, dateKey(), Date.now()))
    setTracking(true)
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="py-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t('Workouts')}</h1>
        <p className="text-muted">{t('A weekly plan that fits your goal and your diet.')}</p>
      </div>
      {active && <ResumeCard title={active.title} startedAt={active.startedAt} onOpen={() => setTracking(true)} />}
      {!prefs || editing ? <PlanSetup goal={goal} onDone={() => setEditing(false)} /> : <Plan prefs={prefs} goal={goal} onEdit={() => setEditing(true)} onStart={start} />}
      {!editing && !active && (
        <Card className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t('Your own workout')}</span>
            <span className="block text-sm text-muted">{t('Start an empty workout and add any exercise, like barbell squats or deadlifts.')}</span>
          </span>
          <button className="btn btn-quiet shrink-0" onClick={() => start(null)}>
            {t('Start')}
          </button>
        </Card>
      )}
      {!editing && history.length > 0 && <History logs={history} />}
      {tracking && active && (
        <ActiveWorkoutSheet
          onClose={() => setTracking(false)}
          onFinished={(s) => {
            setTracking(false)
            setSummary(s)
          }}
        />
      )}
      {summary && <WorkoutDone summary={summary} onClose={() => setSummary(null)} />}
    </div>
  )
}

function ResumeCard({ title, startedAt, onOpen }: { title: string; startedAt: number; onOpen: () => void }) {
  const now = useNow(1000)
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-[20px] bg-accent px-4 py-3 text-left text-accent-ink">
      <Icon name="bolt" className="h-6 w-6 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{t('Workout in progress')}</span>
        <span className="block truncate text-sm opacity-80">
          {tName(title)} · {clock(now - startedAt)}
        </span>
      </span>
      <span className="font-semibold">{t('Resume')}</span>
    </button>
  )
}

function GoalLine({ goal }: { goal: Goal }) {
  const profile = useStore((s) => s.profile)!
  const label = goal === 'lose' ? t('lose {kg} kg a week', { kg: profile.ratePerWeekKg }) : goal === 'gain' ? t('Gain weight') : t('keep weight steady')
  return (
    <p className="text-sm text-muted">
      <span className="font-semibold text-ink">{t('Your goal')}: {label}.</span> {t(GOAL_TEXT[goal])}
    </p>
  )
}

function PlanSetup({ goal, onDone }: { goal: Goal; onDone: () => void }) {
  const saved = useStore((s) => s.workoutPrefs)
  const setWorkoutPrefs = useStore((s) => s.setWorkoutPrefs)
  const [p, setP] = useState<WorkoutPrefs>(saved ?? DEFAULT_WORKOUT_PREFS)
  const set = (next: Partial<WorkoutPrefs>) => setP((cur) => ({ ...cur, ...next }))

  return (
    <Card className="space-y-4">
      <h2 className="font-display text-lg font-semibold">{t(saved ? 'Change your plan' : 'Make your plan')}</h2>
      <GoalLine goal={goal} />
      <Field label={t('Where do you train?')}>
        <Segmented
          value={p.place}
          onChange={(place) => set({ place })}
          options={[
            { value: 'home', label: t('Home') },
            { value: 'gym', label: t('Gym') },
            { value: 'outdoor', label: t('Outdoors') },
          ]}
        />
      </Field>
      <Field label={t('Days a week')}>
        <Segmented value={String(p.days)} onChange={(d) => set({ days: Number(d) as WorkoutPrefs['days'] })} options={['2', '3', '4', '5'].map((d) => ({ value: d, label: d }))} />
      </Field>
      <Field label={t('Minutes per workout')}>
        <Segmented value={String(p.minutes)} onChange={(m) => set({ minutes: Number(m) as WorkoutPrefs['minutes'] })} options={['20', '30', '45', '60'].map((m) => ({ value: m, label: m }))} />
      </Field>
      <Field label={t('Your level')}>
        <Segmented
          value={p.level}
          onChange={(level) => set({ level })}
          wrap
          options={[
            { value: 'beginner', label: t('Beginner') },
            { value: 'intermediate', label: t('Intermediate') },
            { value: 'advanced', label: t('Experienced') },
          ]}
        />
      </Field>
      <Field label={t('Workout time (optional)')} hint={t('Shown on your plan; the iPhone app can remind you at this time (Me → Reminders).')}>
        <div className="flex gap-2">
          <input type="time" className="field num" value={p.time ?? ''} onChange={(e) => set({ time: e.target.value || undefined })} aria-label={t('Workout time (optional)')} />
          {p.time && (
            <button className="btn btn-quiet shrink-0" onClick={() => set({ time: undefined })}>
              {t('Clear')}
            </button>
          )}
        </div>
      </Field>
      <div className="flex gap-2">
        {saved && (
          <button className="btn btn-quiet flex-1" onClick={onDone}>
            {t('Cancel')}
          </button>
        )}
        <button
          className="btn btn-primary flex-1"
          onClick={() => {
            setWorkoutPrefs(p)
            onDone()
          }}
        >
          {t(saved ? 'Save plan' : 'Make my workout plan')}
        </button>
      </div>
    </Card>
  )
}

function Plan({ prefs, goal, onEdit, onStart }: { prefs: WorkoutPrefs; goal: Goal; onEdit: () => void; onStart: (s: Session) => void }) {
  const weight = useStore((s) => currentWeight(s))
  const eatBack = useStore((s) => s.settings.exerciseEatBack)
  const stepGoal = useStore((s) => s.settings.stepGoal)
  const targets = useTargets()!
  const week = buildWeek(prefs, goal)
  const today = dateKey()
  const todayIndex = weekdayIndex(new Date())
  const monday = addDays(today, -todayIndex)
  const sessions = week.filter((s): s is Session => !!s)
  const weekKcal = sessions.reduce((n, s) => n + sessionKcal(s, weight), 0)
  const avgKcal = sessions.length ? weekKcal / sessions.length : 0
  const next = week.slice(todayIndex + 1).findIndex((s) => s)

  return (
    <>
      <TodaySession
        session={week[todayIndex]}
        date={today}
        time={prefs.time}
        onStart={onStart}
        nextTitle={next >= 0 ? week[todayIndex + 1 + next]!.title : undefined}
        nextDay={next >= 0 ? addDays(today, next + 1) : undefined}
        stepGoal={stepGoal}
      />

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{t('With your diet')}</h2>
        <GoalLine goal={goal} />
        <ul className="space-y-2 text-sm">
          <li className="flex gap-2">
            <Icon name="flame" className="mt-0.5 h-4 w-4 shrink-0 text-carbs" />
            <span>{t('This plan burns about {kcal} kcal a week in {n} workouts.', { kcal: kcal(weekKcal), n: sessions.length })}</span>
          </li>
          <li className="flex gap-2">
            <Icon name="chart" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>
              {eatBack === 0
                ? t('Exercise calories aren’t added to your budget (Me → Targets), so workouts make your deficit bigger.')
                : t('Workout days add about {n} kcal to that day’s budget ({share} of what you burn).', { n: kcal(avgKcal * eatBack), share: t(eatBack === 1 ? 'all' : 'half') })}
            </span>
          </li>
          <li className="flex gap-2">
            <Icon name="leaf" className="mt-0.5 h-4 w-4 shrink-0 text-protein" />
            <span>{t('Eat about {g} g of protein a day to recover and keep muscle; after strength days have 20–40 g within a few hours.', { g: targets.protein })}</span>
          </li>
        </ul>
        <Fuel />
      </Card>

      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t('This week')}</h2>
          <button className="text-sm font-medium text-accent" onClick={onEdit}>
            {t('Change plan')}
          </button>
        </div>
        <ul className="divide-y divide-line">
          {week.map((s, i) => (
            <WeekRow key={i} session={s} date={addDays(monday, i)} isToday={i === todayIndex} />
          ))}
        </ul>
      </Card>
    </>
  )
}

const weekdayName = (date: string, style: 'long' | 'short' = 'long') => parseKey(date).toLocaleDateString(locale(), { weekday: style })

function useDone(session: Session | null, date: string) {
  const exercises = useStore((s) => s.exercises)
  return session ? exercises.find((e) => e.date === date && e.name === session.title) : undefined
}

function TodaySession({
  session,
  date,
  time,
  onStart,
  nextTitle,
  nextDay,
  stepGoal,
}: {
  session: Session | null
  date: string
  time?: string
  onStart: (s: Session) => void
  nextTitle?: string
  nextDay?: string
  stepGoal: number
}) {
  if (!session) {
    return (
      <Card className="space-y-1">
        <div className="text-sm font-medium text-muted">{t('Today')}</div>
        <h2 className="font-display text-xl font-semibold">{t('Rest day')}</h2>
        <p className="text-sm text-muted">
          {t('Muscles grow while you rest. Take a walk and aim for {n} steps.', { n: stepGoal.toLocaleString(locale()) })}
          {nextTitle && nextDay && <> {t('Next: {title} on {day}.', { title: tName(nextTitle), day: weekdayName(nextDay) })}</>}
        </p>
      </Card>
    )
  }
  return (
    <Card className="space-y-3">
      <div className="text-sm font-medium text-muted">{t('Today’s workout')}</div>
      <SessionDetail session={session} date={date} time={time} onStart={() => onStart(session)} open />
    </Card>
  )
}

function WeekRow({ session, date, isToday }: { session: Session | null; date: string; isToday: boolean }) {
  const weight = useStore((s) => currentWeight(s))
  const done = useDone(session, date)
  const [open, setOpen] = useState(false)
  return (
    <li className="py-2.5">
      <button className="flex w-full items-center gap-3 text-left disabled:cursor-default" disabled={!session} onClick={() => setOpen(!open)} aria-expanded={session ? open : undefined}>
        <span className={`w-12 shrink-0 text-sm ${isToday ? 'font-semibold text-accent' : 'text-muted'}`}>{weekdayName(date, 'short')}</span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate ${session ? 'font-medium' : 'text-muted'}`}>{session ? tName(session.title) : t('Rest')}</span>
          {session && <span className="block text-xs text-muted">{t('{min} min · about {kcal} kcal', { min: session.minutes, kcal: kcal(sessionKcal(session, weight)) })}</span>}
        </span>
        {done && (
          <>
            <Icon name="check" className="h-5 w-5 text-accent" />
            <span className="sr-only">{t('Done')}</span>
          </>
        )}
        {session && <Icon name={open ? 'up' : 'down'} className="h-4 w-4 text-muted" />}
      </button>
      {session && open && (
        <div className="mt-3">
          <SessionDetail session={session} date={date} />
        </div>
      )}
    </li>
  )
}

function SessionDetail({ session, date, time, onStart, open = false }: { session: Session; date: string; time?: string; onStart?: () => void; open?: boolean }) {
  const weight = useStore((s) => currentWeight(s))
  const addExercise = useStore((s) => s.addExercise)
  const removeExercise = useStore((s) => s.removeExercise)
  const active = useStore((s) => s.activeWorkout)
  const logs = useStore((s) => s.workoutLog)
  const done = useDone(session, date)
  const log = done && logs.find((l) => l.exerciseLogId === done.id)
  const burn = sessionKcal(session, weight)
  const canLog = date <= dateKey()
  const quickLog = () => addExercise({ date, name: session.title, minutes: session.minutes, kcal: burn, met: session.met })

  return (
    <div className="space-y-3">
      {open && (
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Icon name={KIND_ICON[session.kind]} className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold">{tName(session.title)}</h2>
            <p className="text-sm text-muted">
              {t('{min} min · about {kcal} kcal', { min: session.minutes, kcal: kcal(burn) })}
              {time && ` · ${t('at {time}', { time })}`}
            </p>
          </div>
        </div>
      )}
      <ol className="space-y-2">
        {session.moves.map((m, i) => (
          <li key={i} className="rounded-2xl bg-surface-2 px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              {/* Cardio moves are named after their session, whose Georgian name is with the other activity names. */}
              <span className="font-medium">{tName(t(m.name))}</span>
              <span className="num shrink-0 text-sm font-semibold text-accent">{tDose(m.dose)}</span>
            </div>
            <p className="mt-0.5 text-sm text-muted">{t(m.cue)}</p>
          </li>
        ))}
      </ol>
      {session.kind === 'strength' && <p className="text-xs text-muted">{t('Rest 60–90 s between sets. When the last reps feel easy, add reps or weight next time.')}</p>}
      {canLog &&
        (done ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-accent-soft px-3 py-2.5">
            <span className="flex items-center gap-2 font-medium text-accent">
              <Icon name="check" className="h-5 w-5 shrink-0" /> {log ? logSummary(log) : t('Done · {kcal} kcal added to your day', { kcal: kcal(done.kcal) })}
            </span>
            <button className="text-sm text-muted underline" onClick={() => removeExercise(done.id)}>
              {t('Undo')}
            </button>
          </div>
        ) : onStart ? (
          <div className="space-y-2">
            <button className="btn btn-primary w-full text-lg" onClick={onStart}>
              <Icon name="bolt" className="h-5 w-5" /> {t(active ? 'Resume workout' : 'Start workout')}
            </button>
            {!active && (
              <button className="w-full py-1 text-center text-sm text-muted underline" onClick={quickLog}>
                {t('Already did it? Mark as done')}
              </button>
            )}
          </div>
        ) : (
          <button className="btn btn-primary w-full" onClick={quickLog}>
            <Icon name="check" className="h-5 w-5" /> {t('Mark as done')}
          </button>
        ))}
    </div>
  )
}

/** "34 min · 12 sets · 1,240 kg · 145 kcal" */
function logSummary(log: WorkoutLog) {
  const sets = log.exercises.reduce((n, e) => n + e.sets.length, 0)
  const lifted = volume(log.exercises)
  return [t('{n} min', { n: log.minutes }), t('{n} sets', { n: sets }), lifted ? `${lifted.toLocaleString()} ${t('kg')}` : '', `${kcal(log.kcal)} ${t('kcal')}`].filter(Boolean).join(' · ')
}

function setsText(e: ExerciseEntry) {
  if (e.type === 'weighted') return e.sets.map((s) => `${s.kg} ${t('kg')} × ${s.reps}`).join(', ')
  if (e.type === 'time') return e.sets.map((s) => t('{n} min', { n: s.reps })).join(', ')
  return e.sets.map((s) => (e.type === 'hold' ? tDose(`${s.reps} s`) : String(s.reps))).join(', ')
}

function History({ logs }: { logs: WorkoutLog[] }) {
  const recent = [...logs].sort((a, b) => b.startedAt - a.startedAt).slice(0, 8)
  return (
    <Card className="space-y-2">
      <h2 className="font-display text-lg font-semibold">{t('Recent workouts')}</h2>
      <ul className="divide-y divide-line">
        {recent.map((log) => (
          <HistoryRow key={log.id} log={log} />
        ))}
      </ul>
    </Card>
  )
}

function HistoryRow({ log }: { log: WorkoutLog }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="py-2.5">
      <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="w-14 shrink-0 text-sm text-muted">{shortDate(log.date)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{tName(log.title)}</span>
          <span className="block text-xs text-muted">{logSummary(log)}</span>
        </span>
        <Icon name={open ? 'up' : 'down'} className="h-4 w-4 text-muted" />
      </button>
      {open && (
        <ul className="mt-2 space-y-1 pl-[68px] text-sm">
          {log.exercises.map((e, i) => (
            <li key={i}>
              <span className="font-medium">{tName(t(e.name))}</span> <span className="text-muted">{setsText(e)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function Fuel() {
  const diet = useStore((s) => s.planPrefs.diet)
  const allergies = useStore((s) => s.settings.allergies)
  const [food, setFood] = useState<Food | null>(null)
  const picks = fuelPicks(diet, allergies)
  const list = (title: string, foods: Food[]) =>
    foods.length > 0 && (
      <div>
        <h3 className="mb-1 text-sm font-medium text-muted">{title}</h3>
        <ul className="divide-y divide-line rounded-2xl bg-surface-2 px-3">
          {foods.map((f) => {
            const s = f.servings[0]
            const grams = s?.grams ?? 100
            return (
              <li key={f.id}>
                <button className="flex w-full items-center gap-3 py-2.5 text-left" onClick={() => setFood(f)}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{tName(f.name)}</span>
                    <span className="block text-xs text-muted">{s ? tServing(s.label) : '100 g'}</span>
                  </span>
                  <span className="num shrink-0 text-right text-sm">
                    <span className="block font-semibold">{kcal((f.per100.kcal * grams) / 100)} {t('kcal')}</span>
                    <span className="block text-xs text-protein">{t('{g} g protein', { g: Math.round((f.per100.protein * grams) / 10) / 10 })}</span>
                  </span>
                  <Icon name="plus" className="h-5 w-5 shrink-0 text-accent" />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  return (
    <div className="space-y-3">
      {list(t('Before a workout (1–2 hours before)'), picks.before)}
      {list(t('After a workout'), picks.after)}
      <p className="text-xs text-muted">{t('Picked to fit your diet and allergies in Me. Tap one to add it to today.')}</p>
      {food && <FoodDetail food={food} date={dateKey()} initialMeal="snack" onClose={() => setFood(null)} />}
    </div>
  )
}
