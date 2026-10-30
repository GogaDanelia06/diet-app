import { useEffect, useState } from 'react'
import { useStore } from './lib/store'
import { App as NativeApp } from '@capacitor/app'
import { addDays, dateKey, dayLabel } from './lib/date'
import { applyHealthText, healthTextFromHash } from './lib/healthImport'
import { isNativeApp, syncAppleHealth } from './lib/nativeHealth'
import { setLang, t } from './lib/i18n'
import type { Meal } from './lib/types'
import Onboarding from './components/Onboarding'
import Today from './components/Today'
import Progress from './components/Progress'
import Coach from './components/Coach'
import Me from './components/Me'
import AddFood, { type AddFoodMode } from './components/AddFood'
import Celebration, { useAchievementWatcher } from './components/Achievements'
import { Icon, Logo, Toast } from './components/ui'

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
  const [addMode, setAddMode] = useState<AddFoodMode>('search')
  const [addPhoto, setAddPhoto] = useState<File | undefined>()

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

  // In the iPhone app, read Apple Health on opening, on coming back, and every few minutes while open.
  // Yesterday too, so its final totals land even if the app wasn't opened late in the evening.
  const ready = hydrated && !!profile
  useEffect(() => {
    if (!ready || !isNativeApp()) return
    const sync = () => syncAppleHealth([addDays(dateKey(), -1), dateKey()]).catch(() => {})
    sync()
    const timer = window.setInterval(sync, 5 * 60_000)
    const resume = NativeApp.addListener('resume', sync)
    return () => {
      window.clearInterval(timer)
      resume.then((listener) => listener.remove())
    }
  }, [ready])

  // The Plate shortcut opens Plate with today's Health numbers in the link: save them, then tidy the address.
  const [healthNote, setHealthNote] = useState('')
  useEffect(() => {
    if (!ready) return
    const take = () => {
      const text = healthTextFromHash(window.location.hash)
      if (text == null) return
      history.replaceState(null, '', window.location.pathname + window.location.search)
      const r = applyHealthText(text, dateKey())
      setHealthNote(r ? t('Synced {day}: {what}', { day: dayLabel(r.day), what: r.summary }) : t('The Plate shortcut sent no numbers. Check its Text step.'))
    }
    take()
    window.addEventListener('hashchange', take)
    return () => window.removeEventListener('hashchange', take)
  }, [ready])
  useEffect(() => {
    if (!healthNote) return
    const timer = window.setTimeout(() => setHealthNote(''), 4000)
    return () => window.clearTimeout(timer)
  }, [healthNote])

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

  const openFood = (meal: Meal = defaultMeal(), mode: AddFoodMode = 'search', photo?: File) => {
    setAddMode(mode)
    setAddPhoto(photo)
    setAdding(meal)
  }

  return (
    <div className="app-shell min-h-dvh" key={lang}>
      <a className="skip-link" href="#main-content">{t('Skip to content')}</a>
      <aside className="desktop-sidebar">
        <button className="brand-lockup" onClick={() => setTab('today')} aria-label={t('Plate home')}>
          <Logo className="h-10 w-10" /><span>plate<span className="brand-dot">.</span></span>
        </button>
        <div className="sidebar-caption">{t('YOUR DAILY SPACE')}</div>
        <nav className="sidebar-nav" aria-label={t('Main navigation')}>
          {tabs.map((x) => <button key={x.id} onClick={() => setTab(x.id)} aria-current={tab === x.id ? 'page' : undefined} className={tab === x.id ? 'is-active' : ''}><Icon name={x.icon} /><span>{x.label}</span>{tab === x.id && <span className="nav-dot" />}</button>)}
        </nav>
        <button className="btn btn-primary sidebar-add" onClick={() => openFood()}><Icon name="plus" />{t('Log food')}</button>
        <div className="sidebar-bottom">
          <div className="local-note"><span className="local-dot" /><span>{t('Your data. Your device.')}<small>{t('Free tools. No subscription.')}</small></span></div>
          <div className="language-switch" aria-label={t('Language')}>
            <button aria-pressed={lang === 'en'} onClick={() => useStore.getState().updateSettings({ language: 'en' })}>EN</button>
            <button aria-pressed={lang === 'ka'} onClick={() => useStore.getState().updateSettings({ language: 'ka' })}>ქართული</button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <div className="workspace-topbar">
          <div className="mobile-brand"><Logo className="h-7 w-7" /><span>plate.</span></div>
          <span className="workspace-breadcrumb">{t('My workspace')}<span>/</span>{tabs.find((x) => x.id === tab)?.label}</span>
          <div className="topbar-right"><span className="free-badge"><span />{t('Always yours')}</span><button className="profile-button" onClick={() => setTab('me')} aria-label={t('Me')}><Icon name="user" className="h-4 w-4" /></button></div>
        </div>
      <main id="main-content" key={tab} className={`page-in app-main ${tab === 'today' ? 'dashboard-main' : 'detail-main'}`}>
        {tab === 'today' && <Today date={date} setDate={setDate} onAdd={openFood} onOpenCoach={() => setTab('coach')} />}
        {tab === 'progress' && <Progress onOpenDay={openDay} />}
        {tab === 'coach' && <Coach date={date} />}
        {tab === 'me' && <Me />}
      </main>
      </div>

      <nav className="mobile-nav safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4" aria-label={t('Main navigation')}>
        <div className="glass pointer-events-auto mx-auto grid max-w-md grid-cols-5 items-center rounded-[28px] px-2 py-1.5">
          {tabs.slice(0, 2).map((x) => (
            <TabButton key={x.id} {...x} active={tab === x.id} onClick={() => setTab(x.id)} />
          ))}
          <div className="flex justify-center">
            <button
              onClick={() => openFood()}
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
          initialMode={addMode}
          initialPhoto={addPhoto}
          onClose={() => {
            setAdding(null)
            setTab('today')
          }}
        />
      )}
      <Celebration />
      {healthNote && <Toast art={<Icon name="watch" className="h-4 w-4" />}>{healthNote}</Toast>}
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
      <Icon name={icon} className="h-6 w-6" />
      {label}
    </button>
  )
}
