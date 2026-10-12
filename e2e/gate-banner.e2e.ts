import { expect, test, type Page, type Route } from '@playwright/test'

import type { Run, Station, StationRun, WorkOrder } from '../src/lib/contracts'

const PROJECT = '0e6b2c1a-1111-4222-8333-444455556666'
const WORK_ORDER = '5d1c2b3a-1111-4222-8333-444455556666'
const RUN = '6a1c2b3a-1111-4222-8333-444455556666'
const NOW = new Date().toISOString()

const repoProject = {
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

const hubProject = {
  ...repoProject,
  name: 'acme-hub',
  kind: 'hub',
  repoPath: '/hubs/acme',
  repos: [
    { name: 'api', path: '/hubs/acme/repos/api', baseBranch: 'main', preview: null },
    { name: 'web', path: '/hubs/acme/repos/web', baseBranch: 'develop', preview: null },
  ],
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
const gate = (key: string, name: string, prompt = ''): Station => ({
  key,
  kind: 'gate',
  name,
  prompt,
})

/** Build, then the final gate: approving it delivers. */
const REPO_LINE = [agent('build', 'Build', true), gate('review', 'Review', 'Check the diff.')]
/** Research, the plan gate (repo pick), Build, the final gate. */
const HUB_LINE = [
  agent('research', 'Research', false),
  gate('plan', 'Plan'),
  agent('build', 'Build', true),
  gate('review', 'Review'),
]

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
  description: '',
  pullRequest: null,
  status: 'awaiting_approval',
  stationKey: 'review',
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

function runWaitingAt(stationKey: string, done: StationRun[], repo: string | null): Run {
  return {
    id: RUN,
    workOrderId: WORK_ORDER,
    status: 'awaiting_approval',
    workflowId: `work-order-${WORK_ORDER}`,
    worktreePath: repo === null ? null : '/worktrees/acme',
    repo,
    costUsd: 0.5,
    startedAt: NOW,
    finishedAt: null,
    stations: [
      ...done,
      stationRun(stationKey, { status: 'awaiting_approval', finishedAt: null }),
    ],
  }
}

interface Setup {
  project: typeof repoProject
  stations: Station[]
  run: Run
  prPossible?: boolean
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** The API for one work order waiting at a gate; returns the gate decisions it receives. */
async function mockApi(page: Page, setup: Setup) {
  const decisions: { stationKey: string; body: unknown }[] = []
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url())
      const path = url.pathname.replace(/^\/api/, '')
      const gateMatch = /^\/runs\/[^/]+\/gates\/([a-z_]+)$/.exec(path)
      if (gateMatch !== null && route.request().method() === 'POST') {
        decisions.push({ stationKey: gateMatch[1] ?? '', body: route.request().postDataJSON() })
        return route.fulfill({ status: 204 })
      }
      if (path === '/events') return route.abort()
      if (path === '/projects') return json(route, [setup.project])
      if (path === '/notifications')
        return json(route, { items: [], unreadCount: 0, nextCursor: null })
      if (path === '/work-orders') return json(route, [workOrder])
      if (path === '/runs') return json(route, [setup.run])
      if (path === `/runs/${RUN}/events`) return json(route, [])
      if (path === `/projects/${PROJECT}/skills`) return json(route, [])
      if (path === `/projects/${PROJECT}/remote`)
        return json(route, {
          origin: 'git@github.com:acme/app.git',
          github: true,
          ghLoggedIn: setup.prPossible !== false,
          prPossible: setup.prPossible !== false,
          reason: setup.prPossible === false ? 'gh is not logged in.' : null,
        })
      if (path === `/projects/${PROJECT}/line`)
        return json(route, {
          id: '7e6b2c1a-1111-4222-8333-444455556666',
          projectId: PROJECT,
          kind: 'build',
          name: 'Build',
          stations: setup.stations,
          createdAt: NOW,
          updatedAt: NOW,
        })
      return json(route, { error: { code: 'not_mocked', message: path } }, 404)
    },
  )
  return decisions
}

const REPO_SETUP: Setup = {
  project: repoProject,
  stations: REPO_LINE,
  run: runWaitingAt('review', [stationRun('build')], null),
}

test.beforeEach(async ({ page }, testInfo) => {
  const theme = testInfo.project.name.startsWith('light') ? 'light' : 'dark'
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
})

const open = (page: Page) => page.goto(`/projects/${PROJECT}?view=board&wo=${WORK_ORDER}`)
const banner = (page: Page, station: string) =>
  page.getByRole('region', { name: `${station} needs your decision` })

test('the final gate approves with the project delivery, or another from the menu', async ({
  page,
}) => {
  const decisions = await mockApi(page, REPO_SETUP)
  await open(page)
  const gateBar = banner(page, 'Review')
  await expect(gateBar).toBeVisible()
  await expect(gateBar.getByText('Check the diff.')).toBeVisible()
  // Opened on a waiting gate: the comment box has focus.
  await expect(gateBar.getByRole('textbox', { name: 'Comment' })).toBeFocused()

  await gateBar.getByRole('button', { name: /Approve & open draft PR/ }).click()
  await expect(page.getByText('Approved Review · opening a draft PR.')).toBeVisible()
  expect(decisions).toEqual([
    {
      stationKey: 'review',
      body: { decision: 'approve', comment: '', delivery: 'draft_pr' },
    },
  ])

  await gateBar.getByRole('button', { name: 'Approve with a different delivery' }).click()
  const menu = page.getByRole('menu')
  await expect(
    menu.getByRole('menuitem', { name: /Open draft PR.*Project default/ }),
  ).toBeVisible()
  await menu.getByRole('menuitem', { name: /Commit locally/ }).click()
  await expect.poll(() => decisions.length).toBe(2)
  expect(decisions[1]).toEqual({
    stationKey: 'review',
    body: { decision: 'approve', comment: '', delivery: 'local' },
  })
})

test('request changes needs a comment; the shortcut sends it', async ({ page }) => {
  const decisions = await mockApi(page, REPO_SETUP)
  await open(page)
  const gateBar = banner(page, 'Review')
  const comment = gateBar.getByRole('textbox', { name: 'Comment' })
  await expect(comment).toHaveAttribute(
    'placeholder',
    'What should Build change? (required for Request changes)',
  )

  await gateBar.getByRole('button', { name: /Request changes/ }).click()
  await expect(
    gateBar.getByText('Say what should change — Build resumes from your comment.'),
  ).toBeVisible()
  await expect(comment).toHaveAttribute('aria-invalid', 'true')
  await expect(comment).toBeFocused()
  expect(decisions).toEqual([])

  await comment.fill('Use the shared mailer.')
  await expect(comment).not.toHaveAttribute('aria-invalid', 'true')
  await page.keyboard.press('Control+Shift+Enter')
  await expect(page.getByText('Sent Review back to the builder.')).toBeVisible()
  expect(decisions).toEqual([
    {
      stationKey: 'review',
      body: { decision: 'request_changes', comment: 'Use the shared mailer.' },
    },
  ])
})

test('reject sends no delivery; the approve shortcut works from the comment box', async ({
  page,
}) => {
  const decisions = await mockApi(page, REPO_SETUP)
  await open(page)
  const gateBar = banner(page, 'Review')
  const reject = gateBar.getByRole('button', { name: 'Reject' })
  // The buttons wrap inside the bar at every width; none slides under the details rail.
  const bar = await gateBar.boundingBox()
  const button = await reject.boundingBox()
  expect(button !== null && bar !== null && button.x + button.width <= bar.x + bar.width).toBe(
    true,
  )
  await page.screenshot({ path: test.info().outputPath('gate.png') })
  await reject.click()
  await expect(page.getByText('Rejected Review.')).toBeVisible()

  await gateBar.getByRole('textbox', { name: 'Comment' }).fill('Ship it')
  await page.keyboard.press('Control+Enter')
  await expect.poll(() => decisions.length).toBe(2)
  expect(decisions).toEqual([
    { stationKey: 'review', body: { decision: 'reject', comment: '' } },
    {
      stationKey: 'review',
      body: { decision: 'approve', comment: 'Ship it', delivery: 'draft_pr' },
    },
  ])
})

test('when PRs are impossible the gate commits locally and says why', async ({ page }) => {
  const decisions = await mockApi(page, { ...REPO_SETUP, prPossible: false })
  await open(page)
  const gateBar = banner(page, 'Review')
  await expect(
    gateBar.getByText(
      'The project default is “Open draft PR”, but PRs aren’t possible. gh is not logged in. Approving commits locally.',
    ),
  ).toBeVisible()

  await gateBar.getByRole('button', { name: 'Approve with a different delivery' }).click()
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitem', { name: /Open draft PR/ })).toBeDisabled()
  await expect(menu.getByRole('menuitem', { name: /^Open PR/ })).toBeDisabled()
  await page.keyboard.press('Escape')

  await gateBar.getByRole('button', { name: /Approve & commit locally/ }).click()
  await expect.poll(() => decisions.length).toBe(1)
  expect(decisions[0]).toEqual({
    stationKey: 'review',
    body: { decision: 'approve', comment: '', delivery: 'local' },
  })
})

test('the plan gate of a hub run picks the repo and shows the proposed split', async ({
  page,
}) => {
  const research = stationRun('research', {
    research: {
      plan: 'Add the endpoint, then the screen.',
      repo: 'api',
      split: [
        { title: 'Reminder endpoint', description: '', repo: 'api' },
        { title: 'Reminder settings screen', description: '', repo: 'web' },
      ],
    },
  })
  const decisions = await mockApi(page, {
    project: hubProject,
    stations: HUB_LINE,
    run: runWaitingAt('plan', [research], null),
  })
  await open(page)
  const gateBar = banner(page, 'Plan')
  await expect(gateBar.getByText('Research suggests 2 work orders')).toBeVisible()
  await expect(gateBar.getByText('The worktree is made here after you approve.')).toBeVisible()
  await expect(gateBar.getByRole('combobox', { name: 'Repo' })).toHaveText('api')
  // Not the last gate: approve has no delivery choice.
  await expect(
    gateBar.getByRole('button', { name: 'Approve with a different delivery' }),
  ).toHaveCount(0)

  await gateBar.getByRole('combobox', { name: 'Repo' }).click()
  await page.getByRole('option', { name: 'web' }).click()
  await gateBar.getByRole('button', { name: /^Approve/ }).click()
  await expect.poll(() => decisions.length).toBe(1)
  expect(decisions[0]).toEqual({
    stationKey: 'plan',
    body: { decision: 'approve', comment: '', repo: 'web' },
  })
})
