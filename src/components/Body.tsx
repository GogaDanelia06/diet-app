import { useEffect, useState } from 'react'
import { t } from '../lib/i18n'
import { dateKey, shortDate, uid } from '../lib/date'
import { num } from '../lib/format'
import { photoToJpegBase64 } from '../lib/image'
import { loadPhoto, useStore } from '../lib/store'
import type { BodyLog, BodyPart, PhotoMeta } from '../lib/types'
import { Card, ErrorNote, Field, Icon, Sheet } from './ui'

const PARTS: { id: BodyPart; label: string; unit: string }[] = [
  { id: 'waist', label: 'Waist', unit: 'cm' },
  { id: 'hips', label: 'Hips', unit: 'cm' },
  { id: 'chest', label: 'Chest', unit: 'cm' },
  { id: 'arm', label: 'Upper arm', unit: 'cm' },
  { id: 'thigh', label: 'Thigh', unit: 'cm' },
  { id: 'neck', label: 'Neck', unit: 'cm' },
  { id: 'bodyFat', label: 'Body fat', unit: '%' },
]

/** First and latest value of each measurement, for showing change over time. */
function firstAndLast(logs: BodyLog[], part: BodyPart) {
  const withValue = logs.filter((l) => l[part] != null)
  if (!withValue.length) return null
  return { first: withValue[0][part]!, last: withValue.at(-1)![part]!, since: withValue[0].date }
}

export default function BodySection() {
  return (
    <>
      <Measurements />
      <Photos />
    </>
  )
}

function Measurements() {
  const logs = useStore((s) => s.measurements)
  const [open, setOpen] = useState(false)
  const shown = PARTS.map((p) => ({ ...p, v: firstAndLast(logs, p.id) })).filter((p) => p.v)

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{t('Body measurements')}</h2>
        <button className="text-sm font-medium text-accent" onClick={() => setOpen(true)}>
          {logs.length ? t('Update') : t('Add')}
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          {t('The scale doesn’t show everything. Measure your waist every couple of weeks; it often shrinks even when weight stalls.')}
        </p>
      ) : (
        <dl className="mt-2 divide-y divide-line">
          {shown.map((p) => {
            const diff = p.v!.last - p.v!.first
            return (
              <div key={p.id} className="flex items-center justify-between py-2">
                <dt className="text-muted">{t(p.label)}</dt>
                <dd className="flex items-baseline gap-3">
                  {Math.abs(diff) >= 0.1 && (
                    <span className={`num text-sm ${diff < 0 ? 'text-accent' : 'text-muted'}`}>
                      {diff < 0 ? '−' : '+'}
                      {Math.abs(diff).toFixed(1)}
                    </span>
                  )}
                  <span className="num font-semibold">
                    {p.v!.last} {p.unit}
                  </span>
                </dd>
              </div>
            )
          })}
        </dl>
      )}
      {shown.length > 0 && logs.length > 1 && <p className="mt-1 text-xs text-muted">{t('Change since {date}', { date: shortDate(logs[0].date) })}</p>}
      {open && <MeasureSheet onClose={() => setOpen(false)} />}
    </Card>
  )
}

function MeasureSheet({ onClose }: { onClose: () => void }) {
  const logs = useStore((s) => s.measurements)
  const logMeasurements = useStore((s) => s.logMeasurements)
  const latest = logs.at(-1)
  const today = logs.find((l) => l.date === dateKey())
  const [vals, setVals] = useState<Record<BodyPart, string>>(
    () => Object.fromEntries(PARTS.map((p) => [p.id, today?.[p.id] != null ? String(today[p.id]) : ''])) as Record<BodyPart, string>,
  )

  function save() {
    const log: BodyLog = { date: dateKey() }
    for (const p of PARTS) if (num(vals[p.id]) > 0) log[p.id] = Math.round(num(vals[p.id]) * 10) / 10
    logMeasurements(log)
    onClose()
  }

  return (
    <Sheet title={t('Measurements')} onClose={onClose} footer={<button className="btn btn-primary w-full text-lg" onClick={save}>{t('Save')}</button>}>
      <div className="space-y-4">
        <p className="text-sm text-muted">{t('Measure in the morning, over bare skin, with the tape snug but not tight. Fill in only what you want to track.')}</p>
        <div className="grid grid-cols-2 gap-3">
          {PARTS.map((p) => (
            <Field key={p.id} label={`${t(p.label)}, ${p.unit}`} hint={latest?.[p.id] != null ? t('Last: {v}', { v: latest[p.id]! }) : undefined}>
              <input
                className="field num"
                inputMode="decimal"
                value={vals[p.id]}
                onChange={(e) => setVals({ ...vals, [p.id]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      </div>
    </Sheet>
  )
}

function Photos() {
  const photos = useStore((s) => s.photos)
  const addPhoto = useStore((s) => s.addPhoto)
  const [viewing, setViewing] = useState<PhotoMeta | null>(null)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState('')

  async function add(file: File) {
    setError('')
    try {
      const { dataUrl } = await photoToJpegBase64(file, 1000)
      await addPhoto({ id: uid(), date: dateKey() }, dataUrl)
    } catch {
      setError(t('That photo could not be saved. Try another one.'))
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{t('Progress photos')}</h2>
        {photos.length >= 2 && (
          <button className="text-sm font-medium text-accent" onClick={() => setComparing(true)}>
            {t('Compare')}
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">{t('Private: photos stay on this phone and aren’t in backups.')}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <button key={p.id} onClick={() => setViewing(p)} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-2">
            <PhotoImg id={p.id} alt={t('Progress photo from {date}', { date: shortDate(p.date) })} />
            <span className="absolute inset-x-0 bottom-0 bg-black/45 px-1.5 py-0.5 text-[11px] font-medium text-white">{shortDate(p.date)}</span>
          </button>
        ))}
        <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-sm text-muted">
          <Icon name="camera" className="h-6 w-6 text-accent" />
          {t('Add photo')}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && add(e.target.files[0])} />
        </label>
      </div>
      {error && <div className="mt-2"><ErrorNote>{error}</ErrorNote></div>}
      {viewing && <PhotoViewer photo={viewing} onClose={() => setViewing(null)} />}
      {comparing && <CompareSheet onClose={() => setComparing(false)} />}
    </Card>
  )
}

function PhotoImg({ id, alt, className = 'h-full w-full object-cover' }: { id: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    let alive = true
    loadPhoto(id).then((d) => alive && setSrc(d))
    return () => {
      alive = false
    }
  }, [id])
  return src ? <img src={src} alt={alt} className={className} /> : null
}

function PhotoViewer({ photo, onClose }: { photo: PhotoMeta; onClose: () => void }) {
  const removePhoto = useStore((s) => s.removePhoto)
  return (
    <Sheet
      title={shortDate(photo.date)}
      onClose={onClose}
      footer={
        <button
          className="btn btn-quiet w-full text-over"
          onClick={() => {
            if (confirm(t('Delete this photo?'))) {
              removePhoto(photo.id)
              onClose()
            }
          }}
        >
          {t('Delete photo')}
        </button>
      }
    >
      <PhotoImg id={photo.id} alt={t('Progress photo from {date}', { date: shortDate(photo.date) })} className="w-full rounded-2xl" />
    </Sheet>
  )
}

function CompareSheet({ onClose }: { onClose: () => void }) {
  const photos = useStore((s) => s.photos)
  const weights = useStore((s) => s.weights)
  const [a, setA] = useState(photos[0].id)
  const [b, setB] = useState(photos.at(-1)!.id)
  const weightOn = (date: string) => [...weights].reverse().find((w) => w.date <= date)?.kg

  return (
    <Sheet title={t('Compare')} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        {[
          [a, setA],
          [b, setB],
        ].map(([id, set], i) => {
          const meta = photos.find((p) => p.id === id)!
          const w = weightOn(meta.date)
          return (
            <div key={i} className="space-y-2">
              <div className="aspect-[3/4] overflow-hidden rounded-xl bg-surface-2">
                <PhotoImg id={id as string} alt={t('Progress photo from {date}', { date: shortDate(meta.date) })} />
              </div>
              <select className="field text-base" value={id as string} onChange={(e) => (set as (v: string) => void)(e.target.value)} aria-label={i ? t('After photo') : t('Before photo')}>
                {photos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {shortDate(p.date)}
                  </option>
                ))}
              </select>
              {w && <p className="num text-center text-sm text-muted">{w} kg</p>}
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
