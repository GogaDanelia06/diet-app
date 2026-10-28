import { useMemo, useState } from 'react'
import { BUILTIN_FOODS, CATEGORIES } from '../lib/foods'
import { kcal } from '../lib/format'
import { searchUsda } from '../lib/online'
import { searchFoods } from '../lib/search'
import { recentFoods, recipeToFood, useStore } from '../lib/store'
import type { Food } from '../lib/types'
import { ErrorNote, Icon, Spinner } from './ui'

export default function FoodSearch({
  onPick,
  onAskAi,
  showHistory = true,
}: {
  onPick: (f: Food) => void
  onAskAi?: (query: string) => void
  showHistory?: boolean
}) {
  const customFoods = useStore((s) => s.customFoods)
  const recipes = useStore((s) => s.recipes)
  const entries = useStore((s) => s.entries)
  const favorites = useStore((s) => s.favorites)
  const usdaKey = useStore((s) => s.settings.usdaKey)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [online, setOnline] = useState<{ query: string; foods: Food[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const all = useMemo(() => [...customFoods, ...recipes.map(recipeToFood), ...BUILTIN_FOODS], [customFoods, recipes])
  const results = useMemo(() => searchFoods(all, query), [all, query])
  const recent = useMemo(() => recentFoods(entries), [entries])
  const q = query.trim()

  async function searchOnline() {
    setLoading(true)
    setError('')
    try {
      setOnline({ query: q, foods: await searchUsda(q, usdaKey) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Online search failed. Check your internet connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          className="field pl-10"
          placeholder="Search foods and dishes"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setCategory(null)
            setOnline(null)
            setError('')
          }}
          enterKeyHint="search"
          autoCorrect="off"
        />
      </div>

      {!q && !category && (
        <>
          {showHistory && favorites.length > 0 && <FoodList title="Favorites" foods={favorites} onPick={onPick} />}
          {showHistory && recent.length > 0 && <FoodList title="Recent" foods={recent.slice(0, 12)} onPick={onPick} />}
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted">Browse</h3>
            <div className="flex flex-wrap gap-2">
              {[...(customFoods.length || recipes.length ? ['My foods'] : []), ...CATEGORIES].map((c) => (
                <button key={c} onClick={() => setCategory(c)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
                  {c}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {!q && category && (
        <>
          <button onClick={() => setCategory(null)} className="flex items-center gap-1 text-sm font-medium text-accent">
            <Icon name="left" className="h-4 w-4" /> All categories
          </button>
          <FoodList
            title={category}
            foods={category === 'My foods' ? [...customFoods, ...recipes.map(recipeToFood)] : BUILTIN_FOODS.filter((f) => f.category === category)}
            onPick={onPick}
          />
        </>
      )}

      {q && (
        <>
          {results.length > 0 ? (
            <FoodList foods={results} onPick={onPick} />
          ) : (
            <p className="text-muted">Nothing called “{q}” in Plate’s list yet.</p>
          )}
          <div className="grid gap-2">
            {onAskAi && (
              <button onClick={() => onAskAi(q)} className="btn btn-quiet justify-start">
                <Icon name="sparkle" className="h-5 w-5 text-accent" /> Estimate “{q}” with AI
              </button>
            )}
            {online?.query !== q && (
              <button onClick={searchOnline} disabled={loading} className="btn btn-quiet justify-start">
                <Icon name="search" className="h-5 w-5 text-accent" /> Search the USDA database online
              </button>
            )}
          </div>
          {loading && <Spinner label="Searching online…" />}
          {error && <ErrorNote>{error}</ErrorNote>}
          {online?.query === q &&
            (online.foods.length ? (
              <FoodList title="Online results" foods={online.foods} onPick={onPick} />
            ) : (
              <p className="text-muted">No online results. Try a simpler word in English, like “yogurt”.</p>
            ))}
        </>
      )}
    </div>
  )
}

export function FoodList({ title, foods, onPick }: { title?: string; foods: Food[]; onPick: (f: Food) => void }) {
  return (
    <div>
      {title && <h3 className="mb-1 text-sm font-medium text-muted">{title}</h3>}
      <ul className="divide-y divide-line rounded-[18px] bg-surface px-4">
        {foods.map((f) => {
          const s = f.servings[0]
          const amount = s ? `${s.label}` : '100 g'
          const cals = s ? (f.per100.kcal * s.grams) / 100 : f.per100.kcal
          return (
            <li key={f.id}>
              <button onClick={() => onPick(f)} className="flex w-full items-center gap-3 py-3 text-left">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{f.name}</div>
                  <div className="truncate text-sm text-muted">
                    {f.brand ? `${f.brand} · ` : ''}
                    {amount}
                  </div>
                </div>
                <span className="num shrink-0 text-sm">
                  <span className="font-semibold">{kcal(cals)}</span> <span className="text-muted">kcal</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
