import { expect, test, type Route } from '@playwright/test'

import type { Notification } from '../src/lib/contracts'

declare global {
  interface Window {
    /** Set by the init script: what the stand-in Notification was asked to show. */
    shownNotifications?: { title: string; body?: string; tag?: string }[]
    lastNotification?: EventTarget
  }
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

const arrived: Notification = {
  id: '00000000-0000-4000-8000-000000000042',
  kind: 'gate_waiting',
  title: 'Needs you: Fix login',
  body: 'Approve plan is waiting for your decision.',
  path: '/settings',
  projectId: null,
  workOrderId: null,
  readAt: null,
  createdAt: new Date().toISOString(),
}

test.beforeEach(async ({ page }, testInfo) => {
  const theme = testInfo.project.name.startsWith('light') ? 'light' : 'dark'
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
  // A recording stand-in for the browser's Notification, permission granted on ask.
  await page.addInitScript(() => {
    const shown: { title: string; body?: string; tag?: string }[] = []
    class FakeNotification extends EventTarget {
      static permission: NotificationPermission = 'default'
      static requestPermission() {
        FakeNotification.permission = 'granted'
        return Promise.resolve('granted' as const)
      }
      constructor(title: string, options: NotificationOptions = {}) {
        super()
        shown.push({ title, body: options.body, tag: options.tag })
        Object.assign(window, { lastNotification: this })
      }
      close() {}
    }
    Object.assign(window, { Notification: FakeNotification, shownNotifications: shown })
  })
})

test('a new notification shows in the browser while the tab is hidden', async ({ page }) => {
  let live = false
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api/, '')
      if (path === '/events') {
        if (!live) return route.abort()
        return route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: `data: ${JSON.stringify({ type: 'notification', notification: arrived })}\n\n`,
        })
      }
      if (path === '/projects') return json(route, [])
      if (path === '/notifications')
        return json(route, { items: [], unreadCount: 0, nextCursor: null })
      return json(route, { error: { code: 'not_mocked', message: path } }, 404)
    },
  )
  await page.goto('/')
  await page.getByRole('button', { name: /^Notifications/ }).click()
  const optIn = page.getByRole('switch', {
    name: 'Alert me when this tab is in the background',
  })
  await expect(optIn).not.toBeChecked()
  await optIn.click()
  await expect(optIn).toBeChecked()
  await page.keyboard.press('Escape')

  await page.evaluate(() => Object.defineProperty(document, 'hidden', { get: () => true }))
  live = true

  await expect
    .poll(() => page.evaluate(() => window.shownNotifications), {
      timeout: 15_000,
    })
    .toContainEqual({ title: arrived.title, body: arrived.body, tag: arrived.id })

  await page.evaluate(() => window.lastNotification?.dispatchEvent(new Event('click')))
  await expect(page).toHaveURL(/\/settings\/general$/)
})

test('nothing shows in the browser without the opt-in', async ({ page }) => {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api/, '')
      if (path === '/events') {
        return route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: `data: ${JSON.stringify({ type: 'notification', notification: arrived })}\n\n`,
        })
      }
      if (path === '/projects') return json(route, [])
      if (path === '/notifications')
        return json(route, { items: [], unreadCount: 0, nextCursor: null })
      return json(route, { error: { code: 'not_mocked', message: path } }, 404)
    },
  )
  await page.addInitScript(() => Object.defineProperty(document, 'hidden', { get: () => true }))
  await page.goto('/')
  // The toast proves the event arrived; the browser stayed quiet.
  await expect(page.getByText(arrived.title)).toBeVisible()
  expect(await page.evaluate(() => window.shownNotifications)).toEqual([])
})
