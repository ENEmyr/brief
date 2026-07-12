import { describe, it, expect } from 'vitest'
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
