import { useForm, useStore } from '@tanstack/react-form'
import { Send } from 'lucide-react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  useTestNotification,
  useUpdateSettings,
  type NotificationChannel,
} from '@/features/settings/api/settings-queries'
import { SettingsSaveBar } from '@/features/settings/components/settings-save-bar'
import { SecretInput } from '@/components/secret-input'
import { invalidProps, Row, Section } from '@/features/settings/components/settings-section'
import { UnsavedChangesGuard } from '@/features/settings/components/unsaved-changes-guard'
import {
  CHANNEL_KEYS,
  changedKeys,
  settingsFieldSchemas,
  settingsPatch,
  toSettingsValues,
  type SettingsKey,
} from '@/features/settings/utils/settings-form'
import { errorMessage } from '@/lib/api-client'
import type { Settings } from '@/lib/contracts'
import { cn } from '@/lib/utils'

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  desktop: 'desktop',
  slack: 'Slack',
  telegram: 'Telegram',
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

const TEXT_CLASS = 'h-8 w-full'

/**
 * Settings → Notifications → Channels: where notices go besides the bell.
 * Same draft-and-save model as General; mount with
 * `key={settingsFormKey(settings, CHANNEL_KEYS)}`.
 */
export function NotificationChannelsForm({
  settings,
  children,
}: {
  settings: Settings
  /**
   * Sections after Channels that save on their own (notification kinds). They
   * sit inside the form so the sticky Save bar stays under the whole page.
   */
  children?: ReactNode
}) {
  const save = useUpdateSettings()
  const form = useForm({
    defaultValues: toSettingsValues(settings),
    onSubmit: ({ value }) => {
      const patch = settingsPatch(value, settings, CHANNEL_KEYS)
      if (Object.keys(patch).length === 0) return
      save.mutate(patch, {
        onSuccess: () => toast.success('Settings saved.'),
        onError: (error) => toast.error(`Couldn't save settings: ${errorMessage(error)}`),
      })
    },
  })

  const values = useStore(form.store, (state) => state.values)
  const canSubmit = useStore(form.store, (state) => state.canSubmit)
  const slackSaved = settings.slackWebhookUrl !== null
  const telegramSaved = settings.telegramBotToken !== null && settings.telegramChatId !== null
  const dirtyKeys = changedKeys(values, settings, CHANNEL_KEYS)
  const isDirty = dirtyKeys.length > 0
  const changed = (...keys: SettingsKey[]) => keys.some((key) => dirtyKeys.includes(key))

  return (
    <form
      className="flex flex-1 flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <UnsavedChangesGuard dirty={isDirty && !save.isPending} />
      <Section
        title="Channels"
        description="Where YugoTool tells you a gate needs you or a run finished. Links open the work order."
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
      {children}
      <SettingsSaveBar
        pending={save.isPending}
        error={save.error}
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
