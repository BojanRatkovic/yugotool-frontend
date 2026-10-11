import { useQuery } from '@tanstack/react-query'
import { CircleCheck, CircleX, ExternalLink, LoaderCircle } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  claudeAccountQueries,
  useSubmitLoginCode,
} from '@/features/claude-accounts/api/claude-accounts-queries'
import { errorMessage } from '@/lib/api-client'

/**
 * A `claude auth login` in progress (spec 0016 §4): the browser it opened
 * finishes by itself; the manual link and a pasted code are the fallback.
 */
export function ClaudeLoginPanel({ loginId }: { loginId: string }) {
  const login = useQuery(claudeAccountQueries.login(loginId))
  const accounts = useQuery(claudeAccountQueries.list())
  const email =
    accounts.data?.find((account) => account.id === login.data?.accountId)?.email ?? null
  const submit = useSubmitLoginCode()
  const [code, setCode] = useState('')
  const state = login.data?.state ?? 'pending'

  if (state === 'done') {
    return (
      <output className="flex items-center gap-2 text-sm">
        <CircleCheck aria-hidden="true" className="size-4 text-status-passed" />
        Signed in{email === null ? '.' : ` as ${email}.`}
      </output>
    )
  }
  if (state === 'failed') {
    return (
      <p className="flex items-center gap-2 text-sm text-destructive" role="alert">
        <CircleX aria-hidden="true" className="size-4" />
        {login.data?.error ?? 'Sign-in failed.'}
      </p>
    )
  }
  const url = login.data?.url ?? null
  return (
    <div className="flex flex-col gap-3">
      <output className="flex items-center gap-2 text-sm">
        <LoaderCircle
          aria-hidden="true"
          className="size-4 animate-spin text-muted-foreground"
        />
        Waiting for you to finish in the browser…
      </output>
      {url === null ? null : (
        <form
          className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = code.trim()
            if (trimmed === '' || submit.isPending) return
            submit.mutate({ id: loginId, code: trimmed })
          }}
        >
          <p className="text-xs text-muted-foreground">
            Browser didn&rsquo;t open?{' '}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-foreground underline-offset-4 hover:underline"
            >
              Open the sign-in page
              <ExternalLink aria-hidden="true" className="size-3" />
            </a>
            , then paste the code it shows.
          </p>
          <div className="flex gap-2">
            <Input
              aria-label="Code from the sign-in page"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Paste code"
              className="h-8 font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="submit" size="sm" disabled={code.trim() === '' || submit.isPending}>
              Submit
            </Button>
          </div>
          {submit.isError ? (
            <p className="text-xs text-destructive">{errorMessage(submit.error)}</p>
          ) : null}
        </form>
      )}
    </div>
  )
}
