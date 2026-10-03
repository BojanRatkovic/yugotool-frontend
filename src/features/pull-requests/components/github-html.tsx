import { cn } from '@/lib/utils'

/** GitHub-relative links ("/o/r/pull/1") resolved to github.com. */
function absolute(href: string): string | null {
  try {
    const url = new URL(href, 'https://github.com')
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

/**
 * GitHub's own rendered markdown (`bodyHTML`, already sanitized by GitHub),
 * styled by `.gh-prose` for both themes. Links open outside the app; task
 * list checkboxes stay read-only (GitHub renders them disabled).
 */
export function GithubHtml({ html, className }: { html: string; className?: string }) {
  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- delegates clicks on the links inside; links stay keyboard-reachable
    <div
      className={cn('gh-prose', className)}
      onClick={(event) => {
        if (!(event.target instanceof Element)) return
        const anchor = event.target.closest('a[href]')
        const href = anchor?.getAttribute('href')
        if (href === null || href === undefined || href.startsWith('#')) return
        event.preventDefault()
        const url = absolute(href)
        if (url !== null) window.open(url, '_blank', 'noopener,noreferrer')
      }}
      // GitHub sanitizes bodyHTML server-side; this is the HTML github.com itself renders.
      // oxlint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
