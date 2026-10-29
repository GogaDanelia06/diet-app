import type { Activity } from './types'

// MET values from the Compendium of Physical Activities (Ainsworth et al.).
export type DistanceKind = 'walk' | 'run' | 'cycle'

export interface ExerciseType {
  name: string
  met: number
  category: string
  /** Activities where speed (distance ÷ time) decides the effort. */
  distance?: DistanceKind
}

const rows: [string, string, number, DistanceKind?][] = [
  ['Cardio', 'Walking', 3.5, 'walk'],
  ['Cardio', 'Running', 9.8, 'run'],
  ['Cardio', 'Cycling outdoors', 7.5, 'cycle'],
  ['Cardio', 'Jogging, easy', 7.0],
  ['Cardio', 'Hiking', 6.0],
  ['Cardio', 'Nordic walking', 4.8],
  ['Cardio', 'Treadmill walk, incline', 6.0],
  ['Cardio', 'Stationary bike, easy', 4.8],
  ['Cardio', 'Stationary bike, moderate', 6.8],
  ['Cardio', 'Stationary bike, hard', 8.8],
  ['Cardio', 'Elliptical trainer', 5.0],
  ['Cardio', 'Rowing machine, moderate', 7.0],
  ['Cardio', 'Rowing machine, hard', 8.5],
  ['Cardio', 'Stair climber / stairs', 9.0],
  ['Cardio', 'Jump rope', 11.8],
  ['Cardio', 'Swimming, easy', 6.0],
  ['Cardio', 'Swimming laps, moderate', 8.3],
  ['Cardio', 'Swimming laps, fast', 9.8],
  ['Gym & strength', 'Weight lifting, moderate', 3.5],
  ['Gym & strength', 'Weight lifting, hard', 6.0],
  ['Gym & strength', 'Bodyweight exercises (push-ups, squats)', 3.8],
  ['Gym & strength', 'Bodyweight circuit, hard', 8.0],
  ['Gym & strength', 'HIIT / circuit training', 8.0],
  ['Gym & strength', 'CrossFit-style workout', 8.0],
  ['Gym & strength', 'Kettlebell workout', 8.0],
  ['Classes', 'Aerobics, low impact', 5.0],
  ['Classes', 'Aerobics, high impact', 7.3],
  ['Classes', 'Step aerobics', 7.5],
  ['Classes', 'Zumba', 6.5],
  ['Classes', 'Spinning class', 8.5],
  ['Classes', 'Dancing', 5.0],
  ['Classes', 'Dancing, energetic', 7.8],
  ['Classes', 'Yoga', 2.5],
  ['Classes', 'Power yoga', 4.0],
  ['Classes', 'Pilates', 3.0],
  ['Classes', 'Stretching', 2.3],
  ['Classes', 'Boxing / kickboxing', 7.8],
  ['Classes', 'Martial arts', 10.3],
  ['Sports', 'Football / soccer, casual', 7.0],
  ['Sports', 'Football / soccer, match', 10.0],
  ['Sports', 'Basketball', 6.5],
  ['Sports', 'Volleyball', 4.0],
  ['Sports', 'Beach volleyball', 8.0],
  ['Sports', 'Tennis, singles', 8.0],
  ['Sports', 'Tennis, doubles', 6.0],
  ['Sports', 'Table tennis', 4.0],
  ['Sports', 'Badminton', 5.5],
  ['Sports', 'Rugby', 8.3],
  ['Sports', 'Wrestling', 6.0],
  ['Sports', 'Handball', 8.0],
  ['Sports', 'Climbing / bouldering', 7.5],
  ['Sports', 'Skiing, downhill', 5.3],
  ['Sports', 'Skiing, cross-country', 9.0],
  ['Sports', 'Ice skating', 7.0],
  ['Sports', 'Horse riding', 5.5],
  ['Sports', 'Golf, walking', 4.8],
  ['Everyday', 'Walking the dog', 3.0],
  ['Everyday', 'Housework / cleaning', 3.3],
  ['Everyday', 'Gardening', 3.8],
  ['Everyday', 'Mowing the lawn', 5.5],
  ['Everyday', 'Playing with kids, active', 5.8],
  ['Everyday', 'Moving furniture / heavy lifting', 5.8],
  ['Everyday', 'Physical work (building, farming)', 5.0],
  ['Everyday', 'Shovelling snow', 5.3],
]

export const EXERCISES: ExerciseType[] = rows.map(([category, name, met, distance]) => ({ name, met, category, distance }))
export const EXERCISE_CATEGORIES = [...new Set(rows.map((r) => r[0]))]

// MET by speed in km/h, interpolated between points.
const SPEED_METS: Record<DistanceKind, [number, number][]> = {
  walk: [[3.2, 2.8], [4, 3.0], [4.8, 3.5], [5.6, 4.3], [6.4, 5.0], [7.2, 7.0], [8, 8.3]],
  run: [[6.4, 6.0], [8, 8.3], [9.7, 9.8], [11.3, 11.0], [12.9, 11.8], [14.5, 12.8], [16.1, 14.5], [17.7, 16.0], [19.3, 19.0]],
  cycle: [[10, 4.0], [16, 6.8], [19, 8.0], [22.5, 10.0], [25.5, 12.0], [30, 15.8]],
}

export function metForSpeed(kind: DistanceKind, kmh: number) {
  const pts = SPEED_METS[kind]
  if (kmh <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    const [s1, m1] = pts[i]
    if (kmh <= s1) {
      const [s0, m0] = pts[i - 1]
      return m0 + ((kmh - s0) / (s1 - s0)) * (m1 - m0)
    }
  }
  return pts.at(-1)![1]
}

/**
 * Calories burned above resting. The daily target already includes resting burn,
 * so counting it again would double-count: (MET − 1) × kg × hours.
 */
export function exerciseKcal(met: number, weightKg: number, minutes: number) {
  return Math.max(0, Math.round((met - 1) * weightKg * (minutes / 60)))
}

/** Steps a person at this activity level already takes on a normal day (included in their target). */
export const BASELINE_STEPS: Record<Activity, number> = {
  sedentary: 3000,
  light: 5000,
  moderate: 7000,
  active: 9000,
  very: 11000,
}

/** Walking burns about 0.5 kcal per kg per km above resting, at roughly 1,300 steps per km. */
export function stepsKcal(steps: number, weightKg: number, activity: Activity) {
  const extra = Math.max(0, steps - BASELINE_STEPS[activity])
  return Math.round((extra / 1300) * 0.5 * weightKg)
}
