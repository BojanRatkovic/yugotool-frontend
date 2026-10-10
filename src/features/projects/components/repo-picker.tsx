import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, FolderGit2, FolderOpen, Network } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { repoQueries } from '@/features/projects/api/repo-queries'
import type { Repo } from '@/lib/contracts'
import { tildePath } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Searchable combobox over the git repos the backend found in the repos folder. */
export function RepoPicker({
  id,
  value,
  onPick,
  reposRoot,
  onOpenSettings,
}: {
  id: string
  value: string
  onPick: (repo: Repo) => void
  /** The folder scanned (Settings → Repos folder); shown in the footer. */
  reposRoot?: string
  /** Opens Settings at the Repos folder field. */
  onOpenSettings?: () => void
}) {
  const folder = reposRoot === undefined ? 'the repos folder' : tildePath(reposRoot)
  const [open, setOpen] = useState(false)
  const repos = useQuery(repoQueries.list())
  const picked = repos.data?.find((repo) => repo.path === value)

  return (
    // `modal`: the picker opens inside a Dialog, whose scroll lock swallows wheel
    // events on this portaled list. A modal popover takes over the lock and lets it scroll.
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <FolderGit2 aria-hidden="true" className="text-muted-foreground" />
            {picked === undefined ? (
              <span className="truncate text-muted-foreground">
                {value === '' ? 'Pick a repository…' : value}
              </span>
            ) : (
              <span className="truncate">
                {picked.name}
                {picked.kind === 'hub' ? (
                  <span className="text-muted-foreground"> · hub</span>
                ) : null}
              </span>
            )}
          </span>
          <ChevronsUpDown aria-hidden="true" className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
        <Command
          // Match on name and path; cmdk's default only sees `value`.
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Search repositories…" />
          <CommandList>
            {repos.isPending ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Scanning…</p>
            ) : repos.error !== null ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Couldn&rsquo;t list repositories ({repos.error.message}). Enter the path
                manually.
              </p>
            ) : repos.data.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-6 text-center text-sm text-muted-foreground">
                <p>
                  No git repos in <span className="font-mono text-xs break-all">{folder}</span>.
                </p>
                {onOpenSettings === undefined ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOpen(false)
                      onOpenSettings()
                    }}
                  >
                    Set the repos folder in Settings
                  </Button>
                )}
              </div>
            ) : (
              <>
                <CommandEmpty>No repository matches.</CommandEmpty>
                <CommandGroup>
                  {repos.data.map((repo) => (
                    <CommandItem
                      key={repo.path}
                      value={`${repo.name} ${repo.path}`}
                      onSelect={() => {
                        onPick(repo)
                        setOpen(false)
                      }}
                      className="items-start"
                    >
                      <Check
                        aria-hidden="true"
                        className={cn(
                          'mt-0.5',
                          repo.path === value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5">
                            {repo.kind === 'hub' ? (
                              <Network
                                aria-hidden="true"
                                className="size-3.5 shrink-0 text-muted-foreground"
                              />
                            ) : null}
                            <span className="truncate font-medium">{repo.name}</span>
                          </span>
                          {repo.kind === 'hub' ? (
                            <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
                              hub · {repo.repoCount ?? 0}{' '}
                              {repo.repoCount === 1 ? 'repo' : 'repos'}
                            </span>
                          ) : repo.currentBranch === null ? null : (
                            <span className="shrink-0 font-mono text-[0.6875rem] text-muted-foreground">
                              {repo.currentBranch}
                            </span>
                          )}
                        </span>
                        <span className="truncate font-mono text-[0.6875rem] text-muted-foreground">
                          {repo.path}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
          <div className="flex h-9 items-center gap-2 border-t px-3 text-xs text-muted-foreground">
            <FolderOpen aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-mono" title={reposRoot}>
              {folder}
            </span>
            {onOpenSettings === undefined ? null : (
              <button
                type="button"
                className="shrink-0 underline-offset-4 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none"
                onClick={() => {
                  setOpen(false)
                  onOpenSettings()
                }}
              >
                Change folder
              </button>
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
