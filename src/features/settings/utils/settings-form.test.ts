import { describe, expect, it } from 'vitest'

import {
  isSettingsDirty,
  settingsFormKey,
  settingsPatch,
  toSettingsValues,
} from '@/features/settings/utils/settings-form'
import type { Settings } from '@/lib/contracts'

const saved: Settings = {
  maxConcurrentRuns: 2,
  pauseAtFiveHourPct: 85,
  pauseAtWeeklyPct: 90,
  nightShiftStart: '22:00',
  nightShiftEnd: '07:00',
  appUrl: 'http://localhost:4800',
  desktopNotifications: true,
  slackWebhookUrl: null,
  telegramBotToken: 'token',
  telegramChatId: null,
  reposRoot: null,
  anthropicApiKeyHint: null,
  anthropicApiKeySource: null,
  defaultClaudeAccountId: null,
  notificationExternal: {
    gate_waiting: true,
    run_failed: true,
    run_succeeded: true,
    review_ready: true,
    ci_failed: true,
    ci_passed: false,
    shift_handoff_ready: true,
    shift_stuck: true,
    knowledge_sync_failed: false,
    dispatcher_paused: false,
    pr_review_requested: true,
  },
  updatedAt: '2026-10-02T10:00:00.000Z',
}

describe('settingsPatch', () => {
  it('is empty for untouched values', () => {
    expect(settingsPatch(toSettingsValues(saved), saved)).toEqual({})
    expect(isSettingsDirty(toSettingsValues(saved), saved)).toBe(false)
  })

  it('sends only changed fields', () => {
    const values = { ...toSettingsValues(saved), maxConcurrentRuns: 3, nightShiftEnd: '06:30' }
    expect(settingsPatch(values, saved)).toEqual({
      maxConcurrentRuns: 3,
      nightShiftEnd: '06:30',
    })
  })

  it('clears nullable fields with null and trims', () => {
    const values = {
      ...toSettingsValues(saved),
      telegramBotToken: '  ',
      slackWebhookUrl: ' https://hooks.slack.com/x ',
    }
    expect(settingsPatch(values, saved)).toEqual({
      telegramBotToken: null,
      slackWebhookUrl: 'https://hooks.slack.com/x',
    })
  })

  it('ignores whitespace-only edits to an empty nullable field', () => {
    const values = { ...toSettingsValues(saved), telegramChatId: '   ' }
    expect(isSettingsDirty(values, saved)).toBe(false)
  })

  it('saves the repos folder trimmed, and empty as null (the default)', () => {
    expect(settingsPatch({ ...toSettingsValues(saved), reposRoot: ' ~/code ' }, saved)).toEqual(
      {
        reposRoot: '~/code',
      },
    )
    const custom = { ...saved, reposRoot: '~/code' }
    expect(settingsPatch({ ...toSettingsValues(custom), reposRoot: '' }, custom)).toEqual({
      reposRoot: null,
    })
  })
})

describe('settingsFormKey', () => {
  it('ignores API key and updatedAt changes', () => {
    const withKey: Settings = {
      ...saved,
      anthropicApiKeyHint: 'sk-ant-…x7Qd',
      anthropicApiKeySource: 'settings',
      updatedAt: '2026-10-03T10:00:00.000Z',
    }
    expect(settingsFormKey(withKey)).toBe(settingsFormKey(saved))
  })

  it('changes when an edited field changes', () => {
    expect(settingsFormKey({ ...saved, maxConcurrentRuns: 3 })).not.toBe(settingsFormKey(saved))
  })
})
