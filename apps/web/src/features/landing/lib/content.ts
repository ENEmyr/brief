export const REPO_URL = 'https://github.com/ENEmyr/brief'
export const DOCS_URL = 'https://github.com/ENEmyr/brief/tree/main/docs'
export const SKILL_DOCS_URL = 'https://github.com/ENEmyr/brief/blob/main/skills/brief/BLOCKS.md'

export const INSTALL_COMMAND = 'npx skills add ENEmyr/brief'

export const EXAMPLE_ID = 'k2p9x4Qm7Zr1Ta'
export const EXAMPLE_LINK = `brief.algoryth.me/s/${EXAMPLE_ID}`

export const NAV_LINKS = [
  { label: 'How it works', href: '#how' },
  { label: 'Wire it up', href: '#usage' },
  { label: 'Preview', href: '#preview' },
  { label: 'Blocks', href: '#blocks' },
  { label: 'Docs', href: DOCS_URL },
]

export type Step = {
  label: string
  title: string
  body: string
}

export const STEPS: Step[] = [
  {
    label: '01 / agent',
    title: 'The agent posts a payload',
    body: 'One JSON body: a title, sections of blocks, and the questions it needs answered. The skill teaches the agent the schema, so the agent writes the payload instead of hand-rolling an HTML report.',
  },
  {
    label: '02 / you',
    title: 'You read the link and answer',
    body: 'The reply is a link. Open it on any device to read the sections, expand a diagram, highlight a line and leave a note, and pick an answer on each decision card.',
  },
  {
    label: '03 / agent',
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
 * skill cannot drift apart in meaning.
 */
export const BLOCK_GROUPS: BlockGroup[] = [
  {
    name: 'Text and callouts',
    blocks: ['p', 'list', 'note', 'warn', 'good', 'image'],
    note: 'Prose with inline code, links, the three callout tones, and images.',
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
    name: 'Agent work',
    blocks: ['walkthrough', 'diff', 'trajectory'],
    note: 'Code beside its flowchart, a diff with a note per change, and the agent run as a log you can filter.',
  },
  {
    name: 'Decisions',
    blocks: ['decision'],
    note: 'Yes/no and multiple-choice questions the reader answers in place.',
  },
]

export const SKILL_SNIPPET = `# Install once, in the project your agent works in.
npx skills add ENEmyr/brief

# The agent now knows the payload schema and validates
# its own document offline before it posts anything.
# You ask for the work; it hands back a link:
#
#   "Reviewed the migration. Two calls need you:
#    https://brief.algoryth.me/s/${EXAMPLE_ID}"

# Pull the schema again when new block types ship.
npx skills update brief`

export const CURL_SNIPPET = `curl -X POST https://brief-api.algoryth.me/api/session \\
  -H 'content-type: application/json' \\
  -d @payload.json

# The response carries the link to send the human.
# { "id": "${EXAMPLE_ID}", "url": "https://brief.algoryth.me/s/${EXAMPLE_ID}" }

# Later, read the same document back as markdown
# instead of regenerating it.
curl https://brief-api.algoryth.me/api/session/${EXAMPLE_ID}/raw`

export const USAGE_TABS = [
  {
    id: 'skill',
    label: 'With the skill',
    hint: 'npx skills add',
    code: SKILL_SNIPPET,
    blurb:
      'The skill teaches the agent the schema, ships an offline validator, and travels with the repository. This is the path most agents want.',
  },
  {
    id: 'http',
    label: 'Straight HTTP',
    hint: 'POST /api/session',
    code: CURL_SNIPPET,
    blurb:
      'No skill, no SDK, no auth. Any agent that can make an HTTP request can publish a document and read it back.',
  },
] as const

export const PREVIEW_CALLOUTS = [
  { term: 'Outline', text: 'marks where your notes and open questions are.' },
  { term: 'Terms', text: 'explain themselves on hover or tap.' },
  { term: 'Diagrams', text: 'play step by step, zoom with buttons.' },
  { term: 'Decisions', text: 'link to their section, take an Other answer and a reason.' },
  { term: '⌘K', text: 'jumps to any section, block or decision.' },
]

export const SMALL_THINGS = [
  { tag: 'keyboard', text: 'Number keys pick options, J and K move between sections, ⌘K finds anything.' },
  { tag: 'phone', text: 'Decisions open as a bottom sheet. Every target is at least 44px.' },
  { tag: 'protected', text: 'Archive with a password. The doc is encrypted on your device before it is stored.' },
  { tag: '/raw', text: 'Every brief reads back as markdown, so the agent never rewrites what it already wrote.' },
  { tag: 'print', text: 'PDF export prints light, with your answers summarized at the end.' },
  { tag: 'light and dark', text: 'Follows the system setting until you pick one.' },
]
