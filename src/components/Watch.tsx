import { useState } from 'react'
import { dateKey, dayLabel } from '../lib/date'
import { kcal, num } from '../lib/format'
import { parseHealthText } from '../lib/health'
import { t } from '../lib/i18n'
import { dayBurn, useStore } from '../lib/store'
import { Card, ErrorNote, Field, Icon, Sheet } from './ui'

const GUIDE_STEPS = [
  'Open the Shortcuts app and tap + to make a new shortcut. Name it Plate.',
  'Add the action Find Health Samples. Set Type to Active Energy and add the filter Start Date is Today. Add a second filter Source is your Apple Watch, so nothing is counted twice.',
  'Add Calculate Statistics and choose Sum.',
  'Add Find Health Samples again with Type Steps, Start Date is Today and Source your Apple Watch, then another Calculate Statistics with Sum.',
  'Add Text and type plate active= then insert the first Statistics result, a space, steps= and the second Statistics result.',
  'Add Copy to Clipboard and tap Done.',
  'Run the shortcut, come back to Plate and tap Import from Apple Health.',
]

export function WatchGuide() {
  return (
    <div className="space-y-4">
      <p className="text-muted">
        {t('iPhone doesn’t let web apps read Apple Health, so a small Shortcut copies today’s numbers and Plate imports them. You set it up once.')}
      </p>
      <ol className="space-y-3">
        {GUIDE_STEPS.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">{i + 1}</span>
            <span>{t(s)}</span>
          </li>
        ))}
      </ol>
      <div className="rounded-2xl bg-white/[0.05] p-3 font-mono text-sm">plate active=640 steps=9123</div>
      <p className="text-sm text-muted">
        {t('One tap: add the shortcut to your Home Screen, or in Shortcuts → Automation choose Time of Day (for example 21:00) and Run Immediately.')}
      </p>
      <div className="rounded-2xl border border-line p-3">
        <h4 className="mb-1 font-semibold">WHOOP</h4>
        <p className="text-sm text-muted">
          {t('In the WHOOP app’s settings, turn on Apple Health sharing. WHOOP shares calories only for workouts it detects, not steps or all-day calories. If you also wear the Apple Watch, keep the Source filter on Apple Watch so workouts aren’t counted twice. If you only wear WHOOP, choose WHOOP as the Source for Active Energy.')}
        </p>
      </div>
    </div>
  )
}

export default function WatchSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const st = useStore()
  const setDeviceDay = useStore((s) => s.setDeviceDay)
  const setSteps = useStore((s) => s.setSteps)
  const burn = dayBurn(st, date)
  const device = st.deviceActivity[date]
  const [active, setActive] = useState(device ? String(device.activeKcal) : '')
  const [steps, setStepsText] = useState(device?.steps != null ? String(device.steps) : '')
  const [paste, setPaste] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [guide, setGuide] = useState(!device)

  function apply(text: string) {
    const r = parseHealthText(text)
    if (!r) {
      setError(t('Nothing from the Plate shortcut is copied. Run the shortcut first, then tap Import.'))
      return
    }
    // The shortcut collects today; an explicit date in the text wins if it isn't in the future.
    const target = r.date && r.date <= dateKey() ? r.date : date
    if (r.activeKcal != null) {
      setDeviceDay(target, { activeKcal: r.activeKcal, steps: r.steps, source: 'health', at: Date.now() })
    } else if (r.steps != null) {
      setSteps(target, r.steps)
    }
    setActive(r.activeKcal != null ? String(r.activeKcal) : active)
    setStepsText(r.steps != null ? String(r.steps) : steps)
    setError('')
    setPaste(null)
    setMessage(t('Imported for {day}.', { day: dayLabel(target) }))
  }

  async function importClipboard() {
    setError('')
    setMessage('')
    try {
      apply(await navigator.clipboard.readText())
    } catch {
      // Clipboard reading can be blocked; let the user paste instead.
      setPaste('')
    }
  }

  function saveManual() {
    const a = Math.round(num(active))
    if (a <= 0) return
    const s = Math.round(num(steps))
    setDeviceDay(date, { activeKcal: a, steps: s > 0 ? s : undefined, source: 'manual', at: Date.now() })
    setMessage(t('Saved for {day}.', { day: dayLabel(date) }))
  }

  return (
    <Sheet title={t('Apple Watch & WHOOP')} onClose={onClose}>
      <div className="space-y-4">
        {device && (
          <Card className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted">{dayLabel(date)}</span>
              <span className="text-xs text-muted">{device.source === 'health' ? t('From Apple Health') : t('Typed in')}</span>
            </div>
            <div className="flex items-baseline gap-4">
              <span>
                <span className="num text-3xl font-bold">{kcal(device.activeKcal)}</span> <span className="text-muted">{t('active kcal')}</span>
              </span>
              {device.steps != null && (
                <span>
                  <span className="num text-xl font-semibold">{device.steps.toLocaleString()}</span> <span className="text-muted">{t('steps')}</span>
                </span>
              )}
            </div>
            <p className="text-sm text-muted">
              {burn.burned > 0
                ? t('Your plan already counts about {base} active kcal for a normal day, so {extra} kcal are added.', { base: kcal(burn.baseline), extra: kcal(burn.burned) })
                : t('That’s within a normal day for your activity level ({base} kcal), so nothing extra is added.', { base: kcal(burn.baseline) })}
            </p>
          </Card>
        )}

        <button className="btn btn-primary w-full text-lg" onClick={importClipboard}>
          <Icon name="watch" className="h-5 w-5" /> {t('Import from Apple Health')}
        </button>
        {paste !== null && (
          <div className="space-y-2">
            <Field label={t('Paste what the shortcut copied')}>
              <textarea className="field min-h-20 font-mono" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="plate active=640 steps=9123" />
            </Field>
            <button className="btn btn-quiet w-full" disabled={!paste.trim()} onClick={() => apply(paste)}>
              {t('Import')}
            </button>
          </div>
        )}
        {message && <p className="text-sm font-semibold text-accent">{message}</p>}
        {error && <ErrorNote>{error}</ErrorNote>}

        <Card className="space-y-3">
          <h3 className="font-display font-semibold">{t('Or type it in')}</h3>
          <p className="text-sm text-muted">{t('Use the Active Calories number from your watch’s Activity rings.')}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Active kcal')}>
              <input className="field num" inputMode="numeric" value={active} onChange={(e) => setActive(e.target.value)} placeholder="640" />
            </Field>
            <Field label={t('Steps (optional)')}>
              <input className="field num" inputMode="numeric" value={steps} onChange={(e) => setStepsText(e.target.value)} placeholder="9000" />
            </Field>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-quiet flex-1" disabled={num(active) <= 0} onClick={saveManual}>
              {t('Save')}
            </button>
            {device && (
              <button
                className="btn btn-quiet text-over"
                onClick={() => {
                  setDeviceDay(date, null)
                  setActive('')
                  setStepsText('')
                  setMessage('')
                }}
              >
                {t('Remove')}
              </button>
            )}
          </div>
        </Card>

        <div>
          <button className="flex w-full items-center justify-between py-2 font-display text-lg font-semibold" onClick={() => setGuide(!guide)} aria-expanded={guide}>
            {t('How to set up the shortcut')}
            <Icon name={guide ? 'up' : 'down'} className="h-5 w-5 text-muted" />
          </button>
          {guide && <WatchGuide />}
        </div>
      </div>
    </Sheet>
  )
}
