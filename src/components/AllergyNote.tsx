import { t } from '../lib/i18n'
import { allergenLabel, dietWarnings } from '../lib/allergens'
import { useStore } from '../lib/store'
import type { Allergen, FoodHealth } from '../lib/types'
import { Icon } from './ui'

const list = (ids: Allergen[]) => ids.map((a) => t(allergenLabel(a)).toLocaleLowerCase()).join(', ')

/** Warns when a scanned product clashes with the person's allergies or diet, and lists its allergens otherwise. */
export default function AllergyNote({ health }: { health?: FoodHealth }) {
  const allergies = useStore((s) => s.settings.allergies)
  const diet = useStore((s) => s.planPrefs.diet)
  if (!health) return null
  const w = dietWarnings(health, allergies, diet)
  const caresAbout = allergies.length > 0 || diet !== 'any'

  if (w.contains.length || w.traces.length || w.diet) {
    return (
      <section className="space-y-1 rounded-[20px] border border-over/40 bg-over/10 p-4" role="alert">
        <div className="flex items-center gap-2 font-semibold text-over">
          <Icon name="alert" className="h-5 w-5 shrink-0" />
          {w.contains.length ? t('Contains {list}', { list: list(w.contains) }) : w.diet ? t(w.diet) : t('May contain traces of {list}', { list: list(w.traces) })}
        </div>
        {w.contains.length > 0 && w.diet && <p className="text-sm">{t(w.diet)}</p>}
        {(w.contains.length > 0 || w.diet) && w.traces.length > 0 && <p className="text-sm">{t('May contain traces of {list}', { list: list(w.traces) })}</p>}
        <p className="text-xs text-muted">{t('From the product’s label data. Check the pack to be sure.')}</p>
      </section>
    )
  }

  if (!health.allergens) {
    return caresAbout ? <p className="text-sm text-muted">{t('Plate doesn’t know this product’s ingredients. Check the pack for allergens.')}</p> : null
  }
  if (!health.allergens.length && !caresAbout) return null
  return (
    <p className="text-sm text-muted">
      {caresAbout && <span className="font-medium text-accent">✓ {t('Nothing from your allergy and diet list.')} </span>}
      {health.allergens.length > 0 && t('Allergens: {list}.', { list: list(health.allergens) })}
    </p>
  )
}
