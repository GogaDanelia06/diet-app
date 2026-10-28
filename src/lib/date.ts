const pad = (n: number) => String(n).padStart(2, '0')

export function dateKey(d: Date = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseKey(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, days: number) {
  const d = parseKey(key)
  d.setDate(d.getDate() + days)
  return dateKey(d)
}

export function dayLabel(key: string) {
  const today = dateKey()
  if (key === today) return 'Today'
  if (key === addDays(today, -1)) return 'Yesterday'
  if (key === addDays(today, 1)) return 'Tomorrow'
  return parseKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function shortDate(key: string) {
  return parseKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
