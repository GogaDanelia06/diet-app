import { useState } from 'react'
import { weeklyReport } from '../lib/ai'
import { dateKey, shortDate, uid } from '../lib/date'
import { t } from '../lib/i18n'
import { weekForReport } from '../lib/report'
import { useStore, useTargets } from '../lib/store'
import type { WeeklyReport } from '../lib/types'
import { Card, ErrorNote, Icon, Spinner } from './ui'

const DAY = 86_400_000

/** True when the last report is a week old (or missing) and there's enough to review. */
export function useReportDue() {
  const reports = useStore((s) => s.reports)
  const entries = useStore((s) => s.entries)
  const hasKey = useStore((s) => !!s.settings.geminiKey)
  const last = reports[0]?.createdAt ?? 0
  const recent = new Set(entries.filter((e) => e.date > dateKey(new Date(Date.now() - 7 * DAY))).map((e) => e.date)).size
  return hasKey && Date.now() - last > 6.5 * DAY && recent >= 3
}

export default function WeeklyReportView() {
  const reports = useStore((s) => s.reports)
  const addReport = useStore((s) => s.addReport)
  const settings = useStore((s) => s.settings)
  const targets = useTargets()!
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [shown, setShown] = useState(0)
  const today = dateKey()
  const { loggedDays } = weekForReport(useStore.getState(), targets, today)

  async function make() {
    setLoading(true)
    setError('')
    try {
      const { text } = weekForReport(useStore.getState(), targets, today)
      const r = await weeklyReport({ key: settings.geminiKey, model: settings.geminiModel }, text)
      addReport({ id: uid(), createdAt: Date.now(), weekEnd: today, ...r })
      setShown(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('The report could not be made. Try again.'))
    } finally {
      setLoading(false)
    }
  }

  const report = reports[shown]

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-2xl font-semibold">{t('Weekly report')}</h2>
        <p className="mt-1 text-muted">{t('The AI reviews your last 7 days of food, weight and exercise and gives you three things to do next week.')}</p>
      </div>
      {loading ? (
        <Spinner label={t('Reading your week…')} />
      ) : (
        <button className="btn btn-primary w-full text-lg" onClick={make} disabled={loggedDays === 0}>
          <Icon name="sparkle" className="h-5 w-5" /> {t("Review this week")}
        </button>
      )}
      {loggedDays > 0 && loggedDays < 3 && <p className="text-sm text-muted">{t('Only {n} days logged this week, so the review will be rough.', { n: loggedDays })}</p>}
      {loggedDays === 0 && <p className="text-sm text-muted">{t('Log some food this week first.')}</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
      {report && <ReportCard report={report} />}
      {reports.length > 1 && (
        <Card>
          <h3 className="mb-1 font-medium text-muted">{t('Earlier reports')}</h3>
          <ul className="divide-y divide-line">
            {reports.map((r, i) => (
              <li key={r.id}>
                <button className={`flex w-full items-center justify-between py-2.5 text-left ${i === shown ? 'text-accent' : ''}`} onClick={() => setShown(i)}>
                  <span>{t('Week to {date}', { date: shortDate(r.weekEnd) })}</span>
                  <span className="num font-semibold">{r.score}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 40
  const c = 2 * Math.PI * r
  const color = score >= 75 ? 'var(--accent)' : score >= 50 ? 'var(--carbs)' : 'var(--over)'
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-3xl font-bold">{score}</span>
        <span className="text-[10px] text-muted">/ 100</span>
      </div>
    </div>
  )
}

export function ReportCard({ report }: { report: WeeklyReport }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-4">
        <ScoreRing score={report.score} />
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted">{t('Week to {date}', { date: shortDate(report.weekEnd) })}</div>
          <h3 className="font-display text-xl font-semibold leading-snug">{report.headline}</h3>
        </div>
      </div>
      <p>{report.summary}</p>
      {report.wins.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-sm font-semibold text-accent">{t('What went well')}</h4>
          <ul className="space-y-1.5">
            {report.wins.map((w, i) => (
              <li key={i} className="flex gap-2">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h4 className="mb-1.5 text-sm font-semibold text-carbs">{t('Try next week')}</h4>
        <ol className="space-y-2">
          {report.tips.map((tip, i) => (
            <li key={i} className="flex gap-3">
              <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-carbs/15 text-sm font-bold text-carbs">{i + 1}</span>
              <span>{tip}</span>
            </li>
          ))}
        </ol>
      </div>
      {report.focus && (
        <p className="rounded-2xl bg-accent-soft px-4 py-3">
          <span className="text-sm font-semibold text-accent">{t('Focus')}: </span>
          {report.focus}
        </p>
      )}
    </Card>
  )
}
