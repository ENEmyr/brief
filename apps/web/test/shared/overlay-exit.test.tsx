import { act, render, screen } from '@testing-library/react'
import { OverlayExit } from '@/shared/OverlayExit'
import { endAnimation } from './endAnimation'

function Panel({ label }: { label: string }) {
  return <div role="dialog" aria-label={label} />
}

const view = (open: boolean, label = 'one') => (
  <OverlayExit open={open}>{open && <Panel label={label} />}</OverlayExit>
)

describe('OverlayExit', () => {
  afterEach(() => vi.useRealTimers())

  it('keeps the closed overlay mounted and inert until its exit animation ends', () => {
    const { rerender, container } = render(view(true))
    expect(container.querySelector('[data-overlay-exit]')).toBeNull()

    rerender(view(false))
    const panel = screen.getByRole('dialog', { name: 'one' })
    const wrapper = container.querySelector('[data-overlay-exit]')
    expect(wrapper).not.toBeNull()
    expect(wrapper).toHaveAttribute('inert')

    endAnimation(panel)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('ignores an animationend that is not the exit', () => {
    const { rerender } = render(view(true))
    rerender(view(false))
    endAnimation(screen.getByRole('dialog'), 'console-in')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('unmounts on a timer when animationend never fires', () => {
    vi.useFakeTimers()
    const { rerender } = render(view(true))
    rerender(view(false))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    act(() => vi.runAllTimers())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows a fresh, interactive overlay when it reopens during the exit', () => {
    const { rerender, container } = render(view(true, 'one'))
    rerender(view(false, 'one'))
    rerender(view(true, 'two'))
    expect(screen.getByRole('dialog', { name: 'two' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'one' })).toBeNull()
    expect(container.querySelector('[inert]')).toBeNull()
  })
})
