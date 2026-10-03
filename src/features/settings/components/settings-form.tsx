import { useForm, useStore } from '@tanstack/react-form'
import { Eye, EyeOff, FolderOpen, Save, Send, Undo2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  useTestNotification,
  useUpdateSettings,
  type NotificationChannel,
} from '@/features/settings/api/settings-queries'
import {
  changedKeys,
  settingsFieldSchemas,
  settingsPatch,
  toSettingsValues,
  type SettingsValues,
} from '@/features/settings/utils/settings-form'
import { ApiError, errorIssues, errorMessage } from '@/lib/api-client'
import type { Settings } from '@/lib/contracts'
import { desktopBridge } from '@/lib/desktop'
import { tildePath } from '@/lib/format'
import { cn } from '@/lib/utils'

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  desktop: 'desktop',
  slack: 'Slack',
  telegram: 'Telegram',
}

function firstError(errors: readonly unknown[]): string | null {
  const first = errors[0]
  if (typeof first === 'string') return first
  if (typeof first === 'object' && first !== null && 'message' in first) {
    return String(first.message)
  }
  return null
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-[0.8125rem] text-muted-foreground">{description}</p>
      </div>
      <div className="divide-y rounded-lg border bg-card">{children}</div>
    </section>
  )
}

/** One setting: label + help on the left, control on the right, error under the control. */
function Row({
  id,
  label,
  help,
  errors = [],
  children,
  after,
}: {
  id: string
  label: string
  help?: ReactNode
  errors?: readonly unknown[]
  children: ReactNode
  /** Rendered under the error, e.g. a "Send test" button. */
  after?: ReactNode
}) {
  const error = firstError(errors)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,20rem)] items-start gap-6 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5 pt-1">
        <Label htmlFor={id} className="text-[0.8125rem]">
          {label}
        </Label>
        {help === undefined ? null : <p className="text-xs text-muted-foreground">{help}</p>}
      </div>
      <div className="flex min-w-0 flex-col items-end gap-1">
        {children}
        {error === null ? null : (
          <p id={`${id}-error`} className="text-xs text-destructive">
            {error}
          </p>
        )}
        {after}
      </div>
    </div>
  )
}

function invalidProps(id: string, errors: readonly unknown[]) {
  return firstError(errors) === null
    ? {}
    : { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` }
}

function SecretInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  placeholder?: string
}) {
  const [revealed, setRevealed] = useState(false)
  return (
    <InputGroup className="h-8">
      <InputGroupInput
        id={id}
        type={revealed ? 'text' : 'password'}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="font-mono text-xs"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={revealed ? 'Hide token' : 'Show token'}
          aria-pressed={revealed}
          onClick={() => setRevealed((shown) => !shown)}
        >
          {revealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}

/** "Send test" for one channel. Tests what's saved, so unsaved edits disable it. */
function TestButton({
  channel,
  ready,
  blockedReason,
}: {
  channel: NotificationChannel
  ready: boolean
  blockedReason: string | null
}) {
  const test = useTestNotification()
  return (
    <div className="flex items-center gap-2">
      {blockedReason === null ? null : (
        <span className="text-xs text-muted-foreground">{blockedReason}</span>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!ready || test.isPending}
        onClick={() =>
          test.mutate(channel, {
            onSuccess: () => toast.success(`Test sent to ${CHANNEL_LABEL[channel]}.`),
            onError: (error) =>
              toast.error(`The ${CHANNEL_LABEL[channel]} test failed: ${errorMessage(error)}`),
          })
        }
      >
        <Send aria-hidden="true" />
        {test.isPending ? 'Sending…' : 'Send test'}
      </Button>
    </div>
  )
}

/** Why "Send test" is off: unsaved edits, or the channel isn't configured. */
function blocked(dirty: boolean, configured: boolean, missing: string): string | null {
  if (dirty) return 'Save to test'
  return configured ? null : missing
}

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

const NUMBER_CLASS = 'h-8 w-24 text-right font-mono tabular-nums'
const TEXT_CLASS = 'h-8 w-full'

/**
 * Settings editor. Values are a TanStack Form draft of the saved settings;
 * Save PATCHes only what changed. Mount with `key={settings.updatedAt}` so a
 * save or a refetch from another tab resets the draft.
 */
export function SettingsForm({
  settings,
  reposRootDefault,
}: {
  settings: Settings
  /** Folder used when Repos folder is empty; the field's placeholder. */
  reposRootDefault?: string
}) {
  const save = useUpdateSettings()
  const form = useForm({
    defaultValues: toSettingsValues(settings),
    onSubmit: ({ value }) => {
      const patch = settingsPatch(value, settings)
      if (Object.keys(patch).length === 0) return
      save.mutate(patch, {
        onSuccess: () => toast.success('Settings saved.'),
        onError: (error) => toast.error(`Couldn't save settings: ${errorMessage(error)}`),
      })
    },
  })

  const values = useStore(form.store, (state) => state.values)
  const canSubmit = useStore(form.store, (state) => state.canSubmit)
  // The server checks the folder exists; its message belongs under the field.
  const reposRootError =
    save.error instanceof ApiError && save.error.code === 'repos_root_invalid'
      ? save.error.message
      : null
  const apiIssues = save.error === null ? [] : errorIssues(save.error)

  const slackSaved = settings.slackWebhookUrl !== null
  const telegramSaved = settings.telegramBotToken !== null && settings.telegramChatId !== null
  const dirtyKeys = changedKeys(values, settings)
  const isDirty = dirtyKeys.length > 0
  const changed = (...keys: (keyof SettingsValues)[]) =>
    keys.some((key) => dirtyKeys.includes(key))

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 bg-background/95 px-1 py-2 backdrop-blur-sm">
        <span className="mr-auto text-xs text-muted-foreground" aria-live="polite">
          {save.isPending
            ? 'Saving…'
            : isDirty
              ? canSubmit
                ? 'Unsaved changes'
                : 'Unsaved changes — fix the highlighted fields'
              : 'Saved'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!isDirty || save.isPending}
          onClick={() => {
            form.reset()
            save.reset()
          }}
        >
          <Undo2 aria-hidden="true" />
          Discard
        </Button>
        <Button type="submit" size="sm" disabled={!isDirty || !canSubmit || save.isPending}>
          <Save aria-hidden="true" />
          Save settings
        </Button>
      </div>

      {save.error === null || reposRootError !== null ? null : (
        <div
          role="alert"
          className="-mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <p className="font-medium text-destructive">{errorMessage(save.error)}</p>
          {apiIssues.length === 0 ? null : (
            <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
              {apiIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Section title="Repos" description="Where ZASTAVA looks for projects on this machine.">
        <form.Field name="reposRoot">
          {(field) => (
            <Row
              id={REPOS_ROOT_FIELD_ID}
              label="Repos folder"
              help="Where your git repos live. The repo picker lists repos under it. Leave empty for the default."
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

      <Section
        title="Notifications"
        description="Where ZASTAVA tells you a gate needs you or a run finished. Links open the work order."
      >
        <form.Field name="appUrl" validators={{ onChange: settingsFieldSchemas.appUrl }}>
          {(field) => (
            <Row
              id="settings-app-url"
              label="App URL"
              help="Base for deep links in notifications."
              errors={field.state.meta.errors}
            >
              <Input
                id="settings-app-url"
                type="url"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="http://localhost:4800"
                className={cn(TEXT_CLASS, 'font-mono text-xs')}
                {...invalidProps('settings-app-url', field.state.meta.errors)}
              />
            </Row>
          )}
        </form.Field>
        <form.Field name="desktopNotifications">
          {(field) => (
            <Row
              id="settings-desktop"
              label="Desktop notifications"
              help="Shown by the machine running the API."
            >
              <div className="flex items-center gap-3">
                <TestButton
                  channel="desktop"
                  ready={settings.desktopNotifications && !changed('desktopNotifications')}
                  blockedReason={blocked(
                    changed('desktopNotifications'),
                    settings.desktopNotifications,
                    'Turned off',
                  )}
                />
                <Switch
                  id="settings-desktop"
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                />
              </div>
            </Row>
          )}
        </form.Field>
        <form.Field
          name="slackWebhookUrl"
          validators={{ onChange: settingsFieldSchemas.optionalUrl }}
        >
          {(field) => (
            <Row
              id="settings-slack"
              label="Slack webhook URL"
              help="An incoming webhook for the channel to post in. Leave empty to turn Slack off."
              errors={field.state.meta.errors}
              after={
                <TestButton
                  channel="slack"
                  ready={slackSaved && !changed('slackWebhookUrl')}
                  blockedReason={blocked(changed('slackWebhookUrl'), slackSaved, 'Not set up')}
                />
              }
            >
              <Input
                id="settings-slack"
                type="url"
                autoComplete="off"
                spellCheck={false}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="https://hooks.slack.com/services/…"
                className={cn(TEXT_CLASS, 'font-mono text-xs')}
                {...invalidProps('settings-slack', field.state.meta.errors)}
              />
            </Row>
          )}
        </form.Field>
        <form.Field name="telegramBotToken">
          {(field) => (
            <Row
              id="settings-telegram-token"
              label="Telegram bot token"
              help="From @BotFather. Stored on the API machine."
            >
              <SecretInput
                id="settings-telegram-token"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                placeholder="123456:ABC-…"
              />
            </Row>
          )}
        </form.Field>
        <form.Field name="telegramChatId">
          {(field) => (
            <Row
              id="settings-telegram-chat"
              label="Telegram chat ID"
              help="The chat or group the bot posts to."
            >
              <Input
                id="settings-telegram-chat"
                autoComplete="off"
                spellCheck={false}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="-1001234567890"
                className={cn(TEXT_CLASS, 'font-mono text-xs')}
              />
              <TestButton
                channel="telegram"
                ready={telegramSaved && !changed('telegramBotToken', 'telegramChatId')}
                blockedReason={blocked(
                  changed('telegramBotToken', 'telegramChatId'),
                  telegramSaved,
                  'Needs a token and a chat ID',
                )}
              />
            </Row>
          )}
        </form.Field>
      </Section>
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
