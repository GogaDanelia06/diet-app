import { useMemo, useState } from 'react'
import { dayLabel } from '../lib/date'
import { kcal } from '../lib/format'
import { t, tName } from '../lib/i18n'
import { pastMeals, type PastMeal } from '../lib/pastMeals'
import { useStore } from '../lib/store'
import { MEAL_ICON, MEALS, type Meal } from '../lib/types'
import { Icon } from './ui'

const mealName = (m: Meal) => t(MEALS.find((x) => x.id === m)!.label)

/** Meals from the last two weeks, to copy into the chosen meal in one tap, whole or only some foods. */
export default function PastMeals({ date, meal, mealLabel, onAdded }: { date: string; meal: Meal; mealLabel: string; onAdded: (what: string) => void }) {
  const entries = useStore((s) => s.entries)
  const [query, setQuery] = useState('')
  const meals = useMemo(() => pastMeals(entries, date, meal, 14, query), [entries, date, meal, query])

  return (
    <div className="space-y-3">
      <p className="text-muted">{t('Copy a meal you logged before into {meal}.', { meal: mealLabel })}</p>
      <input type="search" className="field" placeholder={t('Search past meals, e.g. khinkali')} value={query} onChange={(e) => setQuery(e.target.value)} autoCorrect="off" />
      {meals.length === 0 ? (
        <p className="text-sm text-muted">{t(query ? 'No meal in the last two weeks has that food.' : 'Meals you log show up here for two weeks.')}</p>
      ) : (
        <ul className="space-y-2">
          {meals.map((m) => (
            <PastMealRow key={`${m.date}-${m.meal}`} past={m} date={date} meal={meal} onAdded={onAdded} />
          ))}
        </ul>
      )}
    </div>
  )
}

function PastMealRow({ past, date, meal, onAdded }: { past: PastMeal; date: string; meal: Meal; onAdded: (what: string) => void }) {
  const copyEntries = useStore((s) => s.copyEntries)
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<string[]>(() => past.entries.map((e) => e.id))
  const [copied, setCopied] = useState(false)
  const title = `${dayLabel(past.date)} · ${mealName(past.meal)}`
  const picked = past.entries.filter((e) => chosen.includes(e.id))
  const all = picked.length === past.entries.length

  function copy() {
    copyEntries(picked.map((e) => e.id), date, meal)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
    onAdded(all ? title : picked.length === 1 ? picked[0].name : t('{n} items', { n: picked.length }))
  }

  return (
    <li className="rounded-[18px] bg-surface p-3">
      <div className="flex items-center gap-3">
        <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="text-xl" aria-hidden="true">
            {MEAL_ICON[past.meal]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted">{dayLabel(past.date)}</span>
            <span className="block font-semibold">{mealName(past.meal)}</span>
            <span className="block truncate text-sm text-muted">{past.entries.map((e) => tName(e.name)).join(', ')}</span>
          </span>
          <span className="num shrink-0 text-sm font-semibold">{kcal(past.kcal)}</span>
          <Icon name={open ? 'up' : 'down'} className="h-4 w-4 shrink-0 text-muted" />
        </button>
        <button
          className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${copied ? 'bg-accent-soft text-accent' : 'bg-accent text-accent-ink'}`}
          disabled={!picked.length}
          onClick={copy}
          aria-label={t('Copy {what}', { what: title })}
        >
          <Icon name={copied ? 'check' : 'copy'} className="h-4 w-4" />
          {copied ? t('Added') : all ? t('Copy') : t('Copy {n}', { n: picked.length })}
        </button>
      </div>
      {open && (
        <ul className="mt-2 divide-y divide-line border-t border-line">
          {past.entries.map((e) => (
            <li key={e.id}>
              <label className="flex items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                  checked={chosen.includes(e.id)}
                  onChange={(ev) => setChosen(ev.target.checked ? [...chosen, e.id] : chosen.filter((id) => id !== e.id))}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{tName(e.name)}</span>
                  <span className="block truncate text-sm text-muted">{e.amountLabel}</span>
                </span>
                <span className="num shrink-0 text-sm">{kcal(e.nutrients.kcal)}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
