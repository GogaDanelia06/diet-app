import { useState } from 'react'
import { weeksToGoal } from '../lib/calc'
import { addDays, dateKey, parseKey, shortDate } from '../lib/date'
import { kcal, kg, num } from '../lib/format'
import { currentWeight, useStore, useTargets } from '../lib/store'
import type { WeightLog } from '../lib/types'
import { Card, Icon, Segmented } from './ui'

type Range = '30' | '90' | 'all'

export default function Progress() {
  const profile = useStore((s) => s.profile)!
  const weights = useStore((s) => s.weights)
  const entries = useStore((s) => s.entries)
  const logWeight = useStore((s) => s.logWeight)
  const removeWeight = useStore((s) => s.removeWeight)
  const targets = useTargets()!
  const [input, setInput] = useState('')
  const [range, setRange] = useState<Range>('90')

  const now = currentWeight({ weights, profile })
  const lost = profile.startWeightKg - now
  const toGo = now - profile.goalWeightKg
  const weeks = weeksToGoal(now, profile.goalWeightKg, profile.ratePerWeekKg)
  const goalDate = weeks ? parseKey(addDays(dateKey(), weeks * 7)).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : null
  const cutoff = range === 'all' ? '' : addDays(dateKey(), -Number(range))
  const shown = weights.filter((w) => w.date >= cutoff)

  const days = Array.from({ length: 7 }, (_, i) => addDays(dateKey(), i - 6))
  const daily = days.map((d) => ({ date: d, kcal: entries.filter((e) => e.date === d).reduce((n, e) => n + e.nutrients.kcal, 0) }))
  const logged = daily.filter((d) => d.kcal > 0)
  const avg = logged.length ? logged.reduce((n, d) => n + d.kcal, 0) / logged.length : 0

  return (
    <div className="space-y-3 pt-2">
      <h1 className="py-2 font-display text-3xl font-bold tracking-tight">Progress</h1>

      <Card className="p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-sm text-muted">Current weight</div>
            <div className="num text-5xl font-bold tracking-tight">{now.toFixed(1)}<span className="ml-1 text-2xl font-semibold text-muted">kg</span></div>
          </div>
          <div className="text-right text-sm">
            <div className={`num font-semibold ${lost > 0 ? 'text-accent' : ''}`}>
              {lost > 0 ? '−' : lost < 0 ? '+' : ''}
              {kg(Math.abs(lost))}
            </div>
            <div className="text-muted">since {shortDate(profile.startDate)}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-surface-2 p-3">
            <div className="text-muted">Goal</div>
            <div className="num text-lg font-semibold">{kg(profile.goalWeightKg)}</div>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <div className="text-muted">{toGo > 0 ? 'To go' : 'Goal reached'}</div>
            <div className="num text-lg font-semibold">{toGo > 0 ? kg(toGo) : '🎉'}</div>
          </div>
        </div>
        {goalDate && toGo > 0 && (
          <p className="mt-3 text-sm text-muted">
            On pace at {profile.ratePerWeekKg} kg a week, you’ll get there around {goalDate}.
          </p>
        )}

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const v = num(input)
            if (v >= 30 && v <= 300) {
              logWeight(dateKey(), v)
              setInput('')
            }
          }}
        >
          <input className="field num" inputMode="decimal" placeholder="Today’s weight, kg" value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="btn btn-primary shrink-0" disabled={!(num(input) >= 30)}>
            Log
          </button>
        </form>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Weight</h2>
          <div className="w-44">
            <Segmented
              value={range}
              onChange={setRange}
              options={[
                { value: '30', label: '1M' },
                { value: '90', label: '3M' },
                { value: 'all', label: 'All' },
              ]}
            />
          </div>
        </div>
        {shown.length >= 2 ? (
          <WeightChart data={shown} goal={profile.goalWeightKg} />
        ) : (
          <p className="py-6 text-center text-muted">Log your weight a few times to see the trend. Once a week, same time of day, works best.</p>
        )}
      </Card>

      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold">Last 7 days</h2>
          {avg > 0 && <span className="text-sm text-muted">avg <span className="num font-semibold text-ink">{kcal(avg)}</span> kcal</span>}
        </div>
        <CalorieBars days={daily} target={targets.kcal} />
      </Card>

      {weights.length > 0 && (
        <Card>
          <h2 className="mb-1 font-display text-lg font-semibold">Weigh-ins</h2>
          <ul className="divide-y divide-line">
            {[...weights].reverse().slice(0, 12).map((w) => (
              <li key={w.date} className="flex items-center justify-between py-2.5">
                <span>{shortDate(w.date)}</span>
                <span className="flex items-center gap-3">
                  <span className="num font-semibold">{kg(w.kg)}</span>
                  <button className="p-1 text-muted" onClick={() => removeWeight(w.date)} aria-label={`Delete weigh-in on ${shortDate(w.date)}`}>
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function WeightChart({ data, goal }: { data: WeightLog[]; goal: number }) {
  const W = 340
  const H = 170
  const pad = { l: 34, r: 8, t: 10, b: 22 }
  const values = data.map((d) => d.kg)
  const lo = Math.floor(Math.min(...values, goal) - 1)
  const hi = Math.ceil(Math.max(...values, goal) + 1)
  const t0 = parseKey(data[0].date).getTime()
  const t1 = Math.max(parseKey(data.at(-1)!.date).getTime(), t0 + 1)
  const x = (d: string) => pad.l + ((parseKey(d).getTime() - t0) / (t1 - t0)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + ((hi - v) / (hi - lo)) * (H - pad.t - pad.b)
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(d.date).toFixed(1)},${y(d.kg).toFixed(1)}`).join(' ')
  const ticks = [lo, Math.round((lo + hi) / 2), hi]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Weight from ${data[0].kg} to ${data.at(-1)!.kg} kg`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
            {t}
          </text>
        </g>
      ))}
      <line x1={pad.l} x2={W - pad.r} y1={y(goal)} y2={y(goal)} stroke="var(--accent)" strokeDasharray="4 4" />
      <text x={W - pad.r} y={y(goal) - 5} textAnchor="end" fontSize="11" fill="var(--accent)">
        goal
      </text>
      <path d={path} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d) => (
        <circle key={d.date} cx={x(d.date)} cy={y(d.kg)} r="3.5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2" />
      ))}
      <text x={pad.l} y={H - 4} fontSize="11" fill="var(--muted)">
        {shortDate(data[0].date)}
      </text>
      <text x={W - pad.r} y={H - 4} textAnchor="end" fontSize="11" fill="var(--muted)">
        {shortDate(data.at(-1)!.date)}
      </text>
    </svg>
  )
}

function CalorieBars({ days, target }: { days: { date: string; kcal: number }[]; target: number }) {
  const max = Math.max(target * 1.3, ...days.map((d) => d.kcal))
  return (
    <div className="mt-4">
      <div className="relative flex h-36 items-end gap-2">
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-accent" style={{ bottom: `${(target / max) * 100}%` }} />
        {days.map((d) => (
          <div key={d.date} className="flex h-full flex-1 flex-col justify-end">
            <div
              className="rounded-t-md"
              style={{ height: `${(d.kcal / max) * 100}%`, background: d.kcal > target ? 'var(--over)' : 'var(--accent)', opacity: d.kcal ? 1 : 0 }}
              title={`${kcal(d.kcal)} kcal`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2 text-center text-[11px] text-muted">
        {days.map((d) => (
          <div key={d.date} className="flex-1">
            {parseKey(d.date).toLocaleDateString(undefined, { weekday: 'narrow' })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Dashed line: your {kcal(target)} kcal target</p>
    </div>
  )
}
