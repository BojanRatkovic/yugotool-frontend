import { describe, expect, it } from 'vitest'

import { isTypingTarget } from '@/lib/shortcuts'

function inside(html: string, selector: string): HTMLElement {
  document.body.innerHTML = html
  const el = document.querySelector<HTMLElement>(selector)
  if (el === null) throw new Error(selector)
  return el
}

const sheet = (child: string) => `<div role="dialog" data-wo-sheet>${child}</div>`

describe('isTypingTarget', () => {
  it('blocks fields and overlays, including alert dialogs', () => {
    expect(isTypingTarget(inside('<input>', 'input'))).toBe(true)
    expect(
      isTypingTarget(inside('<div role="dialog"><button>x</button></div>', 'button')),
    ).toBe(true)
    expect(
      isTypingTarget(inside('<div role="alertdialog"><button>x</button></div>', 'button')),
    ).toBe(true)
    expect(isTypingTarget(inside('<main><button>x</button></main>', 'button'))).toBe(false)
  })

  it("lets shortcuts through the caller's own sheet, not fields inside it", () => {
    expect(isTypingTarget(inside(sheet('<button>x</button>'), 'button'), 'data-wo-sheet')).toBe(
      false,
    )
    expect(
      isTypingTarget(inside(sheet('<textarea></textarea>'), 'textarea'), 'data-wo-sheet'),
    ).toBe(true)
    expect(isTypingTarget(inside(sheet('<button>x</button>'), 'button'))).toBe(true)
  })
})
