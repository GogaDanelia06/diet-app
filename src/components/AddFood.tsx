import { useEffect, useState } from 'react'
import { kcal, num } from '../lib/format'
import { recipeToFood, useStore } from '../lib/store'
import { MEALS, type Food, type Meal } from '../lib/types'
import { uid } from '../lib/date'
import { t, tName } from '../lib/i18n'
import { Field, Icon, Segmented, Sheet, Toast } from './ui'
import { PlateView } from './ThreeViews'
import FoodSearch, { FoodList } from './FoodSearch'
import FoodDetail from './FoodDetail'
import Scanner from './Scanner'
import AiLog from './AiLog'
import FoodEditor from './FoodEditor'
import RecipeEditor from './RecipeEditor'

export type AddFoodMode = 'search' | 'barcode' | 'photo' | 'describe' | 'quick' | 'mine'
type Mode = AddFoodMode

const MODES: { id: Mode; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'photo', label: 'Photo', icon: 'camera' },
  { id: 'barcode', label: 'Barcode', icon: 'barcode' },
  { id: 'describe', label: 'Describe', icon: 'sparkle' },
  { id: 'quick', label: 'Quick add', icon: 'bolt' },
  { id: 'mine', label: 'My foods', icon: 'book' },
]

export default function AddFood({ date, meal: initialMeal, initialMode = 'search', initialPhoto, onClose }: {
  date: string
  meal: Meal
  initialMode?: AddFoodMode
  /** A photo taken before the sheet opened; analysed once, then forgotten. */
  initialPhoto?: File
  onClose: () => void
}) {
  const [meal, setMeal] = useState(initialMeal)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [photo, setPhoto] = useState(initialPhoto)
  const [picked, setPicked] = useState<Food | null>(null)
  const [seed, setSeed] = useState('')
  const [toast, setToast] = useState('')
  const [toastId, setToastId] = useState(0)
  const mealLabel = t(MEALS.find((m) => m.id === meal)!.label)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(timer)
  }, [toast, toastId])

  const added = (what: string) => {
    setToast(t('Added {what} to {meal}', { what: tName(what), meal: mealLabel }))
    setToastId((n) => n + 1)
  }

  return (
    <Sheet title={t('Add food')} onClose={onClose} closeLabel={t('Done')}>
      <div className="space-y-4">
        <Segmented value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m.id, label: t(m.label) }))} />

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label={t('How to add')}>
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => { setMode(m.id); setPhoto(undefined) }}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-2xl border px-3.5 py-2.5 text-xs font-medium ${
                mode === m.id ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'
              }`}
            >
              <Icon name={m.icon} className="h-5 w-5" />
              {t(m.label)}
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
          <AiLog key={mode + seed} kind={mode} seed={seed} photo={mode === 'photo' ? photo : undefined} date={date} meal={meal} mealLabel={mealLabel} onAdded={added} />
        )}
        {mode === 'quick' && <QuickAdd date={date} meal={meal} mealLabel={mealLabel} onAdded={added} />}
        {mode === 'mine' && <MyFoods onPick={setPicked} date={date} meal={meal} onAdded={added} />}
      </div>

      {picked && <FoodDetail food={picked} date={date} initialMeal={meal} onClose={() => setPicked(null)} onDone={() => added(picked.name)} />}

      {toast && (
        <Toast
          key={toast + toastId}
          art={
            <span className="block h-12 w-12 scale-125">
              <PlateView mini />
            </span>
          }
        >
          {toast}
        </Toast>
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
    const label = name.trim() || t('Quick add')
    const food: Food = { id: `q-${uid()}`, name: label, per100: nutrients, servings: [{ label: 'serving', grams: 100 }], source: 'quick' }
    addEntry({ date, meal, name: label, grams: 100, amountLabel: t('1 serving'), nutrients, food })
    onAdded(`${kcal(nutrients.kcal)} kcal`)
    setName('')
    setCal('')
    setP('')
    setC('')
    setF('')
  }

  return (
    <div className="space-y-4">
      <p className="text-muted">{t('Know the calories already? Type them in.')}</p>
      <Field label={t('Name (optional)')}>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Lunch at work')} />
      </Field>
      <Field label={t('Calories')}>
        <input className="field num text-2xl" inputMode="decimal" value={cal} onChange={(e) => setCal(e.target.value)} placeholder="0" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label={t('Protein, g')}>
          <input className="field num" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} />
        </Field>
        <Field label={t('Carbs, g')}>
          <input className="field num" inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} />
        </Field>
        <Field label={t('Fat, g')}>
          <input className="field num" inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} />
        </Field>
      </div>
      <button className="btn btn-primary w-full text-lg" disabled={num(cal) <= 0} onClick={add}>
        {t('Add to {meal}', { meal: mealLabel })}
      </button>
    </div>
  )
}

function MyFoods({ onPick, date, meal, onAdded }: { onPick: (f: Food) => void; date: string; meal: Meal; onAdded: (what: string) => void }) {
  const customFoods = useStore((s) => s.customFoods)
  const recipes = useStore((s) => s.recipes)
  const savedMeals = useStore((s) => s.savedMeals)
  const logSavedMeal = useStore((s) => s.logSavedMeal)
  const [editor, setEditor] = useState<'food' | 'recipe' | null>(null)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-quiet" onClick={() => setEditor('food')}>
          <Icon name="plus" className="h-4 w-4" /> {t('New food')}
        </button>
        <button className="btn btn-quiet" onClick={() => setEditor('recipe')}>
          <Icon name="plus" className="h-4 w-4" /> {t('New recipe')}
        </button>
      </div>
      {savedMeals.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium text-muted">{t('Saved meals')}</h3>
          <ul className="divide-y divide-line rounded-[18px] bg-surface px-4">
            {savedMeals.map((m) => (
              <li key={m.id}>
                <button
                  className="flex w-full items-center gap-3 py-3 text-left"
                  onClick={() => {
                    logSavedMeal(m.id, date, meal)
                    onAdded(m.name)
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{m.name}</div>
                    <div className="truncate text-sm text-muted">{m.items.map((i) => i.name).join(', ')}</div>
                  </div>
                  <span className="num shrink-0 text-sm">
                    <span className="font-semibold">{kcal(m.items.reduce((n, i) => n + i.nutrients.kcal, 0))}</span> <span className="text-muted">{t('kcal')}</span>
                  </span>
                  <Icon name="plus" className="h-5 w-5 shrink-0 text-accent" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {recipes.length > 0 && <FoodList title={t('Recipes')} foods={recipes.map(recipeToFood)} onPick={onPick} />}
      {customFoods.length > 0 && <FoodList title={t('Foods')} foods={customFoods} onPick={onPick} />}
      {!recipes.length && !customFoods.length && !savedMeals.length && (
        <p className="text-muted">
          {t('Save foods you eat often, or build a recipe from its ingredients (like your own lobio) and Plate works out the calories per portion.')}
        </p>
      )}
      {editor === 'food' && <FoodEditor onClose={() => setEditor(null)} />}
      {editor === 'recipe' && <RecipeEditor onClose={() => setEditor(null)} />}
    </div>
  )
}
