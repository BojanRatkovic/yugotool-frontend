import {
  ChevronDown,
  CircleAlert,
  GitPullRequest,
  GitPullRequestDraft,
  LoaderCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useOpenPullRequest } from '@/features/work-orders/api/work-order-mutations'
import { ApiError, errorMessage } from '@/lib/api-client'

/**
 * "Open pull request" for work delivered locally: a split button (ready, or
 * draft from the menu). Takes ~10s; both halves wait. A refusal (409) is shown
 * inline, next to the buttons, so the user can fix it and retry. Success shows
 * the PR in the Delivered banner (prUrl) and toasts via the panel's delivered toast.
 */
export function OpenPullRequestAction({
  projectId,
  workOrderId,
  blockedReason = null,
}: {
  projectId: string
  workOrderId: string
  /** Why a PR can't be opened from this repo (no origin, not GitHub, gh logged out). */
  blockedReason?: string | null
}) {
  const open = useOpenPullRequest({ projectId, workOrderId })
  const refused =
    open.error instanceof ApiError && open.error.status === 409 ? open.error.message : null

  function run(draft: boolean) {
    if (open.isPending) return
    open.mutate(
      { draft },
      {
        onError: (error) => {
          if (!(error instanceof ApiError) || error.status !== 409) {
            toast.error(`Couldn't open the pull request: ${errorMessage(error)}`)
          }
        },
      },
    )
  }

  return (
    <>
      {/* Its own line under the banner row (the banner wraps), so the branch never truncates. */}
      {refused === null ? null : (
        <p role="alert" className="order-last basis-full pl-7 text-xs text-destructive">
          {refused}
        </p>
      )}
      {blockedReason === null || refused !== null ? null : (
        <p className="order-last flex basis-full items-center gap-1.5 pl-7 text-xs text-muted-foreground">
          <CircleAlert aria-hidden="true" className="size-3.5 shrink-0 text-status-queued" />
          Pull request not possible: {blockedReason}
        </p>
      )}
      <div className="flex shrink-0 items-center">
        <Button
          size="sm"
          variant="outline"
          disabled={open.isPending || blockedReason !== null}
          onClick={() => run(false)}
          // Fixed width: the label grows to "Opening draft pull request…" while pending.
          className="min-w-60 rounded-r-none bg-background"
        >
          {open.isPending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <GitPullRequest aria-hidden="true" />
          )}
          {open.isPending
            ? open.variables.draft
              ? 'Opening draft pull request…'
              : 'Opening pull request…'
            : 'Open pull request'}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              disabled={open.isPending || blockedReason !== null}
              aria-label="More pull request options"
              className="rounded-l-none border-l-0 bg-background px-1.5"
            >
              <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuItem
              onSelect={() => run(true)}
              className="flex-col items-start gap-0.5"
            >
              <span className="flex items-center gap-2 text-[0.8125rem] font-medium">
                <GitPullRequestDraft aria-hidden="true" />
                Open draft pull request
              </span>
              <span className="text-xs text-muted-foreground">
                Reviewers see it as work in progress until you mark it ready.
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
