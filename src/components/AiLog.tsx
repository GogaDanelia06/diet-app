import { useEffect, useMemo, useRef, useState } from 'react'
import { t, tName } from '../lib/i18n'
import { aiItemToFood, analyzeMealPhoto, analyzeMealText, type AiItem, type AiMeal } from '../lib/ai'
import { photoToJpegBase64 } from '../lib/image'
import { kcal, macro, num } from '../lib/format'
import { recipeToFood, useStore } from '../lib/store'
import { scaleNutrients } from '../lib/calc'
import { BUILTIN_FOODS } from '../lib/foods'
import { searchFoods } from '../lib/search'
import type { Food, Meal } from '../lib/types'
import { ErrorNote, Icon, Spinner } from './ui'
import AiKeySetup from './AiKeySetup'

interface Row extends AiItem {
  include: boolean
  baseGrams: number
  gramsText: string
  /** Added by hand: its grams are what was eaten, so "How much did you eat?" leaves it alone. */
  manual?: boolean
  /** The food from Plate's list it was picked from, kept so the diary knows it. */
  food?: Food
}

const toRow = (item: AiItem, extra: Partial<Row> = {}): Row => ({ ...item, include: true, baseGrams: item.grams, gramsText: String(Math.round(item.grams)), ...extra })

/** How much of the photographed food was eaten; scales every item at once. */
const PORTIONS = [
  { value: 0.5, label: '½' },
  { value: 0.75, label: '¾' },
  { value: 1, label: 'All of it' },
  { value: 1.5, label: '1½' },
  { value: 2, label: '2×' },
]

export default function AiLog({
  kind,
  seed,
  photo: initialPhoto,
  date,
  meal,
  mealLabel,
  onAdded,
}: {
  kind: 'photo' | 'describe'
  seed: string
  /** A photo already taken (from Snap meal), analysed as soon as this opens. */
  photo?: File
  date: string
  meal: Meal
  mealLabel: string
  onAdded: (what: string) => void
}) {
  const settings = useStore((s) => s.settings)
  const addEntry = useStore((s) => s.addEntry)
  const [text, setText] = useState(kind === 'describe' ? seed : '')
  const [photo, setPhoto] = useState<{ base64: string; dataUrl: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ title: string; notes?: string; rows: Row[] } | null>(null)
  const [portion, setPortion] = useState(1)
  const [missedLoading, setMissedLoading] = useState(false)
  const cfg = { key: settings.geminiKey, model: settings.geminiModel }
  const started = useRef(false)

  useEffect(() => {
    if (!initialPhoto || !settings.geminiKey || started.current) return
    started.current = true
    choosePhoto(initialPhoto)
    // Runs once, for the photo the sheet was opened with.
  }, [initialPhoto])

  if (!settings.geminiKey) {
    return (
      <div className="rounded-[20px] bg-surface p-4">
        <h3 className="mb-2 font-display text-lg font-semibold">{t('Turn on the free AI')}</h3>
        <AiKeySetup />
      </div>
    )
  }

  function show(m: AiMeal) {
    setPortion(1)
    setResult({
      title: m.title,
      notes: m.notes,
      rows: m.items.map((i) => toRow(i)),
    })
  }

  async function run(fn: () => Promise<AiMeal>) {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      show(await fn())
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Something went wrong. Try again.'))
    } finally {
      setLoading(false)
    }
  }

  async function choosePhoto(file: File) {
    try {
      const p = await photoToJpegBase64(file)
      setPhoto(p)
      run(() => analyzeMealPhoto(cfg, p.base64, text.trim()))
    } catch {
      setError(t('That photo could not be opened. Try another one.'))
    }
  }

  const addRows = (rows: Row[]) => setResult((cur) => (cur ? { ...cur, rows: [...cur.rows, ...rows] } : cur))

  // Something the photo missed that Plate doesn't know: the AI estimates just that.
  async function estimateMissed(description: string) {
    setMissedLoading(true)
    setError('')
    try {
      addRows((await analyzeMealText(cfg, description)).items.map((i) => toRow(i, { manual: true })))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Something went wrong. Try again.'))
    } finally {
      setMissedLoading(false)
    }
  }

  // Scale an item's nutrition when the user corrects its weight.
  function scaled(r: Row): Row {
    const g = num(r.gramsText) * (r.manual ? 1 : portion)
    const f = r.baseGrams > 0 ? g / r.baseGrams : 1
    return { ...r, grams: g, kcal: r.kcal * f, protein: r.protein * f, carbs: r.carbs * f, fat: r.fat * f }
  }

  const chosen = result?.rows.filter((r) => r.include).map(scaled) ?? []
  const total = chosen.reduce((n, r) => n + r.kcal, 0)

  function addAll() {
    // "½ × 1 boat" when only part of what the photo shows was eaten.
    const share = portion === 1 ? '' : `${PORTIONS.find((p) => p.value === portion)!.label} × `
    for (const item of chosen) {
      const food = item.food ?? aiItemToFood(item)
      const part = item.manual ? '' : share
      addEntry({
        date,
        meal,
        name: item.name,
        grams: item.grams,
        amountLabel: item.portion ? `${part}${item.portion} (${Math.round(item.grams)} g)` : `${Math.round(item.grams)} g`,
        nutrients: { kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat },
        food,
      })
    }
    onAdded(chosen.length === 1 ? chosen[0].name : t('{n} items', { n: chosen.length }))
    setResult(null)
    setPhoto(null)
    setText('')
  }

  return (
    <div className="space-y-4">
      {kind === 'photo' ? (
        <>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-[20px] border-2 border-dashed border-line bg-surface p-6 text-center">
            {photo ? (
              <img src={photo.dataUrl} alt="Your meal" className="max-h-64 rounded-xl object-contain" />
            ) : (
              <>
                <Icon name="camera" className="h-10 w-10 text-accent" />
                <span className="font-display text-lg font-semibold">{t('Take or choose a photo')}</span>
                <span className="text-sm text-muted">{t('The AI lists what’s on the plate and estimates the calories.')}</span>
              </>
            )}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && choosePhoto(e.target.files[0])} />
          </label>
          <input
            className="field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('Optional: details the photo can’t show (fried in butter…)')}
          />
          {photo && !loading && (
            <button className="btn btn-quiet w-full" onClick={() => run(() => analyzeMealPhoto(cfg, photo.base64, text.trim()))}>
              {t('Analyze again')}
            </button>
          )}
        </>
      ) : (
        <>
          <textarea
            className="field min-h-28"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('Describe what you ate, e.g. 3 meat khinkali, a slice of Imeruli khachapuri and a glass of red wine')}
          />
          <button className="btn btn-primary w-full" disabled={!text.trim() || loading} onClick={() => run(() => analyzeMealText(cfg, text.trim()))}>
            <Icon name="sparkle" className="h-5 w-5" /> {t('Estimate calories')}
          </button>
        </>
      )}

      {loading && <Spinner label={t('The AI is looking at your meal…')} />}
      {error && <ErrorNote>{error}</ErrorNote>}

      {result && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-xl font-semibold">{result.title}</h3>
            <span className="num text-lg font-semibold">{kcal(total)} kcal</span>
          </div>
          {result.rows.length === 0 && <p className="text-muted">{t('No food was found. Try another photo or describe it in words.')}</p>}
          <ul className="divide-y divide-line rounded-[18px] bg-surface px-4">
            {result.rows.map((r, i) => {
              const s = scaled(r)
              return (
                <li key={i} className={`flex items-center gap-3 py-3 ${r.include ? '' : 'opacity-45'}`}>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[var(--accent)]"
                    checked={r.include}
                    onChange={(e) => setResult({ ...result, rows: result.rows.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)) })}
                    aria-label={t('Include {name}', { name: r.name })}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{tName(r.name)}</div>
                    <div className="truncate text-sm text-muted">{r.portion}</div>
                  </div>
                  <label className="flex items-center gap-1 text-sm text-muted">
                    <input
                      className="field num w-16 px-2 py-1 text-right"
                      inputMode="decimal"
                      value={r.gramsText}
                      onChange={(e) => setResult({ ...result, rows: result.rows.map((x, j) => (j === i ? { ...x, gramsText: e.target.value } : x)) })}
                      aria-label={t('Grams of {name}', { name: r.name })}
                    />
                    {t('g')}
                  </label>
                  <span className="num w-12 text-right font-semibold">{kcal(s.kcal)}</span>
                </li>
              )
            })}
          </ul>
          <AddMissed
            label={t(kind === 'photo' ? 'Add something the photo missed' : 'Add something else')}
            busy={missedLoading}
            onAdd={(row) => addRows([row])}
            onEstimate={estimateMissed}
          />
          {missedLoading && <Spinner label={t('The AI is estimating it…')} />}
          {result.rows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted">{t('How much did you eat?')}</p>
              <div className="flex gap-1.5" role="group" aria-label={t('How much did you eat?')}>
                {PORTIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    aria-pressed={portion === p.value}
                    onClick={() => setPortion(p.value)}
                    className={`num flex-1 rounded-full border px-2 py-1.5 text-sm font-semibold transition-colors ${portion === p.value ? 'border-accent bg-accent text-[var(--accent-ink)]' : 'border-line text-muted'}`}
                  >
                    {t(p.label)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {result.notes && <p className="text-sm text-muted">{result.notes}</p>}
          <p className="text-xs text-muted">{t('AI estimates can be off by 20% or more. Fix the grams if you know them.')}</p>
          <button className="btn btn-primary w-full text-lg" disabled={!chosen.length} onClick={addAll}>
            {chosen.length === 1 ? t('Add 1 item to {meal}', { meal: mealLabel }) : t('Add {n} items to {meal}', { n: chosen.length, meal: mealLabel })}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Adds a food the photo missed: type its name, pick it from Plate's list and enter the grams,
 * and the calories are worked out from the list. Foods Plate doesn't know go to the AI instead.
 */
function AddMissed({ label, busy, onAdd, onEstimate }: { label: string; busy: boolean; onAdd: (row: Row) => void; onEstimate: (description: string) => void }) {
  const customFoods = useStore((s) => s.customFoods)
  const recipes = useStore((s) => s.recipes)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<Food | null>(null)
  const [grams, setGrams] = useState('')
  const all = useMemo(() => [...customFoods, ...recipes.map(recipeToFood), ...BUILTIN_FOODS], [customFoods, recipes])
  const matches = useMemo(() => (picked || !name.trim() ? [] : searchFoods(all, name, 5)), [all, name, picked])
  const g = num(grams)
  const n = picked && g > 0 ? scaleNutrients(picked.per100, g) : null

  function reset() {
    setOpen(false)
    setName('')
    setPicked(null)
    setGrams('')
  }

  function pick(f: Food) {
    setPicked(f)
    if (!(num(grams) > 0)) setGrams(String(f.servings.find((s) => !s.label.startsWith('whole'))?.grams ?? 100))
  }

  if (!open) {
    return (
      <button className="flex items-center gap-1.5 text-sm font-medium text-accent" onClick={() => setOpen(true)}>
        <Icon name="plus" className="h-4 w-4" /> {label}
      </button>
    )
  }

  return (
    <div className="space-y-3 rounded-[18px] bg-surface p-3">
      <div className="flex gap-2">
        <input
          className="field min-w-0 flex-1"
          placeholder={t('What was missed, e.g. sulguni')}
          value={picked ? tName(picked.name) : name}
          onChange={(e) => {
            setName(e.target.value)
            setPicked(null)
          }}
          autoFocus
          autoCorrect="off"
          aria-label={t('Food name')}
        />
        <label className="flex shrink-0 items-center gap-1 text-sm text-muted">
          <input className="field num w-20 px-2 text-right" inputMode="decimal" placeholder="100" value={grams} onChange={(e) => setGrams(e.target.value)} aria-label={t('Grams eaten')} />
          {t('g')}
        </label>
      </div>

      {matches.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl bg-surface-2 px-3">
          {matches.map((f) => (
            <li key={f.id}>
              <button className="flex w-full items-center gap-3 py-2.5 text-left" onClick={() => pick(f)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{tName(f.name)}</span>
                  {f.brand && <span className="block truncate text-xs text-muted">{f.brand}</span>}
                </span>
                <span className="num shrink-0 text-xs text-muted">{t('{n} kcal per 100 g', { n: kcal(f.per100.kcal) })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!picked && name.trim().length >= 2 && !matches.length && <p className="text-sm text-muted">{t('Not in Plate’s list yet.')}</p>}

      {picked && n && (
        <p className="text-sm">
          <span className="num font-semibold">{kcal(n.kcal)} {t('kcal')}</span>
          <span className="text-muted"> · {t('{p} g protein · {c} g carbs · {f} g fat', { p: macro(n.protein), c: macro(n.carbs), f: macro(n.fat) })}</span>
        </p>
      )}

      <div className="flex gap-2">
        <button className="btn btn-quiet flex-1" onClick={reset}>
          {t('Cancel')}
        </button>
        {picked ? (
          <button
            className="btn btn-primary flex-1"
            disabled={!n}
            onClick={() => {
              onAdd(toRow({ name: picked.name, portion: '', grams: g, kcal: n!.kcal, protein: n!.protein, carbs: n!.carbs, fat: n!.fat }, { manual: true, food: picked }))
              reset()
            }}
          >
            {t('Add')}
          </button>
        ) : (
          name.trim() && (
            <button
              className="btn btn-quiet flex-1"
              disabled={busy}
              onClick={() => {
                onEstimate(g > 0 ? `${g} g ${name.trim()}` : name.trim())
                reset()
              }}
            >
              <Icon name="sparkle" className="h-5 w-5 text-accent" /> {t('Estimate with AI')}
            </button>
          )
        )}
      </div>
    </div>
  )
}

