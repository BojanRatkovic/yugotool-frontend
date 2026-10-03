import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'

import { useNeedsYou } from '@/app/routes/-components/use-needs-you'
import { StatusIcon } from '@/components/status/status-chip'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { NewProjectDialog } from '@/app/routes/-components/new-project-dialog'
import { DoctorBanner } from '@/features/system/components/doctor-banner'
import { IS_MAC } from '@/lib/shortcuts'

export const Route = createFileRoute('/')({
  component: HomePage,
})

/** The four words a newcomer needs, one line each. */
const GLOSSARY: readonly [term: string, meaning: string][] = [
  ['Project', 'a local git repo ZASTAVA works in.'],
  ['Line', 'the stations every work order goes through (build, QA, review…).'],
  ['Work order', 'one task; it waits in Backlog until you start it.'],
  ['Run', 'one trip down the line; it stops at a gate when it needs you.'],
]

function NeedsYouList() {
  const { items } = useNeedsYou()
  if (items.length === 0) return null
  return (
    <section aria-labelledby="home-needs-you" className="flex w-full max-w-lg flex-col gap-2">
      <h2 id="home-needs-you" className="label-caps text-left">
        Needs you · {items.length}
      </h2>
      <ul className="flex flex-col overflow-hidden rounded-md border bg-card">
        {items.map(({ workOrder, project, stationName }) => (
          <li key={workOrder.id} className="border-b last:border-b-0">
            <Link
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              search={{ view: 'board', wo: workOrder.id }}
              className="relative flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-[3px] bg-status-waiting"
              />
              <StatusIcon status="awaiting_approval" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[0.8125rem] font-medium">{workOrder.title}</span>
                <span className="truncate text-xs text-muted-foreground">{project.name}</span>
              </span>
              <span className="shrink-0 text-xs text-status-waiting">
                Needs you{stationName === null ? '' : ` · ${stationName}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function HomePage() {
  const [creating, setCreating] = useState(false)
  return (
    <div className="dot-grid flex h-svh flex-1 flex-col">
      {/* Reserved slot: the banner appears once the checks return without moving the page. */}
      <div className="flex min-h-16 shrink-0 items-end justify-center px-8">
        <DoctorBanner />
      </div>
      <div className="flex min-h-0 flex-1 scrollbar-thin flex-col items-center justify-center gap-6 overflow-y-auto px-8 pt-4 pb-20 text-center">
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-xl font-semibold text-balance">Pick a project</h1>
          <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
            Choose a project in the sidebar, or create one that points at a local git
            repository.
          </p>
        </div>
        <dl className="grid max-w-lg grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-md border bg-card/60 px-4 py-3 text-left text-[0.8125rem]">
          {GLOSSARY.map(([term, meaning]) => (
            <div key={term} className="contents">
              <dt className="font-medium">{term}</dt>
              <dd className="text-muted-foreground">{meaning}</dd>
            </div>
          ))}
        </dl>
        <Button onClick={() => setCreating(true)}>New project</Button>
        <NeedsYouList />
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <KbdGroup>
            <Kbd>{IS_MAC ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
          opens the command palette
        </p>
      </div>
      {creating ? <NewProjectDialog open={creating} onOpenChange={setCreating} /> : null}
    </div>
  )
}
