import { useMemo, useState } from 'react'
import { addDays, dateKey, parseKey } from '../lib/date'
import { locale, t } from '../lib/i18n'
import { dayBurn, useStore, useTargets } from '../lib/store'
import { Card, Icon } from './ui'

type Status = 'none' | 'good' | 'light' | 'over'

const pad = (n: number) => String(n).padStart(2, '0')

/** How each logged day went against its budget (target plus eaten-back exercise). */
function useDayStatuses() {
  const entries = useStore((s) => s.entries)
  const exercises = useStore((s) => s.exercises)
  const steps = useStore((s) => s.steps)
  const deviceActivity = useStore((s) => s.deviceActivity)
  const profile = useStore((s) => s.profile)
  const weights = useStore((s) => s.weights)
  const eatBack = useStore((s) => s.settings.exerciseEatBack)
  const target = useTargets()!.kcal
  return useMemo(() => {
    const eaten = new Map<string, number>()
    for (const e of entries) eaten.set(e.date, (eaten.get(e.date) ?? 0) + e.nutrients.kcal)
    const status = new Map<string, Status>()
    for (const [date, kcal] of eaten) {
      const { burned } = dayBurn({ exercises, steps, deviceActivity, profile, weights }, date)
      const budget = target + burned * eatBack
      status.set(date, kcal > budget * 1.05 ? 'over' : kcal < budget * 0.6 ? 'light' : 'good')
    }
    return { status, workouts: new Set(exercises.map((e) => e.date)) }
  }, [entries, exercises, steps, deviceActivity, profile, weights, eatBack, target])
}

const STYLE: Record<Status, string> = {
  none: 'text-muted',
  good: 'bg-accent/90 text-accent-ink font-bold shadow-[0_0_14px_rgb(69_240_160/0.45)]',
  light: 'border border-carbs/70 text-carbs',
  over: 'bg-over/85 text-white font-bold shadow-[0_0_14px_rgb(255_107_87/0.4)]',
}

export function CalendarMonth({ selected, onPick }: { selected?: string; onPick: (date: string) => void }) {
  const today = dateKey()
  const [month, setMonth] = useState(() => (selected ?? today).slice(0, 7))
  const { status, workouts } = useDayStatuses()
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const daysInMonth = new Date(y, m, 0).getDate()
  const lead = (first.getDay() + 6) % 7 // weeks start on Monday
  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1)
    setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`)
  }
  // 26 Oct 2026 was a Monday; any Monday works for naming the weekday columns.
  const weekdays = Array.from({ length: 7 }, (_, i) => parseKey(addDays('2026-10-26', i)).toLocaleDateString(locale(), { weekday: 'narrow' }))
  const logged = [...status.keys()].filter((d) => d.startsWith(month)).length

  return (
    <div>
      <div className="flex items-center justify-between">
        <button className="rounded-full p-2 text-muted" onClick={() => shift(-1)} aria-label={t('Previous month')}>
          <Icon name="left" />
        </button>
        <div className="text-center">
          <div className="font-display text-lg font-semibold capitalize">{first.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</div>
          <div className="text-xs text-muted">{t('{n} days logged', { n: logged })}</div>
        </div>
        <button className="rounded-full p-2 text-muted disabled:opacity-30" onClick={() => shift(1)} disabled={month >= today.slice(0, 7)} aria-label={t('Next month')}>
          <Icon name="right" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
        {weekdays.map((w, i) => (
          <div key={i}>{w}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = `${month}-${pad(i + 1)}`
          const s = status.get(date) ?? 'none'
          const future = date > today
          return (
            <button
              key={date}
              disabled={future}
              onClick={() => onPick(date)}
              className={`num relative flex aspect-square items-center justify-center rounded-xl text-sm transition-transform active:scale-90 disabled:opacity-25 ${STYLE[s]} ${
                date === today ? 'ring-2 ring-white/70' : ''
              } ${date === selected ? 'outline outline-2 outline-offset-2 outline-accent' : ''}`}
              aria-label={`${parseKey(date).toLocaleDateString(locale(), { day: 'numeric', month: 'long' })}${s !== 'none' ? `, ${t(s === 'good' ? 'on target' : s === 'over' ? 'over budget' : 'under-eaten or partly logged')}` : ''}`}
            >
              {i + 1}
              {workouts.has(date) && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-water shadow-[0_0_6px_var(--water)]" />}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <Legend className="bg-accent" label={t('On target')} />
        <Legend className="bg-over" label={t('Over')} />
        <Legend className="border border-carbs" label={t('Light or partly logged')} />
        <Legend className="h-1.5 w-1.5 rounded-full bg-water" label={t('Workout')} />
      </div>
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded ${className}`} />
      {label}
    </span>
  )
}

export function CalendarCard({ onOpenDay }: { onOpenDay: (date: string) => void }) {
  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
        <Icon name="calendar" className="h-5 w-5 text-accent" /> {t('History')}
      </h2>
      <CalendarMonth onPick={onOpenDay} />
    </Card>
  )
}
