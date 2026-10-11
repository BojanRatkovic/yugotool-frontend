import { z } from 'zod'

import { updateSettingsSchema, type Settings, type UpdateSettings } from '@/lib/contracts'

/** Form shape: nullable strings edit as '' so inputs stay controlled. */
export interface SettingsValues {
  maxConcurrentRuns: number
  pauseAtFiveHourPct: number
  pauseAtWeeklyPct: number
  nightShiftStart: string
  nightShiftEnd: string
  appUrl: string
  desktopNotifications: boolean
  slackWebhookUrl: string
  telegramBotToken: string
  telegramChatId: string
  reposRoot: string
}

export function toSettingsValues(settings: Settings): SettingsValues {
  return {
    maxConcurrentRuns: settings.maxConcurrentRuns,
    pauseAtFiveHourPct: settings.pauseAtFiveHourPct,
    pauseAtWeeklyPct: settings.pauseAtWeeklyPct,
    nightShiftStart: settings.nightShiftStart,
    nightShiftEnd: settings.nightShiftEnd,
    appUrl: settings.appUrl,
    desktopNotifications: settings.desktopNotifications,
    slackWebhookUrl: settings.slackWebhookUrl ?? '',
    telegramBotToken: settings.telegramBotToken ?? '',
    telegramChatId: settings.telegramChatId ?? '',
    reposRoot: settings.reposRoot ?? '',
  }
}

const KEYS = [
  'maxConcurrentRuns',
  'pauseAtFiveHourPct',
  'pauseAtWeeklyPct',
  'nightShiftStart',
  'nightShiftEnd',
  'appUrl',
  'desktopNotifications',
  'slackWebhookUrl',
  'telegramBotToken',
  'telegramChatId',
  'reposRoot',
] as const satisfies readonly (keyof SettingsValues)[]

export type SettingsKey = (typeof KEYS)[number]

/** Settings → General's form: where repos live, the dispatcher, the night shift. */
export const GENERAL_KEYS = [
  'reposRoot',
  'maxConcurrentRuns',
  'pauseAtFiveHourPct',
  'pauseAtWeeklyPct',
  'nightShiftStart',
  'nightShiftEnd',
] as const satisfies readonly SettingsKey[]

/** Settings → Notifications' form: where notices go. */
export const CHANNEL_KEYS = [
  'appUrl',
  'desktopNotifications',
  'slackWebhookUrl',
  'telegramBotToken',
  'telegramChatId',
] as const satisfies readonly SettingsKey[]

/**
 * Remount key for a settings form: changes only when a field that form edits
 * (`keys`) changes on the server. Saving another page's fields, the API key or
 * a notification kind bumps `updatedAt` but not these, so it leaves an unsaved
 * draft alone.
 */
export function settingsFormKey(
  settings: Settings,
  keys: readonly SettingsKey[] = KEYS,
): string {
  const values = toSettingsValues(settings)
  return JSON.stringify(keys.map((key) => values[key]))
}

const NULLABLE = new Set<keyof SettingsValues>([
  'slackWebhookUrl',
  'telegramBotToken',
  'telegramChatId',
  'reposRoot',
])

function normalize(key: keyof SettingsValues, value: SettingsValues[keyof SettingsValues]) {
  if (!NULLABLE.has(key) || typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** Fields (of `keys`) whose normalized value differs from the saved settings. */
export function changedKeys(
  values: SettingsValues,
  saved: Settings,
  keys: readonly SettingsKey[] = KEYS,
): SettingsKey[] {
  const base = toSettingsValues(saved)
  return keys.filter((key) => normalize(key, values[key]) !== normalize(key, base[key]))
}

export function isSettingsDirty(
  values: SettingsValues,
  saved: Settings,
  keys: readonly SettingsKey[] = KEYS,
): boolean {
  return changedKeys(values, saved, keys).length > 0
}

/**
 * Only the fields that differ from the saved settings, with '' sent as null.
 * Throws on invalid values — call it after the form validated.
 */
export function settingsPatch(
  values: SettingsValues,
  saved: Settings,
  keys: readonly SettingsKey[] = KEYS,
): UpdateSettings {
  const entries = changedKeys(values, saved, keys).map((key) => [
    key,
    normalize(key, values[key]),
  ])
  return updateSettingsSchema.parse(Object.fromEntries(entries))
}

const percent = z
  .number({ error: 'Enter a number' })
  .int('Whole percent')
  .min(10, 'Between 10 and 100')
  .max(100, 'Between 10 and 100')

/** Per-field validators; bounds mirror `settingsSchema`. */
export const settingsFieldSchemas = {
  maxConcurrentRuns: z
    .number({ error: 'Enter a number' })
    .int('Whole number')
    .min(1, 'Between 1 and 10')
    .max(10, 'Between 1 and 10'),
  pauseAtFiveHourPct: percent,
  pauseAtWeeklyPct: percent,
  clock: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM'),
  appUrl: z.url('Enter a full URL, e.g. http://localhost:4800'),
  optionalUrl: z.union([z.literal(''), z.url('Enter a full https:// URL')]),
}
