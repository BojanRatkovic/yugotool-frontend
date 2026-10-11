import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AppWindow,
  Check,
  CircleCheck,
  CircleDashed,
  CircleX,
  LoaderCircle,
  LogIn,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useState, type ReactNode } from 'react'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  isSignInActive,
  previewQueries,
  useFinishSignIn,
  useForgetSession,
  useStartSignIn,
} from '@/features/projects/api/preview-queries'
import { useNow } from '@/hooks/use-now'
import { ApiError, errorMessage } from '@/lib/api-client'
import type { PreviewSession, PreviewSignIn } from '@/lib/contracts'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * "Sign in once": boots the preview, opens a visible browser on this Mac, and
 * saves the cookies + localStorage the user ends up with. Test preview, QA
 * screenshots and the QA browser then start signed in.
 */
export function PreviewSessionSettings({
  projectId,
  configured,
  dirty,
}: {
  projectId: string
  configured: boolean
  dirty: boolean
}) {
  const queryClient = useQueryClient()
  const status = useQuery(previewQueries.session(projectId))
  const start = useStartSignIn(projectId)
  const finish = useFinishSignIn(projectId)
  const forget = useForgetSession(projectId)
  const [confirming, setConfirming] = useState(false)

  const session = status.data?.session ?? null
  const signIn = status.data?.signIn ?? null
  const active = isSignInActive(status.data)
  const blocked = !configured || dirty ? 'Save the preview first' : null
  const refetch = () =>
    queryClient.invalidateQueries({ queryKey: previewQueries.session(projectId).queryKey })

  function signInNow() {
    start.mutate(undefined, {
      onError: (error) => {
        const code = error instanceof ApiError ? error.code : null
        if (code === 'preview_sign_in_running') {
          void refetch()
          toast.info('A sign-in is already under way.')
        } else if (code === 'preview_not_configured') {
          toast.error('Save the preview first.')
        } else {
          toast.error(`Couldn't start the sign-in: ${errorMessage(error)}`)
        }
      },
    })
  }

  function end(action: 'save' | 'cancel') {
    finish.mutate(
      { action },
      {
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'preview_sign_in_not_running') {
            void refetch()
            toast.info('That sign-in already ended.')
          } else {
            toast.error(
              `Couldn't ${action === 'save' ? 'save' : 'cancel'} the sign-in: ${errorMessage(error)}`,
            )
          }
        },
      },
    )
  }

  const busy = start.isPending || finish.isPending
  // The worker saves / stops asynchronously: hold the buttons until this attempt ends.
  const finishing =
    active &&
    (finish.isPending ||
      (finish.isSuccess && finish.data.signIn?.startedAt === signIn?.startedAt))
      ? finish.variables?.action
      : undefined

  let actions: ReactNode
  if (status.data === undefined) {
    actions = null
  } else if (active) {
    actions = (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={finishing !== undefined}
          onClick={() => end('cancel')}
        >
          {finishing === 'cancel' ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <X aria-hidden="true" />
          )}
          {finishing === 'cancel' ? 'Cancelling…' : 'Cancel'}
        </Button>
        {signIn?.status === 'waiting' ? (
          <Button
            type="button"
            size="sm"
            disabled={finishing !== undefined}
            onClick={() => end('save')}
          >
            {finishing === 'save' ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Check aria-hidden="true" />
            )}
            {finishing === 'save' ? 'Saving…' : 'Done'}
          </Button>
        ) : null}
      </>
    )
  } else {
    actions = (
      <>
        {blocked === null ? null : (
          <span className="text-xs text-muted-foreground">{blocked}</span>
        )}
        {session === null ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            <Trash2 aria-hidden="true" />
            Forget
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={blocked !== null || busy}
          title={blocked ?? undefined}
          onClick={signInNow}
        >
          {start.isPending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <LogIn aria-hidden="true" />
          )}
          {session === null ? 'Sign in…' : 'Sign in again'}
        </Button>
      </>
    )
  }

  const outcome =
    signIn !== null && (signIn.status === 'failed' || signIn.status === 'cancelled')
      ? signIn
      : null

  return (
    <section
      aria-labelledby="preview-session-heading"
      className="flex flex-col gap-3 border-t pt-4"
    >
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="preview-session-heading" className="text-sm font-semibold">
            Signed-in session
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">For apps behind a login.</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
      </div>

      <div aria-live="polite" className="flex flex-col gap-3">
        {status.data === undefined ? (
          status.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <StateCard
              tone="neutral"
              icon={<CircleX className="text-status-failed" />}
              title="Couldn’t load the session."
              detail={errorMessage(status.error)}
            />
          )
        ) : active && signIn !== null ? (
          <ActiveSignIn signIn={signIn} />
        ) : (
          <SessionCard session={session} />
        )}
        <p className="-mt-1.5 text-xs text-muted-foreground">
          Kept only on this Mac (<code className="font-mono">~/.yugotool</code>), as cookies and
          local storage.
        </p>
        {outcome === null || active ? null : (
          <SignInOutcome key={outcome.startedAt} signIn={outcome} />
        )}
      </div>

      <AlertDialog
        open={confirming}
        onOpenChange={(next) => {
          if (forget.isPending) return
          setConfirming(next)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget the signed-in session?</AlertDialogTitle>
            <AlertDialogDescription>
              Its cookies and local storage are deleted from this Mac. Previews and QA open the
              app as a new visitor until you sign in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={forget.isPending}>
              Keep session
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={forget.isPending}
              onClick={() =>
                forget.mutate(undefined, {
                  onSuccess: () => {
                    setConfirming(false)
                    toast.success('Session forgotten. Previews open the app signed out.')
                  },
                  onError: (error) =>
                    toast.error(`Couldn't forget the session: ${errorMessage(error)}`),
                })
              }
            >
              {forget.isPending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              Forget session
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

type Tone = 'neutral' | 'running' | 'waiting'

/** One fixed-height card for every state, so switching states never moves the page. */
function StateCard({
  tone,
  icon,
  title,
  detail,
  detailTitle,
  detailMono = false,
}: {
  tone: Tone
  icon: ReactNode
  title: ReactNode
  detail: ReactNode
  /** Full text on hover, for a truncated detail. */
  detailTitle?: string
  detailMono?: boolean
}) {
  return (
    <div
      className={cn(
        'flex h-16 items-start gap-2.5 rounded-md border px-3 py-2.5',
        tone === 'neutral' && 'bg-card/50',
        tone === 'running' && 'border-status-running/30 bg-status-running-soft',
        tone === 'waiting' && 'border-status-waiting/40 bg-status-waiting-soft',
      )}
    >
      <span className="mt-0.5 flex shrink-0 [&_svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="truncate text-[0.8125rem] leading-5">{title}</div>
        <div
          className={cn(
            'truncate text-xs leading-4 text-muted-foreground',
            detailMono && 'font-mono',
          )}
          title={detailTitle}
        >
          {detail}
        </div>
      </div>
    </div>
  )
}

function SessionCard({ session }: { session: PreviewSession | null }) {
  // Re-render so "saved 3 min ago" keeps up.
  useNow(30_000, session !== null)
  if (session === null) {
    return (
      <StateCard
        tone="neutral"
        icon={<CircleDashed className="text-muted-foreground" />}
        title="Signed out. Previews and QA open the app as a new visitor."
        detail="Sign in once and Test preview, QA screenshots and the QA browser start signed in."
      />
    )
  }
  const domains = session.domains.join(', ')
  return (
    <StateCard
      tone="neutral"
      icon={<CircleCheck className="text-status-passed" />}
      title={
        <span title={domains || undefined}>
          <span className="font-medium">Signed in</span>
          <span className="text-muted-foreground">
            {` · saved ${formatRelative(session.savedAt)} · ${storedSummary(session)}`}
            {domains === '' ? null : ' · '}
          </span>
          {domains === '' ? null : <span className="font-mono text-xs">{domains}</span>}
        </span>
      }
      detail="Test preview, QA screenshots and the QA browser start with this session. If it expires, sign in again."
    />
  )
}

/** "2 cookies, 4 local storage keys": only what the session actually holds. */
function storedSummary({ cookieCount, storageKeys }: PreviewSession): string {
  const parts = [
    cookieCount > 0 ? `${cookieCount} ${cookieCount === 1 ? 'cookie' : 'cookies'}` : null,
    storageKeys > 0
      ? `${storageKeys} local storage ${storageKeys === 1 ? 'key' : 'keys'}`
      : null,
  ].filter((part) => part !== null)
  return parts.length === 0 ? 'nothing stored' : parts.join(', ')
}

function ActiveSignIn({ signIn }: { signIn: PreviewSignIn }) {
  const now = useNow(1000, true)
  const elapsed = Math.max(0, Math.round((now - new Date(signIn.startedAt).getTime()) / 1000))
  if (signIn.status === 'waiting') {
    return (
      <StateCard
        tone="waiting"
        icon={<AppWindow className="text-status-waiting" />}
        title={
          <span className="font-medium">
            A browser window opened on this Mac. Sign in there, then close the window — or click
            Done.
          </span>
        }
        detail={signIn.url ?? 'Opening the app…'}
        detailTitle={signIn.url ?? undefined}
        detailMono={signIn.url !== null}
      />
    )
  }
  const lastLine = signIn.logs.trimEnd().split('\n').at(-1)?.trim() ?? ''
  return (
    <StateCard
      tone="running"
      icon={<LoaderCircle className="animate-spin text-status-running" />}
      title={
        <span className="flex items-center gap-2 text-status-running">
          Starting the preview…
          <span className="ml-auto font-mono text-xs tabular-nums">{elapsed}s</span>
        </span>
      }
      detail={
        lastLine === '' ? 'A browser window opens on this Mac once the app is up.' : lastLine
      }
      detailTitle={lastLine || undefined}
      detailMono={lastLine !== ''}
    />
  )
}

/** The last attempt failed or was cancelled; the saved session (if any) stays above. */
function SignInOutcome({ signIn }: { signIn: PreviewSignIn }) {
  const toEnd = useCallback((element: HTMLPreElement | null) => {
    if (element !== null) element.scrollTop = element.scrollHeight
  }, [])
  const failed = signIn.status === 'failed'
  const when = formatRelative(signIn.finishedAt ?? signIn.startedAt)
  return (
    <div className="flex flex-col gap-2">
      <p
        className={cn(
          'flex min-h-8 items-center gap-2 rounded-md px-2.5 py-1.5 text-[0.8125rem]',
          failed
            ? 'bg-status-failed-soft text-status-failed'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {failed ? (
          <CircleX aria-hidden="true" className="size-3.5 shrink-0" />
        ) : (
          <X aria-hidden="true" className="size-3.5 shrink-0" />
        )}
        <span className="min-w-0 flex-1">
          {failed
            ? `Sign-in failed: ${signIn.error ?? 'the preview did not come up.'}`
            : (signIn.error ?? 'Sign-in cancelled. Nothing was saved.')}
        </span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {when}
        </span>
      </p>
      {failed && signIn.logs.trim() !== '' ? (
        <div className="flex flex-col gap-1">
          <span className="label-caps">Log tail</span>
          <pre
            ref={toEnd}
            className="h-[150px] scrollbar-thin overflow-auto rounded-md border bg-muted/40 px-2.5 py-2 font-mono text-[0.75rem] leading-relaxed whitespace-pre text-muted-foreground"
          >
            {signIn.logs.trimEnd()}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
