import { useEffect, useState } from 'react'
import { fastStreak, formatDuration, hoursBetween } from '../lib/insights'
import { shortDate, dateKey } from '../lib/date'
import { useStore } from '../lib/store'
import { Card, Icon, Sheet } from './ui'
import { Chip } from './FoodDetail'

export const FAST_PLANS = [
  { hours: 12, label: '12:12' },
  { hours: 14, label: '14:10' },
  { hours: 16, label: '16:8' },
  { hours: 18, label: '18:6' },
  { hours: 20, label: '20:4' },
  { hours: 24, label: '24 h' },
]

function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    const onVisible = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])
  return now
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export default function FastingCard() {
  const fasting = useStore((s) => s.fasting)
  const goal = useStore((s) => s.settings.fastingHours)
  const updateSettings = useStore((s) => s.updateSettings)
  const startFast = useStore((s) => s.startFast)
  const endFast = useStore((s) => s.endFast)
  const now = useNow(30_000)
  const [history, setHistory] = useState(false)
  const active = fasting.active

  const elapsed = active ? hoursBetween(active.start, now) : 0
  const pct = active ? Math.min(1, elapsed / active.hours) : 0
  const done = active && elapsed >= active.hours
  const streak = fastStreak(fasting.history)

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Fasting</h2>
        <button className="text-sm font-medium text-accent" onClick={() => setHistory(true)}>
          History{streak > 1 ? ` · ${streak} in a row` : ''}
        </button>
      </div>

      {active ? (
        <div className="mt-3 flex items-center gap-4">
          <FastRing pct={pct} done={!!done} />
          <div className="min-w-0 flex-1">
            <div className="num text-3xl font-bold leading-none">{formatDuration(elapsed)}</div>
            <div className="mt-1 text-sm text-muted">
              {done
                ? `You reached your ${active.hours}-hour goal`
                : `${formatDuration(active.hours - elapsed)} to go · ends ${clock(active.start + active.hours * 3_600_000)}`}
            </div>
            <button className="btn btn-quiet mt-3 px-3 py-2 text-sm" onClick={endFast}>
              End fast
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {FAST_PLANS.map((p) => (
              <Chip key={p.hours} active={goal === p.hours} onClick={() => updateSettings({ fastingHours: p.hours })}>
                {p.label}
              </Chip>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1 py-2.5" onClick={() => startFast(goal)}>
              Start {goal}-hour fast now
            </button>
            <StartEarlier onStart={(start) => startFast(goal, start)} />
          </div>
        </div>
      )}
      {history && <FastHistory onClose={() => setHistory(false)} />}
    </Card>
  )
}

/** For when the fast actually began after last night's dinner. */
function StartEarlier({ onStart }: { onStart: (start: number) => void }) {
  return (
    <label className="btn btn-quiet relative cursor-pointer py-2.5">
      Earlier…
      <input
        type="time"
        className="absolute inset-0 opacity-0"
        aria-label="Start time of your fast"
        onChange={(e) => {
          const [h, m] = e.target.value.split(':').map(Number)
          if (Number.isNaN(h)) return
          const d = new Date()
          d.setHours(h, m, 0, 0)
          // A time later than now means yesterday evening.
          if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1)
          onStart(d.getTime())
        }}
      />
    </label>
  )
}

function FastRing({ pct, done }: { pct: number; done: boolean }) {
  const r = 30
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 76 76" className="h-20 w-20 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
      <circle
        cx="38"
        cy="38"
        r={r}
        fill="none"
        stroke={done ? 'var(--accent)' : 'var(--carbs)'}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
      />
    </svg>
  )
}

function FastHistory({ onClose }: { onClose: () => void }) {
  const history = useStore((s) => s.fasting.history)
  const active = useStore((s) => s.fasting.active)
  const cancelFast = useStore((s) => s.cancelFast)
  const removeFast = useStore((s) => s.removeFast)
  const reached = history.filter((f) => hoursBetween(f.start, f.end) >= f.hours).length
  const avg = history.length ? history.reduce((n, f) => n + hoursBetween(f.start, f.end), 0) / history.length : 0

  return (
    <Sheet title="Fasting history" onClose={onClose}>
      <div className="space-y-4">
        {history.length > 0 && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Fasts" value={String(history.length)} />
            <Stat label="Reached goal" value={String(reached)} />
            <Stat label="Average" value={`${formatDuration(avg)} h`} />
          </div>
        )}
        {active && (
          <button className="btn btn-quiet w-full text-over" onClick={cancelFast}>
            Cancel the current fast without saving
          </button>
        )}
        {history.length === 0 ? (
          <p className="text-muted">Finished fasts show up here.</p>
        ) : (
          <ul className="divide-y divide-line rounded-[18px] bg-surface px-4">
            {history.map((f) => {
              const h = hoursBetween(f.start, f.end)
              return (
                <li key={f.start} className="flex items-center gap-3 py-3">
                  <div className="flex-1">
                    <div className="font-medium">{shortDate(dateKey(new Date(f.start)))}</div>
                    <div className="text-sm text-muted">
                      {clock(f.start)} – {clock(f.end)} · goal {f.hours} h
                    </div>
                  </div>
                  <span className={`num font-semibold ${h >= f.hours ? 'text-accent' : ''}`}>{formatDuration(h)}</span>
                  <button className="p-1 text-muted" onClick={() => removeFast(f.start)} aria-label="Delete this fast">
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs text-muted">
          Fasting isn’t right for everyone. Skip it if you’re pregnant, have diabetes or a history of eating disorders, and ask a doctor if unsure.
        </p>
      </div>
    </Sheet>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface px-2 py-3">
      <div className="num text-xl font-semibold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}
