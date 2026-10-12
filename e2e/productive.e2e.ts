import { expect, test, type Page, type Route } from '@playwright/test'

import type {
  ConnectProductive,
  ImportProductiveTasks,
  ProductiveConnection,
  ProductiveTask,
  WorkOrder,
} from '../src/lib/contracts'

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

const ORGS = [
  { id: '1', name: 'Acme' },
  { id: '2', name: 'Beta' },
]

const connection = (organizationId: string): ProductiveConnection => ({
  organizationId,
  organizationName: ORGS.find((o) => o.id === organizationId)?.name ?? '?',
  personName: 'Ana Anić',
  tokenHint: 'pk_…9f2a',
  organizations: ORGS,
  connectedAt: NOW,
})

const task = (id: string, extra: Partial<ProductiveTask> = {}): ProductiveTask => ({
  id,
  number: id,
  title: `Invoice reminders ${id}`,
  url: `https://app.productive.io/1-acme/task/${id}`,
  projectName: 'Website',
  status: 'To do',
  assigneeName: 'Ana Anić',
  dueDate: null,
  updatedAt: NOW,
  workOrderId: null,
  ...extra,
})

const workOrder = (id: string, title: string): WorkOrder => ({
  id,
  projectId: PROJECT,
  kind: 'build',
  title,
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
  source: {
    provider: 'productive',
    id: '11',
    number: '11',
    url: 'https://app.productive.io/1-acme/task/11',
    projectName: 'Website',
  },
  createdAt: NOW,
  updatedAt: NOW,
})

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function mockApi(page: Page, connected: ProductiveConnection | null) {
  const state = {
    connection: connected,
    connects: [] as ConnectProductive[],
    imports: [] as ImportProductiveTasks[],
    workOrders: [] as WorkOrder[],
  }
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const path = url.pathname.replace(/^\/api/, '')
      if (path === '/events') return route.abort()
      if (path === '/projects') return json(route, [project])
      if (path === '/notifications')
        return json(route, { items: [], unreadCount: 0, nextCursor: null })
      if (path === '/work-orders') return json(route, state.workOrders)
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
      if (path === '/integrations/productive') {
        if (request.method() === 'DELETE') {
          state.connection = null
          return route.fulfill({ status: 204 })
        }
        if (request.method() === 'PUT') {
          const body: ConnectProductive = request.postDataJSON()
          state.connects.push(body)
          if (body.token === 'bad')
            return json(
              route,
              {
                error: {
                  code: 'productive_token_invalid',
                  message: 'Productive didn’t accept this token.',
                },
              },
              400,
            )
          if (body.organizationId === undefined)
            return json(
              route,
              {
                error: {
                  code: 'productive_pick_organization',
                  message: 'Pick one.',
                  details: { organizations: ORGS },
                },
              },
              409,
            )
          state.connection = connection(body.organizationId)
          return json(route, state.connection)
        }
        return json(route, { connection: state.connection })
      }
      if (path === '/integrations/productive/projects')
        return json(route, [{ id: '10', name: 'Website', number: '7' }])
      if (path === '/integrations/productive/tasks')
        return json(route, {
          items: [
            task('11'),
            task('12', { title: 'Export to CSV' }),
            task('13', { title: 'Already here', workOrderId: crypto.randomUUID() }),
          ],
          nextPage: null,
        })
      if (path === '/integrations/productive/import') {
        const body: ImportProductiveTasks = request.postDataJSON()
        state.imports.push(body)
        state.workOrders = body.taskIds.map((id) =>
          workOrder(crypto.randomUUID(), `Invoice reminders ${id}`),
        )
        return json(route, state.workOrders, 201)
      }
      return json(route, { error: { code: 'not_mocked', message: path } }, 404)
    },
  )
  return state
}

test.beforeEach(async ({ page }, testInfo) => {
  const theme = testInfo.project.name.startsWith('light') ? 'light' : 'dark'
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
})

test('connecting Productive asks for the organization when the token has several', async ({
  page,
}) => {
  const state = await mockApi(page, null)
  await page.goto('/settings/integrations')
  const card = page.getByTestId('productive-card')
  await expect(card.getByText('Not connected')).toBeVisible()

  await card.getByRole('button', { name: 'Connect' }).click()
  const dialog = page.getByRole('dialog', { name: 'Connect Productive' })
  await dialog.getByLabel('API token').fill('bad')
  await dialog.getByRole('button', { name: 'Connect' }).click()
  await expect(dialog.getByText('Productive didn’t accept this token.')).toBeVisible()

  await dialog.getByLabel('API token').fill('pk_good')
  await dialog.getByRole('button', { name: 'Connect' }).click()
  await dialog.getByRole('radio', { name: 'Beta' }).click()
  await dialog.getByRole('button', { name: 'Connect' }).click()
  await expect(dialog).toBeHidden()
  expect(state.connects.at(-1)).toEqual({ token: 'pk_good', organizationId: '2' })

  await expect(card.getByRole('button', { name: 'Disconnect' })).toBeVisible()
  await expect(card.getByText('pk_…9f2a')).toBeVisible()

  await card.getByRole('button', { name: 'Disconnect' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Disconnect' }).click()
  await expect(card.getByText('Not connected')).toBeVisible()
})

test('tasks are picked from Productive into the backlog', async ({ page }) => {
  const state = await mockApi(page, connection('1'))
  await page.goto(`/projects/${PROJECT}?new=true`)
  await page.getByRole('button', { name: 'Import from Productive' }).click()

  const dialog = page.getByRole('dialog', { name: 'Import from Productive' })
  await expect(dialog.getByText('Invoice reminders 11')).toBeVisible()
  await expect(dialog.getByText('In backlog', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('checkbox', { name: /Already here/ })).toBeDisabled()

  await dialog.getByRole('checkbox', { name: /Invoice reminders 11/ }).check()
  await dialog.getByRole('checkbox', { name: /Export to CSV/ }).check()
  await dialog.getByRole('button', { name: 'Add 2 to backlog' }).click()
  await expect(dialog).toBeHidden()
  expect(state.imports).toEqual([{ projectId: PROJECT, taskIds: ['11', '12'] }])

  // The card links back to the task.
  await expect(
    page.getByRole('link', { name: /Open #11 in Productive/ }).first(),
  ).toHaveAttribute('href', 'https://app.productive.io/1-acme/task/11')
})

test('the import dialog fits a phone', async ({ page }) => {
  await mockApi(page, connection('1'))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/projects/${PROJECT}?import=productive`)
  const dialog = page.getByRole('dialog', { name: 'Import from Productive' })
  await expect(dialog.getByText('Invoice reminders 11')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Add to backlog' })).toBeInViewport()
  const box = await dialog.boundingBox()
  expect(box?.width ?? 0).toBeLessThanOrEqual(390)
})
