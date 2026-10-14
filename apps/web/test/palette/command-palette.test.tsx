import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { CommandPalette } from '@/features/palette'
import type { PaletteEntry } from '@/features/palette'

const entries: PaletteEntry[] = [
  { kind: 'decision', key: 'd:D2', decisionId: 'D2', label: 'ค่า default limit ต่อผู้ใช้', keywords: 'D2 100 per minute' },
  { kind: 'section', key: 's:why', sectionId: 'why', sectionNo: 2, label: 'Why we need limits' },
  { kind: 'block', key: 'b:0:0:0', tag: 'code', label: 'env.LIMITER.limit({ key })', sectionId: 'why', sectionNo: 2 },
  { kind: 'action', key: 'a:copy', label: 'Copy prompt with answers', run: () => {} },
]

// jsdom has no layout, so it does not implement scrollIntoView.
const scrollIntoView = vi.fn()
beforeAll(() => {
  Element.prototype.scrollIntoView = scrollIntoView
})
afterAll(() => {
  delete (Element.prototype as Partial<Element>).scrollIntoView
})

interface ShellProps {
  onSelect?: (entry: PaletteEntry) => void
  onClose?: () => void
}

/** Mounts the palette the way the shell will: from a trigger, unmounted by onClose. */
function Shell({ onSelect = vi.fn(), onClose = vi.fn() }: ShellProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.currentTarget.focus()
          setOpen(true)
        }}
      >
        Search
      </button>
      {open && (
        <CommandPalette
          entries={entries}
          onSelect={onSelect}
          onClose={() => {
            onClose()
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

function openPalette(props: ShellProps = {}) {
  const view = render(<Shell {...props} />)
  const trigger = screen.getByRole('button', { name: 'Search' })
  fireEvent.click(trigger)
  return { ...view, trigger, input: screen.getByRole('combobox', { name: 'Search the brief' }) }
}

const optionTexts = () => screen.queryAllByRole('option').map((option) => option.textContent)
const selectedText = () => screen.getByRole('option', { selected: true }).textContent

describe('CommandPalette', () => {
  it('opens as a modal dialog with the search input focused and the first row active', () => {
    const { input } = openPalette()

    expect(screen.getByRole('dialog', { name: 'Command palette' })).toHaveAttribute('aria-modal', 'true')
    expect(input).toHaveFocus()
    expect(optionTexts()).toEqual(['D2ค่า default limit ต่อผู้ใช้↵', '02Why we need limits', 'Copy prompt with answers'])
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('id', input.getAttribute('aria-activedescendant'))
  })

  it('labels each group with its board title', () => {
    openPalette()

    expect(screen.getByRole('group', { name: 'DECISIONS' })).toHaveTextContent('ค่า default limit ต่อผู้ใช้')
    expect(screen.getByRole('group', { name: 'SECTIONS' })).toHaveTextContent('Why we need limits')
    expect(screen.getByRole('group', { name: 'ACTIONS' })).toHaveTextContent('Copy prompt with answers')
    expect(screen.queryByRole('group', { name: 'BLOCKS' })).not.toBeInTheDocument()
  })

  it('filters as the query changes and shows blocks with their section chip', () => {
    const { input } = openPalette()

    fireEvent.change(input, { target: { value: 'limit' } })

    expect(optionTexts()).toEqual([
      'D2ค่า default limit ต่อผู้ใช้↵',
      'codeenv.LIMITER.limit({ key })§02',
      '02Why we need limits',
    ])
    expect(screen.getByRole('group', { name: 'BLOCKS' })).toHaveTextContent('env.LIMITER.limit({ key })')
  })

  it('moves the active row with ArrowDown and ArrowUp, clamped at both ends, and keeps it in view', () => {
    const { input } = openPalette()

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(selectedText()).toBe('02Why we need limits↵')
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest' })
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(screen.getByRole('option', { selected: true }))

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(selectedText()).toBe('Copy prompt with answers↵')

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(selectedText()).toBe('D2ค่า default limit ต่อผู้ใช้↵')
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { selected: true }).id)
  })

  it('resets the active row to the first one when the query changes', () => {
    const { input } = openPalette()
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    fireEvent.change(input, { target: { value: 'w' } })

    expect(selectedText()).toBe('02Why we need limits↵')
  })

  it('keeps a valid active row when the shell passes fewer entries', () => {
    const onSelect = vi.fn()
    const { rerender } = render(<CommandPalette entries={entries} onSelect={onSelect} onClose={() => {}} />)
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    rerender(<CommandPalette entries={entries.slice(0, 2)} onSelect={onSelect} onClose={() => {}} />)

    expect(selectedText()).toBe('02Why we need limits↵')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith(entries[1])
  })

  it('Enter closes the palette, then selects the active entry', () => {
    const calls: string[] = []
    const { input } = openPalette({
      onClose: () => calls.push('close'),
      onSelect: (entry: PaletteEntry) => calls.push(`select ${entry.key}`),
    })
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    fireEvent.keyDown(input, { key: 'Enter' })

    expect(calls).toEqual(['close', 'select s:why'])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('hovering a row makes it active and clicking it selects it', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    openPalette({ onSelect, onClose })
    const copy = screen.getByRole('option', { name: /Copy prompt with answers/ })

    fireEvent.mouseMove(copy)
    expect(copy).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(copy)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(entries[3])
  })

  it('keeps focus in the input when a row is pressed', () => {
    const { input } = openPalette()

    const pressed = fireEvent.mouseDown(screen.getByRole('option', { name: /Why we need limits/ }))

    expect(pressed).toBe(false)
    expect(input).toHaveFocus()
  })

  it('Escape closes the palette and returns focus to the trigger', () => {
    const onClose = vi.fn()
    const { input, trigger } = openPalette({ onClose })

    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes on an overlay click but not on a click inside the panel', () => {
    const onClose = vi.fn()
    openPalette({ onClose })
    const panel = screen.getByRole('dialog')

    fireEvent.click(panel)
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(panel.parentElement!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not bounce focus to the trigger when the shell re-renders with a new onClose', () => {
    const { input, trigger, rerender } = openPalette()
    const focusTrigger = vi.fn()
    trigger.addEventListener('focus', focusTrigger)

    rerender(<Shell onClose={() => {}} />)

    expect(focusTrigger).not.toHaveBeenCalled()
    expect(input).toHaveFocus()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(focusTrigger).toHaveBeenCalledTimes(1)
  })

  it('shows the B-States empty state, with the raw query, when nothing matches', () => {
    const { input } = openPalette()

    fireEvent.change(input, { target: { value: 'quota' } })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'No match for "quota". Try a section title, a decision id like D2, or a term.',
    )
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).not.toHaveAttribute('aria-activedescendant')
  })
})
