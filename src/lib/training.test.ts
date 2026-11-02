import { describe, expect, it } from 'vitest'
import { addMove, clock, finishWorkout, lastTime, newRecords, nextSets, setCount, startWorkout, volume, type ExerciseEntry, type WorkoutLog } from './training'
import { buildWeek, moveFor } from './workouts'

const squat = moveFor('gobletSquat') // 3 × 10–12
const log = (startedAt: number, exercises: ExerciseEntry[]): WorkoutLog => ({ id: String(startedAt), exerciseLogId: 'x', date: '2026-11-01', title: 'A', startedAt, minutes: 40, kcal: 100, exercises })
const done = (id: string, sets: [number | undefined, number][], type: ExerciseEntry['type'] = 'weighted'): ExerciseEntry => ({
  id, name: id, type, low: 10, high: 12, rest: 90, sets: sets.map(([kg, reps]) => ({ kg, reps, done: true })),
})

describe('starting a workout', () => {
  it('starts with the plan’s targets the first time', () => {
    expect(nextSets(squat)).toEqual({ sets: [{ kg: 0, reps: 12, done: false }, { kg: 0, reps: 12, done: false }, { kg: 0, reps: 12, done: false }], progressed: false })
  })

  it('repeats last time’s numbers until every set reaches the top of the range', () => {
    const last = done('gobletSquat', [[20, 12], [20, 11], [20, 10]])
    expect(nextSets(squat, last).sets.map((s) => [s.kg, s.reps])).toEqual([[20, 12], [20, 11], [20, 10]])
  })

  it('adds 2.5 kg once every set hit the top, starting again at the bottom of the range', () => {
    const last = done('gobletSquat', [[20, 12], [20, 12], [20, 12]])
    expect(nextSets(squat, last)).toEqual({ sets: Array(3).fill({ kg: 22.5, reps: 10, done: false }), progressed: true })
  })

  it('adds reps or seconds to moves without weights', () => {
    expect(nextSets(moveFor('squat'), done('squat', [[undefined, 12], [undefined, 12], [undefined, 12]], 'reps')).sets[0].reps).toBe(14)
    expect(nextSets(moveFor('plank'), done('plank', [[undefined, 30], [undefined, 30], [undefined, 30]], 'hold')).sets[0].reps).toBe(35)
  })

  it('fills a planned session from the newest workout that had the move', () => {
    const history = [log(1, [done('gobletSquat', [[15, 10]])]), log(2, [done('gobletSquat', [[17.5, 10]])]), log(3, [])]
    expect(lastTime(history, 'gobletSquat')?.sets[0].kg).toBe(17.5)
    const session = buildWeek({ place: 'gym', days: 3, minutes: 30, level: 'intermediate' }, 'lose')[0]!
    const w = startWorkout(session, history, '2026-11-02', 1000)
    expect(w).toMatchObject({ title: 'Full-body strength A', date: '2026-11-02', startedAt: 1000, minutes: 30 })
    expect(w.exercises.map((e) => e.id)).toEqual(['warmup', 'gobletSquat', 'bench', 'row', 'rdl', 'press'])
    expect(w.exercises[1].sets[0]).toEqual({ kg: 17.5, reps: 10, done: false })
    expect(w.exercises[0]).toMatchObject({ type: 'time', rest: 0, sets: [{ reps: 5, done: false }] })
  })

  it('starts an empty workout to add moves to', () => {
    const w = startWorkout(null, [], '2026-11-02', 0)
    expect(w).toMatchObject({ title: 'Custom workout', exercises: [] })
    expect(addMove('deadlift', [])).toMatchObject({ id: 'deadlift', name: 'Deadlift', type: 'weighted', rest: 90 })
  })
})

describe('finishing a workout', () => {
  const w = {
    title: 'Full-body strength A', date: '2026-11-02', startedAt: 0, met: 3.5, minutes: 30,
    exercises: [
      { ...done('gobletSquat', [[20, 12], [20, 10]]), sets: [{ kg: 20, reps: 12, done: true }, { kg: 20, reps: 10, done: false }] },
      { ...done('bench', [[10, 10]]), sets: [{ kg: 10, reps: 10, done: false }] },
    ],
  }

  it('counts sets and volume', () => {
    expect(setCount(w)).toEqual({ done: 1, total: 3 })
    expect(volume(w.exercises)).toBe(240)
  })

  it('keeps only what was done and logs the real duration', () => {
    const r = finishWorkout(w, 34 * 60_000, 70)
    expect(r.exercise).toEqual({ date: '2026-11-02', name: 'Full-body strength A', minutes: 34, kcal: Math.round(2.5 * 70 * (34 / 60)), met: 3.5 })
    const entry = r.log('ex1')
    expect(entry.exercises.map((e) => [e.id, e.sets.length])).toEqual([['gobletSquat', 1]])
    expect(entry.exerciseLogId).toBe('ex1')
  })

  it('caps a workout left running for hours', () => {
    expect(finishWorkout(w, 10 * 3_600_000, 70).exercise.minutes).toBe(180)
  })

  it('spots new personal bests', () => {
    const history = [log(1, [done('gobletSquat', [[20, 10]])])]
    expect(newRecords([done('gobletSquat', [[20, 12]])], history)).toEqual(['gobletSquat'])
    expect(newRecords([done('gobletSquat', [[20, 8]])], history)).toEqual([])
    expect(newRecords([done('deadlift', [[60, 5]])], history)).toEqual([])
  })

  it('shows times as a clock', () => {
    expect(clock(65_000)).toBe('1:05')
    expect(clock(3_729_000)).toBe('1:02:09')
  })
})
