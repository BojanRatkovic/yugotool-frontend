/**
 * Query key roots shared by feature collections/queries and the realtime
 * layer. Lives in lib so `realtime.ts` can invalidate without importing features.
 */
export const queryKeys = {
  projects: () => ['projects'] as const,
  line: (projectId: string) => ['projects', projectId, 'line'] as const,
  /** The project's review line (spec 0009). */
  reviewLine: (projectId: string) => ['projects', projectId, 'review-line'] as const,
  workOrders: () => ['work-orders'] as const,
  workOrdersByProject: (projectId: string) => ['work-orders', projectId] as const,
  runs: () => ['runs'] as const,
  runsByWorkOrder: (workOrderId: string) => ['runs', 'list', workOrderId] as const,
  runEvents: (runId: string) => ['runs', 'events', runId] as const,
  /** Under `runs` so a runs invalidation (SSE) refreshes cost totals too. */
  projectStats: (projectId: string) => ['runs', 'project-stats', projectId] as const,
  runDiff: (runId: string) => ['runs', 'diff', runId] as const,
  /** Shift rows and the run's memory; SSE `shifts` (and `runs`) invalidate the root. */
  shifts: () => ['shifts'] as const,
  runShifts: (runId: string) => ['shifts', 'list', runId] as const,
  runMemory: (runId: string) => ['shifts', 'memory', runId] as const,
  /** Last preview test of a project; PATCHing the project invalidates it with the root. */
  previewStatus: (projectId: string) => ['projects', projectId, 'preview'] as const,
  /**
   * Saved sign-in session + the interactive sign-in. Under `projects`: the worker
   * publishes `invalidate projects` on every sign-in state change.
   */
  previewSession: (projectId: string) => ['projects', projectId, 'preview-session'] as const,
  /** Where approved work can go (origin, gh); live check, under the project root. */
  /** `repo`: a hub project's repo (spec 0014); omitted for repo projects. */
  projectRemote: (projectId: string, repo?: string) =>
    repo === undefined
      ? (['projects', projectId, 'remote'] as const)
      : (['projects', projectId, 'remote', repo] as const),
  /** Skills a project's agents can load (spec 0015); read from disk, under the project root. */
  projectSkills: (projectId: string) => ['projects', projectId, 'skills'] as const,
  /** Route map of a project; under `projects` so SSE `projects` (discovery done) refreshes it. */
  projectRoutes: (projectId: string) => ['projects', projectId, 'routes'] as const,
  /** QA attempts and checks per run; SSE `qa` invalidates the root. */
  qa: () => ['qa'] as const,
  runQa: (runId: string) => ['qa', 'list', runId] as const,
  repos: () => ['repos'] as const,
  repoBranches: (path: string) => ['repos', 'branches', path] as const,
  system: () => ['system'] as const,
  systemUsage: () => ['system', 'usage'] as const,
  /** Under `system` so saving the repos folder refreshes the repos check too. */
  systemDoctor: () => ['system', 'doctor'] as const,
  settings: () => ['settings'] as const,
  /** Settings → Claude accounts (spec 0016); SSE `claude_accounts` invalidates the root. */
  claudeAccounts: () => ['claude-accounts'] as const,
  dispatcher: () => ['dispatcher'] as const,
  /** Settings → Integrations (spec 0019); SSE `integrations` invalidates the root. */
  integrations: () => ['integrations'] as const,
  productive: () => ['integrations', 'productive'] as const,
  /** Productive projects and tasks: live reads through the API, under the connection. */
  productiveProjects: (query: string) =>
    ['integrations', 'productive', 'projects', query] as const,
  productiveTasks: (filter: {
    projectId: string
    productiveProjectId: string | null
    query: string
    mine: boolean
  }) => ['integrations', 'productive', 'tasks', filter] as const,
  /** The library and each project's choice from it; SSE `knowledge_sources` invalidates the root. */
  knowledge: () => ['knowledge'] as const,
  knowledgeSources: () => ['knowledge', 'sources'] as const,
  projectKnowledge: (projectId: string) => ['knowledge', 'project', projectId] as const,
  /**
   * Pull request boards and panels (spec 0008), straight from GitHub. Never
   * persisted (bodies may be private); writes invalidate the project's root.
   */
  pullRequests: (projectId: string) => ['pull-requests', projectId] as const,
  /** YugoTool reviews of pull requests (spec 0009); the root invalidates every PR's. */
  yugotoolReviews: () => ['yugotool-reviews'] as const,
  yugotoolReview: (projectId: string, number: number, head: string) =>
    ['yugotool-reviews', projectId, 'detail', number, head] as const,
  yugotoolReviewBriefs: (projectId: string) =>
    ['yugotool-reviews', projectId, 'briefs'] as const,
  pullRequestList: (projectId: string, scope: string, teams: boolean) =>
    ['pull-requests', projectId, 'list', scope, teams] as const,
  pullRequest: (projectId: string, number: number) =>
    ['pull-requests', projectId, 'detail', number] as const,
  pullRequestDiff: (projectId: string, number: number, since: string | null, headOid: string) =>
    ['pull-requests', projectId, 'diff', number, since, headOid] as const,
  /** The bell (spec 0011); SSE `notifications` invalidates the root, `notification` prepends. */
  notifications: () => ['notifications'] as const,
  /** The infinite list; its first page carries the unread count. */
  notificationList: () => ['notifications', 'list'] as const,
}
