import { useEffect, useState } from 'react'
import { locale, t } from '../lib/i18n'
import { fastStreak, formatDuration, hoursBetween } from '../lib/insights'
import { clockTime, shortDate, dateKey } from '../lib/date'
import { DAY_MINUTES, fastStartAt, lastMealTime, toMinutes } from '../lib/mealTimes'
import { Wheel, span } from './MealTimeSheet'
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
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    const onVisible = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])
  return now
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' })

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
        <h2 className="font-display text-lg font-semibold">{t('Fasting')}</h2>
        <button className="text-sm font-medium text-accent" onClick={() => setHistory(true)}>
          {t('History')}{streak > 1 ? ` · ${t('{n} in a row', { n: streak })}` : ''}
        </button>
      </div>

      {active ? (
        <div className="mt-3 flex items-center gap-4">
          <FastRing pct={pct} done={!!done} />
          <div className="min-w-0 flex-1">
            <div className="num text-3xl font-bold leading-none">{formatDuration(elapsed)}</div>
            <div className="mt-1 text-sm text-muted">
              {done
                ? t('You reached your {h}-hour goal', { h: active.hours })
                : t('{left} to go · ends {time}', { left: formatDuration(active.hours - elapsed), time: clock(active.start + active.hours * 3_600_000) })}
            </div>
            <button className="btn btn-quiet mt-3 px-3 py-2 text-sm" onClick={endFast}>
              {t('End fast')}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {FAST_PLANS.map((p) => (
              <Chip key={p.hours} active={goal === p.hours} onClick={() => updateSettings({ fastingHours: p.hours })}>
                {t(p.label)}
              </Chip>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1 py-2.5" onClick={() => startFast(goal)}>
              {t('Start {h}-hour fast now', { h: goal })}
            </button>
            <StartEarlier goal={goal} onStart={(start) => startFast(goal, start)} />
          </div>
        </div>
      )}
      {history && <FastHistory onClose={() => setHistory(false)} />}
    </Card>
  )
}

/**
 * For a fast that began earlier, like after lunch or last night's dinner. The time is picked on
 * wheels and only used when Start is tapped: the phone's own time box sets a value the moment it
 * opens, which used to start the fast at the current time.
 */
function StartEarlier({ goal, onStart }: { goal: number; onStart: (start: number) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn btn-quiet py-2.5" onClick={() => setOpen(true)}>
        {t('Earlier…')}
      </button>
      {open && (
        <FastStartSheet
          goal={goal}
          onClose={() => setOpen(false)}
          onStart={(start) => {
            setOpen(false)
            onStart(start)
          }}
        />
      )}
    </>
  )
}

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const MINUTES = Array.from({ length: 60 }, (_, m) => m)

function FastStartSheet({ goal, onClose, onStart }: { goal: number; onClose: () => void; onStart: (start: number) => void }) {
  const entries = useStore((s) => s.entries)
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const lastMeal = lastMealTime(entries, dateKey())
  // Most fasts start right after the last meal; without one, two hours ago is a likely guess.
  const [picked, setPicked] = useState(() => (lastMeal ? toMinutes(lastMeal) : (nowMinutes - 120 + DAY_MINUTES) % DAY_MINUTES))
  const hour = Math.floor(picked / 60)
  const minute = picked % 60
  const start = fastStartAt(picked, now)
  const ago = Math.round((now.getTime() - start) / 60_000)
  const end = start + goal * 3_600_000
  const yesterday = dateKey(new Date(start)) !== dateKey(now)
  const endsTomorrow = dateKey(new Date(end)) !== dateKey(now)
  const hour12 = new Intl.DateTimeFormat(locale(), { hour: 'numeric' }).resolvedOptions().hour12

  return (
    <Sheet
      title={t('When did your fast start?')}
      onClose={onClose}
      footer={
        <button className="btn btn-primary mb-2 w-full" onClick={() => onStart(start)}>
          {t('Start {h}-hour fast from {time}', { h: goal, time: clock(start) })}
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-center font-display text-xl font-semibold" role="status">
          {yesterday ? `${t('Yesterday')}, ${clock(start)}` : ago < 1 ? t('Just now') : t('{span} ago', { span: span(ago) })}
        </p>
        {lastMeal && toMinutes(lastMeal) !== picked && (
          <div className="flex justify-center">
            <button className="rounded-full border border-line px-3 py-1.5 text-sm" onClick={() => setPicked(toMinutes(lastMeal))}>
              {t('After your last meal at {time}', { time: clockTime(lastMeal) })}
            </button>
          </div>
        )}
        <div className="wheel-picker">
          <span className="wheel-band" aria-hidden="true" />
          <Wheel
            values={HOURS}
            value={hour}
            onChange={(h) => setPicked(h * 60 + minute)}
            label={t('Hour')}
            valueText={clock(start)}
            render={(h) => (
              <>
                <span className="num">{hour12 ? h % 12 || 12 : String(h).padStart(2, '0')}</span>
                {hour12 && <small>{h < 12 ? 'AM' : 'PM'}</small>}
              </>
            )}
          />
          <span className="wheel-colon" aria-hidden="true">:</span>
          <Wheel
            values={MINUTES}
            value={minute}
            onChange={(m) => setPicked(hour * 60 + m)}
            label={t('Minutes')}
            valueText={clock(start)}
            render={(m) => <span className="num">{String(m).padStart(2, '0')}</span>}
          />
        </div>
        <p className="text-center text-sm text-muted">
          {t(endsTomorrow ? 'Your {h}-hour fast ends tomorrow at {time}.' : 'Your {h}-hour fast ends at {time}.', { h: goal, time: clock(end) })}
        </p>
        <p className="text-center text-xs text-muted">{t('A time later than now counts as yesterday.')}</p>
      </div>
    </Sheet>
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
    <Sheet title={t('Fasting history')} onClose={onClose}>
      <div className="space-y-4">
        {history.length > 0 && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label={t('Fasts')} value={String(history.length)} />
            <Stat label={t('Reached goal')} value={String(reached)} />
            <Stat label={t('Average')} value={`${formatDuration(avg)} h`} />
          </div>
        )}
        {active && (
          <button className="btn btn-quiet w-full text-over" onClick={cancelFast}>
            {t('Cancel the current fast without saving')}
          </button>
        )}
        {history.length === 0 ? (
          <p className="text-muted">{t('Finished fasts show up here.')}</p>
        ) : (
          <ul className="divide-y divide-line rounded-[18px] bg-surface px-4">
            {history.map((f) => {
              const h = hoursBetween(f.start, f.end)
              return (
                <li key={f.start} className="flex items-center gap-3 py-3">
                  <div className="flex-1">
                    <div className="font-medium">{shortDate(dateKey(new Date(f.start)))}</div>
                    <div className="text-sm text-muted">
                      {clock(f.start)} – {clock(f.end)} · {t('goal {h} h', { h: f.hours })}
                    </div>
                  </div>
                  <span className={`num font-semibold ${h >= f.hours ? 'text-accent' : ''}`}>{formatDuration(h)}</span>
                  <button className="p-1 text-muted" onClick={() => removeFast(f.start)} aria-label={t('Delete this fast')}>
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs text-muted">
          {t('Fasting isn’t right for everyone. Skip it if you’re pregnant, have diabetes or a history of eating disorders, and ask a doctor if unsure.')}
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
