import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'

import { apiClient } from '@/lib/api-client'
import {
  settingsSchema,
  type notificationTestSchema,
  type Settings,
  type UpdateSettings,
} from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

export type NotificationChannel = z.infer<typeof notificationTestSchema>['channel']

async function getSettings(): Promise<Settings> {
  const data = await apiClient.get('/settings')
  return settingsSchema.parse(data)
}

async function patchSettings(body: UpdateSettings): Promise<Settings> {
  const data = await apiClient.patch('/settings', body)
  return settingsSchema.parse(data)
}

export const settingsQueries = {
  detail: () =>
    queryOptions({
      queryKey: queryKeys.settings(),
      queryFn: getSettings,
      retry: 1,
    }),
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: patchSettings,
    onSuccess: (settings, patch) => {
      queryClient.setQueryData(settingsQueries.detail().queryKey, settings)
      // Slots and the night-shift window drive the dispatcher card.
      const refresh = [queryClient.invalidateQueries({ queryKey: queryKeys.dispatcher() })]
      // The picker's list, the effective folder and the doctor's repos check follow it.
      if ('reposRoot' in patch) {
        refresh.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.repos() }),
          queryClient.invalidateQueries({ queryKey: queryKeys.system() }),
        )
      }
      return Promise.all(refresh)
    },
  })
}

/** Sends a test notification through one channel using the saved settings. */
export function useTestNotification() {
  return useMutation({
    mutationFn: (channel: NotificationChannel) =>
      apiClient.post('/settings/notifications/test', { channel }),
  })
}
