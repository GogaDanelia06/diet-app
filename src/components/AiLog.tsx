import { useEffect, useRef, useState } from 'react'
import { t } from '../lib/i18n'
import { aiItemToFood, analyzeMealPhoto, analyzeMealText, type AiItem, type AiMeal } from '../lib/ai'
import { photoToJpegBase64 } from '../lib/image'
import { kcal, num } from '../lib/format'
import { useStore } from '../lib/store'
import type { Meal } from '../lib/types'
import { ErrorNote, Icon, Spinner } from './ui'
import AiKeySetup from './AiKeySetup'

interface Row extends AiItem {
  include: boolean
  baseGrams: number
  gramsText: string
}

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
      rows: m.items.map((i) => ({ ...i, include: true, baseGrams: i.grams, gramsText: String(Math.round(i.grams)) })),
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

  // Scale an item's nutrition when the user corrects its weight.
  function scaled(r: Row): AiItem {
    const g = num(r.gramsText) * portion
    const f = r.baseGrams > 0 ? g / r.baseGrams : 1
    return { ...r, grams: g, kcal: r.kcal * f, protein: r.protein * f, carbs: r.carbs * f, fat: r.fat * f }
  }

  const chosen = result?.rows.filter((r) => r.include).map(scaled) ?? []
  const total = chosen.reduce((n, r) => n + r.kcal, 0)

  function addAll() {
    // "½ × 1 boat" when only part of what the photo shows was eaten.
    const share = portion === 1 ? '' : `${PORTIONS.find((p) => p.value === portion)!.label} × `
    for (const item of chosen) {
      const food = aiItemToFood(item)
      addEntry({
        date,
        meal,
        name: item.name,
        grams: item.grams,
        amountLabel: item.portion ? `${share}${item.portion} (${Math.round(item.grams)} g)` : `${Math.round(item.grams)} g`,
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
                    <div className="truncate font-medium">{r.name}</div>
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
