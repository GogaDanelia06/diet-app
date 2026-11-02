import { t } from '../lib/i18n'
import { rateFood, type Verdict } from '../lib/rating'
import type { FoodHealth, NutrientLevel } from '../lib/types'

const VERDICT: Record<Verdict, { label: string; color: string }> = {
  good: { label: 'Good choice', color: 'text-accent' },
  okay: { label: 'Fine in moderation', color: 'text-carbs' },
  limit: { label: 'Best to limit', color: 'text-over' },
}

// The colours printed on Nutri-Score labels, so the scale looks like the one on the pack.
export const NUTRI_COLORS = { a: '#038141', b: '#85bb2f', c: '#fecb02', d: '#ee8100', e: '#e63e11' } as const
const GRADES = Object.entries(NUTRI_COLORS) as [keyof typeof NUTRI_COLORS, string][]

const NOVA: Record<1 | 2 | 3 | 4, { label: string; dot: string }> = {
  1: { label: 'Unprocessed or minimally processed', dot: 'bg-accent' },
  2: { label: 'Cooking ingredient', dot: 'bg-carbs' },
  3: { label: 'Processed', dot: 'bg-carbs' },
  4: { label: 'Ultra-processed', dot: 'bg-over' },
}

type LevelKey = keyof NonNullable<FoodHealth['levels']>

const LEVEL_TEXT: Record<LevelKey, Record<NutrientLevel, string>> = {
  sugars: { high: 'High sugar', moderate: 'Moderate sugar', low: 'Low sugar' },
  salt: { high: 'High salt', moderate: 'Moderate salt', low: 'Low salt' },
  fat: { high: 'High fat', moderate: 'Moderate fat', low: 'Low fat' },
  saturatedFat: { high: 'High saturated fat', moderate: 'Moderate saturated fat', low: 'Low saturated fat' },
}

const LEVEL_DOT: Record<NutrientLevel, string> = { high: 'bg-over', moderate: 'bg-carbs', low: 'bg-accent' }
const LEVEL_ORDER: NutrientLevel[] = ['high', 'moderate', 'low']

/** Whether a packaged product is a good pick: its Nutri-Score, how processed it is, and its sugar, fat and salt. */
export default function HealthRating({ health }: { health?: FoodHealth }) {
  const verdict = rateFood(health)
  if (!health || (!verdict && !health.nova)) return null
  const levels = (Object.entries(health.levels ?? {}) as [LevelKey, NutrientLevel][]).sort(
    (a, b) => LEVEL_ORDER.indexOf(a[1]) - LEVEL_ORDER.indexOf(b[1]),
  )

  return (
    <section className="space-y-3 rounded-[20px] bg-surface p-4" aria-label={t('Health rating')}>
      {verdict && (
        <div>
          <div className={`font-display text-xl font-semibold ${VERDICT[verdict].color}`}>{t(VERDICT[verdict].label)}</div>
          {!health.nutriScore && <p className="text-sm text-muted">{t('Based on its sugar, fat and salt')}</p>}
        </div>
      )}

      {health.nutriScore && (
        <div className="flex items-center gap-3">
          <div className="flex items-center" role="img" aria-label={t('Nutri-Score {g}', { g: health.nutriScore.toUpperCase() })}>
            {GRADES.map(([g, color]) =>
              g === health.nutriScore ? (
                <span key={g} className="z-10 flex h-10 w-9 items-center justify-center rounded-lg text-lg font-bold uppercase text-white ring-2 ring-white" style={{ background: color }}>
                  {g}
                </span>
              ) : (
                <span key={g} className="flex h-7 w-7 items-center justify-center text-sm font-bold uppercase text-white/90 opacity-45 first:rounded-l-lg last:rounded-r-lg" style={{ background: color }}>
                  {g}
                </span>
              ),
            )}
          </div>
          <span className="text-sm text-muted">Nutri-Score</span>
        </div>
      )}

      {(health.nova || levels.length > 0 || health.additives != null) && (
        <ul className="flex flex-wrap gap-2">
          {health.nova && <Fact dot={NOVA[health.nova].dot}>{t(NOVA[health.nova].label)}</Fact>}
          {levels.map(([key, level]) => (
            <Fact key={key} dot={LEVEL_DOT[level]}>
              {t(LEVEL_TEXT[key][level])}
            </Fact>
          ))}
          {health.additives != null && (
            <Fact dot={health.additives ? 'bg-muted' : 'bg-accent'}>
              {health.additives === 0 ? t('No additives') : health.additives === 1 ? t('1 additive') : t('{n} additives', { n: health.additives })}
            </Fact>
          )}
        </ul>
      )}

      <p className="text-xs text-muted">{t('Rated per 100 g by Open Food Facts. A guide, not medical advice.')}</p>
    </section>
  )
}

function Fact({ dot, children }: { dot: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-sm">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      {children}
    </li>
  )
}
