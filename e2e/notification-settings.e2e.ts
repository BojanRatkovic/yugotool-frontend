import { expect, test, type Route } from '@playwright/test'

import type { Settings, UpdateSettings } from '../src/lib/contracts'

const settings: Settings = {
  maxConcurrentRuns: 2,
  pauseAtFiveHourPct: 85,
  pauseAtWeeklyPct: 95,
  nightShiftStart: '22:00',
  nightShiftEnd: '07:00',
  appUrl: 'http://localhost:4800',
  desktopNotifications: true,
  slackWebhookUrl: null,
  telegramBotToken: null,
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
  updatedAt: new Date().toISOString(),
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

test.beforeEach(async ({ page }, testInfo) => {
  const theme = testInfo.project.name.startsWith('light') ? 'light' : 'dark'
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
})

test('a notification kind can be sent outside the app or kept in the bell', async ({
  page,
}) => {
  const patches: UpdateSettings[] = []
  let current = settings
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api/, '')
      if (path === '/events') return route.abort()
      if (path === '/projects') return json(route, [])
      if (path === '/notifications')
        return json(route, { items: [], unreadCount: 0, nextCursor: null })
      if (path === '/settings' && route.request().method() === 'PATCH') {
        const patch: UpdateSettings = route.request().postDataJSON()
        patches.push(patch)
        current = {
          ...current,
          notificationExternal: {
            ...current.notificationExternal,
            ...patch.notificationExternal,
          },
        }
        return json(route, current)
      }
      if (path === '/settings') return json(route, current)
      return json(route, { error: { code: 'not_mocked', message: path } }, 404)
    },
  )
  await page.goto('/settings/notifications')
  const section = page.getByRole('region', { name: 'Notification kinds' })
  await expect(section).toBeVisible()

  const ciPassed = section.getByRole('switch', { name: 'Send "CI passed" outside the app' })
  const runFailed = section.getByRole('switch', { name: 'Send "Run failed" outside the app' })
  await expect(
    section.getByRole('switch', { name: 'Send "Review requested" outside the app' }),
  ).toBeChecked()
  await expect(ciPassed).not.toBeChecked()
  await expect(runFailed).toBeChecked()

  await ciPassed.click()
  await expect(ciPassed).toBeChecked()
  await runFailed.click()
  await expect(runFailed).not.toBeChecked()
  expect(patches).toEqual([
    { notificationExternal: { ci_passed: true } },
    { notificationExternal: { run_failed: false } },
  ])

  await page.reload()
  await expect(
    page.getByRole('switch', { name: 'Send "CI passed" outside the app' }),
  ).toBeChecked()
})
