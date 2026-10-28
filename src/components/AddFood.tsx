import { useEffect, useState } from 'react'
import { kcal, num } from '../lib/format'
import { recipeToFood, useStore } from '../lib/store'
import { MEALS, type Food, type Meal } from '../lib/types'
import { uid } from '../lib/date'
import { Field, Icon, Segmented, Sheet } from './ui'
import FoodSearch, { FoodList } from './FoodSearch'
import FoodDetail from './FoodDetail'
import Scanner from './Scanner'
import AiLog from './AiLog'
import FoodEditor from './FoodEditor'
import RecipeEditor from './RecipeEditor'

type Mode = 'search' | 'barcode' | 'photo' | 'describe' | 'quick' | 'mine'

const MODES: { id: Mode; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'photo', label: 'Photo', icon: 'camera' },
  { id: 'barcode', label: 'Barcode', icon: 'barcode' },
  { id: 'describe', label: 'Describe', icon: 'sparkle' },
  { id: 'quick', label: 'Quick add', icon: 'bolt' },
  { id: 'mine', label: 'My foods', icon: 'book' },
]

export default function AddFood({ date, meal: initialMeal, onClose }: { date: string; meal: Meal; onClose: () => void }) {
  const [meal, setMeal] = useState(initialMeal)
  const [mode, setMode] = useState<Mode>('search')
  const [picked, setPicked] = useState<Food | null>(null)
  const [seed, setSeed] = useState('')
  const [toast, setToast] = useState('')
  const mealLabel = MEALS.find((m) => m.id === meal)!.label

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const added = (what: string) => setToast(`Added ${what} to ${mealLabel}`)

  return (
    <Sheet title="Add food" onClose={onClose} closeLabel="Done">
      <div className="space-y-4">
        <Segmented value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m.id, label: m.label }))} />

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="How to add">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-2xl border px-3.5 py-2.5 text-xs font-medium ${
                mode === m.id ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'
              }`}
            >
              <Icon name={m.icon} className="h-5 w-5" />
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'search' && (
          <FoodSearch
            onPick={setPicked}
            onAskAi={(q) => {
              setSeed(q)
              setMode('describe')
            }}
          />
        )}
        {mode === 'barcode' && <Scanner onFound={setPicked} />}
        {(mode === 'photo' || mode === 'describe') && (
          <AiLog key={mode + seed} kind={mode} seed={seed} date={date} meal={meal} mealLabel={mealLabel} onAdded={added} />
        )}
        {mode === 'quick' && <QuickAdd date={date} meal={meal} mealLabel={mealLabel} onAdded={added} />}
        {mode === 'mine' && <MyFoods onPick={setPicked} />}
      </div>

      {picked && <FoodDetail food={picked} date={date} initialMeal={meal} onClose={() => setPicked(null)} onDone={() => added(picked.name)} />}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-4" role="status">
          <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-bg shadow-lg">
            <Icon name="check" className="h-4 w-4" /> {toast}
          </div>
        </div>
      )}
    </Sheet>
  )
}

function QuickAdd({ date, meal, mealLabel, onAdded }: { date: string; meal: Meal; mealLabel: string; onAdded: (what: string) => void }) {
  const addEntry = useStore((s) => s.addEntry)
  const [name, setName] = useState('')
  const [cal, setCal] = useState('')
  const [p, setP] = useState('')
  const [c, setC] = useState('')
  const [f, setF] = useState('')

  function add() {
    const nutrients = { kcal: num(cal), protein: num(p), carbs: num(c), fat: num(f) }
    const label = name.trim() || 'Quick add'
    const food: Food = { id: `q-${uid()}`, name: label, per100: nutrients, servings: [{ label: 'serving', grams: 100 }], source: 'quick' }
    addEntry({ date, meal, name: label, grams: 100, amountLabel: '1 serving', nutrients, food })
    onAdded(`${kcal(nutrients.kcal)} kcal`)
    setName('')
    setCal('')
    setP('')
    setC('')
    setF('')
  }

  return (
    <div className="space-y-4">
      <p className="text-muted">Know the calories already? Type them in.</p>
      <Field label="Name (optional)">
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lunch at work" />
      </Field>
      <Field label="Calories">
        <input className="field num text-2xl" inputMode="decimal" value={cal} onChange={(e) => setCal(e.target.value)} placeholder="0" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Protein, g">
          <input className="field num" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} />
        </Field>
        <Field label="Carbs, g">
          <input className="field num" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} />
        </Field>
        <Field label="Fat, g">
          <input className="field num" inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} />
        </Field>
      </div>
      <button className="btn btn-primary w-full text-lg" disabled={num(cal) <= 0} onClick={add}>
        Add to {mealLabel}
      </button>
    </div>
  )
}

function MyFoods({ onPick }: { onPick: (f: Food) => void }) {
  const customFoods = useStore((s) => s.customFoods)
  const recipes = useStore((s) => s.recipes)
  const [editor, setEditor] = useState<'food' | 'recipe' | null>(null)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-quiet" onClick={() => setEditor('food')}>
          <Icon name="plus" className="h-4 w-4" /> New food
        </button>
        <button className="btn btn-quiet" onClick={() => setEditor('recipe')}>
          <Icon name="plus" className="h-4 w-4" /> New recipe
        </button>
      </div>
      {recipes.length > 0 && <FoodList title="Recipes" foods={recipes.map(recipeToFood)} onPick={onPick} />}
      {customFoods.length > 0 && <FoodList title="Foods" foods={customFoods} onPick={onPick} />}
      {!recipes.length && !customFoods.length && (
        <p className="text-muted">
          Save foods you eat often, or build a recipe from its ingredients (like your own lobio) and Plate works out the calories per portion.
        </p>
      )}
      {editor === 'food' && <FoodEditor onClose={() => setEditor(null)} />}
      {editor === 'recipe' && <RecipeEditor onClose={() => setEditor(null)} />}
    </div>
  )
}
