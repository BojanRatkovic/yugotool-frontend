import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { del, get, set } from 'idb-keyval'

/** Query cache → IndexedDB, so TanStack DB collections hydrate offline on boot. */
export const persister = createAsyncStoragePersister({
  key: 'zastava-query-cache',
  storage: {
    getItem: async (key) => (await get<string>(key)) ?? null,
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
})
