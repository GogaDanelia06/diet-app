import { useEffect, type ReactNode } from 'react'

export function Sheet({
  title,
  onClose,
  children,
  footer,
  action,
  closeLabel = 'Close',
}: {
  closeLabel?: string
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  action?: ReactNode
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg sheet-in" role="dialog" aria-modal="true" aria-label={title}>
      <div className="safe-top border-b border-line bg-bg">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 pb-3">
          <button onClick={onClose} className="-ml-2 rounded-full px-2 py-1 text-accent font-medium">
            {closeLabel}
          </button>
          <h2 className="flex-1 truncate text-center font-display text-lg font-semibold">{title}</h2>
          <div className="min-w-[52px] text-right">{action}</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-lg px-4 py-4">{children}</div>
      </div>
      {footer && (
        <div className="safe-bottom border-t border-line bg-surface">
          <div className="mx-auto max-w-lg px-4 pt-3">{footer}</div>
        </div>
      )}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[20px] bg-surface p-4 ${className}`}>{children}</section>
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-[14px] bg-surface-2 p-1 border border-line" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-[10px] px-2 py-2 text-sm font-medium ${
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between gap-1 text-xs">
        <span className="font-medium">{label}</span>
        <span className="num text-muted">
          {Math.round(value)}/{target}g
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-surface-2">
        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-over/30 bg-over/10 px-3 py-2 text-sm text-over">{children}</p>
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-6 text-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </div>
  )
}

export function Icon({ name, className = 'h-5 w-5' }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

const ICONS = {
  plus: <path d="M12 5v14M5 12h14" />,
  today: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 7.5 10.8" strokeWidth="3" />
    </>
  ),
  chart: <path d="M4 19h16M6 15l4-4 3 3 5-6" />,
  chat: <path d="M5 18l-1 3 4-2h9a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v9" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  barcode: <path d="M4 6v12M7 6v12M10 6v12M14 6v12M17 6v12M20 6v12" />,
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
  bolt: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  book: <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10" />,
  star: <path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6-5-2.9-5 2.9 1.2-5.6L4 9.6 9.6 9z" />,
  trash: <path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" />,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  run: (
    <>
      <circle cx="14" cy="4.5" r="1.8" />
      <path d="M8 21l3-6 3 2v4M6 12l3-3h4l2 4 3 1M11 9l-1 5" />
    </>
  ),
  copy: <path d="M8 8h11v11H8zM5 16V5h11" />,
  check: <path d="M5 12l4 4 10-10" />,
} as const
