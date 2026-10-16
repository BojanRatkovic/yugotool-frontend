import { useForm, useStore } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { useSaveLine } from '@/features/projects/api/line-queries'
import {
  insertAfter,
  lineIssues,
  newStation,
  sameStations,
  type StationKind,
} from '@/features/projects/utils/line-draft'
import { errorMessage } from '@/lib/api-client'
import type { Line, LineKind, Station } from '@/lib/contracts'
import { skillQueries } from '@/lib/skill-queries'

/**
 * A draft of the line (a TanStack Form value), its issues, the selected
 * station and Save. Mount the caller with `key={line.updatedAt}` so a saved
 * or refetched line resets the draft.
 */
export function useLineDraft(
  line: Line,
  kind: LineKind,
  { initialKey = null, onSaved }: { initialKey?: string | null; onSaved?: () => void } = {},
) {
  const [selectedKey, setSelectedKey] = useState<string | null>(initialKey)
  const save = useSaveLine(line.projectId, kind)
  const skills = useQuery(skillQueries.list(line.projectId)).data

  const form = useForm({
    defaultValues: { stations: line.stations },
    onSubmit: ({ value }) => {
      // A saved line remounts the caller (keyed by updatedAt), which drops mutate()'s
      // callbacks: report through the promise, which outlives the remount.
      save.mutateAsync({ stations: value.stations }).then(
        () => {
          toast.success('Line saved.')
          onSaved?.()
          return undefined
        },
        (error: unknown) => toast.error(`Couldn't save the line: ${errorMessage(error)}`),
      )
    },
  })

  const stations = useStore(form.store, (state) => state.values.stations)
  const isDirty = useMemo(
    () => !sameStations(stations, line.stations),
    [stations, line.stations],
  )
  const issues = useMemo(() => lineIssues(stations, kind), [stations, kind])
  const valid = issues.general.length === 0 && issues.byStation.size === 0

  const setStations = (next: Station[]) => form.setFieldValue('stations', next)

  function add(stationKind: StationKind) {
    const station = newStation(stationKind, stations)
    setStations(insertAfter(stations, selectedKey, station))
    setSelectedKey(station.key)
  }

  return {
    form,
    save,
    skills,
    stations,
    setStations,
    selectedKey,
    setSelectedKey,
    add,
    isDirty,
    issues,
    canSave: isDirty && valid,
  }
}
