import { useEffect, useState } from 'react'
import { generateMealPlan, swapPlanMeal } from '../lib/ai'
import { dateKey, dayLabel, parseKey, shortDate } from '../lib/date'
import { kcal, macro } from '../lib/format'
import { buildPlan, cleanPlanMeal, dayTotals, mealSlots, mealTotals, shoppingList } from '../lib/plan'
import { currentWeight, useStore, useTargets } from '../lib/store'
import { MEALS, type DietStyle, type MealPlan, type PlanMeal, type PlanPrefs } from '../lib/types'
import { ErrorNote, Field, Icon, Segmented, Sheet, Spinner } from './ui'

const DIETS: { value: DietStyle; label: string }[] = [
  { value: 'any', label: 'Anything' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'pescatarian', label: 'Fish, no meat' },
  { value: 'vegan', label: 'Vegan' },
]

function usePlanRequest() {
  const profile = useStore((s) => s.profile)!
  const weight = useStore((s) => currentWeight(s))
  const prefs = useStore((s) => s.planPrefs)
  const settings = useStore((s) => s.settings)
  const targets = useTargets()!
  return {
    cfg: { key: settings.geminiKey, model: settings.geminiModel },
    prefs,
    targets,
    base: {
      targetKcal: targets.kcal,
      protein: targets.protein,
      prefs,
      person: `${profile.sex}, ${profile.age} years old, ${profile.heightCm} cm, ${weight} kg, aiming for ${profile.goalWeightKg} kg`,
    },
  }
}

export default function MealPlanView() {
  const plan = useStore((s) => s.mealPlan)
  const [editing, setEditing] = useState(!plan)

  if (editing || !plan) return <PlanSetup onDone={() => setEditing(false)} onCancel={plan ? () => setEditing(false) : undefined} />
  return <PlanDays plan={plan} onNewPlan={() => setEditing(true)} />
}

function PlanSetup({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const setPlanPrefs = useStore((s) => s.setPlanPrefs)
  const setMealPlan = useStore((s) => s.setMealPlan)
  const { cfg, prefs, targets, base } = usePlanRequest()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const slots = mealSlots(prefs.snacks, targets.kcal)

  async function make() {
    setLoading(true)
    setError('')
    try {
      const raw = await generateMealPlan(cfg, { ...base, days: prefs.days, slots })
      setMealPlan(buildPlan(raw, dateKey(), targets.kcal))
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The plan could not be made. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const set = <K extends keyof PlanPrefs>(k: K) => (v: PlanPrefs[K]) => setPlanPrefs({ [k]: v } as Partial<PlanPrefs>)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold">Plan my meals</h2>
        <p className="mt-1 text-muted">
          The AI writes a menu that adds up to your {kcal(targets.kcal)} kcal a day with at least {targets.protein} g protein.
        </p>
      </div>

      <Field label="What do you eat?">
        <div className="grid grid-cols-2 gap-2">
          {DIETS.map((d) => (
            <button
              key={d.value}
              onClick={() => set('diet')(d.value)}
              aria-pressed={prefs.diet === d.value}
              className={`rounded-2xl border px-3 py-2.5 text-left font-medium ${prefs.diet === d.value ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Meals a day">
        <Segmented
          value={String(prefs.snacks) as '0' | '1' | '2'}
          onChange={(v) => set('snacks')(Number(v) as PlanPrefs['snacks'])}
          options={[
            { value: '0', label: '3 meals' },
            { value: '1', label: '+ 1 snack' },
            { value: '2', label: '+ 2 snacks' },
          ]}
        />
      </Field>

      <Field label="Cooking">
        <Segmented
          value={prefs.cooking}
          onChange={set('cooking')}
          options={[
            { value: 'quick', label: 'Quick and easy' },
            { value: 'enjoy', label: 'I like to cook' },
          ]}
        />
      </Field>

      <Field label="Foods you like (optional)">
        <textarea
          className="field min-h-20"
          value={prefs.likes}
          onChange={(e) => set('likes')(e.target.value)}
          placeholder="Georgian food, chicken, buckwheat, yogurt, lots of vegetables"
        />
      </Field>

      <Field label="Never include (optional)" hint="Foods you dislike or are allergic to">
        <input className="field" value={prefs.avoid} onChange={(e) => set('avoid')(e.target.value)} placeholder="mushrooms, peanuts" />
      </Field>

      <Field label="How many days?">
        <Segmented
          value={String(prefs.days) as '1' | '3' | '7'}
          onChange={(v) => set('days')(Number(v) as PlanPrefs['days'])}
          options={[
            { value: '1', label: '1 day' },
            { value: '3', label: '3 days' },
            { value: '7', label: 'A week' },
          ]}
        />
      </Field>

      {loading ? (
        <Spinner label={prefs.days === 7 ? 'Writing your week… this takes up to a minute' : 'Writing your plan…'} />
      ) : (
        <div className="flex gap-2">
          {onCancel && (
            <button className="btn btn-quiet" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button className="btn btn-primary flex-1 text-lg" onClick={make}>
            <Icon name="sparkle" className="h-5 w-5" /> Make my plan
          </button>
        </div>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  )
}

function PlanDays({ plan, onNewPlan }: { plan: MealPlan; onNewPlan: () => void }) {
  const logPlanMeal = useStore((s) => s.logPlanMeal)
  const replacePlanMeal = useStore((s) => s.replacePlanMeal)
  const { cfg, prefs, targets, base } = usePlanRequest()
  const today = dateKey()
  const [date, setDate] = useState(plan.days.find((d) => d.date === today)?.date ?? plan.days[0].date)
  const [swapping, setSwapping] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [shopping, setShopping] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const day = plan.days.find((d) => d.date === date) ?? plan.days[0]
  const totals = dayTotals(day)
  const finished = plan.days.at(-1)!.date < today

  async function swap(meal: PlanMeal) {
    setSwapping(meal.id)
    setError('')
    try {
      const raw = await swapPlanMeal(cfg, {
        ...base,
        meal: meal.meal,
        // Aim for this meal's share of the daily target, not the old meal's (possibly off) calories.
        kcal: mealSlots(prefs.snacks, plan.targetKcal).find((s) => s.meal === meal.meal)?.kcal ?? Math.round(mealTotals(meal).kcal / 10) * 10,
        avoidMeals: day.meals.map((m) => m.name),
      })
      replacePlanMeal(day.date, meal.id, cleanPlanMeal({ ...raw, meal: undefined }, meal.meal))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not swap that meal. Try again.')
    } finally {
      setSwapping('')
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl font-semibold">Your meal plan</h2>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-quiet py-2.5" onClick={() => setShopping(true)}>
          Shopping list
        </button>
        <button className="btn btn-quiet py-2.5" onClick={onNewPlan}>
          New plan
        </button>
      </div>

      {finished && <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm">This plan has ended. Tap New plan for the next days.</p>}
      {Math.abs(plan.targetKcal - targets.kcal) >= 100 && !finished && (
        <p className="text-sm text-muted">
          Your target is now {kcal(targets.kcal)} kcal; this plan was made for {kcal(plan.targetKcal)}. Make a new plan to match.
        </p>
      )}

      {plan.days.length > 1 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Plan days">
          {plan.days.map((d) => {
            const done = d.meals.every((m) => m.logged)
            const label = d.date === today ? 'Today' : parseKey(d.date).toLocaleDateString(undefined, { weekday: 'short' })
            return (
              <button
                key={d.date}
                role="tab"
                aria-selected={d.date === day.date}
                onClick={() => setDate(d.date)}
                className={`flex shrink-0 flex-col items-center rounded-2xl border px-3.5 py-2 ${
                  d.date === day.date ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'
                } ${d.date < today ? 'opacity-60' : ''}`}
              >
                <span className="text-xs font-medium">{label}</span>
                <span className="num text-lg font-semibold leading-tight">{parseKey(d.date).getDate()}</span>
                {done && <Icon name="check" className="h-3.5 w-3.5" />}
              </button>
            )
          })}
        </div>
      )}

      <div className="rounded-[20px] bg-surface px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-muted">{dayLabel(day.date)}</span>
          <span>
            <span className="num text-xl font-semibold">{kcal(totals.kcal)}</span> <span className="text-muted">kcal ·</span>{' '}
            <span className="num font-semibold text-protein">{macro(totals.protein)} g</span> <span className="text-muted">protein</span>
          </span>
        </div>
        {Math.abs(totals.kcal - plan.targetKcal) > plan.targetKcal * 0.1 && (
          <p className="mt-1 text-sm text-muted">
            {totals.kcal < plan.targetKcal
              ? `That’s ${kcal(plan.targetKcal - totals.kcal)} kcal under your target. Add a snack or bigger portions so you don’t get too hungry.`
              : `That’s ${kcal(totals.kcal - plan.targetKcal)} kcal over your target. Swap a meal or make portions smaller.`}
          </p>
        )}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {day.meals.map((m) => (
        <PlanMealCard
          key={m.id}
          meal={m}
          swapping={swapping === m.id}
          busy={!!swapping}
          onLog={() => {
            logPlanMeal(day.date, m.id)
            setToast(`Added to ${MEALS.find((x) => x.id === m.meal)!.label}, ${dayLabel(day.date)}`)
          }}
          onSwap={() => swap(m)}
        />
      ))}

      {plan.tips && (
        <div className="rounded-[20px] bg-accent-soft p-4">
          <h3 className="mb-1 font-display font-semibold">Tips</h3>
          <p className="whitespace-pre-wrap text-sm">{plan.tips}</p>
        </div>
      )}
      <p className="text-center text-xs text-muted">
        Made {shortDate(dateKey(new Date(plan.createdAt)))} by AI. Amounts are estimates; adjust portions if you’re hungry or not losing weight.
      </p>

      {shopping && <ShoppingList plan={plan} onClose={() => setShopping(false)} />}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4" role="status">
          <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-bg shadow-lg">
            <Icon name="check" className="h-4 w-4" /> {toast}
          </div>
        </div>
      )}
    </div>
  )
}

function PlanMealCard({
  meal,
  swapping,
  busy,
  onLog,
  onSwap,
}: {
  meal: PlanMeal
  swapping: boolean
  busy: boolean
  onLog: () => void
  onSwap: () => void
}) {
  const t = mealTotals(meal)
  return (
    <section className="rounded-[20px] bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-muted">{MEALS.find((x) => x.id === meal.meal)!.label}</span>
        <span className="num text-sm text-muted">
          <span className="font-semibold text-ink">{kcal(t.kcal)}</span> kcal
        </span>
      </div>
      {swapping ? (
        <Spinner label="Finding something else…" />
      ) : (
        <>
          <h3 className="mt-0.5 font-display text-xl font-semibold leading-snug">{meal.name}</h3>
          {meal.description && <p className="mt-1 text-sm text-muted">{meal.description}</p>}
          <ul className="mt-3 space-y-1 text-sm">
            {meal.items.map((i, idx) => (
              <li key={idx} className="flex justify-between gap-3">
                <span className="min-w-0">
                  {i.name} <span className="text-muted">· {i.portion ? `${i.portion}, ` : ''}{Math.round(i.grams)} g</span>
                </span>
                <span className="num shrink-0 text-muted">{kcal(i.kcal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <button className="btn btn-primary flex-1 py-2.5" disabled={meal.logged} onClick={onLog}>
              {meal.logged ? (
                <>
                  <Icon name="check" className="h-4 w-4" /> Logged
                </>
              ) : (
                'I ate this'
              )}
            </button>
            <button className="btn btn-quiet py-2.5" disabled={busy || meal.logged} onClick={onSwap}>
              Swap
            </button>
          </div>
        </>
      )}
    </section>
  )
}

function ShoppingList({ plan, onClose }: { plan: MealPlan; onClose: () => void }) {
  const toggle = useStore((s) => s.toggleShoppingItem)
  const items = shoppingList(plan, dateKey())
  const amount = (g: number) => (g >= 1000 ? `${(Math.round(g / 100) / 10).toString()} kg` : `${Math.round(g / 10) * 10 || Math.round(g)} g`)

  return (
    <Sheet title="Shopping list" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">Everything for the rest of this plan, as cooked or eaten weights, so buy a little extra for meat and rice.</p>
      {items.length === 0 ? (
        <p className="text-muted">Nothing left to buy for this plan.</p>
      ) : (
        <ul className="divide-y divide-line rounded-[18px] bg-surface px-4">
          {items.map((i) => {
            const done = plan.shoppingChecked.includes(i.key)
            return (
              <li key={i.key}>
                <label className="flex items-center gap-3 py-3">
                  <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={done} onChange={() => toggle(i.key)} />
                  <span className={`flex-1 ${done ? 'text-muted line-through' : ''}`}>{i.name}</span>
                  <span className="num text-sm text-muted">{amount(i.grams)}</span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
