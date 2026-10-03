import { useForm } from '@tanstack/react-form'
import { type ReactNode } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { CopyButton } from '@/components/copy-button'
import { modelLabel } from '@/components/model-select'
import { Button } from '@/components/ui/button'
import { workOrdersCollection } from '@/features/work-orders/api/work-orders-collection'
import { OverrideFields } from '@/features/work-orders/components/override-fields'
import {
  budgetFieldSchema,
  fromOverrideValues,
  toOverrideValues,
} from '@/features/work-orders/utils/overrides'
import { errorMessage } from '@/lib/api-client'
import { effortSchema, type WorkOrder } from '@/lib/contracts'
import { basename, formatUsd } from '@/lib/format'

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-6 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1 font-mono text-xs">{children}</dd>
    </div>
  )
}

/**
 * Overrides only matter for a run that hasn't started yet: before the first
 * run, or before "Run again" after a failed, rejected or cancelled one.
 */
export function overridesEditable(status: WorkOrder['status']): boolean {
  return (
    status === 'backlog' ||
    status === 'queued' ||
    status === 'failed' ||
    status === 'rejected' ||
    status === 'cancelled'
  )
}

/** What the run used (or uses), as plain text — nothing to change here. */
function OverridesSummary({ workOrder }: { workOrder: WorkOrder }) {
  return (
    <dl className="flex flex-col gap-1">
      <Meta label="Model">
        <span className="truncate">
          {workOrder.modelOverride === null
            ? 'Line default'
            : modelLabel(workOrder.modelOverride)}
        </span>
      </Meta>
      <Meta label="Effort">{workOrder.effortOverride ?? 'Line default'}</Meta>
      <Meta label="Budget">
        {workOrder.maxBudgetUsd === null ? 'No cap' : formatUsd(workOrder.maxBudgetUsd)}
      </Meta>
    </dl>
  )
}

const overridesSchema = z.object({
  modelOverride: z.string().nullable(),
  effortOverride: effortSchema.nullable(),
  budget: budgetFieldSchema,
})

function OverridesForm({ projectId, workOrder }: { projectId: string; workOrder: WorkOrder }) {
  const form = useForm({
    defaultValues: toOverrideValues(workOrder),
    validators: { onSubmit: overridesSchema },
    onSubmit: ({ value }) => {
      const next = fromOverrideValues(value)
      const tx = workOrdersCollection(projectId).update(workOrder.id, (draft) => {
        draft.modelOverride = next.modelOverride
        draft.effortOverride = next.effortOverride
        draft.maxBudgetUsd = next.maxBudgetUsd
      })
      tx.isPersisted.promise.then(
        () => toast.success('Saved the overrides.'),
        (error: unknown) => toast.error(`Couldn't save the overrides: ${errorMessage(error)}`),
      )
    },
  })

  return (
    <form
      // Zod validates the budget; no native step/min bubble.
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field name="budget">
        {(budget) => (
          <form.Subscribe
            selector={(state) =>
              [state.values.modelOverride, state.values.effortOverride] as const
            }
          >
            {([modelOverride, effortOverride]) => (
              <OverrideFields
                idPrefix={`wo-${workOrder.id}`}
                layout="stack"
                values={{ modelOverride, effortOverride, budget: budget.state.value }}
                budgetErrors={budget.state.meta.errors}
                onModel={(value) => form.setFieldValue('modelOverride', value)}
                onEffort={(value) => form.setFieldValue('effortOverride', value)}
                onBudget={(value) => budget.handleChange(value)}
              />
            )}
          </form.Subscribe>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.isDirty}>
        {(isDirty) =>
          isDirty ? (
            <Button type="submit" size="sm" variant="outline" className="self-start">
              Save overrides
            </Button>
          ) : null
        }
      </form.Subscribe>
    </form>
  )
}

/** Right-rail "Details": overrides plus where the work lives. */
export function WorkOrderDetails({
  projectId,
  workOrder,
  baseBranch,
  worktreePath,
}: {
  projectId: string
  workOrder: WorkOrder
  baseBranch: string | undefined
  worktreePath: string | null
}) {
  return (
    <div className="flex flex-col gap-4">
      {overridesEditable(workOrder.status) ? (
        // Remount on server changes so the form shows the saved values.
        <OverridesForm key={workOrder.updatedAt} projectId={projectId} workOrder={workOrder} />
      ) : (
        <OverridesSummary workOrder={workOrder} />
      )}
      <dl className="flex flex-col gap-1">
        <Meta label="Branch">
          {workOrder.branch === null ? (
            <span className="text-muted-foreground">Created on start</span>
          ) : (
            <>
              <span className="truncate" title={workOrder.branch}>
                {workOrder.branch}
              </span>
              <CopyButton value={workOrder.branch} label="Copy branch name" />
            </>
          )}
        </Meta>
        {baseBranch === undefined ? null : (
          <Meta label="Base">
            <span className="truncate">{baseBranch}</span>
          </Meta>
        )}
        {worktreePath === null ? null : (
          <Meta label="Worktree">
            <span className="truncate" title={worktreePath}>
              …/{basename(worktreePath).slice(0, 8)}
            </span>
            <CopyButton value={worktreePath} label="Copy worktree path" />
          </Meta>
        )}
      </dl>
    </div>
  )
}
