/**
 * Stub of `@kirocrew/app-sdk` for README screenshots. Every response is FAKE demo
 * data defined in this file: no request leaves the page, and nothing is read from
 * a gateway, a ledger or Slack. Scenario comes from the query string:
 *   ?source=ok | needs_login
 */
const TODAY_EMPTY = new URLSearchParams(location.search).get('today') === 'empty'
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

const HANDLED = [
  item(3, 'C0DEMO2', 'frank', 'Typo on the pricing page', {
    category: 'bug-report', priority: 'p3', summary: 'Typo on the pricing page',
    handled_at: T0 + 4000, handled_how: 'done',
  }),
]

const need = (it: (typeof ITEMS)[number], reason: string, extra: Record<string, unknown> = {}) => ({
  key: it.key, channel: it.channel, permalink: it.permalink, summary: it.summary || it.text.slice(0, 200),
  priority: it.priority, category: it.category, age_hours: Math.round((T0 + 7200 - it.ts_float) / 360) / 10,
  reason, ...extra,
})

const HANDOFF = {
  title: 'Raise the CSV export row limit (issue #412)',
  prompt: `Repo example-org/example-app. Slack Radar item ${ITEMS[0].key}.\n` +
    'Links: https://github.com/example-org/example-app/issues/412\n' +
    'Coverage verdict: FULL, #412 describes the same 50k-row failure.\n' +
    'Change: stream the export instead of building it in memory. Verify: export a 60k-row file.\n' +
    'Do not merge; open a PR for review.',
  repo: 'example-org/example-app',
  links: ['https://github.com/example-org/example-app/issues/412'],
  at: T0 + 6000,
}

const REPLY_ITEM = item(4, 'C0DEMO2', 'hana', 'Does the CSV export keep my column filters?', {
  category: 'question', priority: 'p3', summary: 'Does CSV export keep column filters?', reply_count: 0,
})
const REPLY_DRAFT = 'Yes. The export uses the columns you filtered, and hidden columns are left out. ' +
  'The one known gap is tracked here: https://github.com/example-org/example-app/issues/398'
const dispatched = (it: (typeof ITEMS)[number], title: string, extra: Record<string, unknown>) => ({
  session_key: `chat-${it.ts_float}-1`, title: `Fix: ${title}`, agent: 'kirocrew-conductor',
  at: T0 + 6600, state: 'running', pr_url: '', pr_number: 0, ...extra,
})
const IN_PROGRESS = dispatched(ITEMS[3], 'Roll back the dashboard bundle split', {})
const WITH_PR = dispatched(ITEMS[1], 'Add dark mode to the reports view', {
  at: T0 + 3000, state: 'idle', pr_url: 'https://github.com/example-org/example-app/pull/418', pr_number: 418,
})
const fixRow = (it: (typeof ITEMS)[number], d: typeof IN_PROGRESS) => ({
  key: it.key, channel: it.channel, permalink: it.permalink, summary: it.summary, status: it.status,
  handled_how: '', handoff_title: d.title.slice(5), repo: 'example-org/example-app', dispatch: d,
})

const NEEDS = {
  ok: true,
  handled_total: HANDLED.length,
  replied_total: 1,
  replied: [{
    key: ITEMS[2].key, channel: ITEMS[2].channel, summary: ITEMS[2].summary,
    text: 'Settings → API keys → Rotate. The old key keeps working for 24 hours.',
    at: T0 + 3000, permalink: `https://example.slack.com/archives/C0DEMO1/p${T0 + 3000}000200`,
  }],
  fixes_total: 2,
  fixes: [fixRow(ITEMS[3], IN_PROGRESS), fixRow(ITEMS[1], WITH_PR)],
  handoffs_total: 1,
  handoffs: [{
    key: ITEMS[0].key, channel: ITEMS[0].channel, permalink: ITEMS[0].permalink,
    summary: ITEMS[0].summary, status: ITEMS[0].status, handled_how: '', handoff: HANDOFF,
  }],
  groups: [
    { id: 'decide', total: 4, entries: [
      need(ITEMS[0], 'Fix ready to hand off', { handoff_title: HANDOFF.title }),
      need(REPLY_ITEM, 'Reply ready to send', { reply_draft: REPLY_DRAFT }),
      need(ITEMS[3], `Fix in progress · ${IN_PROGRESS.title}`, { handoff_title: IN_PROGRESS.title.slice(5), dispatch: IN_PROGRESS }),
      need(ITEMS[2], 'Looks resolved: reply says “thanks”'),
    ] },
    { id: 'unanswered', total: 1, entries: [
      need(item(1, 'C0DEMO2', 'gina', 'Is there an SSO option for the free plan?', {
        category: 'question', summary: 'Is SSO available on the free plan?',
      }), 'No reply for 3 days', { age_hours: 74 }),
    ] },
    { id: 'clusters', total: 1, entries: [
      need(ITEMS[0], '3 similar messages', { members: [ITEMS[0].key, 'C0DEMO1:1758701000.000100', 'C0DEMO1:1758701200.000100'], words: ['csv', 'export', 'rows'] }),
    ] },
  ],
}

// Relative to the clock so "3m" reads the same on every run.
const NOW_T = Math.round(Date.now() / 1000)
const NOW = {
  ok: true,
  members: [
    { id: 'lead', state: 'working', doing: 'triaging 1 new items', since: NOW_T - 40, count: 1, source: 'gateway' },
    { id: 'investigator', state: 'working', doing: 'Re-check 9 items against example-org/example-app issues',
      since: NOW_T - 180, count: 1, source: 'gateway' },
    { id: 'watcher', state: 'idle', doing: 'idle', since: null, count: 0, source: 'gateway' },
    { id: 'poller', state: 'idle', doing: 'last poll 42s ago · next in 4m', since: NOW_T - 42, count: 2, source: 'ledger' },
  ],
}

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
    name: 'Radar Lead', slot_key: 'crew-slack-radar', session_agent: 'slack-radar-crew',
    enabled: true, paused_reason: '', unattended: false, agent: 'slack-radar-crew', model: '',
    live: true, session_open: true, running: false, trusted: false,
    today: TODAY_EMPTY
      ? { text: '', at: 0 }
      : { text: 'Two p1 bugs need an owner; the CSV export reports look like one problem.', at: T0 + 5400 },
  },
  investigations: { items: 1, running: 1 },
  now: { members: NOW.members },
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
  if (p.endsWith('/now')) return NOW
  if (p.endsWith('/needs')) return NEEDS
  if (p.endsWith('/items') && q.get('handled') === '1') return { ok: true, items: HANDLED, total: HANDLED.length }
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
  get: async (path: string) => {
    const w = window as unknown as { __gets?: string[] }
    w.__gets = [...(w.__gets || []), path]
    return respond(path)
  },
  post: async (path: string, body?: unknown) => {
    const w = window as unknown as { __posts?: unknown[] }
    w.__posts = [...(w.__posts || []), { path, body }]
    if (path.endsWith('/items/handoff/dispatch')) {
      return { ok: true, mode: 'server', session_key: 'chat-99-1', title: `Fix: ${HANDOFF.title}`, agent: 'kirocrew-conductor', at: T0 + 7000 }
    }
    return respond(path)
  },
  put: async (path: string) => respond(path),
  patch: async (path: string) => respond(path),
  del: async (path: string) => respond(path),
}

export function useAppApi() {
  return api
}

/** Stand-in for the host's chat launcher: records the launch for the DOM check. */
export function useChatLauncher() {
  return {
    openChat: (opts: { message?: string; autoSend?: boolean; agent?: string; slotKey?: string }) => {
      ;(window as unknown as { __launched?: unknown[] }).__launched = [
        ...((window as unknown as { __launched?: unknown[] }).__launched || []),
        opts,
      ]
    },
  }
}

/** Stand-in for the host's ChatEmbed: a static, fake transcript. The real embed
 *  renders the live crew session; this only shows where it sits on the page. */
export function ChatEmbed({ placeholder }: { placeholder?: string }) {
  const bubble = (who: string, text: string, me = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: me ? 'flex-end' : 'flex-start', gap: 2 }}>
      {!me && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{who}</div>}
      <div style={{
        background: me ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
        border: `1px solid ${me ? 'transparent' : 'var(--border)'}`,
        borderRadius: 12, padding: '9px 12px', maxWidth: '92%', fontSize: 13,
      }}>{text}</div>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bubble('Radar Lead', 'Morning. 1 new since 09:00. Two p1 bugs need an owner: the CSV export limit (matches #412) and the blank dashboard, which the Investigator is on now.')}
        {bubble('', 'Is the blank dashboard the same as last week\u2019s CDN issue?', true)}
        {bubble('Radar Lead', 'Not so far. Last week\u2019s reports all mentioned a 403 on assets; these two don\u2019t. I\u2019ll tell you when the Investigator is back.')}
      </div>
      <div style={{ margin: '0 12px 12px', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '10px 12px', color: 'var(--muted)', fontSize: 13 }}>
        {placeholder}
      </div>
    </div>
  )
}
