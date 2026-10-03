const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** `$0.18`. Sub-cent spend keeps a third digit so it never reads as free. */
export function formatUsd(value: number): string {
  if (value > 0 && value < 0.01) return `$${value.toFixed(3)}`
  return usd.format(value)
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** "12 Aug, 14:03" — absolute, for tooltips and anything older than a day. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "1.2s", "48s", "3m 12s", "1h 04m". */
export function formatDuration(ms: number): string {
  if (ms < 0) return '0s'
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

export function durationBetween(
  startIso: string,
  endIso: string | null,
  now = Date.now(),
): number {
  const end = endIso === null ? now : new Date(endIso).getTime()
  return end - new Date(startIso).getTime()
}

/** "2 min ago", "3 h ago"; older than a day falls back to the absolute date. */
export function formatRelative(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return formatDateTime(iso)
}

/** "34.2k", "200k", "1.2M". */
export function formatTokens(value: number): string {
  if (value < 1000) return String(value)
  if (value < 1_000_000) {
    const k = value / 1000
    return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`
  }
  return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
}

/** Last path segment: the repo's folder name. */
export function basename(path: string): string {
  return path.replace(/\/+$/, '').split('/').at(-1) ?? path
}

/** "~/code/app" for paths under a macOS or Linux home folder; others unchanged. */
export function tildePath(path: string): string {
  return path.replace(/^\/(?:Users|home)\/[^/]+(?=\/|$)/, '~')
}
