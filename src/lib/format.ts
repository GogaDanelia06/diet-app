export const kcal = (n: number) => Math.round(n).toLocaleString()

export function grams(n: number) {
  if (n >= 10) return `${Math.round(n)} g`
  return `${Math.round(n * 10) / 10} g`
}

export function macro(n: number) {
  return n >= 10 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString()
}

export function kg(n: number) {
  return `${(Math.round(n * 10) / 10).toFixed(1)} kg`
}

/** Parses user-typed numbers, accepting a comma as the decimal separator. */
export function num(value: string): number {
  const n = parseFloat(value.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
