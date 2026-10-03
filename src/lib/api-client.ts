import { z } from 'zod'

import { env } from '@/config/env'

/** Normalized error every fetcher rejects with. Mirrors the API's error body. */
export class ApiError extends Error {
  readonly status: number | null
  /** Machine-readable code from `{ error: { code } }`, e.g. `work_order_not_found`. */
  readonly code: string | null
  readonly requestId: string | null
  /** Raw `error.details` — for validation errors, the list of issues. */
  readonly details: unknown

  constructor(
    message: string,
    status: number | null,
    options?: {
      cause?: unknown
      code?: string | null
      requestId?: string | null
      details?: unknown
    },
  ) {
    super(message, { cause: options?.cause })
    this.name = 'ApiError'
    this.status = status
    this.code = options?.code ?? null
    this.requestId = options?.requestId ?? null
    this.details = options?.details ?? null
  }
}

/** `{ error: { code, message, details, requestId } }` — every field optional here. */
const errorBodySchema = z.object({
  error: z
    .object({
      code: z.string().optional(),
      message: z.string().optional(),
      requestId: z.string().optional(),
      details: z.unknown().optional(),
    })
    .optional(),
})

async function toApiError(response: Response): Promise<ApiError> {
  let json: unknown = null
  try {
    json = await response.json()
  } catch {
    // Non-JSON body (e.g. the dev proxy's 502 when the API is down).
  }
  const body = errorBodySchema.safeParse(json).data?.error
  const message =
    body?.message ??
    (response.status >= 500
      ? 'The ZASTAVA API is unreachable or failed.'
      : `Request failed (${response.status}).`)
  return new ApiError(message, response.status, {
    code: body?.code ?? null,
    requestId: body?.requestId ?? null,
    details: body?.details,
  })
}

/** Resolves to the raw JSON body; fetchers parse it with the contract schemas. */
async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${env.API_URL}${path}`, {
      method,
      headers:
        body === undefined
          ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    throw new ApiError('Network error — the API is unreachable.', null, { cause: error })
  }
  if (!response.ok) throw await toApiError(response)
  return readBody(response)
}

/**
 * JSON body, or undefined when there is none (204, or a 202/200 with an empty
 * body — the shift signals answer 202 with nothing).
 */
async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined
  const text = await response.text()
  if (text.trim() === '') return undefined
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    throw new ApiError('The API sent a response that isn’t valid JSON.', response.status, {
      cause: error,
    })
  }
}

/** The one HTTP client. No ad-hoc fetch in components. */
export const apiClient = {
  get: (path: string) => request('GET', path),
  post: (path: string, body?: unknown) => request('POST', path, body ?? {}),
  patch: (path: string, body: unknown) => request('PATCH', path, body),
  put: (path: string, body: unknown) => request('PUT', path, body),
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

const issueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])).optional(),
  message: z.string(),
})

/**
 * Validation issues from an API error, as "path: message" lines. Accepts the
 * shapes nestjs-zod and domain errors produce (`details.errors`,
 * `details.issues`, or a bare array); anything else yields [].
 */
export function errorIssues(error: unknown): string[] {
  if (!(error instanceof ApiError)) return []
  const details = error.details
  const candidates: unknown[] = [details]
  if (typeof details === 'object' && details !== null) {
    if ('errors' in details) candidates.push(details.errors)
    if ('issues' in details) candidates.push(details.issues)
  }
  for (const candidate of candidates) {
    const parsed = issueSchema.array().safeParse(candidate)
    if (parsed.success && parsed.data.length > 0) {
      return parsed.data.map((issue) =>
        issue.path === undefined || issue.path.length === 0
          ? issue.message
          : `${issue.path.join('.')}: ${issue.message}`,
      )
    }
  }
  return []
}
