import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CircleX, Stethoscope } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { systemQueries } from '@/features/system/api/system-queries'
import { DOCTOR_ANCHOR } from '@/features/system/components/doctor-section'
import { notReadyMessage } from '@/features/system/utils/doctor'

/**
 * Home's first-run banner: shown only when a required check fails. Renders
 * nothing while loading or when ready (optional warnings live in Settings), so
 * the caller reserves its slot to avoid a layout jump.
 */
export function DoctorBanner() {
  const doctor = useQuery(systemQueries.doctor())
  const message = doctor.data === undefined ? null : notReadyMessage(doctor.data)
  if (message === null) return null
  return (
    <div className="flex w-full max-w-2xl items-center gap-3 rounded-md border border-status-failed/30 bg-status-failed-soft px-3 py-2 text-left">
      <CircleX aria-hidden="true" className="size-4 shrink-0 text-status-failed" />
      <p className="min-w-0 flex-1 text-[0.8125rem] text-foreground">{message}</p>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link to="/settings" hash={DOCTOR_ANCHOR} hashScrollIntoView={false}>
          <Stethoscope aria-hidden="true" />
          Open Doctor
        </Link>
      </Button>
    </div>
  )
}
