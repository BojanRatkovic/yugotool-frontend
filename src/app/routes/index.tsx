import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Plus, RotateCcw, Workflow } from 'lucide-react'
import { useState } from 'react'

import { FactoryScene, type SceneFocus } from '@/app/routes/-components/factory-scene'
import { type NeedsYouItem, useNeedsYou } from '@/app/routes/-components/use-needs-you'
import { StatusIcon } from '@/components/status/status-chip'
import { HeaderActions } from '@/components/layout/header-actions'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { NewProjectDialog } from '@/app/routes/-components/new-project-dialog'
import { DoctorBanner } from '@/features/system/components/doctor-banner'
import { IS_MAC } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
  component: HomePage,
})

interface TourStep {
  focus: SceneFocus
  term: string
  title: string
  description: string
}

/** The four words a newcomer needs, each shown on the factory it describes. */
const TOUR: readonly TourStep[] = [
  {
    focus: 'project',
    term: 'Project',
    title: 'Point YugoTool at a repo',
    description:
      'A project is a local Git repository. Every run gets its own branch and worktree, so your checkout stays yours.',
  },
  {
    focus: 'line',
    term: 'Line',
    title: 'Design the line once',
    description:
      'The stations every work order goes through: agents build, checks test, QA screenshots, gates wait for a person.',
  },
  {
    focus: 'work-order',
    term: 'Work order',
    title: 'Queue the work',
    description:
      'A work order is one task. It waits in Backlog until you start it; the dispatcher runs a few at a time.',
  },
  {
    focus: 'run',
    term: 'Run',
    title: 'Step in only at the gates',
    description:
      'A run is one trip down the line. When it reaches a gate it stops and lands in Needs you: approve, request changes or reject.',
  },
]

function TourTabs({ step, onPick }: { step: number; onPick: (index: number) => void }) {
  return (
    <div role="tablist" aria-label="How YugoTool works" className="flex items-center gap-1">
      {TOUR.map((item, index) => (
        <button
          key={item.term}
          type="button"
          role="tab"
          aria-selected={index === step}
          onClick={() => onPick(index)}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring',
            index === step
              ? 'bg-muted font-medium text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span className="font-mono text-[0.625rem] text-muted-foreground tabular-nums">
            {String(index + 1).padStart(2, '0')}
          </span>
          {item.term}
        </button>
      ))}
    </div>
  )
}

/** Always-there first-run panel: the four ideas on a live miniature, plus the one action. */
function FactoryTour({
  onNewProject,
  collapsed: startCollapsed,
}: {
  onNewProject: () => void
  /** Folded to one row while work waits on you; the decisions come first. */
  collapsed: boolean
}) {
  const [step, setStep] = useState(0)
  const [expanded, setExpanded] = useState(false)
  if (startCollapsed && !expanded) {
    return (
      <section className="flex w-full max-w-3xl items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left">
        <Workflow aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 text-[0.8125rem] text-muted-foreground">
          New here? See how a work order moves down the line.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(true)}>
          How it works
        </Button>
        <Button size="sm" onClick={onNewProject}>
          <Plus />
          New project
        </Button>
      </section>
    )
  }
  const current = TOUR[step] ?? TOUR[0]
  const isLast = step === TOUR.length - 1
  return (
    <section
      aria-labelledby="home-tour-title"
      className="flex w-full max-w-3xl flex-col overflow-hidden rounded-xl border bg-card text-left shadow-2xl shadow-black/30"
    >
      <div className="dot-grid relative h-72 border-b bg-background/70">
        <div className="absolute top-3 left-4 z-10">
          <TourTabs step={step} onPick={setStep} />
        </div>
        <FactoryScene focus={current.focus} />
      </div>
      <div className="flex flex-col gap-5 px-6 py-5">
        {/* Every step's copy shares one grid cell, so the panel is as tall as the longest and never jumps. */}
        <div className="grid">
          {TOUR.map((item) => (
            <div
              key={item.term}
              aria-hidden={item !== current}
              className={cn(
                'col-start-1 row-start-1 flex flex-col gap-1.5',
                item !== current && 'invisible',
              )}
            >
              <h2
                id={item === current ? 'home-tour-title' : undefined}
                className="text-base font-semibold"
              >
                {item.title}
              </h2>
              <p className="max-w-xl text-[0.8125rem] text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous"
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft />
            </Button>
            <Button variant="outline" onClick={() => setStep(isLast ? 0 : step + 1)}>
              {isLast ? 'Start over' : 'Next'}
              {isLast ? <RotateCcw /> : <ArrowRight />}
            </Button>
          </div>
          <Button onClick={onNewProject}>
            <Plus />
            New project
          </Button>
        </div>
      </div>
    </section>
  )
}

function NeedsYouList({ items }: { items: readonly NeedsYouItem[] }) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby="home-needs-you" className="flex w-full max-w-3xl flex-col gap-2">
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
  const { items: needsYou } = useNeedsYou()
  return (
    <div className="dot-grid relative flex h-svh flex-1 flex-col">
      {/* No page header here: the app-wide actions float in the header band's spot. */}
      <HeaderActions className="absolute top-0 right-3 z-10 h-12" />
      {/* Reserved slot: the banner appears once the checks return without moving the page. */}
      <div className="flex min-h-16 shrink-0 items-end justify-center px-8">
        <DoctorBanner />
      </div>
      <div className="flex min-h-0 flex-1 scrollbar-thin flex-col items-center justify-center gap-6 overflow-y-auto px-8 pt-4 pb-20 text-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-semibold text-balance">Pick a project</h1>
          <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
            Choose one in the sidebar, or start a new one from a local Git repository.
          </p>
        </div>
        <NeedsYouList items={needsYou} />
        <FactoryTour collapsed={needsYou.length > 0} onNewProject={() => setCreating(true)} />
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
