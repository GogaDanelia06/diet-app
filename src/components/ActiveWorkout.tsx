import { useEffect, useMemo, useState } from 'react'
import { t, tName } from '../lib/i18n'
import { kcal as fmtKcal } from '../lib/format'
import { currentWeight, useStore } from '../lib/store'
import { addMove, clock, finishWorkout, lastTime, newRecords, setCount, volume, type ExerciseEntry, type SetEntry } from '../lib/training'
import { MOVE_LIBRARY } from '../lib/workouts'
import { normalize } from '../lib/search'
import { Icon, Sheet } from './ui'

/** The current time, updated every `ms`. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(timer)
  }, [ms])
  return now
}

export interface WorkoutSummary {
  title: string
  minutes: number
  kcal: number
  sets: number
  volume: number
  records: string[]
}


/** The workout being done: a timer, every set to tick off, a rest timer between sets, and Finish. */
export default function ActiveWorkoutSheet({ onClose, onFinished }: { onClose: () => void; onFinished: (s: WorkoutSummary) => void }) {
  const w = useStore((s) => s.activeWorkout)
  const history = useStore((s) => s.workoutLog)
  const weight = useStore((s) => currentWeight(s))
  const update = useStore((s) => s.updateActiveWorkout)
  const setActive = useStore((s) => s.setActiveWorkout)
  const saveWorkout = useStore((s) => s.saveWorkout)
  const now = useNow(1000)
  const [restEnd, setRestEnd] = useState<number | null>(null)
  const [restTotal, setRestTotal] = useState(0)
  const [picking, setPicking] = useState(false)

  // Keep the screen on while training, where the browser allows it.
  useEffect(() => {
    let lock: WakeLockSentinel | undefined
    navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    return () => void lock?.release().catch(() => {})
  }, [])

  const resting = restEnd != null && restEnd > now
  useEffect(() => {
    if (restEnd != null && restEnd <= now) {
      setRestEnd(null)
      navigator.vibrate?.([200, 100, 200])
    }
  }, [now, restEnd])

  if (!w) return null
  const count = setCount(w)

  const changeSet = (ei: number, si: number, change: Partial<SetEntry>) =>
    update((cur) => ({
      ...cur,
      exercises: cur.exercises.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j !== si ? s : { ...s, ...change })) })),
    }))

  function toggle(ei: number, si: number) {
    const e = w!.exercises[ei]
    const done = !e.sets[si].done
    changeSet(ei, si, { done })
    if (done && e.rest > 0) {
      setRestEnd(Date.now() + e.rest * 1000)
      setRestTotal(e.rest)
    }
  }

  const changeExercise = (ei: number, change: (e: ExerciseEntry) => ExerciseEntry | null) =>
    update((cur) => ({ ...cur, exercises: cur.exercises.flatMap((e, i) => (i !== ei ? [e] : (change(e) ?? []))) }))

  function finish() {
    if (count.done === 0 && !confirm(t('No sets are ticked yet. Finish anyway?'))) return
    if (count.done > 0 && count.done < count.total && !confirm(t('You’ve done {done} of {total} sets. Finish the workout?', { done: count.done, total: count.total }))) return
    const result = finishWorkout(w!, Date.now(), weight)
    const exercises = result.log('').exercises
    const summary: WorkoutSummary = {
      title: w!.title,
      minutes: result.exercise.minutes,
      kcal: result.exercise.kcal,
      sets: exercises.reduce((n, e) => n + e.sets.length, 0),
      volume: volume(exercises),
      records: newRecords(exercises, history),
    }
    saveWorkout(result)
    onFinished(summary)
  }

  function discard() {
    if (!confirm(t('Discard this workout? Nothing from it will be saved.'))) return
    setActive(null)
    onClose()
  }

  return (
    <Sheet
      title={tName(w.title)}
      closeLabel={t('Hide')}
      onClose={onClose}
      action={
        <button onClick={discard} className="p-1 text-muted" aria-label={t('Discard workout')}>
          <Icon name="trash" className="h-5 w-5" />
        </button>
      }
      footer={
        <div className="space-y-2">
          {resting && <RestBar left={restEnd! - now} total={restTotal} onAdd={() => setRestEnd(restEnd! + 15_000)} onSkip={() => setRestEnd(null)} />}
          <button className="btn btn-primary w-full text-lg" onClick={finish}>
            <Icon name="check" className="h-5 w-5" /> {t('Finish workout')}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label={t('Time')} value={clock(now - w.startedAt)} />
          <Stat label={t('Sets')} value={`${count.done}/${count.total}`} />
          <Stat label={t('Lifted')} value={`${volume(w.exercises).toLocaleString()} ${t('kg')}`} />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={count.done} aria-valuemax={count.total} aria-label={t('Sets done')}>
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${count.total ? (count.done / count.total) * 100 : 0}%` }} />
        </div>

        {w.exercises.map((e, ei) => (
          <ExerciseCard
            key={`${e.id}-${ei}`}
            entry={e}
            last={lastTime(history, e.id)}
            onSet={(si, change) => changeSet(ei, si, change)}
            onToggle={(si) => toggle(ei, si)}
            onAddSet={() => changeExercise(ei, (x) => ({ ...x, sets: [...x.sets, { ...x.sets[x.sets.length - 1], done: false }] }))}
            onRemoveSet={() => changeExercise(ei, (x) => (x.sets.length > 1 ? { ...x, sets: x.sets.slice(0, -1) } : null))}
          />
        ))}

        <button className="btn btn-quiet w-full" onClick={() => setPicking(true)}>
          <Icon name="plus" className="h-5 w-5" /> {t('Add exercise')}
        </button>
      </div>
      {picking && (
        <MovePicker
          onClose={() => setPicking(false)}
          onPick={(id) => {
            update((cur) => ({ ...cur, exercises: [...cur.exercises, addMove(id, history)] }))
            setPicking(false)
          }}
        />
      )}
    </Sheet>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 py-2.5">
      <div className="num text-xl font-semibold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}

function RestBar({ left, total, onAdd, onSkip }: { left: number; total: number; onAdd: () => void; onSkip: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-accent-soft px-3 py-2" role="timer" aria-live="off">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-accent">{t('Rest')}</span>
          <span className="num text-lg font-semibold text-accent">{clock(left)}</span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/20">
          <div className="h-full bg-accent" style={{ width: `${Math.min(100, (left / (total * 1000)) * 100)}%` }} />
        </div>
      </div>
      <button className="rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium" onClick={onAdd}>
        +15 s
      </button>
      <button className="rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium" onClick={onSkip}>
        {t('Skip')}
      </button>
    </div>
  )
}

function lastText(last: ExerciseEntry) {
  const sets = last.sets.filter((s) => s.done)
  if (last.type === 'weighted') return sets.map((s) => `${s.kg} ${t('kg')} × ${s.reps}`).join(', ')
  return sets.map((s) => `${s.reps}${last.type === 'hold' ? ' s' : last.type === 'time' ? ' min' : ''}`).join(', ')
}

function ExerciseCard({
  entry: e,
  last,
  onSet,
  onToggle,
  onAddSet,
  onRemoveSet,
}: {
  entry: ExerciseEntry
  last?: ExerciseEntry
  onSet: (si: number, change: Partial<SetEntry>) => void
  onToggle: (si: number) => void
  onAddSet: () => void
  onRemoveSet: () => void
}) {
  const allDone = e.sets.every((s) => s.done)
  const lastKg = last ? Math.max(0, ...last.sets.filter((s) => s.done).map((s) => s.kg ?? 0)) : 0
  const up = e.type === 'weighted' && lastKg > 0 && (e.sets[0]?.kg ?? 0) > lastKg
  const cue = MOVE_LIBRARY.find((m) => m.id === e.id)?.cue
  return (
    <section className={`rounded-[20px] p-4 ${allDone ? 'bg-accent/[0.07]' : 'bg-surface'}`} aria-label={tName(t(e.name))}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{tName(t(e.name))}</h3>
        {allDone && <Icon name="check" className="h-5 w-5 shrink-0 text-accent" />}
      </div>
      {cue && <p className="mt-0.5 text-sm text-muted">{t(cue)}</p>}
      {last && e.type !== 'time' && <p className="mt-1 text-xs text-muted">{t('Last time: {sets}', { sets: lastText(last) })}</p>}
      {up && <span className="mt-1.5 inline-block whitespace-nowrap rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">↑ {t('Heavier than last time')}</span>}
      <div className="mt-3 space-y-1.5">
        {/* One header for the columns, so the rows hold only numbers and fit any language. */}
        {e.type !== 'time' && (
          <div className="flex items-center gap-2 px-2 text-xs text-muted">
            <span className="w-6 shrink-0 text-center">#</span>
            {e.type === 'weighted' && <span className="flex-1 text-center">{t('kg')}</span>}
            <span className="flex-1 text-center">{t(e.type === 'hold' ? 'Seconds' : 'Reps')}</span>
            <span className="w-10 shrink-0" />
          </div>
        )}
        {e.sets.map((s, si) => (
          <div key={si} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${s.done ? 'bg-accent/10' : 'bg-surface-2'}`}>
            <span className="num w-6 shrink-0 text-center text-sm text-muted">{e.type === 'time' ? '' : si + 1}</span>
            {e.type === 'weighted' && <NumberInput value={s.kg ?? 0} decimal label={t('Weight, kg, set {n}', { n: si + 1 })} onChange={(kg) => onSet(si, { kg })} />}
            {e.type === 'time' ? (
              <span className="flex-1 font-medium">{t('{n} min', { n: s.reps })}</span>
            ) : (
              <NumberInput value={s.reps} label={t('{unit}, set {n}', { unit: t(e.type === 'hold' ? 'Seconds' : 'Reps'), n: si + 1 })} onChange={(reps) => onSet(si, { reps })} />
            )}
            <button
              onClick={() => onToggle(si)}
              aria-pressed={s.done}
              aria-label={t(s.done ? 'Set {n} done' : 'Tick set {n}', { n: si + 1 })}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${s.done ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted'}`}
            >
              <Icon name="check" className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>
      {e.type !== 'time' && (
        <div className="mt-2 flex gap-4 text-sm">
          <button className="flex items-center gap-1 font-medium text-accent" onClick={onAddSet}>
            <Icon name="plus" className="h-4 w-4" /> {t('Add set')}
          </button>
          <button className="text-muted" onClick={onRemoveSet}>
            {t(e.sets.length > 1 ? 'Remove last set' : 'Remove exercise')}
          </button>
        </div>
      )}
    </section>
  )
}

/** A number box that keeps what's typed (like "22.") until it's left, then saves it. */
function NumberInput({ value, decimal = false, label, onChange }: { value: number; decimal?: boolean; label: string; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const save = () => {
    const n = parseFloat(text.replace(',', '.'))
    const clean = Number.isFinite(n) && n >= 0 ? (decimal ? Math.round(n * 4) / 4 : Math.round(n)) : value
    setText(String(clean))
    if (clean !== value) onChange(clean)
  }
  return (
    <input
      className="field num h-10 min-w-0 flex-1 px-1 text-center text-lg font-semibold"
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={text}
      aria-label={label}
      onChange={(ev) => setText(ev.target.value)}
      onFocus={(ev) => ev.target.select()}
      onBlur={save}
      onKeyDown={(ev) => ev.key === 'Enter' && (ev.target as HTMLInputElement).blur()}
    />
  )
}

function MovePicker({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const moves = useMemo(() => {
    const query = normalize(q)
    return MOVE_LIBRARY.filter((m) => !query || normalize(`${m.name} ${t(m.name)}`).includes(query))
  }, [q])
  const group = (gym: boolean) => moves.filter((m) => m.gym === gym)
  return (
    <Sheet title={t('Add exercise')} onClose={onClose}>
      <div className="space-y-4">
        <input type="search" className="field" placeholder={t('Search exercises')} value={q} onChange={(e) => setQ(e.target.value)} autoCorrect="off" />
        {([true, false] as const).map((gym) =>
          group(gym).length ? (
            <div key={String(gym)}>
              <h3 className="mb-1 text-sm font-medium text-muted">{t(gym ? 'Gym' : 'No equipment')}</h3>
              <ul className="divide-y divide-line rounded-[18px] bg-surface px-4">
                {group(gym).map((m) => (
                  <li key={m.id}>
                    <button className="flex w-full items-center gap-3 py-3 text-left" onClick={() => onPick(m.id)}>
                      <span className="flex-1 font-medium">{t(m.name)}</span>
                      <Icon name="plus" className="h-5 w-5 text-accent" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </div>
    </Sheet>
  )
}

/** A short "well done" after finishing, with the numbers and any new personal bests. */
export function WorkoutDone({ summary, onClose }: { summary: WorkoutSummary; onClose: () => void }) {
  return (
    <Sheet title={t('Workout saved')} onClose={onClose} footer={<button className="btn btn-primary w-full" onClick={onClose}>{t('Done')}</button>}>
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-ink">
          <Icon name="trophy" className="h-8 w-8" />
        </div>
        <h2 className="font-display text-2xl font-semibold">{tName(summary.title)}</h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label={t('Minutes')} value={String(summary.minutes)} />
          <Stat label={t('kcal burned')} value={fmtKcal(summary.kcal)} />
          <Stat label={t('Sets')} value={String(summary.sets)} />
          <Stat label={t('Lifted')} value={`${summary.volume.toLocaleString()} ${t('kg')}`} />
        </div>
        {summary.records.length > 0 && (
          <div className="rounded-2xl bg-accent-soft p-3 text-left">
            <div className="font-semibold text-accent">{t('New personal best')}</div>
            <p className="text-sm">{summary.records.map((r) => t(r)).join(', ')}</p>
          </div>
        )}
        <p className="text-sm text-muted">{t('Added to today’s exercise, so your calorie budget already counts it.')}</p>
      </div>
    </Sheet>
  )
}
