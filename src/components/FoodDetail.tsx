import { useState } from 'react'
import { scaleNutrients } from '../lib/calc'
import { grams as fmtGrams, kcal, macro, num } from '../lib/format'
import { useStore } from '../lib/store'
import { MEALS, type DiaryEntry, type Food, type Meal } from '../lib/types'
import { Icon, Segmented, Sheet } from './ui'

const SOURCE_NOTE: Record<Food['source'], string> = {
  builtin: 'From Plate’s food list',
  custom: 'Your own food',
  recipe: 'Your recipe',
  barcode: 'From Open Food Facts',
  usda: 'From USDA FoodData Central',
  ai: 'AI estimate, adjust if it looks off',
  quick: 'Quick entry',
}

const GRAMS = -1

function initialAmount(food: Food, initialGrams?: number): { unit: number; qty: string } {
  if (initialGrams == null) {
    // Never start at a whole package; fall back to 100 g when there's no normal serving.
    const first = food.servings.findIndex((s) => !s.label.startsWith('whole'))
    return first >= 0 ? { unit: first, qty: '1' } : { unit: GRAMS, qty: '100' }
  }
  const i = food.servings.findIndex((s) => {
    const ratio = initialGrams / s.grams
    return ratio > 0 && Math.abs(ratio * 4 - Math.round(ratio * 4)) < 0.01
  })
  if (i >= 0) return { unit: i, qty: String(Math.round((initialGrams / food.servings[i].grams) * 100) / 100) }
  return { unit: GRAMS, qty: String(Math.round(initialGrams)) }
}

export function amountLabel(food: Food, unit: number, qty: number, totalGrams: number) {
  if (unit === GRAMS) return fmtGrams(totalGrams)
  const s = food.servings[unit]
  return `${qty === 1 ? '' : `${qty} × `}${s.label} (${fmtGrams(totalGrams)})`
}

export default function FoodDetail({
  food,
  date,
  initialMeal = 'snack',
  initialGrams,
  entry,
  onClose,
  onDone,
  onPick,
}: {
  food: Food
  date?: string
  initialMeal?: Meal
  initialGrams?: number
  entry?: DiaryEntry
  onClose: () => void
  onDone?: () => void
  /** When set, the sheet returns the chosen amount instead of logging it (used by recipes). */
  onPick?: (food: Food, grams: number, label: string) => void
}) {
  const addEntry = useStore((s) => s.addEntry)
  const updateEntry = useStore((s) => s.updateEntry)
  const removeEntry = useStore((s) => s.removeEntry)
  const favorites = useStore((s) => s.favorites)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const init = initialAmount(food, initialGrams)
  const [unit, setUnit] = useState(init.unit)
  const [qty, setQty] = useState(init.qty)
  const [meal, setMeal] = useState<Meal>(initialMeal)

  const q = num(qty)
  const totalGrams = unit === GRAMS ? q : q * (food.servings[unit]?.grams ?? 0)
  const n = scaleNutrients(food.per100, totalGrams)
  const isFav = favorites.some((f) => f.id === food.id)
  // Quick-add entries have no real weight; their single "serving" holds the typed numbers.
  const isQuick = food.source === 'quick'
  const label = isQuick ? (q === 1 ? '1 serving' : `${q} servings`) : amountLabel(food, unit, q, totalGrams)

  function step(delta: number) {
    const stepSize = unit === GRAMS ? 10 : 0.5
    setQty(String(Math.max(0, Math.round((q + delta * stepSize) * 100) / 100)))
  }

  function changeUnit(next: number) {
    if (next === unit) return
    // Switching to grams keeps the same amount; tapping a serving means one of it.
    setQty(next === GRAMS ? String(Math.round(totalGrams) || 100) : '1')
    setUnit(next)
  }

  function submit() {
    if (onPick) {
      onPick(food, totalGrams, label)
      return
    }
    const data = { meal, name: food.name, brand: food.brand, grams: totalGrams, amountLabel: label, nutrients: n, food }
    if (entry) updateEntry(entry.id, data)
    else addEntry({ ...data, date: date! })
    onDone?.()
    onClose()
  }

  return (
    <Sheet
      title={entry ? 'Edit entry' : food.name}
      onClose={onClose}
      action={
        food.source !== 'quick' && (
          <button onClick={() => toggleFavorite(food)} aria-pressed={isFav} aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'} className={`p-1 ${isFav ? 'text-carbs' : 'text-muted'}`}>
            <Icon name="star" className={`h-6 w-6 ${isFav ? 'fill-current' : ''}`} />
          </button>
        )
      }
      footer={
        <div className="flex gap-2">
          {entry && (
            <button
              className="btn btn-quiet text-over"
              onClick={() => {
                removeEntry(entry.id)
                onClose()
              }}
            >
              Delete
            </button>
          )}
          <button className="btn btn-primary flex-1 text-lg" disabled={totalGrams <= 0} onClick={submit}>
            {onPick ? 'Add to recipe' : entry ? 'Save changes' : `Add to ${MEALS.find((m) => m.id === meal)!.label}`}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          {entry && <h3 className="font-display text-2xl font-semibold">{food.name}</h3>}
          <p className="text-sm text-muted">
            {food.brand ? `${food.brand} · ` : ''}
            {SOURCE_NOTE[food.source]}
          </p>
        </div>

        <div className="rounded-[20px] bg-surface p-5">
          <div className="flex items-baseline gap-2">
            <span className="num text-6xl font-bold tracking-tight">{kcal(n.kcal)}</span>
            <span className="text-muted">kcal</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Macro label="Protein" value={n.protein} color="text-protein" />
            <Macro label="Carbs" value={n.carbs} color="text-carbs" />
            <Macro label="Fat" value={n.fat} color="text-fat" />
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-muted">Amount</div>
          <div className="flex items-center gap-2">
            <button className="btn btn-quiet h-12 w-12 p-0 text-xl" onClick={() => step(-1)} aria-label="Less">
              −
            </button>
            <input
              className="field num h-12 flex-1 text-center text-2xl font-semibold"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onFocus={(e) => e.target.select()}
              aria-label="Quantity"
            />
            <button className="btn btn-quiet h-12 w-12 p-0 text-xl" onClick={() => step(1)} aria-label="More">
              +
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {!isQuick &&
              food.servings.map((s, i) => (
                <Chip key={s.label + i} active={unit === i} onClick={() => changeUnit(i)}>
                  {s.label} <span className="opacity-60">· {fmtGrams(s.grams)}</span>
                </Chip>
              ))}
            {!isQuick && (
              <Chip active={unit === GRAMS} onClick={() => changeUnit(GRAMS)}>
                grams
              </Chip>
            )}
          </div>
          {!isQuick && <p className="mt-2 text-sm text-muted">Total: {fmtGrams(totalGrams)}</p>}
        </div>

        {!onPick && (
          <div>
            <div className="mb-2 text-sm font-medium text-muted">Meal</div>
            <Segmented value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m.id, label: m.label }))} />
          </div>
        )}

        {!isQuick && <p className="text-sm text-muted">
          Per 100 g: {kcal(food.per100.kcal)} kcal · {macro(food.per100.protein)} g protein · {macro(food.per100.carbs)} g carbs · {macro(food.per100.fat)} g fat
          {food.per100.fiber ? ` · ${macro(food.per100.fiber)} g fiber` : ''}
        </p>}
      </div>
    </Sheet>
  )
}

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-surface-2 py-2">
      <div className={`num text-xl font-semibold ${color}`}>{macro(value)}g</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-sm ${active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'}`}
    >
      {children}
    </button>
  )
}
