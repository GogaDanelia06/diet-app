import { useState } from 'react'
import { addDays, dateKey, dayLabel, shortDate } from '../lib/date'
import { kcal } from '../lib/format'
import { useDay, useStore, useTargets } from '../lib/store'
import { mealTotals } from '../lib/plan'
import { logStreak } from '../lib/insights'
import { MEALS, type DiaryEntry, type Meal } from '../lib/types'
import { Card, Field, Icon, MacroBar, Sheet } from './ui'
import FoodDetail from './FoodDetail'
import ExerciseSheet from './ExerciseSheet'
import FastingCard from './Fasting'

export default function Today({ date, setDate, onAdd }: { date: string; setDate: (d: string) => void; onAdd: (m: Meal) => void }) {
  const targets = useTargets()!
  const day = useDay(date)
  const settings = useStore((s) => s.settings)
  const entries = useStore((s) => s.entries)
  const [editing, setEditing] = useState<DiaryEntry | null>(null)
  const [exerciseOpen, setExerciseOpen] = useState(false)

  const budget = targets.kcal + day.bonus
  const remaining = budget - day.totals.kcal
  const isToday = date === dateKey()
  const streak = logStreak(entries, dateKey())

  return (
    <div className="space-y-3 pt-2">
      <header className="flex items-center justify-between py-2">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{dayLabel(date)}</h1>
          {isToday && streak >= 2 && (
            <div className="flex items-center gap-1 text-sm font-medium text-carbs">
              <Icon name="flame" className="h-4 w-4" /> {streak}-day logging streak
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isToday && (
            <button onClick={() => setDate(dateKey())} className="mr-1 rounded-full px-3 py-1.5 text-sm font-medium text-accent">
              Today
            </button>
          )}
          <button onClick={() => setDate(addDays(date, -1))} className="rounded-full bg-surface p-2" aria-label="Previous day">
            <Icon name="left" />
          </button>
          <button onClick={() => setDate(addDays(date, 1))} className="rounded-full bg-surface p-2" aria-label="Next day">
            <Icon name="right" />
          </button>
        </div>
      </header>

      <Card className="p-5">
        <div className="flex items-center gap-5">
          <Ring eaten={day.totals.kcal} budget={budget} remaining={remaining} />
          <dl className="flex-1 space-y-2 text-sm">
            <Line label="Goal" value={targets.kcal} />
            <Line label="Food" value={day.totals.kcal} sign="−" />
            {settings.exerciseEatBack > 0 && <Line label="Exercise" value={day.bonus} sign="+" />}
          </dl>
        </div>
        <div className="mt-5 flex gap-4">
          <MacroBar label="Protein" value={day.totals.protein} target={targets.protein} color="var(--protein)" />
          <MacroBar label="Carbs" value={day.totals.carbs} target={targets.carbs} color="var(--carbs)" />
          <MacroBar label="Fat" value={day.totals.fat} target={targets.fat} color="var(--fat)" />
        </div>
      </Card>

      {isToday && settings.showFasting && <FastingCard />}

      {MEALS.map((m) => (
        <MealCard
          key={m.id}
          date={date}
          meal={m.id}
          label={m.label}
          entries={day.entries.filter((e) => e.meal === m.id)}
          onAdd={() => onAdd(m.id)}
          onOpen={setEditing}
        />
      ))}

      <WaterCard date={date} />

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Exercise</h2>
          <span className="num text-sm text-muted">{kcal(day.burned)} kcal burned</span>
        </div>
        <StepsRow steps={day.steps} goal={settings.stepGoal} kcalFromSteps={day.fromSteps} onEdit={() => setExerciseOpen(true)} />
        <ExerciseList date={date} />
        <button onClick={() => setExerciseOpen(true)} className="mt-2 flex items-center gap-1.5 py-1 font-medium text-accent">
          <Icon name="plus" className="h-4 w-4" /> Add exercise
        </button>
      </Card>

      {editing && (
        <FoodDetail
          food={editing.food ?? { id: editing.id, name: editing.name, per100: perHundred(editing), servings: [], source: 'quick' }}
          initialGrams={editing.grams}
          initialMeal={editing.meal}
          entry={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {exerciseOpen && <ExerciseSheet date={date} onClose={() => setExerciseOpen(false)} />}
    </div>
  )
}

function perHundred(e: DiaryEntry) {
  const f = e.grams > 0 ? 100 / e.grams : 1
  return { kcal: e.nutrients.kcal * f, protein: e.nutrients.protein * f, carbs: e.nutrients.carbs * f, fat: e.nutrients.fat * f }
}

function Ring({ eaten, budget, remaining }: { eaten: number; budget: number; remaining: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  const pct = budget > 0 ? Math.min(1, eaten / budget) : 0
  const over = remaining < 0
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="12" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={over ? 'var(--over)' : 'var(--accent)'}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`num text-[34px] font-bold leading-none tracking-tight ${over ? 'text-over' : ''}`}>{kcal(Math.abs(remaining))}</span>
        <span className="mt-1 text-xs text-muted">{over ? 'kcal over' : 'kcal left'}</span>
      </div>
    </div>
  )
}

function Line({ label, value, sign }: { label: string; value: number; sign?: string }) {
  return (
    <div className="flex justify-between border-b border-line pb-2 last:border-0 last:pb-0">
      <dt className="text-muted">{label}</dt>
      <dd className="num font-semibold">
        {sign && Math.round(value) > 0 ? sign : ''}
        {kcal(value)}
      </dd>
    </div>
  )
}

function MealCard({
  date,
  meal,
  label,
  entries,
  onAdd,
  onOpen,
}: {
  date: string
  meal: Meal
  label: string
  entries: DiaryEntry[]
  onAdd: () => void
  onOpen: (e: DiaryEntry) => void
}) {
  const copyMeal = useStore((s) => s.copyMeal)
  const allEntries = useStore((s) => s.entries)
  const mealPlan = useStore((s) => s.mealPlan)
  const logPlanMeal = useStore((s) => s.logPlanMeal)
  const planned = (mealPlan?.days.find((d) => d.date === date)?.meals ?? []).filter((m) => m.meal === meal && !m.logged)
  const [saving, setSaving] = useState(false)
  const yesterday = addDays(date, -1)
  const yesterdayCount = entries.length === 0 ? allEntries.filter((e) => e.date === yesterday && e.meal === meal).length : 0
  const total = entries.reduce((n, e) => n + e.nutrients.kcal, 0)

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{label}</h2>
        <span className="num text-sm text-muted">{kcal(total)} kcal</span>
      </div>
      {entries.length > 0 && (
        <ul className="mt-2 divide-y divide-line">
          {entries.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => onOpen(e)}
                aria-label={`${e.name}, ${e.amountLabel}, ${kcal(e.nutrients.kcal)} kcal`}
                className="flex w-full items-center gap-3 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{e.name}</div>
                  <div className="truncate text-sm text-muted">
                    {e.brand ? `${e.brand}, ` : ''}
                    {e.amountLabel}
                  </div>
                </div>
                <span className="num font-semibold">{kcal(e.nutrients.kcal)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {planned.map((p) => (
        <div key={p.id} className="mt-2 flex items-center gap-3 rounded-2xl border border-dashed border-line px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-accent">On your plan</div>
            <div className="truncate font-medium">{p.name}</div>
          </div>
          <span className="num text-sm text-muted">{kcal(mealTotals(p).kcal)}</span>
          <button onClick={() => logPlanMeal(date, p.id)} className="btn btn-primary px-3 py-1.5 text-sm">
            I ate this
          </button>
        </div>
      ))}
      <div className="mt-1 flex items-center gap-4">
        <button onClick={onAdd} className="flex items-center gap-1.5 py-1.5 font-medium text-accent">
          <Icon name="plus" className="h-4 w-4" /> Add food
        </button>
        {yesterdayCount > 0 && (
          <button onClick={() => copyMeal(yesterday, meal, date)} className="flex items-center gap-1.5 py-1.5 text-sm text-muted">
            <Icon name="copy" className="h-4 w-4" /> Same as yesterday
          </button>
        )}
        {entries.length >= 2 && (
          <button onClick={() => setSaving(true)} className="ml-auto flex items-center gap-1.5 py-1.5 text-sm text-muted">
            <Icon name="bookmark" className="h-4 w-4" /> Save meal
          </button>
        )}
      </div>
      {saving && <SaveMealSheet entries={entries} defaultName={`${label}, ${shortDate(date)}`} onClose={() => setSaving(false)} />}
    </Card>
  )
}

function SaveMealSheet({ entries, defaultName, onClose }: { entries: DiaryEntry[]; defaultName: string; onClose: () => void }) {
  const saveMeal = useStore((s) => s.saveMeal)
  const [name, setName] = useState('')
  const total = entries.reduce((n, e) => n + e.nutrients.kcal, 0)
  return (
    <Sheet
      title="Save meal"
      onClose={onClose}
      footer={
        <button
          className="btn btn-primary w-full text-lg"
          onClick={() => {
            saveMeal(name.trim() || defaultName, entries)
            onClose()
          }}
        >
          Save meal
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-muted">
          Save these {entries.length} foods ({kcal(total)} kcal) together. Next time, add them all at once from Add food → My foods.
        </p>
        <Field label="Name">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultName} />
        </Field>
        <ul className="divide-y divide-line rounded-[18px] bg-surface px-4 text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex justify-between gap-3 py-2.5">
              <span className="min-w-0 truncate">{e.name}</span>
              <span className="num text-muted">{kcal(e.nutrients.kcal)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  )
}

function WaterCard({ date }: { date: string }) {
  const ml = useStore((s) => s.water[date] ?? 0)
  const { waterGoalMl, glassMl } = useStore((s) => s.settings)
  const addWater = useStore((s) => s.addWater)
  const glasses = Math.max(1, Math.round(waterGoalMl / glassMl))
  const filled = Math.floor(ml / glassMl)

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Water</h2>
        <span className="num text-sm text-muted">
          {(ml / 1000).toFixed(2).replace(/0$/, '')} / {waterGoalMl / 1000} L
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {Array.from({ length: Math.max(glasses, filled) }, (_, i) => (
          <button
            key={i}
            onClick={() => addWater(date, i < filled ? -glassMl : glassMl)}
            aria-label={i < filled ? 'Remove a glass' : 'Add a glass'}
            className={`flex h-10 w-8 items-end justify-center rounded-b-lg rounded-t-sm border-2 ${
              i < filled ? 'border-water bg-water/80' : 'border-line'
            }`}
          >
            {i === filled && <Icon name="plus" className="mb-2 h-3.5 w-3.5 text-muted" />}
          </button>
        ))}
      </div>
    </Card>
  )
}

function StepsRow({ steps, goal, kcalFromSteps, onEdit }: { steps: number; goal: number; kcalFromSteps: number; onEdit: () => void }) {
  const pct = goal > 0 ? Math.min(100, (steps / goal) * 100) : 0
  return (
    <button onClick={onEdit} className="mt-3 block w-full text-left" aria-label={`Steps: ${steps} of ${goal}. Edit steps`}>
      <div className="flex items-baseline justify-between text-sm">
        <span>
          <span className="num font-semibold">{steps.toLocaleString()}</span> <span className="text-muted">/ {goal.toLocaleString()} steps</span>
        </span>
        <span className="num text-muted">{kcalFromSteps > 0 ? `${kcal(kcalFromSteps)} kcal` : steps ? '' : 'Tap to add'}</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-surface-2">
        <div className="h-2 rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </button>
  )
}

function ExerciseList({ date }: { date: string }) {
  const exercises = useStore((s) => s.exercises).filter((e) => e.date === date)
  const remove = useStore((s) => s.removeExercise)
  if (!exercises.length) return null
  return (
    <ul className="mt-2 divide-y divide-line">
      {exercises.map((e) => (
        <li key={e.id} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{e.name}</div>
            <div className="text-sm text-muted">
              {e.minutes} min{e.distanceKm ? ` · ${e.distanceKm} km` : ''}
            </div>
          </div>
          <span className="num font-semibold">{kcal(e.kcal)}</span>
          <button onClick={() => remove(e.id)} className="p-1 text-muted" aria-label={`Remove ${e.name}`}>
            <Icon name="trash" className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  )
}
