import { useQuery } from '@tanstack/react-query'
import { KeyRound, LoaderCircle, LogIn } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  claudeAccountQueries,
  useCancelLogin,
  useCreateClaudeAccount,
  useStartClaudeLogin,
} from '@/features/claude-accounts/api/claude-accounts-queries'
import { ClaudeLoginPanel } from '@/features/claude-accounts/components/claude-login-panel'
import { ApiError, errorMessage } from '@/lib/api-client'

const CONSOLE_KEYS_URL = 'https://console.anthropic.com/settings/keys'

/** What the dialog does: add a new account, or sign an existing one in again. */
export type AccountDialogMode =
  | { kind: 'add' }
  | { kind: 'sign_in_again'; accountId: string; label: string }

/**
 * Add account: a Claude plan (`claude auth login` in a dir YugoTool creates) or
 * an API key. "Sign in again" reuses the plan flow on the account's own dir.
 */
export function AddClaudeAccountDialog({
  mode,
  onClose,
}: {
  mode: AccountDialogMode | null
  onClose: () => void
}) {
  const start = useStartClaudeLogin()
  const cancel = useCancelLogin()
  const createKey = useCreateClaudeAccount()
  const [label, setLabel] = useState('')
  const [email, setEmail] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [loginId, setLoginId] = useState<string | null>(null)
  const login = useQuery({
    ...claudeAccountQueries.login(loginId ?? ''),
    enabled: loginId !== null,
  })
  const loginState = loginId === null ? null : (login.data?.state ?? 'pending')

  function close() {
    if (loginId !== null && loginState === 'pending') cancel.mutate(loginId)
    setLoginId(null)
    setLabel('')
    setEmail('')
    setApiKey('')
    start.reset()
    createKey.reset()
    onClose()
  }

  function startLogin() {
    if (mode === null || start.isPending) return
    start.mutate(
      mode.kind === 'add'
        ? {
            ...(label.trim() === '' ? {} : { label: label.trim() }),
            ...(email.trim() === '' ? {} : { email: email.trim() }),
          }
        : {
            accountId: mode.accountId,
            ...(email.trim() === '' ? {} : { email: email.trim() }),
          },
      {
        onSuccess: (started) => setLoginId(started.id),
        onError: (error) => toast.error(`Couldn't start the sign-in: ${errorMessage(error)}`),
      },
    )
  }

  function saveKey() {
    if (createKey.isPending || apiKey.trim() === '' || label.trim() === '') return
    createKey.mutate(
      { kind: 'api_key', label: label.trim(), apiKey: apiKey.trim() },
      {
        onSuccess: () => {
          toast.success('API key added.')
          close()
        },
      },
    )
  }

  const keyError =
    createKey.error instanceof ApiError && createKey.error.code === 'api_key_invalid'
      ? createKey.error.message
      : createKey.isError
        ? errorMessage(createKey.error)
        : null

  const plan = (
    <div className="flex flex-col gap-4">
      {loginId === null ? (
        <>
          {mode?.kind === 'add' ? (
            <FormField id="account-label" label="Name (optional)" errors={[]}>
              <Input
                id="account-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Defaults to the account's email"
              />
            </FormField>
          ) : null}
          <FormField id="account-email" label="Email (optional)" errors={[]}>
            <Input
              id="account-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Pre-fills the sign-in page"
            />
          </FormField>
          <p className="text-xs text-muted-foreground">
            YugoTool runs <span className="font-mono">claude auth login</span> and opens the
            sign-in page in your browser.
          </p>
        </>
      ) : (
        <ClaudeLoginPanel loginId={loginId} />
      )}
    </div>
  )

  const footer =
    loginState === 'done' ? (
      <Button type="button" onClick={close}>
        Done
      </Button>
    ) : loginState === 'failed' ? (
      <>
        <Button type="button" variant="outline" onClick={close}>
          Close
        </Button>
        <Button
          type="button"
          onClick={() => {
            setLoginId(null)
            startLogin()
          }}
        >
          Try again
        </Button>
      </>
    ) : loginState === 'pending' ? (
      <Button type="button" variant="outline" onClick={close}>
        Cancel
      </Button>
    ) : null

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => (open ? undefined : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode?.kind === 'sign_in_again'
              ? `Sign in again: ${mode.label}`
              : 'Add Claude account'}
          </DialogTitle>
          <DialogDescription>
            {mode?.kind === 'sign_in_again'
              ? 'Sign in to Claude again for this account.'
              : 'Sessions of the projects that use it sign in with this account.'}
          </DialogDescription>
        </DialogHeader>
        {mode?.kind === 'sign_in_again' || loginId !== null ? (
          plan
        ) : (
          <Tabs defaultValue="plan">
            <TabsList>
              <TabsTrigger value="plan">Claude plan</TabsTrigger>
              <TabsTrigger value="key">API key</TabsTrigger>
            </TabsList>
            <TabsContent value="plan" className="pt-3">
              {plan}
              <DialogFooter className="pt-4">
                <Button type="button" onClick={startLogin} disabled={start.isPending}>
                  {start.isPending ? (
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                  ) : (
                    <LogIn aria-hidden="true" />
                  )}
                  Sign in
                </Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="key" className="pt-3">
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  saveKey()
                }}
              >
                <FormField id="key-label" label="Name" errors={[]}>
                  <Input
                    id="key-label"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="e.g. Team key"
                  />
                </FormField>
                <FormField
                  id="key-value"
                  label="API key"
                  errors={keyError === null ? [] : [keyError]}
                >
                  <Input
                    id="key-value"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={apiKey}
                    onChange={(event) => {
                      setApiKey(event.target.value)
                      if (createKey.isError) createKey.reset()
                    }}
                    placeholder="sk-ant-…"
                    className="font-mono text-xs"
                  />
                </FormField>
                <p className="text-xs text-muted-foreground">
                  From the{' '}
                  <a
                    href={CONSOLE_KEYS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    Anthropic Console
                  </a>
                  . Stored only in the local database on this Mac; runs on it bill per token.
                </p>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={
                      createKey.isPending || apiKey.trim() === '' || label.trim() === ''
                    }
                  >
                    {createKey.isPending ? (
                      <LoaderCircle aria-hidden="true" className="animate-spin" />
                    ) : (
                      <KeyRound aria-hidden="true" />
                    )}
                    {createKey.isPending ? 'Checking key…' : 'Add key'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
        )}
        {mode?.kind === 'sign_in_again' && loginId === null ? (
          <DialogFooter>
            <Button type="button" onClick={startLogin} disabled={start.isPending}>
              <LogIn aria-hidden="true" />
              Sign in
            </Button>
          </DialogFooter>
        ) : footer === null ? null : (
          <DialogFooter>{footer}</DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
