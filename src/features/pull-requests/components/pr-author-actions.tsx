import { ChevronDown, GitMerge } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMarkReady, useMergePr } from '@/features/pull-requests/api/pr-mutations'
import { errorMessage } from '@/lib/api-client'
import type { PrMergeMethod, PullRequestDetail } from '@/lib/contracts'

const METHOD_LABEL: Record<PrMergeMethod, string> = {
  merge: 'Create a merge commit',
  squash: 'Squash and merge',
  rebase: 'Rebase and merge',
}

const LAST_METHOD_KEY = 'yugotool.pr-merge-method'

/** The method used last time, when this repo allows it; else the repo's first. */
export function preferredMethod(methods: PrMergeMethod[]): PrMergeMethod | null {
  let last: string | null = null
  try {
    last = localStorage.getItem(LAST_METHOD_KEY)
  } catch {
    // Storage blocked: fall back to the repo's first method.
  }
  return methods.find((m) => m === last) ?? methods[0] ?? null
}

function rememberMethod(method: PrMergeMethod) {
  try {
    localStorage.setItem(LAST_METHOD_KEY, method)
  } catch {
    // A convenience only.
  }
}

/** My PR: Ready for review while a draft, then Merge ▾ (confirmed, naming the base branch). */
export function PrAuthorActions({
  projectId,
  pr,
}: {
  projectId: string
  pr: PullRequestDetail
}) {
  const ready = useMarkReady(projectId, pr.number)
  const merge = useMergePr(projectId, pr.number)
  const [confirm, setConfirm] = useState<PrMergeMethod | null>(null)
  const preferred = preferredMethod(pr.mergeMethods)

  if (pr.state !== 'open') return null
  if (pr.isDraft) {
    return pr.viewerCanUpdate ? (
      <Button
        size="sm"
        className="mr-1"
        disabled={ready.isPending}
        onClick={() =>
          ready.mutate(undefined, {
            onSuccess: () => toast.success('Ready for review.'),
            onError: (error) => toast.error(`Couldn't mark it ready: ${errorMessage(error)}`),
          })
        }
      >
        {ready.isPending ? 'Marking…' : 'Ready for review'}
      </Button>
    ) : null
  }
  if (!pr.viewerCanMerge || preferred === null) return null

  return (
    <>
      <div className="mr-1 flex">
        <Button size="sm" className="rounded-r-none" onClick={() => setConfirm(preferred)}>
          <GitMerge aria-hidden="true" />
          {pr.mergeMethods.length > 1 ? METHOD_LABEL[preferred] : 'Merge'}
        </Button>
        {pr.mergeMethods.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="rounded-l-none border-l border-primary-foreground/20 px-1.5"
                aria-label="Choose merge method"
              >
                <ChevronDown aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {pr.mergeMethods.map((method) => (
                <DropdownMenuItem key={method} onSelect={() => setConfirm(method)}>
                  {METHOD_LABEL[method]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => (open ? null : setConfirm(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Merge #{pr.number} into {pr.baseRefName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === null ? '' : METHOD_LABEL[confirm]}. This lands on{' '}
              <span className="font-mono">{pr.baseRefName}</span> on GitHub and can&rsquo;t be
              undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={merge.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (confirm === null) return
                rememberMethod(confirm)
                merge.mutate(
                  { method: confirm },
                  {
                    onSuccess: () => {
                      setConfirm(null)
                      toast.success(`Merged into ${pr.baseRefName}.`)
                    },
                    onError: (error) => {
                      setConfirm(null)
                      toast.error(`GitHub didn't merge it: ${errorMessage(error)}`)
                    },
                  },
                )
              }}
            >
              {merge.isPending ? 'Merging…' : 'Merge'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
