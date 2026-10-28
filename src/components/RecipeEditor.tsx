import { useState } from 'react'
import { scaleNutrients, sumNutrients } from '../lib/calc'
import { uid } from '../lib/date'
import { kcal, macro, num } from '../lib/format'
import { useStore } from '../lib/store'
import type { Food, Recipe, RecipeIngredient } from '../lib/types'
import { Field, Icon, Sheet } from './ui'
import FoodSearch from './FoodSearch'
import FoodDetail from './FoodDetail'

export default function RecipeEditor({ recipe, onClose }: { recipe?: Recipe; onClose: () => void }) {
  const saveRecipe = useStore((s) => s.saveRecipe)
  const removeRecipe = useStore((s) => s.removeRecipe)
  const [name, setName] = useState(recipe?.name ?? '')
  const [portions, setPortions] = useState(String(recipe?.portions ?? 4))
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(recipe?.ingredients ?? [])
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<Food | null>(null)

  const totals = sumNutrients(ingredients.map((i) => scaleNutrients(i.food.per100, i.grams)))
  const p = Math.max(1, num(portions))
  const totalGrams = ingredients.reduce((n, i) => n + i.grams, 0)

  function save() {
    saveRecipe({ id: recipe?.id ?? `r-${uid()}`, name: name.trim(), portions: p, ingredients })
    onClose()
  }

  return (
    <Sheet
      title={recipe ? 'Edit recipe' : 'New recipe'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {recipe && (
            <button
              className="btn btn-quiet text-over"
              onClick={() => {
                removeRecipe(recipe.id)
                onClose()
              }}
            >
              Delete
            </button>
          )}
          <button className="btn btn-primary flex-1 text-lg" disabled={!name.trim() || !ingredients.length} onClick={save}>
            Save recipe
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Recipe name">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Homemade lobio" />
        </Field>
        <Field label="It makes how many portions?">
          <input className="field num" inputMode="numeric" value={portions} onChange={(e) => setPortions(e.target.value)} />
        </Field>

        <div>
          <h3 className="mb-1 text-sm font-medium text-muted">Ingredients</h3>
          {ingredients.length > 0 && (
            <ul className="divide-y divide-line rounded-[18px] bg-surface px-4">
              {ingredients.map((i, idx) => (
                <li key={idx} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{i.food.name}</div>
                    <div className="truncate text-sm text-muted">{i.amountLabel}</div>
                  </div>
                  <span className="num font-semibold">{kcal(scaleNutrients(i.food.per100, i.grams).kcal)}</span>
                  <button className="p-1 text-muted" onClick={() => setIngredients(ingredients.filter((_, j) => j !== idx))} aria-label={`Remove ${i.food.name}`}>
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button className="btn btn-quiet mt-2 w-full" onClick={() => setPicking(true)}>
            <Icon name="plus" className="h-4 w-4" /> Add ingredient
          </button>
        </div>

        {ingredients.length > 0 && (
          <div className="rounded-[20px] bg-accent-soft p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">One portion</span>
              <span className="num text-2xl font-bold">{kcal(totals.kcal / p)} kcal</span>
            </div>
            <p className="mt-1 text-sm text-muted">
              About {Math.round(totalGrams / p)} g · {macro(totals.protein / p)} g protein · {macro(totals.carbs / p)} g carbs · {macro(totals.fat / p)} g fat
            </p>
            <p className="mt-1 text-sm text-muted">Whole recipe: {kcal(totals.kcal)} kcal</p>
          </div>
        )}
      </div>

      {picking && (
        <Sheet title="Add ingredient" onClose={() => setPicking(false)}>
          <FoodSearch onPick={setPicked} showHistory={false} />
        </Sheet>
      )}
      {picked && (
        <FoodDetail
          food={picked}
          onClose={() => setPicked(null)}
          onPick={(food, grams, amountLabel) => {
            setIngredients([...ingredients, { food, grams, amountLabel }])
            setPicked(null)
            setPicking(false)
          }}
        />
      )}
    </Sheet>
  )
}
