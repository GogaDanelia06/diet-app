import { useEffect, useState } from 'react'
import { useStore } from './lib/store'
import { dateKey } from './lib/date'
import { setLang, t } from './lib/i18n'
import type { Meal } from './lib/types'
import Onboarding from './components/Onboarding'
import Today from './components/Today'
import Progress from './components/Progress'
import Coach from './components/Coach'
import Me from './components/Me'
import AddFood from './components/AddFood'
import Celebration, { useAchievementWatcher } from './components/Achievements'
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
  const lang = useStore((s) => s.settings.language)
  const [tab, setTab] = useState<Tab>('today')
  const [date, setDate] = useState(dateKey())
  const [adding, setAdding] = useState<Meal | null>(null)

  // Children translate with t() during render, so the language has to be set first.
  setLang(lang)
  useAchievementWatcher(hydrated && !!profile)

  useEffect(() => useStore.persist.onFinishHydration(() => setHydrated(true)), [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

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
  if (!profile) return <Onboarding key={lang} onDone={() => setTab('today')} />

  const tabs: { id: Tab; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
    { id: 'today', label: t('Today'), icon: 'today' },
    { id: 'progress', label: t('Progress'), icon: 'chart' },
    { id: 'coach', label: t('Coach'), icon: 'chat' },
    { id: 'me', label: t('Me'), icon: 'user' },
  ]

  const openDay = (d: string) => {
    setDate(d)
    setTab('today')
  }

  return (
    <div className="min-h-dvh" key={lang}>
      <main key={tab} className="page-in safe-top mx-auto max-w-lg px-4 pb-36">
        {tab === 'today' && <Today date={date} setDate={setDate} onAdd={setAdding} onOpenCoach={() => setTab('coach')} />}
        {tab === 'progress' && <Progress onOpenDay={openDay} />}
        {tab === 'coach' && <Coach date={date} />}
        {tab === 'me' && <Me />}
      </main>

      <nav className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4">
        <div className="glass pointer-events-auto mx-auto grid max-w-md grid-cols-5 items-center rounded-[28px] px-2 py-1.5">
          {tabs.slice(0, 2).map((x) => (
            <TabButton key={x.id} {...x} active={tab === x.id} onClick={() => setTab(x.id)} />
          ))}
          <div className="flex justify-center">
            <button
              onClick={() => setAdding(defaultMeal())}
              className="btn-primary flex h-14 w-14 -translate-y-4 items-center justify-center rounded-full transition-transform active:-translate-y-3 active:scale-95"
              aria-label={t('Add food')}
            >
              <Icon name="plus" className="h-7 w-7" />
            </button>
          </div>
          {tabs.slice(2).map((x) => (
            <TabButton key={x.id} {...x} active={tab === x.id} onClick={() => setTab(x.id)} />
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
      <Celebration />
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
      className={`relative flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold transition-colors ${active ? 'text-accent' : 'text-muted'}`}
    >
      <Icon name={icon} className={`h-6 w-6 ${active ? 'drop-shadow-[0_0_8px_rgb(69_240_160/0.7)]' : ''}`} />
      {label}
    </button>
  )
}
