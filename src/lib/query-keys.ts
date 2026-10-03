/**
 * Query key roots shared by feature collections/queries and the realtime
 * layer. Lives in lib so `realtime.ts` can invalidate without importing features.
 */
export const queryKeys = {
  projects: () => ['projects'] as const,
  line: (projectId: string) => ['projects', projectId, 'line'] as const,
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
  dispatcher: () => ['dispatcher'] as const,
}
