import { useForm } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SkillTextarea } from '@/components/skill-textarea'
import { workOrdersCollection } from '@/features/work-orders/api/work-orders-collection'
import { OverrideFields } from '@/features/work-orders/components/override-fields'
import {
  budgetFieldSchema,
  fromOverrideValues,
  toOverrideValues,
} from '@/features/work-orders/utils/overrides'
import { errorMessage } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { createWorkOrderSchema, effortSchema } from '@/lib/contracts'
import { skillQueries } from '@/lib/skill-queries'
import { z } from 'zod'

/** The Repo field's value for "Research picks". */
const AUTO = ''
/** Radix Select items can't have an empty value. */
const AUTO_ITEM = '__auto__'

const formSchema = createWorkOrderSchema.pick({ title: true }).extend({
  repo: z.string(),
  description: createWorkOrderSchema.shape.description.removeDefault(),
  modelOverride: createWorkOrderSchema.shape.modelOverride.unwrap(),
  effortOverride: effortSchema.nullable(),
  budget: budgetFieldSchema,
})

export function NewWorkOrderForm({
  projectId,
  position,
  onDone,
  className,
  repos,
}: {
  projectId: string
  position: number
  onDone: () => void
  className?: string
  /** A hub project's repos (spec 0014): a Repo select, Auto by default. */
  repos?: string[]
}) {
  const skills = useQuery(skillQueries.list(projectId)).data
  const form = useForm({
    defaultValues: { title: '', description: '', repo: AUTO, ...toOverrideValues({}) },
    validators: { onSubmit: formSchema },
    onSubmit: ({ value, formApi }) => {
      const now = new Date().toISOString()
      const tx = workOrdersCollection(projectId).insert({
        id: crypto.randomUUID(),
        projectId,
        kind: 'build',
        title: value.title.trim(),
        description: value.description,
        pullRequest: null,
        status: 'backlog',
        stationKey: null,
        position,
        repo: repos === undefined || value.repo === AUTO ? null : value.repo,
        followsId: null,
        branch: null,
        currentRunId: null,
        queueMode: null,
        queuedAt: null,
        source: null,
        ...fromOverrideValues(value),
        prUrl: null,
        ci: null,
        createdAt: now,
        updatedAt: now,
      })
      tx.isPersisted.promise.catch((error: unknown) => {
        toast.error(`Couldn't create work order: ${errorMessage(error)}`)
      })
      formApi.reset()
      onDone()
    },
  })

  return (
    <form
      // Zod validates the budget; no native step/min bubble.
      noValidate
      className={cn('flex flex-col gap-3 rounded-md border bg-card p-3', className)}
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field name="title">
        {(field) => (
          <FormField id="new-wo-title" label="Title" errors={field.state.meta.errors}>
            <Input
              id="new-wo-title"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Add invoice reminders"
            />
          </FormField>
        )}
      </form.Field>
      <form.Field name="description">
        {(field) => (
          <FormField
            id="new-wo-description"
            label="Description"
            errors={field.state.meta.errors}
          >
            <SkillTextarea
              id="new-wo-description"
              value={field.state.value}
              onBlur={field.handleBlur}
              onValueChange={field.handleChange}
              skills={skills}
              rows={10}
              placeholder="What should change, and how will you know it's done?"
              className="max-h-[45vh] min-h-56 overflow-y-auto leading-relaxed"
            />
          </FormField>
        )}
      </form.Field>
      {repos === undefined ? null : (
        <form.Field name="repo">
          {(field) => (
            <FormField id="new-wo-repo" label="Repo" errors={field.state.meta.errors}>
              <Select
                value={field.state.value === AUTO ? AUTO_ITEM : field.state.value}
                onValueChange={(value) =>
                  field.handleChange(value === AUTO_ITEM ? AUTO : value)
                }
              >
                <SelectTrigger id="new-wo-repo" className="w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_ITEM}>Auto · Research picks</SelectItem>
                  {repos.map((repo) => (
                    <SelectItem key={repo} value={repo} className="font-mono">
                      {repo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
        </form.Field>
      )}
      <form.Field name="budget">
        {(budget) => (
          <form.Subscribe
            selector={(state) =>
              [state.values.modelOverride, state.values.effortOverride] as const
            }
          >
            {([modelOverride, effortOverride]) => (
              <OverrideFields
                idPrefix="new-wo"
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
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Create work order
        </Button>
      </div>
    </form>
  )
}
