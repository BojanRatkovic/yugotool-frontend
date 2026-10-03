import { Check, Plus, TriangleAlert, X } from 'lucide-react'
import { useState } from 'react'

import { FormField } from '@/components/form-field'
import { EffortSelect, ModelSelect, parseBudget } from '@/components/model-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Toggle } from '@/components/ui/toggle'
import {
  AGENT_TOOLS,
  SHIFT_HANDOFF_MAX,
  SHIFT_HANDOFF_MIN,
  SHIFT_HANDOFF_RECOMMENDED,
  handoffTrackPct,
  toolOrder,
} from '@/features/projects/utils/line-draft'
import {
  QA_VIEWPORTS,
  qaAlwaysCheckSchema,
  qaThemeSchema,
  qaViewportSchema,
  type AgentStation,
  type QaStation,
  type ShiftStation,
  type Station,
} from '@/lib/contracts'

type Issues = ReadonlyMap<string, string>

function errorsFor(issues: Issues, field: string): string[] {
  const message = issues.get(field)
  return message === undefined ? [] : [message]
}

/**
 * Fields for one station. Controlled: the value lives in the line form
 * (TanStack Form); every edit hands back a whole new station.
 */
export function StationEditor({
  station,
  issues,
  onChange,
  previewMissing = false,
  onSetupPreview,
}: {
  station: Station
  issues: Issues
  onChange: (station: Station) => void
  /** The project has no preview config (QA stations can't run). */
  previewMissing?: boolean
  onSetupPreview?: () => void
}) {
  const id = (field: string) => `station-${station.key}-${field}`

  const nameField = (
    <FormField id={id('name')} label="Name" errors={errorsFor(issues, 'name')}>
      <Input
        id={id('name')}
        value={station.name}
        onChange={(event) => onChange({ ...station, name: event.target.value })}
      />
    </FormField>
  )

  if (station.kind === 'gate') {
    return (
      <div className="flex flex-col gap-4">
        {nameField}
        <FormField
          id={id('prompt')}
          label="Prompt for the reviewer"
          errors={errorsFor(issues, 'prompt')}
        >
          <Textarea
            id={id('prompt')}
            value={station.prompt}
            rows={5}
            onChange={(event) => onChange({ ...station, prompt: event.target.value })}
          />
        </FormField>
      </div>
    )
  }

  if (station.kind === 'checks') {
    return (
      <div className="flex flex-col gap-4">
        {nameField}
        <FormField id={id('command')} label="Command" errors={errorsFor(issues, 'command')}>
          <Input
            id={id('command')}
            value={station.command}
            className="font-mono"
            placeholder="pnpm lint && pnpm test"
            onChange={(event) => onChange({ ...station, command: event.target.value })}
          />
        </FormField>
        <p className="text-xs text-muted-foreground">
          Runs in the worktree. A non-zero exit sends the order back to the builder.
        </p>
      </div>
    )
  }

  if (station.kind === 'qa') {
    return (
      <QaFields
        station={station}
        issues={issues}
        onChange={onChange}
        nameField={nameField}
        previewMissing={previewMissing}
        onSetupPreview={onSetupPreview}
      />
    )
  }

  if (station.kind === 'shift') {
    return (
      <ShiftFields
        station={station}
        issues={issues}
        onChange={onChange}
        nameField={nameField}
      />
    )
  }

  return (
    <AgentFields station={station} issues={issues} onChange={onChange} nameField={nameField} />
  )
}

type SessionPatch = Partial<
  Pick<AgentStation, 'role' | 'model' | 'effort' | 'maxBudgetUsd' | 'allowedTools' | 'prompt'>
>

/** Name, role, model, effort, budget and tools — shared by agent and shift stations. */
function SessionFields({
  station,
  issues,
  set,
  nameField,
  budgetLabel,
}: {
  station: AgentStation | ShiftStation
  issues: Issues
  set: (patch: SessionPatch) => void
  nameField: React.ReactNode
  budgetLabel: string
}) {
  const id = (field: string) => `station-${station.key}-${field}`

  function toggleTool(tool: string, on: boolean) {
    const tools = on
      ? [...station.allowedTools, tool]
      : station.allowedTools.filter((t) => t !== tool)
    // Keep the canonical order so diffs against the saved line stay stable.
    set({ allowedTools: tools.toSorted((a, b) => toolOrder(a) - toolOrder(b)) })
  }

  const extraTools = station.allowedTools.filter((tool) => !AGENT_TOOLS.includes(tool))

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {nameField}
        <FormField id={id('role')} label="Role" errors={errorsFor(issues, 'role')}>
          <Input
            id={id('role')}
            value={station.role}
            onChange={(event) => set({ role: event.target.value })}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField id={id('model')} label="Model" errors={errorsFor(issues, 'model')}>
          <ModelSelect
            id={id('model')}
            value={station.model}
            onChange={(model) => (model === null ? null : set({ model }))}
          />
        </FormField>
        <FormField id={id('effort')} label="Effort" errors={errorsFor(issues, 'effort')}>
          <EffortSelect
            id={id('effort')}
            value={station.effort ?? null}
            defaultLabel="Default"
            // Undefined drops the key on save; the dirty check ignores it too.
            onChange={(effort) => set({ effort: effort ?? undefined })}
          />
        </FormField>
      </div>
      <FormField
        id={id('maxBudgetUsd')}
        label={budgetLabel}
        errors={errorsFor(issues, 'maxBudgetUsd')}
      >
        <Input
          id={id('maxBudgetUsd')}
          type="number"
          inputMode="decimal"
          min={0.01}
          step={0.01}
          placeholder="No limit"
          className="tabular"
          value={station.maxBudgetUsd ?? ''}
          onChange={(event) => {
            const budget = parseBudget(event.target.value)
            if (budget === undefined) return
            set({ maxBudgetUsd: budget ?? undefined })
          }}
        />
      </FormField>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Allowed tools</legend>
        <div className="flex flex-wrap gap-1.5">
          {[...AGENT_TOOLS, ...extraTools].map((tool) => (
            <Toggle
              key={tool}
              size="sm"
              variant="outline"
              className="font-mono text-xs data-[state=on]:border-foreground/30 data-[state=on]:bg-accent data-[state=on]:text-foreground"
              pressed={station.allowedTools.includes(tool)}
              onPressedChange={(on) => toggleTool(tool, on)}
            >
              {tool}
            </Toggle>
          ))}
        </div>
      </fieldset>
    </>
  )
}

function PromptField({
  station,
  issues,
  set,
}: {
  station: AgentStation | ShiftStation
  issues: Issues
  set: (patch: SessionPatch) => void
}) {
  const id = `station-${station.key}-prompt`
  return (
    <FormField id={id} label="Prompt" errors={errorsFor(issues, 'prompt')}>
      <Textarea
        id={id}
        value={station.prompt}
        rows={16}
        className="min-h-72 font-mono text-xs leading-relaxed"
        onChange={(event) => set({ prompt: event.target.value })}
      />
    </FormField>
  )
}

function AgentFields({
  station,
  issues,
  onChange,
  nameField,
}: {
  station: AgentStation
  issues: Issues
  onChange: (station: Station) => void
  nameField: React.ReactNode
}) {
  const id = (field: string) => `station-${station.key}-${field}`
  const set = (patch: Partial<AgentStation>) => onChange({ ...station, ...patch })

  return (
    <div className="flex flex-col gap-4">
      <SessionFields
        station={station}
        issues={issues}
        set={set}
        nameField={nameField}
        budgetLabel="Max budget per session (USD)"
      />
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={id('canEdit')} className="flex flex-col items-start gap-0.5">
            Can edit files
            <span className="text-xs font-normal text-muted-foreground">
              Lets the agent write to the worktree.
            </span>
          </Label>
          <Switch
            id={id('canEdit')}
            checked={station.canEdit}
            onCheckedChange={(canEdit) => {
              // Editors never read knowledge (spec 0007); drop the flag with the switch.
              const { useKnowledge: _drop, ...rest } = station
              onChange(canEdit ? { ...rest, canEdit } : { ...station, canEdit })
            }}
          />
        </div>
        {station.canEdit ? null : (
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={id('knowledge')} className="flex flex-col items-start gap-0.5">
              Reads team knowledge
              <span className="text-xs font-normal text-muted-foreground">
                The project&rsquo;s knowledge sources (Project settings &rarr; Knowledge), read
                before planning. Stations that edit files never get it.
              </span>
            </Label>
            <Switch
              id={id('knowledge')}
              checked={station.useKnowledge === true}
              onCheckedChange={(on) => {
                const { useKnowledge: _drop, ...rest } = station
                onChange(on ? { ...rest, useKnowledge: true } : rest)
              }}
            />
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={id('verdict')} className="flex flex-col items-start gap-0.5">
            Structured verdict
            <span className="text-xs font-normal text-muted-foreground">
              Validator output: pass/fail with findings.
            </span>
          </Label>
          <Switch
            id={id('verdict')}
            checked={station.structuredVerdict === true}
            onCheckedChange={(on) => {
              // Absent and false mean the same; dropping it keeps the dirty check honest.
              const { structuredVerdict: _drop, ...rest } = station
              onChange(on ? { ...rest, structuredVerdict: true } : rest)
            }}
          />
        </div>
      </div>
      <PromptField station={station} issues={issues} set={set} />
    </div>
  )
}

function ShiftFields({
  station,
  issues,
  onChange,
  nameField,
}: {
  station: ShiftStation
  issues: Issues
  onChange: (station: Station) => void
  nameField: React.ReactNode
}) {
  const id = (field: string) => `station-${station.key}-${field}`
  const set = (patch: Partial<ShiftStation>) => onChange({ ...station, ...patch })
  const [bandFrom, bandTo] = SHIFT_HANDOFF_RECOMMENDED
  const inBand = station.handoffAtPct >= bandFrom && station.handoffAtPct <= bandTo

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Works in shifts: when a session&rsquo;s context crosses the handoff threshold, the agent
        writes a handoff and a fresh session picks up from it. Memory lives in{' '}
        <span className="font-mono">.zastava/</span> in the worktree.
      </p>
      <FormField id={id('goal')} label="Goal" errors={errorsFor(issues, 'goal')}>
        <Textarea
          id={id('goal')}
          value={station.goal}
          rows={4}
          placeholder="What done means, in words — e.g. every operation in the spec is implemented and tested."
          onChange={(event) => set({ goal: event.target.value })}
        />
      </FormField>
      <FormField
        id={id('doneCommand')}
        label="Done command"
        errors={errorsFor(issues, 'doneCommand')}
      >
        <Input
          id={id('doneCommand')}
          value={station.doneCommand ?? ''}
          className="font-mono"
          placeholder="npm test"
          aria-describedby={id('doneCommand-hint')}
          onChange={(event) =>
            set({ doneCommand: event.target.value.trim() === '' ? null : event.target.value })
          }
        />
        <p id={id('doneCommand-hint')} className="text-xs text-muted-foreground">
          Exit 0 means the goal is met. Empty: the agent finishing on its own counts as done.
        </p>
      </FormField>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={id('handoffAtPct')}>Hand off at</Label>
          <span className="flex items-baseline gap-2 text-xs text-muted-foreground">
            {inBand ? 'recommended' : 'outside the recommended band'}
            <span className="font-mono text-sm text-foreground tabular-nums">
              {station.handoffAtPct}%
            </span>
          </span>
        </div>
        <div className="relative py-1">
          {/* The recommended band sits under the track, so the thumb stays on top. */}
          <span
            aria-hidden="true"
            className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm bg-status-passed-soft ring-1 ring-status-passed/30"
            style={{
              left: `${handoffTrackPct(bandFrom)}%`,
              width: `${handoffTrackPct(bandTo) - handoffTrackPct(bandFrom)}%`,
            }}
          />
          <Slider
            id={id('handoffAtPct')}
            aria-label="Hand off at, percent of the context window"
            min={SHIFT_HANDOFF_MIN}
            max={SHIFT_HANDOFF_MAX}
            step={1}
            value={[station.handoffAtPct]}
            onValueChange={([value]) =>
              value === undefined ? null : set({ handoffAtPct: value })
            }
          />
        </div>
        <div className="relative h-4 font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
          <span className="absolute left-0">{SHIFT_HANDOFF_MIN}%</span>
          <span
            className="absolute -translate-x-1/2 text-status-passed"
            style={{ left: `${(handoffTrackPct(bandFrom) + handoffTrackPct(bandTo)) / 2}%` }}
          >
            {bandFrom}–{bandTo}% recommended
          </span>
          <span className="absolute right-0">{SHIFT_HANDOFF_MAX}%</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Percent of the context window. Lower hands off earlier, while the agent is still
          sharp.
        </p>
      </div>
      <FormField
        id={id('maxShifts')}
        label="Max shifts"
        errors={errorsFor(issues, 'maxShifts')}
      >
        <Input
          id={id('maxShifts')}
          type="number"
          inputMode="numeric"
          min={1}
          max={30}
          step={1}
          className="tabular w-28"
          value={Number.isNaN(station.maxShifts) ? '' : station.maxShifts}
          onChange={(event) => set({ maxShifts: event.target.valueAsNumber })}
        />
      </FormField>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id('reviewHandoff')} className="flex flex-col items-start gap-0.5">
          Review each handoff
          <span className="text-xs font-normal text-muted-foreground">
            Pause before every new shift so you can edit the handoff.
          </span>
        </Label>
        <Switch
          id={id('reviewHandoff')}
          checked={station.reviewHandoff}
          onCheckedChange={(reviewHandoff) => set({ reviewHandoff })}
        />
      </div>
      <SessionFields
        station={station}
        issues={issues}
        set={set}
        nameField={nameField}
        budgetLabel="Max budget for the station (USD)"
      />
      <PromptField station={station} issues={issues} set={set} />
    </div>
  )
}

/** Shown on QA nodes and in the QA editor when the project can't be previewed. */
export function PreviewMissingNotice({ onSetupPreview }: { onSetupPreview?: () => void }) {
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-md border border-status-failed/30 bg-status-failed-soft px-3 py-2 text-[0.8125rem]"
    >
      <TriangleAlert
        aria-hidden="true"
        className="mt-0.5 size-3.5 shrink-0 text-status-failed"
      />
      <p className="min-w-0 flex-1">
        <span className="font-medium text-status-failed">No preview set up.</span>{' '}
        <span className="text-muted-foreground">
          QA needs to know how to run the app; until then this station fails fast.
        </span>
      </p>
      {onSetupPreview === undefined ? null : (
        <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={onSetupPreview}>
          Set up preview
        </Button>
      )}
    </div>
  )
}

const VIEWPORT_LABEL = { desktop: 'Desktop', mobile: 'Mobile' } as const
const THEME_LABEL = { light: 'Light', dark: 'Dark' } as const
const MAX_ALWAYS_CHECK = 20

/** Toggle one value in a must-not-be-empty list, keeping the enum's order. */
function toggleIn<T extends string>(
  list: readonly T[],
  value: T,
  on: boolean,
  order: readonly T[],
): T[] {
  const next = on ? [...new Set([...list, value])] : list.filter((item) => item !== value)
  return order.filter((item) => next.includes(item))
}

function QaFields({
  station,
  issues,
  onChange,
  nameField,
  previewMissing,
  onSetupPreview,
}: {
  station: QaStation
  issues: Issues
  onChange: (station: Station) => void
  nameField: React.ReactNode
  previewMissing: boolean
  onSetupPreview?: () => void
}) {
  const id = (field: string) => `station-${station.key}-${field}`
  const set = (patch: Partial<QaStation>) => onChange({ ...station, ...patch })
  // Lines saved before the switch existed have no `planner` field: on by default.
  const plannerOn = (station.planner as boolean | undefined) !== false
  // Selected = inverted fill + check: unmistakable in both themes.
  const toggleClass =
    'text-xs data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:hover:bg-foreground/90 data-[state=on]:hover:text-background'

  function setCheck(index: number, patch: Partial<QaStation['alwaysCheck'][number]>) {
    set({
      alwaysCheck: station.alwaysCheck.map((check, i) =>
        i === index ? { ...check, ...patch } : check,
      ),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {previewMissing ? <PreviewMissingNotice onSetupPreview={onSetupPreview} /> : null}
      <p className="text-xs text-muted-foreground">
        Boots the app on the base branch and on this branch, screenshots both and diffs them. A
        Claude session judges every changed screen; a fail sends the work back to the builder
        with the screenshots.
      </p>
      {nameField}
      <div className="grid grid-cols-2 gap-3">
        <FormField id={id('model')} label="Model" errors={errorsFor(issues, 'model')}>
          <ModelSelect
            id={id('model')}
            value={station.model}
            onChange={(model) => (model === null ? null : set({ model }))}
          />
        </FormField>
        <FormField id={id('effort')} label="Effort" errors={errorsFor(issues, 'effort')}>
          <EffortSelect
            id={id('effort')}
            value={station.effort ?? null}
            defaultLabel="Default"
            onChange={(effort) => set({ effort: effort ?? undefined })}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Viewports</legend>
          <div className="flex flex-wrap gap-1.5">
            {qaViewportSchema.options.map((viewport) => {
              const pressed = station.viewports.includes(viewport)
              const { width, height } = QA_VIEWPORTS[viewport]
              return (
                <Toggle
                  key={viewport}
                  size="sm"
                  variant="outline"
                  className={toggleClass}
                  pressed={pressed}
                  // At least one viewport: switching off the last one is ignored.
                  onPressedChange={(on) =>
                    !on && station.viewports.length === 1
                      ? null
                      : set({
                          viewports: toggleIn(
                            station.viewports,
                            viewport,
                            on,
                            qaViewportSchema.options,
                          ),
                        })
                  }
                >
                  {pressed ? <Check aria-hidden="true" /> : null}
                  {VIEWPORT_LABEL[viewport]}
                  <span className="font-mono text-[0.6875rem] text-muted-foreground tabular-nums group-data-[state=on]/toggle:text-background/70">
                    {width}×{height}
                  </span>
                </Toggle>
              )
            })}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Themes</legend>
          <div className="flex flex-wrap gap-1.5">
            {qaThemeSchema.options.map((theme) => {
              const pressed = station.themes.includes(theme)
              return (
                <Toggle
                  key={theme}
                  size="sm"
                  variant="outline"
                  className={toggleClass}
                  pressed={pressed}
                  onPressedChange={(on) =>
                    !on && station.themes.length === 1
                      ? null
                      : set({
                          themes: toggleIn(station.themes, theme, on, qaThemeSchema.options),
                        })
                  }
                >
                  {pressed ? <Check aria-hidden="true" /> : null}
                  {THEME_LABEL[theme]}
                </Toggle>
              )
            })}
          </div>
        </fieldset>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Every screen is captured once per viewport × theme. Themes are applied with the
        preview&rsquo;s init script, or prefers-color-scheme without one.
      </p>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id('planner')} className="flex flex-col items-start gap-0.5">
          Plan screens from the diff
          <span className="text-xs font-normal text-muted-foreground">
            A short session picks the screens and states this change touches, using the route
            map.
          </span>
        </Label>
        <Switch
          id={id('planner')}
          checked={plannerOn}
          onCheckedChange={(planner) => set({ planner })}
        />
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">
          {plannerOn ? 'Pinned routes (optional)' : 'Pinned routes'}
        </legend>
        <p className="text-xs text-muted-foreground">
          {plannerOn
            ? 'QA picks the rest from the diff.'
            : 'Checked on every run, plus routes derived from changed files.'}
        </p>
        {station.alwaysCheck.length === 0 ? null : (
          <ul className="flex flex-col gap-2">
            {station.alwaysCheck.map((check, index) => {
              const parsed = qaAlwaysCheckSchema.safeParse(check)
              const rowIssues = parsed.success
                ? new Set<string>()
                : new Set(parsed.error.issues.map((issue) => String(issue.path[0])))
              return (
                <li
                  key={index}
                  className="flex flex-col gap-1.5 rounded-md border bg-card/50 p-2"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] gap-1.5">
                    <Input
                      aria-label={`Check ${index + 1} name`}
                      aria-invalid={rowIssues.has('name') ? true : undefined}
                      value={check.name}
                      placeholder="Settings page"
                      onChange={(event) => setCheck(index, { name: event.target.value })}
                    />
                    <Input
                      aria-label={`Check ${index + 1} path`}
                      aria-invalid={rowIssues.has('path') ? true : undefined}
                      value={check.path}
                      placeholder="/settings"
                      className="font-mono"
                      onChange={(event) => setCheck(index, { path: event.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-8"
                      aria-label={`Remove check ${index + 1}`}
                      onClick={() =>
                        set({ alwaysCheck: station.alwaysCheck.filter((_, i) => i !== index) })
                      }
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </div>
                  <Textarea
                    aria-label={`Check ${index + 1} steps (optional)`}
                    value={check.steps ?? ''}
                    rows={2}
                    placeholder="Steps, optional — e.g. open the user menu, click Log out"
                    className="min-h-12 text-xs"
                    // Empty steps drop the key, so the dirty check matches the saved line.
                    onChange={(event) =>
                      setCheck(index, { steps: event.target.value || undefined })
                    }
                  />
                  {rowIssues.size === 0 ? null : (
                    <p className="text-xs text-destructive">
                      {rowIssues.has('name') ? 'Give it a name. ' : ''}
                      {rowIssues.has('path') ? 'The path must start with “/”.' : ''}
                      {rowIssues.has('steps') ? 'Steps are capped at 2,000 characters.' : ''}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={station.alwaysCheck.length >= MAX_ALWAYS_CHECK}
          onClick={() =>
            set({ alwaysCheck: [...station.alwaysCheck, { name: '', path: '/' }] })
          }
        >
          <Plus aria-hidden="true" />
          Add route
        </Button>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          id={id('diffThresholdPct')}
          label="Diff threshold (%)"
          errors={errorsFor(issues, 'diffThresholdPct')}
        >
          <DecimalInput
            id={id('diffThresholdPct')}
            value={station.diffThresholdPct}
            onChange={(diffThresholdPct) => set({ diffThresholdPct })}
          />
          <p className="text-xs text-muted-foreground">
            Share of the screen&rsquo;s pixels that must change before it counts as changed.
            Captures are deterministic, so keep it low: one small text change is about 0.04% of
            a desktop page.
          </p>
        </FormField>
        <FormField
          id={id('maxBudgetUsd')}
          label="Max budget (USD)"
          errors={errorsFor(issues, 'maxBudgetUsd')}
        >
          <Input
            id={id('maxBudgetUsd')}
            type="number"
            inputMode="decimal"
            min={0.01}
            step={0.01}
            placeholder="No limit"
            className="tabular"
            value={station.maxBudgetUsd ?? ''}
            onChange={(event) => {
              const budget = parseBudget(event.target.value)
              if (budget === undefined) return
              set({ maxBudgetUsd: budget ?? undefined })
            }}
          />
        </FormField>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id('interactive')} className="flex flex-col items-start gap-0.5">
          Interactive
          <span className="text-xs font-normal text-muted-foreground">
            The judge may click through the work order&rsquo;s acceptance criteria in a browser.
          </span>
        </Label>
        <Switch
          id={id('interactive')}
          checked={station.interactive}
          onCheckedChange={(interactive) => set({ interactive })}
        />
      </div>
      <FormField id={id('prompt')} label="QA instructions" errors={errorsFor(issues, 'prompt')}>
        <Textarea
          id={id('prompt')}
          value={station.prompt}
          rows={8}
          className="min-h-40 font-mono text-xs leading-relaxed"
          onChange={(event) => set({ prompt: event.target.value })}
        />
      </FormField>
    </div>
  )
}

/**
 * Decimal field that always shows a dot ("0.01"), whatever the browser locale
 * (a number input renders "0,01" on comma locales). Accepts a typed comma too.
 * The draft text is local so "0." survives while typing.
 */
function DecimalInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: number
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(() => (Number.isNaN(value) ? '' : String(value)))
  // Follow outside changes (discard, reset) without clobbering an in-progress edit.
  const parsed = Number(draft.replace(',', '.'))
  const shown =
    draft.trim() !== '' && parsed === value
      ? draft
      : Number.isNaN(value)
        ? draft
        : String(value)
  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      className="tabular"
      value={shown}
      onChange={(event) => {
        const text = event.target.value.replace(',', '.')
        setDraft(text)
        const next = text.trim() === '' ? Number.NaN : Number(text)
        onChange(next)
      }}
    />
  )
}
