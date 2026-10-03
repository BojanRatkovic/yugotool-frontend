/** Bridge the Electron preload (zastava-backend/apps/desktop) exposes; undefined in a browser. */
interface ZastavaDesktop {
  platform: string
  /** Native folder dialog; resolves to the chosen path, or null when cancelled. */
  pickFolder(current?: string): Promise<string | null>
}

interface Window {
  zastavaDesktop?: ZastavaDesktop
}
