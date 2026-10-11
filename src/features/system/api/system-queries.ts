import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { apiClient } from '@/lib/api-client'
import {
  accountPlanUsageSchema,
  dispatcherStateSchema,
  doctorReportSchema,
  planUsageSchema,
  systemInfoSchema,
  type AccountPlanUsage,
  type DispatcherState,
  type DoctorReport,
  type PlanUsage,
  type SystemInfo,
} from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

async function getSystemInfo(): Promise<SystemInfo> {
  const data = await apiClient.get('/system')
  return systemInfoSchema.parse(data)
}

async function getPlanUsage(): Promise<PlanUsage> {
  const data = await apiClient.get('/system/usage')
  return planUsageSchema.parse(data)
}

async function getUsageByAccount(): Promise<AccountPlanUsage[]> {
  return z.array(accountPlanUsageSchema).parse(await apiClient.get('/system/usage/accounts'))
}

async function getDoctorReport(): Promise<DoctorReport> {
  const data = await apiClient.get('/system/doctor')
  return doctorReportSchema.parse(data)
}

async function getDispatcher(): Promise<DispatcherState> {
  const data = await apiClient.get('/dispatcher')
  return dispatcherStateSchema.parse(data)
}

export const systemQueries = {
  /** Queue/slot state. SSE invalidates on change; the poll catches clock-driven moves (night shift). */
  dispatcher: () =>
    queryOptions({
      queryKey: queryKeys.dispatcher(),
      queryFn: getDispatcher,
      staleTime: 10_000,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      retry: 1,
    }),
  /**
   * First-run checks. Slow (0.5–3s, up to ~25s with a cold Claude probe), so
   * cached a minute; while a required check fails, checked again every 10s.
   */
  doctor: () =>
    queryOptions({
      queryKey: queryKeys.systemDoctor(),
      queryFn: getDoctorReport,
      staleTime: 60_000,
      refetchInterval: (query) => (query.state.data?.ready === false ? 10_000 : false),
      refetchOnWindowFocus: true,
      retry: 1,
    }),
  info: () =>
    queryOptions({
      queryKey: queryKeys.system(),
      queryFn: getSystemInfo,
      staleTime: 5 * 60_000,
      retry: 1,
    }),
  /** Every Claude account's plan, for the meter's popover (spec 0016). Fetched when opened. */
  usageByAccount: () =>
    queryOptions({
      queryKey: [...queryKeys.systemUsage(), 'accounts'] as const,
      queryFn: getUsageByAccount,
      staleTime: 30_000,
      retry: 1,
    }),
  /**
   * claude.ai plan limits. The API caches for 60s, so polling faster is
   * pointless; after a failed probe (it caches those 5s) it tries again in 5s.
   */
  usage: () =>
    queryOptions({
      queryKey: queryKeys.systemUsage(),
      queryFn: getPlanUsage,
      staleTime: 30_000,
      refetchInterval: (query) => (query.state.data?.error ? 5_000 : 60_000),
      refetchOnWindowFocus: true,
      retry: 1,
    }),
}
