import { expect, test, type Page, type Route } from '@playwright/test'

import type { Preview } from '../src/lib/contracts'

const PROJECT = '0e6b2c1a-1111-4222-8333-444455556666'
const NOW = new Date().toISOString()

const SAVED: Preview = {
  install: 'pnpm install --frozen-lockfile',
  start: 'pnpm dev --port $PORT',
  readyPath: '/',
  readyTimeoutSec: 120,
  env: { VITE_MOCKS: '1' },
  baseUrlPath: '/',
  themeInit: null,
  host: null,
}

const DETECTED: Preview = {
  ...SAVED,
  start: 'pnpm vite --port $PORT --strictPort',
  env: {},
}

function projectWith(preview: Preview | null) {
  return {
    id: PROJECT,
    name: 'acme-app',
    kind: 'repo',
    repoPath: '/repos/acme-app',
    baseBranch: 'main',
    preview,
    deliveryDefault: 'draft_pr',
    createdAt: NOW,
    updatedAt: NOW,
    hubPath: null,
    repos: [],
    claudeAccountId: null,
  }
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** A repo project with `preview`; returns the PATCH bodies the settings send. */
async function mockApi(page: Page, initial: Preview | null, lastTestOk?: boolean) {
  let project = projectWith(initial)
  const patches: unknown[] = []
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api/, '')
      const method = route.request().method()
      if (path === '/events') return route.abort()
      if (path === '/projects') return json(route, [project])
      if (path === `/projects/${PROJECT}` && method === 'PATCH') {
        const body: { preview: Preview | null } = route.request().postDataJSON()
        patches.push(body)
        project = { ...project, ...body }
        return json(route, project)
      }
      if (path === '/notifications')
        return json(route, { items: [], unreadCount: 0, nextCursor: null })
      if (path === '/work-orders' || path === '/runs') return json(route, [])
      if (path === `/projects/${PROJECT}/preview/test` && method === 'GET')
        return json(route, {
          last:
            lastTestOk === undefined
              ? null
              : {
                  ok: lastTestOk,
                  logs: '',
                  error: lastTestOk ? null : 'Timed out waiting for /',
                  durationMs: 4200,
                  screenshotUrl: null,
                  testedAt: NOW,
                },
        })
      if (path === `/projects/${PROJECT}/preview/session`)
        return json(route, { session: null, signIn: null })
      if (path === `/projects/${PROJECT}/preview/detect`)
        return json(route, {
          preview: DETECTED,
          framework: 'Vite',
          packageManager: 'pnpm',
          nodeVersion: null,
          notes: [],
        })
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
  return patches
}

test.beforeEach(async ({ page }, testInfo) => {
  const theme = testInfo.project.name.startsWith('light') ? 'light' : 'dark'
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
})

const open = (page: Page) => page.goto(`/projects/${PROJECT}?settings=preview`)
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Project settings' })

test('detect fills the form unsaved; save sends the preview', async ({ page }) => {
  const patches = await mockApi(page, null)
  await open(page)
  const settings = sheet(page)
  await expect(settings.getByText('Not set up')).toBeVisible()
  await expect(settings.getByRole('button', { name: 'Save preview' })).toBeDisabled()
  await expect(settings.getByRole('button', { name: 'Remove preview' })).toHaveCount(0)

  await settings.getByRole('button', { name: 'Detect from repo' }).click()
  await expect(settings.getByLabel('Start command')).toHaveValue(
    'pnpm vite --port $PORT --strictPort',
  )
  await expect(settings.getByLabel('Install command')).toHaveValue(
    'pnpm install --frozen-lockfile',
  )
  await expect(settings.getByText('Unsaved changes', { exact: true })).toBeVisible()
  expect(patches).toEqual([])

  await settings.getByRole('button', { name: 'Save preview' }).click()
  await expect(page.getByText('Preview saved.')).toBeVisible()
  expect(patches).toEqual([{ preview: DETECTED }])
  await expect(settings.getByText('Saved', { exact: true })).toBeVisible()
  await expect(settings.getByText('Not tested')).toBeVisible()
})

test('broken fields are named and nothing is saved', async ({ page }) => {
  const patches = await mockApi(page, null)
  await open(page)
  const settings = sheet(page)
  await settings.getByLabel('Ready path').fill('health')
  await settings.getByLabel('Ready timeout (s)').fill('2')
  await settings.getByLabel('Host').fill('http://app.localhost:3000')
  await settings.getByRole('button', { name: 'Save preview' }).click()

  await expect(settings.getByText('Required — the command that serves the app.')).toBeVisible()
  await expect(settings.getByText('Must start with “/”.')).toBeVisible()
  await expect(settings.getByText('A whole number of seconds, 5–900.')).toBeVisible()
  await expect(
    settings.getByText('A host name like app.example.localhost — no scheme, port or path.'),
  ).toBeVisible()
  await expect(settings.getByLabel('Start command')).toHaveAttribute('aria-invalid', 'true')
  expect(patches).toEqual([])
})

test('environment rows add, validate and remove', async ({ page }) => {
  const patches = await mockApi(page, SAVED, true)
  await open(page)
  const settings = sheet(page)
  await expect(settings.getByText('Preview ready')).toBeVisible()
  await expect(settings.getByLabel('Variable 1 name')).toHaveValue('VITE_MOCKS')

  await settings.getByRole('button', { name: 'Add variable' }).click()
  await settings.getByLabel('Variable 2 name').fill('1BAD')
  await settings.getByLabel('Variable 2 value').fill('x')
  await settings.getByRole('button', { name: 'Save preview' }).click()
  await expect(settings.getByText('“1BAD” isn’t a valid variable name.')).toBeVisible()
  expect(patches).toEqual([])

  await settings.getByLabel('Variable 2 name').fill('API_URL')
  await settings.getByRole('button', { name: 'Remove variable 1' }).click()
  await expect(settings.getByLabel('Variable 1 name')).toHaveValue('API_URL')
  await settings.getByRole('button', { name: 'Save preview' }).click()
  await expect.poll(() => patches.length).toBe(1)
  expect(patches[0]).toEqual({ preview: { ...SAVED, env: { API_URL: 'x' } } })
})

test('discard restores the saved preview; remove clears it', async ({ page }) => {
  const patches = await mockApi(page, SAVED, false)
  await open(page)
  const settings = sheet(page)
  await expect(settings.getByText('Preview failing')).toBeVisible()
  await expect(settings.getByText('Saved', { exact: true })).toBeVisible()

  await settings.getByLabel('Start command').fill('npm start')
  await expect(settings.getByText('Unsaved changes', { exact: true })).toBeVisible()
  await settings.getByRole('button', { name: 'Discard' }).click()
  await expect(settings.getByLabel('Start command')).toHaveValue('pnpm dev --port $PORT')
  await expect(settings.getByRole('button', { name: 'Save preview' })).toBeDisabled()

  await settings.getByRole('button', { name: 'Remove preview' }).click()
  await expect(
    page.getByText('Preview removed. QA stations will fail until it is set up again.'),
  ).toBeVisible()
  expect(patches).toEqual([{ preview: null }])
  await expect(settings.getByText('Not set up')).toBeVisible()
})
