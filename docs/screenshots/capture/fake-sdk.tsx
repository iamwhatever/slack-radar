/**
 * Stub of `@kirocrew/app-sdk` for README screenshots. Every response is FAKE demo
 * data defined in this file: no request leaves the page, and nothing is read from
 * a gateway, a ledger or Slack. Scenario comes from the query string:
 *   ?source=ok | needs_login
 */
const SCENARIO = new URLSearchParams(location.search).get('source') === 'needs_login' ? 'needs_login' : 'ok'

const T0 = 1758700800 // 2025-09-24T08:00:00Z, fixed so frames are reproducible

const item = (
  n: number,
  channel: string,
  user: string,
  text: string,
  extra: Record<string, unknown> = {},
) => ({
  key: `${channel}:${T0 + n * 600}.000100`,
  channel,
  user,
  text,
  permalink: `https://example.slack.com/archives/${channel}/p${T0 + n * 600}000100`,
  status: 'triaged',
  category: '',
  priority: '',
  summary: '',
  links: [] as string[],
  note: '',
  reply_count: 0,
  needs_triage: false,
  possibly_resolved: null as null | { reason: string; at: number },
  ts_float: T0 + n * 600,
  ...extra,
})

const ITEMS = [
  item(9, 'C0DEMO1', 'alice', 'Export to CSV fails on large files (over ~50k rows)', {
    category: 'bug-report', priority: 'p1', summary: 'CSV export fails for files over ~50k rows',
    links: ['https://github.com/example-org/example-app/issues/412'], reply_count: 4,
    note: 'Two more reports in the thread; matches #412.',
  }),
  item(8, 'C0DEMO2', 'bob', 'Could we get dark mode in the reports view?', {
    category: 'feature-request', priority: 'p2', summary: 'Dark mode for the reports view', reply_count: 2,
  }),
  item(7, 'C0DEMO1', 'carol', 'How do I rotate the API key for the staging workspace?', {
    category: 'question', priority: 'p3', summary: 'How to rotate the staging API key', reply_count: 3,
    possibly_resolved: { reason: 'reply says “thanks”', at: T0 + 5000 },
  }),
  item(6, 'C0DEMO2', 'dave', 'Dashboard is blank after the latest update', {
    status: 'investigating', category: 'bug-report', priority: 'p1',
    summary: 'Dashboard renders blank after the latest update', reply_count: 6,
    note: 'Investigator searching example-org/example-app.',
  }),
  item(5, 'C0DEMO1', 'erin', 'Search results take 10s+ when filtering by tag', {
    status: 'new', needs_triage: true,
  }),
]

const STATE = {
  ok: true,
  vault_available: true,
  settings: {
    channels: ['C0DEMO1', 'C0DEMO2'],
    digest_destination: 'self_dm',
    slack_login: 'alice',
    slack_mcp_command: 'ai-community-slack-mcp',
    workspace_url: 'https://example.slack.com',
    poll_interval_secs: 300,
    backfill_hours: 24,
    recheck_days: 7,
    recheck_max_per_cycle: 20,
  },
  crew: {
    enabled: true, paused_reason: '', unattended: false, agent: 'kirocrew', model: '',
    live: true, session_open: true, running: false, trusted: false,
  },
  crew_memory: {
    phase: 'triaging',
    next: 'triage the new search-latency report; re-check the API-key thread once it moves',
    updated_at: T0 + 5400,
  },
  counts: {
    total: 5, needs_triage: 1, possibly_resolved: 1,
    by_status: { new: 1, triaged: 3, investigating: 1 },
    open_by_priority: { p1: 2, p2: 1, p3: 1 },
  },
  channels: {
    C0DEMO1: { cursor_ts: `${T0 + 5400}.000100`, last_polled_at: T0 + 5700, last_error: '' },
    C0DEMO2: { cursor_ts: `${T0 + 4800}.000100`, last_polled_at: T0 + 5700, last_error: '' },
  },
  source_state: SCENARIO,
  source_error: SCENARIO === 'needs_login' ? 'Slack MCP login expired: invalid_auth' : '',
  last_poll_at: T0 + 5700,
  last_poll_error: '',
  digest: {
    last_posted_date: '2025-09-23', last_error: '', pending: null,
    last_text:
      '*Slack Radar digest — 2025-09-23*\nTwo p1 bugs need an owner; dark-mode request is gaining support.\n' +
      'Open: 4 · awaiting triage: 1 · possibly resolved: 1\n\n*Top items*\n' +
      '• [p1/bug-report] CSV export fails for files over ~50k rows\n' +
      '• [p1/bug-report] Dashboard renders blank after the latest update',
  },
}

const EVENTS = [
  { at: T0 + 5700, kind: 'poll', text: '1 new, 1 thread updates, 1 possibly resolved', key: '' },
  { at: T0 + 5400, kind: 'crew', text: 'triaged 3 items; spawned investigator for the blank-dashboard report', key: '' },
  { at: T0 + 3600, kind: 'investigate', text: 'investigator spawned for 1 item(s)', key: '' },
  { at: T0 + 1800, kind: 'digest', text: 'digest delivered (self_dm)', key: '' },
  { at: T0 + 600, kind: 'settings', text: 'settings saved (2 channels)', key: '' },
]

function respond(path: string): unknown {
  const [p, qs] = path.split('?')
  const q = new URLSearchParams(qs || '')
  if (p.endsWith('/state')) return STATE
  if (p.endsWith('/items')) {
    const s = q.get('status') || ''
    const rows = s === 'open' ? ITEMS.filter((i) => ['new', 'triaged', 'investigating'].includes(i.status))
      : s ? ITEMS.filter((i) => i.status === s) : ITEMS
    return { ok: true, items: rows, total: rows.length }
  }
  if (p.endsWith('/events')) return { ok: true, events: [...EVENTS].reverse() }
  if (p.endsWith('/mcp/status')) {
    return { ok: true, status: 'connected', command: 'ai-community-slack-mcp', tools: 20, missing_read_tools: [], has_self_dm: true }
  }
  return { ok: true }
}

const api = {
  raw: async () => new Response('{}'),
  request: async (path: string) => respond(path),
  get: async (path: string) => respond(path),
  post: async (path: string) => respond(path),
  put: async (path: string) => respond(path),
  patch: async (path: string) => respond(path),
  del: async (path: string) => respond(path),
}

export function useAppApi() {
  return api
}
