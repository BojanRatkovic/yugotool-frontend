/**
 * True when a keystroke belongs to a text field or an open overlay, not to app shortcuts.
 * `ownLayer` names an attribute (e.g. `data-wo-sheet`) marking the caller's own sheet,
 * which then doesn't count as an overlay.
 */
export function isTypingTarget(target: EventTarget | null, ownLayer?: string): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  const layer = target.closest(
    '[role="dialog"],[role="alertdialog"],[role="listbox"],[role="menu"]',
  )
  return layer !== null && (ownLayer === undefined || !layer.hasAttribute(ownLayer))
}

export const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform)
