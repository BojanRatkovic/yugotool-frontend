import { describe, expect, it } from 'vitest'

import { isPanelTypingTarget } from '@/features/pull-requests/utils/keys'

function inside(html: string, selector: string): HTMLElement {
  document.body.innerHTML = html
  const el = document.querySelector<HTMLElement>(selector)
  if (el === null) throw new Error(selector)
  return el
}

describe('isPanelTypingTarget', () => {
  it('lets shortcuts through inside the PR sheet', () => {
    expect(
      isPanelTypingTarget(
        inside('<div role="dialog" data-pr-sheet><button>x</button></div>', 'button'),
      ),
    ).toBe(false)
  })

  it('blocks fields, and dialogs or menus on top of the sheet', () => {
    expect(
      isPanelTypingTarget(
        inside('<div role="dialog" data-pr-sheet><textarea></textarea></div>', 'textarea'),
      ),
    ).toBe(true)
    expect(
      isPanelTypingTarget(inside('<div role="dialog"><button>x</button></div>', 'button')),
    ).toBe(true)
    expect(isPanelTypingTarget(inside('<div role="menu"><div>x</div></div>', 'div div'))).toBe(
      true,
    )
  })
})
