import { useMemo, useState } from 'react'
import { t, tName } from '../lib/i18n'
import { estimateWorkout } from '../lib/ai'
import { BASELINE_STEPS, EXERCISES, EXERCISE_CATEGORIES, exerciseKcal, metForSpeed, stepsKcal, type ExerciseType } from '../lib/exercises'
import { kcal, num } from '../lib/format'
import { normalize } from '../lib/search'
import { currentWeight, useStore } from '../lib/store'
import type { ExerciseLog } from '../lib/types'
import { ErrorNote, Field, Icon, Segmented, Sheet, Spinner } from './ui'
import { Chip } from './FoodDetail'
import AiKeySetup from './AiKeySetup'

type Tab = 'activity' | 'steps' | 'describe'

export default function ExerciseSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('activity')
  return (
    <Sheet title={t('Add exercise')} onClose={onClose}>
      <div className="space-y-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'activity', label: t('Activity') },
            { value: 'steps', label: t('Steps') },
            { value: 'describe', label: t('Describe (AI)') },
          ]}
        />
        {tab === 'activity' && <ActivityTab date={date} onDone={onClose} />}
        {tab === 'steps' && <StepsTab date={date} onDone={onClose} />}
        {tab === 'describe' && <DescribeTab date={date} onDone={onClose} />}
      </div>
    </Sheet>
  )
}

function ActivityTab({ date, onDone }: { date: string; onDone: () => void }) {
  const exercises = useStore((s) => s.exercises)
  const addExercise = useStore((s) => s.addExercise)
  const weight = useStore((s) => currentWeight(s))
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(EXERCISE_CATEGORIES[0])
  const [picked, setPicked] = useState<ExerciseType | null>(null)

  // Most recent distinct workouts, newest first, so a regular session is one tap.
  const recent = useMemo(() => {
    const seen = new Set<string>()
    const out: ExerciseLog[] = []
    for (let i = exercises.length - 1; i >= 0 && out.length < 5; i--) {
      const e = exercises[i]
      const key = `${e.name}|${e.minutes}|${e.distanceKm ?? ''}`
      if (e.met == null || seen.has(key)) continue
      seen.add(key)
      out.push(e)
    }
    return out
  }, [exercises])

  const q = normalize(query)
  const list = q ? EXERCISES.filter((e) => normalize(e.name).includes(q)) : EXERCISES.filter((e) => e.category === category)

  if (picked) return <ActivityDetail type={picked} date={date} onBack={() => setPicked(null)} onDone={onDone} />

  return (
    <div className="space-y-4">
      {recent.length > 0 && !q && (
        <div>
          <h3 className="mb-1 text-sm font-medium text-muted">{t('Repeat a recent workout')}</h3>
          <ul className="divide-y divide-line rounded-[18px] bg-surface px-4">
            {recent.map((e) => {
              const burned = exerciseKcal(e.met!, weight, e.minutes)
              return (
                <li key={e.id}>
                  <button
                    className="flex w-full items-center gap-3 py-3 text-left"
                    onClick={() => {
                      addExercise({ date, name: e.name, minutes: e.minutes, met: e.met, distanceKm: e.distanceKm, kcal: burned })
                      onDone()
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{tName(e.name)}</div>
                      <div className="text-sm text-muted">
                        {t('{n} min', { n: e.minutes })}{e.distanceKm ? ` · ${e.distanceKm} km` : ''}
                      </div>
                    </div>
                    <span className="num text-sm">
                      <span className="font-semibold">{kcal(burned)}</span> <span className="text-muted">{t('kcal')}</span>
                    </span>
                    <Icon name="plus" className="h-5 w-5 text-accent" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input type="search" className="field pl-10" placeholder={t('Search activities')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {!q && (
        <div className="flex flex-wrap gap-2">
          {EXERCISE_CATEGORIES.map((c) => (
            <Chip key={c} active={c === category} onClick={() => setCategory(c)}>
              {tName(c)}
            </Chip>
          ))}
        </div>
      )}
      <ul className="divide-y divide-line rounded-[18px] bg-surface px-4">
        {list.map((e) => (
          <li key={e.name}>
            <button className="flex w-full items-center gap-3 py-3 text-left" onClick={() => setPicked(e)}>
              <span className="flex-1 font-medium">{tName(e.name)}</span>
              <span className="num text-sm text-muted">{t('{n} kcal / 30 min', { n: kcal(exerciseKcal(e.met, weight, 30)) })}</span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="py-3 text-muted">{t('No match. Try the Describe (AI) tab.')}</li>}
      </ul>
    </div>
  )
}

function ActivityDetail({ type, date, onBack, onDone }: { type: ExerciseType; date: string; onBack: () => void; onDone: () => void }) {
  const addExercise = useStore((s) => s.addExercise)
  const weight = useStore((s) => currentWeight(s))
  const [minutes, setMinutes] = useState('30')
  const [distance, setDistance] = useState('')

  const mins = num(minutes)
  const km = num(distance)
  const speed = type.distance && km > 0 && mins > 0 ? km / (mins / 60) : 0
  const met = speed ? metForSpeed(type.distance!, speed) : type.met
  const burned = exerciseKcal(met, weight, mins)

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-medium text-accent">
        <Icon name="left" className="h-4 w-4" /> {t('All activities')}
      </button>
      <h3 className="font-display text-2xl font-semibold">{tName(type.name)}</h3>

      <Field label={t('Minutes')}>
        <input className="field num text-2xl" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        <div className="mt-2 flex flex-wrap gap-2">
          {[15, 30, 45, 60, 90].map((m) => (
            <Chip key={m} active={mins === m} onClick={() => setMinutes(String(m))}>
              {t('{n} min', { n: m })}
            </Chip>
          ))}
        </div>
      </Field>

      {type.distance && (
        <Field label={t('Distance, km (optional)')} hint={speed ? t('{speed} km/h, so the effort is set from your speed', { speed: speed.toFixed(1) }) : t('Add it for a more exact number')}>
          <input className="field num" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="5" />
        </Field>
      )}

      <div className="rounded-[20px] bg-surface p-5">
        <div className="flex items-baseline gap-2">
          <span className="num text-5xl font-bold tracking-tight">{kcal(burned)}</span>
          <span className="text-muted">{t('kcal burned')}</span>
        </div>
        <p className="mt-2 text-sm text-muted">
          {t('Extra calories above resting, for your weight of {kg} kg. Your daily target already covers what you burn sitting still.', { kg: weight })}
        </p>
      </div>

      <button
        className="btn btn-primary w-full text-lg"
        disabled={burned <= 0}
        onClick={() => {
          addExercise({ date, name: type.name, minutes: Math.round(mins), met: Math.round(met * 10) / 10, distanceKm: km || undefined, kcal: burned })
          onDone()
        }}
      >
        {t('Add {n} kcal', { n: kcal(burned) })}
      </button>
    </div>
  )
}

function StepsTab({ date, onDone }: { date: string; onDone: () => void }) {
  const saved = useStore((s) => s.steps[date] ?? 0)
  const setSteps = useStore((s) => s.setSteps)
  const profile = useStore((s) => s.profile)!
  const weight = useStore((s) => currentWeight(s))
  const goal = useStore((s) => s.settings.stepGoal)
  const [value, setValue] = useState(saved ? String(saved) : '')
  const steps = num(value)
  const baseline = BASELINE_STEPS[profile.activity]

  return (
    <div className="space-y-4">
      <p className="text-muted">
        {t('Copy today’s steps from the Health app or your watch. Plate can’t read Apple Health directly, so update the number whenever you like.')}
      </p>
      <Field label={t('Steps today')}>
        <input className="field num text-3xl" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
      </Field>
      <div className="rounded-[20px] bg-surface p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">{t('Daily goal')}</span>
          <span className="num font-semibold">{goal.toLocaleString()}</span>
        </div>
        <div className="mt-2 flex justify-between">
          <span className="text-muted">{t('Calories counted')}</span>
          <span className="num font-semibold">{kcal(stepsKcal(steps, weight, profile.activity))} {t('kcal')}</span>
        </div>
        <p className="mt-3 text-muted">
          {t('Your activity level already includes about {n} steps a day, so only steps above that add calories. If your watch already counted a walk, don’t add it again as an activity.', { n: baseline.toLocaleString() })}
        </p>
      </div>
      <button
        className="btn btn-primary w-full text-lg"
        onClick={() => {
          setSteps(date, steps)
          onDone()
        }}
      >
        {t('Save steps')}
      </button>
    </div>
  )
}

interface Part {
  name: string
  met: number
  minutes: string
  include: boolean
}

function DescribeTab({ date, onDone }: { date: string; onDone: () => void }) {
  const settings = useStore((s) => s.settings)
  const addExercise = useStore((s) => s.addExercise)
  const weight = useStore((s) => currentWeight(s))
  const [text, setText] = useState('')
  const [parts, setParts] = useState<Part[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!settings.geminiKey) return <AiKeySetup />

  async function run() {
    setLoading(true)
    setError('')
    setParts(null)
    try {
      const result = await estimateWorkout({ key: settings.geminiKey, model: settings.geminiModel }, text.trim())
      setParts(result.map((p) => ({ name: p.name, met: p.met, minutes: String(p.minutes), include: true })))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not estimate that workout.'))
    } finally {
      setLoading(false)
    }
  }

  const chosen = (parts ?? []).filter((p) => p.include && num(p.minutes) > 0)
  const total = chosen.reduce((n, p) => n + exerciseKcal(p.met, weight, num(p.minutes)), 0)

  return (
    <div className="space-y-4">
      <textarea
        className="field min-h-28"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('e.g. 45 min at the gym: squats, bench press and rows, then 15 min on the treadmill')}
      />
      <button className="btn btn-primary w-full" disabled={!text.trim() || loading} onClick={run}>
        <Icon name="sparkle" className="h-5 w-5" /> {t('Work out calories')}
      </button>
      {loading && <Spinner label={t('Working it out…')} />}
      {error && <ErrorNote>{error}</ErrorNote>}
      {parts && (
        <div className="space-y-3">
          {parts.length === 0 && <p className="text-muted">{t('No activity found. Add more detail, like what you did and for how long.')}</p>}
          <ul className="divide-y divide-line rounded-[18px] bg-surface px-4">
            {parts.map((p, i) => (
              <li key={i} className={`flex items-center gap-3 py-3 ${p.include ? '' : 'opacity-45'}`}>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--accent)]"
                  checked={p.include}
                  onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))}
                  aria-label={t('Include {name}', { name: p.name })}
                />
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <label className="flex items-center gap-1 text-sm text-muted">
                  <input
                    className="field num w-14 px-2 py-1 text-right"
                    inputMode="numeric"
                    value={p.minutes}
                    onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, minutes: e.target.value } : x)))}
                    aria-label={t('Minutes of {name}', { name: p.name })}
                  />
                  {t('min')}
                </label>
                <span className="num w-12 text-right font-semibold">{kcal(exerciseKcal(p.met, weight, num(p.minutes)))}</span>
              </li>
            ))}
          </ul>
          <button
            className="btn btn-primary w-full text-lg"
            disabled={!chosen.length}
            onClick={() => {
              for (const p of chosen) {
                const minutes = Math.round(num(p.minutes))
                addExercise({ date, name: p.name, minutes, met: p.met, kcal: exerciseKcal(p.met, weight, minutes) })
              }
              onDone()
            }}
          >
            {t('Add {n} kcal', { n: kcal(total) })}
          </button>
        </div>
      )}
    </div>
  )
}
