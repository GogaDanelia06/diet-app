import { exerciseKcal } from './exercises'
import { BUILTIN_FOODS } from './foods'
import type { Allergen, DietStyle, Food } from './types'

export type Place = 'home' | 'gym' | 'outdoor'
export type Level = 'beginner' | 'intermediate' | 'advanced'
export type Goal = 'lose' | 'maintain' | 'gain'

export interface WorkoutPrefs {
  place: Place
  days: 2 | 3 | 4 | 5
  minutes: 20 | 30 | 45 | 60
  level: Level
}

export const DEFAULT_WORKOUT_PREFS: WorkoutPrefs = { place: 'home', days: 3, minutes: 30, level: 'beginner' }

/** One line of a session. Text is English and translated where it's shown. */
export interface Move {
  name: string
  /** Numbers and units only, like "3 × 10–12", "3 × 30 s" or "20 min", so it reads the same in any language. */
  dose: string
  cue: string
}

export interface Session {
  /** Stable within a plan, e.g. "A", "cardio". */
  key: string
  /** Also the name the workout is logged under. */
  title: string
  kind: 'strength' | 'cardio' | 'intervals' | 'mobility'
  minutes: number
  met: number
  moves: Move[]
}

/** The week from Monday (0) to Sunday (6); null is a rest day. */
export type WeekPlan = (Session | null)[]

/** Losing when the plan has a weekly loss rate, gaining when the goal is above the current weight. */
export function workoutGoal(currentKg: number, goalKg: number, ratePerWeekKg: number): Goal {
  if (goalKg < currentKg && ratePerWeekKg > 0) return 'lose'
  if (goalKg > currentKg + 0.5) return 'gain'
  return 'maintain'
}

type MoveDef = { name: string; cue: string; hold?: boolean; easier?: string }

// Moves need no equipment at home or outdoors (a stair, chair or park bench is enough); the gym ones use machines and dumbbells.
const MOVES: Record<string, MoveDef> = {
  squat: { name: 'Bodyweight squat', cue: 'Sit back as if onto a chair, chest up, knees in line with your toes.' },
  pushup: { name: 'Push-up', easier: 'Knee or incline push-up', cue: 'Body in one straight line; lower your chest to a fist’s height from the floor.' },
  bridge: { name: 'Glute bridge', cue: 'Lying on your back, squeeze your glutes to lift your hips; pause at the top.' },
  lunge: { name: 'Reverse lunge', cue: 'Step back and lower until both knees bend to about 90°; push back up through the front heel.' },
  plank: { name: 'Plank', hold: true, cue: 'Elbows under shoulders, belly tight, hips level with your shoulders.' },
  superman: { name: 'Superman hold', hold: true, cue: 'Lying face down, lift your arms, chest and legs a little and hold.' },
  stepUp: { name: 'Step-up on a stair or sturdy chair', cue: 'Push through the heel of the top foot; step down slowly.' },
  dip: { name: 'Chair dip', cue: 'Hands on a sturdy chair behind you; bend your elbows to 90° and press back up.' },
  sidePlank: { name: 'Side plank', hold: true, cue: 'On one elbow, body in a straight line; switch sides halfway.' },
  deadBug: { name: 'Dead bug', cue: 'On your back, slowly lower the opposite arm and leg while your lower back stays on the floor.' },
  climber: { name: 'Mountain climbers', hold: true, cue: 'From a push-up position, drive your knees to your chest one after the other.' },
  wallSit: { name: 'Wall sit', hold: true, cue: 'Back against a wall, thighs parallel to the floor.' },
  gobletSquat: { name: 'Goblet squat', cue: 'Hold a dumbbell at your chest and squat until your thighs are level with your knees or lower.' },
  bench: { name: 'Dumbbell bench press', cue: 'Lower the dumbbells to chest level with elbows at about 45°, then press up.' },
  pulldown: { name: 'Lat pulldown', cue: 'Pull the bar to your upper chest, leading with your elbows; don’t lean far back.' },
  row: { name: 'Seated cable row', cue: 'Pull the handle to your belly and squeeze your shoulder blades together.' },
  rdl: { name: 'Romanian deadlift (dumbbells)', cue: 'Push your hips back with a flat back until you feel your hamstrings stretch, then stand tall.' },
  legPress: { name: 'Leg press', cue: 'Lower until your knees are at about 90°; don’t lock them at the top.' },
  press: { name: 'Dumbbell shoulder press', cue: 'Press the dumbbells overhead without arching your lower back.' },
  hipThrust: { name: 'Hip thrust', cue: 'Upper back on a bench, drive your hips up and squeeze at the top.' },
  walkLunge: { name: 'Walking lunges with dumbbells', cue: 'Long steps, back knee close to the floor, upper body upright.' },
}

// Moves in order of importance; shorter sessions use the first few.
const TEMPLATES: Record<'home' | 'gym', Record<'A' | 'B' | 'upper' | 'lower', string[]>> = {
  home: {
    A: ['squat', 'pushup', 'bridge', 'superman', 'lunge', 'plank', 'climber'],
    B: ['lunge', 'pushup', 'stepUp', 'bridge', 'dip', 'sidePlank', 'deadBug'],
    upper: ['pushup', 'dip', 'superman', 'plank', 'sidePlank', 'climber', 'deadBug'],
    lower: ['squat', 'lunge', 'bridge', 'stepUp', 'wallSit', 'plank', 'sidePlank'],
  },
  gym: {
    A: ['gobletSquat', 'bench', 'row', 'rdl', 'press', 'plank', 'walkLunge'],
    B: ['legPress', 'pulldown', 'hipThrust', 'press', 'walkLunge', 'deadBug', 'row'],
    upper: ['bench', 'pulldown', 'press', 'row', 'pushup', 'plank', 'deadBug'],
    lower: ['gobletSquat', 'rdl', 'legPress', 'hipThrust', 'walkLunge', 'plank', 'sidePlank'],
  },
}

const STRENGTH_TITLES = { A: 'Full-body strength A', B: 'Full-body strength B', upper: 'Upper-body strength', lower: 'Lower-body strength' }
const REPS: Record<Level, string> = { beginner: '2 × 10', intermediate: '3 × 10–12', advanced: '4 × 8–12' }
const HOLDS: Record<Level, string> = { beginner: '2 × 20 s', intermediate: '3 × 30 s', advanced: '3 × 45 s' }
const MOVES_FOR_MINUTES: Record<WorkoutPrefs['minutes'], number> = { 20: 4, 30: 5, 45: 6, 60: 7 }

// METs from the Compendium of Physical Activities: resistance training 3.5 (moderate) and 6.0 (vigorous),
// calisthenics 3.8 (moderate) and 8.0 (vigorous), circuit training 4.3.
const STRENGTH_MET: Record<'home' | 'gym', Record<Level, number>> = {
  home: { beginner: 3.8, intermediate: 4.3, advanced: 8.0 },
  gym: { beginner: 3.5, intermediate: 3.5, advanced: 6.0 },
}

function strength(key: keyof typeof STRENGTH_TITLES, p: WorkoutPrefs): Session {
  const gear = p.place === 'gym' ? 'gym' : 'home'
  const moves = TEMPLATES[gear][key].slice(0, MOVES_FOR_MINUTES[p.minutes]).map((id) => {
    const m = MOVES[id]
    return { name: p.level === 'beginner' && m.easier ? m.easier : m.name, dose: m.hold ? HOLDS[p.level] : REPS[p.level], cue: m.cue }
  })
  return {
    key,
    title: STRENGTH_TITLES[key],
    kind: 'strength',
    minutes: p.minutes,
    met: STRENGTH_MET[gear][p.level],
    moves: [{ name: 'Warm-up', dose: '5 min', cue: 'March or walk on the spot, swing your arms and do a few slow squats.' }, ...moves],
  }
}

// Steady cardio by place and level: [title, MET, how to do it].
const CARDIO: Record<Place, Record<Level, [string, number, string]>> = {
  outdoor: {
    beginner: ['Brisk walk', 4.3, 'Walk fast enough that talking is easy but singing isn’t.'],
    intermediate: ['Easy jog', 7.0, 'Jog at a pace you could keep a conversation at; walk a minute whenever you need to.'],
    advanced: ['Steady run', 9.8, 'Run at a steady, comfortable-hard pace.'],
  },
  gym: {
    beginner: ['Stationary bike, easy', 4.8, 'Pedal at an easy, even pace with light resistance.'],
    intermediate: ['Treadmill walk, incline', 6.0, 'Walk at 5–6 km/h on a 6–10% incline without holding the rails.'],
    advanced: ['Rowing machine', 8.5, 'Row at a hard but steady pace: legs, then body, then arms.'],
  },
  home: {
    beginner: ['Brisk walk', 4.3, 'Walk outside fast enough that talking is easy but singing isn’t.'],
    intermediate: ['Low-impact cardio', 5.0, 'Keep moving: marching, step-touches, knee lifts and squats to music.'],
    advanced: ['Cardio circuit', 8.0, '40 s each, no rest: jumping jacks, high knees, squat jumps, burpees; repeat.'],
  },
}

function cardio(p: WorkoutPrefs, extra = 0): Session {
  const [title, met, cue] = CARDIO[p.place][p.level]
  const minutes = p.minutes + extra
  return {
    key: extra ? 'long' : 'cardio',
    title,
    kind: 'cardio',
    minutes,
    met,
    moves: [
      { name: 'Warm-up', dose: '5 min', cue: 'Start slowly and build up.' },
      { name: title, dose: `${minutes - 10} min`, cue },
      { name: 'Cool-down', dose: '5 min', cue: 'Slow down gradually, then stretch your legs.' },
    ],
  }
}

const INTERVALS: Record<Place, [string, number, string]> = {
  outdoor: ['Run intervals', 8.5, '1 min fast run, 2 min easy walk or jog; repeat.'],
  gym: ['Bike intervals', 8.0, '30 s hard, 90 s easy on the bike; repeat.'],
  home: ['HIIT circuit', 8.0, '30 s work, 30 s rest: jumping jacks, squat jumps, mountain climbers, high knees; repeat.'],
}

function intervals(p: WorkoutPrefs): Session {
  // Beginners build a base with steady cardio first.
  if (p.level === 'beginner') return cardio(p)
  const [title, met, cue] = INTERVALS[p.place]
  return {
    key: 'intervals',
    title,
    kind: 'intervals',
    minutes: p.minutes,
    met,
    moves: [
      { name: 'Warm-up', dose: '5 min', cue: 'Easy pace, getting a little faster.' },
      { name: title, dose: `${p.minutes - 10} min`, cue },
      { name: 'Cool-down', dose: '5 min', cue: 'Easy pace until your breathing settles.' },
    ],
  }
}

function mobility(p: WorkoutPrefs): Session {
  const minutes = Math.min(p.minutes, 20)
  const hold = '2 × 30 s'
  return {
    key: 'mobility',
    title: 'Stretch and mobility',
    kind: 'mobility',
    minutes,
    met: 2.3,
    moves: [
      { name: 'Cat–cow', dose: '× 10', cue: 'On hands and knees, round then arch your back with your breath.' },
      { name: 'Hip flexor stretch', dose: hold, cue: 'Half-kneeling, tuck your hips under until the front of the back hip stretches.' },
      { name: 'Hamstring stretch', dose: hold, cue: 'One heel forward, hinge at the hips with a flat back.' },
      { name: 'Thoracic rotation', dose: '2 × 8', cue: 'On hands and knees, one hand behind your head; rotate your elbow up to the ceiling.' },
      { name: 'Child’s pose', dose: '1 min', cue: 'Knees wide, sit back on your heels, arms long, breathe slowly.' },
    ],
  }
}

// Which sessions make up the week for each goal and number of days.
type Slot = 'A' | 'B' | 'upper' | 'lower' | 'cardio' | 'long' | 'intervals' | 'mobility'
const SCHEDULES: Record<Goal, Record<WorkoutPrefs['days'], Slot[]>> = {
  // Strength keeps muscle while eating less, so the weight lost is mostly fat; cardio adds to the deficit.
  lose: { 2: ['A', 'B'], 3: ['A', 'cardio', 'B'], 4: ['A', 'cardio', 'B', 'intervals'], 5: ['A', 'cardio', 'B', 'intervals', 'long'] },
  maintain: { 2: ['A', 'B'], 3: ['A', 'cardio', 'B'], 4: ['A', 'cardio', 'B', 'mobility'], 5: ['A', 'cardio', 'B', 'intervals', 'mobility'] },
  // Building muscle needs more lifting and only a little cardio.
  gain: { 2: ['A', 'B'], 3: ['A', 'B', 'A'], 4: ['upper', 'lower', 'upper', 'lower'], 5: ['upper', 'lower', 'cardio', 'upper', 'lower'] },
}
// Workout days spread over the week, Monday = 0.
const WEEKDAYS: Record<WorkoutPrefs['days'], number[]> = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5] }

function session(slot: Slot, p: WorkoutPrefs): Session {
  if (slot === 'cardio') return cardio(p)
  if (slot === 'long') return cardio(p, 15)
  if (slot === 'intervals') return intervals(p)
  if (slot === 'mobility') return mobility(p)
  return strength(slot, p)
}

/** The weekly plan for these preferences and goal, Monday to Sunday. */
export function buildWeek(p: WorkoutPrefs, goal: Goal): WeekPlan {
  const week: WeekPlan = Array(7).fill(null)
  SCHEDULES[goal][p.days].forEach((slot, i) => (week[WEEKDAYS[p.days][i]] = session(slot, p)))
  return week
}

/** Calories a session burns above resting, the same way logged exercise counts them. */
export const sessionKcal = (s: Session, weightKg: number) => exerciseKcal(s.met, weightKg, s.minutes)

/** Monday = 0 … Sunday = 6. */
export const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7

// Food to eat around workouts, from Plate's list. Each pick names the allergen and diets that rule it out.
type FuelPick = { name: string; allergen?: Allergen; notFor?: DietStyle[] }
const BEFORE: FuelPick[] = [{ name: 'Banana' }, { name: 'Oatmeal, cooked with water', allergen: 'gluten' }, { name: 'Apple' }, { name: 'Dates' }]
const AFTER: FuelPick[] = [
  { name: 'Greek yogurt, 2%', allergen: 'milk', notFor: ['vegan'] },
  { name: 'Cottage cheese 2%', allergen: 'milk', notFor: ['vegan'] },
  { name: 'Egg, boiled', allergen: 'eggs', notFor: ['vegan'] },
  { name: 'Chicken breast, cooked', notFor: ['vegan', 'vegetarian', 'pescatarian'] },
  { name: 'Tuna, canned in water', allergen: 'fish', notFor: ['vegan', 'vegetarian'] },
  { name: 'Tofu, firm', allergen: 'soy' },
  { name: 'Lentils, cooked' },
  { name: 'Hummus', allergen: 'sesame' },
]

/** A few foods to eat before and after training that fit the person's diet and allergies. */
export function fuelPicks(diet: DietStyle, allergies: Allergen[]): { before: Food[]; after: Food[] } {
  const fits = (p: FuelPick) => !(p.allergen && allergies.includes(p.allergen)) && !p.notFor?.includes(diet)
  const foods = (picks: FuelPick[], n: number) =>
    picks.filter(fits).map((p) => BUILTIN_FOODS.find((f) => f.name === p.name)).filter((f): f is Food => !!f).slice(0, n)
  return { before: foods(BEFORE, 2), after: foods(AFTER, 3) }
}
