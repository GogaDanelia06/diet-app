import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { clockTime, dateKey, dayLabel } from '../lib/date'
import { locale, t } from '../lib/i18n'
import { DAY_MINUTES, eatingWindow, fastEnd, fromMinutes, toMinutes, USUAL_TIME } from '../lib/mealTimes'
import { mealTime, useStore } from '../lib/store'
import { MEAL_ICON, MEALS, type Meal } from '../lib/types'
import { Icon, Sheet } from './ui'

const ITEM = 44 // height of one row on a wheel, in px
const HOURS = Array.from({ length: 24 }, (_, h) => h)
const MINUTES = Array.from({ length: 60 }, (_, m) => m)

const nowMinutes = () => {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

/** "2 h 15 min" for a span of minutes. */
function span(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h && m ? t('{h} h {m} min', { h, m }) : h ? t('{h} h', { h }) : t('{m} min', { m })
}

/**
 * A scroll wheel like the phone's own time picker: the row in the middle band is the value.
 * Scroll it, tap a row, or use the arrow keys.
 */
function Wheel({ values, value, onChange, render, label, valueText }: {
  values: number[]
  value: number
  onChange: (v: number) => void
  render: (v: number) => ReactNode
  label: string
  valueText: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const scrolling = useRef(false)
  const settle = useRef(0)
  const index = values.indexOf(value)

  // Follow changes made elsewhere (like Now), but never fight the finger while it scrolls.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || scrolling.current) return
    const top = index * ITEM
    if (Math.abs(el.scrollTop - top) > 1) el.scrollTo({ top, behavior: el.dataset.ready ? 'smooth' : 'auto' })
    el.dataset.ready = '1'
  }, [index])

  function onScroll() {
    const el = ref.current
    if (!el) return
    scrolling.current = true
    const i = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM)))
    if (values[i] !== value) onChange(values[i])
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => (scrolling.current = false), 160)
  }

  function onKeyDown(e: KeyboardEvent) {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    onChange(values[Math.min(values.length - 1, Math.max(0, index + step))])
  }

  return (
    <div
      ref={ref}
      className="wheel"
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="spinbutton"
      aria-label={label}
      aria-valuemin={values[0]}
      aria-valuemax={values[values.length - 1]}
      aria-valuenow={value}
      aria-valuetext={valueText}
    >
      {values.map((v) => (
        <div key={v} className={`wheel-item ${v === value ? 'is-selected' : ''}`} onClick={() => onChange(v)} aria-hidden="true">
          {render(v)}
        </div>
      ))}
    </div>
  )
}

/**
 * Sets when a meal was eaten with an hour wheel and a minute wheel. The day's other meals show
 * beside their hours, and the eating window shows how long the day's eating lasted.
 */
export default function MealTimeSheet({ date, meal, label, onClose }: { date: string; meal: Meal; label: string; onClose: () => void }) {
  const entries = useStore((s) => s.entries)
  const setMealTime = useStore((s) => s.setMealTime)
  const showFasting = useStore((s) => s.settings.showFasting)
  const fastingHours = useStore((s) => s.settings.fastingHours)
  const saved = mealTime(entries, date, meal)
  const isToday = date === dateKey()
  const now = nowMinutes()
  // Logging today usually happens right after eating; other days start from the usual time.
  // Today a meal can't have been eaten later than now; earlier days allow any time.
  const latest = isToday ? now : DAY_MINUTES - 1
  const [picked, setPicked] = useState(() => (saved ? toMinutes(saved) : isToday ? now : toMinutes(USUAL_TIME[meal])))
  const value = Math.min(picked, latest)
  const setValue = (minutes: number) => setPicked(Math.min(minutes, latest))
  const hour = Math.floor(value / 60)
  const minute = value % 60
  const time = fromMinutes(value)
  const nowHour = Math.floor(now / 60)
  // The wheels stop at the current hour and minute, so a future time can't be chosen.
  const hours = isToday ? HOURS.slice(0, nowHour + 1) : HOURS
  const minutes = isToday && hour === nowHour ? MINUTES.slice(0, (now % 60) + 1) : MINUTES
  const hour12 = new Intl.DateTimeFormat(locale(), { hour: 'numeric' }).resolvedOptions().hour12
  const others = MEALS.filter((m) => m.id !== meal).flatMap((m) => {
    const when = mealTime(entries, date, m.id)
    return when ? [{ meal: m.id, when }] : []
  })
  const window = eatingWindow([...others.map((o) => o.when), time])
  const fast = window && showFasting ? fastEnd(window.end, fastingHours) : null

  function save() {
    setMealTime(date, meal, time)
    onClose()
  }

  return (
    <Sheet
      title={t('When did you eat?')}
      onClose={onClose}
      footer={
        <div className="flex gap-2 pb-2">
          {saved && (
            <button
              type="button"
              className="btn btn-quiet text-over"
              onClick={() => {
                setMealTime(date, meal, '')
                onClose()
              }}
            >
              {t('Remove time')}
            </button>
          )}
          <button type="button" className="btn btn-primary flex-1" onClick={save}>
            {t('Save {time}', { time: clockTime(time) })}
          </button>
        </div>
      }
    >
      <div className="meal-time-sheet">
        <p className="mt-meal">
          <span aria-hidden="true">{MEAL_ICON[meal]}</span> {label}
        </p>
        <div className="mt-when-row">
          <p className="mt-when" role="status">
            {!isToday ? dayLabel(date) : now - value < 1 ? t('Just now') : t('{span} ago', { span: span(now - value) })}
          </p>
          {isToday && value !== now && (
            <button type="button" className="mt-now" onClick={() => setValue(now)}>
              <Icon name="clock" className="h-3.5 w-3.5" />
              {t('Now')}
            </button>
          )}
        </div>

        <div className="wheel-picker">
          <span className="wheel-band" aria-hidden="true" />
          <Wheel
            values={hours}
            value={hour}
            onChange={(h) => setValue(h * 60 + minute)}
            label={t('Hour')}
            valueText={clockTime(time)}
            render={(h) => (
              <>
                <span className="num">{hour12 ? h % 12 || 12 : String(h).padStart(2, '0')}</span>
                {hour12 && <small>{h < 12 ? 'AM' : 'PM'}</small>}
                {others.some((o) => Math.floor(toMinutes(o.when) / 60) === h) && (
                  <i className="wheel-meal">{MEAL_ICON[others.find((o) => Math.floor(toMinutes(o.when) / 60) === h)!.meal]}</i>
                )}
              </>
            )}
          />
          <span className="wheel-colon" aria-hidden="true">:</span>
          <Wheel
            values={minutes}
            value={minute}
            onChange={(m) => setValue(hour * 60 + m)}
            label={t('Minutes')}
            valueText={clockTime(time)}
            render={(m) => <span className="num">{String(m).padStart(2, '0')}</span>}
          />
        </div>

        {window && (
          <div className="mt-summary">
            <p>
              <strong>{t('Eating window')}</strong> {t('{start} to {end}, {span}', { start: clockTime(window.start), end: clockTime(window.end), span: span(window.minutes) })}
            </p>
            {fast && (
              <p>
                {t(fast.nextDay ? 'A {h}-hour fast after your last meal ends tomorrow at {time}.' : 'A {h}-hour fast after your last meal ends at {time}.', {
                  h: fastingHours,
                  time: clockTime(fast.time),
                })}
              </p>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
