import { expect, test, type Page, type Route } from '@playwright/test'

import {
  postFindingsSchema,
  prReplyInputSchema,
  type PostFindings,
  type PullRequestDetail,
  type ReviewVerdict,
  type YugoToolReview,
} from '../src/lib/contracts'
import { prActor, prDetail, prSummary } from '../src/testing/pull-request-fixtures'

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

const PR = prSummary({ number: 21, author: prActor('ana'), requestedFromMe: true })
const DETAIL: PullRequestDetail = prDetail({
  ...PR,
  title: 'Add bulk export',
  files: [
    { path: 'src/app.ts', additions: 2, deletions: 1, changeType: 'MODIFIED', viewed: false },
  ],
})
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

const VERDICT: ReviewVerdict = {
  recommendation: 'request_changes',
  summary: 'Adds a bulk export; the new constant breaks the totals.',
  findings: [
    {
      id: 'f1',
      severity: 'critical',
      category: 'bug',
      file: 'src/app.ts',
      side: 'RIGHT',
      startLine: null,
      line: 2,
      title: 'b changed from 2 to 3',
      body: 'Every total is off by one now.',
      suggestion: 'const b = 2',
      confidence: 'high',
    },
    {
      id: 'f2',
      severity: 'minor',
      category: 'tests',
      file: null,
      side: 'RIGHT',
      startLine: null,
      line: null,
      title: 'No test for the export',
      body: 'Add one for an empty list.',
      suggestion: null,
      confidence: 'medium',
    },
  ],
}

function reviewOf(patch: Partial<YugoToolReview> = {}): YugoToolReview {
  return {
    workOrderId: '9d1b0c5e-1111-4222-8333-444455556666',
    runId: '9d1b0c5e-2222-4222-8333-444455556666',
    status: 'succeeded',
    costUsd: 0.42,
    pullRequest: {
      number: 21,
      url: PR.url,
      headRefName: PR.headRefName,
      headOid: DETAIL.headOid,
      baseRefName: 'main',
      baseOid: 'c'.repeat(40),
      sinceOid: null,
      openThreads: [],
      posted: [],
      postedThreads: {},
      previousFindings: [],
    },
    stale: false,
    verdict: VERDICT,
    error: null,
    startedAt: ago(1),
    finishedAt: ago(0.5),
    ...patch,
  }
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** The API with one PR and a YugoTool review the test drives. */
async function mockApi(page: Page, initial: YugoToolReview | null, detail = DETAIL) {
  const state = {
    review: initial,
    posts: [] as PostFindings[],
    starts: 0,
    /** Thread writes in order: "reply T1: …" / "resolve T1". */
    threadCalls: [] as string[],
  }
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url())
      const path = url.pathname.replace(/^\/api/, '')
      const pulls = `/projects/${PROJECT}/pull-requests`
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
      if (path === pulls) {
        return json(route, {
          repo: 'acme/app',
          viewer: 'me',
          items: [PR],
          fetchedAt: new Date().toISOString(),
        })
      }
      if (path === `${pulls}/yugotool-reviews`) {
        const r = state.review
        return json(route, {
          items:
            r === null
              ? []
              : [
                  {
                    number: 21,
                    status: r.status,
                    headOid: r.pullRequest.headOid,
                    findings: r.verdict?.findings.length ?? null,
                    posted: r.pullRequest.posted.length,
                  },
                ],
        })
      }
      if (path === `${pulls}/21`) return json(route, detail)
      if (path === `${pulls}/21/diff`) {
        return json(route, { patch: PATCH, truncated: false, base: 'b', head: 'a' })
      }
      if (path === `${pulls}/21/yugotool-review`) {
        if (route.request().method() === 'POST') {
          state.starts += 1
          state.review = reviewOf({ status: 'running', verdict: null, costUsd: 0.12 })
          return json(route, state.review, 201)
        }
        return json(route, { review: state.review })
      }
      const thread = new RegExp(`^${pulls}/21/threads/([^/]+)/(replies|resolve)$`).exec(path)
      if (thread !== null) {
        const [, id, action] = thread
        if (action === 'replies') {
          const { body } = prReplyInputSchema.parse(route.request().postDataJSON())
          state.threadCalls.push(`reply ${id}: ${body}`)
          return json(route, {}, 201)
        }
        state.threadCalls.push(`resolve ${id}`)
        return route.fulfill({ status: 204 })
      }
      if (path === `${pulls}/21/yugotool-review/post`) {
        const body = postFindingsSchema.parse(route.request().postDataJSON())
        state.posts.push(body)
        if (state.review !== null) {
          const posted = [...state.review.pullRequest.posted, ...body.findings.map((f) => f.id)]
          state.review = reviewOf({ pullRequest: { ...state.review.pullRequest, posted } })
        }
        return json(route, state.review)
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

test('start a review, watch it run, triage and add findings to the pending review', async ({
  page,
}) => {
  const api = await mockApi(page, null)
  await page.goto(`/projects/${PROJECT}/pulls/assigned?pr=21&prFull=true`)
  await page.getByRole('button', { name: 'Review with YugoTool' }).click()
  await expect(page.getByRole('button', { name: /Reviewing…/ })).toBeVisible()
  expect(api.starts).toBe(1)

  api.review = reviewOf()
  // The running review polls; it lands within one interval.
  await expect(page.getByRole('button', { name: '2 findings' })).toBeVisible({ timeout: 8_000 })
  await page.getByRole('button', { name: '2 findings' }).click()
  await expect(page.getByText(VERDICT.summary)).toBeVisible()
  await expect(page.getByText('Changes needed')).toBeVisible()

  const findings = page.getByRole('list', { name: 'Findings' })
  await expect(findings.getByRole('checkbox').first()).toBeChecked()
  await expect(findings.getByRole('checkbox').nth(1)).not.toBeChecked()
  await findings.getByRole('textbox', { name: 'Comment title' }).fill('b must stay 2')
  await page.screenshot({ path: test.info().outputPath('yugotool-tab.png') })

  await page.getByRole('button', { name: 'Add 1 to pending review' }).click()
  await expect(findings.getByText('On GitHub')).toBeVisible()
  expect(api.posts).toEqual([
    {
      findings: [
        {
          id: 'f1',
          title: 'b must stay 2',
          body: 'Every total is off by one now.',
          suggestion: 'const b = 2',
        },
      ],
    },
  ])
})

test('Z starts a review from the keyboard', async ({ page }) => {
  const api = await mockApi(page, null)
  await page.goto(`/projects/${PROJECT}/pulls/assigned?pr=21&prFull=true`)
  await expect(page.getByRole('button', { name: 'Review with YugoTool' })).toBeVisible()
  await page.keyboard.press('z')
  await expect(page.getByRole('button', { name: /Reviewing…/ })).toBeVisible()
  expect(api.starts).toBe(1)
})

test('findings show as ghost comments in Files and go to the review one by one', async ({
  page,
}) => {
  const api = await mockApi(page, reviewOf())
  await page.goto(`/projects/${PROJECT}/pulls/assigned?pr=21&prFull=true&prTab=files`)
  const ghost = page.getByRole('article', { name: 'YugoTool finding: b changed from 2 to 3' })
  await expect(ghost).toBeVisible()
  await expect(ghost).toContainText('Every total is off by one now.')
  await page.screenshot({ path: test.info().outputPath('ghost.png') })
  await ghost.getByRole('button', { name: 'Add to review' }).click()
  await expect(ghost).toBeHidden()
  expect(api.posts[0]?.findings.map((f) => f.id)).toEqual(['f1'])
})

test('a stale review blocks posting and offers a re-review', async ({ page }) => {
  const api = await mockApi(page, reviewOf({ stale: true }))
  await page.goto(`/projects/${PROJECT}/pulls/assigned?pr=21&prFull=true&prTab=yugotool`)
  await expect(page.getByRole('button', { name: 'Re-review the new commits' })).toBeVisible()
  await expect(page.getByRole('button', { name: /to pending review/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Re-review', exact: true }).click()
  await expect(page.getByRole('button', { name: /Reviewing…/ })).toBeVisible()
  expect(api.starts).toBe(1)
})

test('a done review on the current head can be re-reviewed from the tab', async ({ page }) => {
  const api = await mockApi(page, reviewOf())
  await page.goto(`/projects/${PROJECT}/pulls/assigned?pr=21&prFull=true&prTab=yugotool`)
  await page.getByRole('button', { name: 'Re-review', exact: true }).click()
  await expect(page.getByText(/Reviewing/).first()).toBeVisible()
  expect(api.starts).toBe(1)
})

test('a done review without findings offers Review again', async ({ page }) => {
  await mockApi(page, reviewOf({ verdict: { ...VERDICT, findings: [] } }))
  await page.goto(`/projects/${PROJECT}/pulls/assigned?pr=21&prFull=true&prTab=yugotool`)
  await expect(page.getByRole('button', { name: 'Review again' })).toBeVisible()
})

test('a stale review without findings offers a plain re-run', async ({ page }) => {
  await mockApi(page, reviewOf({ stale: true, verdict: { ...VERDICT, findings: [] } }))
  await page.goto(`/projects/${PROJECT}/pulls/assigned?pr=21&prFull=true&prTab=yugotool`)
  await expect(page.getByRole('button', { name: 'Re-run on new head' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Re-review', exact: true })).toBeHidden()
})

const previousFinding = (id: string, title: string, threadId: string | null) => ({
  id,
  severity: 'critical' as const,
  category: 'bug',
  file: 'src/app.ts',
  line: 2,
  title,
  body: 'body',
  posted: true,
  threadId,
  threadResolved: threadId === null ? null : false,
})

/** A re-review of new commits: two of the three earlier findings had threads. */
const reReview = () =>
  reviewOf({
    pullRequest: {
      ...reviewOf().pullRequest,
      sinceOid: 'e'.repeat(40),
      previousFindings: [
        previousFinding('p1', 'Totals off by one', 'T1'),
        previousFinding('p2', 'Export ignores filters', 'T2'),
        previousFinding('p3', 'No empty-list test', null),
      ],
    },
    verdict: {
      ...VERDICT,
      findings: [VERDICT.findings[1] ?? VERDICT.findings[0]].filter((f) => f !== undefined),
      previous: [
        { id: 'p1', status: 'fixed', note: 'src/app.ts:2 is back to 2' },
        { id: 'p2', status: 'open', note: 'src/app.ts:3 still exports every row' },
        { id: 'p3', status: 'partly', note: 'a test exists, not for the empty list' },
      ],
    },
  })

test('a re-review shows what was fixed since the last review', async ({ page }) => {
  const api = await mockApi(page, reReview())
  await page.goto(`/projects/${PROJECT}/pulls/assigned?pr=21&prFull=true&prTab=yugotool`)
  const since = page.getByRole('region', { name: 'Since your last review' })
  await expect(since).toContainText('1 fixed · 1 partly · 1 still open')
  await expect(since.getByText('src/app.ts:3 still exports every row')).toBeVisible()
  await expect(page.getByText('New findings')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('re-review.png') })

  // Fixed + open thread: reply "Fixed in <sha>" (default on), then resolve.
  await since.getByRole('button', { name: 'Resolve thread' }).click()
  await expect(since.getByText('Resolved')).toBeVisible()
  expect(api.threadCalls).toEqual([
    `reply T1: Fixed in ${DETAIL.headOid.slice(0, 7)}.`,
    'resolve T1',
  ])

  // Still open + thread: the composer is prefilled with the note.
  await since.getByRole('button', { name: 'Reply “still open”' }).click()
  await expect(since.getByRole('textbox', { name: 'Reply' })).toHaveValue(
    'Still open: src/app.ts:3 still exports every row',
  )
  await since.getByRole('button', { name: 'Send reply' }).click()
  await expect(since.getByText('Replied on GitHub')).toBeVisible()
  expect(api.threadCalls.at(-1)).toBe(
    'reply T2: Still open: src/app.ts:3 still exports every row',
  )

  // No thread: status and note only.
  await expect(since.getByRole('button', { name: /Reply|Resolve/ })).toHaveCount(0)
})

test('resolve without the reply when the box is unticked', async ({ page }) => {
  const api = await mockApi(page, reReview())
  await page.goto(`/projects/${PROJECT}/pulls/assigned?pr=21&prFull=true&prTab=yugotool`)
  const since = page.getByRole('region', { name: 'Since your last review' })
  await since.getByRole('checkbox', { name: /Fixed in/ }).uncheck()
  await since.getByRole('button', { name: 'Resolve thread' }).click()
  await expect(since.getByText('Resolved')).toBeVisible()
  expect(api.threadCalls).toEqual(['resolve T1'])
})

test('the card shows the review', async ({ page }) => {
  await mockApi(page, reviewOf())
  await page.goto(`/projects/${PROJECT}/pulls/assigned`)
  await expect(page.locator('[data-pr-card="21"]')).toBeVisible()
  await expect(page.getByTitle('YugoTool: 2 findings')).toBeVisible()
})

test('the card asks for a re-review when new commits came after findings', async ({ page }) => {
  await mockApi(
    page,
    reviewOf({ pullRequest: { ...reviewOf().pullRequest, headOid: 'f'.repeat(40) } }),
  )
  await page.goto(`/projects/${PROJECT}/pulls/assigned`)
  await expect(
    page.getByTitle('YugoTool: re-review (2 findings on an older commit)'),
  ).toBeVisible()
})

test('the review dialog fits long pending comments', async ({ page }) => {
  const longPath =
    'knowledge/dev-setup/a-very-long-folder-name/and-another-one/storybook-guide.md'
  await mockApi(
    page,
    reviewOf(),
    prDetail({
      ...DETAIL,
      pendingReview: { id: 'PRR_1', comments: 1 },
      reviewThreads: [
        {
          id: 'T9',
          isResolved: false,
          isOutdated: false,
          path: longPath,
          line: 283,
          startLine: null,
          side: 'RIGHT',
          diffHunk: '@@ -1 +1 @@',
          viewerCanResolve: true,
          viewerCanReply: true,
          comments: [
            {
              id: 'C9',
              author: prActor('me'),
              bodyHtml: `<p>${'Doc claims --fg-subtle clears 4.5:1 on all five steps; it does not. '.repeat(3)}</p>`,
              createdAt: ago(1),
              isPending: true,
            },
          ],
        },
      ],
    }),
  )
  await page.goto(`/projects/${PROJECT}/pulls/assigned?pr=21&prFull=true&prTab=yugotool`)
  await page.getByRole('button', { name: 'Submit review' }).click()
  const dialog = page.getByRole('dialog', { name: 'Review #21' })
  await expect(dialog.getByText(`${longPath}:283`)).toBeVisible()
  const box = await dialog.boundingBox()
  const form = await dialog.locator('form').boundingBox()
  expect(box).not.toBeNull()
  expect(form).not.toBeNull()
  if (box && form) expect(form.x + form.width).toBeLessThanOrEqual(box.x + box.width)
  await page.screenshot({ path: test.info().outputPath('review-dialog.png') })
})
