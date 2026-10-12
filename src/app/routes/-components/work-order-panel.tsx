import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { Maximize2, Minimize2, PanelRightClose, PanelRightOpen, X } from 'lucide-react'
import { useEffect, useId, type ComponentProps, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { runQueries, selectRun } from '@/features/runs/api/run-queries'
import { ActivityFeed } from '@/features/runs/components/activity-feed'
import { useDeliveredToast } from '@/features/runs/components/delivery-banner'
import { FindingsView, findingCount } from '@/features/runs/components/findings-view'
import { GateBanner, type HubPlanGate } from '@/features/runs/components/gate-banner'
import { latestResearch, suggestedRepo } from '@/features/runs/utils/hub-plan'
import { ProjectAccountChip } from '@/features/claude-accounts/components/project-account'
import { useProject } from '@/features/projects/components/project-nav'
import { useSplitWorkOrder } from '@/features/work-orders/api/work-order-mutations'
import { PipelineStepper } from '@/features/runs/components/pipeline-stepper'
import { QaView } from '@/features/runs/components/qa-view'
import { RunDiff } from '@/features/runs/components/run-diff'
import { RunOutcomeBanner } from '@/features/runs/components/run-outcome-banner'
import { RunHistory } from '@/features/runs/components/run-history'
import { RunUsage } from '@/features/runs/components/run-usage'
import { ShiftReviewBanner } from '@/features/runs/components/shift-review-banner'
import { ShiftsView } from '@/features/runs/components/shifts-view'
import { hasQaStation, qaDiffCount } from '@/features/runs/utils/qa'
import { hasShiftStation, worksInShifts } from '@/features/runs/utils/shifts'
import { stationStates } from '@/features/runs/utils/station-states'
import { useWorkOrder, useWorkOrders } from '@/features/work-orders/api/use-work-order'
import {
  toggleDetailsRail,
  useDetailsRailOpen,
} from '@/features/work-orders/hooks/use-details-rail'
import { isDetailsRailKey } from '@/features/work-orders/utils/details-rail'
import { WorkOrderDetails } from '@/features/work-orders/components/work-order-details'
import { WorkOrderHeader } from '@/features/work-orders/components/work-order-header'
import { remoteQueries } from '@/features/projects/api/remote-queries'
import { canOpenPullRequest, isDeliveryGate } from '@/features/runs/utils/delivery'
import { requestChangesCopy } from '@/features/runs/utils/request-changes'
import { RecheckCiButton } from '@/features/work-orders/components/ci-recheck'
import { OpenPullRequestAction } from '@/features/work-orders/components/open-pull-request'
import { RunAgainButton } from '@/features/work-orders/components/queue-actions'
import type { DeliveryMode, Project, Run, Station, WorkOrder } from '@/lib/contracts'
import { errorMessage } from '@/lib/api-client'
import { isTypingTarget } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'
import { skillQueries } from '@/lib/skill-queries'

export type PanelTab = 'activity' | 'diff' | 'findings' | 'shifts' | 'qa'

const TABS: readonly PanelTab[] = ['activity', 'diff', 'findings', 'shifts', 'qa']

export interface PanelState {
  tab: PanelTab
  station: string | undefined
  run: string | undefined
  /** Selected shift number in the Shifts tab. */
  shift: number | undefined
  /** QA tab: attempt (1-based; the latest when absent) and selected check. */
  qaAttempt: number | undefined
  qaCheck: string | undefined
  full: boolean
}

function RailSection({
  title,
  hint,
  children,
}: {
  title: string
  /** One muted line under the heading. */
  hint?: string
  children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 border-b px-4 py-4 last:border-b-0"
    >
      <div className="flex flex-col gap-1">
        <h2 className="label-caps">{title}</h2>
        {hint === undefined ? null : <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function PanelSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-busy="true">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-6 w-80" />
      </div>
      <div className="flex gap-4 border-b px-4 py-3">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-36" />
        ))}
      </div>
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-5 w-full" />
        ))}
      </div>
    </div>
  )
}

/**
 * The work order surface: header, pipeline, gate, Activity/Diff/Findings and
 * the details rail. Composes the work-orders and runs features; the URL owns
 * every piece of state here.
 */
export function WorkOrderPanel({
  projectId,
  workOrderId,
  stations,
  baseBranch,
  delivery,
  state,
  onChange,
  onClose,
  onEditPreview,
  onEditDelivery,
}: {
  projectId: string
  workOrderId: string
  stations: Station[]
  baseBranch: string | undefined
  /** The project's delivery on approving the last gate; undefined until it loads. */
  delivery?: DeliveryMode
  state: PanelState
  onChange: (next: Partial<PanelState>) => void
  onClose: () => void
  /** Opens the project's preview settings (QA error state). */
  onEditPreview: () => void
  /** Opens the project's delivery settings (gate menu: "Change project default…"). */
  onEditDelivery: () => void
}) {
  const { workOrder, isLoading } = useWorkOrder(projectId, workOrderId)
  const runs = useQuery(runQueries.list(workOrderId))
  const run = runs.data === undefined ? undefined : selectRun(runs.data, state.run)
  const states = stationStates(stations, run)
  const waiting = run?.stations.find((sr) => sr.status === 'awaiting_approval')
  const findings = findingCount(run)
  const showShifts = hasShiftStation(stations)
  const qaDiffs = run === undefined ? null : qaDiffCount(run.stations)
  const showQa = hasQaStation(stations) || qaDiffs !== null
  const tab =
    (state.tab === 'shifts' && !showShifts) || (state.tab === 'qa' && !showQa)
      ? 'activity'
      : state.tab
  useDeliveredToast(workOrder === undefined ? undefined : workOrder.prUrl)
  const project = useProject(projectId)
  const hubProject = project?.kind === 'hub' ? project : undefined
  // A hub run delivers from its repo (spec 0014); until it has one there is nothing to check.
  const deliveryRepo = run?.repo ?? workOrder?.repo ?? undefined
  const remote = useQuery({
    ...remoteQueries.detail(projectId, hubProject === undefined ? undefined : deliveryRepo),
    enabled: hubProject === undefined || deliveryRepo !== undefined,
  })
  const skills = useQuery(skillQueries.list(projectId))
  const hubPlan = useHubPlanGate(projectId, hubProject, run, workOrder)
  // Unknown (loading, or the check failed) never blocks: the server still says no if it can't.
  const prBlockedReason =
    remote.data?.prPossible === false
      ? (remote.data.reason ?? 'Pull requests can’t be opened from this repo.')
      : null
  const isLatestRun = run !== undefined && run.id === selectRun(runs.data ?? [], undefined)?.id
  const railOpen = useDetailsRailOpen()
  const railId = useId()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // The panel's own sheet (`data-wo-sheet`) isn't an overlay to these shortcuts.
      if (!isDetailsRailKey(event) || isTypingTarget(event.target, 'data-wo-sheet')) return
      event.preventDefault()
      toggleDetailsRail()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (workOrder === undefined) {
    return isLoading ? <PanelSkeleton /> : <WorkOrderNotFound onClose={onClose} />
  }

  const controls = (
    <PanelControls
      railOpen={railOpen}
      railId={railId}
      full={state.full}
      onToggleFull={() => onChange({ full: !state.full })}
      onClose={onClose}
    />
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <WorkOrderHeader
        projectId={projectId}
        workOrder={workOrder}
        controls={controls}
        onDeleted={onClose}
      />
      {stations.length === 0 ? null : (
        <div className="border-b bg-card/40">
          <PipelineStepper
            states={states}
            selectedKey={state.station}
            onSelect={(station) => onChange({ station, tab: 'activity' })}
            overrides={{ model: workOrder.modelOverride, effort: workOrder.effortOverride }}
          />
        </div>
      )}

      <div
        className={cn(
          'grid min-h-0 flex-1',
          railOpen ? 'grid-cols-[minmax(0,1fr)_18.75rem]' : 'grid-cols-[minmax(0,1fr)]',
        )}
      >
        <main className="flex min-h-0 min-w-0 flex-col">
          {run !== undefined && isLatestRun ? (
            <RunOutcomeBanner
              key={run.id}
              run={run}
              prUrl={workOrder.prUrl}
              branch={workOrder.branch}
              onShowActivity={() => onChange({ tab: 'activity', station: undefined })}
              failureAction={
                <RunAgainButton workOrder={workOrder} variant="outline" size="xs" />
              }
              ci={workOrder.ci}
              ciAction={
                workOrder.prUrl === null ? undefined : <RecheckCiButton workOrder={workOrder} />
              }
              deliveredAction={
                canOpenPullRequest(workOrder) ? (
                  <OpenPullRequestAction
                    projectId={projectId}
                    workOrderId={workOrder.id}
                    blockedReason={prBlockedReason}
                  />
                ) : undefined
              }
            />
          ) : null}
          {run === undefined || waiting === undefined || !isLatestRun ? null : (
            <WaitingBanner
              runId={run.id}
              waiting={waiting}
              stations={stations}
              delivery={delivery}
              prBlockedReason={prBlockedReason}
              onEditDelivery={onEditDelivery}
              hubPlan={hubPlan}
              skills={skills.data}
              qaDiffs={qaDiffs}
              onOpenQa={() => onChange({ tab: 'qa' })}
            />
          )}
          <PanelTabs
            tab={tab}
            onTab={(next) => onChange({ tab: next })}
            findings={findings}
            showShifts={showShifts}
            showQa={showQa}
            qaDiffs={qaDiffs}
            stationFilter={
              state.station === undefined || tab !== 'activity'
                ? null
                : (states.find(({ station }) => station.key === state.station)?.station.name ??
                  state.station)
            }
            onClearStation={() => onChange({ station: undefined })}
          />
          <div
            className={cn(
              'relative min-h-0 flex-1',
              // Diff and QA are split panes that scroll their own columns; the panel must not
              // scroll under them (sub-pixel heights otherwise leave a few px of outer scroll).
              run !== undefined && (tab === 'diff' || tab === 'qa')
                ? 'overflow-hidden'
                : 'scrollbar-thin overflow-y-auto',
            )}
          >
            <TabBody
              loading={runs.isPending}
              run={run}
              tab={tab}
              stations={stations}
              state={state}
              onChange={onChange}
              onEditPreview={onEditPreview}
            />
          </div>
        </main>

        <DetailsRail
          id={railId}
          open={railOpen}
          projectId={projectId}
          workOrder={workOrder}
          // A hub run starts from its repo's base branch (spec 0014).
          baseBranch={
            hubProject === undefined
              ? baseBranch
              : hubProject.repos.find((repo) => repo.name === deliveryRepo)?.baseBranch
          }
          repo={hubProject === undefined ? undefined : (deliveryRepo ?? null)}
          accountId={project?.claudeAccountId ?? null}
          run={run}
          states={states}
          runs={runs.isPending ? undefined : (runs.data ?? [])}
          onSelectRun={(runId) => onChange({ run: runId, station: undefined })}
        />
      </div>
    </div>
  )
}

function WorkOrderNotFound({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col items-start gap-2 p-6">
      <p className="text-sm font-medium">Work order not found</p>
      <p className="text-[0.8125rem] text-muted-foreground">
        It may have been removed, or it hasn&rsquo;t synced yet.
      </p>
      <Button variant="outline" size="sm" onClick={onClose}>
        Back to the board
      </Button>
    </div>
  )
}

/** Header buttons: details rail, full page, close. */
function PanelControls({
  railOpen,
  railId,
  full,
  onToggleFull,
  onClose,
}: {
  railOpen: boolean
  railId: string
  full: boolean
  onToggleFull: () => void
  onClose: () => void
}) {
  const railLabel = railOpen ? 'Hide details' : 'Show details'
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={railLabel}
            aria-expanded={railOpen}
            aria-controls={railId}
            aria-keyshortcuts="]"
            // Open is the resting state: don't wear the "menu open" fill ghost buttons get.
            className="aria-expanded:bg-transparent aria-expanded:hover:bg-muted dark:aria-expanded:hover:bg-muted/50"
            onClick={toggleDetailsRail}
          >
            {railOpen ? (
              <PanelRightClose aria-hidden="true" />
            ) : (
              <PanelRightOpen aria-hidden="true" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {railLabel} <span className="font-mono">]</span>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={full ? 'Show as panel' : 'Expand to full page'}
            onClick={onToggleFull}
          >
            {full ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{full ? 'Show as panel' : 'Expand to full page'}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close work order"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Close <span className="font-mono">Esc</span>
        </TooltipContent>
      </Tooltip>
    </>
  )
}

const tabCount = (n: number) => (
  <span className="rounded-sm bg-muted px-1 font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
    {n}
  </span>
)

/** Activity / Diff / Findings (+ Shifts, QA), and the station filter chip on Activity. */
function PanelTabs({
  tab,
  onTab,
  findings,
  showShifts,
  showQa,
  qaDiffs,
  stationFilter,
  onClearStation,
}: {
  tab: PanelTab
  onTab: (tab: PanelTab) => void
  findings: number
  showShifts: boolean
  showQa: boolean
  qaDiffs: number | null
  /** The station Activity is filtered to, by name; null when unfiltered. */
  stationFilter: string | null
  onClearStation: () => void
}) {
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTab(TABS.find((t) => t === value) ?? 'activity')}
      className="gap-0"
    >
      <div className="flex h-10 items-center gap-3 border-b px-4">
        <TabsList variant="line" className="h-10 gap-3 p-0">
          <TabsTrigger value="activity" className="px-0 text-[0.8125rem]">
            Activity
          </TabsTrigger>
          <TabsTrigger value="diff" className="px-0 text-[0.8125rem]">
            Diff
          </TabsTrigger>
          <TabsTrigger value="findings" className="px-0 text-[0.8125rem]">
            Findings
            {findings === 0 ? null : tabCount(findings)}
          </TabsTrigger>
          {showShifts ? (
            <TabsTrigger value="shifts" className="px-0 text-[0.8125rem]">
              Shifts
            </TabsTrigger>
          ) : null}
          {showQa ? (
            <TabsTrigger value="qa" className="px-0 text-[0.8125rem]">
              QA
              {qaDiffs === null || qaDiffs === 0 ? null : tabCount(qaDiffs)}
            </TabsTrigger>
          ) : null}
        </TabsList>
        {stationFilter === null ? null : (
          <button
            type="button"
            onClick={onClearStation}
            className="ml-auto inline-flex h-6 items-center gap-1 rounded-md bg-muted px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {stationFilter}
            <X aria-hidden="true" className="size-3" />
            <span className="sr-only">Clear station filter</span>
          </button>
        )}
      </div>
    </Tabs>
  )
}

/** The selected tab's content, or a skeleton / "Not started". */
function TabBody({
  loading,
  run,
  tab,
  stations,
  state,
  onChange,
  onEditPreview,
}: {
  loading: boolean
  run: Run | undefined
  tab: PanelTab
  stations: Station[]
  state: PanelState
  onChange: (next: Partial<PanelState>) => void
  onEditPreview: () => void
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4" aria-busy="true">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-5 w-full" />
        ))}
      </div>
    )
  }
  if (run === undefined) {
    return (
      <div className="flex flex-col items-start gap-1 p-6">
        <p className="text-sm font-medium">Not started</p>
        <p className="text-[0.8125rem] text-muted-foreground">
          Start the work order to send it down the line. Activity, the diff and findings appear
          here as stations run.
        </p>
      </div>
    )
  }
  switch (tab) {
    case 'diff':
      return <RunDiff run={run} />
    case 'shifts':
      return (
        <ShiftsView
          run={run}
          stations={stations}
          selectedShift={state.shift}
          onSelectShift={(shift) => onChange({ shift })}
        />
      )
    case 'qa':
      return (
        <QaView
          run={run}
          attempt={state.qaAttempt}
          checkId={state.qaCheck}
          onSelect={(next) =>
            onChange({
              ...('attempt' in next ? { qaAttempt: next.attempt } : {}),
              ...('check' in next ? { qaCheck: next.check } : {}),
            })
          }
          onEditPreview={onEditPreview}
        />
      )
    case 'findings':
      return <FindingsView run={run} stations={stations} />
    default:
      return <ActivityFeed run={run} stations={stations} stationKey={state.station} />
  }
}

/** The hub plan gate's choices (spec 0014); undefined outside a hub run that has no repo yet. */
function useHubPlanGate(
  projectId: string,
  hubProject: Project | undefined,
  run: Run | undefined,
  workOrder: WorkOrder | undefined,
): HubPlanGate | undefined {
  const workOrders = useWorkOrders(projectId)
  const splitWorkOrder = useSplitWorkOrder()
  if (
    hubProject === undefined ||
    run === undefined ||
    run.repo !== null ||
    workOrder === undefined
  ) {
    return undefined
  }
  const research = latestResearch(run)
  const repos = hubProject.repos.map((repo) => repo.name)
  return {
    repos,
    suggested: suggestedRepo(workOrder.repo, research, repos),
    split: research?.split ?? null,
    splitDone: workOrders.some((other) => other.followsId === workOrder.id),
    splitting: splitWorkOrder.isPending,
    onCreateSplit: () => {
      const items = research?.split
      if (items === undefined) return
      splitWorkOrder.mutate(
        { workOrderId: workOrder.id, items },
        {
          onSuccess: () =>
            toast.success(
              `Created ${items.length - 1} follow-up work ${items.length === 2 ? 'order' : 'orders'} in the backlog.`,
            ),
          onError: (error) => toast.error(`Couldn't split: ${errorMessage(error)}`),
        },
      )
    },
  }
}

/** A station waits on you: a shift handoff review, else the gate decision. */
function WaitingBanner({
  runId,
  waiting,
  stations,
  delivery,
  prBlockedReason,
  onEditDelivery,
  hubPlan,
  skills,
  qaDiffs,
  onOpenQa,
}: {
  runId: string
  waiting: Run['stations'][number]
  stations: Station[]
  delivery: DeliveryMode | undefined
  prBlockedReason: string | null
  onEditDelivery: () => void
  hubPlan: HubPlanGate | undefined
  skills: ComponentProps<typeof GateBanner>['skills']
  qaDiffs: number | null
  onOpenQa: () => void
}) {
  const waitingStation = stations.find((station) => station.key === waiting.stationKey)
  if (waitingStation !== undefined && worksInShifts(waitingStation)) {
    // A station working in shifts waits on a handoff review, not a gate decision.
    return (
      <ShiftReviewBanner
        key={waiting.id}
        runId={runId}
        stationKey={waiting.stationKey}
        stationName={waitingStation.name}
      />
    )
  }
  return (
    <GateBanner
      key={waiting.id}
      runId={runId}
      stationKey={waiting.stationKey}
      stationName={waitingStation?.name ?? waiting.stationKey}
      prompt={waitingStation?.kind === 'gate' ? waitingStation.prompt : null}
      // The last station's approval delivers the work: offer the delivery choice there.
      delivery={isDeliveryGate(stations, waiting.stationKey) ? delivery : undefined}
      prBlockedReason={prBlockedReason}
      requestChanges={requestChangesCopy(stations, waiting.stationKey)}
      onChangeDefault={onEditDelivery}
      hub={hubPlan}
      skills={skills}
      qaReview={qaDiffs === null ? undefined : { diffs: qaDiffs, onOpen: onOpenQa }}
      // Opening an order that waits on you (click or notification deep
      // link) lands in the comment box; it never steals an active field.
      focusOnMount
    />
  )
}

/** What the Details section is about at this point of the order's life. */
function detailsHint(status: WorkOrder['status']): string {
  if (status === 'running' || status === 'awaiting_approval') {
    return 'Locked while the order is on the line.'
  }
  return status === 'done' ? 'What this work order ran with.' : 'Overrides for the next run.'
}

/** The right rail: details and overrides, cost and context, run history. */
function DetailsRail({
  id,
  open,
  projectId,
  workOrder,
  baseBranch,
  repo,
  accountId,
  run,
  states,
  runs,
  onSelectRun,
}: {
  id: string
  open: boolean
  projectId: string
  workOrder: WorkOrder
  baseBranch: string | undefined
  repo: string | null | undefined
  accountId: string | null
  run: Run | undefined
  states: ReturnType<typeof stationStates>
  /** Undefined while loading. */
  runs: Run[] | undefined
  onSelectRun: (runId: string) => void
}) {
  return (
    <aside
      id={id}
      // Hidden, not unmounted: the toggle's aria-controls keeps a target.
      hidden={!open}
      aria-label="Work order details"
      className="relative min-h-0 scrollbar-thin overflow-y-auto border-l bg-card/30"
    >
      <RailSection title="Details" hint={detailsHint(workOrder.status)}>
        <WorkOrderDetails
          projectId={projectId}
          workOrder={workOrder}
          baseBranch={baseBranch}
          repo={repo}
          worktreePath={run?.worktreePath ?? null}
        />
        <div className="mt-2 empty:hidden">
          <ProjectAccountChip accountId={accountId} />
        </div>
      </RailSection>
      {run === undefined ? null : (
        <RailSection title="Cost & context">
          <RunUsage run={run} states={states} maxBudgetUsd={workOrder.maxBudgetUsd} />
        </RailSection>
      )}
      <RailSection title="Run history">
        {runs === undefined ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <RunHistory runs={runs} selectedId={run?.id} onSelect={onSelectRun} />
        )}
      </RailSection>
    </aside>
  )
}
