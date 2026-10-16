import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Markdown } from '@/components/markdown'

describe('Markdown', () => {
  it('renders a GitHub table with inline code in its cells', () => {
    render(
      <Markdown
        text={[
          'Colour pickers: four grids',
          '',
          '| Grid | Code |',
          '|---|---|',
          '| `PalettePicker` | `palette-picker.tsx:19` |',
        ].join('\n')}
      />,
    )
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Grid' })).toBeInTheDocument()
    expect(
      screen.getByRole('cell', { name: 'PalettePicker' }).querySelector('code'),
    ).not.toBeNull()
  })

  it('renders headings, lists and bold instead of their markers', () => {
    render(<Markdown text={'### Next\n\n1. **Build** the grid\n2. Ask about contrast'} />)
    expect(screen.getByRole('heading', { name: 'Next' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Build').tagName).toBe('STRONG')
    expect(screen.queryByText(/\*\*/)).toBeNull()
  })

  it('shows raw HTML as text and keeps links safe', () => {
    const { container } = render(
      <Markdown
        text={'<img src=x onerror=alert(1)> [x](javascript:alert(1)) https://example.com'}
      />,
    )
    expect(container.querySelector('img')).toBeNull()
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).not.toContain('javascript:alert(1)')
    expect(screen.getByRole('link', { name: 'https://example.com' })).toHaveAttribute(
      'target',
      '_blank',
    )
  })

  it('renders top-level headings larger in the reader', () => {
    render(<Markdown variant="reader" text={'# Plan\n\n## Steps\n\nBody'} />)
    expect(screen.getByRole('heading', { name: 'Plan' })).toHaveClass('text-lg')
    expect(screen.getByRole('heading', { name: 'Steps' })).toHaveClass('text-base')
  })
})
