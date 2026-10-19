import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { BackPill } from '@/features/reader/components/BackPill'

const target = { decisionId: 'D2', sectionId: 'missing' }

afterEach(() => {
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('BackPill', () => {
  it('rises above the real height of the toast on screen, not a fixed 42 px', async () => {
    let notify: () => void = () => {}
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          notify = cb
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    render(<BackPill target={target} onBack={() => {}} onDismiss={() => {}} />)
    const pill = screen.getByRole('button', { name: 'Back to D2' })
    expect(pill.className).toContain('var(--toast-h')

    const toast = document.createElement('div')
    toast.setAttribute('data-toast', '')
    toast.getBoundingClientRect = () => ({ height: 66 }) as DOMRect
    await act(async () => {
      document.body.append(toast)
      await Promise.resolve()
      notify()
    })
    expect(pill.style.getPropertyValue('--toast-h')).toBe('66px')
  })

  it('measures a toast the moment it mounts, before the resize observer reports', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    render(<BackPill target={target} onBack={() => {}} onDismiss={() => {}} />)
    const pill = screen.getByRole('button', { name: 'Back to D2' })

    const toast = document.createElement('div')
    toast.setAttribute('data-toast', '')
    toast.getBoundingClientRect = () => ({ height: 66 }) as DOMRect
    await act(async () => {
      document.body.append(toast)
      await Promise.resolve()
    })
    expect(pill.style.getPropertyValue('--toast-h')).toBe('66px')
  })
})
