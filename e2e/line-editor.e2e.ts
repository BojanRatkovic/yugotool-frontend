import { expect, test, type Page, type Route } from '@playwright/test'

import type { Line } from '../src/lib/contracts'

const PROJECT = '0e6b2c1a-1111-4222-8333-444455556666'
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

const LINE: Line = {
  id: '7e6b2c1a-1111-4222-8333-444455556666',
  projectId: PROJECT,
  kind: 'build',
  name: 'Build',
  stations: [
    {
      key: 'build',
      kind: 'agent',
      name: 'Build',
      role: 'Builder',
      model: 'claude-sonnet-5-5',
      allowedTools: [],
      canEdit: true,
      prompt: 'Build it.',
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** The API with one line; returns the PUT bodies the editor sends. */
async function mockApi(page: Page) {
  let line = LINE
  const puts: unknown[] = []
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api/, '')
      if (path === '/events') return route.abort()
      if (path === '/projects') return json(route, [project])
      if (path === '/notifications')
        return json(route, { items: [], unreadCount: 0, nextCursor: null })
      if (path === '/work-orders' || path === '/runs') return json(route, [])
      if (path === `/projects/${PROJECT}/skills`) return json(route, [])
      if (path === `/projects/${PROJECT}/line`) {
        if (route.request().method() === 'PUT') {
          const body: Pick<Line, 'stations'> = route.request().postDataJSON()
          puts.push(body)
          // A saved line comes back newer, which remounts the editor.
          line = { ...line, ...body, updatedAt: new Date(Date.now() + 1000).toISOString() }
        }
        return json(route, line)
      }
      return json(route, { error: { code: 'not_mocked', message: path } }, 404)
    },
  )
  return puts
}

test.beforeEach(async ({ page }, testInfo) => {
  const theme = testInfo.project.name.startsWith('light') ? 'light' : 'dark'
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
})

test('saving the line says so and leaves nothing unsaved', async ({ page }) => {
  const puts = await mockApi(page)
  await page.goto(`/projects/${PROJECT}?view=line`)
  const save = page.getByRole('button', { name: 'Save line' })
  await expect(save).toBeDisabled()

  await page.getByRole('button', { name: 'Gate', exact: true }).first().click()
  // Adding a station opens it; the line has unsaved changes behind the sheet.
  await page.keyboard.press('Escape')
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible()
  await save.click()

  await expect(page.getByText('Line saved.')).toBeVisible()
  expect(puts).toHaveLength(1)
  expect(puts[0]).toMatchObject({ stations: [{ key: 'build' }, { kind: 'gate' }] })
  await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0)
})
