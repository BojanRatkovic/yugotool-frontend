import { z } from 'zod'

// The single place that reads import.meta.env — everything else imports `env`.
const envSchema = z.object({
  DEV: z.boolean(),
  VITE_API_URL: z.string().default('/api'),
})

const parsed = envSchema.parse(import.meta.env)

export const env = {
  DEV: parsed.DEV,
  API_URL: parsed.VITE_API_URL,
  /** TanStack devtools only in dev and only on request (`?devtools=1`) — they cover content. */
  DEVTOOLS:
    parsed.DEV &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('devtools') === '1',
}
