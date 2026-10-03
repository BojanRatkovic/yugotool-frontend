import { RefreshCw } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useRefreshCi } from '@/features/work-orders/api/work-order-mutations'
import { errorMessage } from '@/lib/api-client'
import type { WorkOrder } from '@/lib/contracts'
import { cn } from '@/lib/utils'

/** A result older than this is checked again when the panel opens. */
const STALE_MS = 2 * 60_000

/** Whether opening the panel should look at CI again (reruns happen outside ZASTAVA). */
export function ciNeedsRefresh(workOrder: WorkOrder, now = Date.now()): boolean {
  if (workOrder.prUrl === null) return false
  const { ci } = workOrder
  if (ci === null) return true
  if (ci.prState !== 'open' || ci.state === 'pending') return false
  return now - new Date(ci.checkedAt).getTime() > STALE_MS
}

/** Once per opened work order: refresh a stale CI result in the background. */
function useCiAutoRefresh(workOrder: WorkOrder) {
  const refresh = useRefreshCi()
  const done = useRef<string | null>(null)
  const needed = ciNeedsRefresh(workOrder)
  const { mutate } = refresh
  useEffect(() => {
    if (!needed || done.current === workOrder.id) return
    done.current = workOrder.id
    mutate({ workOrderId: workOrder.id })
  }, [needed, workOrder.id, mutate])
}

/**
 * "Re-check" next to the CI badge: after a manual rerun on Semaphore or
 * Actions. Mounting it also refreshes a stale result once.
 */
export function RecheckCiButton({ workOrder }: { workOrder: WorkOrder }) {
  useCiAutoRefresh(workOrder)
  const refresh = useRefreshCi()
  const pending = refresh.isPending || workOrder.ci?.state === 'pending'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Check CI again"
          disabled={pending}
          onClick={() =>
            refresh.mutate(
              { workOrderId: workOrder.id },
              { onError: (error) => toast.error(errorMessage(error)) },
            )
          }
        >
          <RefreshCw aria-hidden="true" className={cn(pending && 'animate-spin')} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {workOrder.ci?.state === 'pending' ? 'Watching CI…' : 'Check CI again (after a rerun)'}
      </TooltipContent>
    </Tooltip>
  )
}
