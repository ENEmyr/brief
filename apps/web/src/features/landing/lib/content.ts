export const REPO_URL = 'https://github.com/ENEmyr/brief'
export const DOCS_URL = 'https://github.com/ENEmyr/brief/tree/main/docs'
export const SKILL_DOCS_URL = 'https://github.com/ENEmyr/brief/blob/main/skills/brief/BLOCKS.md'
export const READER_URL = 'https://brief.algoryth.me'
export const API_BASE_URL = 'https://brief-api.algoryth.me'

export const INSTALL_COMMAND = 'npx skills add ENEmyr/brief'
export const UPDATE_COMMAND = 'npx skills update brief'

export type Step = {
  no: string
  title: string
  body: string
}

export const STEPS: Step[] = [
  {
    no: '1',
    title: 'The agent posts a payload',
    body: 'One JSON body: a title, sections of blocks, and the questions it needs answered. The skill teaches the agent the schema, so the agent writes the payload instead of hand-rolling an HTML report.',
  },
  {
    no: '2',
    title: 'You read the link and answer',
    body: 'The reply is a link. Open it on any device to read the sections, expand a diagram, highlight a line and leave a note, and pick an answer on each decision card.',
  },
  {
    no: '3',
    title: 'The agent reads you back',
    body: 'Your answers and annotations come back as a ready-to-paste prompt, and the whole document stays readable as markdown at /raw, so the agent never regenerates what it already wrote.',
  },
]

export type BlockGroup = {
  name: string
  blocks: string[]
  note: string
}

/**
 * Grouped exactly as skills/brief/BLOCKS.md groups them, so the page and the
 * skill cannot drift apart in meaning. A test asserts every block type in
 * payloadSchema appears here, which is what fails when a new block ships
 * without the landing page catching up.
 */
export const BLOCK_GROUPS: BlockGroup[] = [
  {
    name: 'Text and callouts',
    blocks: ['p', 'note', 'warn', 'good'],
    note: 'Prose with inline code, links, and the three callout tones.',
  },
  {
    name: 'Data',
    blocks: ['table', 'compare', 'stat', 'coverage', 'details'],
    note: 'Tables, side-by-side comparisons, stat rows, coverage bars, and collapsible detail.',
  },
  {
    name: 'Diagrams',
    blocks: ['seq', 'state', 'layers', 'erd', 'mermaid'],
    note: 'Sequence, state, layered architecture, and ERDs, each zoomable and pannable.',
  },
  {
    name: 'Code and math',
    blocks: ['ba', 'code', 'math'],
    note: 'Syntax-highlighted code, before-and-after diffs, and KaTeX math.',
  },
  {
    name: 'Charts',
    blocks: ['bigo', 'heatmap', 'histogram', 'scatter', 'plot3d'],
    note: 'Complexity curves, heatmaps, histograms, scatter plots, and 3D surfaces.',
  },
  {
    name: 'Decisions',
    blocks: ['decision'],
    note: 'Yes/no and multiple-choice questions the reader answers in place.',
  },
]

export const PAYLOAD_SNIPPET = `{
  "payload": {
    "meta": { "title": "Rate limiting" },
    "sections": [{
      "id": "traffic",
      "no": 1,
      "title": "Traffic",
      "blocks": [
        { "type": "p", "text": "Sessions doubled." },
        { "type": "note", "text": "KV counts lag." }
      ]
    }],
    "decisions": [{
      "id": "limiter",
      "q": "Which rate limiter?",
      "multi": false,
      "opts": [
        { "id": "binding", "label": "Rate limiting binding" },
        { "id": "kv", "label": "Custom KV counter" }
      ]
    }]
  }
}`

export const RESPONSE_SNIPPET = `{ "id": "k2p9x4", "url": "https://brief.algoryth.me/s/k2p9x4" }`

export const SKILL_SNIPPET = `# Install once, in the project your agent works in.
npx skills add ENEmyr/brief

# The agent now knows the payload schema and validates
# its own document offline before it posts anything.
# You ask for the work; it hands back a link:
#
#   "Reviewed the migration. Two calls need you:
#    https://brief.algoryth.me/s/k2p9x4"

# Pull the schema again when new block types ship.
npx skills update brief`

export const CURL_SNIPPET = `curl -X POST https://brief-api.algoryth.me/api/session \\
  -H 'content-type: application/json' \\
  -d @payload.json

# The response carries the link to send the human.
# { "id": "k2p9x4", "url": "https://brief.algoryth.me/s/k2p9x4" }

# Later, read the same document back as markdown
# instead of regenerating it.
curl https://brief-api.algoryth.me/api/session/k2p9x4/raw`
