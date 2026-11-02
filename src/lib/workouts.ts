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
  /** Time of day to train, "HH:mm", for the plan and the iPhone app's reminder. */
  time?: string
}

export const DEFAULT_WORKOUT_PREFS: WorkoutPrefs = { place: 'home', days: 3, minutes: 30, level: 'beginner' }

/** How a move is counted: weight × reps, reps alone, seconds held, or minutes. */
export type MoveType = 'weighted' | 'reps' | 'hold' | 'time'

/** One line of a session. Text is English and translated where it's shown. */
export interface Move {
  /** Library id, so the same move can be compared across workouts. */
  id: string
  name: string
  /** Numbers and units only, like "3 × 10–12", "3 × 30 s" or "20 min", so it reads the same in any language. */
  dose: string
  cue: string
  type: MoveType
  sets: number
  /** Target range: reps, seconds or minutes by type. */
  low: number
  high: number
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

type MoveDef = { name: string; cue: string; type: Exclude<MoveType, 'time'>; easier?: string; gym?: boolean; extra?: boolean }

// No-equipment moves work at home or outdoors (a stair, chair or park bench is enough); gym moves use machines,
// dumbbells and barbells. Extra moves aren't in the generated plans but can be added to any workout.
const MOVES: Record<string, MoveDef> = {
  squat: { name: 'Bodyweight squat', type: 'reps', cue: 'Sit back as if onto a chair, chest up, knees in line with your toes.' },
  pushup: { name: 'Push-up', type: 'reps', easier: 'Knee or incline push-up', cue: 'Body in one straight line; lower your chest to a fist’s height from the floor.' },
  bridge: { name: 'Glute bridge', type: 'reps', cue: 'Lying on your back, squeeze your glutes to lift your hips; pause at the top.' },
  lunge: { name: 'Reverse lunge', type: 'reps', cue: 'Step back and lower until both knees bend to about 90°; push back up through the front heel.' },
  plank: { name: 'Plank', type: 'hold', cue: 'Elbows under shoulders, belly tight, hips level with your shoulders.' },
  superman: { name: 'Superman hold', type: 'hold', cue: 'Lying face down, lift your arms, chest and legs a little and hold.' },
  stepUp: { name: 'Step-up on a stair or sturdy chair', type: 'reps', cue: 'Push through the heel of the top foot; step down slowly.' },
  dip: { name: 'Chair dip', type: 'reps', cue: 'Hands on a sturdy chair behind you; bend your elbows to 90° and press back up.' },
  sidePlank: { name: 'Side plank', type: 'hold', cue: 'On one elbow, body in a straight line; switch sides halfway.' },
  deadBug: { name: 'Dead bug', type: 'reps', cue: 'On your back, slowly lower the opposite arm and leg while your lower back stays on the floor.' },
  climber: { name: 'Mountain climbers', type: 'hold', cue: 'From a push-up position, drive your knees to your chest one after the other.' },
  wallSit: { name: 'Wall sit', type: 'hold', cue: 'Back against a wall, thighs parallel to the floor.' },
  gobletSquat: { name: 'Goblet squat', type: 'weighted', gym: true, cue: 'Hold a dumbbell at your chest and squat until your thighs are level with your knees or lower.' },
  bench: { name: 'Dumbbell bench press', type: 'weighted', gym: true, cue: 'Lower the dumbbells to chest level with elbows at about 45°, then press up.' },
  pulldown: { name: 'Lat pulldown', type: 'weighted', gym: true, cue: 'Pull the bar to your upper chest, leading with your elbows; don’t lean far back.' },
  row: { name: 'Seated cable row', type: 'weighted', gym: true, cue: 'Pull the handle to your belly and squeeze your shoulder blades together.' },
  rdl: { name: 'Romanian deadlift (dumbbells)', type: 'weighted', gym: true, cue: 'Push your hips back with a flat back until you feel your hamstrings stretch, then stand tall.' },
  legPress: { name: 'Leg press', type: 'weighted', gym: true, cue: 'Lower until your knees are at about 90°; don’t lock them at the top.' },
  press: { name: 'Dumbbell shoulder press', type: 'weighted', gym: true, cue: 'Press the dumbbells overhead without arching your lower back.' },
  hipThrust: { name: 'Hip thrust', type: 'weighted', gym: true, cue: 'Upper back on a bench, drive your hips up and squeeze at the top.' },
  walkLunge: { name: 'Walking lunges with dumbbells', type: 'weighted', gym: true, cue: 'Long steps, back knee close to the floor, upper body upright.' },
  backSquat: { name: 'Barbell back squat', type: 'weighted', gym: true, extra: true, cue: 'Bar on your upper back; squat until your thighs are at least level with your knees, knees over your toes.' },
  deadlift: { name: 'Deadlift', type: 'weighted', gym: true, extra: true, cue: 'Bar over the middle of your feet, flat back; push the floor away and stand tall.' },
  barbellBench: { name: 'Barbell bench press', type: 'weighted', gym: true, extra: true, cue: 'Lower the bar to the middle of your chest under control, then press up.' },
  pullup: { name: 'Pull-up', type: 'reps', gym: true, extra: true, cue: 'Hang with straight arms and pull until your chin passes the bar; use a band or machine to help if needed.' },
  curl: { name: 'Biceps curl', type: 'weighted', gym: true, extra: true, cue: 'Elbows at your sides; curl up without swinging your body.' },
  pushdown: { name: 'Triceps pushdown', type: 'weighted', gym: true, extra: true, cue: 'Elbows pinned to your sides; push the handle down until your arms are straight.' },
  lateralRaise: { name: 'Lateral raise', type: 'weighted', gym: true, extra: true, cue: 'Raise the dumbbells out to shoulder height with slightly bent elbows.' },
  chestFly: { name: 'Chest fly (machine)', type: 'weighted', gym: true, extra: true, cue: 'Bring your hands together in a wide arc and squeeze your chest.' },
  legCurl: { name: 'Leg curl', type: 'weighted', gym: true, extra: true, cue: 'Curl your heels toward your glutes, then lower slowly.' },
  legExtension: { name: 'Leg extension', type: 'weighted', gym: true, extra: true, cue: 'Straighten your knees fully, then lower slowly.' },
  calfRaise: { name: 'Calf raise', type: 'weighted', gym: true, extra: true, cue: 'Rise high onto your toes, pause, then lower all the way.' },
}

/** Every move, for adding to a workout: gym moves first. */
export const MOVE_LIBRARY = Object.entries(MOVES)
  .map(([id, m]) => ({ id, name: m.name, cue: m.cue, type: m.type, gym: !!m.gym }))
  .sort((a, b) => Number(b.gym) - Number(a.gym))

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
// Sets and reps (or seconds for holds) by level.
const SCHEME: Record<Level, { sets: number; low: number; high: number; holdSets: number; hold: number }> = {
  beginner: { sets: 2, low: 10, high: 10, holdSets: 2, hold: 20 },
  intermediate: { sets: 3, low: 10, high: 12, holdSets: 3, hold: 30 },
  advanced: { sets: 4, low: 8, high: 12, holdSets: 3, hold: 45 },
}
const MOVES_FOR_MINUTES: Record<WorkoutPrefs['minutes'], number> = { 20: 4, 30: 5, 45: 6, 60: 7 }

const range = (low: number, high: number) => (low === high ? `${low}` : `${low}–${high}`)

/** A library move with the sets and reps for a level. */
export function moveFor(id: string, level: Level = 'intermediate'): Move {
  const m = MOVES[id]
  const s = SCHEME[level]
  const name = level === 'beginner' && m.easier ? m.easier : m.name
  if (m.type === 'hold') return { id, name, cue: m.cue, type: 'hold', sets: s.holdSets, low: s.hold, high: s.hold, dose: `${s.holdSets} × ${s.hold} s` }
  return { id, name, cue: m.cue, type: m.type, sets: s.sets, low: s.low, high: s.high, dose: `${s.sets} × ${range(s.low, s.high)}` }
}

const timed = (id: string, name: string, minutes: number, cue: string): Move => ({ id, name, cue, type: 'time', sets: 1, low: minutes, high: minutes, dose: `${minutes} min` })

// METs from the Compendium of Physical Activities: resistance training 3.5 (moderate) and 6.0 (vigorous),
// calisthenics 3.8 (moderate) and 8.0 (vigorous), circuit training 4.3.
const STRENGTH_MET: Record<'home' | 'gym', Record<Level, number>> = {
  home: { beginner: 3.8, intermediate: 4.3, advanced: 8.0 },
  gym: { beginner: 3.5, intermediate: 3.5, advanced: 6.0 },
}

function strength(key: keyof typeof STRENGTH_TITLES, p: WorkoutPrefs): Session {
  const gear = p.place === 'gym' ? 'gym' : 'home'
  return {
    key,
    title: STRENGTH_TITLES[key],
    kind: 'strength',
    minutes: p.minutes,
    met: STRENGTH_MET[gear][p.level],
    moves: [
      timed('warmup', 'Warm-up', 5, 'March or walk on the spot, swing your arms and do a few slow squats.'),
      ...TEMPLATES[gear][key].slice(0, MOVES_FOR_MINUTES[p.minutes]).map((id) => moveFor(id, p.level)),
    ],
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
      timed('warmup', 'Warm-up', 5, 'Start slowly and build up.'),
      timed('cardio', title, minutes - 10, cue),
      timed('cooldown', 'Cool-down', 5, 'Slow down gradually, then stretch your legs.'),
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
      timed('warmup', 'Warm-up', 5, 'Easy pace, getting a little faster.'),
      timed('intervals', title, p.minutes - 10, cue),
      timed('cooldown', 'Cool-down', 5, 'Easy pace until your breathing settles.'),
    ],
  }
}

function mobility(p: WorkoutPrefs): Session {
  const minutes = Math.min(p.minutes, 20)
  const hold = (id: string, name: string, cue: string): Move => ({ id, name, cue, type: 'hold', sets: 2, low: 30, high: 30, dose: '2 × 30 s' })
  return {
    key: 'mobility',
    title: 'Stretch and mobility',
    kind: 'mobility',
    minutes,
    met: 2.3,
    moves: [
      { id: 'catCow', name: 'Cat–cow', dose: '× 10', type: 'reps', sets: 1, low: 10, high: 10, cue: 'On hands and knees, round then arch your back with your breath.' },
      hold('hipFlexor', 'Hip flexor stretch', 'Half-kneeling, tuck your hips under until the front of the back hip stretches.'),
      hold('hamstring', 'Hamstring stretch', 'One heel forward, hinge at the hips with a flat back.'),
      { id: 'thoracic', name: 'Thoracic rotation', dose: '2 × 8', type: 'reps', sets: 2, low: 8, high: 8, cue: 'On hands and knees, one hand behind your head; rotate your elbow up to the ceiling.' },
      timed('childsPose', 'Child’s pose', 1, 'Knees wide, sit back on your heels, arms long, breathe slowly.'),
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
