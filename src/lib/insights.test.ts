import { describe, expect, it } from 'vitest'
import { fastStreak, formatDuration, logStreak, weeklyRate, weightTrend } from './insights'
import type { DiaryEntry } from './types'

const entry = (date: string) => ({ date }) as DiaryEntry

describe('insights', () => {
  it('counts the logging streak, allowing today to be empty', () => {
    const entries = ['2026-10-26', '2026-10-27', '2026-10-28'].map(entry)
    expect(logStreak(entries, '2026-10-28')).toBe(3)
    expect(logStreak(entries, '2026-10-29')).toBe(3)
    expect(logStreak(entries, '2026-10-30')).toBe(0)
    expect(logStreak([...entries, entry('2026-10-24')], '2026-10-28')).toBe(3)
  })

  it('smooths weight over the previous 7 days', () => {
    const t = weightTrend([
      { date: '2026-10-01', kg: 90 },
      { date: '2026-10-03', kg: 88 },
      { date: '2026-10-10', kg: 86 },
    ])
    expect(t.map((x) => x.trend)).toEqual([90, 89, 86])
  })

  it('measures the weekly rate only with enough spread', () => {
    expect(weeklyRate([{ date: '2026-10-27', kg: 90 }, { date: '2026-10-28', kg: 89 }], '2026-10-28')).toBeNull()
    const rate = weeklyRate(
      [
        { date: '2026-10-07', kg: 90 },
        { date: '2026-10-14', kg: 89.5 },
        { date: '2026-10-21', kg: 89 },
        { date: '2026-10-28', kg: 88.5 },
      ],
      '2026-10-28',
    )
    expect(rate).toBeCloseTo(-0.5)
  })

  it('formats durations and counts fasts that hit their goal', () => {
    expect(formatDuration(16.5)).toBe('16:30')
    const h = 3_600_000
    expect(
      fastStreak([
        { start: 0, end: 17 * h, hours: 16 },
        { start: 0, end: 16 * h, hours: 16 },
        { start: 0, end: 10 * h, hours: 16 },
        { start: 0, end: 20 * h, hours: 16 },
      ]),
    ).toBe(2)
  })
})
