import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { projectsCollection } from '@/features/projects/api/projects-collection'
import { BranchSelect } from '@/features/projects/components/branch-select'
import { RepoPicker } from '@/features/projects/components/repo-picker'
import { errorMessage } from '@/lib/api-client'
import { createProjectSchema } from '@/lib/contracts'

const formSchema = createProjectSchema
  .omit({ id: true })
  .extend({ baseBranch: createProjectSchema.shape.baseBranch.removeDefault() })

/**
 * Controlled when `open`/`onOpenChange` are given (command palette); otherwise owns its state.
 * After creating, opens the project's Preview settings with detection from the repo applied.
 */
export function CreateProjectDialog({
  open: controlledOpen,
  onOpenChange,
  reposRoot,
  onOpenSettings,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Folder the repo picker scans, shown in the picker. */
  reposRoot?: string
  /** Opens Settings at the Repos folder field. */
  onOpenSettings?: () => void
} = {}) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = controlledOpen ?? ownOpen
  const setOpen = onOpenChange ?? setOwnOpen
  const [manualPath, setManualPath] = useState(false)
  const navigate = useNavigate()

  const form = useForm({
    defaultValues: { name: '', repoPath: '', baseBranch: 'main' },
    validators: { onSubmit: formSchema },
    onSubmit: ({ value, formApi }) => {
      const now = new Date().toISOString()
      const id = crypto.randomUUID()
      const tx = projectsCollection.insert({
        id,
        name: value.name.trim(),
        repoPath: value.repoPath.trim(),
        baseBranch: value.baseBranch.trim(),
        preview: null,
        localOnly: true,
        draftPrs: false,
        createdAt: now,
        updatedAt: now,
      })
      tx.isPersisted.promise.catch((error: unknown) => {
        toast.error(`Couldn't create project: ${errorMessage(error)}`)
      })
      formApi.reset()
      setManualPath(false)
      setOpen(false)
      void navigate({
        to: '/projects/$projectId',
        params: { projectId: id },
        search: { view: 'board', settings: 'preview', detect: true },
      })
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined ? (
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label="New project">
            <Plus aria-hidden="true" />
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Point ZASTAVA at a local git repository.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field name="repoPath">
            {(field) => (
              <FormField id={field.name} label="Repository" errors={field.state.meta.errors}>
                {manualPath ? (
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="/Users/you/code/invoicing"
                    className="font-mono"
                  />
                ) : (
                  <RepoPicker
                    id={field.name}
                    value={field.state.value}
                    reposRoot={reposRoot}
                    onOpenSettings={
                      onOpenSettings === undefined
                        ? undefined
                        : () => {
                            setOpen(false)
                            onOpenSettings()
                          }
                    }
                    onPick={(repo) => {
                      field.handleChange(repo.path)
                      if (form.getFieldValue('name').trim() === '') {
                        form.setFieldValue('name', repo.name)
                      }
                      form.setFieldValue('baseBranch', repo.currentBranch ?? 'main')
                    }}
                  />
                )}
                <button
                  type="button"
                  className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => setManualPath((manual) => !manual)}
                >
                  {manualPath ? 'Pick from detected repositories' : 'Enter path manually'}
                </button>
              </FormField>
            )}
          </form.Field>
          <form.Field name="name">
            {(field) => (
              <FormField id={field.name} label="Name" errors={field.state.meta.errors}>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Invoicing"
                />
              </FormField>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.values.repoPath}>
            {(repoPath) => (
              <form.Field name="baseBranch">
                {(field) => (
                  <FormField
                    id={field.name}
                    label="Base branch"
                    errors={field.state.meta.errors}
                  >
                    <BranchSelect
                      id={field.name}
                      repoPath={manualPath ? '' : repoPath}
                      value={field.state.value}
                      onChange={(branch) => field.handleChange(branch)}
                    />
                  </FormField>
                )}
              </form.Field>
            )}
          </form.Subscribe>
          {/* Mirrors DEFAULT_STATIONS in @zastava/contracts. */}
          <p className="text-xs text-muted-foreground">
            You get a default line (Research → Approve plan → Build → Validate → Final review).
            Change it any time in Line. Next, the project&rsquo;s preview settings open, filled
            in from the repo.
          </p>
          <DialogFooter>
            <Button type="submit">Create project</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
