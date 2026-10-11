import { useForm } from '@tanstack/react-form'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  useCreateKnowledgeSource,
  useUpdateKnowledgeSource,
} from '@/features/knowledge/api/knowledge-queries'
import { syncedLine } from '@/features/knowledge/utils/knowledge'
import { errorMessage } from '@/lib/api-client'
import {
  DEFAULT_KNOWLEDGE_EXCLUDES,
  type KnowledgeSource,
  type KnowledgeSourceKind,
  knowledgeSourceKindSchema,
} from '@/lib/contracts'
import { cn } from '@/lib/utils'

const KIND_OPTIONS: Record<
  KnowledgeSourceKind,
  { label: string; hint: string; placeholder: string }
> = {
  git_local: {
    label: 'Local Git repo',
    hint: 'Only files Git tracks are read, so gitignored secrets stay out.',
    placeholder: '~/code/team-work',
  },
  git_remote: {
    label: 'Git URL',
    hint: 'Cloned with this machine’s git login, fetched before each run.',
    placeholder: 'https://github.com/org/handbook',
  },
  path: {
    label: 'Folder or file',
    hint: 'A .md/.txt file or a folder, copied before each run without the excluded names.',
    placeholder: '~/notes/conventions.md',
  },
}

const formSchema = z.object({
  kind: knowledgeSourceKindSchema,
  name: z.string().trim().min(1, 'Name it').max(80),
  location: z.string().trim().min(1, 'Where is it?'),
  branch: z.string(),
  entryFile: z.string(),
  excludes: z.string(),
})

const orNull = (value: string): string | null => (value.trim() === '' ? null : value.trim())
const splitList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')

/** Saving syncs the source: say whether it can be read. */
function reportSync(saved: KnowledgeSource) {
  if (saved.lastError === null) toast.success(`${saved.name}: ${syncedLine(saved)}`)
  else toast.error(`${saved.name} is saved but can’t be read: ${saved.lastError}`)
}
/** Add a knowledge source, or edit one (`source`). Saving syncs it and says how that went. */
export function KnowledgeSourceDialog({
  open,
  onOpenChange,
  source,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  source?: KnowledgeSource
}) {
  const create = useCreateKnowledgeSource()
  const update = useUpdateKnowledgeSource()
  const saving = create.isPending || update.isPending

  const form = useForm({
    defaultValues: {
      kind: source?.kind ?? 'git_local',
      name: source?.name ?? '',
      location: source?.location ?? '',
      branch: source?.branch ?? '',
      entryFile: source?.entryFile ?? '',
      excludes: (source?.excludes ?? DEFAULT_KNOWLEDGE_EXCLUDES).join(', '),
    },
    validators: { onSubmit: formSchema },
    onSubmit: ({ value }) => {
      const body = {
        kind: value.kind,
        name: value.name.trim(),
        location: value.location.trim(),
        branch: value.kind === 'path' ? null : orNull(value.branch),
        entryFile: orNull(value.entryFile),
        excludes: splitList(value.excludes),
      }
      const done = {
        onSuccess: (saved: KnowledgeSource) => {
          reportSync(saved)
          onOpenChange(false)
        },
        onError: (error: unknown) => toast.error(errorMessage(error)),
      }
      if (source === undefined) create.mutate({ id: crypto.randomUUID(), ...body }, done)
      else update.mutate({ id: source.id, patch: body }, done)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {source === undefined ? 'Add knowledge' : `Edit ${source.name}`}
          </DialogTitle>
          <DialogDescription>
            Planning stations read it before they plan. Builders never see it.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field name="kind">
            {(field) => (
              <RadioGroup
                value={field.state.value}
                onValueChange={(value) => {
                  const kind = knowledgeSourceKindSchema.safeParse(value)
                  if (kind.success) field.handleChange(kind.data)
                }}
                aria-label="Kind"
                className="grid grid-cols-3 gap-2"
              >
                {knowledgeSourceKindSchema.options.map((kind) => (
                  <Label
                    key={kind}
                    htmlFor={`knowledge-kind-${kind}`}
                    className={cn(
                      'flex items-center gap-2 rounded-md border bg-card/50 px-3 py-2 font-normal',
                      field.state.value === kind
                        ? 'border-foreground/40 bg-card'
                        : 'hover:bg-card',
                    )}
                  >
                    <RadioGroupItem id={`knowledge-kind-${kind}`} value={kind} />
                    <span className="text-[0.8125rem]">{KIND_OPTIONS[kind].label}</span>
                  </Label>
                ))}
              </RadioGroup>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.values.kind}>
            {(kind) => (
              <>
                <p className="-mt-2 text-xs text-muted-foreground">{KIND_OPTIONS[kind].hint}</p>
                <form.Field name="location">
                  {(field) => (
                    <FormField
                      id="knowledge-location"
                      label={kind === 'git_remote' ? 'URL' : 'Path'}
                      errors={field.state.meta.errors}
                    >
                      <Input
                        id="knowledge-location"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          field.handleChange(event.target.value)
                          if (form.getFieldValue('name').trim() === '') {
                            const last = event.target.value
                              .replace(/\/+$/, '')
                              .split(/[/:]/)
                              .pop()
                            form.setFieldValue('name', (last ?? '').replace(/\.git$/, ''))
                          }
                        }}
                        placeholder={KIND_OPTIONS[kind].placeholder}
                        className="font-mono text-xs"
                        spellCheck={false}
                      />
                    </FormField>
                  )}
                </form.Field>
                <form.Field name="name">
                  {(field) => (
                    <FormField
                      id="knowledge-name"
                      label="Name"
                      errors={field.state.meta.errors}
                    >
                      <Input
                        id="knowledge-name"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="work"
                      />
                    </FormField>
                  )}
                </form.Field>
                <div className="grid grid-cols-2 gap-3">
                  {kind === 'path' ? (
                    <form.Field name="excludes">
                      {(field) => (
                        <FormField
                          id="knowledge-excludes"
                          label="Leave out (comma separated)"
                          errors={field.state.meta.errors}
                        >
                          <Input
                            id="knowledge-excludes"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            className="font-mono text-xs"
                            spellCheck={false}
                          />
                        </FormField>
                      )}
                    </form.Field>
                  ) : (
                    <form.Field name="branch">
                      {(field) => (
                        <FormField
                          id="knowledge-branch"
                          label="Branch (optional)"
                          errors={field.state.meta.errors}
                        >
                          <Input
                            id="knowledge-branch"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            placeholder={
                              kind === 'git_remote' ? 'default branch' : 'current branch'
                            }
                            className="font-mono text-xs"
                            spellCheck={false}
                          />
                        </FormField>
                      )}
                    </form.Field>
                  )}
                  <form.Field name="entryFile">
                    {(field) => (
                      <FormField
                        id="knowledge-entry"
                        label="Start reading at (optional)"
                        errors={field.state.meta.errors}
                      >
                        <Input
                          id="knowledge-entry"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder="auto: INDEX.md, README.md…"
                          className="font-mono text-xs"
                          spellCheck={false}
                        />
                      </FormField>
                    )}
                  </form.Field>
                </div>
              </>
            )}
          </form.Subscribe>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
              {saving
                ? 'Saving and syncing…'
                : source === undefined
                  ? 'Add and sync'
                  : 'Save and sync'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
