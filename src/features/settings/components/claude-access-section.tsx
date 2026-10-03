import { ExternalLink, KeyRound, LoaderCircle, Trash2, UserRound } from 'lucide-react'
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
import { useUpdateSettings } from '@/features/settings/api/settings-queries'
import {
  invalidProps,
  Row,
  SecretInput,
  Section,
} from '@/features/settings/components/settings-section'
import { ApiError, errorMessage } from '@/lib/api-client'
import type { Settings } from '@/lib/contracts'

const KEY_FIELD_ID = 'settings-api-key'
const CONSOLE_KEYS_URL = 'https://console.anthropic.com/settings/keys'

/** What new runs sign in with right now: the Claude plan login or an API key. */
function CurrentAccess({ settings, onRemove }: { settings: Settings; onRemove: () => void }) {
  const hint = settings.anthropicApiKeyHint
  const source = settings.anthropicApiKeySource
  const usingKey = hint !== null
  const Icon = usingKey ? KeyRound : UserRound
  return (
    <div className="flex items-center gap-3 px-4 py-3" data-testid="claude-access-current">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground"
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[0.8125rem] font-medium">
          {usingKey ? 'Using an API key' : 'Using your Claude plan'}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {usingKey ? (
            <>
              <span className="font-mono text-foreground">{hint}</span>
              {source === 'env' ? ' · from ANTHROPIC_API_KEY' : ' · saved in Settings'}
            </>
          ) : (
            <>
              Logged in via <span className="font-mono">claude</span>. Costs are API-equivalent
              estimates.
            </>
          )}
        </p>
      </div>
      <div className="ml-auto shrink-0">
        {source === 'settings' ? (
          <Button type="button" variant="outline" size="sm" onClick={onRemove}>
            <Trash2 aria-hidden="true" />
            Remove key
          </Button>
        ) : source === 'env' ? (
          <span className="text-xs text-muted-foreground">
            Unset the variable to switch back
          </span>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Settings → Claude access. The key is a secret, so it never enters the main
 * settings draft: it has its own input, Save and Remove, and the API only ever
 * returns a masked hint.
 */
export function ClaudeAccessSection({ settings }: { settings: Settings }) {
  const save = useUpdateSettings()
  const remove = useUpdateSettings()
  const [key, setKey] = useState('')
  const [confirming, setConfirming] = useState(false)

  const invalidKey =
    save.error instanceof ApiError && save.error.code === 'api_key_invalid'
      ? save.error.message
      : null
  const errors = invalidKey === null ? [] : [invalidKey]
  const usingKey = settings.anthropicApiKeyHint !== null
  const trimmed = key.trim()

  function submit() {
    if (trimmed === '' || save.isPending) return
    save.mutate(
      { anthropicApiKey: trimmed },
      {
        onSuccess: () => {
          setKey('')
          toast.success('API key saved. New runs use it.')
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'api_key_invalid') return
          toast.error(`Couldn't save the API key: ${errorMessage(error)}`)
        },
      },
    )
  }

  return (
    <Section
      title="Claude access"
      description={
        <>
          How agents sign in to Claude: your plan, or an API key from the{' '}
          <a
            href={CONSOLE_KEYS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-foreground underline-offset-4 hover:underline"
          >
            Anthropic Console
            <ExternalLink aria-hidden="true" className="size-3" />
          </a>
          .
        </>
      }
    >
      <CurrentAccess settings={settings} onRemove={() => setConfirming(true)} />
      <form
        aria-label="API key"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Row
          id={KEY_FIELD_ID}
          label={usingKey ? 'Replace API key' : 'API key'}
          help={
            <>
              Stored only in the local database on this Mac. With a key, runs bill per token to
              your Anthropic account, so costs are real, not estimates.
              {settings.anthropicApiKeySource === 'env'
                ? ' A key saved here takes precedence over ANTHROPIC_API_KEY.'
                : null}
            </>
          }
          errors={errors}
          after={
            <Button type="submit" size="sm" disabled={trimmed === '' || save.isPending}>
              {save.isPending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <KeyRound aria-hidden="true" />
              )}
              {save.isPending ? 'Checking key…' : 'Save key'}
            </Button>
          }
        >
          <SecretInput
            id={KEY_FIELD_ID}
            what="key"
            value={key}
            onChange={(value) => {
              setKey(value)
              if (save.isError) save.reset()
            }}
            onBlur={() => undefined}
            placeholder="sk-ant-…"
            inputProps={invalidProps(KEY_FIELD_ID, errors)}
          />
        </Row>
      </form>

      <AlertDialog
        open={confirming}
        onOpenChange={(next) => {
          if (remove.isPending) return
          setConfirming(next)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove the API key?</AlertDialogTitle>
            <AlertDialogDescription>
              New runs sign in with your Claude plan again (or ANTHROPIC_API_KEY, if it&rsquo;s
              set). The key is deleted from this Mac; it stays valid in the Anthropic Console.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={remove.isPending}>
              Keep key
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(
                  { anthropicApiKey: null },
                  {
                    onSuccess: () => {
                      setConfirming(false)
                      toast.success('API key removed.')
                    },
                    onError: (error) =>
                      toast.error(`Couldn't remove the API key: ${errorMessage(error)}`),
                  },
                )
              }
            >
              {remove.isPending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              Remove key
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  )
}
