import { useEffect } from 'react'

/**
 * Shift + wheel scrolls a board sideways on every platform (macOS converts
 * it natively; a plain mouse wheel on Windows/Linux reports deltaY only).
 */
export function useShiftWheel(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const board = ref.current
    if (board === null) return undefined
    function onWheel(event: WheelEvent) {
      if (!event.shiftKey || event.deltaX !== 0 || event.deltaY === 0 || board === null) return
      event.preventDefault()
      board.scrollLeft += event.deltaY
    }
    board.addEventListener('wheel', onWheel, { passive: false })
    return () => board.removeEventListener('wheel', onWheel)
  })
}
