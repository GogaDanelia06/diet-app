import { useState } from 'react'
import { aiItemToFood, suggestMeals, type AiIdea } from '../lib/ai'
import { kcal } from '../lib/format'
import { t } from '../lib/i18n'
import { photoToJpegBase64 } from '../lib/image'
import { useStore } from '../lib/store'
import { MEALS, type Meal } from '../lib/types'
import AiKeySetup from './AiKeySetup'
import { ErrorNote, Icon, Segmented, Sheet, Spinner } from './ui'

type Source = 'fridge' | 'menu'

/** Snap the fridge or a menu; the AI suggests three meals that fit what is left today. */
export default function WhatToEat({ date, meal, target, onClose }: {
  date: string
  meal: Meal
  target: { kcal: number; protein: number }
  onClose: () => void
}) {
  const settings = useStore((s) => s.settings)
  const prefs = useStore((s) => s.planPrefs)
  const addEntry = useStore((s) => s.addEntry)
  const [source, setSource] = useState<Source>('fridge')
  const [photo, setPhoto] = useState<{ base64: string; dataUrl: string } | null>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ideas, setIdeas] = useState<AiIdea[] | null>(null)
  const [added, setAdded] = useState<number[]>([])
  const mealLabel = t(MEALS.find((m) => m.id === meal)!.label)
  const cfg = { key: settings.geminiKey, model: settings.geminiModel }

  async function find(base64 = photo?.base64) {
    setLoading(true)
    setError('')
    setIdeas(null)
    setAdded([])
    try {
      setIdeas(await suggestMeals(cfg, { source, photo: base64, text: text.trim(), meal, kcal: target.kcal, protein: target.protein, diet: prefs.diet, avoid: prefs.avoid }))
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
      find(p.base64)
    } catch {
      setError(t('That photo could not be opened. Try another one.'))
    }
  }

  function log(idea: AiIdea, index: number) {
    for (const item of idea.items) {
      addEntry({
        date,
        meal,
        name: item.name,
        grams: item.grams,
        amountLabel: item.portion ? `${item.portion} (${Math.round(item.grams)} g)` : `${Math.round(item.grams)} g`,
        nutrients: { kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat },
        food: aiItemToFood(item),
      })
    }
    setAdded([...added, index])
  }

  return (
    <Sheet title={t('What can I eat?')} onClose={onClose}>
      {!settings.geminiKey ? (
        <div className="rounded-[20px] bg-surface p-4">
          <h3 className="mb-2 font-display text-lg font-semibold">{t('Turn on the free AI')}</h3>
          <AiKeySetup />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="rounded-2xl bg-accent/[0.07] px-4 py-3 text-sm">
            <strong className="text-accent">{mealLabel}</strong> · {t('aim for about {n} kcal and {p} g protein', { n: kcal(target.kcal), p: target.protein })}
          </p>
          <Segmented<Source>
            value={source}
            options={[{ value: 'fridge', label: t('My fridge') }, { value: 'menu', label: t('A menu') }]}
            onChange={(v) => { setSource(v); setIdeas(null); setPhoto(null); setError('') }}
          />
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-[20px] border-2 border-dashed border-line bg-surface p-6 text-center">
            {photo ? (
              <img src={photo.dataUrl} alt="" className="max-h-56 rounded-xl object-contain" />
            ) : (
              <>
                <Icon name="camera" className="h-10 w-10 text-accent" />
                <span className="font-display text-lg font-semibold">{t(source === 'fridge' ? 'Snap your fridge or pantry' : 'Snap the menu')}</span>
                <span className="text-sm text-muted">{t(source === 'fridge' ? 'The AI suggests meals you can make from what you have.' : 'The AI picks the dishes that fit your day best.')}</span>
              </>
            )}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && choosePhoto(e.target.files[0])} />
          </label>
          <input
            className="field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t(source === 'fridge' ? 'Or type what you have: eggs, tomatoes, cheese…' : 'Or type a few dishes from the menu')}
          />
          <button className="btn btn-primary w-full" disabled={loading || (!photo && !text.trim())} onClick={() => find()}>
            <Icon name="sparkle" className="h-5 w-5" /> {t(ideas ? 'Find other ideas' : 'Find meals')}
          </button>

          {loading && <Spinner label={t('The AI is putting meals together…')} />}
          {error && <ErrorNote>{error}</ErrorNote>}
          {ideas?.length === 0 && <p className="text-muted">{t('No ideas this time. Try another photo or add a few words.')}</p>}

          {ideas && ideas.length > 0 && (
            <ul className="space-y-3">
              {ideas.map((idea, i) => {
                const total = idea.items.reduce((n, x) => ({ kcal: n.kcal + x.kcal, protein: n.protein + x.protein, carbs: n.carbs + x.carbs, fat: n.fat + x.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
                const fits = total.kcal <= target.kcal * 1.1
                const done = added.includes(i)
                return (
                  <li key={i} className="rounded-[20px] border border-line bg-surface p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="min-w-0 font-display text-lg font-semibold">{idea.name}</h3>
                      <span className="num shrink-0 font-semibold">{kcal(total.kcal)} kcal</span>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                      <span>{t('Protein')} {Math.round(total.protein)} {t('g')}</span>
                      <span>{t('Carbs')} {Math.round(total.carbs)} {t('g')}</span>
                      <span>{t('Fat')} {Math.round(total.fat)} {t('g')}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${fits ? 'bg-accent/10 text-accent' : 'bg-over/10 text-over'}`}>{t(fits ? 'Fits your day' : 'A bit over')}</span>
                    </p>
                    {idea.why && <p className="mt-2 text-sm">{idea.why}</p>}
                    {idea.steps && (
                      <details className="mt-2 text-sm">
                        <summary className="cursor-pointer font-semibold text-accent">{t('How to make it')}</summary>
                        <p className="mt-1 whitespace-pre-line text-muted">{idea.steps}</p>
                      </details>
                    )}
                    <ul className="mt-3 divide-y divide-line text-sm">
                      {idea.items.map((x, j) => (
                        <li key={j} className="flex gap-3 py-1.5">
                          <span className="min-w-0 flex-1 truncate">{x.name}<span className="text-muted"> · {x.portion || `${Math.round(x.grams)} ${t('g')}`}</span></span>
                          <span className="num text-muted">{kcal(x.kcal)}</span>
                        </li>
                      ))}
                    </ul>
                    <button className={`btn mt-3 w-full ${done ? 'btn-quiet' : 'btn-primary'}`} disabled={done || idea.items.length === 0} onClick={() => log(idea, i)}>
                      {done ? <><Icon name="check" className="h-5 w-5" /> {t('Added to {meal}', { meal: mealLabel })}</> : t('Add to {meal}', { meal: mealLabel })}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="text-xs text-muted">{t('AI estimates can be off by 20% or more. Fix the grams if you know them.')}</p>
        </div>
      )}
    </Sheet>
  )
}
