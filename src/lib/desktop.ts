function isBridge(value: unknown): value is ZastavaDesktop {
  return (
    typeof value === 'object' &&
    value !== null &&
    'pickFolder' in value &&
    typeof value.pickFolder === 'function'
  )
}

/**
 * The desktop shell's bridge, or null in a browser (or when the preload
 * exposes something unexpected). Read it through this, never `window` directly.
 */
export function desktopBridge(
  target: { zastavaDesktop?: unknown } | undefined = typeof window === 'undefined'
    ? undefined
    : window,
): ZastavaDesktop | null {
  const bridge = target?.zastavaDesktop
  return isBridge(bridge) ? bridge : null
}

/**
 * Tells the desktop shell which theme the app resolved to, so the native
 * window chrome follows. No-op in a browser, for an older shell without
 * `setTheme`, or before next-themes has resolved a theme.
 */
export function syncDesktopTheme(
  resolvedTheme: string | undefined,
  bridge: ZastavaDesktop | null = desktopBridge(),
): void {
  if (resolvedTheme !== 'dark' && resolvedTheme !== 'light') return
  if (typeof bridge?.setTheme !== 'function') return
  bridge.setTheme(resolvedTheme)
}
