/**
 * "github.com/owner/repo" from an origin URL (https, ssh or scp-style);
 * anything unrecognised comes back unchanged.
 */
export function originLabel(origin: string): string {
  const trimmed = origin.trim()
  const scp = /^[\w.-]+@([^:/]+):(.+)$/.exec(trimmed)
  let host: string
  let path: string
  if (scp !== null) {
    host = scp[1] ?? ''
    path = scp[2] ?? ''
  } else {
    try {
      const url = new URL(trimmed)
      host = url.hostname
      path = url.pathname
    } catch {
      return trimmed
    }
  }
  return `${host}/${path
    .replace(/^\/+/, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')}`
}
