import { useState } from 'react'
import { ACTIVITY, MACRO_PRESETS, calorieFloor } from '../lib/calc'
import { dateKey } from '../lib/date'
import { kcal, num } from '../lib/format'
import { exportData, recipeToFood, useStore, useTargets, type AppData } from '../lib/store'
import type { Food, MacroPreset, Recipe } from '../lib/types'
import { Card, ErrorNote, Field, Icon, Segmented } from './ui'
import Onboarding from './Onboarding'
import AiKeySetup from './AiKeySetup'
import FoodEditor from './FoodEditor'
import RecipeEditor from './RecipeEditor'
import { FoodList } from './FoodSearch'

export default function Me() {
  const profile = useStore((s) => s.profile)!
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const customFoods = useStore((s) => s.customFoods)
  const recipes = useStore((s) => s.recipes)
  const importData = useStore((s) => s.importData)
  const resetAll = useStore((s) => s.resetAll)
  const targets = useTargets()!
  const [editingPlan, setEditingPlan] = useState(false)
  const [override, setOverride] = useState(settings.calorieOverride ? String(settings.calorieOverride) : '')
  const [editFood, setEditFood] = useState<Food | null>(null)
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (editingPlan) {
    return (
      <div className="fixed inset-0 z-40 overflow-y-auto bg-bg">
        <button onClick={() => setEditingPlan(false)} className="safe-top absolute right-4 z-10 font-medium text-accent">
          Cancel
        </button>
        <Onboarding editing onDone={() => setEditingPlan(false)} />
      </div>
    )
  }

  function backup() {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const file = new File([blob], `plate-backup-${dateKey()}.json`, { type: 'application/json' })
    // On iPhone the share sheet lets you save the file to Files or iCloud Drive.
    if (navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file], title: 'Plate backup' }).catch(() => {})
      return
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  async function restore(file: File) {
    setError('')
    try {
      const data = JSON.parse(await file.text()) as Partial<AppData> & { app?: string }
      if (data.app !== 'plate' || !Array.isArray(data.entries)) throw new Error()
      if (!confirm('Replace everything in Plate with this backup?')) return
      importData(data)
      setMessage('Backup restored.')
    } catch {
      setError('That file isn’t a Plate backup.')
    }
  }

  const overrideN = num(override)

  return (
    <div className="space-y-3 pt-2">
      <h1 className="py-2 font-display text-3xl font-bold tracking-tight">Me</h1>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Plan</h2>
            <p className="text-sm text-muted">
              {profile.sex === 'female' ? 'Female' : 'Male'}, {profile.age} · {profile.heightCm} cm · goal {profile.goalWeightKg} kg
              <br />
              {ACTIVITY[profile.activity].label} · {profile.ratePerWeekKg ? `lose ${profile.ratePerWeekKg} kg a week` : 'keep weight steady'}
            </p>
          </div>
          <button className="btn btn-quiet shrink-0 px-3 py-2 text-sm" onClick={() => setEditingPlan(true)}>
            Edit
          </button>
        </div>
        <div className="mt-4 flex items-baseline justify-between rounded-xl bg-surface-2 p-3">
          <span className="text-muted">Daily target</span>
          <span className="num text-2xl font-bold">{kcal(targets.kcal)} kcal</span>
        </div>
        {settings.calorieOverride == null && (
          <p className="mt-2 text-xs text-muted">
            Your body burns about {kcal(targets.plan.maintenance)} kcal a day. The target updates as you log new weights.
          </p>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Targets</h2>
        <Field
          label="Set your own calorie target"
          hint={overrideN > 0 && overrideN < calorieFloor(profile.sex) ? 'That’s below the usual safe minimum. Talk to a doctor first.' : 'Leave empty to use the calculated target.'}
        >
          <div className="flex gap-2">
            <input className="field num" inputMode="numeric" value={override} onChange={(e) => setOverride(e.target.value)} placeholder={String(targets.plan.target)} />
            <button
              className="btn btn-quiet shrink-0"
              onClick={() => updateSettings({ calorieOverride: overrideN >= 800 ? Math.round(overrideN) : null })}
            >
              Save
            </button>
          </div>
        </Field>
        <Field label="Nutrient split">
          <Segmented
            value={settings.macroPreset}
            onChange={(v: MacroPreset) => updateSettings({ macroPreset: v })}
            options={(Object.keys(MACRO_PRESETS) as MacroPreset[]).map((k) => ({ value: k, label: MACRO_PRESETS[k].label }))}
          />
          <span className="mt-1 block text-xs text-muted">
            {targets.protein} g protein · {targets.carbs} g carbs · {targets.fat} g fat a day
          </span>
        </Field>
        <Field label="Water goal, litres">
          <input
            className="field num"
            inputMode="decimal"
            defaultValue={settings.waterGoalMl / 1000}
            onBlur={(e) => num(e.target.value) > 0 && updateSettings({ waterGoalMl: Math.round(num(e.target.value) * 1000) })}
          />
        </Field>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-medium">Eat back exercise calories</span>
            <span className="block text-sm text-muted">Adds calories burned to today’s budget</span>
          </span>
          <input
            type="checkbox"
            className="h-6 w-6 accent-[var(--accent)]"
            checked={settings.addExerciseCalories}
            onChange={(e) => updateSettings({ addExerciseCalories: e.target.checked })}
          />
        </label>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-semibold">AI assistant</h2>
        <AiKeySetup />
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Advanced</summary>
          <Field label="Gemini model" hint="Plate switches to gemini-3.5-flash-lite automatically when this one is busy.">
            <input
              className="field mt-1 font-mono"
              defaultValue={settings.geminiModel}
              onBlur={(e) => updateSettings({ geminiModel: e.target.value.trim() || 'gemini-3.8-flash' })}
              autoCapitalize="off"
              spellCheck={false}
            />
          </Field>
        </details>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Online food search</h2>
        <p className="text-sm text-muted">
          Online search uses the free USDA database with a shared key that allows a few searches an hour. For more, get your own free key at{' '}
          <a className="text-accent underline" href="https://fdc.nal.usda.gov/api-key-signup" target="_blank" rel="noreferrer">
            fdc.nal.usda.gov
          </a>
          .
        </p>
        <input
          className="field font-mono"
          placeholder="USDA API key (optional)"
          defaultValue={settings.usdaKey}
          onBlur={(e) => updateSettings({ usdaKey: e.target.value.trim() })}
          autoCapitalize="off"
          spellCheck={false}
        />
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-semibold">My foods and recipes</h2>
        {recipes.length > 0 && <FoodList title="Recipes" foods={recipes.map(recipeToFood)} onPick={(f) => setEditRecipe(recipes.find((r) => r.id === f.id) ?? null)} />}
        {customFoods.length > 0 && <FoodList title="Foods" foods={customFoods} onPick={setEditFood} />}
        {!recipes.length && !customFoods.length && <p className="text-sm text-muted">Foods and recipes you create show up here.</p>}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Backup</h2>
        <p className="text-sm text-muted">Everything is stored only on this phone. Save a backup now and then, so you can move to a new phone or recover after deleting the app.</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-quiet" onClick={backup}>
            Save backup
          </button>
          <label className="btn btn-quiet cursor-pointer">
            Restore
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
          </label>
        </div>
        {message && <p className="text-sm font-medium text-accent">{message}</p>}
        {error && <ErrorNote>{error}</ErrorNote>}
        <button
          className="flex items-center gap-1.5 pt-2 text-sm text-over"
          onClick={() => confirm('Delete all your data from this phone? This can’t be undone.') && resetAll()}
        >
          <Icon name="trash" className="h-4 w-4" /> Delete all data
        </button>
      </Card>

      <p className="px-2 pb-4 text-center text-xs text-muted">
        Plate · food data from standard nutrition tables, Open Food Facts and USDA. Calorie numbers are estimates, not medical advice.
      </p>

      {editFood && <FoodEditor food={editFood} onClose={() => setEditFood(null)} />}
      {editRecipe && <RecipeEditor recipe={editRecipe} onClose={() => setEditRecipe(null)} />}
    </div>
  )
}
