/**
 * Whether a keydown belongs to a field (or to a dialog/menu on top of the
 * panel) rather than to the PR panel's shortcuts. Like `isTypingTarget`, except
 * that the PR panel's own sheet (`data-pr-sheet`) doesn't count as a dialog.
 */
export function isPanelTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  ) {
    return true
  }
  const layer = target.closest(
    '[role="dialog"],[role="alertdialog"],[role="listbox"],[role="menu"]',
  )
  return layer !== null && !layer.hasAttribute('data-pr-sheet')
}
