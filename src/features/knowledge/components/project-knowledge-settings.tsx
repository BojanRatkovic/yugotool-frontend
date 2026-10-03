import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, CircleAlert } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  knowledgeQueries,
  useSetProjectKnowledge,
} from '@/features/knowledge/api/knowledge-queries'
import { KIND_LABEL, pickedSources, syncedLine } from '@/features/knowledge/utils/knowledge'
import { errorMessage } from '@/lib/api-client'
import type { KnowledgeSource } from '@/lib/contracts'
import { cn } from '@/lib/utils'

/**
 * Project settings → Knowledge: which library sources this project's planning
 * stations read, in order. Saves on every change, like Delivery.
 */
export function ProjectKnowledgeSettings({
  projectId,
  onManage,
}: {
  projectId: string
  /** Opens Settings → Knowledge. */
  onManage: () => void
}) {
  const sources = useQuery(knowledgeQueries.sources())
  const picked = useQuery(knowledgeQueries.project(projectId))
  const save = useSetProjectKnowledge(projectId)
  // Show the requested order while the PUT is in flight.
  const ids = save.isPending ? save.variables.sourceIds : (picked.data?.sourceIds ?? [])

  function commit(sourceIds: string[]) {
    save.mutate({ sourceIds }, { onError: (error) => toast.error(errorMessage(error)) })
  }

  const all = sources.data ?? []
  const chosen = pickedSources(all, ids)
  const rest = all.filter((source) => !ids.includes(source.id))

  return (
    <div className="relative flex min-h-0 flex-1 scrollbar-thin flex-col gap-4 overflow-y-auto p-4">
      <section aria-labelledby="project-knowledge-heading" className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 id="project-knowledge-heading" className="text-sm font-semibold">
              Knowledge for planning
            </h2>
            <p className="text-[0.8125rem] text-muted-foreground">
              Stations with “Reads team knowledge” on (Research, by default) read these before
              they plan, in this order. Builders never see them.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onManage}>
            Manage sources
          </Button>
        </div>
        {sources.isPending || picked.isPending ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : all.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-4 text-[0.8125rem] text-muted-foreground">
            No knowledge sources yet. Add your team’s work repo or a docs folder under{' '}
            <button
              type="button"
              onClick={onManage}
              className="underline underline-offset-4 hover:text-foreground"
            >
              Settings → Knowledge
            </button>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...chosen, ...rest].map((source) => {
              const position = ids.indexOf(source.id)
              const on = position >= 0
              return (
                <SourceItem
                  key={source.id}
                  source={source}
                  on={on}
                  disabled={save.isPending}
                  onToggle={(next) =>
                    commit(next ? [...ids, source.id] : ids.filter((id) => id !== source.id))
                  }
                  onMove={
                    on
                      ? (delta) => {
                          const target = position + delta
                          if (target < 0 || target >= ids.length) return
                          const next = [...ids]
                          next.splice(position, 1)
                          next.splice(target, 0, source.id)
                          commit(next)
                        }
                      : undefined
                  }
                  first={position === 0}
                  last={position === ids.length - 1}
                />
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function SourceItem({
  source,
  on,
  disabled,
  onToggle,
  onMove,
  first,
  last,
}: {
  source: KnowledgeSource
  on: boolean
  disabled: boolean
  onToggle: (on: boolean) => void
  onMove?: (delta: -1 | 1) => void
  first: boolean
  last: boolean
}) {
  const switchId = `project-knowledge-${source.id}`
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-md border bg-card/50 px-3 py-2.5',
        on && 'border-foreground/40 bg-card',
      )}
    >
      <Switch id={switchId} checked={on} disabled={disabled} onCheckedChange={onToggle} />
      <Label
        htmlFor={switchId}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 font-normal"
      >
        <span className="flex items-baseline gap-2 text-[0.8125rem]">
          <span className="font-medium">{source.name}</span>
          <span className="text-xs text-muted-foreground">{KIND_LABEL[source.kind]}</span>
        </span>
        {source.lastError === null ? (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {syncedLine(source)}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
            Can’t be read; runs skip it until it syncs.
          </span>
        )}
      </Label>
      {onMove === undefined ? null : (
        <span className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Move ${source.name} up`}
            disabled={disabled || first}
            onClick={() => onMove(-1)}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Move ${source.name} down`}
            disabled={disabled || last}
            onClick={() => onMove(1)}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
        </span>
      )}
    </li>
  )
}
