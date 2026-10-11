import { expect, test, type Page, type Route } from '@playwright/test'

import type { DoctorReport, Settings, SystemInfo } from '../src/lib/contracts'

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

const system: SystemInfo = {
  reposRoot: '/Users/me/code',
  reposRootDefault: '/Users/me/code',
  authSource: 'subscription',
  claudeLogin: null,
}

const doctor: DoctorReport = { ready: true, checks: [], checkedAt: new Date().toISOString() }

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function mockApi(page: Page) {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api/, '')
      if (path === '/events') return route.abort()
      if (path === '/projects') return json(route, [])
      if (path === '/notifications')
        return json(route, { items: [], unreadCount: 0, nextCursor: null })
      if (path === '/settings') return json(route, settings)
      if (path === '/system') return json(route, system)
      if (path === '/system/doctor') return json(route, doctor)
      if (path === '/claude-accounts' || path === '/claude-accounts/discover')
        return json(route, [])
      if (path === '/knowledge-sources') return json(route, [])
      return json(route, { error: { code: 'not_mocked', message: path } }, 404)
    },
  )
}

test.beforeEach(async ({ page }, testInfo) => {
  const theme = testInfo.project.name.startsWith('light') ? 'light' : 'dark'
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
  await mockApi(page)
})

test('settings is a page per topic, with old links landing on the right page', async ({
  page,
}) => {
  await page.goto('/settings')
  await expect(page).toHaveURL(/\/settings\/general$/)
  const nav = page.getByRole('navigation', { name: 'Settings' }).first()
  await expect(nav.getByRole('link', { name: 'General' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  const content = page.locator('[data-settings-scroll]')
  await expect(content.getByRole('region', { name: 'Dispatcher' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Channels' })).toHaveCount(0)

  await nav.getByRole('link', { name: 'Notifications' }).click()
  await expect(page).toHaveURL(/\/settings\/notifications$/)
  await expect(page.getByRole('region', { name: 'Channels' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Notification kinds' })).toBeVisible()

  await page.goto('/settings#doctor')
  await expect(page).toHaveURL(/\/settings\/doctor$/)
  await page.goto('/settings#knowledge-heading')
  await expect(page).toHaveURL(/\/settings\/knowledge$/)
  await page.goto('/settings#settings-repos-root')
  await expect(page).toHaveURL(/\/settings\/general#settings-repos-root$/)
  await expect(page.getByLabel('Repos folder')).toBeFocused()
})

test('leaving a page with unsaved edits asks first', async ({ page }) => {
  await page.goto('/settings/general')
  const maxRuns = page.getByLabel('Max concurrent runs')
  await maxRuns.fill('4')
  await expect(page.getByText('Unsaved changes')).toBeVisible()

  const nav = page.getByRole('navigation', { name: 'Settings' }).first()
  await nav.getByRole('link', { name: 'Notifications' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Discard unsaved changes?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Keep editing' }).click()
  await expect(page).toHaveURL(/\/settings\/general$/)
  await expect(maxRuns).toHaveValue('4')

  await nav.getByRole('link', { name: 'Notifications' }).click()
  await dialog.getByRole('button', { name: 'Discard' }).click()
  await expect(page).toHaveURL(/\/settings\/notifications$/)
})

test('on a phone, pages are a tab strip and nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/settings/notifications')
  const strip = page.getByRole('navigation', { name: 'Settings' }).filter({ visible: true })
  await expect(strip).toHaveCount(1)
  await expect(strip.getByRole('link', { name: 'Notifications' })).toBeInViewport()
  await expect(page.getByRole('region', { name: 'Channels' })).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBe(0)

  await strip.getByRole('link', { name: 'General' }).click()
  await expect(page).toHaveURL(/\/settings\/general$/)
  await expect(page.getByLabel('Max concurrent runs')).toBeInViewport()
})
