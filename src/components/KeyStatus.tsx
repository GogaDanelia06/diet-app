import type { ReactNode } from 'react'
import { Icon } from './ui'

/** Shows only the start and end of a key, enough to recognise it without revealing it. */
export const maskKey = (key: string) => (key.length > 10 ? `${key.slice(0, 4)}…${key.slice(-4)}` : '••••')

/** A saved-key summary: a check (or info) badge, what is set up, and actions such as Edit. */
export function KeyStatus({ title, detail, ready = true, children }: { title: string; detail?: string; ready?: boolean; children?: ReactNode }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-2.5 ${ready ? 'border-accent/25 bg-accent/[0.07]' : 'border-line bg-white/[0.03]'}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${ready ? 'bg-accent text-[var(--accent-ink)]' : 'bg-white/[0.08] text-muted'}`}>
        <Icon name={ready ? 'check' : 'globe'} className="h-4 w-4" />
      </span>
      {/* The text keeps enough width to read in one or two lines; on a narrow phone the buttons move to their own line. */}
      <span className="min-w-[10rem] flex-1">
        <span className="block font-semibold">{title}</span>
        {detail && <span className="block text-xs text-muted">{detail}</span>}
      </span>
      {children && <span className="ml-auto flex shrink-0 gap-2">{children}</span>}
    </div>
  )
}

/** The small buttons that sit inside a KeyStatus row. */
export function KeyAction({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" className="btn btn-quiet rounded-xl px-3 py-1.5 text-sm" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}
