import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { Switch } from '@/components/ui/switch'
import { useUpdateSettings } from '@/features/settings/api/settings-queries'
import { notificationKindSchema, type NotificationKind, type Settings } from '@/lib/contracts'

import { Row, Section } from './settings-section'

/** What each kind means to the person deciding whether it may ping their phone. */
const KIND_COPY: Record<NotificationKind, { label: string; help: string }> = {
  gate_waiting: { label: 'Needs you', help: 'A run stopped at a gate for your decision.' },
  pr_review_requested: {
    label: 'Review requested',
    help: 'Someone asked you to review a pull request on GitHub.',
  },
  review_ready: {
    label: 'Review ready',
    help: 'A YugoTool review of a pull request finished.',
  },
  shift_handoff_ready: {
    label: 'Handoff ready',
    help: 'A shift handed off and waits for your review.',
  },
  run_failed: { label: 'Run failed', help: 'A run stopped with an error.' },
  ci_failed: { label: 'CI failed', help: "The pull request's checks failed." },
  shift_stuck: { label: 'Shifts stuck', help: 'Two shifts in a row changed no code.' },
  run_succeeded: { label: 'Run done', help: 'A run delivered its work.' },
  ci_passed: { label: 'CI passed', help: "The pull request's checks passed." },
  knowledge_sync_failed: {
    label: 'Knowledge skipped',
    help: 'A knowledge source failed to sync; the run went on without it.',
  },
  dispatcher_paused: { label: 'Queue paused', help: 'Plan usage hit your limit.' },
}

/**
 * Per kind: also send it to desktop, Slack and Telegram, or keep it in the bell.
 * Saves on toggle; the bell always gets everything.
 */
export function NotificationKindsSection({
  settings,
  icon,
}: {
  settings: Settings
  /** The kind's icon, composed in by the app layer. */
  icon?: (kind: NotificationKind) => ReactNode
}) {
  const update = useUpdateSettings()
  return (
    <Section
      title="Notification kinds"
      description="The bell shows everything. Choose what also goes to desktop, Slack and Telegram."
    >
      {notificationKindSchema.options.map((kind) => {
        const id = `settings-notify-${kind}`
        const { label, help } = KIND_COPY[kind]
        const pending =
          update.isPending && update.variables.notificationExternal?.[kind] !== undefined
        return (
          <Row key={kind} id={id} label={label} help={help} labelIcon={icon?.(kind)}>
            <Switch
              id={id}
              checked={
                pending
                  ? update.variables.notificationExternal?.[kind]
                  : settings.notificationExternal[kind]
              }
              aria-label={`Send "${label}" outside the app`}
              onCheckedChange={(checked) =>
                update.mutate(
                  { notificationExternal: { [kind]: checked } },
                  {
                    onError: (error) =>
                      toast.error(`Couldn't save "${label}"`, { description: error.message }),
                  },
                )
              }
            />
          </Row>
        )
      })}
    </Section>
  )
}
