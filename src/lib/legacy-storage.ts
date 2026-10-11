/**
 * The app was called ZASTAVA until 2026-10-11: settings saved under `zastava…`
 * keys move to the `yugotool…` names once, so nobody loses them.
 */
export function moveLegacyStorage(storage: Storage = window.localStorage): void {
  try {
    for (const key of Object.keys(storage)) {
      if (!key.startsWith('zastava')) continue
      const renamed = `yugotool${key.slice('zastava'.length)}`
      const value = storage.getItem(key)
      if (value !== null && storage.getItem(renamed) === null) storage.setItem(renamed, value)
      storage.removeItem(key)
    }
  } catch {
    // Storage blocked: nothing to move.
  }
}
