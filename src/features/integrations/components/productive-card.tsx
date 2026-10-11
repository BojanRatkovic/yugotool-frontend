import { useQuery } from '@tanstack/react-query'
import { KeyRound, Plug, Unplug } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { ProductiveMark } from '@/components/productive-mark'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  productiveQueries,
  useConnectProductive,
  useDisconnectProductive,
} from '@/features/integrations/api/productive-queries'
import { ProductiveConnectDialog } from '@/features/integrations/components/productive-connect-dialog'
import { errorMessage } from '@/lib/api-client'
import type { ProductiveConnection } from '@/lib/contracts'
import { formatDateTime, formatRelative } from '@/lib/format'

/**
 * Settings → Integrations → Productive (spec 0019): connect with a token, then
 * import tasks into a project's backlog from its board.
 */
export function ProductiveCard() {
  const status = useQuery(productiveQueries.status())
  const [dialog, setDialog] = useState<'connect' | 'replace' | null>(null)
  const connection = status.data?.connection ?? null

  return (
    <article
      aria-labelledby="productive-title"
      className="flex flex-col rounded-lg border bg-card"
      data-testid="productive-card"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <ProductiveMark className="size-8" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 id="productive-title" className="flex items-center gap-2 text-sm font-semibold">
              Productive
              {status.isPending ? null : connection === null ? (
                <Badge variant="outline" className="h-4.5 px-1.5 text-[0.6875rem] font-normal">
                  Not connected
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="h-4.5 gap-1 px-1.5 text-[0.6875rem] font-normal"
                >
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-status-passed" />
                  Connected
                </Badge>
              )}
            </h3>
            <p className="text-[0.8125rem] text-muted-foreground">
              Pull tasks into a project&rsquo;s backlog: title, description and a link back.
              Read-only; nothing changes in Productive.
            </p>
          </div>
        </div>
        {status.isPending || connection !== null ? null : (
          <Button
            type="button"
            size="sm"
            className="self-start"
            onClick={() => setDialog('connect')}
          >
            <Plug aria-hidden="true" />
            Connect
          </Button>
        )}
      </div>
      {status.isPending ? (
        <div className="flex flex-col gap-2 border-t px-4 py-3" aria-busy="true">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : status.data === undefined ? (
        <p className="border-t px-4 py-3 text-[0.8125rem] text-destructive">
          Couldn&rsquo;t load the connection: {errorMessage(status.error)}
        </p>
      ) : connection === null ? null : (
        <ConnectedDetails connection={connection} onReplace={() => setDialog('replace')} />
      )}
      <ProductiveConnectDialog
        open={dialog !== null}
        replacing={dialog === 'replace'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      />
    </article>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 px-4 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-[0.8125rem]">{children}</dd>
    </div>
  )
}

function ConnectedDetails({
  connection,
  onReplace,
}: {
  connection: ProductiveConnection
  onReplace: () => void
}) {
  const connect = useConnectProductive()
  const disconnect = useDisconnectProductive()
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <dl className="divide-y border-t">
        <Detail label="Organization">
          {connection.organizations.length > 1 ? (
            <Select
              value={connection.organizationId}
              disabled={connect.isPending}
              onValueChange={(organizationId) =>
                connect.mutate(
                  { organizationId },
                  {
                    onSuccess: (next) =>
                      toast.success(`Productive switched to ${next.organizationName}.`),
                    onError: (error) =>
                      toast.error(`Couldn't switch organization: ${errorMessage(error)}`),
                  },
                )
              }
            >
              <SelectTrigger
                aria-label="Productive organization"
                className="h-8 w-full sm:w-64"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {connection.organizations.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            connection.organizationName
          )}
        </Detail>
        <Detail label="Signed in as">{connection.personName ?? 'Unknown person'}</Detail>
        <Detail label="Token">
          <span className="font-mono text-xs">{connection.tokenHint}</span>
        </Detail>
        <Detail label="Connected">
          <span title={formatDateTime(connection.connectedAt)}>
            {formatRelative(connection.connectedAt)}
          </span>
        </Detail>
      </dl>
      <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center">
        <p className="text-xs text-muted-foreground sm:mr-auto">
          Import from a project: New work order → Import from Productive.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onReplace}>
            <KeyRound aria-hidden="true" />
            Replace token
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirming(true)}
          >
            <Unplug aria-hidden="true" />
            Disconnect
          </Button>
        </div>
      </div>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Productive?</AlertDialogTitle>
            <AlertDialogDescription>
              YugoTool forgets the token. Work orders you already imported stay, with their
              links to Productive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep connected</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                disconnect.mutate(undefined, {
                  onSuccess: () => toast.success('Productive disconnected.'),
                  onError: (error) =>
                    toast.error(`Couldn't disconnect: ${errorMessage(error)}`),
                })
              }
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
