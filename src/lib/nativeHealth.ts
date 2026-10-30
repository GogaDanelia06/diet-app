import { Capacitor, registerPlugin } from '@capacitor/core'
import { HEALTH_WORKOUT, useStore } from './store'
import type { DeviceDay, ExerciseLog } from './types'

export interface HealthWorkout {
  id: string
  name: string
  start: string
  minutes: number
  kcal: number
  distanceKm?: number
}

/** One day as the iPhone app's Apple Health plugin reads it. */
export interface HealthDay {
  date: string
  steps: number
  activeKcal: number
  weightKg?: number
  workouts: HealthWorkout[]
}

interface PlateHealthPlugin {
  isAvailable(): Promise<{ available: boolean }>
  requestAccess(): Promise<{ granted: boolean }>
  readDay(options: { date: string }): Promise<HealthDay>
}

// Native code in ios/App/App/PlateHealthPlugin.swift; the website has no such plugin.
const PlateHealth = registerPlugin<PlateHealthPlugin>('PlateHealth')

/** True inside the iPhone app, where Plate reads Apple Health directly instead of through a Shortcut. */
export const isNativeApp = () => Capacitor.isNativePlatform()

/**
 * What a day read from Apple Health changes in Plate. With watch (or iPhone) active calories the day
 * counts those; without them it falls back to steps. Workouts become exercises with stable ids.
 */
export function healthDayUpdates(day: HealthDay, at: number) {
  const device: DeviceDay | null = day.activeKcal > 0 ? { activeKcal: day.activeKcal, steps: day.steps || undefined, source: 'health', at } : null
  const workouts: ExerciseLog[] = day.workouts.map((w) => ({
    id: `${HEALTH_WORKOUT}${w.id}`,
    date: day.date,
    name: w.name,
    minutes: w.minutes,
    kcal: w.kcal,
    ...(w.distanceKm ? { distanceKm: w.distanceKm } : {}),
  }))
  return { device, steps: device ? null : day.steps || null, workouts, weightKg: day.weightKg ?? null }
}

/** Reads the given days from Apple Health and saves them; returns the last day read. */
export async function syncAppleHealth(dates: string[]): Promise<HealthDay | null> {
  if (!isNativeApp()) return null
  if (!(await PlateHealth.isAvailable()).available) return null
  // Apple shows its permission sheet only the first time.
  await PlateHealth.requestAccess()
  let last: HealthDay | null = null
  for (const date of dates) {
    const day = await PlateHealth.readDay({ date })
    const u = healthDayUpdates(day, Date.now())
    const st = useStore.getState()
    if (u.device) st.setDeviceDay(date, u.device)
    else if (u.steps) st.setSteps(date, u.steps)
    st.importHealthWorkouts(date, u.workouts)
    if (u.weightKg) st.logWeight(date, u.weightKg)
    last = day
  }
  return last
}
