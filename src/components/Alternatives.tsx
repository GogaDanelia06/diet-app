import { useEffect, useState } from 'react'
import { t } from '../lib/i18n'
import { findAlternatives, lookupBarcode, type Alternative } from '../lib/online'
import { shouldSuggestAlternatives } from '../lib/rating'
import type { Food, FoodHealth } from '../lib/types'
import { Icon, Spinner } from './ui'
import { NUTRI_COLORS } from './HealthRating'

/** Better-rated products in the same category, for a scanned product rated C or worse. */
export default function Alternatives({ health, exclude, onOpen }: { health?: FoodHealth; exclude?: string; onOpen: (food: Food) => void }) {
  const wanted = shouldSuggestAlternatives(health)
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading')
  const [items, setItems] = useState<Alternative[]>([])
  const [opening, setOpening] = useState<string | null>(null)
  const [openError, setOpenError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!wanted || !health) return
    let live = true
    setState('loading')
    findAlternatives(health, exclude)
      .then((found) => live && (setItems(found), setState('done')))
      .catch(() => live && setState('error'))
    return () => {
      live = false
    }
  }, [wanted, health, exclude, attempt])

  if (!wanted || (state === 'done' && !items.length)) return null

  async function open(alt: Alternative) {
    setOpening(alt.code)
    setOpenError('')
    try {
      const food = await lookupBarcode(alt.code)
      if (food) onOpen(food)
      else setOpenError(t('That product has no nutrition data yet.'))
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : t('Lookup failed. Check your internet connection.'))
    } finally {
      setOpening(null)
    }
  }

  return (
    <section className="space-y-2" aria-label={t('Better choices')}>
      <h3 className="font-display text-lg font-semibold">{t('Better choices')}</h3>
      {state === 'loading' && <Spinner label={t('Looking for better-rated products…')} />}
      {state === 'error' && (
        <p className="text-sm text-muted">
          {t('Couldn’t load better choices.')}{' '}
          <button className="font-medium text-accent underline" onClick={() => setAttempt((n) => n + 1)}>
            {t('Try again')}
          </button>
        </p>
      )}
      {state === 'done' && (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-[20px] bg-surface">
            {items.map((alt) => (
              <li key={alt.code}>
                <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:opacity-60" disabled={!!opening} onClick={() => open(alt)}>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
                    {alt.image ? <img src={alt.image} alt="" loading="lazy" className="h-full w-full object-contain" /> : <Icon name="barcode" className="h-5 w-5 text-black/40" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{alt.name}</span>
                    {alt.brand && <span className="block truncate text-sm text-muted">{alt.brand}</span>}
                  </span>
                  {opening === alt.code ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-transparent" aria-label={t('Loading')} />
                  ) : (
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold uppercase text-white"
                      style={{ background: NUTRI_COLORS[alt.nutriScore] }}
                      aria-label={t('Nutri-Score {g}', { g: alt.nutriScore.toUpperCase() })}
                    >
                      {alt.nutriScore}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {openError && <p className="text-sm text-over">{openError}</p>}
          <p className="text-xs text-muted">{t('Similar products rated A or B. They may not be sold near you.')}</p>
        </>
      )}
    </section>
  )
}
