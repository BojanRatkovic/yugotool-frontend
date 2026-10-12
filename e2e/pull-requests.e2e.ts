import { expect, test, type Page, type Route } from '@playwright/test'

import type { PrScope, PullRequestDetail, PullRequestSummary } from '../src/lib/contracts'
import {
  OLD_OID,
  prActor,
  prDetail,
  prReviewer,
  prSummary,
} from '../src/testing/pull-request-fixtures'

const PROJECT = '0e6b2c1a-1111-4222-8333-444455556666'
const NOW = Date.now()
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString()

const project = {
  id: PROJECT,
  kind: 'repo',
  name: 'acme-app',
  repoPath: '/repos/acme-app',
  baseBranch: 'main',
  preview: null,
  deliveryDefault: 'draft_pr',
  createdAt: ago(100),
  updatedAt: ago(100),
  hubPath: null,
  repos: [],
  claudeAccountId: null,
}

/** One PR per column of each board, with the reason the card should say. */
const MINE: { pr: PullRequestSummary; column: string; reason: string }[] = [
  {
    pr: prSummary({ number: 11, isDraft: true, updatedAt: ago(1) }),
    column: 'Draft',
    reason: 'Draft',
  },
  {
    pr: prSummary({ number: 12, ci: 'failure', failingChecks: ['lint'], updatedAt: ago(2) }),
    column: 'Needs work',
    reason: 'CI failed: lint',
  },
  {
    pr: prSummary({
      number: 13,
      reviewDecision: 'APPROVED',
      reviewers: [prReviewer('ana', 'APPROVED')],
      updatedAt: ago(3),
    }),
    column: 'Ready to merge',
    reason: 'Approved by ana · CI green',
  },
  {
    pr: prSummary({
      number: 14,
      reviewers: [prReviewer('marko', 'REQUESTED')],
      updatedAt: ago(4),
    }),
    column: 'In review',
    reason: 'Waiting on marko',
  },
  {
    pr: prSummary({ number: 15, state: 'merged', mergedAt: ago(30), updatedAt: ago(30) }),
    column: 'Done',
    reason: 'Merged 1d ago',
  },
]

const theirs = (patch: Partial<PullRequestSummary>) =>
  prSummary({ author: prActor('ana'), ...patch })
const review = (state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED', commitOid?: string) => ({
  state,
  commitOid: commitOid ?? 'a'.repeat(40),
  submittedAt: ago(20),
})

const ASSIGNED: { pr: PullRequestSummary; column: string; reason: string }[] = [
  {
    pr: theirs({ number: 21, requestedFromMe: true, createdAt: ago(3), updatedAt: ago(1) }),
    column: 'To review',
    reason: 'Requested · opened 3h ago',
  },
  {
    pr: theirs({
      number: 22,
      myLastReview: review('CHANGES_REQUESTED', OLD_OID),
      updatedAt: ago(2),
    }),
    column: 'Re-review',
    reason: 'New commits since you requested changes',
  },
  {
    pr: theirs({ number: 23, myLastReview: review('COMMENTED'), updatedAt: ago(3) }),
    column: 'Waiting on author',
    reason: 'You commented 20h ago',
  },
  {
    pr: theirs({ number: 24, myLastReview: review('APPROVED'), updatedAt: ago(4) }),
    column: 'Approved',
    reason: 'You approved · waiting on others',
  },
  {
    pr: theirs({ number: 25, state: 'closed', updatedAt: ago(40) }),
    column: 'Done',
    reason: 'Closed',
  },
]

const TEAM_PR = theirs({ number: 26, requestedFromMyTeam: true, updatedAt: ago(5) })

const PATCH = [
  'diff --git a/src/app.ts b/src/app.ts',
  '--- a/src/app.ts',
  '+++ b/src/app.ts',
  '@@ -1,3 +1,4 @@',
  ' const a = 1',
  '-const b = 2',
  '+const b = 3',
  '+const c = 4',
  ' export { a }',
  '',
].join('\n')

const DETAIL: PullRequestDetail = prDetail({
  ...theirs({ number: 21, requestedFromMe: true }),
  title: 'Add bulk export',
  bodyHtml: '<h2>Summary</h2><p>Adds <code>exportInvoices</code>.</p>',
  files: [
    { path: 'src/app.ts', additions: 2, deletions: 1, changeType: 'MODIFIED', viewed: false },
  ],
  threads: { unresolved: 1, waitingOnMe: 0 },
  reviewThreads: [
    {
      id: 'T1',
      isResolved: false,
      isOutdated: false,
      path: 'src/app.ts',
      line: 2,
      startLine: null,
      side: 'RIGHT',
      diffHunk: '@@ -1,3 +1,4 @@\n const a = 1\n-const b = 2\n+const b = 3',
      viewerCanResolve: true,
      viewerCanReply: true,
      comments: [
        {
          id: 'C1',
          author: prActor('marko'),
          bodyHtml: '<p>Why 3?</p>',
          createdAt: ago(2),
          isPending: false,
        },
      ],
    },
  ],
  checks: [
    { name: 'lint', state: 'pass', url: null, workflow: 'CI' },
    { name: 'test', state: 'pass', url: null, workflow: 'CI' },
  ],
  commits: [
    {
      oid: 'a'.repeat(40),
      messageHeadline: 'feat: bulk export',
      author: prActor('ana'),
      committedAt: ago(3),
      ci: 'success',
    },
  ],
  timeline: [
    {
      kind: 'comment',
      id: 'IC1',
      author: prActor('marko'),
      bodyHtml: '<p>Looks close.</p>',
      createdAt: ago(2),
    },
  ],
})

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** Every API call answered locally; PR endpoints from the data above. */
async function mockApi(page: Page, options: { unavailable?: boolean } = {}) {
  const lists: { scope: string; teams: string }[] = []
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const url = new URL(route.request().url())
      const path = url.pathname.replace(/^\/api/, '')
      if (path === '/events') return route.abort()
      if (path === '/projects') return json(route, [project])
      if (path === `/projects/${PROJECT}/remote`) {
        return json(route, {
          origin: 'git@github.com:acme/app.git',
          github: true,
          ghLoggedIn: true,
          prPossible: true,
          reason: null,
        })
      }
      if (path.startsWith('/work-orders')) return json(route, [])
      if (path === `/projects/${PROJECT}/pull-requests`) {
        if (options.unavailable === true) {
          return json(
            route,
            {
              error: {
                code: 'pull_requests_unavailable',
                message: 'The GitHub CLI isn’t logged in.',
              },
            },
            422,
          )
        }
        const scope: PrScope =
          url.searchParams.get('scope') === 'assigned' ? 'assigned' : 'mine'
        const teams = url.searchParams.get('teams') ?? 'false'
        lists.push({ scope, teams })
        const items =
          scope === 'mine'
            ? MINE.map((m) => m.pr)
            : [...ASSIGNED.map((a) => a.pr), ...(teams === 'true' ? [TEAM_PR] : [])]
        return json(route, {
          repo: 'acme/app',
          viewer: 'me',
          items,
          fetchedAt: new Date().toISOString(),
        })
      }
      if (path === `/projects/${PROJECT}/pull-requests/21`) return json(route, DETAIL)
      if (path === `/projects/${PROJECT}/pull-requests/21/diff`) {
        return json(route, { patch: PATCH, truncated: false, base: 'b', head: 'a' })
      }
      return json(route, { error: { code: 'not_mocked', message: path } }, 404)
    },
  )
  return { lists }
}

test.beforeEach(async ({ page }, testInfo) => {
  const theme = testInfo.project.name.startsWith('light') ? 'light' : 'dark'
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
})

/** The page never scrolls sideways (only the board does, inside its own box). */
async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

const column = (page: Page, title: string) => page.locator(`section[aria-label="${title}"]`)

test('my board puts each PR in its column with the reason', async ({ page }) => {
  await mockApi(page)
  await page.goto(`/projects/${PROJECT}/pulls/mine`)
  for (const { pr, column: title, reason } of MINE) {
    const card = column(page, title).locator('article', { hasText: `#${pr.number}` })
    await expect(card).toBeVisible()
    await expect(card).toContainText(reason)
  }
  // Needs work is a needs-you column: its count shows in the sidebar.
  await expect(page.getByRole('link', { name: /My pull requests/ })).toContainText('1')
  await expectNoPageOverflow(page)
  await page.screenshot({ path: test.info().outputPath('mine.png') })
})

test('assigned board, and team requests from the toggle', async ({ page }) => {
  const { lists } = await mockApi(page)
  await page.goto(`/projects/${PROJECT}/pulls/assigned`)
  for (const { pr, column: title, reason } of ASSIGNED) {
    const card = column(page, title).locator('article', { hasText: `#${pr.number}` })
    await expect(card).toBeVisible()
    await expect(card).toContainText(reason)
  }
  await expect(page.locator('article', { hasText: '#26' })).toHaveCount(0)
  await page.getByLabel('Include team requests').click()
  await expect(page).toHaveURL(/teams=true/)
  await expect(column(page, 'To review').locator('article', { hasText: '#26' })).toContainText(
    'Team request',
  )
  expect(lists.some((l) => l.scope === 'assigned' && l.teams === 'true')).toBe(true)
  await expectNoPageOverflow(page)
})

test('a project without gh says why and where to fix it', async ({ page }) => {
  await mockApi(page, { unavailable: true })
  await page.goto(`/projects/${PROJECT}/pulls/mine`)
  await expect(page.getByText('Pull requests aren’t available for this project.')).toBeVisible()
  await expect(page.getByText('The GitHub CLI isn’t logged in.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Project settings/ })).toBeVisible()
})

test('keyboard: j/k walk the cards, Enter opens, 1–5 switch tabs, Esc closes', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto(`/projects/${PROJECT}/pulls/assigned`)
  await expect(page.locator('[data-pr-card]').first()).toBeVisible()
  await page.keyboard.press('j')
  await expect(page.locator('[data-pr-card="21"]')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog').getByText('Add bulk export')).toBeVisible()
  await page.keyboard.press('2')
  await expect(page.getByRole('tab', { name: /Files/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.keyboard.press('4')
  await expect(page.getByRole('tab', { name: /Checks/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.keyboard.press('Escape')
  await expect(page).not.toHaveURL(/pr=21/)
})

test('the panel: readiness, overview, files with an inline thread, threads, checks, commits', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto(`/projects/${PROJECT}/pulls/assigned?pr=21&prFull=true`)
  await expect(page.locator('p[aria-live="polite"]')).toHaveText('Your review is next.')
  await expect(page.getByText('Adds')).toBeVisible()
  await expect(page.getByText('Looks close.')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('overview.png') })

  await page.getByRole('tab', { name: /Files/ }).click()
  await expect(page.locator('tr[data-line="RIGHT2"]')).toContainText('const b = 3')
  await expect(page.locator('[data-pr-thread="T1"]')).toContainText('Why 3?')
  await expect(page.getByText('0 / 1 viewed')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('files.png') })

  await page.getByRole('tab', { name: /Threads/ }).click()
  await page.getByRole('button', { name: /^Unresolved/ }).click()
  await expect(page.locator('[data-thread-row="T1"]')).toContainText('src/app.ts:2')

  await page.getByRole('tab', { name: /Checks/ }).click()
  await expect(page.getByText('2/2 passed')).toBeVisible()

  await page.getByRole('tab', { name: /Commits/ }).click()
  await expect(page.getByText('feat: bulk export')).toBeVisible()
  await expectNoPageOverflow(page)
})
