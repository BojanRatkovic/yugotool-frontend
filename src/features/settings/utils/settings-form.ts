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

/** Fields whose (normalized) value differs from the saved settings. */
export function changedKeys(values: SettingsValues, saved: Settings): (keyof SettingsValues)[] {
  const base = toSettingsValues(saved)
  return KEYS.filter((key) => normalize(key, values[key]) !== normalize(key, base[key]))
}

export function isSettingsDirty(values: SettingsValues, saved: Settings): boolean {
  return changedKeys(values, saved).length > 0
}

/**
 * Only the fields that differ from the saved settings, with '' sent as null.
 * Throws on invalid values — call it after the form validated.
 */
export function settingsPatch(values: SettingsValues, saved: Settings): UpdateSettings {
  const entries = changedKeys(values, saved).map((key) => [key, normalize(key, values[key])])
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
