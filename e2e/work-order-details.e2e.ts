import { expect, test, type Page, type Route } from '@playwright/test'

import type { WorkOrder } from '../src/lib/contracts'

const PROJECT = '0e6b2c1a-1111-4222-8333-444455556666'
const WORK_ORDER = '5d1c2b3a-1111-4222-8333-444455556666'
const NOW = new Date().toISOString()

const project = {
  id: PROJECT,
  name: 'acme-app',
  kind: 'repo',
  repoPath: '/repos/acme-app',
  baseBranch: 'main',
  preview: null,
  deliveryDefault: 'draft_pr',
  createdAt: NOW,
  updatedAt: NOW,
  hubPath: null,
  repos: [],
  claudeAccountId: null,
}

const workOrder: WorkOrder = {
  id: WORK_ORDER,
  projectId: PROJECT,
  kind: 'build',
  title: 'Invoice reminders',
  description: '',
  pullRequest: null,
  status: 'backlog',
  stationKey: null,
  position: 1,
  repo: null,
  followsId: null,
  branch: null,
  currentRunId: null,
  modelOverride: null,
  effortOverride: null,
  maxBudgetUsd: null,
  prUrl: null,
  ci: null,
  queueMode: null,
  queuedAt: null,
  source: null,
  createdAt: NOW,
  updatedAt: NOW,
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function mockApi(page: Page) {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api/, '')
      if (path === '/events') return route.abort()
      if (path === '/projects') return json(route, [project])
      if (path === '/notifications')
        return json(route, { items: [], unreadCount: 0, nextCursor: null })
      if (path === '/work-orders') return json(route, [workOrder])
      if (path === '/runs') return json(route, [])
      if (path === `/projects/${PROJECT}/line`)
        return json(route, {
          id: '7e6b2c1a-1111-4222-8333-444455556666',
          projectId: PROJECT,
          kind: 'build',
          name: 'Build',
          stations: [],
          createdAt: NOW,
          updatedAt: NOW,
        })
      return json(route, { error: { code: 'not_mocked', message: path } }, 404)
    },
  )
}

test.beforeEach(async ({ page }, testInfo) => {
  const theme = testInfo.project.name.startsWith('light') ? 'light' : 'dark'
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
  await mockApi(page)
})

test('the details rail hides, remembers it, and comes back with ]', async ({ page }) => {
  await page.goto(`/projects/${PROJECT}?view=board&wo=${WORK_ORDER}`)
  const rail = page.getByRole('complementary', { name: 'Work order details' })
  const hide = page.getByRole('button', { name: 'Hide details' })
  await expect(rail).toBeVisible()
  await expect(hide).toHaveAttribute('aria-expanded', 'true')
  await expect(hide).toHaveAttribute('aria-controls', (await rail.getAttribute('id')) ?? '')

  await hide.click()
  await expect(rail).toBeHidden()
  const show = page.getByRole('button', { name: 'Show details' })
  await expect(show).toHaveAttribute('aria-expanded', 'false')

  // One preference for every work order, kept across reloads.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Show details' })).toBeVisible()
  await expect(rail).toBeHidden()

  await page.keyboard.press(']')
  await expect(rail).toBeVisible()

  // Typing ] into a field types it; it doesn't toggle the rail.
  await page.getByRole('textbox', { name: 'Title' }).focus()
  await page.keyboard.press(']')
  await expect(rail).toBeVisible()
})
