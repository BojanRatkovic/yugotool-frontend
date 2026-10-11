import { useForm, useStore } from '@tanstack/react-form'
import { FolderOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { useUpdateSettings } from '@/features/settings/api/settings-queries'
import { SettingsSaveBar } from '@/features/settings/components/settings-save-bar'
import { invalidProps, Row, Section } from '@/features/settings/components/settings-section'
import { UnsavedChangesGuard } from '@/features/settings/components/unsaved-changes-guard'
import {
  changedKeys,
  GENERAL_KEYS,
  settingsFieldSchemas,
  settingsPatch,
  toSettingsValues,
} from '@/features/settings/utils/settings-form'
import { ApiError, errorMessage } from '@/lib/api-client'
import type { Settings } from '@/lib/contracts'
import { desktopBridge } from '@/lib/desktop'
import { tildePath } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Anchor of the Repos folder field (the repo picker and Doctor link here). */
export const REPOS_ROOT_FIELD_ID = 'settings-repos-root'

/** "Choose…" opens the desktop app's native folder dialog; absent in a browser. */
function ChooseFolderButton({
  current,
  onPick,
}: {
  current: string | undefined
  onPick: (path: string) => void
}) {
  const bridge = desktopBridge()
  const [picking, setPicking] = useState(false)
  if (bridge === null) return null
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      disabled={picking}
      onClick={() => {
        setPicking(true)
        bridge
          .pickFolder(current)
          .then((path) => {
            if (path !== null) onPick(path)
            return undefined
          })
          .catch((error: unknown) =>
            toast.error(`Couldn't open the folder picker: ${errorMessage(error)}`),
          )
          .finally(() => setPicking(false))
      }}
    >
      <FolderOpen aria-hidden="true" />
      Choose…
    </Button>
  )
}

/** Scrolls the settings column to the Repos folder field and focuses it. */
function focusReposRoot() {
  const input = document.getElementById(REPOS_ROOT_FIELD_ID)
  if (!(input instanceof HTMLInputElement)) return
  // Scroll only the settings column: scrollIntoView would also nudge the page shell.
  const column = input.closest('[data-settings-scroll]')
  if (column !== null) {
    const offset = input.getBoundingClientRect().top - column.getBoundingClientRect().top
    column.scrollTo({
      top: column.scrollTop + offset - column.clientHeight / 3,
      behavior: 'smooth',
    })
  }
  input.focus({ preventScroll: true })
}

const NUMBER_CLASS = 'h-8 w-24 text-right font-mono tabular-nums'
const TEXT_CLASS = 'h-8 w-full'

/**
 * Settings → General. Values are a TanStack Form draft of the saved settings;
 * Save PATCHes only what changed. Mount with `key={settingsFormKey(settings,
 * GENERAL_KEYS)}` so a save of these fields (here or in another tab) resets
 * the draft, while saving another page's fields does not.
 */
export function GeneralSettingsForm({
  settings,
  reposRootDefault,
  focusReposRootField = false,
}: {
  settings: Settings
  /** Folder used when Repos folder is empty; the field's placeholder. */
  reposRootDefault?: string
  /** Deep link (`#settings-repos-root`, from the repo picker): focus the field on mount. */
  focusReposRootField?: boolean
}) {
  const save = useUpdateSettings()
  const form = useForm({
    defaultValues: toSettingsValues(settings),
    onSubmit: ({ value }) => {
      const patch = settingsPatch(value, settings, GENERAL_KEYS)
      if (Object.keys(patch).length === 0) return
      save.mutate(patch, {
        onSuccess: () => toast.success('Settings saved.'),
        onError: (error) => toast.error(`Couldn't save settings: ${errorMessage(error)}`),
      })
    },
  })

  useEffect(() => {
    if (focusReposRootField) focusReposRoot()
  }, [focusReposRootField])

  const values = useStore(form.store, (state) => state.values)
  const canSubmit = useStore(form.store, (state) => state.canSubmit)
  // The server checks the folder exists; its message belongs under the field.
  const reposRootError =
    save.error instanceof ApiError && save.error.code === 'repos_root_invalid'
      ? save.error.message
      : null
  const isDirty = changedKeys(values, settings, GENERAL_KEYS).length > 0

  return (
    <form
      className="flex flex-1 flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <UnsavedChangesGuard dirty={isDirty && !save.isPending} />
      <Section title="Repos" description="Where YugoTool looks for projects on this machine.">
        <form.Field name="reposRoot">
          {(field) => (
            <Row
              id={REPOS_ROOT_FIELD_ID}
              label="Repos folder"
              help="Where your Git repos live. The repo picker lists repos under it. Leave empty for the default."
              errors={reposRootError === null ? [] : [reposRootError]}
            >
              <div className="flex w-full items-center gap-2">
                <Input
                  id={REPOS_ROOT_FIELD_ID}
                  autoComplete="off"
                  spellCheck={false}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value)
                    if (reposRootError !== null) save.reset()
                  }}
                  placeholder={
                    reposRootDefault === undefined ? '~/code' : tildePath(reposRootDefault)
                  }
                  className={cn(TEXT_CLASS, 'scroll-mt-16 font-mono text-xs')}
                  {...invalidProps(
                    REPOS_ROOT_FIELD_ID,
                    reposRootError === null ? [] : [reposRootError],
                  )}
                />
                <ChooseFolderButton
                  current={field.state.value.trim() || reposRootDefault}
                  onPick={(path) => {
                    field.handleChange(path)
                    if (reposRootError !== null) save.reset()
                  }}
                />
              </div>
            </Row>
          )}
        </form.Field>
      </Section>

      <Section
        title="Dispatcher"
        description="How much runs at once, and when to stop picking up queued work to protect your plan limits."
      >
        <form.Field
          name="maxConcurrentRuns"
          validators={{ onChange: settingsFieldSchemas.maxConcurrentRuns }}
        >
          {(field) => (
            <Row
              id="settings-max-runs"
              label="Max concurrent runs"
              help="Agent runs at once. Orders parked at a gate don't take a slot."
              errors={field.state.meta.errors}
            >
              <Input
                id="settings-max-runs"
                type="number"
                min={1}
                max={10}
                value={Number.isNaN(field.state.value) ? '' : field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.valueAsNumber)}
                className={NUMBER_CLASS}
                {...invalidProps('settings-max-runs', field.state.meta.errors)}
              />
            </Row>
          )}
        </form.Field>
        <form.Field
          name="pauseAtFiveHourPct"
          validators={{ onChange: settingsFieldSchemas.pauseAtFiveHourPct }}
        >
          {(field) => (
            <Row
              id="settings-pause-5h"
              label="Pause at 5-hour usage"
              help="Queued work waits once the 5-hour window reaches this share."
              errors={field.state.meta.errors}
            >
              <PercentInput
                id="settings-pause-5h"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                errors={field.state.meta.errors}
              />
            </Row>
          )}
        </form.Field>
        <form.Field
          name="pauseAtWeeklyPct"
          validators={{ onChange: settingsFieldSchemas.pauseAtWeeklyPct }}
        >
          {(field) => (
            <Row
              id="settings-pause-weekly"
              label="Pause at weekly usage"
              help="Same, for the weekly window."
              errors={field.state.meta.errors}
            >
              <PercentInput
                id="settings-pause-weekly"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                errors={field.state.meta.errors}
              />
            </Row>
          )}
        </form.Field>
      </Section>

      <Section
        title="Night shift"
        description="Orders queued for tonight only start inside this window. It may cross midnight."
      >
        <form.Field
          name="nightShiftStart"
          validators={{ onChange: settingsFieldSchemas.clock }}
        >
          {(field) => (
            <Row id="settings-night-start" label="Starts" errors={field.state.meta.errors}>
              <Input
                id="settings-night-start"
                type="time"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                className="h-8 w-28 font-mono tabular-nums"
                {...invalidProps('settings-night-start', field.state.meta.errors)}
              />
            </Row>
          )}
        </form.Field>
        <form.Field name="nightShiftEnd" validators={{ onChange: settingsFieldSchemas.clock }}>
          {(field) => (
            <Row id="settings-night-end" label="Ends" errors={field.state.meta.errors}>
              <Input
                id="settings-night-end"
                type="time"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                className="h-8 w-28 font-mono tabular-nums"
                {...invalidProps('settings-night-end', field.state.meta.errors)}
              />
            </Row>
          )}
        </form.Field>
      </Section>
      <SettingsSaveBar
        pending={save.isPending}
        error={reposRootError === null ? save.error : null}
        dirty={isDirty}
        canSubmit={canSubmit}
        onDiscard={() => {
          form.reset()
          save.reset()
        }}
      />
    </form>
  )
}

function PercentInput({
  id,
  value,
  onChange,
  onBlur,
  errors,
}: {
  id: string
  value: number
  onChange: (value: number) => void
  onBlur: () => void
  errors: readonly unknown[]
}) {
  return (
    <InputGroup className="h-8 w-24">
      <InputGroupInput
        id={id}
        type="number"
        min={10}
        max={100}
        value={Number.isNaN(value) ? '' : value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        className="text-right font-mono tabular-nums"
        {...invalidProps(id, errors)}
      />
      <InputGroupAddon align="inline-end" className="font-mono text-xs">
        %
      </InputGroupAddon>
    </InputGroup>
  )
}
