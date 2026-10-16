import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Plus, Settings } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { z } from 'zod'

import { WorkOrderPanel, type PanelState } from '@/app/routes/-components/work-order-panel'
import { BoardSkeleton } from '@/components/board/board-skeleton'
import { BranchChip } from '@/components/branch-chip'
import { HeaderActions } from '@/components/layout/header-actions'
import { LoadError } from '@/components/data-state'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CommunityView } from '@/features/community/components/community-view'
import { lineQueries } from '@/features/projects/api/line-queries'
import { LineEditor } from '@/features/projects/components/line-editor'
import { OfferQaCallout } from '@/features/projects/components/offer-qa-callout'
import { repoName, useProject } from '@/features/projects/components/project-nav'
import {
  ProjectSettingsSheet,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from '@/features/projects/components/project-settings-sheet'
import { ProjectKnowledgeSettings } from '@/features/knowledge/components/project-knowledge-settings'
import { ProjectStats } from '@/features/projects/components/project-stats'
import {
  ProjectAccountChip,
  ProjectAccountSelect,
} from '@/features/claude-accounts/components/project-account'
import { systemQueries } from '@/features/system/api/system-queries'
import { NewWorkOrderDialog } from '@/features/work-orders/components/new-work-order-dialog'
import { productiveQueries } from '@/features/integrations/api/productive-queries'
import { ProductiveImportDialog } from '@/features/integrations/components/productive-import-dialog'
import { ProductiveMark } from '@/components/productive-mark'
import { WorkOrderBoard } from '@/features/work-orders/components/work-order-board'
import { isTypingTarget, moveCardFocus } from '@/lib/shortcuts'
import { panelSearchPatch, previewMissing } from '@/app/routes/-components/project-page'
import type { Line, Project } from '@/lib/contracts'

const searchSchema = z.object({
  view: z.enum(['board', 'line', 'review', 'community']).default('board').catch('board'),
  /** Open work order. The URL is the source of truth for the panel. */
  wo: z.string().optional().catch(undefined),
  woTab: z.enum(['activity', 'diff', 'findings', 'shifts', 'qa']).optional().catch(undefined),
  /** Shift number selected in the Shifts tab; the latest with a handoff when absent. */
  shift: z.coerce.number().int().positive().optional().catch(undefined),
  /** QA tab: attempt number and selected check id. */
  qaAttempt: z.coerce.number().int().positive().optional().catch(undefined),
  qaCheck: z.string().optional().catch(undefined),
  /** Project settings sheet open on a section. */
  settings: z.enum(SETTINGS_SECTIONS).optional().catch(undefined),
  /** New-project flow: run "Detect from repo" once when Preview settings open. */
  detect: z.boolean().optional().catch(undefined),
  /** Work order expanded to a full page instead of a side panel. */
  woFull: z.boolean().optional().catch(undefined),
  /** Activity filtered to one station. */
  station: z.string().optional().catch(undefined),
  /** A run from history; the latest when absent. */
  run: z.string().optional().catch(undefined),
  /** "New work order" dialog open. */
  new: z.boolean().optional().catch(undefined),
  /** "Import from Productive" dialog open (spec 0019). */
  import: z.literal('productive').optional().catch(undefined),
})

export const Route = createFileRoute('/projects/$projectId/')({
  validateSearch: searchSchema,
  // Warm the line; failures are rendered in place, not thrown.
  loader: ({ context: { queryClient }, params }) => {
    void queryClient.prefetchQuery(lineQueries.detail(params.projectId))
  },
  component: ProjectPage,
})

function ProjectPage() {
  const { projectId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const project = useProject(projectId)
  const line = useQuery(lineQueries.detail(projectId))
  const reviewLine = useQuery({
    ...lineQueries.review(projectId),
    enabled: search.view === 'review',
  })
  const system = useQuery(systemQueries.info())
  const stations = line.data?.stations ?? []
  const hub = project?.kind === 'hub'
  // A hub project (spec 0014) has no review line or community tab: both are per repo.
  const view =
    hub && (search.view === 'review' || search.view === 'community') ? 'board' : search.view
  const { wo } = search
  const hubRepos = useMemo(
    () => (project?.kind === 'hub' ? project.repos.map((repo) => repo.name) : undefined),
    [project],
  )
  const full = wo !== undefined && search.woFull === true

  const setNew = (open: boolean) =>
    void navigate({ search: (prev) => ({ ...prev, new: open ? true : undefined }) })
  const setImport = (open: boolean) =>
    void navigate({
      search: (prev) => ({ ...prev, new: undefined, import: open ? 'productive' : undefined }),
    })
  const productive = useQuery(productiveQueries.status())
  const productiveConnected = productive.data?.connection != null
  const openWorkOrder = (id: string | undefined) =>
    void navigate({
      search: (prev) => ({
        ...prev,
        wo: id,
        woTab: undefined,
        woFull: id === undefined ? undefined : prev.woFull,
        station: undefined,
        run: undefined,
        shift: undefined,
        qaAttempt: undefined,
        qaCheck: undefined,
      }),
    })
  const setSettings = (open: boolean, section: SettingsSection = 'preview') =>
    void navigate({ search: (prev) => ({ ...prev, settings: open ? section : undefined }) })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return
      if (event.key === 'c' || event.key === 'C') {
        event.preventDefault()
        void navigate({ search: (prev) => ({ ...prev, new: true }) })
      } else if (
        wo === undefined &&
        view === 'board' &&
        (event.key === 'j' || event.key === 'k')
      ) {
        event.preventDefault()
        moveCardFocus('[data-wo-card]', event.key === 'j' ? 1 : -1)
      } else if (event.key === 'Escape' && full) {
        event.preventDefault()
        openWorkOrder(undefined)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const panelState: PanelState = {
    tab: search.woTab ?? 'activity',
    station: search.station,
    run: search.run,
    shift: search.shift,
    qaAttempt: search.qaAttempt,
    qaCheck: search.qaCheck,
    full,
  }
  const panel =
    wo === undefined ? null : (
      <WorkOrderPanel
        key={wo}
        projectId={projectId}
        workOrderId={wo}
        stations={stations}
        baseBranch={project?.baseBranch}
        delivery={project?.deliveryDefault}
        onEditDelivery={() => setSettings(true, 'delivery')}
        onEditLine={() =>
          void navigate({
            search: (prev) => ({ ...prev, view: 'line', wo: undefined, woFull: undefined }),
          })
        }
        state={panelState}
        onChange={(next) =>
          void navigate({
            search: (prev) => ({ ...prev, ...panelSearchPatch(next) }),
          })
        }
        onClose={() => openWorkOrder(undefined)}
        onEditPreview={() => setSettings(true)}
      />
    )

  return (
    <div className="flex h-svh min-w-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <SidebarTrigger aria-label="Toggle sidebar" />
        <ProjectTitle project={project} />
        <ViewTabs
          value={full ? '' : view}
          hub={hub}
          onChange={(value) =>
            void navigate({
              search: (prev) => ({
                ...prev,
                view: value,
                woFull: undefined,
                wo: full ? undefined : prev.wo,
              }),
            })
          }
        />
        <div className="ml-auto flex items-center gap-3">
          <ProjectStats projectId={projectId} authSource={system.data?.authSource} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Project settings"
                onClick={() => setSettings(true)}
              >
                <Settings aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Project settings</TooltipContent>
          </Tooltip>
          <Button size="sm" onClick={() => setNew(true)}>
            <Plus aria-hidden="true" />
            New work order
            <Kbd className="ml-0.5 h-4 bg-primary-foreground/15 text-primary-foreground/80">
              C
            </Kbd>
          </Button>
          <HeaderActions />
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {full ? (
          panel
        ) : (
          <ProjectView
            projectId={projectId}
            view={view}
            line={line}
            reviewLine={reviewLine}
            noPreview={previewMissing(project)}
            hubRepos={hubRepos}
            onOpen={(id) => openWorkOrder(id)}
            onCreate={() => setNew(true)}
            onSetupPreview={() => setSettings(true)}
          />
        )}
      </div>

      <Sheet
        open={wo !== undefined && !full}
        onOpenChange={(open) => (open ? null : openWorkOrder(undefined))}
      >
        <SheetContent
          showCloseButton={false}
          // The work order panel's shortcuts work inside its own sheet.
          data-wo-sheet
          // Land focus on the panel itself, not the title field, so typing doesn't rename.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
          }}
          className="gap-0 p-0 focus-visible:outline-none data-[side=right]:w-[min(1120px,78vw)] data-[side=right]:sm:max-w-none"
        >
          <SheetTitle className="sr-only">Work order</SheetTitle>
          <SheetDescription className="sr-only">
            Pipeline, activity, diff and findings for the selected work order.
          </SheetDescription>
          {full ? null : panel}
        </SheetContent>
      </Sheet>

      <ProjectSettingsSheet
        project={project}
        section={search.settings}
        onSectionChange={(section) => setSettings(true, section)}
        onOpenChange={(open) => setSettings(open)}
        autoDetect={search.detect === true}
        onDeleted={() => navigate({ to: '/' })}
        account={
          project === undefined ? undefined : (
            <ProjectAccountSelect
              projectId={projectId}
              accountId={project.claudeAccountId}
              machineEmail={system.data?.claudeLogin?.email ?? null}
            />
          )
        }
        knowledge={
          <ProjectKnowledgeSettings
            projectId={projectId}
            onManage={() => void navigate({ to: '/settings/knowledge' })}
          />
        }
        onAutoDetected={() =>
          void navigate({ search: (prev) => ({ ...prev, detect: undefined }), replace: true })
        }
      />

      <NewWorkOrderDialog
        projectId={projectId}
        open={search.new === true}
        onOpenChange={setNew}
        repos={hubRepos}
        headerAction={
          productiveConnected ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setImport(true)}
            >
              <ProductiveMark className="size-3.5" />
              <span className="hidden sm:inline">Import from Productive</span>
              <span className="sm:hidden">Import</span>
            </Button>
          ) : null
        }
      />
      <ProductiveImportDialog
        projectId={projectId}
        open={search.import === 'productive'}
        onOpenChange={setImport}
      />
    </div>
  )
}

/** The project's name, its repo folder when that differs, hub or base branch, and account. */
function ProjectTitle({ project }: { project: Project | undefined }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {project !== undefined && repoName(project.repoPath) === project.name ? (
        // The repo folder has the project's name: show it once, the path on hover.
        <Tooltip>
          <TooltipTrigger asChild>
            <h1
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- reveals the full path
              tabIndex={0}
              className="truncate text-sm font-semibold"
            >
              {project.name}
            </h1>
          </TooltipTrigger>
          <TooltipContent className="font-mono">{project.repoPath}</TooltipContent>
        </Tooltip>
      ) : (
        <h1 className="truncate text-sm font-semibold">{project?.name ?? 'Project'}</h1>
      )}
      {project === undefined ? null : (
        <>
          {repoName(project.repoPath) === project.name ? null : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- reveals the full path
                  tabIndex={0}
                  className="truncate font-mono text-xs text-muted-foreground"
                >
                  {repoName(project.repoPath)}
                </span>
              </TooltipTrigger>
              <TooltipContent className="font-mono">{project.repoPath}</TooltipContent>
            </Tooltip>
          )}
          {project.kind === 'hub' ? (
            <span className="inline-flex h-5 shrink-0 items-center rounded-sm bg-muted px-1.5 text-[0.6875rem] text-muted-foreground">
              hub · {project.repos.length} {project.repos.length === 1 ? 'repo' : 'repos'}
            </span>
          ) : (
            <BranchChip branch={project.baseBranch} />
          )}
          <ProjectAccountChip accountId={project.claudeAccountId} />
        </>
      )}
    </div>
  )
}

/** Board / Line / Review line / Community. A hub has no review line or community tab (spec 0014). */
type ProjectViewName = 'board' | 'line' | 'review' | 'community'

function toViewName(next: string): ProjectViewName {
  return next === 'line' || next === 'review' || next === 'community' ? next : 'board'
}

function ViewTabs({
  value,
  hub,
  onChange,
}: {
  value: string
  hub: boolean
  onChange: (view: ProjectViewName) => void
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(toViewName(next))} className="ml-2">
      <TabsList className="h-7">
        <TabsTrigger value="board" className="px-2.5 text-xs">
          Board
        </TabsTrigger>
        <TabsTrigger value="line" className="px-2.5 text-xs">
          Line
        </TabsTrigger>
        {hub ? null : (
          <TabsTrigger
            value="review"
            className="px-2.5 text-xs"
            title="The line a YugoTool review of a pull request runs"
          >
            Review line
          </TabsTrigger>
        )}
        {hub ? null : (
          <TabsTrigger
            value="community"
            className="px-2.5 text-xs"
            title="How this repo compares to GitHub's community standards"
          >
            Community
          </TabsTrigger>
        )}
      </TabsList>
    </Tabs>
  )
}

/** The board, the line or the review line, with their loading and error states. */
function ProjectView({
  projectId,
  view,
  line,
  reviewLine,
  noPreview,
  hubRepos,
  onOpen,
  onCreate,
  onSetupPreview,
}: {
  projectId: string
  view: ProjectViewName
  line: UseQueryResult<Line>
  reviewLine: UseQueryResult<Line>
  noPreview: boolean
  hubRepos: string[] | undefined
  onOpen: (id: string) => void
  onCreate: () => void
  onSetupPreview: () => void
}) {
  // Community reads GitHub, not the line, so it doesn't wait on the line query.
  if (view === 'community') return <CommunityView projectId={projectId} />
  if (line.isPending) {
    return (
      <div className="p-4">
        <BoardSkeleton />
      </div>
    )
  }
  if (line.error !== null && line.data === undefined) {
    return (
      <div className="p-4">
        <LoadError what="the line" message={line.error.message} />
      </div>
    )
  }
  if (view === 'board') {
    return (
      <div className="relative h-full pt-3">
        <WorkOrderBoard
          projectId={projectId}
          stations={line.data?.stations ?? []}
          onOpen={onOpen}
          onCreate={onCreate}
          hubRepos={hubRepos}
        />
        <OfferQaCallout projectId={projectId} variant="floating" />
      </div>
    )
  }
  if (view === 'review') {
    if (reviewLine.error !== null) {
      return (
        <div className="p-4">
          <LoadError what="the review line" message={reviewLine.error.message} />
        </div>
      )
    }
    if (reviewLine.data === undefined) return null
    return (
      <div className="h-full p-4">
        <LineEditor
          key={reviewLine.data.updatedAt}
          kind="review"
          line={reviewLine.data}
          previewMissing={noPreview}
          onSetupPreview={onSetupPreview}
        />
      </div>
    )
  }
  if (line.data === undefined) return null
  return (
    <div className="h-full p-4">
      <LineEditor
        key={line.data.updatedAt}
        line={line.data}
        // Unknown until the project loads: don't flash a warning.
        previewMissing={noPreview}
        onSetupPreview={onSetupPreview}
      />
    </div>
  )
}
