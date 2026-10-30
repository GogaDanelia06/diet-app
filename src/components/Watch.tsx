import { useState } from 'react'
import { dateKey, dayLabel } from '../lib/date'
import { kcal, num } from '../lib/format'
import { applyHealthText } from '../lib/healthImport'
import { isNativeApp, syncAppleHealth, type HealthDay } from '../lib/nativeHealth'
import { locale, t } from '../lib/i18n'
import { dayBurn, useStore } from '../lib/store'
import { Card, ErrorNote, Field, Icon, Sheet } from './ui'

/** Opens the Shortcuts app and runs the shortcut the guide below builds. */
export const RUN_SHORTCUT_URL = 'shortcuts://run-shortcut?name=Plate'

const GUIDE_STEPS = [
  'Open the Shortcuts app and tap + to make a new shortcut. Name it Plate.',
  'Add the action Find Health Samples. Set Type to Active Energy and add the filter Start Date is Today. Add a second filter Source is your Apple Watch, so nothing is counted twice.',
  'Add Calculate Statistics and choose Sum.',
  'Add Find Health Samples again with Type Steps, Start Date is Today and Source your Apple Watch, then another Calculate Statistics with Sum.',
  'Optional, for a smart scale: add Find Health Samples with Type Weight, Start Date is Today and Limit 1.',
  'Add Text and type plate date= then insert Current Date (tap it, choose Custom format and type yyyy-MM-dd). Then type a space, active= and the first Statistics result, a space, steps= and the second Statistics result. If you added weight, type a space, weight= and the Health Samples result.',
  'Add Copy to Clipboard.',
  'Add URL Encode. It encodes the same Text.',
  'Add another Text: paste the link below, then insert URL Encoded Text right after it.',
  'Add Open URLs and tap Done.',
]

// The shortcut opens Plate with the numbers in the link, so opening Plate through it is the sync.
const AUTO_STEPS = [
  'Put the shortcut on your Home Screen: in Shortcuts, long-press Plate, then Share → Add to Home Screen. For the picture, use the Plate logo below.',
  'From now on, open Plate with that icon. Each time, today’s steps and calories come in by themselves, with nothing to tap or paste.',
  'Moving from the old Plate icon? In it, open Me → Backup → Save backup. Then open Plate with the new icon, go to Me → Backup → Restore and pick that file. After that you can remove the old icon.',
  'Each opening adds a Safari tab. In Settings → Apps → Safari → Close Tabs, choose After One Day so old tabs tidy themselves away.',
]

/** "8,412 steps · 512 active kcal · 1 workout" for a day read from Apple Health. */
function healthSummary(day: HealthDay) {
  return [
    t('{n} steps', { n: day.steps.toLocaleString(locale()) }),
    t('{n} active kcal', { n: kcal(day.activeKcal) }),
    day.workouts.length > 0 && t(day.workouts.length === 1 ? '1 workout' : '{n} workouts', { n: day.workouts.length }),
  ].filter(Boolean).join(' · ')
}

/** Reads Apple Health now in the iPhone app; the message says what came in or what went wrong. */
async function updateNow(date: string) {
  try {
    const day = await syncAppleHealth([date])
    return day ? t('Updated: {what}', { what: healthSummary(day) }) : t('Apple Health isn’t available on this device.')
  } catch {
    return t('Apple Health couldn’t be read. Check Plate’s access in Settings → Health → Data Access & Devices.')
  }
}

/** The Today page's Health line: automatic in the iPhone app, a one-tap Shortcut import on the website. */
export function HealthSync(props: { date: string; onSetup: () => void }) {
  return isNativeApp() ? <AppHealthSync date={props.date} /> : <ShortcutHealthSync {...props} />
}

/** In the iPhone app Health is read by itself; this shows when, and refreshes on a tap. */
function AppHealthSync({ date }: { date: string }) {
  const device = useStore((s) => s.deviceActivity[date])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  return (
    <>
      <button
        type="button"
        className="text-action"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setNote(await updateNow(date))
          setBusy(false)
        }}
      >
        <Icon name="watch" className="h-4 w-4" />
        {t(busy ? 'Updating…' : 'Apple Health')}
      </button>
      {device?.source === 'health' && !note && (
        <span className="text-xs text-muted">{t('Updated {time}', { time: new Date(device.at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) })}</span>
      )}
      {note && <p className="basis-full text-sm font-semibold text-accent" role="status">{note}</p>}
    </>
  )
}

/** The website's one-tap sync: reads what the Plate shortcut copied and saves it. */
function ShortcutHealthSync({ date, onSetup }: { date: string; onSetup: () => void }) {
  const device = useStore((s) => s.deviceActivity[date])
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  // Nothing synced for the day yet, or not in the last two hours: the button asks for a tap.
  const stale = date === dateKey() && (!device || device.source !== 'health' || Date.now() - device.at > 2 * 3_600_000)

  async function sync() {
    let text: string
    try {
      text = await navigator.clipboard.readText()
    } catch {
      // Clipboard reading can be blocked; the sheet lets the user paste instead.
      onSetup()
      return
    }
    const r = applyHealthText(text, date)
    setResult(r ? { ok: true, text: t('Synced {day}: {what}', { day: dayLabel(r.day), what: r.summary }) } : { ok: false, text: '' })
  }

  return (
    <>
      <button type="button" onClick={sync} className={`text-action ${stale ? 'sync-due' : ''}`}>
        <Icon name="watch" className="h-4 w-4" />
        {t('Sync Health')}
      </button>
      {device?.source === 'health' && !result && (
        <span className="text-xs text-muted">{t('Synced {time}', { time: new Date(device.at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) })}</span>
      )}
      {result?.ok && <p className="basis-full text-sm font-semibold text-accent" role="status">{result.text}</p>}
      {result && !result.ok && (
        <p className="basis-full text-sm text-muted" role="status">
          {t('Nothing from the Plate shortcut is copied yet.')}{' '}
          <a href={RUN_SHORTCUT_URL} className="font-semibold text-accent">{t('Run the Plate shortcut')}</a>
          {', '}{t('then tap Sync Health again.')}{' '}
          <button type="button" onClick={onSetup} className="font-semibold text-accent underline">{t('Set it up')}</button>
        </p>
      )}
    </>
  )
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">{i + 1}</span>
          <span>{t(s)}</span>
        </li>
      ))}
    </ol>
  )
}

export function WatchGuide() {
  // Wherever Plate is hosted, the shortcut opens this same page.
  const page = `${window.location.origin}${window.location.pathname}`
  const link = `${page}#health=`
  const logo = new URL('apple-touch-icon-180x180.png', page).href
  return (
    <div className="space-y-4">
      <p className="text-muted">
        {t('iPhone doesn’t let web apps read Apple Health, so a small Shortcut copies today’s numbers and Plate imports them. You set it up once.')}
      </p>
      <Steps steps={GUIDE_STEPS} />
      <div className="space-y-2 rounded-2xl bg-white/[0.05] p-3 text-sm">
        <p className="text-muted">{t('The Text should read:')}</p>
        <p className="font-mono">plate date=2026-10-29 active=640 steps=9123 weight=89.4 kg</p>
        <p className="text-muted">{t('The link for step 9:')}</p>
        <p className="break-all font-mono text-accent">{link}</p>
      </div>
      <div className="space-y-3 rounded-2xl border border-line p-3">
        <h4 className="font-semibold">{t('Make it automatic')}</h4>
        <Steps steps={AUTO_STEPS} />
        <a href={logo} target="_blank" rel="noreferrer" className="btn btn-quiet w-full">{t('Open the Plate logo to save it')}</a>
        <p className="text-sm text-muted">{t('Workouts count through your Apple Watch’s active calories, so a harder workout raises your budget by itself.')}</p>
        <p className="text-sm text-muted">{t('Safari can clear a website’s data if you don’t open it for a week, so open Plate every few days and save a backup in Me now and then.')}</p>
      </div>
      <div className="rounded-2xl border border-line p-3">
        <h4 className="mb-1 font-semibold">WHOOP</h4>
        <p className="text-sm text-muted">
          {t('In the WHOOP app’s settings, open Integrations → Apple Health and turn sharing on. WHOOP shares the calories of workouts it detects, not your steps or all-day calories. If you also wear the Apple Watch, keep the Source filters on Apple Watch so nothing is counted twice. If you only wear WHOOP, leave out Active Energy, choose your iPhone as the Source for Steps, and add WHOOP workouts with Add exercise.')}
        </p>
      </div>
    </div>
  )
}

export default function WatchSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const st = useStore()
  const setDeviceDay = useStore((s) => s.setDeviceDay)
  const burn = dayBurn(st, date)
  const device = st.deviceActivity[date]
  const [active, setActive] = useState(device ? String(device.activeKcal) : '')
  const [steps, setStepsText] = useState(device?.steps != null ? String(device.steps) : '')
  const [paste, setPaste] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [guide, setGuide] = useState(!device)
  const native = isNativeApp()

  function apply(text: string) {
    const r = applyHealthText(text, date)
    if (!r) {
      setError(t('Nothing from the Plate shortcut is copied. Run the shortcut first, then tap Import.'))
      return
    }
    const saved = useStore.getState().deviceActivity[r.day]
    if (saved) {
      setActive(String(saved.activeKcal))
      if (saved.steps != null) setStepsText(String(saved.steps))
    }
    setError('')
    setPaste(null)
    setMessage(t('Synced {day}: {what}', { day: dayLabel(r.day), what: r.summary }))
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
    <Sheet title={t(native ? 'Apple Health' : 'Apple Watch & WHOOP')} onClose={onClose}>
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

        {native ? (
          <>
            <p className="text-muted">{t('Plate reads Apple Health by itself whenever you open it: steps, active calories, workouts and weight. WHOOP workouts come in too when WHOOP shares them with Apple Health.')}</p>
            <button
              className="btn btn-primary w-full text-lg"
              onClick={async () => {
                setError('')
                setMessage(await updateNow(date))
              }}
            >
              <Icon name="watch" className="h-5 w-5" /> {t('Update now')}
            </button>
            <p className="text-sm text-muted">{t('Nothing coming in? Allow Plate in Settings → Health → Data Access & Devices.')}</p>
          </>
        ) : (
          <>
            <button className="btn btn-primary w-full text-lg" onClick={importClipboard}>
              <Icon name="watch" className="h-5 w-5" /> {t('Sync Health')}
            </button>
            <a href={RUN_SHORTCUT_URL} className="btn btn-quiet w-full">{t('Run the Plate shortcut')}</a>
          </>
        )}
        {paste !== null && (
          <div className="space-y-2">
            <Field label={t('Paste what the shortcut copied')}>
              <textarea className="field min-h-20 font-mono" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="plate date=2026-10-29 active=640 steps=9123" />
            </Field>
            <button className="btn btn-quiet w-full" disabled={!paste.trim()} onClick={() => apply(paste)}>
              {t('Import')}
            </button>
          </div>
        )}
        {message && <p className="text-sm font-semibold text-accent" role="status">{message}</p>}
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

        {!native && <div>
          <button className="flex w-full items-center justify-between py-2 font-display text-lg font-semibold" onClick={() => setGuide(!guide)} aria-expanded={guide}>
            {t('How to set up the shortcut')}
            <Icon name={guide ? 'up' : 'down'} className="h-5 w-5 text-muted" />
          </button>
          {guide && <WatchGuide />}
        </div>}
      </div>
    </Sheet>
  )
}
