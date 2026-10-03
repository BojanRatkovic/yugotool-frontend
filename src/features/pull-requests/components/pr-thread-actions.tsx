import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useReplyToThread, useResolveThread } from '@/features/pull-requests/api/pr-mutations'
import { errorMessage } from '@/lib/api-client'
import type { PrThread } from '@/lib/contracts'

/** Reply (⌘↵ sends) and resolve / unresolve, under a thread. */
export function PrThreadActions({
  projectId,
  number,
  thread,
}: {
  projectId: string
  number: number
  thread: PrThread
}) {
  const [replying, setReplying] = useState(false)
  const [body, setBody] = useState('')
  const reply = useReplyToThread(projectId, number)
  const resolve = useResolveThread(projectId, number)
  const send = () => {
    if (body.trim() === '' || reply.isPending) return
    reply.mutate(
      { threadId: thread.id, body },
      {
        onSuccess: () => {
          setBody('')
          setReplying(false)
        },
        onError: (error) => toast.error(`Couldn't reply: ${errorMessage(error)}`),
      },
    )
  }
  const toggleResolved = () =>
    resolve.mutate(
      { threadId: thread.id, resolved: !thread.isResolved },
      {
        onError: (error) =>
          toast.error(
            `Couldn't ${thread.isResolved ? 'unresolve' : 'resolve'}: ${errorMessage(error)}`,
          ),
      },
    )
  return (
    <div className="flex flex-col gap-2">
      {replying ? (
        <>
          <label htmlFor={`reply-${thread.id}`} className="sr-only">
            Reply
          </label>
          <Textarea
            id={`reply-${thread.id}`}
            ref={(el) => el?.focus()}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                setReplying(false)
              } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                send()
              }
            }}
            placeholder="Reply (markdown)"
            className="min-h-14 text-[0.8125rem]"
          />
        </>
      ) : null}
      <div className="flex items-center gap-2">
        {replying ? (
          <>
            <Button size="xs" disabled={body.trim() === '' || reply.isPending} onClick={send}>
              {reply.isPending ? 'Sending…' : 'Reply'}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setReplying(false)}>
              Cancel
            </Button>
          </>
        ) : thread.viewerCanReply ? (
          <Button
            size="xs"
            variant="outline"
            data-reply-for={thread.id}
            onClick={() => setReplying(true)}
          >
            Reply
          </Button>
        ) : null}
        {thread.viewerCanResolve ? (
          <Button
            size="xs"
            variant="ghost"
            data-resolve-for={thread.id}
            className="ml-auto"
            onClick={toggleResolved}
          >
            {thread.isResolved ? 'Unresolve' : 'Resolve'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
