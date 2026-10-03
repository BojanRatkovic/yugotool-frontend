import { LoaderCircle, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDeleteProject } from '@/features/projects/api/delete-project'
import { confirmsDelete } from '@/features/projects/utils/delete-project'
import { ApiError, errorMessage } from '@/lib/api-client'
import type { Project } from '@/lib/contracts'

export const DELETE_CONSEQUENCES =
  'Deletes the line, work orders and run history, plus ZASTAVA’s worktrees for it. Your repository and its branches stay.'

/**
 * "Delete <name>?" with type-the-name confirmation. A 409 (active work) stays
 * in the dialog; success runs `onDeleted` (close + navigate) before the caches
 * drop the project.
 */
export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onDeleted,
}: {
  project: Project
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => Promise<void>
}) {
  const [typed, setTyped] = useState('')
  // Toast here, not in mutate's onSuccess: navigating away unmounts this dialog first.
  const remove = useDeleteProject({
    onDeleted: () => {
      toast.success(`Deleted ${project.name}.`)
      return onDeleted()
    },
  })
  const matches = confirmsDelete(typed, project.name)
  // Active work (409) or a missing project (404): say it here, don't close.
  const inlineError =
    remove.error instanceof ApiError &&
    remove.error.status !== null &&
    remove.error.status < 500
      ? remove.error.message
      : null

  function submit() {
    if (!matches || remove.isPending) return
    remove.mutate(project.id, {
      onError: (error) => {
        if (!(error instanceof ApiError) || error.status === null || error.status >= 500) {
          toast.error(`Couldn't delete the project: ${errorMessage(error)}`)
        }
      },
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (remove.isPending) return
        if (!next) {
          setTyped('')
          remove.reset()
        }
        onOpenChange(next)
      }}
    >
      <AlertDialogContent
        // Land on the name field, not Cancel: typing the name is the next step.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          document.getElementById('delete-project-confirm')?.focus()
        }}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">Delete {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {DELETE_CONSEQUENCES} This can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delete-project-confirm" className="font-normal">
              <span>
                Type <span className="font-mono font-medium select-all">{project.name}</span> to
                confirm
              </span>
            </Label>
            <Input
              id="delete-project-confirm"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              disabled={remove.isPending}
              onChange={(event) => {
                setTyped(event.target.value)
                if (remove.isError) remove.reset()
              }}
              className="font-mono"
              aria-describedby={inlineError === null ? undefined : 'delete-project-error'}
            />
          </div>
          {inlineError === null ? null : (
            <p
              id="delete-project-error"
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-[0.8125rem] text-destructive"
            >
              {inlineError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={remove.isPending}>
              Keep project
            </AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={!matches || remove.isPending}>
              {remove.isPending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              Delete project
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
