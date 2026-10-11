import { expect, test, type Page, type Route } from '@playwright/test'

import type { Notification } from '../src/lib/contracts'

const PROJECT = '0e6b2c1a-1111-4222-8333-444455556666'
const NOW = Date.now()
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString()

const project = {
  id: PROJECT,
  name: 'acme-app',
  repoPath: '/repos/acme-app',
  baseBranch: 'main',
  preview: null,
  deliveryDefault: 'draft_pr',
  createdAt: ago(100),
  updatedAt: ago(100),
}

const item = (n: number, overrides: Partial<Notification>): Notification => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  kind: 'gate_waiting',
  title: `Notification ${n}`,
  body: '',
  path: '/settings',
  projectId: null,
  workOrderId: null,
  readAt: null,
  createdAt: ago(0),
  ...overrides,
})

const ITEMS: Notification[] = [
  item(1, {
    title: 'Fix login waits for you at Review, with a title long enough to need truncating',
    body: 'Approve, request changes or reject.',
  }),
  item(2, { kind: 'run_failed', title: 'Fix login failed', createdAt: ago(0.1) }),
  item(4, {
    kind: 'pr_review_requested',
    title: 'Review requested: #7 Fix login',
    readAt: ago(0.5),
    createdAt: ago(0.5),
  }),
  item(3, {
    kind: 'ci_passed',
    title: 'CI passed on #42',
    readAt: ago(30),
    createdAt: ago(48),
  }),
]

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function mockApi(page: Page) {
  const reads: unknown[] = []
  let items = ITEMS
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url())
      const path = url.pathname.replace(/^\/api/, '')
      if (path === '/events') return route.abort()
      if (path === '/projects') return json(route, [project])
      if (path.startsWith('/work-orders')) return json(route, [])
      if (path === '/notifications') {
        const unreadCount = items.filter((i) => i.readAt === null).length
        return json(route, { items, unreadCount, nextCursor: null })
      }
      if (path === '/notifications/read') {
        const body: { ids?: string[]; all?: true } = route.request().postDataJSON()
        reads.push(body)
        const readAt = new Date().toISOString()
        items = items.map((i) =>
          i.readAt === null && (body.all === true || body.ids?.includes(i.id) === true)
            ? { ...i, readAt }
            : i,
        )
        return json(route, { unreadCount: items.filter((i) => i.readAt === null).length })
      }
      return json(route, { error: { code: 'not_mocked', message: path } }, 404)
    },
  )
  return { reads }
}

test.beforeEach(async ({ page }, testInfo) => {
  const theme = testInfo.project.name.startsWith('light') ? 'light' : 'dark'
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
})

test('the bell counts unread, groups the list and marks all read', async ({ page }) => {
  const { reads } = await mockApi(page)
  await page.goto('/')
  const bell = page.getByRole('button', { name: 'Notifications, 2 unread' })
  await expect(bell).toBeVisible()
  await bell.click()

  const today = page.getByRole('region', { name: 'Today' })
  await expect(today).toContainText('Fix login waits for you at Review')
  await expect(today).toContainText('Fix login failed')
  await expect(today).toContainText('Review requested: #7 Fix login')
  await expect(page.getByRole('region', { name: 'Earlier' })).toContainText('CI passed on #42')

  // Long titles truncate inside the popover instead of widening it past the screen.
  const popover = page.locator('[data-slot=popover-content]')
  const row = today.getByRole('button', { name: /Fix login waits for you/ })
  const [box, rowBox] = [await popover.boundingBox(), await row.boundingBox()]
  expect(rowBox!.x + rowBox!.width).toBeLessThanOrEqual(box!.x + box!.width)
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)

  await page.getByRole('button', { name: 'Mark all read' }).click()
  await expect(page.getByRole('button', { name: 'Mark all read' })).toBeDisabled()
  expect(reads).toEqual([{ all: true }])
  await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible()
})

test('opening a notification marks it read and goes to its page', async ({ page }) => {
  const { reads } = await mockApi(page)
  await page.goto(`/projects/${PROJECT}`)
  await page.getByRole('button', { name: /^Notifications/ }).click()
  await page.getByRole('button', { name: /Fix login failed/ }).click()
  await expect(page).toHaveURL(/\/settings\/general$/)
  await expect(page.getByRole('button', { name: 'Notifications, 1 unread' })).toBeVisible()
  expect(reads).toEqual([{ ids: [ITEMS[1]?.id] }])
})
