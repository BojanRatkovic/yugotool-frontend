import { useQuery } from '@tanstack/react-query'
import { CircleAlert, LoaderCircle, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  knowledgeQueries,
  useDeleteKnowledgeSource,
  useSyncKnowledgeSource,
} from '@/features/knowledge/api/knowledge-queries'
import { KnowledgeSourceDialog } from '@/features/knowledge/components/knowledge-source-dialog'
import { KIND_LABEL, syncedLine } from '@/features/knowledge/utils/knowledge'
import { errorMessage } from '@/lib/api-client'
import type { KnowledgeSource } from '@/lib/contracts'

/**
 * Settings → Knowledge: the library of team knowledge (repos, folders, files)
 * that projects pick from for their planning stations. Spec 0007.
 */
export function KnowledgeLibrary() {
  const sources = useQuery(knowledgeQueries.sources())
  const [editing, setEditing] = useState<KnowledgeSource | 'new' | null>(null)

  return (
    <section aria-labelledby="knowledge-heading" className="flex flex-col gap-2.5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 id="knowledge-heading" className="text-sm font-semibold">
            Knowledge
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            Team knowledge that planning stations (Research) read before they plan. Add it once
            here, then pick it per project in Project settings → Knowledge. Builders never see
            it.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" />
          Add
        </Button>
      </div>
      <div className="divide-y rounded-lg border bg-card">
        {sources.isPending ? (
          <div className="flex flex-col gap-2 px-4 py-3" aria-busy="true">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3.5 w-72" />
          </div>
        ) : sources.data === undefined ? (
          <p className="px-4 py-3 text-[0.8125rem] text-destructive">
            Couldn’t load knowledge sources: {errorMessage(sources.error)}
          </p>
        ) : sources.data.length === 0 ? (
          <p className="px-4 py-3 text-[0.8125rem] text-muted-foreground">
            Nothing yet. Add a docs repo (like your team’s work repo), a folder or a single .md
            file.
          </p>
        ) : (
          sources.data.map((source) => (
            <SourceRow key={source.id} source={source} onEdit={() => setEditing(source)} />
          ))
        )}
      </div>
      {editing === null ? null : (
        <KnowledgeSourceDialog
          key={editing === 'new' ? 'new' : editing.id}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          source={editing === 'new' ? undefined : editing}
        />
      )}
    </section>
  )
}

function SourceRow({ source, onEdit }: { source: KnowledgeSource; onEdit: () => void }) {
  const sync = useSyncKnowledgeSource()
  const remove = useDeleteKnowledgeSource()
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex items-baseline gap-2 text-[0.8125rem]">
          <span className="font-medium">{source.name}</span>
          <span className="text-xs text-muted-foreground">{KIND_LABEL[source.kind]}</span>
          {source.branch === null ? null : (
            <span className="font-mono text-xs text-muted-foreground">{source.branch}</span>
          )}
        </p>
        <p className="truncate font-mono text-xs text-muted-foreground" title={source.location}>
          {source.location}
        </p>
        {source.lastError === null ? (
          <p className="font-mono text-xs text-muted-foreground tabular-nums">
            {syncedLine(source)}
          </p>
        ) : (
          <p className="flex items-start gap-1 text-xs text-destructive">
            <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            <span className="min-w-0 break-words">Can’t be read: {source.lastError}</span>
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <IconAction
          label="Sync now"
          disabled={sync.isPending}
          onClick={() =>
            sync.mutate(
              { id: source.id },
              {
                onSuccess: (synced) =>
                  synced.lastError === null
                    ? toast.success(`${synced.name}: ${syncedLine(synced)}`)
                    : toast.error(`${synced.name} can’t be read: ${synced.lastError}`),
                onError: (error) => toast.error(errorMessage(error)),
              },
            )
          }
        >
          {sync.isPending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <RefreshCw aria-hidden="true" />
          )}
        </IconAction>
        <IconAction label="Edit" onClick={onEdit}>
          <Pencil aria-hidden="true" />
        </IconAction>
        <IconAction
          label="Remove"
          disabled={remove.isPending}
          onClick={() =>
            remove.mutate(
              { id: source.id },
              {
                onSuccess: () => toast.success(`Removed ${source.name}.`),
                onError: (error) => toast.error(errorMessage(error)),
              },
            )
          }
        >
          <Trash2 aria-hidden="true" />
        </IconAction>
      </div>
    </div>
  )
}

function IconAction({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
