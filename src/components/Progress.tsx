import { useState } from 'react'
import { sumNutrients, weeksToGoal } from '../lib/calc'
import { addDays, dateKey, parseKey, shortDate } from '../lib/date'
import { kcal, kg, macro, num } from '../lib/format'
import { weeklyRate, weightTrend } from '../lib/insights'
import { currentWeight, useStore, useTargets } from '../lib/store'
import type { WeightLog } from '../lib/types'
import { Card, Icon, Segmented } from './ui'
import BodySection from './Body'

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
  const rate = weeklyRate(weights, dateKey())

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
        {rate != null && (
          <p className="mt-3 text-sm">
            Last 4 weeks:{' '}
            <span className={`num font-semibold ${rate < 0 ? 'text-accent' : ''}`}>
              {rate <= 0 ? '−' : '+'}
              {Math.abs(rate).toFixed(2)} kg a week
            </span>
            {profile.ratePerWeekKg > 0 && (
              <span className="text-muted">
                {' '}
                {-rate >= profile.ratePerWeekKg * 0.8
                  ? '· right on plan'
                  : -rate > 0
                    ? `· a bit slower than your ${profile.ratePerWeekKg} kg plan`
                    : '· not losing yet; check portions and log every day'}
              </span>
            )}
          </p>
        )}
        {goalDate && toGo > 0 && (
          <p className="mt-2 text-sm text-muted">
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
        <WeeklyNutrition days={days} />
      </Card>

      <ActivitySummary days={days} />

      <BodySection />

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
  const trend = weightTrend(data)
  const values = data.map((d) => d.kg)
  const lo = Math.floor(Math.min(...values, goal) - 1)
  const hi = Math.ceil(Math.max(...values, goal) + 1)
  const t0 = parseKey(data[0].date).getTime()
  const t1 = Math.max(parseKey(data.at(-1)!.date).getTime(), t0 + 1)
  const x = (d: string) => pad.l + ((parseKey(d).getTime() - t0) / (t1 - t0)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + ((hi - v) / (hi - lo)) * (H - pad.t - pad.b)
  const path = trend.map((d, i) => `${i ? 'L' : 'M'}${x(d.date).toFixed(1)},${y(d.trend).toFixed(1)}`).join(' ')
  const ticks = [lo, Math.round((lo + hi) / 2), hi]

  return (
    <>
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
      {data.map((d) => (
        <circle key={d.date} cx={x(d.date)} cy={y(d.kg)} r="3" fill="var(--muted)" opacity="0.55" />
      ))}
      <path d={path} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <text x={pad.l} y={H - 4} fontSize="11" fill="var(--muted)">
        {shortDate(data[0].date)}
      </text>
      <text x={W - pad.r} y={H - 4} textAnchor="end" fontSize="11" fill="var(--muted)">
        {shortDate(data.at(-1)!.date)}
      </text>
    </svg>
    <p className="mt-1 text-xs text-muted">Dots: weigh-ins. Line: 7-day average, which evens out water and salt swings.</p>
    </>
  )
}

function WeeklyNutrition({ days }: { days: string[] }) {
  const entries = useStore((s) => s.entries)
  const targets = useTargets()!
  const loggedDays = days.filter((d) => entries.some((e) => e.date === d))
  if (!loggedDays.length) return null
  const t = sumNutrients(entries.filter((e) => loggedDays.includes(e.date)).map((e) => e.nutrients))
  const n = loggedDays.length
  const energy = t.protein * 4 + t.carbs * 4 + t.fat * 9 || 1
  const fiberTarget = Math.round((targets.kcal / 1000) * 14)
  const rows: [string, number, number, string][] = [
    ['Protein', t.protein / n, targets.protein, 'var(--protein)'],
    ['Carbs', t.carbs / n, targets.carbs, 'var(--carbs)'],
    ['Fat', t.fat / n, targets.fat, 'var(--fat)'],
    ['Fiber', (t.fiber ?? 0) / n, fiberTarget, 'var(--accent)'],
  ]
  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className="font-medium">Daily average, {n} logged {n === 1 ? 'day' : 'days'}</h3>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full" aria-label="Share of calories from protein, carbs and fat">
        <div style={{ width: `${((t.protein * 4) / energy) * 100}%`, background: 'var(--protein)' }} />
        <div style={{ width: `${((t.carbs * 4) / energy) * 100}%`, background: 'var(--carbs)' }} />
        <div style={{ width: `${((t.fat * 9) / energy) * 100}%`, background: 'var(--fat)' }} />
      </div>
      <p className="mt-1 text-xs text-muted">
        {Math.round(((t.protein * 4) / energy) * 100)}% protein · {Math.round(((t.carbs * 4) / energy) * 100)}% carbs · {Math.round(((t.fat * 9) / energy) * 100)}% fat
      </p>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([label, value, target, color]) => (
          <div key={label} className="flex items-center gap-3">
            <dt className="w-16 text-muted">{label}</dt>
            <div className="h-2 flex-1 rounded-full bg-surface-2">
              <div className="h-2 rounded-full" style={{ width: `${Math.min(100, (value / target) * 100)}%`, background: color }} />
            </div>
            <dd className="num w-20 text-right">
              {macro(value)} / {target} g
            </dd>
          </div>
        ))}
      </dl>
      {rows[0][1] < targets.protein * 0.8 && (
        <p className="mt-3 text-sm text-muted">Protein is low. Eggs, chicken, fish, matsoni, cottage cheese and beans help you stay full while losing weight.</p>
      )}
    </div>
  )
}

function ActivitySummary({ days }: { days: string[] }) {
  const exercises = useStore((s) => s.exercises)
  const steps = useStore((s) => s.steps)
  const stepGoal = useStore((s) => s.settings.stepGoal)
  const week = exercises.filter((e) => days.includes(e.date))
  const stepDays = days.map((d) => steps[d] ?? 0)
  const loggedSteps = stepDays.filter((s) => s > 0)
  if (!week.length && !loggedSteps.length) return null
  const minutes = week.reduce((n, e) => n + e.minutes, 0)
  const burned = week.reduce((n, e) => n + e.kcal, 0)
  const avgSteps = loggedSteps.length ? loggedSteps.reduce((a, b) => a + b, 0) / loggedSteps.length : 0
  const max = Math.max(stepGoal, ...stepDays)

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold">Activity, last 7 days</h2>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Tile label="workouts" value={String(week.length)} />
        <Tile label="minutes" value={String(minutes)} />
        <Tile label="kcal burned" value={kcal(burned)} />
      </div>
      {loggedSteps.length > 0 && (
        <>
          <div className="relative mt-4 flex h-20 items-end gap-2">
            <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-accent" style={{ bottom: `${(stepGoal / max) * 100}%` }} />
            {stepDays.map((s, i) => (
              <div key={days[i]} className="flex h-full flex-1 flex-col justify-end">
                <div className="rounded-t-md" style={{ height: `${(s / max) * 100}%`, background: s >= stepGoal ? 'var(--accent)' : 'var(--water)' }} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">
            Steps: <span className="num font-semibold text-ink">{Math.round(avgSteps).toLocaleString()}</span> a day on average · goal {stepGoal.toLocaleString()}
          </p>
        </>
      )}
      {minutes < 150 && (
        <p className="mt-2 text-sm text-muted">Health guidelines suggest at least 150 minutes of moderate activity a week. Brisk walks count.</p>
      )}
    </Card>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 py-2.5">
      <div className="num text-xl font-semibold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
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
