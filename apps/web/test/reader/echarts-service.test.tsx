import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useEChart } from '@/features/reader/services/echarts'
import { whenThemedRendersIdle } from '@/features/theme'

/**
 * Blocker 2 regression: lib/print.ts's wait-before-printing mechanism only
 * works if every echarts chart actually reports itself as "in flight" while
 * its (re-)render is running. This pins that wiring directly against the
 * real `useEChart` hook, without echarts itself in the loop (a custom
 * `loader` stands in for `getECharts`), since every chart block's own test
 * file mocks `useEChart` out entirely.
 */
function TestChart({ loader }: { loader: () => Promise<{ init: () => { setOption: () => void } }> }) {
  useEChart(() => ({}), [], loader as never)
  return null
}

describe('useEChart / beginThemedRender wiring', () => {
  it('keeps whenThemedRendersIdle unresolved while the chart loader is in flight, then resolves once it settles', async () => {
    let resolveLoader!: (value: { init: () => { setOption: () => void } }) => void
    const loader = () => new Promise<{ init: () => { setOption: () => void } }>((resolve) => (resolveLoader = resolve))

    render(<TestChart loader={loader} />)

    let idle = false
    whenThemedRendersIdle().then(() => {
      idle = true
    })
    await Promise.resolve()
    expect(idle).toBe(false)

    await act(async () => {
      resolveLoader({ init: () => ({ setOption: () => {} }) })
      await Promise.resolve()
    })

    await expect(whenThemedRendersIdle()).resolves.toBeUndefined()
  })
})

function ReadyChart({ loader }: { loader: () => Promise<{ init: () => { setOption: () => void } }> }) {
  const { containerRef, ready } = useEChart(() => ({}), [], loader as never)
  return <div ref={containerRef} data-testid="chart" data-ready={String(ready)} />
}

describe('useEChart ready', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is false while echarts loads and true once the chart has drawn', async () => {
    // jsdom has no ResizeObserver; the hook observes its container once one exists.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
    let resolveLoader!: (value: { init: () => { setOption: () => void } }) => void
    const loader = () => new Promise<{ init: () => { setOption: () => void } }>((resolve) => (resolveLoader = resolve))

    const { getByTestId } = render(<ReadyChart loader={loader} />)
    expect(getByTestId('chart')).toHaveAttribute('data-ready', 'false')

    await act(async () => {
      resolveLoader({ init: () => ({ setOption: () => {}, dispose: () => {} }) })
      await Promise.resolve()
    })
    expect(getByTestId('chart')).toHaveAttribute('data-ready', 'true')
  })
})

function FailingChart({ loader }: { loader: () => Promise<{ init: () => { setOption: () => void } }> }) {
  const { containerRef, ready, failed } = useEChart(() => ({}), [], loader as never)
  return <div ref={containerRef} data-testid="chart" data-ready={String(ready)} data-failed={String(failed)} />
}

describe('useEChart failed', () => {
  afterEach(() => vi.unstubAllGlobals())
  const observer = class {
    observe() {}
    disconnect() {}
  }

  it('reports failed when echarts never arrives, so the card stops saying "loading chart"', async () => {
    vi.stubGlobal('ResizeObserver', observer)
    let rejectLoader!: (reason: Error) => void
    const loader = () => new Promise<{ init: () => { setOption: () => void } }>((_, reject) => (rejectLoader = reject))

    const { getByTestId } = render(<FailingChart loader={loader} />)
    expect(getByTestId('chart')).toHaveAttribute('data-failed', 'false')

    await act(async () => {
      rejectLoader(new Error('ChunkLoadError: /_next/static/chunks/echarts.js'))
      await Promise.resolve()
    })
    expect(getByTestId('chart')).toHaveAttribute('data-failed', 'true')
    expect(getByTestId('chart')).toHaveAttribute('data-ready', 'false')
  })

  it('reports failed when echarts rejects the option', async () => {
    vi.stubGlobal('ResizeObserver', observer)
    const loader = () =>
      Promise.resolve({
        init: () => ({
          setOption: () => {
            throw new Error('bad option')
          },
          dispose: () => {},
        }),
      })

    const { getByTestId } = render(<FailingChart loader={loader} />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(getByTestId('chart')).toHaveAttribute('data-failed', 'true')
  })
})
