import { useId, useMemo, useState } from 'react'
import { calorieFloor } from '../lib/calc'
import { weightOnOrBefore } from '../lib/dashboard'
import { addDays, dateKey, parseKey, shortDate } from '../lib/date'
import { kcal } from '../lib/format'
import { dailyKcal, GARDEN_DAYS, GARDEN_REWARDS, gardenPlots, gardenStreak, goalForecast, mealIdeas, nextGardenReward, nextMealTarget, STREAK_HISTORY_DAYS, type MealIdea } from '../lib/gadgets'
import { locale, t, tName } from '../lib/i18n'
import { weeklyRate } from '../lib/insights'
import { dayBurn, useDay, useStore, useTargets } from '../lib/store'
import { MEALS, type WeightLog } from '../lib/types'
import { GardenView } from './ThreeViews'
import { Card, Icon } from './ui'
import WhatToEat from './WhatToEat'

export function WidgetHeading({ icon, title, detail }: { icon: Parameters<typeof Icon>[0]['name']; title: string; detail?: string }) {
  return <div className="widget-card-heading">
    <span className="widget-icon"><Icon name={icon} className="h-4 w-4" /></span>
    <h3>{title}</h3>
    {detail && <span className="widget-detail">{detail}</span>}
  </div>
}

/** How much to eat at the next meal, meals from the user's own history that fit, and the fridge/menu scanner. */
export function NextMealWidget() {
  const today = dateKey()
  const targets = useTargets()
  const day = useDay(today)
  const entries = useStore((s) => s.entries)
  const savedMeals = useStore((s) => s.savedMeals)
  const addEntry = useStore((s) => s.addEntry)
  // The scanner keeps the meal it was opened for, even after logging moves the card on to the next one.
  const [scanFor, setScanFor] = useState<ReturnType<typeof nextMealTarget> | null>(null)
  const [note, setNote] = useState('')
  if (!targets) return null

  const left = { kcal: targets.kcal + day.bonus - day.totals.kcal, protein: targets.protein - day.totals.protein }
  const next = nextMealTarget(new Date().getHours(), [...new Set(day.entries.map((e) => e.meal))], left)
  const ideas = mealIdeas(entries, savedMeals, today, next)
  const mealLabel = t(MEALS.find((m) => m.id === next.meal)!.label)
  const ideaName = (idea: MealIdea) => idea.title ?? idea.names.map(tName).join(' + ')

  function log(idea: MealIdea) {
    for (const item of idea.items) addEntry({ ...item, date: today, meal: next.meal })
    setNote(t('{name} added to {meal}.', { name: ideaName(idea), meal: mealLabel }))
  }

  return <>
    <Card className="dashboard-widget widget-next-meal">
      <WidgetHeading icon="bolt" title={t('Next meal')} detail={mealLabel} />
      {next.kcal > 0 ? <>
        <div className="widget-number-row"><strong className="num">{kcal(next.kcal)}</strong><span>{t('kcal · {n} g protein', { n: next.protein })}</span></div>
        <p className="widget-note">{t('A fair share of the {n} kcal you have left today.', { n: kcal(left.kcal) })}</p>
        {ideas.length > 0 && <>
          <h4 className="widget-subhead">{t('From your meals')}</h4>
          <ul className="meal-ideas">
            {ideas.map((idea) => <li key={idea.key}>
              <div><strong>{ideaName(idea)}</strong><span>{t('{n} kcal · {p} g protein', { n: kcal(idea.kcal), p: Math.round(idea.protein) })}</span></div>
              <button type="button" onClick={() => log(idea)} aria-label={t('Add {name} to {meal}', { name: ideaName(idea), meal: mealLabel })}><Icon name="plus" className="h-4 w-4" /></button>
            </li>)}
          </ul>
        </>}
        <button type="button" className="what-to-eat-button" onClick={() => setScanFor(next)}>
          <span className="quick-tool-icon"><Icon name="camera" /></span>
          <span><strong>{t('What can I eat?')}</strong><small>{t('Snap your fridge or a menu')}</small></span>
          <Icon name="right" className="h-4 w-4" />
        </button>
      </> : <>
        <div className="widget-number-row"><strong className="num">0</strong><span>kcal</span></div>
        <p className="widget-note">{t('You’ve reached today’s budget. If you’re still hungry, reach for vegetables, broth or tea.')}</p>
      </>}
      <p className="widget-note" role="status">{note}</p>
    </Card>
    {scanFor && <WhatToEat date={today} meal={scanFor.meal} target={scanFor} onClose={() => setScanFor(null)} />}
  </>
}

/** When the goal weight arrives at the real pace, with "what if" sliders that move the date. */
export function ForecastWidget() {
  const today = dateKey()
  const targets = useTargets()
  const profile = useStore((s) => s.profile)
  const weights = useStore((s) => s.weights)
  const entries = useStore((s) => s.entries)
  const exercises = useStore((s) => s.exercises)
  const steps = useStore((s) => s.steps)
  const deviceActivity = useStore((s) => s.deviceActivity)
  const [less, setLess] = useState(0)
  const [walk, setWalk] = useState(0)
  const lessId = useId()
  const walkId = useId()
  if (!profile || !targets) return null

  const current = weightOnOrBefore(weights, today)?.kg ?? profile.startWeightKg
  const eaten = dailyKcal(entries)
  // Only days that look fully logged say anything about the real calorie gap.
  const gaps: number[] = []
  for (let i = 1; i <= 14; i++) {
    const date = addDays(today, -i)
    const kcalEaten = eaten.get(date)
    if (kcalEaten === undefined || kcalEaten < targets.kcal * 0.5) continue
    gaps.push(targets.plan.maintenance + dayBurn({ exercises, steps, deviceActivity, profile, weights }, date).burned - kcalEaten)
  }
  const input = { currentKg: current, goalKg: profile.goalWeightKg, today, weighRate: weeklyRate(weights, today), loggedGaps: gaps, planRate: profile.ratePerWeekKg }
  const base = goalForecast(input)
  const walkKcal = Math.round((walk / 1300) * 0.5 * current)
  const forecast = goalForecast({ ...input, extraKcal: less + walkKcal })
  // Never offer to eat below the safe minimum.
  const maxLess = Math.min(500, Math.max(0, Math.floor((targets.kcal - calorieFloor(profile.sex)) / 50) * 50))
  const rate = Math.round(forecast.kgPerWeek * 100) / 100
  const sooner = base.days !== null && forecast.days !== null ? Math.floor((base.days - forecast.days) / 7) : null

  return <Card className="dashboard-widget widget-forecast">
    <WidgetHeading icon="calendar" title={t('Goal forecast')} detail={t('{kg} kg goal', { kg: profile.goalWeightKg })} />
    <div className="widget-number-row">
      <strong className="num">{forecast.status === 'onTrack' ? parseKey(forecast.date!).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }) : forecast.status === 'reached' ? t('Goal reached') : forecast.status === 'far' ? t('3+ years') : '—'}</strong>
      {forecast.status === 'onTrack' && <span>{t('in {n} weeks', { n: Math.ceil(forecast.days! / 7) })}</span>}
    </div>
    <p className="widget-note">
      {forecast.status === 'reached' ? t('You’re at {kg} kg. Set a new goal in Me whenever you’re ready.', { kg: current })
        : forecast.status === 'stalled' ? t('At this pace the scale isn’t moving toward your goal yet.')
        : t('About {n} kg a week.', { n: rate })}
    </p>
    {forecast.status !== 'reached' && <ForecastChart weights={weights} today={today} currentKg={current} goalKg={profile.goalWeightKg} end={forecast.date} />}
    {forecast.status !== 'reached' && <div className="what-if">
      <h4 className="widget-subhead">{t('What if…')}</h4>
      {maxLess > 0 && <label htmlFor={lessId}>
        <span className="what-if-row"><span>{t('I eat less each day')}</span><output className="num">{less ? `−${less}` : 0} kcal</output></span>
        <input id={lessId} type="range" min={0} max={maxLess} step={50} value={less} onChange={(e) => setLess(Number(e.target.value))} />
      </label>}
      <label htmlFor={walkId}>
        <span className="what-if-row"><span>{t('I walk more each day')}</span><output className="num">{walk ? `+${walk.toLocaleString(locale())}` : 0} {t('steps')}</output></span>
        <input id={walkId} type="range" min={0} max={6000} step={500} value={walk} onChange={(e) => setWalk(Number(e.target.value))} />
      </label>
      {less + walk > 0 && <p className="what-if-result" role="status">
        {base.status !== 'onTrack' && forecast.status === 'onTrack' ? t('That would get the scale moving toward your goal.')
          : sooner === 1 ? t('1 week sooner.')
          : sooner !== null && sooner > 1 ? t('{n} weeks sooner.', { n: sooner })
          : sooner === 0 ? t('Less than a week sooner.') : ''}
      </p>}
      {maxLess === 0 && <p className="widget-note">{t('Your target is already at the safe minimum, so moving more is the way to speed up.')}</p>}
    </div>}
    <p className="widget-note">
      {base.source === 'weighIns' ? t('Based on your weigh-ins from the last 4 weeks.')
        : base.source === 'logs' ? t('Based on {n} fully logged days in the last 2 weeks.', { n: gaps.length })
        : t('Based on your plan of {n} kg a week. Log your meals or weigh in a few times to make it yours.', { n: profile.ratePerWeekKg })}
    </p>
  </Card>
}

function ForecastChart({ weights, today, currentKg, goalKg, end }: { weights: WeightLog[]; today: string; currentKg: number; goalKg: number; end: string | null }) {
  const W = 320
  const H = 128
  const top = 14
  const bottom = 22
  const pad = 6
  const recent = weights.filter((w) => w.date > addDays(today, -60) && w.date <= today)
  const start = recent[0] && recent[0].date < addDays(today, -14) ? recent[0].date : addDays(today, -14)
  const last = end && end > today ? end : addDays(today, 30)
  const dayOf = (key: string) => parseKey(key).getTime() / 86_400_000
  const x = (key: string) => pad + ((dayOf(key) - dayOf(start)) / (dayOf(last) - dayOf(start))) * (W - pad * 2)
  const values = [goalKg, currentKg, ...recent.map((w) => w.kg)]
  const lo = Math.min(...values) - 0.5
  const hi = Math.max(...values) + 0.5
  const y = (kg: number) => top + ((hi - kg) / (hi - lo)) * (H - top - bottom)
  const label = end ? t('Your weight now and the path to {kg} kg by {date}', { kg: goalKg, date: shortDate(end) }) : t('Your recent weigh-ins')

  return <svg viewBox={`0 0 ${W} ${H}`} className="forecast-chart" role="img" aria-label={label}>
    <line x1={pad} x2={W - pad} y1={y(goalKg)} y2={y(goalKg)} className="forecast-goal-line" />
    <text x={pad} y={y(goalKg) - 6} className="forecast-label">{t('Goal {kg} kg', { kg: goalKg })}</text>
    {end && end > today && <line x1={x(today)} y1={y(currentKg)} x2={x(end)} y2={y(goalKg)} className="forecast-path" />}
    {recent.map((w) => <circle key={w.date} cx={x(w.date)} cy={y(w.kg)} r={4} className="forecast-dot"><title>{`${shortDate(w.date)}: ${w.kg} ${t('kg')}`}</title></circle>)}
    <circle cx={x(today)} cy={y(currentKg)} r={5} className="forecast-now"><title>{`${t('Today')}: ${currentKg} ${t('kg')}`}</title></circle>
    {end && end > today && <circle cx={x(end)} cy={y(goalKg)} r={5} className="forecast-end"><title>{`${shortDate(end)}: ${goalKg} ${t('kg')}`}</title></circle>}
    <text x={pad} y={H - 5} className="forecast-label">{shortDate(start)}</text>
    <text x={W - pad} y={H - 5} textAnchor="end" className="forecast-label">{shortDate(last)}</text>
  </svg>
}

/** A 3D raised bed where every full day within budget over the last four weeks grew a vegetable. */
export function GardenWidget({ date }: { date: string }) {
  const today = dateKey()
  const end = date < today ? date : today
  const targets = useTargets()
  const profile = useStore((s) => s.profile)
  const weights = useStore((s) => s.weights)
  const entries = useStore((s) => s.entries)
  const exercises = useStore((s) => s.exercises)
  const steps = useStore((s) => s.steps)
  const deviceActivity = useStore((s) => s.deviceActivity)
  const eatBack = useStore((s) => s.settings.exerciseEatBack)
  const target = targets?.kcal ?? 0
  // The bed shows four weeks, but the streak looks further back so the 30-day reward can be earned.
  const history = useMemo(() => {
    const eaten = dailyKcal(entries)
    const days = Array.from({ length: STREAK_HISTORY_DAYS }, (_, i) => {
      const day = addDays(end, i - STREAK_HISTORY_DAYS + 1)
      const burned = dayBurn({ exercises, steps, deviceActivity, profile, weights }, day).burned
      return { date: day, kcal: eaten.get(day) ?? 0, logged: eaten.has(day), budget: target + Math.round(burned * eatBack) }
    })
    return gardenPlots(days, today)
  }, [entries, exercises, steps, deviceActivity, profile, weights, eatBack, end, target, today])
  if (!targets) return null

  const plots = history.slice(-GARDEN_DAYS)
  const grown = plots.filter((p) => p.state === 'veg').length
  const streak = gardenStreak(history)
  const next = nextGardenReward(streak)
  return <Card className="dashboard-widget widget-garden">
    <WidgetHeading icon="leaf" title={t('Veggie garden')} detail={t('{n} days', { n: GARDEN_DAYS })} />
    <div className="garden-stage" role="img" aria-label={t('{n} vegetables grown in the last {days} days', { n: grown, days: GARDEN_DAYS })}>
      <GardenView plots={plots} streak={streak} />
    </div>
    <div className="garden-stats">
      <span><strong className="num">{grown}</strong>{t('grown')}</span>
      <span><strong className="num">{streak}</strong>{t('in a row')}</span>
    </div>
    <ul className="garden-rewards" aria-label={t('Streak rewards')}>
      {GARDEN_REWARDS.map((reward) => {
        const earned = streak >= reward.days
        const name = `${t(reward.label)}, ${t('{n} days in a row', { n: reward.days })}`
        return <li key={reward.days} className={earned ? 'is-earned' : ''} title={name}>
          <span aria-hidden="true">{reward.icon}</span>
          <small>{t(reward.label)}</small>
          <span className="sr-only">{name}: {t(earned ? 'unlocked' : 'locked')}</span>
        </li>
      })}
    </ul>
    <p className="widget-note">
      {next ? t('Each full day within your budget grows a vegetable. {n} more in a row to unlock: {reward}.', { n: next.daysLeft, reward: t(next.label) })
        : t('Every reward unlocked. Your garden is in full bloom!')}
    </p>
  </Card>
}
