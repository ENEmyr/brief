import { describe, it, expect } from 'vitest'
import { diagramDeclaration, escapeLabelGt, mermaidBoxHeight, parseErrorLine } from '@/features/reader/lib/mermaidSource'

describe('escapeLabelGt (bug-402)', () => {
  it('escapes the exact label "tokens > 0" in a decision node', () => {
    expect(escapeLabelGt('flowchart LR\n  A[request] --> B{tokens > 0}')).toBe(
      'flowchart LR\n  A[request] --> B{tokens #gt; 0}',
    )
  })

  it('escapes > in edge labels, quoted labels and labels with no spaces', () => {
    const code = [
      'graph TD',
      '  A -- tokens > 0 --> B',
      '  B -->|a > b| C',
      '  C["x > y"] --> D[n>0]',
    ].join('\n')
    expect(escapeLabelGt(code).split('\n').slice(1)).toEqual([
      '  A -- tokens #gt; 0 --> B',
      '  B -->|a #gt; b| C',
      '  C["x #gt; y"] --> D[n#gt;0]',
    ])
  })

  it('leaves arrows, the asymmetric node opener and <br> alone', () => {
    const code = 'flowchart LR\n  A --> B ==> C -.-> D <--> E\n  F>flag] --- G[one<br>two]'
    expect(escapeLabelGt(code)).toBe(code)
  })

  it('leaves other diagram types alone', () => {
    const code = 'sequenceDiagram\n  A->>B: tokens > 0'
    expect(escapeLabelGt(code)).toBe(code)
  })
})

describe('mermaid source helpers', () => {
  it('reads the declaration line after front matter and comments', () => {
    expect(diagramDeclaration('---\ntitle: x\n---\n%% note\nflowchart LR; A-->B')).toBe('flowchart LR')
  })

  it('reserves 200px for a left-to-right flowchart and 400px for anything else', () => {
    expect(mermaidBoxHeight('flowchart LR\n A-->B')).toBe(200)
    expect(mermaidBoxHeight('graph RL\n A-->B')).toBe(200)
    expect(mermaidBoxHeight('flowchart TD\n A-->B')).toBe(400)
    expect(mermaidBoxHeight('sequenceDiagram\n A->>B: hi')).toBe(400)
  })

  it('takes the error line from the parser hash, where the bad token starts', () => {
    // mermaid 11 reports "line 4" for an unclosed bracket on line 3 of 3 (it
    // appends a newline); the hash's loc.first_line is 3.
    const error = Object.assign(new Error('Parse error on line 4:\n...'), { hash: { loc: { first_line: 3 } } })
    expect(parseErrorLine(error, 'a\nb\nc')).toBe(3)
  })

  it('falls back to the message line, and drops a line outside the source', () => {
    expect(parseErrorLine(new Error('Parse error on line 2:'), 'a\nb\nc')).toBe(2)
    expect(parseErrorLine(new Error('Parse error on line 9:'), 'a\nb\nc')).toBeUndefined()
    expect(parseErrorLine(new Error('No diagram type detected'), 'a')).toBeUndefined()
  })
})
