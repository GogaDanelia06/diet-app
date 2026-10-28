import { useEffect, useState } from 'react'
import { useStore } from './lib/store'
import { dateKey } from './lib/date'
import type { Meal } from './lib/types'
import Onboarding from './components/Onboarding'
import Today from './components/Today'
import Progress from './components/Progress'
import Coach from './components/Coach'
import Me from './components/Me'
import AddFood from './components/AddFood'
import { Icon } from './components/ui'

type Tab = 'today' | 'progress' | 'coach' | 'me'

function defaultMeal(): Meal {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

export default function App() {
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated())
  const profile = useStore((s) => s.profile)
  const [tab, setTab] = useState<Tab>('today')
  const [date, setDate] = useState(dateKey())
  const [adding, setAdding] = useState<Meal | null>(null)

  useEffect(() => useStore.persist.onFinishHydration(() => setHydrated(true)), [])

  // Jump back to today when the app is reopened on a new day.
  useEffect(() => {
    let last = dateKey()
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const now = dateKey()
      if (now !== last) {
        last = now
        setDate(now)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  if (!hydrated) return <div className="min-h-dvh bg-bg" />
  if (!profile) return <Onboarding onDone={() => setTab('today')} />

  const tabs: { id: Tab; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
    { id: 'today', label: 'Today', icon: 'today' },
    { id: 'progress', label: 'Progress', icon: 'chart' },
    { id: 'coach', label: 'Coach', icon: 'chat' },
    { id: 'me', label: 'Me', icon: 'user' },
  ]

  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-lg px-4 pb-32 safe-top">
        {tab === 'today' && <Today date={date} setDate={setDate} onAdd={setAdding} />}
        {tab === 'progress' && <Progress />}
        {tab === 'coach' && <Coach date={date} />}
        {tab === 'me' && <Me />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 backdrop-blur-xl safe-bottom">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-center px-2 pt-1.5">
          {tabs.slice(0, 2).map((t) => (
            <TabButton key={t.id} {...t} active={tab === t.id} onClick={() => setTab(t.id)} />
          ))}
          <div className="flex justify-center">
            <button
              onClick={() => setAdding(defaultMeal())}
              className="flex h-14 w-14 -translate-y-3 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg shadow-accent/30 active:scale-95"
              aria-label="Add food"
            >
              <Icon name="plus" className="h-7 w-7" />
            </button>
          </div>
          {tabs.slice(2).map((t) => (
            <TabButton key={t.id} {...t} active={tab === t.id} onClick={() => setTab(t.id)} />
          ))}
        </div>
      </nav>

      {adding && (
        <AddFood
          date={date}
          meal={adding}
          onClose={() => {
            setAdding(null)
            setTab('today')
          }}
        />
      )}
    </div>
  )
}

function TabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string
  icon: Parameters<typeof Icon>[0]['name']
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium ${active ? 'text-accent' : 'text-muted'}`}
    >
      <Icon name={icon} className="h-6 w-6" />
      {label}
    </button>
  )
}
