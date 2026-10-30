import { beforeEach, describe, expect, it, vi } from 'vitest'
import { healthDayUpdates } from './nativeHealth'
import { useStore } from './store'

vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}))

const day = { date: '2026-10-30', steps: 8412, activeKcal: 512, weightKg: 88.9, workouts: [{ id: 'A1', name: 'Running', start: '2026-10-30T07:00:00Z', minutes: 31, kcal: 320, distanceKm: 5.2 }] }

describe('Apple Health in the iPhone app', () => {
  beforeEach(() => useStore.setState({ exercises: [], settings: { ...useStore.getState().settings, hiddenHealthWorkouts: [] } }))

  it('counts active calories when there are some, else steps', () => {
    expect(healthDayUpdates(day, 1)).toEqual({
      device: { activeKcal: 512, steps: 8412, source: 'health', at: 1 },
      steps: null,
      workouts: [{ id: 'hk-A1', date: '2026-10-30', name: 'Running', minutes: 31, kcal: 320, distanceKm: 5.2 }],
      weightKg: 88.9,
    })
    expect(healthDayUpdates({ ...day, activeKcal: 0, weightKg: undefined, workouts: [] }, 1)).toEqual({ device: null, steps: 8412, workouts: [], weightKg: null })
  })

  it('replaces the day’s imported workouts and keeps deleted ones deleted', () => {
    const { importHealthWorkouts, removeExercise, addExercise } = useStore.getState()
    addExercise({ date: '2026-10-30', name: 'Padel', minutes: 60, kcal: 400 })
    const { workouts } = healthDayUpdates(day, 1)
    importHealthWorkouts('2026-10-30', workouts)
    importHealthWorkouts('2026-10-30', workouts)
    expect(useStore.getState().exercises.map((e) => e.name)).toEqual(['Padel', 'Running'])
    removeExercise('hk-A1')
    importHealthWorkouts('2026-10-30', workouts)
    expect(useStore.getState().exercises.map((e) => e.name)).toEqual(['Padel'])
  })
})
