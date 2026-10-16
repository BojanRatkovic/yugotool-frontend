import { expect, test, type Page, type Route } from '@playwright/test'

import type { Run, Station, StationRun, WorkOrder } from '../src/lib/contracts'

const PROJECT = '0e6b2c1a-1111-4222-8333-444455556666'
const WORK_ORDER = '5d1c2b3a-1111-4222-8333-444455556666'
const RUN = '6a1c2b3a-1111-4222-8333-444455556666'
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

const agent = (key: string, name: string, canEdit: boolean): Station => ({
  key,
  kind: 'agent',
  name,
  role: name,
  model: 'claude-sonnet-5-5',
  allowedTools: [],
  canEdit,
  prompt: '',
})

const LINE: Station[] = [
  agent('research', 'Research', false),
  { key: 'plan', kind: 'gate', name: 'Plan', prompt: '' },
  agent('build', 'Build', true),
]

const PLAN = [
  '# Plan',
  '',
  'Send a reminder **3 days** before an invoice is due.',
  '',
  '## Steps',
  '',
  '1. Add `reminder_sent_at` to invoices',
  '2. Schedule a daily job',
  '',
  '| File | Change |',
  '|---|---|',
  '| `invoice.rb` | new column |',
].join('\n')

function stationRun(stationKey: string, patch: Partial<StationRun> = {}): StationRun {
  return {
    id: crypto.randomUUID(),
    runId: RUN,
    stationKey,
    attempt: 1,
    status: 'succeeded',
    sessionId: null,
    model: null,
    authSource: null,
    accountLabel: null,
    output: null,
    verdict: null,
    error: null,
    research: null,
    costUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    contextTokens: 0,
    contextWindow: null,
    numTurns: 0,
    shift: null,
    qa: null,
    startedAt: NOW,
    finishedAt: NOW,
    ...patch,
  }
}

const workOrder: WorkOrder = {
  id: WORK_ORDER,
  projectId: PROJECT,
  kind: 'build',
  title: 'Invoice reminders',
  description: 'Remind clients before invoices are due.',
  pullRequest: null,
  status: 'awaiting_approval',
  stationKey: 'plan',
  position: 1,
  repo: null,
  followsId: null,
  branch: 'yugotool/invoice-reminders',
  currentRunId: RUN,
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

const run: Run = {
  id: RUN,
  workOrderId: WORK_ORDER,
  status: 'awaiting_approval',
  workflowId: `work-order-${WORK_ORDER}`,
  worktreePath: '/worktrees/acme',
  repo: null,
  costUsd: 0.5,
  startedAt: NOW,
  finishedAt: null,
  stations: [
    stationRun('research', { output: PLAN }),
    stationRun('plan', { status: 'awaiting_approval', finishedAt: null }),
  ],
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

const line = (stations: Station[]) => ({
  id: '7e6b2c1a-1111-4222-8333-444455556666',
  projectId: PROJECT,
  kind: 'build',
  name: 'Build',
  stations,
  createdAt: NOW,
  updatedAt: NOW,
})

/** Mocks the API; returns the writes it receives. */
async function mockApi(page: Page) {
  const writes: { method: string; path: string; body: unknown }[] = []
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname.replace(/^\/api/, '')
      if (request.method() === 'PATCH' && path === `/work-orders/${WORK_ORDER}`) {
        writes.push({ method: 'PATCH', path, body: request.postDataJSON() })
        return json(route, { ...workOrder, ...request.postDataJSON() })
      }
      if (request.method() === 'PUT' && path === `/projects/${PROJECT}/line`) {
        const body: { stations: Station[] } = request.postDataJSON()
        writes.push({ method: 'PUT', path, body: body.stations.map((station) => station.name) })
        return json(route, { ...line(body.stations), updatedAt: new Date().toISOString() })
      }
      if (path === '/events') return route.abort()
      if (path === '/projects') return json(route, [project])
      if (path === '/notifications')
        return json(route, { items: [], unreadCount: 0, nextCursor: null })
      if (path === '/work-orders') return json(route, [workOrder])
      if (path === '/runs') return json(route, [run])
      if (path === `/runs/${RUN}/events`) return json(route, [])
      if (path === `/projects/${PROJECT}/skills`) return json(route, [])
      if (path === `/projects/${PROJECT}/remote`)
        return json(route, {
          origin: 'git@github.com:acme/app.git',
          github: true,
          ghLoggedIn: true,
          prPossible: true,
          reason: null,
        })
      if (path === `/projects/${PROJECT}/line`) return json(route, line(LINE))
      return json(route, { error: { code: 'not_mocked', message: path } }, 404)
    },
  )
  return writes
}

test.beforeEach(async ({ page }, testInfo) => {
  const theme = testInfo.project.name.startsWith('light') ? 'light' : 'dark'
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
})

const open = (page: Page) => page.goto(`/projects/${PROJECT}?view=board&wo=${WORK_ORDER}`)

test('the plan gate opens Research’s plan as a document', async ({ page }) => {
  await mockApi(page)
  await open(page)
  const gateBar = page.getByRole('region', { name: 'Plan needs your decision' })
  await gateBar.getByRole('button', { name: 'Read Research' }).click()
  const reader = page.getByRole('dialog', { name: 'Research · for Plan' })
  await expect(reader.getByRole('heading', { name: 'Steps' })).toBeVisible()
  await expect(reader.getByRole('table')).toBeVisible()
  await expect(reader.getByText('**')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(reader).toBeHidden()
})

test('the description is edited in place and saved with ⌘↵', async ({ page }) => {
  const writes = await mockApi(page)
  await open(page)
  await page.getByRole('button', { name: 'Edit description' }).click()
  const field = page.getByRole('textbox', { name: 'Description' })
  await expect(field).toBeFocused()
  await field.fill('Remind clients 3 days before invoices are due.')
  await page.keyboard.press('Control+Enter')
  await expect
    .poll(() => writes)
    .toEqual([
      {
        method: 'PATCH',
        path: `/work-orders/${WORK_ORDER}`,
        body: { description: 'Remind clients 3 days before invoices are due.' },
      },
    ])
  // ⌘↵ in the field saves; it never approves the gate.
  await expect(page.getByText('Approved Plan.')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Description' })).toBeHidden()
})

test('a pipeline step edits its station of the line', async ({ page }) => {
  const writes = await mockApi(page)
  await open(page)
  const pipeline = page.getByRole('list', { name: 'Pipeline' })
  await pipeline.getByRole('listitem').filter({ hasText: 'Build' }).hover()
  await pipeline.getByRole('button', { name: 'Edit Build' }).click()
  const sheet = page.getByRole('dialog', { name: 'Build' })
  await sheet.getByRole('textbox', { name: 'Name' }).fill('Build it')
  await sheet.getByRole('button', { name: 'Save line' }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0]?.body).toEqual(['Research', 'Plan', 'Build it'])
  await expect(page.getByText('Line saved.')).toBeVisible()

  await pipeline.getByRole('button', { name: 'Edit the line' }).click()
  await expect(page).toHaveURL(/view=line/)
  await expect(page).not.toHaveURL(/wo=/)
})
