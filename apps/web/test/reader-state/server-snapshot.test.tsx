import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ReaderStateProvider, useReaderState } from '@/features/reader-state'

function Fields() {
  const state = useReaderState()
  return <span>{Object.keys(state).sort().join(',')}</span>
}

describe('ReaderStateProvider server render', () => {
  it('renders every reader-state field, Other answers included', () => {
    const html = renderToString(
      <ReaderStateProvider sessionId="sess-ssr">
        <Fields />
      </ReaderStateProvider>,
    )
    expect(html).toContain('dnote,dother,dsel,highlights')
  })
})
