import { describe, expect, it } from 'vitest'
import { KA } from './i18n-ka'
import { KA_NAMES } from './i18n-ka-names'
import { buildWeek, fuelPicks, sessionKcal, workoutGoal, type Goal, type Level, type Place, type WorkoutPrefs } from './workouts'

const prefs = (p: Partial<WorkoutPrefs> = {}): WorkoutPrefs => ({ place: 'home', days: 3, minutes: 30, level: 'beginner', ...p })
const titles = (goal: Goal, p: Partial<WorkoutPrefs> = {}) => buildWeek(prefs(p), goal).map((s) => s?.title ?? '-')

describe('workout plan', () => {
  it('reads the goal from the profile', () => {
    expect(workoutGoal(80, 70, 0.5)).toBe('lose')
    expect(workoutGoal(80, 70, 0)).toBe('maintain')
    expect(workoutGoal(60, 66, 0)).toBe('gain')
    expect(workoutGoal(70, 70.3, 0)).toBe('maintain')
  })

  it('mixes strength and cardio across the week when losing weight', () => {
    expect(titles('lose')).toEqual(['Full-body strength A', '-', 'Brisk walk', '-', 'Full-body strength B', '-', '-'])
    expect(titles('lose', { days: 5, level: 'intermediate', place: 'outdoor' })).toEqual([
      'Full-body strength A', 'Easy jog', 'Full-body strength B', '-', 'Run intervals', 'Easy jog', '-',
    ])
  })

  it('splits upper and lower body when gaining, and keeps beginners off intervals', () => {
    expect(titles('gain', { days: 4, place: 'gym' })).toEqual(['Upper-body strength', 'Lower-body strength', '-', 'Upper-body strength', 'Lower-body strength', '-', '-'])
    expect(titles('maintain', { days: 5 })).not.toContain('HIIT circuit')
    expect(titles('maintain', { days: 5, level: 'advanced' })).toContain('HIIT circuit')
  })

  it('fits the number of moves to the time and uses gym moves at the gym', () => {
    const short = buildWeek(prefs({ minutes: 20 }), 'lose')[0]!
    const long = buildWeek(prefs({ minutes: 60, place: 'gym', level: 'advanced' }), 'lose')[0]!
    expect(short.moves).toHaveLength(1 + 4)
    expect(short.moves[2].name).toBe('Knee or incline push-up')
    expect(long.moves).toHaveLength(1 + 7)
    expect(long.moves[1]).toMatchObject({ name: 'Goblet squat', dose: '4 × 8–12' })
    expect(buildWeek(prefs({ minutes: 45, days: 5 }), 'lose')[5]!.minutes).toBe(60)
  })

  it('counts calories the same way as logged exercise', () => {
    const s = buildWeek(prefs(), 'lose')[0]!
    expect(sessionKcal(s, 70)).toBe(Math.round((3.8 - 1) * 70 * 0.5))
  })
})

describe('food around workouts', () => {
  const names = (diet: Parameters<typeof fuelPicks>[0], allergies: Parameters<typeof fuelPicks>[1] = []) => {
    const p = fuelPicks(diet, allergies)
    return { before: p.before.map((f) => f.name), after: p.after.map((f) => f.name) }
  }

  it('picks protein that fits the diet and allergies', () => {
    expect(names('any').after).toEqual(['Greek yogurt, 2%', 'Cottage cheese 2%', 'Egg, boiled'])
    expect(names('any', ['milk']).after).toEqual(['Egg, boiled', 'Chicken breast, cooked', 'Tuna, canned in water'])
    expect(names('vegan').after).toEqual(['Tofu, firm', 'Lentils, cooked', 'Hummus'])
    expect(names('vegan', ['soy', 'sesame']).after).toEqual(['Lentils, cooked'])
    expect(names('any', ['gluten']).before).toEqual(['Banana', 'Apple'])
  })
})

describe('Georgian', () => {
  it('has every workout title, move and tip', () => {
    const missing = new Set<string>()
    const goals: Goal[] = ['lose', 'maintain', 'gain']
    const places: Place[] = ['home', 'gym', 'outdoor']
    const levels: Level[] = ['beginner', 'intermediate', 'advanced']
    for (const goal of goals)
      for (const place of places)
        for (const level of levels)
          for (const days of [2, 3, 4, 5] as const)
            for (const s of buildWeek(prefs({ place, level, days, minutes: 60 }), goal)) {
              if (!s) continue
              if (!KA_NAMES[s.title]) missing.add(s.title)
              for (const m of s.moves) {
                if (!KA[m.name] && !KA_NAMES[m.name]) missing.add(m.name)
                if (!KA[m.cue]) missing.add(m.cue)
              }
            }
    expect([...missing]).toEqual([])
  })
})
