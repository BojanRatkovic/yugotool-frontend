import { useQuery } from '@tanstack/react-query'
import { UserRound } from 'lucide-react'
import { toast } from 'sonner'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  claudeAccountQueries,
  useSetProjectAccount,
} from '@/features/claude-accounts/api/claude-accounts-queries'
import {
  planLabel,
  projectAccount,
  shortEmail,
} from '@/features/claude-accounts/utils/claude-accounts'
import { errorMessage } from '@/lib/api-client'

const DEFAULT_ITEM = '__default__'

/**
 * Project settings → General: the Claude account its sessions run on (spec 0016).
 * `machineEmail`: who "This machine" is, for "Default (…)" when no account is default.
 */
export function ProjectAccountSelect({
  projectId,
  accountId,
  machineEmail,
}: {
  projectId: string
  accountId: string | null
  machineEmail: string | null
}) {
  const accounts = useQuery(claudeAccountQueries.list())
  const update = useSetProjectAccount(projectId)
  const list = accounts.data ?? []
  const fallback = list.find((a) => a.isDefault)
  const fallbackName =
    fallback === undefined ? (machineEmail ?? 'this machine') : fallback.label
  const value = update.isPending ? update.variables : accountId

  return (
    <Select
      value={value ?? DEFAULT_ITEM}
      disabled={update.isPending || accounts.isPending}
      onValueChange={(next) => {
        const chosen = next === DEFAULT_ITEM ? null : next
        if (chosen === accountId) return
        update.mutate(chosen, {
          onSuccess: () =>
            toast.success(
              `New sessions run on ${chosen === null ? `the default (${fallbackName})` : (list.find((a) => a.id === chosen)?.label ?? 'that account')}.`,
            ),
          onError: (error) =>
            toast.error(`Couldn't change the account: ${errorMessage(error)}`),
        })
      }}
    >
      <SelectTrigger id="project-claude-account" size="sm" className="w-full text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectItem value={DEFAULT_ITEM}>Default ({fallbackName})</SelectItem>
        {list.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {[
              account.label,
              account.kind === 'api_key' ? 'API key' : planLabel(account.subscriptionType),
            ]
              .filter(Boolean)
              .join(' · ')}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** The project header's and work order panel's chip: only when not on the default account. */
export function ProjectAccountChip({ accountId }: { accountId: string | null }) {
  const accounts = useQuery({ ...claudeAccountQueries.list(), enabled: accountId !== null })
  const account = projectAccount(accounts.data ?? [], accountId)
  if (account === null) return null
  const name = account.email === null ? account.label : shortEmail(account.email)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- reveals the full account
          tabIndex={0}
          className="inline-flex h-5 max-w-48 shrink-0 items-center gap-1 rounded-sm bg-muted px-1.5 text-[0.6875rem] text-muted-foreground"
        >
          <UserRound aria-hidden="true" className="size-3" />
          <span className="truncate">{name}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Sessions run on {account.email ?? account.label}
        {account.kind === 'api_key' ? ' (API key)' : ''}, not the default account.
      </TooltipContent>
    </Tooltip>
  )
}
