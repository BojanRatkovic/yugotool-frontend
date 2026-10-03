import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'

import { env } from '@/config/env'
import { persister } from '@/lib/persister'
import { CACHE_MAX_AGE, queryClient } from '@/lib/query-client'

/**
 * Hydrated queries skip their zod parse, so a cache written under an older
 * contract would hand components the wrong shape. Keying the cache on the
 * contracts source discards it whenever any schema changes.
 */
const contractsSource = Object.values(
  import.meta.glob<string>('/src/lib/contracts.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
).join('')
const CACHE_BUSTER = `v3-${hash(contractsSource)}`

/** FNV-1a, base 36 — short and stable; not for security. */
function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      // next-themes renders an inline anti-flash <script> meant for SSR; in this
      // client-only app it never runs and React 19 warns about it. A data-block
      // type keeps it inert and silences the warning.
      scriptProps={{ type: 'application/json' }}
    >
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: CACHE_BUSTER }}
      >
        {children}
        {env.DEVTOOLS ? (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        ) : null}
      </PersistQueryClientProvider>
    </ThemeProvider>
  )
}
