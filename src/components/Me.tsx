import { useState } from 'react'
import { t } from '../lib/i18n'
import { ACTIVITY, MACRO_PRESETS, calorieFloor } from '../lib/calc'
import { dateKey } from '../lib/date'
import { kcal, num } from '../lib/format'
import { exportData, recipeToFood, useStore, useTargets, type AppData } from '../lib/store'
import type { Food, MacroPreset, Recipe } from '../lib/types'
import { checkUsdaKey, hasSharedUsdaKey } from '../lib/online'
import { Card, ErrorNote, Field, Icon, Logo, Segmented, Spinner } from './ui'
import Onboarding, { LanguageSwitch } from './Onboarding'
import AiKeySetup from './AiKeySetup'
import FoodEditor from './FoodEditor'
import RecipeEditor from './RecipeEditor'
import WatchSheet from './Watch'
import { FoodList } from './FoodSearch'

export default function Me() {
  const profile = useStore((s) => s.profile)!
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const customFoods = useStore((s) => s.customFoods)
  const recipes = useStore((s) => s.recipes)
  const savedMeals = useStore((s) => s.savedMeals)
  const removeSavedMeal = useStore((s) => s.removeSavedMeal)
  const importData = useStore((s) => s.importData)
  const resetAll = useStore((s) => s.resetAll)
  const targets = useTargets()!
  const [editingPlan, setEditingPlan] = useState(false)
  const [watchOpen, setWatchOpen] = useState(false)
  const [override, setOverride] = useState(settings.calorieOverride ? String(settings.calorieOverride) : '')
  const [editFood, setEditFood] = useState<Food | null>(null)
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (editingPlan) {
    return (
      <div className="fixed inset-0 z-40 overflow-y-auto bg-bg">
        <button onClick={() => setEditingPlan(false)} className="safe-top absolute right-4 z-10 font-medium text-accent">
          {t('Cancel')}
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
      navigator.share({ files: [file], title: t('Plate backup') }).catch(() => {})
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
      if (!confirm(t('Replace everything in Plate with this backup?'))) return
      importData(data)
      setMessage(t('Backup restored.'))
    } catch {
      setError(t('That file isn’t a Plate backup.'))
    }
  }

  const overrideN = num(override)

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between py-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t('Me')}</h1>
        <LanguageSwitch value={settings.language} onChange={(language) => updateSettings({ language })} />
      </div>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">{t('Plan')}</h2>
            <p className="text-sm text-muted">
              {profile.sex === 'female' ? t('Female') : t('Male')}, {profile.age} · {profile.heightCm} cm · {t('goal {kg} kg', { kg: profile.goalWeightKg })}
              <br />
              {t(ACTIVITY[profile.activity].label)} · {profile.ratePerWeekKg ? t('lose {kg} kg a week', { kg: profile.ratePerWeekKg }) : t('keep weight steady')}
            </p>
          </div>
          <button className="btn btn-quiet shrink-0 px-3 py-2 text-sm" onClick={() => setEditingPlan(true)}>
            {t('Edit')}
          </button>
        </div>
        <div className="mt-4 flex items-baseline justify-between rounded-xl bg-surface-2 p-3">
          <span className="text-muted">{t('Daily target')}</span>
          <span className="num text-2xl font-bold">{kcal(targets.kcal)} {t('kcal')}</span>
        </div>
        {settings.calorieOverride == null && (
          <p className="mt-2 text-xs text-muted">
            {t('Your body burns about {n} kcal a day. The target updates as you log new weights.', { n: kcal(targets.plan.maintenance) })}
          </p>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-display text-lg font-semibold">{t('Targets')}</h2>
        <Field
          label={t('Set your own calorie target')}
          hint={overrideN > 0 && overrideN < calorieFloor(profile.sex) ? t('That’s below the usual safe minimum. Talk to a doctor first.') : t('Leave empty to use the calculated target.')}
        >
          <div className="flex gap-2">
            <input className="field num" inputMode="numeric" value={override} onChange={(e) => setOverride(e.target.value)} placeholder={String(targets.plan.target)} />
            <button
              className="btn btn-quiet shrink-0"
              onClick={() => updateSettings({ calorieOverride: overrideN >= 800 ? Math.round(overrideN) : null })}
            >
              {t('Save')}
            </button>
          </div>
        </Field>
        <Field label={t('Nutrient split')}>
          <Segmented
            value={settings.macroPreset}
            onChange={(v: MacroPreset) => updateSettings({ macroPreset: v })}
            options={(Object.keys(MACRO_PRESETS) as MacroPreset[]).map((k) => ({ value: k, label: t(MACRO_PRESETS[k].label) }))}
          />
          <span className="mt-1 block text-xs text-muted">
            {targets.protein} g protein · {targets.carbs} g carbs · {targets.fat} g fat a day
          </span>
        </Field>
        <Field label={t('Water goal, litres')} hint={t('2 L is a good daily goal for most adults. Drink more on hot days or when you exercise.')}>
          <input
            className="field num"
            inputMode="decimal"
            defaultValue={settings.waterGoalMl / 1000}
            onBlur={(e) => num(e.target.value) > 0 && updateSettings({ waterGoalMl: Math.round(num(e.target.value) * 1000) })}
          />
        </Field>
        <Field label={t('Add exercise calories to my budget')} hint={t('Workout estimates can run high, so half is a safe choice if weight loss stalls.')}>
          <Segmented
            value={String(settings.exerciseEatBack) as '0' | '0.5' | '1'}
            onChange={(v) => updateSettings({ exerciseEatBack: Number(v) as 0 | 0.5 | 1 })}
            options={[
              { value: '0', label: t('None') },
              { value: '0.5', label: t('Half') },
              { value: '1', label: t('All') },
            ]}
          />
        </Field>
        <Field label={t('Daily step goal')}>
          <input
            className="field num"
            inputMode="numeric"
            defaultValue={settings.stepGoal}
            onBlur={(e) => num(e.target.value) > 0 && updateSettings({ stepGoal: Math.round(num(e.target.value)) })}
          />
        </Field>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-medium">{t('Fasting timer')}</span>
            <span className="block text-sm text-muted">{t('Show the intermittent fasting card on Today')}</span>
          </span>
          <input
            type="checkbox"
            className="h-6 w-6 accent-[var(--accent)]"
            checked={settings.showFasting}
            onChange={(e) => updateSettings({ showFasting: e.target.checked })}
          />
        </label>
      </Card>

      <Card className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Icon name="watch" className="h-5 w-5 text-accent" /> {t('Apple Watch & WHOOP')}
        </h2>
        <p className="text-sm text-muted">{t('Bring in the active calories and steps your watch records, through Apple Health and a one-tap Shortcut.')}</p>
        <button className="btn btn-quiet w-full" onClick={() => setWatchOpen(true)}>
          {t('Set up and import')}
        </button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{t('AI assistant')}</h2>
        <AiKeySetup />
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">{t('Advanced')}</summary>
          <Field label={t('Gemini model')} hint={t('Plate switches to gemini-3.5-flash-lite automatically when this one is busy.')}>
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

      <UsdaKeyCard />

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{t('My foods and recipes')}</h2>
        {recipes.length > 0 && <FoodList title={t('Recipes')} foods={recipes.map(recipeToFood)} onPick={(f) => setEditRecipe(recipes.find((r) => r.id === f.id) ?? null)} />}
        {customFoods.length > 0 && <FoodList title={t('Foods')} foods={customFoods} onPick={setEditFood} />}
        {savedMeals.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-medium text-muted">{t('Saved meals')}</h3>
            <ul className="divide-y divide-line rounded-[18px] bg-surface-2 px-4">
              {savedMeals.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{m.name}</div>
                    <div className="text-sm text-muted">
                      {m.items.length} foods · {kcal(m.items.reduce((n, i) => n + i.nutrients.kcal, 0))} kcal
                    </div>
                  </div>
                  <button className="p-1 text-muted" onClick={() => removeSavedMeal(m.id)} aria-label={t('Delete {name}', { name: m.name })}>
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!recipes.length && !customFoods.length && !savedMeals.length && (
          <p className="text-sm text-muted">{t('Foods, recipes and saved meals you create show up here.')}</p>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{t('Backup')}</h2>
        <p className="text-sm text-muted">
          {t('Everything is stored only on this phone. Save a backup now and then, so you can move to a new phone or recover after deleting the app. Progress photos aren’t included in backups.')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-quiet" onClick={backup}>
            {t('Save backup')}
          </button>
          <label className="btn btn-quiet cursor-pointer">
            {t('Restore')}
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
          </label>
        </div>
        {message && <p className="text-sm font-medium text-accent">{message}</p>}
        {error && <ErrorNote>{error}</ErrorNote>}
        <button
          className="flex items-center gap-1.5 pt-2 text-sm text-over"
          onClick={() => confirm(t('Delete all your data from this phone? This can’t be undone.')) && resetAll()}
        >
          <Icon name="trash" className="h-4 w-4" /> {t('Delete all data')}
        </button>
      </Card>

      <div className="flex flex-col items-center gap-1 pt-4">
        <Logo className="h-14 w-14 opacity-90" />
        <span className="font-display text-lg font-bold">Plate</span>
      </div>
      <p className="px-2 pb-4 text-center text-xs text-muted">
        {t('Plate · food data from standard nutrition tables, Open Food Facts and USDA. Calorie numbers are estimates, not medical advice.')}
      </p>

      {editFood && <FoodEditor food={editFood} onClose={() => setEditFood(null)} />}
      {editRecipe && <RecipeEditor recipe={editRecipe} onClose={() => setEditRecipe(null)} />}
      {watchOpen && <WatchSheet date={dateKey()} onClose={() => setWatchOpen(false)} />}
    </div>
  )
}

/** The USDA key for online food search: Plate's shared key works for everyone; a personal key is optional. */
function UsdaKeyCard() {
  const saved = useStore((s) => s.settings.usdaKey)
  const updateSettings = useStore((s) => s.updateSettings)
  const [key, setKey] = useState(saved)
  const [status, setStatus] = useState<{ kind: 'checking' | 'ok' | 'error'; text?: string } | null>(null)
  const shared = hasSharedUsdaKey()

  async function save() {
    const trimmed = key.trim()
    if (!trimmed) {
      updateSettings({ usdaKey: '' })
      setStatus({ kind: 'ok', text: t(shared ? 'Your key is removed. Plate’s shared key is used.' : 'Your key is removed. USDA’s demo key is used.') })
      return
    }
    setStatus({ kind: 'checking' })
    const problem = await checkUsdaKey(trimmed)
    if (problem) {
      setStatus({ kind: 'error', text: problem })
      return
    }
    updateSettings({ usdaKey: trimmed })
    setKey(trimmed)
    setStatus({ kind: 'ok', text: t('USDA key saved and working.') })
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-display text-lg font-semibold">{t('Online food search')}</h2>
      <p className="text-sm text-muted">
        {shared ? (
          t('Online search uses the free USDA database with Plate’s shared key, so it works for everyone. Add your own key only if searches stop working.')
        ) : (
          <>
            {t('Online search uses the free USDA database with a shared key that allows a few searches an hour. For more, get your own free key at')}{' '}
            <a className="text-accent underline" href="https://fdc.nal.usda.gov/api-key-signup" target="_blank" rel="noreferrer">
              fdc.nal.usda.gov
            </a>
            .
          </>
        )}
      </p>
      <div className="flex gap-2">
        <input
          className="field font-mono"
          placeholder={t('USDA API key (optional)')}
          value={key}
          onChange={(e) => {
            setKey(e.target.value)
            setStatus(null)
          }}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <button className="btn btn-primary shrink-0" disabled={status?.kind === 'checking' || key.trim() === saved} onClick={save}>
          {t('Save')}
        </button>
      </div>
      {status?.kind === 'checking' && <Spinner label={t('Checking the key…')} />}
      {status?.kind === 'ok' && <p className="text-sm font-medium text-accent" role="status">{status.text}</p>}
      {status?.kind === 'error' && <ErrorNote>{status.text}</ErrorNote>}
    </Card>
  )
}
