import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { Maximize2, Minimize2, X } from 'lucide-react'
import type { ReactNode } from 'react'

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
import { WorkOrderDetails } from '@/features/work-orders/components/work-order-details'
import { WorkOrderHeader } from '@/features/work-orders/components/work-order-header'
import { remoteQueries } from '@/features/projects/api/remote-queries'
import { canOpenPullRequest, isDeliveryGate } from '@/features/runs/utils/delivery'
import { requestChangesCopy } from '@/features/runs/utils/request-changes'
import { RecheckCiButton } from '@/features/work-orders/components/ci-recheck'
import { OpenPullRequestAction } from '@/features/work-orders/components/open-pull-request'
import { RunAgainButton } from '@/features/work-orders/components/queue-actions'
import type { DeliveryMode, Station } from '@/lib/contracts'
import { errorMessage } from '@/lib/api-client'
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
  const waitingStation = stations.find((station) => station.key === waiting?.stationKey)
  const findings = findingCount(run)
  const showShifts = hasShiftStation(stations)
  const qaDiffs = run === undefined ? null : qaDiffCount(run.stations)
  const showQa = hasQaStation(stations) || qaDiffs !== null
  const tab =
    (state.tab === 'shifts' && !showShifts) || (state.tab === 'qa' && !showQa)
      ? 'activity'
      : state.tab
  useDeliveredToast(workOrder?.prUrl ?? null)
  const project = useProject(projectId)
  const hubProject = project?.kind === 'hub' ? project : undefined
  // A hub run delivers from its repo (spec 0014); until it has one there is nothing to check.
  const deliveryRepo = run?.repo ?? workOrder?.repo ?? undefined
  const remote = useQuery({
    ...remoteQueries.detail(projectId, hubProject === undefined ? undefined : deliveryRepo),
    enabled: hubProject === undefined || deliveryRepo !== undefined,
  })
  const workOrders = useWorkOrders(projectId)
  const skills = useQuery(skillQueries.list(projectId))
  const splitWorkOrder = useSplitWorkOrder()
  const research = latestResearch(run)
  const hubPlan: HubPlanGate | undefined =
    hubProject === undefined ||
    run === undefined ||
    run.repo !== null ||
    workOrder === undefined
      ? undefined
      : {
          repos: hubProject.repos.map((repo) => repo.name),
          suggested: suggestedRepo(
            workOrder.repo,
            research,
            hubProject.repos.map((repo) => repo.name),
          ),
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
  // Unknown (loading, or the check failed) never blocks: the server still says no if it can't.
  const prBlockedReason =
    remote.data?.prPossible === false
      ? (remote.data.reason ?? 'Pull requests can’t be opened from this repo.')
      : null
  const isLatestRun = run !== undefined && run.id === selectRun(runs.data ?? [], undefined)?.id

  if (workOrder === undefined) {
    if (isLoading) return <PanelSkeleton />
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

  const controls = (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={state.full ? 'Show as panel' : 'Expand to full page'}
            onClick={() => onChange({ full: !state.full })}
          >
            {state.full ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{state.full ? 'Show as panel' : 'Expand to full page'}</TooltipContent>
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

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_18.75rem]">
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
          {run === undefined ||
          waiting === undefined ||
          !isLatestRun ? null : waitingStation !== undefined &&
            worksInShifts(waitingStation) ? (
            // A station working in shifts waits on a handoff review, not a gate decision.
            <ShiftReviewBanner
              key={waiting.id}
              runId={run.id}
              stationKey={waiting.stationKey}
              stationName={waitingStation.name}
            />
          ) : (
            <GateBanner
              key={waiting.id}
              runId={run.id}
              stationKey={waiting.stationKey}
              stationName={waitingStation?.name ?? waiting.stationKey}
              prompt={waitingStation?.kind === 'gate' ? waitingStation.prompt : null}
              // The last station's approval delivers the work: offer the delivery choice there.
              delivery={isDeliveryGate(stations, waiting.stationKey) ? delivery : undefined}
              prBlockedReason={prBlockedReason}
              requestChanges={requestChangesCopy(stations, waiting.stationKey)}
              onChangeDefault={onEditDelivery}
              hub={hubPlan}
              skills={skills.data}
              qaReview={
                qaDiffs === null
                  ? undefined
                  : { diffs: qaDiffs, onOpen: () => onChange({ tab: 'qa' }) }
              }
              // Opening an order that waits on you (click or notification deep
              // link) lands in the comment box; it never steals an active field.
              focusOnMount
            />
          )}
          <Tabs
            value={tab}
            onValueChange={(value) =>
              onChange({ tab: TABS.find((t) => t === value) ?? 'activity' })
            }
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
                  {findings === 0 ? null : (
                    <span className="rounded-sm bg-muted px-1 font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
                      {findings}
                    </span>
                  )}
                </TabsTrigger>
                {showShifts ? (
                  <TabsTrigger value="shifts" className="px-0 text-[0.8125rem]">
                    Shifts
                  </TabsTrigger>
                ) : null}
                {showQa ? (
                  <TabsTrigger value="qa" className="px-0 text-[0.8125rem]">
                    QA
                    {qaDiffs === null || qaDiffs === 0 ? null : (
                      <span className="rounded-sm bg-muted px-1 font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
                        {qaDiffs}
                      </span>
                    )}
                  </TabsTrigger>
                ) : null}
              </TabsList>
              {state.station === undefined || tab !== 'activity' ? null : (
                <button
                  type="button"
                  onClick={() => onChange({ station: undefined })}
                  className="ml-auto inline-flex h-6 items-center gap-1 rounded-md bg-muted px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {states.find(({ station }) => station.key === state.station)?.station.name ??
                    state.station}
                  <X aria-hidden="true" className="size-3" />
                  <span className="sr-only">Clear station filter</span>
                </button>
              )}
            </div>
          </Tabs>
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
            {runs.isPending ? (
              <div className="flex flex-col gap-2 p-4" aria-busy="true">
                {Array.from({ length: 8 }, (_, index) => (
                  <Skeleton key={index} className="h-5 w-full" />
                ))}
              </div>
            ) : run === undefined ? (
              <div className="flex flex-col items-start gap-1 p-6">
                <p className="text-sm font-medium">Not started</p>
                <p className="text-[0.8125rem] text-muted-foreground">
                  Start the work order to send it down the line. Activity, the diff and findings
                  appear here as stations run.
                </p>
              </div>
            ) : tab === 'diff' ? (
              <RunDiff run={run} />
            ) : tab === 'shifts' ? (
              <ShiftsView
                run={run}
                stations={stations}
                selectedShift={state.shift}
                onSelectShift={(shift) => onChange({ shift })}
              />
            ) : tab === 'qa' ? (
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
            ) : tab === 'findings' ? (
              <FindingsView run={run} stations={stations} />
            ) : (
              <ActivityFeed run={run} stations={stations} stationKey={state.station} />
            )}
          </div>
        </main>

        <aside
          aria-label="Work order details"
          className="relative min-h-0 scrollbar-thin overflow-y-auto border-l bg-card/30"
        >
          <RailSection
            title="Details"
            hint={
              workOrder.status === 'running' || workOrder.status === 'awaiting_approval'
                ? 'Locked while the order is on the line.'
                : workOrder.status === 'done'
                  ? 'What this work order ran with.'
                  : 'Overrides for the next run.'
            }
          >
            <WorkOrderDetails
              projectId={projectId}
              workOrder={workOrder}
              // A hub run starts from its repo's base branch (spec 0014).
              baseBranch={
                hubProject === undefined
                  ? baseBranch
                  : hubProject.repos.find((repo) => repo.name === deliveryRepo)?.baseBranch
              }
              repo={hubProject === undefined ? undefined : (deliveryRepo ?? null)}
              worktreePath={run?.worktreePath ?? null}
            />
          </RailSection>
          {run === undefined ? null : (
            <RailSection title="Cost & context">
              <RunUsage run={run} states={states} maxBudgetUsd={workOrder.maxBudgetUsd} />
            </RailSection>
          )}
          <RailSection title="Run history">
            {runs.isPending ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <RunHistory
                runs={runs.data ?? []}
                selectedId={run?.id}
                onSelect={(runId) => onChange({ run: runId, station: undefined })}
              />
            )}
          </RailSection>
        </aside>
      </div>
    </div>
  )
}
