import { uid } from './date'
import { exerciseKcal } from './exercises'
import { moveFor, type Move, type MoveType, type Session } from './workouts'

/** One set: kg is for weighted moves; reps holds reps, seconds or minutes depending on the move. */
export interface SetEntry {
  kg?: number
  reps: number
  done: boolean
}

export interface ExerciseEntry {
  /** Library id, so the same move can be compared across workouts. */
  id: string
  name: string
  type: MoveType
  /** Target range for reps, seconds or minutes. */
  low: number
  high: number
  /** Seconds to rest after each set. */
  rest: number
  sets: SetEntry[]
}

/** A workout being done right now; saved, so closing the app doesn't lose it. */
export interface ActiveWorkout {
  title: string
  date: string
  startedAt: number
  met: number
  /** Planned length, for the progress bar. */
  minutes: number
  exercises: ExerciseEntry[]
}

/** A finished workout with the sets that were done. */
export interface WorkoutLog {
  id: string
  /** The diary exercise it was logged as, so undoing removes both. */
  exerciseLogId: string
  date: string
  title: string
  startedAt: number
  minutes: number
  kcal: number
  exercises: ExerciseEntry[]
}

export const CUSTOM_WORKOUT = 'Custom workout'

const REST: Record<MoveType, number> = { weighted: 90, reps: 60, hold: 30, time: 0 }

/** Weight plates usually go up in 2.5 kg steps. */
const KG_STEP = 2.5

/** The last finished workout's sets for a move, newest first. */
export function lastTime(history: WorkoutLog[], id: string): ExerciseEntry | undefined {
  for (const log of [...history].sort((a, b) => b.startedAt - a.startedAt)) {
    const e = log.exercises.find((x) => x.id === id && x.sets.some((s) => s.done))
    if (e) return e
  }
  return undefined
}

/**
 * What to aim for this time, from last time: once every set reached the top of the range,
 * add weight (and start again at the bottom of the range), or add reps or seconds without weights.
 */
export function nextSets(move: Pick<Move, 'type' | 'sets' | 'low' | 'high'>, last?: ExerciseEntry): { sets: SetEntry[]; progressed: boolean } {
  const fresh = (reps: number, kg?: number): SetEntry => ({ reps, done: false, ...(move.type === 'weighted' ? { kg: kg ?? 0 } : {}) })
  const done = last?.sets.filter((s) => s.done) ?? []
  if (!done.length) return { sets: Array.from({ length: move.sets }, () => fresh(move.high)), progressed: false }
  const topped = done.length >= move.sets && done.every((s) => s.reps >= move.high)
  const kg = Math.max(...done.map((s) => s.kg ?? 0))
  const sets = Array.from({ length: Math.max(move.sets, done.length) }, (_, i) => {
    const prev = done[Math.min(i, done.length - 1)]
    if (!topped || move.type === 'time') return fresh(prev.reps, prev.kg)
    if (move.type === 'weighted') return fresh(move.low, kg + KG_STEP)
    return fresh(prev.reps + (move.type === 'hold' ? 5 : 2))
  })
  return { sets, progressed: topped && move.type !== 'time' }
}

function entry(move: Move, history: WorkoutLog[]): ExerciseEntry {
  return { id: move.id, name: move.name, type: move.type, low: move.low, high: move.high, rest: REST[move.type], sets: nextSets(move, lastTime(history, move.id)).sets }
}

/** Starts a planned session, or an empty workout to add moves to, with last time's numbers filled in. */
export function startWorkout(session: Session | null, history: WorkoutLog[], date: string, now: number): ActiveWorkout {
  return {
    title: session?.title ?? CUSTOM_WORKOUT,
    date,
    startedAt: now,
    met: session?.met ?? 3.5,
    minutes: session?.minutes ?? 45,
    exercises: (session?.moves ?? []).map((m) => entry(m, history)),
  }
}

/** A library move to add to a workout, at a middle level. */
export function addMove(id: string, history: WorkoutLog[]): ExerciseEntry {
  return entry(moveFor(id), history)
}

export function setCount(w: Pick<ActiveWorkout, 'exercises'>) {
  const all = w.exercises.flatMap((e) => e.sets)
  return { done: all.filter((s) => s.done).length, total: all.length }
}

/** Total weight lifted: kg × reps over the done sets. */
export function volume(exercises: ExerciseEntry[]) {
  return Math.round(exercises.reduce((n, e) => n + e.sets.reduce((m, s) => m + (s.done && s.kg ? s.kg * s.reps : 0), 0), 0))
}

/** Estimated one-rep max (Epley), used to compare sets with different weights and reps. */
export const oneRepMax = (kg: number, reps: number) => kg * (1 + reps / 30)

function bestSet(e: ExerciseEntry) {
  let best = 0
  for (const s of e.sets) if (s.done && s.kg && s.reps) best = Math.max(best, oneRepMax(s.kg, s.reps))
  return best
}

/** Weighted moves where this workout beat every earlier one. */
export function newRecords(exercises: ExerciseEntry[], history: WorkoutLog[]): string[] {
  return exercises
    .filter((e) => e.type === 'weighted')
    .filter((e) => {
      const now = bestSet(e)
      const before = Math.max(0, ...history.flatMap((l) => l.exercises.filter((x) => x.id === e.id).map(bestSet)))
      return now > 0 && before > 0 && now > before
    })
    .map((e) => e.name)
}

/** The longest a forgotten, still-running workout counts for. */
const MAX_MINUTES = 180

/** Turns the active workout into a history entry and a diary exercise, keeping only what was done. */
export function finishWorkout(w: ActiveWorkout, now: number, weightKg: number) {
  const minutes = Math.min(MAX_MINUTES, Math.max(1, Math.round((now - w.startedAt) / 60_000)))
  const kcal = exerciseKcal(w.met, weightKg, minutes)
  const exercises = w.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length)
  return {
    exercise: { date: w.date, name: w.title, minutes, kcal, met: w.met },
    log: (exerciseLogId: string): WorkoutLog => ({ id: uid(), exerciseLogId, date: w.date, title: w.title, startedAt: w.startedAt, minutes, kcal, exercises }),
  }
}

/** "1:05" or "1:02:09". */
export function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
