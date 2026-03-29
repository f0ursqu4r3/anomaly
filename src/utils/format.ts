/**
 * Format large numbers in a readable idle-game style.
 * e.g. 1234 → "1.23K", 1_500_000 → "1.50M"
 */
export function fmtNumber(n: number): string {
  if (n < 1_000) return Math.floor(n).toString()
  if (n < 1_000_000) return (n / 1_000).toFixed(2) + 'K'
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  return (n / 1_000_000_000).toFixed(2) + 'B'
}

/**
 * Format meters depth nicely.
 */
export function fmtDepth(m: number): string {
  if (m < 1000) return `${Math.floor(m)}m`
  return `${(m / 1000).toFixed(2)}km`
}

/**
 * Format ms duration as "3h 22m" style.
 */
export function fmtDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
