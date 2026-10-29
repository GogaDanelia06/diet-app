import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { ACHIEVEMENTS, newlyEarned } from '../lib/achievements'
import { dateKey, shortDate } from '../lib/date'
import { t } from '../lib/i18n'
import { useStore, useTargets } from '../lib/store'
import { Card, Sheet } from './ui'
import { MedalView } from './ThreeViews'

/** Badges waiting to be celebrated (not saved; the unlocks themselves are). */
const useCelebrations = create<{ queue: string[]; push: (ids: string[]) => void; clear: () => void }>((set) => ({
  queue: [],
  push: (ids) => set((s) => ({ queue: [...s.queue, ...ids] })),
  clear: () => set({ queue: [] }),
}))

/** Checks for new badges whenever the saved data changes. */
export function useAchievementWatcher(enabled: boolean) {
  const targets = useTargets()
  const kcal = targets?.kcal
  const protein = targets?.protein
  useEffect(() => {
    if (!enabled || kcal == null || protein == null) return
    let timer = 0
    const check = () => {
      clearTimeout(timer)
      // Wait for a burst of changes (adding a whole meal) to finish first.
      timer = window.setTimeout(() => {
        const st = useStore.getState()
        const ids = newlyEarned(st, { kcal, protein }, dateKey())
        if (!ids.length) return
        st.unlockAchievements(ids)
        useCelebrations.getState().push(ids)
      }, 600)
    }
    check()
    const unsubscribe = useStore.subscribe(check)
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [enabled, kcal, protein])
}

/** Full-screen moment with the 3D medal when one or more badges unlock. */
export default function Celebration() {
  const queue = useCelebrations((s) => s.queue)
  const clear = useCelebrations((s) => s.clear)
  if (!queue.length) return null
  const badges = queue.map((id) => ACHIEVEMENTS.find((a) => a.id === id)!).filter(Boolean)
  const first = badges[0]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={t('Achievement unlocked')} onClick={clear}>
      <div className="pop-in w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
        <div className="relative mx-auto h-64 w-64">
          <div className="absolute inset-8 rounded-full bg-[radial-gradient(circle,rgb(255_201_60/0.35),transparent_70%)] blur-xl" />
          <MedalView />
        </div>
        <p className="text-sm font-semibold text-carbs">{badges.length > 1 ? t('{n} achievements unlocked', { n: badges.length }) : t('Achievement unlocked')}</p>
        <h2 className="mt-1 font-display text-3xl font-bold">
          {first.icon} {t(first.title)}
        </h2>
        <p className="mt-1 text-muted">{t(first.description)}</p>
        {badges.length > 1 && (
          <p className="mt-3 text-2xl" aria-label={badges.slice(1).map((b) => t(b.title)).join(', ')}>
            {badges.slice(1).map((b) => b.icon).join(' ')}
          </p>
        )}
        <button className="btn btn-primary mt-6 w-full text-lg" onClick={clear}>
          {t('Nice!')}
        </button>
      </div>
    </div>
  )
}

export function AchievementsCard() {
  const unlocked = useStore((s) => s.achievements)
  const [open, setOpen] = useState(false)
  const recent = ACHIEVEMENTS.filter((a) => unlocked[a.id]).sort((a, b) => unlocked[b.id] - unlocked[a.id])

  return (
    <Card>
      <button className="block w-full text-left" onClick={() => setOpen(true)}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold">{t('Achievements')}</h2>
          <span className="num text-sm text-muted">
            {t('{n} of {total}', { n: recent.length, total: ACHIEVEMENTS.length })}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          {recent.slice(0, 6).map((a) => (
            <Badge key={a.id} icon={a.icon} unlocked small />
          ))}
          {recent.length === 0 && <p className="text-sm text-muted">{t('Log your first food to earn a badge.')}</p>}
        </div>
      </button>
      {open && <AchievementsSheet onClose={() => setOpen(false)} />}
    </Card>
  )
}

function AchievementsSheet({ onClose }: { onClose: () => void }) {
  const unlocked = useStore((s) => s.achievements)
  return (
    <Sheet title={t('Achievements')} onClose={onClose}>
      <div className="grid grid-cols-3 gap-3">
        {ACHIEVEMENTS.map((a) => {
          const when = unlocked[a.id]
          return (
            <div key={a.id} className={`glass rounded-2xl p-3 text-center ${when ? '' : 'opacity-50'}`}>
              <Badge icon={a.icon} unlocked={!!when} />
              <div className="mt-2 text-sm font-semibold leading-tight">{t(a.title)}</div>
              <div className="mt-1 text-[11px] leading-snug text-muted">{when ? shortDate(dateKey(new Date(when))) : t(a.description)}</div>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}

function Badge({ icon, unlocked, small = false }: { icon: string; unlocked: boolean; small?: boolean }) {
  return (
    <span
      className={`mx-auto flex items-center justify-center rounded-full ${small ? 'h-11 w-11 text-xl' : 'h-14 w-14 text-2xl'} ${
        unlocked
          ? 'bg-[radial-gradient(circle_at_35%_30%,#ffe37a,#f0a91c_60%,#9a6400)] shadow-[0_0_18px_rgb(255_201_60/0.45),inset_0_1px_0_rgb(255_255_255/0.6)]'
          : 'bg-white/[0.06] grayscale'
      }`}
    >
      {unlocked ? icon : '🔒'}
    </span>
  )
}
