import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ReactElement } from 'react'
import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { modKeyLabel, useShortcuts } from '@/features/shortcuts'

afterEach(() => {
  vi.restoreAllMocks()
})

function bindAll() {
  const handlers = { palette: vi.fn(), nextSection: vi.fn(), prevSection: vi.fn(), help: vi.fn() }
  const hook = renderHook(() => useShortcuts(handlers))
  return { ...handlers, unmount: hook.unmount }
}

/** Presses a key where focus is; true when a shortcut took it (preventDefault). */
function press(init: KeyboardEventInit) {
  return !fireEvent.keyDown(document.activeElement ?? document.body, init)
}

describe('useShortcuts', () => {
  it('J and K move to the next and previous section, with or without Shift', () => {
    const { nextSection, prevSection } = bindAll()

    expect(press({ key: 'j' })).toBe(true)
    expect(press({ key: 'K', shiftKey: true })).toBe(true)

    expect(nextSection).toHaveBeenCalledTimes(1)
    expect(prevSection).toHaveBeenCalledTimes(1)
  })

  it.each<[string, ReactElement, number]>([
    ['a text input', <input aria-label="target" />, 0],
    ['a search input', <input aria-label="target" type="search" />, 0],
    ['a textarea', <textarea aria-label="target" />, 0],
    ['a select', <select aria-label="target"><option>a</option></select>, 0],
    ['a button inside [data-popover]', <div data-popover=""><button aria-label="target" /></div>, 0],
    ['a button inside [role="dialog"]', <div role="dialog"><button aria-label="target" /></div>, 0],
    ['a button inside [role="menu"]', <div role="menu"><button aria-label="target" /></div>, 0],
    ['a button inside [role="listbox"]', <div role="listbox"><button aria-label="target" /></div>, 0],
    ['a checkbox', <input aria-label="target" type="checkbox" />, 1],
    ['a plain button', <button aria-label="target" />, 1],
  ])('J with focus on %s fires %i times', (_where, ui, expected) => {
    const { nextSection } = bindAll()
    render(ui)
    screen.getByLabelText('target').focus()

    expect(press({ key: 'j' })).toBe(expected === 1)
    expect(nextSection).toHaveBeenCalledTimes(expected)
  })

  it('J does not fire inside a contenteditable element', () => {
    const { nextSection } = bindAll()
    render(<div aria-label="target" contentEditable suppressContentEditableWarning tabIndex={0} />)
    const editable = screen.getByLabelText('target')
    // jsdom does not implement isContentEditable; a browser reports true here.
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    editable.focus()

    expect(press({ key: 'j' })).toBe(false)
    expect(nextSection).not.toHaveBeenCalled()
  })

  it('J does not fire while the selection toolbar is shown', () => {
    const { nextSection } = bindAll()
    const toolbar = render(<div data-seltoolbar="" />)

    press({ key: 'j' })
    expect(nextSection).not.toHaveBeenCalled()

    toolbar.unmount()
    press({ key: 'j' })
    expect(nextSection).toHaveBeenCalledTimes(1)
  })

  it('J does not fire with Ctrl, Meta or Alt held, while composing, or after something else handled the key', () => {
    const { nextSection } = bindAll()
    render(<div aria-label="target" tabIndex={0} onKeyDown={(event) => event.preventDefault()} />)

    press({ key: 'j', ctrlKey: true })
    press({ key: 'j', metaKey: true })
    press({ key: 'j', altKey: true })
    press({ key: 'j', isComposing: true })
    screen.getByLabelText('target').focus()
    press({ key: 'j' })
    expect(nextSection).not.toHaveBeenCalled()

    screen.getByLabelText('target').blur()
    press({ key: 'j' })
    expect(nextSection).toHaveBeenCalledTimes(1)
  })

  it('Ctrl K and Meta K open the palette, even from a text input', () => {
    const { palette, prevSection } = bindAll()
    render(<input aria-label="target" />)
    screen.getByLabelText('target').focus()

    expect(press({ key: 'k', ctrlKey: true })).toBe(true)
    expect(press({ key: 'K', metaKey: true, shiftKey: true })).toBe(true)

    expect(palette).toHaveBeenCalledTimes(2)
    expect(prevSection).not.toHaveBeenCalled()
  })

  it('Ctrl K does nothing while a modal dialog is open', () => {
    const { palette } = bindAll()
    const modal = render(<div aria-modal="true" />)

    expect(press({ key: 'k', ctrlKey: true })).toBe(false)
    expect(palette).not.toHaveBeenCalled()

    modal.unmount()
    expect(press({ key: 'k', ctrlKey: true })).toBe(true)
    expect(palette).toHaveBeenCalledTimes(1)
  })

  it('? shows the shortcut sheet', () => {
    const { help } = bindAll()

    expect(press({ key: '?', shiftKey: true })).toBe(true)
    expect(help).toHaveBeenCalledTimes(1)
  })

  it('falls back to the physical key on a Thai layout', () => {
    const { nextSection, palette } = bindAll()

    press({ key: '่', code: 'KeyJ' })
    press({ key: 'า', code: 'KeyK', ctrlKey: true })

    expect(nextSection).toHaveBeenCalledTimes(1)
    expect(palette).toHaveBeenCalledTimes(1)
  })

  it('leaves a key alone when its handler is missing', () => {
    const nextSection = vi.fn()
    renderHook(() => useShortcuts({ nextSection }))

    expect(press({ key: '?', shiftKey: true })).toBe(false)
    expect(press({ key: 'k', ctrlKey: true })).toBe(false)
    expect(press({ key: 'j' })).toBe(true)
    expect(nextSection).toHaveBeenCalledTimes(1)
  })

  it('calls the handler from the latest render, once', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ onNext }) => useShortcuts({ nextSection: onNext }), {
      initialProps: { onNext: first },
    })

    rerender({ onNext: second })
    press({ key: 'j' })

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('stops listening on unmount', () => {
    const { nextSection, unmount } = bindAll()

    unmount()

    expect(press({ key: 'j' })).toBe(false)
    expect(nextSection).not.toHaveBeenCalled()
  })

  it('ignores a keydown that carries no key, as Chrome autofill sends', () => {
    const { nextSection } = bindAll()
    const onError = vi.fn()
    window.addEventListener('error', onError)

    document.body.dispatchEvent(new Event('keydown', { bubbles: true }))

    window.removeEventListener('error', onError)
    expect(onError).not.toHaveBeenCalled()
    expect(nextSection).not.toHaveBeenCalled()
  })
})

describe('modKeyLabel', () => {
  it.each([
    ['MacIntel', '⌘'],
    ['iPhone', '⌘'],
    ['iPad', '⌘'],
    ['Win32', 'Ctrl'],
    ['Linux x86_64', 'Ctrl'],
  ])('on %s is %s', (platform, label) => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform)

    expect(modKeyLabel()).toBe(label)
  })
})
