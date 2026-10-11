import { useQuery } from '@tanstack/react-query'
import {
  Ellipsis,
  KeyRound,
  LoaderCircle,
  Monitor,
  Plus,
  Star,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  claudeAccountQueries,
  useCreateClaudeAccount,
  useRemoveClaudeAccount,
  useSetDefaultClaudeAccount,
} from '@/features/claude-accounts/api/claude-accounts-queries'
import {
  AddClaudeAccountDialog,
  type AccountDialogMode,
} from '@/features/claude-accounts/components/add-claude-account-dialog'
import {
  accountDetail,
  addableDirs,
  planLabel,
  shortPath,
  STATUS_LABEL,
} from '@/features/claude-accounts/utils/claude-accounts'
import { errorMessage } from '@/lib/api-client'
import type { ClaudeAccount, SystemInfo } from '@/lib/contracts'
import { cn } from '@/lib/utils'

function AccountRow({
  icon,
  title,
  detail,
  badges,
  actions,
  testId,
}: {
  icon: ReactNode
  title: string
  detail: ReactNode
  badges?: ReactNode
  actions?: ReactNode
  testId?: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3" data-testid={testId}>
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground"
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex items-center gap-2 text-[0.8125rem] font-medium">
          <span className="truncate">{title}</span>
          {badges}
        </p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  )
}

function StatusChip({ account }: { account: ClaudeAccount }) {
  const ok = account.status === 'signed_in'
  return (
    <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          ok
            ? 'bg-status-passed'
            : account.status === 'unknown'
              ? 'bg-status-cancelled'
              : 'bg-status-failed',
        )}
      />
      {STATUS_LABEL[account.status]}
    </span>
  )
}

const defaultBadge = (
  <Badge variant="secondary" className="h-4.5 px-1.5 text-[0.6875rem]">
    Default
  </Badge>
)

/**
 * Settings → Claude accounts (spec 0016): the logins and API keys sessions run
 * on. "This machine" is the `claude` login the stack was started with; it stays
 * the default until another account is made default.
 */
export function ClaudeAccountsSection({ system }: { system: SystemInfo | undefined }) {
  const accounts = useQuery(claudeAccountQueries.list())
  const discovered = useQuery(claudeAccountQueries.discovered())
  const add = useCreateClaudeAccount()
  const remove = useRemoveClaudeAccount()
  const setDefault = useSetDefaultClaudeAccount()
  const [dialog, setDialog] = useState<AccountDialogMode | null>(null)
  const [removing, setRemoving] = useState<ClaudeAccount | null>(null)

  const list = accounts.data ?? []
  const machineIsDefault = !list.some((a) => a.isDefault)
  const addable = addableDirs(discovered.data ?? [])
  const login = system?.claudeLogin ?? null

  function makeDefault(accountId: string | null, name: string) {
    setDefault.mutate(accountId, {
      onSuccess: () => toast.success(`${name} is the default now.`),
      onError: (error) => toast.error(`Couldn't change the default: ${errorMessage(error)}`),
    })
  }

  return (
    <section aria-label="Claude accounts" className="flex flex-col gap-2.5">
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">Claude accounts</h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            Who agents sign in as. Projects use the default unless their settings pick another.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => setDialog({ kind: 'add' })}
        >
          <Plus aria-hidden="true" />
          Add account
        </Button>
      </div>
      <div className="divide-y rounded-lg border bg-card">
        <AccountRow
          testId="claude-account-machine"
          icon={
            system?.authSource === 'api_key' && machineIsDefault ? (
              <KeyRound className="size-4" />
            ) : (
              <Monitor className="size-4" />
            )
          }
          title={list.length === 0 ? 'Using claude on this machine' : 'This machine'}
          badges={machineIsDefault ? defaultBadge : null}
          detail={
            system?.authSource === 'api_key' && machineIsDefault ? (
              'API key from the environment (ANTHROPIC_API_KEY)'
            ) : login === null ? (
              <>
                Not signed in. Run <span className="font-mono">claude</span> in a terminal and
                log in, or add an account.
              </>
            ) : (
              [
                login.email,
                login.orgName,
                planLabel(login.subscriptionType),
                shortPath(login.configDir),
              ]
                .filter(Boolean)
                .join(' · ')
            )
          }
          actions={
            machineIsDefault ? null : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={setDefault.isPending}
                onClick={() => makeDefault(null, 'This machine')}
              >
                Make default
              </Button>
            )
          }
        />
        {list.map((account) => (
          <AccountRow
            key={account.id}
            testId="claude-account"
            icon={
              account.kind === 'api_key' ? (
                <KeyRound className="size-4" />
              ) : (
                <UserRound className="size-4" />
              )
            }
            title={account.label}
            badges={
              <>
                {account.isDefault ? defaultBadge : null}
                <StatusChip account={account} />
              </>
            }
            detail={accountDetail(account)}
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Actions for ${account.label}`}
                  >
                    <Ellipsis aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {account.isDefault ? null : (
                    <DropdownMenuItem onSelect={() => makeDefault(account.id, account.label)}>
                      <Star aria-hidden="true" />
                      Make default
                    </DropdownMenuItem>
                  )}
                  {account.kind === 'config_dir' ? (
                    <DropdownMenuItem
                      onSelect={() =>
                        setDialog({
                          kind: 'sign_in_again',
                          accountId: account.id,
                          label: account.label,
                        })
                      }
                    >
                      <UserRound aria-hidden="true" />
                      Sign in again
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(account)}>
                    <Trash2 aria-hidden="true" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
        ))}
        {addable.map((dir) => (
          <AccountRow
            key={dir.configDir}
            testId="claude-account-found"
            icon={<UserRound className="size-4" />}
            title={dir.email ?? shortPath(dir.configDir)}
            badges={
              <span className="text-xs font-normal text-muted-foreground">
                Found on this machine
              </span>
            }
            detail={[dir.orgName, planLabel(dir.subscriptionType), shortPath(dir.configDir)]
              .filter(Boolean)
              .join(' · ')}
            actions={
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={add.isPending}
                onClick={() =>
                  add.mutate(
                    { kind: 'config_dir', configDir: dir.configDir },
                    {
                      onSuccess: (account) => toast.success(`${account.label} added.`),
                      onError: (error) =>
                        toast.error(`Couldn't add the account: ${errorMessage(error)}`),
                    },
                  )
                }
              >
                {add.isPending && add.variables.configDir === dir.configDir ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : null}
                Use this account
              </Button>
            }
          />
        ))}
      </div>

      <AddClaudeAccountDialog mode={dialog} onClose={() => setDialog(null)} />

      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setRemoving(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Projects on it switch to the default account.{' '}
              {removing?.kind === 'api_key'
                ? 'The key is deleted from this Mac; it stays valid in the Anthropic Console.'
                : removing?.managed
                  ? 'YugoTool signs it out and deletes the folder it created for it.'
                  : `Its folder (${removing?.configDir === null || removing === null ? '' : shortPath(removing.configDir)}) is not touched; you stay signed in there.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={remove.isPending}>
              Keep
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending || removing === null}
              onClick={() => {
                if (removing === null) return
                remove.mutate(removing.id, {
                  onSuccess: () => {
                    toast.success(`${removing.label} removed.`)
                    setRemoving(null)
                  },
                  onError: (error) => toast.error(`Couldn't remove it: ${errorMessage(error)}`),
                })
              }}
            >
              {remove.isPending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
