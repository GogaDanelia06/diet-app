import { describe, expect, it } from 'vitest'
import { eatingWindow, fastEnd, fastStartAt, fromMinutes, lastMealTime, toMinutes } from './mealTimes'

describe('meal time math', () => {
  it('converts between clock times and minutes, wrapping at midnight', () => {
    expect(toMinutes('22:00')).toBe(1320)
    expect(fromMinutes(1320)).toBe('22:00')
    expect(fromMinutes(1440 + 15)).toBe('00:15')
    expect(fromMinutes(-5)).toBe('23:55')
  })

  it('finds the eating window from the first to the last meal', () => {
    expect(eatingWindow(['22:00', '08:30', '13:15'])).toEqual({ start: '08:30', end: '22:00', minutes: 810 })
    expect(eatingWindow(['13:00'])).toBeNull()
  })

  it('says when a fast after the last meal ends', () => {
    expect(fastEnd('22:00', 16)).toEqual({ time: '14:00', nextDay: true })
    expect(fastEnd('06:00', 12)).toEqual({ time: '18:00', nextDay: false })
  })
})

describe('starting a fast earlier', () => {
  const sixPm = new Date(2026, 10, 5, 18, 0)
  it('counts a time that has passed as today', () => {
    expect(new Date(fastStartAt(14 * 60, sixPm))).toEqual(new Date(2026, 10, 5, 14, 0))
  })

  it('counts a later time as yesterday evening', () => {
    expect(new Date(fastStartAt(20 * 60 + 30, sixPm))).toEqual(new Date(2026, 10, 4, 20, 30))
  })

  it('finds the last meal logged today', () => {
    const entries = [{ date: '2026-11-05', time: '08:10' }, { date: '2026-11-05', time: '14:05' }, { date: '2026-11-05' }, { date: '2026-11-04', time: '21:00' }]
    expect(lastMealTime(entries, '2026-11-05')).toBe('14:05')
    expect(lastMealTime(entries, '2026-11-06')).toBeNull()
  })
})
