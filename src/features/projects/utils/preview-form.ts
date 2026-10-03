import { previewSchema, type Preview } from '@/lib/contracts'

export interface EnvRow {
  key: string
  value: string
}

/** What the settings form edits: strings everywhere, env as ordered rows. */
export interface PreviewValues {
  install: string
  start: string
  readyPath: string
  readyTimeoutSec: string
  env: EnvRow[]
  baseUrlPath: string
  themeInit: string
}

export type PreviewField = keyof PreviewValues

export const PREVIEW_DEFAULTS: PreviewValues = {
  install: '',
  start: '',
  readyPath: '/',
  readyTimeoutSec: '120',
  env: [],
  baseUrlPath: '/',
  themeInit: '',
}

export function toPreviewValues(preview: Preview | null): PreviewValues {
  if (preview === null) return { ...PREVIEW_DEFAULTS, env: [] }
  return {
    install: preview.install ?? '',
    start: preview.start,
    readyPath: preview.readyPath,
    readyTimeoutSec: String(preview.readyTimeoutSec),
    env: Object.entries(preview.env).map(([key, value]) => ({ key, value })),
    baseUrlPath: preview.baseUrlPath,
    themeInit: preview.themeInit ?? '',
  }
}

const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/

export type PreviewParse =
  | { ok: true; preview: Preview }
  | { ok: false; errors: Partial<Record<PreviewField, string>> }

/** Form values → the API's preview config, or one message per broken field. */
export function parsePreviewValues(values: PreviewValues): PreviewParse {
  const errors: Partial<Record<PreviewField, string>> = {}
  const env: Record<string, string> = {}
  for (const row of values.env) {
    const key = row.key.trim()
    if (key === '' && row.value === '') continue
    if (!ENV_KEY.test(key)) {
      errors.env = `“${key || '(empty)'}” isn’t a valid variable name.`
      break
    }
    if (key in env) {
      errors.env = `${key} is set twice.`
      break
    }
    env[key] = row.value
  }

  const timeout = Number(values.readyTimeoutSec.trim())
  const result = previewSchema.safeParse({
    install: values.install.trim() === '' ? null : values.install,
    start: values.start,
    readyPath: values.readyPath,
    readyTimeoutSec: values.readyTimeoutSec.trim() === '' ? undefined : timeout,
    env,
    baseUrlPath: values.baseUrlPath,
    themeInit: values.themeInit.trim() === '' ? null : values.themeInit,
  })
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0]
      if (!isPreviewField(field) || errors[field] !== undefined) continue
      errors[field] = issueMessage(field, issue.code)
    }
  }
  if (Object.keys(errors).length > 0 || !result.success) return { ok: false, errors }
  return { ok: true, preview: result.data }
}

function isPreviewField(value: unknown): value is PreviewField {
  return typeof value === 'string' && Object.hasOwn(PREVIEW_DEFAULTS, value)
}

function issueMessage(field: PreviewField, code: string): string {
  if (field === 'start') return 'Required — the command that serves the app.'
  if (field === 'readyPath' || field === 'baseUrlPath') return 'Must start with “/”.'
  if (field === 'readyTimeoutSec') return 'A whole number of seconds, 5–900.'
  if (field === 'themeInit') return 'At most 2,000 characters.'
  return code === 'too_small' ? 'Required.' : 'Invalid value.'
}

/**
 * A detected preview applied over the current form values. Commands, paths and
 * the timeout come from the detection; env rows and the init script are kept
 * (detection never proposes them), with detected env keys replacing same-named rows.
 */
export function applyDetectedPreview(current: PreviewValues, detected: Preview): PreviewValues {
  const next = toPreviewValues(detected)
  const detectedKeys = new Set(next.env.map((row) => row.key))
  const kept = current.env.filter((row) => !detectedKeys.has(row.key.trim()))
  return {
    ...next,
    env: [...kept, ...next.env],
    themeInit: detected.themeInit === null ? current.themeInit : next.themeInit,
  }
}
