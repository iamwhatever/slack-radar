import * as sdk from '@kirocrew/app-sdk'
import { ChatEmbed, useAppApi } from '@kirocrew/app-sdk'
import { Badge, Btn, Card, CardTitle, EmptyState, Input, PageHeader, StatCard, Toggle } from '@kirocrew/app-sdk/ui'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'

const BASE = '/api/apps/slack-radar'

type Item = {
  key: string
  channel: string
  user: string
  text: string
  permalink: string
  status: string
  category: string
  priority: string
  summary: string
  links: string[]
  note: string
  reply_count: number
  needs_triage: boolean
  possibly_resolved: { reason: string; at: number } | null
  ts_float: number
  handled_at?: number
  handled_how?: 'done' | 'ignored' | ''
  fix_handoff?: { title?: string; prompt?: string; pr_url?: string; pr_state?: PrState | null } | null
  reply_draft?: { text?: string } | null
}

// GET /needs: rule-built groups (backend/needs.py). A cluster entry names its members.
type NeedEntry = {
  key: string
  channel: string
  permalink: string
  summary: string
  priority: string
  category: string
  age_hours: number
  reason: string
  members?: string[]
  words?: string[]
  handoff_title?: string
  reply_draft?: string
  reply_draft_by?: 'lead' | 'owner'
  reply_draft_at?: number
  // Set by the thread re-check when replies arrived after the draft (store.py `reply_draft.stale`).
  reply_draft_stale?: DraftStale | null
  // The thread's newest reply ts, and whether the Lead's view of the item is out of date.
  latest_reply?: string
  needs_reanalysis?: boolean
  dispatch?: FixDispatch
  // The original Slack message and its kept thread replies (oldest first).
  text?: string
  user?: string
  ts_float?: number
  replies?: ThreadReply[]
  last_thread_check_at?: number
  status?: string
  // The Investigator's run (`spawn <id>`, "" before one), when it started, and what it linked.
  investigation?: string
  investigation_at?: number
  links_count?: number
  links?: string[]
  // The owner asked the Lead about this item and the Lead has not recorded it since.
  reanalyze_in_flight?: boolean
}
type ThreadReply = { ts: string; user: string; text: string }
type DraftStale = { since: string; new_replies: number }
// The Re-analyze button (needs.py `reanalyze_view`): the keys it sends, of how many.
type Reanalyze = { keys: string[]; total: number; in_flight: boolean }
type NeedGroup = { id: 'decide' | 'unanswered' | 'clusters'; total: number; entries: NeedEntry[] }
// A fix task the Lead wrote for a coding session (store.py `fix_handoff`, LOCAL).
type FixHandoff = { title: string; prompt: string; repo: string; links: string[]; at: number }
type HandoffRow = {
  key: string
  channel: string
  permalink: string
  summary: string
  status: string
  handled_how: string
  handoff: FixHandoff
}
// A fix PR's state, read by the gateway with the owner's own `gh` (github_state.py).
type PrState = { state: 'open' | 'draft' | 'merged' | 'closed' | 'unknown'; at: number; merged_at?: string }
// A hand-off the owner dispatched to a kirocrew-conductor session (needs.py `fix_view`).
type FixDispatch = {
  session_key: string
  title: string
  agent: string
  at: number
  state: 'running' | 'idle' | 'closed' | 'unknown'
  pr_url: string
  pr_number: number
  // A batch dispatch: one conductor session for several hand-offs.
  batch?: boolean
  batch_keys?: string[]
  pr_urls?: string[]
  // On the crew's scoped grant (unattended mode); false: the session asks for each tool.
  trusted?: boolean
  pr_state?: PrState | null
}
// One "Fixes in flight" header per batch session (needs.py `fix_batches`).
type FixBatch = {
  session_key: string
  title: string
  state: FixDispatch['state']
  at: number
  repo: string
  keys: string[]
  prs: string[]
  total: number
  prs_found: number
}
type FixRow = {
  key: string
  channel: string
  permalink: string
  summary: string
  status: string
  handled_how: string
  handoff_title: string
  repo: string
  latest_reply?: string
  dispatch: FixDispatch
}
type Needs = {
  groups: NeedGroup[]
  handled_total: number
  handoffs?: HandoffRow[]
  handoffs_total?: number
  fixes?: FixRow[]
  fixes_total?: number
  fix_batches?: FixBatch[]
  replied?: RepliedRow[]
  replied_total?: number
  reanalyze?: Reanalyze
}
// A reply the owner sent to a thread (store.py `replied`).
type RepliedRow = { key: string; channel: string; summary: string; text: string; at: number; permalink: string }

type Settings = {
  channels: string[]
  digest_destination: 'self_dm' | 'dashboard'
  slack_login: string
  slack_mcp_command: string
  workspace_url: string
  poll_interval_secs: number
  backfill_hours: number
  recheck_days: number
  recheck_max_per_cycle: number
}

type Today = { text: string; at: number }

/** One `GET /now` row: what a member is doing right now. */
type NowRow = {
  id: MemberId
  state: 'working' | 'idle' | 'paused' | 'planned'
  doing: string
  since: number | null
  count: number
  source: string
  /** When the member last ran (the Lead: last wake; the Poller: last cycle). */
  last?: { started_at: number | null; finished_at: number | null }
  /** `running` while it works, `idle` after a run, `never` before the first. */
  ran?: 'running' | 'idle' | 'never'
  /** Poller only: when its loop runs the next cycle. */
  next_at?: number | null
}

type State = {
  vault_available: boolean
  source_state: string
  source_error: string
  settings: Settings
  crew: {
    name: string
    slot_key: string
    session_agent: string
    enabled: boolean
    paused_reason: string
    unattended: boolean
    agent: string
    model: string
    live: boolean
    session_open: boolean
    running: boolean
    trusted: boolean
    today?: Today | null
  }
  crew_memory: { phase: string; next: string; updated_at: number }
  investigations?: { items: number; running: number }
  now?: { members: NowRow[] }
  counts: {
    total: number
    needs_triage: number
    possibly_resolved: number
    by_status: Record<string, number>
    open_by_priority: Record<string, number>
  }
  channels: Record<string, { cursor_ts?: string; last_polled_at?: number; last_error?: string }>
  last_poll_at: number
  last_poll_error: string
  digest: { last_posted_date: string; last_error: string; pending: unknown; last_text?: string }
}

type McpStatus = { status: string; command: string; detail?: string; missing_read_tools?: string[] }

// Plain words for the Slack connection. The technical state stays in the Details fold.
const CONNECTION_LABEL: Record<string, string> = {
  checking: 'checking…',
  connected: 'connected',
  needs_login: 'sign in again',
  binary_not_found: 'not installed',
  incompatible: 'missing read access',
  error: 'not working',
}

// The three quick questions offered beside "Ask the lead" and under the open chat.
const QUICK_QUESTIONS = ['What needs me today?', "Draft today's digest", 'Which threads look resolved?']

type EventRow = { at: number; kind: string; text: string; key: string }

type TabId = 'board' | 'ledger' | 'team' | 'activity' | 'settings'
const TABS: { id: TabId; label: string }[] = [
  { id: 'board', label: 'Board' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'team', label: 'Team' },
  { id: 'activity', label: 'Activity' },
  { id: 'settings', label: 'Settings' },
]

const fmtTime = (t?: number) => (t ? new Date(t * 1000).toLocaleString() : 'never')

function ago(t?: number): string {
  if (!t) return 'never'
  const s = Math.max(0, Date.now() / 1000 - t)
  if (s < 90) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return fmtTime(t)
}

function connectionStatus(mcp: McpStatus | null, sourceState: string): string {
  return sourceState === 'needs_login' ? 'needs_login' : mcp?.status || 'checking'
}

function Details({ children, summary = 'Details' }: { children: ReactNode; summary?: string }) {
  return (
    <details className="text-xs text-muted" style={{ marginTop: 6 }}>
      <summary style={{ cursor: 'pointer' }}>{summary}</summary>
      <div style={{ marginTop: 4 }}>{children}</div>
    </details>
  )
}

// ── crew roster and live status (the `now` rows) ────────────────────────────

type MemberId = 'lead' | 'investigator' | 'watcher' | 'poller'
type Member = {
  id: MemberId
  title: string
  initials: string
  layer: string
  kind: string
  agent: string
  duty: string
  planned?: boolean
}

const ROSTER: Member[] = [
  {
    id: 'lead',
    title: 'Radar Lead',
    initials: 'RL',
    layer: 'Lead',
    kind: 'Resident',
    agent: 'slack-radar-crew',
    duty: 'Triages every watched channel, sets category and priority, decides when a cluster needs investigating, hands possibly-resolved threads to the Thread Watcher, writes the digest headline, and answers you here. Woken by the Poller when something moved.',
  },
  {
    id: 'investigator',
    title: 'Investigator',
    initials: 'IN',
    layer: 'Research',
    kind: 'Joins on demand',
    agent: 'slack-radar-investigator',
    duty: 'Searches GitHub read-only for issues and pull requests that match a cluster of reports, and links them in the ledger.',
  },
  {
    id: 'watcher',
    title: 'Thread Watcher',
    initials: 'TW',
    layer: 'Review',
    kind: 'Joins after a poll',
    agent: 'slack-radar-watcher',
    duty: 'Dispatched for the lead after a poll flags possibly-resolved threads: one run judges the whole batch and records resolved or not in the ledger. No shell.',
  },
  {
    id: 'poller',
    title: 'Poller',
    initials: '⟳',
    layer: 'System',
    kind: 'Code, no model',
    agent: '',
    duty: 'Runs by itself on the poll interval: reads new messages and thread replies from Slack, flags likely resolutions, and delivers the digest. Spends no credits.',
    planned: false,
  },
]

type StatusLabel = { label: string; tone: 'ok' | 'aim' | 'warn' | 'muted' }

const nowRow = (s: State, id: MemberId): NowRow | undefined => s.now?.members.find((r) => r.id === id)

/** A short label for a member, from its `now` row (older gateways: from the state). */
function memberStatus(m: Member, s: State): StatusLabel {
  const row = nowRow(s, m.id)
  if (m.id === 'lead') {
    if (row?.state === 'paused' || !s.crew.live) return { label: 'paused', tone: 'muted' }
    return (row ? row.state === 'working' : s.crew.running) ? { label: 'working', tone: 'aim' } : { label: 'live', tone: 'ok' }
  }
  if (m.id === 'poller') {
    if (s.source_state === 'needs_login') return { label: 'sign in again', tone: 'warn' }
    if (row?.state === 'paused') return { label: 'paused', tone: 'warn' }
    return { label: `polled ${ago(s.last_poll_at)}`, tone: 'muted' }
  }
  const n = row ? row.count : m.id === 'investigator' ? s.investigations?.running || 0 : 0
  if (n) return { label: `${n} running`, tone: 'aim' }
  if (row?.state === 'planned') return { label: 'not started yet', tone: 'muted' }
  return { label: 'idle', tone: 'muted' }
}

/** `16:54` for an epoch-seconds time today, `Sep 28 16:54` for an older one, `--` for none. */
function hm(t: number | null | undefined): string {
  if (!t) return '--'
  const d = new Date(t * 1000)
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`
}

/** `3m`, `now` until an epoch-seconds time. */
function until(t: number | null | undefined): string {
  if (!t) return ''
  const secs = Math.round(t - Date.now() / 1000)
  return secs <= 0 ? 'now' : elapsed(Date.now() / 1000 - secs)
}

/** When a member last ran, from its `now` row: `last 16:54 · next in 3m`, `last wake 16:55`,
 *  `last run 15:49–15:54`, `last run --`. Empty for an older gateway without `last`. */
function lastLine(m: Member, row: NowRow | undefined): string {
  if (!row?.last) return ''
  const { started_at: start, finished_at: end } = row.last
  if (m.id === 'poller') {
    if (!start) return 'has not polled yet'
    const next = until(row.next_at)
    return `last ${hm(start)}${next ? ` · next ${next === 'now' ? 'due now' : `in ${next}`}` : ''}`
  }
  if (m.id === 'lead') return start ? `last wake ${hm(start)}` : 'not woken yet'
  if (!start) return 'last run --'
  return end ? `last run ${hm(start)}–${hm(end)}` : `last run ${hm(start)}`
}

/** A leaf's resting state for the Team tab: `idle since 15:54` or `never ran`. */
function restingLine(row: NowRow | undefined): string {
  if (!row?.ran || row.ran === 'running') return ''
  if (row.ran === 'never') return 'never ran'
  return `idle since ${hm(row.last?.finished_at || row.last?.started_at)}`
}

/** `42s`, `5m`, `3h` since an epoch-seconds time. */
function elapsed(since: number | null | undefined): string {
  if (!since) return ''
  const secs = Math.max(0, Math.round(Date.now() / 1000 - since))
  if (secs < 90) return `${secs}s`
  if (secs < 90 * 60) return `${Math.round(secs / 60)}m`
  return `${Math.round(secs / 3600)}h`
}

const clip = (text: string, n = 60) => (text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text)

/** What a member is doing, as one line: `working: triaging 2 new items`, `1 running: …`, `idle`. */
function doingLine(m: Member, s: State): string {
  const row = nowRow(s, m.id)
  if (!row) return memberStatus(m, s).label
  const last = lastLine(m, row)
  if (m.id === 'poller') return last && row.state === 'paused' ? `${row.doing.split(' · ')[0]} · ${last}` : last || row.doing
  if (row.state !== 'working') {
    if (row.state === 'paused') return `paused: ${row.doing}`
    return last || memberStatus(m, s).label
  }
  if (m.id === 'lead') return `working: ${row.doing}`
  return `${row.count} running: ${row.doing}`
}

// One stylesheet for the pulsing dot; still when the reader asks for less motion.
const PULSE_CSS = `@keyframes slack-radar-pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.7) } }
.sr-pulse { animation: slack-radar-pulse 1.4s ease-in-out infinite }
@keyframes slack-radar-spin { to { transform: rotate(360deg) } }
.sr-spin { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: slack-radar-spin .8s linear infinite; vertical-align: -1px; margin-right: 6px }
@media (prefers-reduced-motion: reduce) { .sr-pulse, .sr-spin { animation: none } }`

function Dot({ tone, pulse }: { tone: StatusLabel['tone']; pulse: boolean }) {
  return (
    <i
      aria-hidden
      className={pulse ? 'sr-pulse' : undefined}
      style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', display: 'inline-block', background: TONE_VAR[tone] }}
    />
  )
}

/** A member's live status: a dot (pulsing while working), the name, and what it is doing.
 *  The Board's Now strip and the Team tab both render this. */
function MemberStatus({ m, state, withName = true, withResting = false, onOpen }: { m: Member; state: State; withName?: boolean; withResting?: boolean; onOpen?: () => void }) {
  const st = memberStatus(m, state)
  const row = nowRow(state, m.id)
  const working = row ? row.state === 'working' : st.tone === 'aim'
  const resting = withResting && (m.id === 'investigator' || m.id === 'watcher') ? restingLine(row) : ''
  const full = resting ? `${resting} · ${doingLine(m, state)}` : doingLine(m, state)
  const name = m.id === 'lead' ? state.crew.name || m.title : m.title
  const body = (
    <>
      <Dot tone={st.tone} pulse={working} />
      {withName && <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{name}</span>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clip(full)}</span>
    </>
  )
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    fontSize: 13,
    opacity: working || st.tone === 'warn' ? 1 : 0.6,
    color: 'var(--text)',
  }
  const common = { title: `${name} · ${full}`, 'data-member': m.id, 'data-state': row?.state || (working ? 'working' : 'idle') }
  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        {...common}
        aria-label={`${name}: ${full}. Show activity`}
        style={{ ...style, background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
      >
        {body}
      </button>
    )
  }
  return (
    <span {...common} style={style}>
      {body}
    </span>
  )
}

/** The Board's one-line Now strip: every member, what it is doing, right now. */
function NowStrip({ state, onOpenActivity }: { state: State; onOpenActivity: () => void }) {
  return (
    <div
      data-testid="now-strip"
      role="status"
      aria-label="Who is working right now"
      className="flex flex-wrap items-center"
      style={{ gap: '6px 18px', padding: '8px 12px', marginBottom: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)', minWidth: 0 }}
    >
      <span className="text-xs text-muted" style={{ fontWeight: 600, letterSpacing: '.04em' }}>NOW</span>
      {ROSTER.map((m) => (
        <MemberStatus
          key={m.id}
          m={m}
          state={state}
          onOpen={m.id === 'investigator' || m.id === 'watcher' ? onOpenActivity : undefined}
        />
      ))}
    </div>
  )
}

/** Under the chat header: one line per Investigator/Watcher run in flight. The chat
 *  itself only shows a run once it is finished. */
function RunningLines({ state }: { state: State }) {
  const rows = ROSTER.filter((m) => m.id === 'investigator' || m.id === 'watcher')
    .map((m) => ({ m, row: nowRow(state, m.id) }))
    .filter(({ row }) => row?.state === 'working')
  if (!rows.length) return null
  return (
    <div data-testid="chat-running" style={{ padding: '6px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' }}>
      {rows.map(({ m, row }) => {
        const t = elapsed(row!.since)
        const text = `${m.title} running${row!.count > 1 ? ` (${row!.count})` : ''} · ${row!.doing}${t ? ` · ${t}` : ''}`
        return (
          <div key={m.id} className="text-xs flex items-center gap-2" title={text} style={{ minWidth: 0 }}>
            <Dot tone="aim" pulse />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
          </div>
        )
      })}
    </div>
  )
}

const TONE_VAR: Record<StatusLabel['tone'], string> = {
  ok: 'var(--ok)',
  aim: 'var(--aim)',
  warn: 'var(--warn)',
  muted: 'var(--muted-strong)',
}

function Avatar({ m, s, selected, size = 32 }: { m: Member; s: State; selected?: boolean; size?: number }) {
  const st = memberStatus(m, s)
  const dim = m.planned || m.id === 'poller'
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    fontSize: 11,
    fontWeight: 700,
    position: 'relative',
    flex: 'none',
    background: dim ? 'transparent' : 'var(--bg-hover)',
    color: dim ? 'var(--muted)' : 'var(--text-strong)',
    border: `2px ${dim ? 'dashed' : 'solid'} ${selected ? 'var(--accent)' : dim ? 'var(--border-strong)' : 'transparent'}`,
    opacity: m.planned ? 0.6 : 1,
  }
  return (
    <span style={style} aria-hidden>
      {m.initials}
      {!m.planned && (
        <i
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: 10,
            height: 10,
            borderRadius: '50%',
            border: '2px solid var(--card)',
            background: TONE_VAR[st.tone],
          }}
        />
      )}
    </span>
  )
}

function statusVariant(s: string): 'ok' | 'err' | 'warn' | 'aim' | 'muted' {
  if (s === 'new') return 'warn'
  if (s === 'investigating') return 'aim'
  if (s === 'resolved') return 'ok'
  return 'muted'
}

// ── header: tab strip and crew toggle ───────────────────────────────────────

function TabStrip({ tab, setTab }: { tab: TabId; setTab: (t: TabId) => void }) {
  return (
    <div role="tablist" aria-label="Slack Radar sections" style={{ display: 'flex', gap: 4 }}>
      {TABS.map((t) => {
        const on = tab === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => setTab(t.id)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: 0,
              cursor: 'pointer',
              fontSize: 14,
              background: on ? 'var(--bg-hover)' : 'transparent',
              color: on ? 'var(--text-strong)' : 'var(--muted)',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

function CrewSwitch({
  state,
  configured,
  busy,
  onStart,
  onPause,
}: {
  state: State
  configured: boolean
  busy: string
  onStart: () => void
  onPause: () => void
}) {
  const live = state.crew.live
  const disabled = !!busy || (!live && !configured)
  return (
    <div className="flex items-center gap-2" title={!live && !configured ? 'Add a channel in Settings first' : undefined}>
      <span className="text-sm">Crew</span>
      <Toggle
        checked={live}
        disabled={disabled}
        onChange={(on) => (on ? onStart() : onPause())}
        label={live ? 'Pause the crew' : 'Start the crew'}
      />
      <span className="text-xs text-muted" title="Whether the crew's commands run without asking you">
        Unattended: {state.crew.trusted ? 'on' : 'off'}
      </span>
    </div>
  )
}

export default function SlackRadar() {
  const api = useAppApi()
  const [tab, setTab] = useState<TabId>('board')
  const [state, setState] = useState<State | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [needs, setNeeds] = useState<Needs | null>(null)
  const [handled, setHandled] = useState<Item[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [filter, setFilter] = useState('open')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [mcp, setMcp] = useState<McpStatus | null>(null)
  const [nowRows, setNowRows] = useState<NowRow[] | null>(null)
  const [activityKinds, setActivityKinds] = useState<string[] | null>(null)

  const probe = useCallback(async () => {
    try {
      setMcp(await api.get<McpStatus>(`${BASE}/mcp/status`))
    } catch (err) {
      setMcp({ status: 'error', command: '', detail: (err as Error).message })
    }
  }, [api])

  useEffect(() => {
    probe()
  }, [probe])

  const load = useCallback(async () => {
    try {
      const [s, i, e, n, h] = await Promise.all([
        api.get<State>(`${BASE}/state`),
        api.get<{ items: Item[] }>(`${BASE}/items?status=${encodeURIComponent(filter)}&limit=300`),
        api.get<{ events: EventRow[] }>(`${BASE}/events?limit=150`),
        api.get<Needs>(`${BASE}/needs`),
        api.get<{ items: Item[] }>(`${BASE}/items?handled=1&limit=100`),
      ])
      setState(s)
      setNowRows(s.now?.members || null)
      setItems(i.items)
      setNeeds(n)
      setHandled(h.items)
      setEvents(e.events.slice().reverse())
    } catch (err) {
      setMessage(`Could not load: ${(err as Error).message}`)
    }
  }, [api, filter])

  useEffect(() => {
    load()
    const id = window.setInterval(load, 30000)
    return () => window.clearInterval(id)
  }, [load])

  // While anyone works, refresh just `/now` every 5 s so the strip moves; the
  // Activity log follows whenever a run starts or ends. Stops when all are idle.
  const anyWorking = !!nowRows?.some((r) => r.state === 'working')
  const runSig = useRef('')
  useEffect(() => {
    if (!anyWorking) return
    const tick = async () => {
      try {
        const n = await api.get<{ members: NowRow[] }>(`${BASE}/now`)
        setNowRows(n.members)
        const sig = n.members.map((r) => `${r.id}:${r.state}:${r.count}`).join(',')
        if (runSig.current && sig !== runSig.current) {
          const e = await api.get<{ events: EventRow[] }>(`${BASE}/events?limit=150`)
          setEvents(e.events.slice().reverse())
        }
        runSig.current = sig
      } catch {
        /* the 30 s load reports errors */
      }
    }
    const id = window.setInterval(tick, 5000)
    return () => window.clearInterval(id)
  }, [anyWorking, api])
  const view = useMemo(() => (state && nowRows ? { ...state, now: { members: nowRows } } : state), [state, nowRows])
  const openMemberActivity = () => {
    setActivityKinds(['member', 'crew', 'investigate'])
    setTab('activity')
  }

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label)
    setMessage('')
    try {
      await fn()
      setMessage(`${label}: done`)
      await load()
    } catch (err) {
      setMessage(`${label} failed: ${(err as Error).message}`)
    } finally {
      setBusy('')
    }
  }

  const configured = !!state && state.settings.channels.length > 0
  const nChannels = state?.settings.channels.length || 0
  const statusLine = !state
    ? 'A small crew triaging your Slack channels'
    : `${nChannels ? `Watching ${nChannels} channel${nChannels === 1 ? '' : 's'}` : 'No channels yet'} · ${state.crew.live ? 'running' : 'paused'}`
  const conn = state ? connectionStatus(mcp, state.source_state) : 'checking'
  const recheck = () => {
    probe()
    load()
  }

  return (
    <>
      <PageHeader
        title="Slack Radar"
        subtitle={statusLine}
        actions={
          <div className="flex flex-wrap items-center gap-4">
            <TabStrip
              tab={tab}
              setTab={(t) => {
                setActivityKinds(null)
                setTab(t)
              }}
            />
            {state && (
              <CrewSwitch
                state={state}
                configured={configured}
                busy={busy}
                onStart={() => act('Start crew', () => api.post(`${BASE}/crew/start`, {}))}
                onPause={() => act('Pause crew', () => api.post(`${BASE}/crew/pause`, {}))}
              />
            )}
          </div>
        }
      />
      <style>{PULSE_CSS}</style>
      <div className="px-6 pb-8 overflow-y-auto flex-1 min-h-0">
        {view && tab === 'board' && <NowStrip state={view} onOpenActivity={openMemberActivity} />}
        {state && conn === 'needs_login' && (
          <SignInBanner mcp={mcp} sourceError={state.source_error} busy={busy} onCheck={recheck} />
        )}
        {message && (
          <p role="status" className="text-sm text-muted mb-3">
            {message}
          </p>
        )}
        {!view ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : tab === 'board' ? (
          <Board
            state={view}
            needs={needs}
            handled={handled}
            configured={configured}
            mcp={mcp}
            busy={busy}
            onPoll={() => act('Poll', () => api.post(`${BASE}/poll`, {}))}
            onStart={() => act('Start crew', () => api.post(`${BASE}/crew/start`, {}))}
            onDigest={() => act('Digest now', () => api.post(`${BASE}/digest/request`, {}))}
            events={events}
            onChanged={load}
          />
        ) : tab === 'ledger' ? (
          <LedgerTab
            state={view}
            items={items}
            filter={filter}
            setFilter={setFilter}
            selected={selected}
            setSelected={setSelected}
            busy={busy}
            onInvestigate={(repo) =>
              act('Investigate', async () => {
                await api.post(`${BASE}/investigate`, { keys: [...selected], repo })
                setSelected(new Set())
              })
            }
          />
        ) : tab === 'team' ? (
          <TeamTab state={view} />
        ) : tab === 'activity' ? (
          <Activity events={events} kinds={activityKinds} onShowAll={() => setActivityKinds(null)} />
        ) : (
          <SettingsTab state={view} busy={busy} act={act} mcp={mcp} onProbe={probe} />
        )}
      </div>
    </>
  )
}

// ── Slack connection: banner and status line ────────────────────────────────

function TechDetails({ mcp, sourceError }: { mcp: McpStatus | null; sourceError: string }) {
  const lines = [
    mcp?.status && `status: ${mcp.status}`,
    mcp?.command && `command: ${mcp.command}`,
    sourceError && `error: ${sourceError}`,
    mcp?.detail && mcp.detail !== sourceError && `detail: ${mcp.detail}`,
    mcp?.missing_read_tools?.length && `missing read tools: ${mcp.missing_read_tools.join(', ')}`,
  ].filter(Boolean) as string[]
  if (!lines.length) return null
  return (
    <Details>
      <pre className="font-mono whitespace-pre-wrap" style={{ margin: 0 }}>{lines.join('\n')}</pre>
    </Details>
  )
}

function SignInBanner({ mcp, sourceError, busy, onCheck }: { mcp: McpStatus | null; sourceError: string; busy: string; onCheck: () => void }) {
  return (
    <div
      role="alert"
      className="mb-4"
      style={{
        border: '1px solid var(--warn)',
        background: 'var(--warn-subtle)',
        borderRadius: 10,
        padding: '12px 16px',
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>Slack connection: sign in again</div>
          <div className="text-sm">
            Your Slack sign-in expired, so no new messages are read. Sign in to Slack again on the computer running Kiro
            Crew, then check again. Nothing is lost; reading picks up where it stopped.
          </div>
        </div>
        <Btn primary onClick={onCheck} disabled={!!busy}>I signed in, check again</Btn>
      </div>
      <TechDetails mcp={mcp} sourceError={sourceError} />
    </div>
  )
}

function ConnectionLine({ mcp, state, withPoll, action }: { mcp: McpStatus | null; state: State; withPoll?: boolean; action?: ReactNode }) {
  const status = connectionStatus(mcp, state.source_state)
  const ok = status === 'connected'
  const dot = ok ? 'var(--ok)' : status === 'checking' ? 'var(--muted-strong)' : 'var(--warn)'
  return (
    <div className={action ? 'mb-3' : 'mb-4'} data-testid={action ? 'connection-line' : undefined}>
      <div className="flex flex-wrap items-center gap-2">
      <p role="status" className="text-sm text-muted flex flex-wrap items-center gap-2" style={{ margin: 0, flex: 1, minWidth: 0 }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block' }} />
        <span>
          Slack connection: <span style={{ color: ok ? 'var(--text)' : 'var(--warn)' }}>{CONNECTION_LABEL[status] || status}</span>
        </span>
        {withPoll && (
          <span>
            · last poll {ago(state.last_poll_at)}
            {state.settings.channels.length > 0 && <> · watching {state.settings.channels.join(', ')}</>}
          </span>
        )}
      </p>
      {action}
      </div>
      {!ok && status !== 'needs_login' && <TechDetails mcp={mcp} sourceError={state.source_error} />}
    </div>
  )
}

// ── Board ───────────────────────────────────────────────────────────────────

// The Board answers "what do I do next", top to bottom: the Now strip (rendered by
// the page above it), one thin Slack connection line with Poll now, the Today card
// (the Lead's line and the latest digest), the Needs-you groups, and the Lead chat
// bar pinned to the bottom of the panel. Every ledger item, its filters and
// Investigate live on the Ledger tab.
function Board(props: {
  state: State
  needs: Needs | null
  handled: Item[]
  configured: boolean
  mcp: McpStatus | null
  busy: string
  onPoll: () => void
  onStart: () => void
  onDigest: () => void
  events: EventRow[]
  onChanged: () => void
}) {
  const { state } = props
  const [pending, setPending] = useState('')
  const [expanded, setExpanded] = useChatOpen(state.crew.slot_key)
  const chatRef = useRef<HTMLDivElement>(null)
  const askWhy = (e: NeedEntry) => {
    setPending(whyQuestion(e))
    setExpanded(true)
    window.requestAnimationFrame(() => chatRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }))
  }
  return (
    <div data-testid="board" style={{ minWidth: 0 }}>
      <ConnectionLine
        mcp={props.mcp}
        state={state}
        withPoll
        action={
          <Btn style={small} onClick={props.onPoll} disabled={!!props.busy || !props.configured}>Poll now</Btn>
        }
      />

      {!props.configured && (
        <Card className="mb-4">
          <CardTitle>Finish setup</CardTitle>
          <p className="text-sm text-muted">
            Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite.
          </p>
        </Card>
      )}

      <TodayCard state={state} busy={props.busy} onDigest={props.onDigest} />

      <NeedsCard
        needs={props.needs}
        handled={props.handled}
        onChanged={props.onChanged}
        onWhy={askWhy}
        investigator={nowRow(state, 'investigator')}
      />

      {/* Last child of the Board: sticks to the bottom of the scrolling panel, so an
          opened chat grows upward from there. */}
      <div
        ref={chatRef}
        data-testid="chat-bar"
        data-expanded={expanded ? 'true' : 'false'}
        style={{ position: 'sticky', bottom: 0, zIndex: 5, marginTop: 8, borderRadius: 12, boxShadow: '0 -6px 18px rgba(0,0,0,.18)' }}
      >
        <AskLead
          state={state}
          events={props.events}
          configured={props.configured}
          busy={props.busy}
          expanded={expanded}
          setExpanded={setExpanded}
          pending={pending}
          setPending={setPending}
          onStart={props.onStart}
          onChanged={props.onChanged}
        />
      </div>
    </div>
  )
}

// ── Board: "Needs you" ──────────────────────────────────────────────────────

// Section titles for GET /needs groups, in the order the backend returns them.
const GROUP_TITLE: Record<NeedGroup['id'], string> = {
  decide: 'Needs a decision',
  unanswered: 'Questions nobody answered',
  clusters: 'Reported more than once',
}

type HandleHow = 'done' | 'ignored' | 'reopen'

// How long ago the message was posted, from the entry's `age_hours`.
function fmtAge(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min ago`
  if (h < 48) return `${Math.round(h)} h ago`
  return `${Math.floor(h / 24)} days ago`
}

// Rows shown per Needs-you group before "Show N more".
const ROWS_SHOWN = 5

function whyQuestion(e: NeedEntry): string {
  const s = e.summary.length > 80 ? `${e.summary.slice(0, 79)}…` : e.summary
  return `Why is "${s}" ${e.priority || 'on my list'}?`
}

function priorityBadge(priority: string) {
  if (!priority) return null
  return <Badge variant={priority === 'p0' || priority === 'p1' ? 'err' : 'muted'}>{priority}</Badge>
}

// The host's ErrorNotice is not part of the app SDK, so this is a small local one:
// what failed, in plain words, and the one action that fixes it.
function ErrorNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="text-sm flex flex-wrap items-center gap-2"
      style={{ border: '1px solid var(--danger)', borderRadius: 8, padding: '8px 12px', margin: '8px 0' }}
    >
      <span style={{ flex: 1, minWidth: 200 }}>{message}</span>
      <Btn onClick={onRetry}>Try again</Btn>
    </div>
  )
}

const small: CSSProperties = { fontSize: 12, padding: '2px 10px' }

// What the owner should do with a row: the label of its one primary button ('' for none).
type Primary = 'Open' | 'Reply' | 'Dispatch fix' | 'Investigate' | 'Ask lead' | 'Done' | ''

// Reports the Investigator can search GitHub for.
const isFixable = (e: NeedEntry) => e.category === 'bug-report' || e.category === 'feature-request'
// The Investigator ran and is done: it left links, or the crew moved the item on.
const investigated = (e: NeedEntry) => (e.links_count || 0) > 0 || (!!e.investigation && e.status !== 'investigating')

// A row whose Lead-written reply waits for the owner's Send (in the detail view).
const isReplyRow = (groupId: NeedGroup['id'], e: NeedEntry) => groupId === 'decide' && !!e.reply_draft && !e.handoff_title

function primaryOf(groupId: NeedGroup['id'], e: NeedEntry, sent = false): Primary {
  if (groupId === 'decide' && (e.dispatch || sent)) return 'Done'
  if (groupId === 'decide' && e.handoff_title) return 'Dispatch fix'
  if (isReplyRow(groupId, e)) return 'Open'
  if (groupId === 'decide' && e.reason.startsWith('Looks resolved')) return 'Done'
  if (groupId === 'unanswered' && e.permalink) return 'Reply'
  if (groupId === 'clusters') return investigated(e) && isFixable(e) && !e.handoff_title && !e.reply_draft ? 'Ask lead' : 'Investigate'
  if (isFixable(e) && !investigated(e)) return 'Investigate'
  if (isFixable(e) && !e.handoff_title && !e.reply_draft) return 'Ask lead'
  if ((e.category === 'question' || e.category === 'already-answered') && !e.reply_draft) return 'Open'
  return ''
}

// An Investigator run on this row is still going: the row says so, and `/now` says since when.
const investigationRunning = (e: NeedEntry, investigator?: NowRow) =>
  !!e.investigation && !(e.links_count || 0) && e.status === 'investigating' && investigator?.state === 'working'

// The keys a row's Investigate or Ask lead sends: a cluster's members, else the row itself.
const rowKeys = (e: NeedEntry) => (e.members?.length ? e.members : [e.key])

// Slack message markup as plain text: <@U1> -> @U1, <url|label> -> label, entities decoded.
function slackPlain(t: string): string {
  return t
    .replace(/<([@#!])([^>|]+)\|([^>]+)>/g, (_m, sig: string, _id: string, label: string) => `${sig === '#' ? '#' : '@'}${label}`)
    .replace(/<([@#!])([^>|]+)>/g, (_m, sig: string, id: string) => `${sig === '#' ? '#' : '@'}${id}`)
    .replace(/<([^>|]+)\|([^>]+)>/g, '$2')
    .replace(/<([^>]+)>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

// The first non-empty line of a Slack message, clipped for a list row.
const firstLine = (t: string, n = 90) => clip(slackPlain(t).split('\n').map((l) => l.trim()).find(Boolean) || '', n)

const hhmm = (t: number) => new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

// Thread replies older than this read as "replies as of HH:MM".
const REPLIES_STALE_SECS = 3600

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// "replies · last 16:54" (an older day adds its date): when the thread of a dispatched fix last moved.
function LastReply({ ts }: { ts?: string }) {
  const t = Number(ts || 0)
  if (!t) return null
  return <span data-testid="last-reply"> · replies · last {hm(t)}</span>
}

// What a row shows once its fix went out: from `/needs` (`dispatch`, with the live
// session state) or, until the next refresh, from the dispatch reply itself.
type RowSent = {
  session_key: string
  title: string
  // Members of a batch dispatch; 0 for a single fix.
  batch: number
  state: FixDispatch['state'] | ''
  pr_url: string
  pr_number: number
  // Client mode: the chat launcher opened the conductor chat; there is no session to track.
  launched?: boolean
  // False: the session is not on the crew's grant and asks for each tool.
  trusted?: boolean
  pr_state?: PrState | null
  pr_urls?: string[]
}

// The PR a fix row links: its own, else the batch's first unmatched one.
function prOf(d: { pr_url: string; pr_number: number; pr_urls?: string[] }): { url: string; n: number } {
  if (d.pr_url) return { url: d.pr_url, n: d.pr_number }
  const url = d.pr_urls?.[0] || ''
  const m = /\/pull\/(\d+)/.exec(url)
  return { url, n: m ? Number(m[1]) : 0 }
}

function sentOf(e: NeedEntry, local?: RowSent): RowSent | null {
  const d = e.dispatch
  if (d) {
    return {
      session_key: d.session_key, title: d.title, batch: d.batch ? d.batch_keys?.length || 0 : 0,
      state: d.state, pr_url: d.pr_url, pr_number: d.pr_number, trusted: d.trusted,
      pr_state: d.pr_state, pr_urls: d.pr_urls,
    }
  }
  return local || null
}

// The row's fix, read-only, for the ▾ preview: what one click on Dispatch fix sends.
type RowFix = { title: string; prompt: string; repo: string }

// One Needs-you row: priority, what the message is, who/why and when, ONE button naming
// the next step. A reply row shows the ORIGINAL message's first line and "Reply ready";
// the draft and Send to thread live in the detail view. A click on the row opens it.
// A fix row dispatches on one click of Dispatch fix and keeps the result on the row:
// `Dispatched · <session> · <state>`, Open session and the PR once there is one. Its ▾
// shows the fix title and task, and, when it can go in a batch, Exclude from batch.
function NeedRow({
  e,
  groupId,
  first,
  onOpen,
  onMark,
  onDispatch,
  busy,
  fix,
  sentHere,
  failed,
  excluded,
  onExclude,
  investigator,
  investigate,
  ask,
}: {
  e: NeedEntry
  groupId: NeedGroup['id']
  first: boolean
  onOpen: () => void
  onMark: (how: HandleHow) => void
  onDispatch?: () => void
  busy?: boolean
  fix?: RowFix
  sentHere?: RowSent
  failed?: string
  excluded?: boolean
  onExclude?: (on: boolean) => void
  investigator?: NowRow
  investigate?: InvestigateCtl
  ask?: ReanalyzeCtl
}) {
  const sent = groupId === 'decide' ? sentOf(e, sentHere) : null
  const primary = primaryOf(groupId, e, !!sent)
  const reply = isReplyRow(groupId, e)
  const [open, setOpen] = useState(false)
  const previewId = `sr-fix-${e.key.replace(/[^A-Za-z0-9]/g, '-')}`
  const rowId = `${groupId}:${e.key}`
  const keys = rowKeys(e)
  const running = investigationRunning(e, investigator)
  const investigating = primary === 'Investigate' && (running || !!investigate?.busy.has(rowId) || !!investigate?.asked.has(rowId))
  // "Lead thinking…" from this row's own ask until the Lead records the item.
  const thinking = primary === 'Ask lead' && (!!e.reanalyze_in_flight || (!!ask?.inFlight && ask?.lastFrom === rowId))
  const invFailed = investigate?.failed?.from === rowId ? investigate.failed : null
  const askFailed = ask?.failed?.from === rowId ? ask.failed : null
  const links = e.links || []
  const onPrimary = () => {
    if (primary === 'Dispatch fix') onDispatch?.()
    else if (primary === 'Done') onMark('done')
    else if (primary === 'Reply' && e.permalink) window.open(e.permalink, '_blank', 'noopener,noreferrer')
    else if (primary === 'Investigate') investigate?.run(keys, rowId)
    else if (primary === 'Ask lead') ask?.run(keys.slice(0, REANALYZE_MAX_KEYS), rowId)
    else onOpen()
  }
  const primaryLabel = investigating ? 'Investigating…' : thinking ? 'Lead thinking…' : primary
  const primaryOff = busy || investigating || (primary === 'Ask lead' && (thinking || !!ask?.busy || !!ask?.inFlight))
  const merged = sent?.pr_state?.state === 'merged'
  const state = sent && !merged ? FIX_STATE[sent.state] || '' : ''
  const pr = sent ? (merged ? prOf(sent) : { url: sent.pr_url, n: sent.pr_number }) : { url: '', n: 0 }
  return (
    <li
      className="text-sm"
      data-testid="need-row"
      data-priority={e.priority || ''}
      data-age-hours={e.age_hours}
      data-stale={e.reply_draft_stale ? '1' : '0'}
      style={{ padding: '8px 0', borderTop: first ? 0 : '1px solid var(--border)' }}
    >
      <div className="flex items-start gap-2">
        <div style={{ flex: 'none', minWidth: 28 }}>{priorityBadge(e.priority)}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <button
            type="button"
            data-testid="need-open"
            onClick={onOpen}
            title="Open the message and its thread"
            style={{ border: 0, background: 'transparent', padding: 0, margin: 0, textAlign: 'left', cursor: 'pointer', width: '100%', color: 'inherit', font: 'inherit' }}
          >
            {reply ? (
              <>
                <div style={{ color: 'var(--text-strong)' }}>
                  <span data-testid="reply-ready"><Badge variant="aim">Reply ready</Badge></span>{' '}
                  {e.reply_draft_stale && (
                    <>
                      <span data-testid="draft-stale">
                        <Badge variant="warn">{plural(e.reply_draft_stale.new_replies, 'new reply', 'new replies')} since draft</Badge>
                      </span>{' '}
                    </>
                  )}
                  <span data-testid="need-first-line">{firstLine(e.text || e.summary) || '(no text)'}</span>
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                  {e.user || 'someone'} · <span data-testid="need-age">{fmtAge(e.age_hours)}</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ color: 'var(--text-strong)' }}>{e.summary || '(no text)'}</div>
                <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                  {e.reason} · <span data-testid="need-age">{fmtAge(e.age_hours)}</span>
                </div>
              </>
            )}
          </button>
          {running && (
            <div className="text-xs" role="status" style={{ marginTop: 2 }} data-testid="row-investigating">
              <span style={{ color: 'var(--text-strong)' }}>Investigator</span> · running · since {hm(e.investigation_at || investigator?.since)}
            </div>
          )}
          {!running && !sent && (e.links_count || 0) > 0 && (
            <div className="text-xs" role="status" style={{ marginTop: 2 }} data-testid="row-investigated">
              <span style={{ color: 'var(--text-strong)' }}>Investigated</span> · {plural(e.links_count || 0, 'link', 'links')}
            </div>
          )}
          {invFailed && (
            <ErrorNotice message={invFailed.why} onRetry={() => investigate?.run(invFailed.keys, rowId)} />
          )}
          {askFailed && <ErrorNotice message={askFailed.why} onRetry={() => ask?.run(askFailed.keys, rowId)} />}
          {sent && (
            <div className="text-xs" role="status" style={{ marginTop: 2 }} data-testid="fix-dispatched">
              <span style={{ color: 'var(--text-strong)' }}>Dispatched</span>
              {' · '}
              {sent.launched ? 'opened in a new conductor chat' : sent.batch ? `batch of ${sent.batch}` : sent.title || 'Fix session'}
              {state && <> · {state}</>}
              {merged && pr.url && (
                <>
                  {' · '}
                  <span data-testid="fix-pr-merged">
                    <a className="underline" href={pr.url} target="_blank" rel="noreferrer noopener">
                      PR #{pr.n}
                    </a>{' '}
                    merged <span aria-hidden>✓</span>
                  </span>
                </>
              )}
              {sent.session_key && (
                <>
                  {' · '}
                  <SessionLink d={sent} label="Open session" />
                </>
              )}
              {!merged && pr.url && (
                <>
                  {' · '}
                  <a className="underline" href={pr.url} target="_blank" rel="noreferrer noopener">
                    PR #{pr.n}
                  </a>
                  <PrStateText ps={sent.pr_state} />
                </>
              )}
              <LastReply ts={e.latest_reply} />
            </div>
          )}
          {sent && sent.trusted === false && (sent.state === 'running' || sent.state === 'idle') && (
            <div className="text-xs text-muted" data-testid="fix-untrusted">
              Will ask you for each tool: unattended mode is off.
            </div>
          )}
          {failed && !sent && (
            <ErrorNotice message={`Could not dispatch that fix: ${failed}. Nothing was sent.`} onRetry={() => onDispatch?.()} />
          )}
          {!fix && open && (
            <div
              id={previewId}
              data-testid="row-preview"
              className="text-xs"
              style={{ marginTop: 6, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6 }}
            >
              {links.length > 0 ? (
                <ul data-testid="row-links" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {links.map((u) => (
                    <li key={u} style={{ overflowWrap: 'anywhere' }}>
                      <a className="underline" href={u} target="_blank" rel="noreferrer noopener">{u.replace(/^https:\/\/github\.com\//, '')}</a>
                    </li>
                  ))}
                  {(e.links_count || 0) > links.length && <li className="text-muted">and {(e.links_count || 0) - links.length} more</li>}
                </ul>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 160, overflowY: 'auto' }}>
                  {e.category && <span className="text-muted">{e.category} · </span>}
                  {clip(slackPlain(e.text || e.summary), 400) || '(no text)'}
                </div>
              )}
            </div>
          )}
          {fix && open && (
            <div
              id={previewId}
              data-testid="fix-preview"
              className="text-xs"
              style={{ marginTop: 6, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6 }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>
                {fix.title} {fix.repo && <span className="text-muted font-mono" style={{ fontWeight: 400 }}>{fix.repo}</span>}
              </div>
              <pre
                aria-label="Fix task"
                style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 160, overflowY: 'auto', fontFamily: 'var(--font-mono, monospace)' }}
              >
                {fix.prompt}
              </pre>
              {onExclude && (
                <label className="flex items-center gap-1" style={{ marginTop: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!excluded} onChange={(ev) => onExclude(ev.target.checked)} />
                  Exclude from batch
                </label>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1" style={{ flex: 'none' }} data-testid="need-actions">
          {primary && (
            <Btn primary style={small} onClick={onPrimary} disabled={primaryOff} data-primary={primary}>
              {(primary === 'Dispatch fix' && busy) || investigating || thinking ? (
                <>
                  <span className="sr-spin" aria-hidden />
                  {primary === 'Dispatch fix' ? 'Dispatching…' : primaryLabel}
                </>
              ) : (
                primary
              )}
            </Btn>
          )}
        </div>
        <button
            type="button"
            data-testid={fix ? 'fix-toggle' : 'row-toggle'}
            aria-expanded={open}
            aria-controls={previewId}
            aria-label={fix ? (open ? 'Hide the fix' : 'Show the fix') : links.length ? (open ? 'Hide the links' : 'Show the links') : open ? 'Hide the message' : 'Show the message'}
            onClick={() => setOpen(!open)}
            style={{ flex: 'none', border: 0, background: 'transparent', cursor: 'pointer', padding: '2px 4px', color: 'var(--muted)' }}
          >
            {open ? '▴' : '▾'}
        </button>
      </div>
    </li>
  )
}

type SendResult = { ok: true; link: string } | { ok: false; why: string }

// The detail view of one Needs-you row, a dialog inside the Board: the original message
// in full, the thread replies so far (oldest first), then the Lead's draft for a reply
// row with Send to thread. Sending is this one click; nothing here sends on its own.
function NeedDetail({
  e,
  groupId,
  onClose,
  onSend,
  onMark,
  onWhy,
  onDispatch,
  busy,
  sentHere,
  reanalyze,
}: {
  e: NeedEntry
  groupId: NeedGroup['id']
  sentHere?: boolean
  reanalyze?: ReanalyzeCtl
  onClose: () => void
  onSend: (text: string, edited: boolean) => Promise<SendResult>
  onMark: (how: HandleHow) => void
  onWhy: () => void
  onDispatch?: () => void
  busy?: boolean
}) {
  const reply = isReplyRow(groupId, e)
  const primary = primaryOf(groupId, e, sentHere)
  const [text, setText] = useState(e.reply_draft || '')
  const [sending, setSending] = useState(false)
  const [sentLink, setSentLink] = useState<string | null>(null)
  const [failed, setFailed] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLTextAreaElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const safe = e.key.replace(/[^A-Za-z0-9]/g, '-')
  const headId = `sr-detail-${safe}`
  const boxId = `sr-reply-${safe}`
  const replies = e.replies || []
  const draftAt = e.reply_draft_at || 0
  const isNew = (r: ThreadReply) => !!e.reply_draft && draftAt > 0 && Number(r.ts) > draftAt
  const newCount = e.reply_draft_stale?.new_replies || 0
  const checked = e.last_thread_check_at || 0
  const stale = checked > 0 && Date.now() / 1000 - checked > REPLIES_STALE_SECS

  // Focus moves into the dialog and back to what opened it.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    window.requestAnimationFrame(() => (reply ? boxRef.current : closeRef.current)?.focus())
    return () => {
      if (opener && opener.isConnected) opener.focus()
    }
  }, [])

  const send = async () => {
    const t = text.trim()
    setFailed('')
    setSending(true)
    const r = await onSend(t, t !== (e.reply_draft || '').trim())
    setSending(false)
    if (r.ok) setSentLink(r.link)
    else setFailed(r.why)
  }

  const onKeyDown = (ev: ReactKeyboardEvent) => {
    if (ev.key === 'Escape') {
      ev.stopPropagation()
      onClose()
      return
    }
    if (ev.key !== 'Tab' || !dialogRef.current) return
    const nodes = [...dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, select')]
    if (nodes.length === 0) return
    const firstNode = nodes[0]
    const lastNode = nodes[nodes.length - 1]
    if (ev.shiftKey && document.activeElement === firstNode) {
      ev.preventDefault()
      lastNode.focus()
    } else if (!ev.shiftKey && document.activeElement === lastNode) {
      ev.preventDefault()
      firstNode.focus()
    }
  }

  const act = (fn: () => void) => () => {
    fn()
    onClose()
  }
  const section: CSSProperties = { marginTop: 14 }
  const h4: CSSProperties = { margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }
  return (
    <div
      data-testid="need-detail-backdrop"
      onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.35)', display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headId}
        data-testid="need-detail"
        onKeyDown={onKeyDown}
        className="text-sm"
        style={{
          width: 'min(560px, 100%)', height: '100%', overflowY: 'auto', padding: '16px 20px',
          background: 'var(--card, var(--bg))', color: 'var(--text)', borderLeft: '1px solid var(--border)',
        }}
      >
        <div className="flex items-start gap-2">
          <div style={{ flex: 'none' }}>{priorityBadge(e.priority)}</div>
          <h3 id={headId} style={{ margin: 0, flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--text-strong)' }}>
            {firstLine(e.text || e.summary, 80) || '(no text)'}
          </h3>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: '0 6px', fontSize: 18, lineHeight: 1, color: 'var(--muted)' }}
          >
            ×
          </button>
        </div>

        <section aria-label="Original message" data-testid="detail-original" style={section}>
          <h4 style={h4}>Original message</h4>
          <div className="text-xs text-muted">
            <span data-testid="detail-author">{e.user || 'someone'}</span>
            {' · '}
            <span className="font-mono">{e.channel}</span>
            {' · '}
            {fmtTime(e.ts_float)}
            {e.permalink && (
              <>
                {' · '}
                <a className="underline" href={e.permalink} target="_blank" rel="noreferrer noopener">
                  Open in Slack
                </a>
              </>
            )}
          </div>
          <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} data-testid="detail-text">
            {slackPlain(e.text || e.summary) || '(no text)'}
          </p>
        </section>

        <section aria-label="Thread replies" data-testid="detail-replies" style={section}>
          <h4 style={h4}>
            Thread replies ({replies.length})
            {stale && (
              <span className="text-xs text-muted" style={{ fontWeight: 400 }} data-testid="replies-stale">
                {' · '}replies as of {hhmm(checked)}
              </span>
            )}
          </h4>
          {replies.length === 0 ? (
            <p className="text-xs text-muted" style={{ margin: 0 }}>No replies yet</p>
          ) : (
            <ol className="flex flex-col" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {replies.map((r, i) => (
                <li
                  key={`${r.ts}-${i}`}
                  data-testid={isNew(r) ? 'reply-new' : 'reply-old'}
                  style={{
                    padding: isNew(r) ? '4px 0 4px 8px' : '4px 0',
                    borderTop: i === 0 ? 0 : '1px solid var(--border)',
                    ...(isNew(r) ? { borderLeft: '3px solid var(--warn, #d97706)' } : {}),
                  }}
                >
                  <div className="text-xs text-muted">
                    {isNew(r) && (
                      <>
                        <Badge variant="warn">new</Badge>{' '}
                      </>
                    )}
                    {r.user || 'someone'} · {fmtTime(Number(r.ts))}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{slackPlain(r.text)}</div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {!reply && (
          <section aria-label="Why it is here" style={section} className="text-xs text-muted">
            {e.reason}
            {e.category && <> · {e.category}</>}
            {e.words && e.words.length > 0 && <> · shared words: {e.words.join(', ')}</>}
            {e.members && e.members.length > 0 && <> · Done and Ignore apply to all {e.members.length}</>}
            {e.handoff_title && !e.dispatch && !sentHere && <div style={{ marginTop: 4, color: 'var(--text)' }}>Fix: {e.handoff_title}</div>}
          </section>
        )}

        {reply && (
          <section aria-label="Reply draft" data-testid="detail-draft" style={section}>
            <label htmlFor={boxId} style={{ ...h4, display: 'block' }}>
              Reply to the thread, sent as you
            </label>
            <div className="text-xs text-muted" data-testid="draft-by">
              {e.reply_draft_by === 'owner' ? 'Edited by you' : 'Drafted by the Radar Lead'}
              {e.reply_draft_at ? ` · ${ago(e.reply_draft_at)}` : ''}
            </div>
            <textarea
              id={boxId}
              ref={boxRef}
              value={text}
              maxLength={1500}
              rows={6}
              readOnly={sentLink !== null}
              onChange={(ev) => setText(ev.target.value)}
              style={{
                width: '100%', marginTop: 4, fontSize: 13, padding: '6px 8px', borderRadius: 6, resize: 'vertical',
                border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)',
              }}
            />
          </section>
        )}

        {failed && <ErrorNotice message={`Could not send that reply: ${failed}`} onRetry={send} />}

        {reply && newCount > 0 && sentLink === null && (
          <p role="status" data-testid="draft-stale-warning" className="text-sm" style={{ ...section, marginBottom: 0, color: 'var(--text-strong)' }}>
            {newCount === 1 ? '1 reply arrived after this draft — read it first' : `${newCount} replies arrived after this draft — read them first`}
          </p>
        )}
        {e.needs_reanalysis && reanalyze && sentLink === null && (
          <div style={section} data-testid="detail-reanalyze">
            <Btn style={small} disabled={reanalyze.busy || reanalyze.inFlight} onClick={() => reanalyze.run([e.key], e.key)}>
              {reanalyze.inFlight || reanalyze.busy ? 'Re-analyzing…' : 'Re-analyze this'}
            </Btn>
            {reanalyze.failed && reanalyze.failed.from === e.key && (
              <ErrorNotice message={reanalyze.failed.why} onRetry={() => reanalyze.run(reanalyze.failed!.keys, e.key)} />
            )}
          </div>
        )}

        {sentLink !== null ? (
          <div style={section} className="flex flex-wrap items-center gap-2">
            <p role="status" style={{ margin: 0, flex: 1 }}>
              Sent as you
              {sentLink && (
                <>
                  {' · '}
                  <a className="underline" href={sentLink} target="_blank" rel="noreferrer noopener" data-testid="sent-link">
                    Open the reply in Slack
                  </a>
                </>
              )}
            </p>
            <Btn primary style={small} onClick={onClose}>Close</Btn>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1" style={section} data-testid="detail-actions">
            {reply && (
              <Btn primary style={small} disabled={!text.trim() || sending} onClick={send}>
                {sending ? 'Sending…' : 'Send to thread'}
              </Btn>
            )}
            {primary === 'Dispatch fix' && (
              <Btn primary style={small} disabled={busy} onClick={act(() => onDispatch?.())}>Dispatch fix</Btn>
            )}
            {primary === 'Reply' && e.permalink && (
              <Btn primary style={small} onClick={() => window.open(e.permalink, '_blank', 'noopener,noreferrer')}>Reply</Btn>
            )}
            <Btn style={small} onClick={act(() => onMark('done'))}>{reply ? 'Done without sending' : 'Done'}</Btn>
            <Btn style={small} onClick={act(() => onMark('ignored'))}>Ignore</Btn>
            <Btn style={small} onClick={act(onWhy)}>Why? Ask the lead</Btn>
          </div>
        )}
        {primary === 'Reply' && sentLink === null && (
          <p className="text-xs text-muted" style={{ margin: '6px 0 0' }}>Reply opens the thread in Slack.</p>
        )}
      </div>
    </div>
  )
}

// One Needs-you group: the first ROWS_SHOWN rows, then "Show N more".
function NeedGroupList({ g, render }: { g: NeedGroup & { shown: NeedEntry[] }; render: (e: NeedEntry, i: number) => ReactNode }) {
  const [all, setAll] = useState(false)
  const rows = all ? g.shown : g.shown.slice(0, ROWS_SHOWN)
  const hidden = g.shown.length - rows.length
  return (
    <>
      <ul className="flex flex-col">{rows.map(render)}</ul>
      {(hidden > 0 || (all && g.shown.length > ROWS_SHOWN)) && (
        <button
          type="button"
          className="text-xs underline"
          onClick={() => setAll(!all)}
          style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: '4px 0', color: 'var(--muted)' }}
        >
          {all ? 'Show fewer' : `Show ${hidden} more`}
        </button>
      )}
    </>
  )
}

type LaunchOpts = { message?: string; autoSend?: boolean; agent?: string; slotKey?: string }
type Launcher = { openChat: (opts: LaunchOpts) => void }
// `useChatLauncher` is read off the SDK namespace so an older host without it still loads the app.
const useLauncher: () => Launcher | null =
  typeof (sdk as { useChatLauncher?: unknown }).useChatLauncher === 'function'
    ? (sdk as unknown as { useChatLauncher: () => Launcher }).useChatLauncher
    : () => null

const FIX_STATE: Record<string, string> = { running: 'working', idle: 'idle', closed: 'done', unknown: '' }

// After a PR link: " open", " draft" or " closed, not merged"; nothing before the gateway read it.
const PR_STATE_TEXT: Record<string, string> = { open: 'open', draft: 'draft', closed: 'closed, not merged' }
function PrStateText({ ps }: { ps?: PrState | null }) {
  const t = ps ? PR_STATE_TEXT[ps.state] : ''
  return t ? <span data-testid="fix-pr-state"> {t}</span> : null
}

// A link to a dispatched session. Inside the dashboard it opens the session in place.
function SessionLink({ d, label }: { d: { session_key: string; title: string }; label?: string }) {
  const launcher = useLauncher()
  const href = `/chat?sid=${encodeURIComponent(d.session_key)}`
  return (
    <a
      className="underline"
      href={href}
      onClick={(ev) => {
        if (!launcher) return
        ev.preventDefault()
        launcher.openChat({ slotKey: d.session_key })
      }}
    >
      {label || d.title || 'Fix session'}
    </a>
  )
}

type DispatchReply =
  | { ok: true; mode: 'server'; session_key: string; title: string; trusted?: boolean }
  | { ok: true; mode: 'client'; agent: string; title: string; seed: string }

function errorBody(err: unknown): { code?: string; error?: string; session_key?: string; title?: string } {
  try {
    return JSON.parse(String((err as { body?: string }).body || '{}'))
  } catch {
    return {}
  }
}

// Dispatch fix: ONE click is the owner's consent. The server opens a kirocrew-conductor
// session with the hand-off and its Slack context and sends it; the row then shows it.
// When the gateway cannot create sessions for the app, the seed comes back and the
// SDK launcher sends it in a new conductor chat; with no launcher, a copy dialog.
function useDispatchFix(onChanged: () => void): {
  dispatch: (key: string) => void
  dispatchBatch: (keys: string[]) => void
  busy: Set<string>
  sent: Record<string, RowSent>
  failed: Record<string, string>
  batchFailed: { keys: string[]; why: string } | null
  ui: ReactNode
} {
  const api = useAppApi()
  const launcher = useLauncher()
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [sent, setSent] = useState<Record<string, RowSent>>({})
  const [failed, setFailed] = useState<Record<string, string>>({})
  const [batchFailed, setBatchFailed] = useState<{ keys: string[]; why: string } | null>(null)
  const [shown, setShown] = useState<{ title: string; seed: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const record = (keys: string[], row: RowSent) =>
    setSent((prev) => Object.fromEntries([...Object.entries(prev), ...keys.map((k) => [k, row] as const)]))
  const fail = (keys: string[], why: string) =>
    setFailed((prev) => Object.fromEntries([...Object.entries(prev), ...keys.map((k) => [k, why] as const)]))
  const clearFailed = (keys: string[]) =>
    setFailed((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !keys.includes(k))))
  const client = (r: { agent: string; title: string; seed: string }, keys: string[], batch: number) => {
    if (launcher) {
      launcher.openChat({ agent: r.agent, message: r.seed, autoSend: true })
      record(keys, { session_key: '', title: r.title, batch, state: '', pr_url: '', pr_number: 0, launched: true })
    } else {
      setCopied(false)
      setShown({ title: r.title, seed: r.seed })
    }
  }
  const run = async (keys: string[], go: () => Promise<void>) => {
    if (busy.size || keys.length === 0) return
    setBusy(new Set(keys))
    try {
      await go()
    } finally {
      setBusy(new Set())
    }
  }
  const dispatch = (key: string) =>
    run([key], async () => {
      clearFailed([key])
      try {
        const r = await api.post<DispatchReply>(`${BASE}/items/handoff/dispatch`, { key })
        if (r.mode === 'server') record([key], { session_key: r.session_key, title: r.title, batch: 0, state: 'running', pr_url: '', pr_number: 0, trusted: r.trusted })
        else client(r, [key], 0)
        onChanged()
      } catch (err) {
        const b = errorBody(err)
        if (b.code === 'already_dispatched' && b.session_key) {
          record([key], { session_key: b.session_key, title: b.title || '', batch: 0, state: '', pr_url: '', pr_number: 0 })
        } else fail([key], b.error || 'the gateway refused it')
      }
    })
  // Batch: one click on the group header is the owner's consent for every fix it names.
  // ONE conductor session gets them all.
  const dispatchBatch = (keys: string[]) =>
    run(keys, async () => {
      setBatchFailed(null)
      try {
        const r = await api.post<DispatchReply>(`${BASE}/items/handoff/dispatch-batch`, { keys })
        if (r.mode === 'server') {
          record(keys, { session_key: r.session_key, title: r.title, batch: keys.length, state: 'running', pr_url: '', pr_number: 0, trusted: r.trusted })
        } else client(r, keys, keys.length)
        onChanged()
      } catch (err) {
        const b = errorBody(err) as { error?: string; dispatched?: { key: string }[] }
        const why = b.dispatched?.length
          ? `${b.dispatched.length} of them already have a session`
          : b.error || 'the gateway refused it'
        setBatchFailed({ keys, why })
      }
    })
  const copy = async () => {
    if (!shown) return
    try {
      await navigator.clipboard.writeText(shown.seed)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  const ui = shown && (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sr-fix-title"
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onKeyDown={(ev) => ev.key === 'Escape' && setShown(null)}
    >
      <div style={{ width: 'min(720px, 92vw)', background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: 16 }}>
        <h3 id="sr-fix-title" className="text-sm" style={{ margin: '0 0 6px', fontWeight: 600 }}>{shown.title}</h3>
        <p className="text-xs text-muted" style={{ margin: '0 0 8px' }}>
          This Kiro Crew cannot open the session for you. Copy this task into a new kirocrew-conductor chat.
        </p>
        <textarea
          readOnly
          aria-label="Fix task"
          value={shown.seed}
          style={{ width: '100%', height: 260, fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}
        />
        <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
          <Btn onClick={copy}>{copied ? 'Copied' : 'Copy task'}</Btn>
          <a className="underline text-sm" href="/chat?new=1">New chat</a>
          <div className="flex-1" />
          <Btn onClick={() => setShown(null)}>Close</Btn>
        </div>
      </div>
    </div>
  )
  return { dispatch, dispatchBatch, busy, sent, failed, batchFailed, ui }
}

// Fixes one batch may carry (backend/handoff.py `MAX_BATCH`).
const MAX_BATCH = 10

// Re-analyze: ONE click hands the Radar Lead the named items for one turn, in which it
// rewrites or withdraws each draft against the thread. It is the only way a draft
// changes after the Lead's first look; nothing runs it on a timer.
type ReanalyzeCtl = {
  run: (keys: string[], from: string) => void
  busy: boolean
  inFlight: boolean
  // Where the last request that went through came from ('card', a row id, an item key).
  lastFrom: string
  failed: { keys: string[]; from: string; why: string } | null
}

// Items one re-analyze request may name (store.py `REANALYZE_MAX_KEYS`).
const REANALYZE_MAX_KEYS = 20

function useReanalyze(needs: Needs | null, onChanged: () => void): ReanalyzeCtl {
  const api = useAppApi()
  const [busy, setBusy] = useState(false)
  // Sent here, until the next /needs says whether it is still in flight.
  const [asked, setAsked] = useState(false)
  const [failed, setFailed] = useState<ReanalyzeCtl['failed']>(null)
  const [lastFrom, setLastFrom] = useState('')
  useEffect(() => setAsked(false), [needs])
  const run = async (keys: string[], from: string) => {
    if (busy || keys.length === 0) return
    setFailed(null)
    setBusy(true)
    setLastFrom(from)
    try {
      await api.post(`${BASE}/items/reanalyze`, { keys })
      setAsked(true)
      onChanged()
    } catch (err) {
      const b = errorBody(err)
      const why = b.code === 'reanalyze_in_flight'
        ? 'The Radar Lead is still re-analyzing the last request. Nothing new was sent.'
        : `Could not ask the Radar Lead to re-analyze: ${b.error || 'the gateway refused it'}. Nothing was sent.`
      setFailed({ keys, from, why })
    } finally {
      setBusy(false)
    }
  }
  return { run, busy, inFlight: asked || !!needs?.reanalyze?.in_flight, lastFrom, failed }
}

// Investigate from a row: ONE click starts the read-only Investigator on the row's items,
// through the same `POST /investigate` the Ledger tab uses. The row says "Investigating…"
// until `/needs` shows the run, then follows it from `/now`.
type InvestigateCtl = {
  run: (keys: string[], from: string) => void
  busy: Set<string>
  // Rows whose request went through, until the next /needs shows the run.
  asked: Set<string>
  failed: { keys: string[]; from: string; why: string } | null
}

function useInvestigate(needs: Needs | null, onChanged: () => void): InvestigateCtl {
  const api = useAppApi()
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [asked, setAsked] = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState<InvestigateCtl['failed']>(null)
  useEffect(() => setAsked(new Set()), [needs])
  const run = async (keys: string[], from: string) => {
    if (busy.has(from) || keys.length === 0) return
    setFailed(null)
    setBusy((prev) => new Set(prev).add(from))
    try {
      await api.post(`${BASE}/investigate`, { keys: keys.slice(0, 10), repo: '' })
      setAsked((prev) => new Set(prev).add(from))
      onChanged()
    } catch (err) {
      const b = errorBody(err)
      const why = b.code === 'unattended_required'
        ? 'Investigate needs unattended mode: turn it on on the Crew card (Team tab), then try again. Nothing was started.'
        : `Could not start the Investigator: ${b.error || (err as Error).message || 'the gateway refused it'}. Nothing was started.`
      setFailed({ keys, from, why })
    } finally {
      setBusy((prev) => {
        const next = new Set(prev)
        next.delete(from)
        return next
      })
    }
  }
  return { run, busy, asked, failed }
}

function NeedsCard({
  needs,
  handled,
  onChanged,
  onWhy,
  investigator,
}: {
  needs: Needs | null
  handled: Item[]
  onChanged: () => void
  onWhy: (e: NeedEntry) => void
  investigator?: NowRow
}) {
  const api = useAppApi()
  const fixer = useDispatchFix(onChanged)
  const reanalyze = useReanalyze(needs, onChanged)
  const investigate = useInvestigate(needs, onChanged)
  const ra = needs?.reanalyze
  const raLabel = !ra ? '' : ra.total > ra.keys.length ? `Re-analyze ${ra.keys.length} of ${ra.total} stale` : `Re-analyze ${ra.total} stale`
  const fixes = needs?.fixes || []
  const batches = needs?.fix_batches || []
  const batchOf = new Map(batches.map((b) => [b.session_key, b]))
  // Hand-offs the owner can send together: undispatched rows in "decide".
  const prompts = new Map((needs?.handoffs || []).map((h) => [h.key, h.handoff]))
  const fixOf = (e: NeedEntry): RowFix | undefined => {
    const h = prompts.get(e.key)
    return e.handoff_title ? { title: e.handoff_title || h?.title || '', prompt: h?.prompt || '', repo: h?.repo || '' } : undefined
  }
  const batchable = ((needs?.groups || []).find((g) => g.id === 'decide')?.entries || [])
    .filter((e) => e.handoff_title && !e.dispatch && !fixer.sent[e.key] && prompts.has(e.key))
    .map((e) => ({ key: e.key, repo: prompts.get(e.key)!.repo || '' }))
  // Rows the owner left out of "Dispatch all fixes" from their ▾.
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const chosen = batchable.filter((r) => !excluded.has(r.key))
  const mixed = new Set(chosen.map((r) => r.repo.toLowerCase())).size > 1
  const batchBlock = mixed ? 'one repo per batch: exclude the others from their ▾'
    : chosen.length > MAX_BATCH ? `at most ${MAX_BATCH} per batch: exclude some from their ▾` : ''
  // The row whose detail view is open, kept whole so it stays open while the list refreshes.
  const [detail, setDetail] = useState<{ e: NeedEntry; groupId: NeedGroup['id'] } | null>(null)
  const sendReply = async (key: string, text: string, edited: boolean, rowId: string): Promise<SendResult> => {
    try {
      if (edited) await api.post(`${BASE}/items/reply/draft`, { key, text })
      const r = await api.post<{ item?: { replied?: { permalink?: string } } }>(`${BASE}/items/reply/send`, { key })
      setGone((prev) => new Set(prev).add(rowId))
      onChanged()
      return { ok: true, link: String(r?.item?.replied?.permalink || '') }
    } catch (err) {
      return { ok: false, why: (err as Error).message || 'unknown error' }
    }
  }
  const replied = needs?.replied || []
  const [dismissFailed, setDismissFailed] = useState('')
  const dismiss = async (key: string) => {
    setDismissFailed('')
    try {
      await api.post(`${BASE}/items/handoff/dismiss`, { key })
      onChanged()
    } catch {
      setDismissFailed(key)
    }
  }
  // Rows marked here leave the list at once; a failed save puts them back.
  const [gone, setGone] = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState<{ keys: string[]; how: HandleHow; rowId?: string } | null>(null)
  useEffect(() => setGone(new Set()), [needs])

  const post = async (keys: string[], how: HandleHow, rowId?: string) => {
    setFailed(null)
    if (rowId) setGone((prev) => new Set(prev).add(rowId))
    try {
      for (const key of keys) await api.post(`${BASE}/items/handle`, { key, how })
      onChanged()
    } catch {
      if (rowId) {
        setGone((prev) => {
          const next = new Set(prev)
          next.delete(rowId)
          return next
        })
      }
      setFailed({ keys, how, rowId })
    }
  }
  const groups = (needs?.groups || []).map((g) => ({
    ...g,
    shown: g.entries.filter((e) => !gone.has(`${g.id}:${e.key}`)),
  }))
  const empty = groups.every((g) => g.shown.length === 0)
  const verb = failed?.how === 'reopen' ? 'reopen' : failed?.how === 'ignored' ? 'ignore' : 'mark as done'
  return (
    <Card className="mb-4">
      <div className="flex items-center gap-2">
        <CardTitle>Needs you</CardTitle>
        <div className="flex-1" />
        {ra && (ra.total > 0 || reanalyze.inFlight) && (
          <Btn
            primary
            style={small}
            data-testid="reanalyze"
            title="Ask the Radar Lead to re-read these threads and rewrite or withdraw each draft. Nothing is sent to Slack."
            disabled={reanalyze.busy || reanalyze.inFlight || ra.keys.length === 0}
            onClick={() => reanalyze.run(ra.keys, 'card')}
          >
            {reanalyze.busy || reanalyze.inFlight ? (
              <>
                <span className="sr-spin" aria-hidden />
                Re-analyzing…
              </>
            ) : (
              raLabel
            )}
          </Btn>
        )}
      </div>
      {reanalyze.failed && reanalyze.failed.from === 'card' && (
        <ErrorNotice message={reanalyze.failed.why} onRetry={() => reanalyze.run(reanalyze.failed!.keys, 'card')} />
      )}
      {failed && (
        <ErrorNotice
          message={`Could not ${verb} that message. Nothing changed.`}
          onRetry={() => post(failed.keys, failed.how, failed.rowId)}
        />
      )}
      {!needs ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : empty ? (
        <p className="text-sm text-muted">Nothing needs you right now.</p>
      ) : (
        groups.map((g) =>
          g.shown.length === 0 ? null : (
            <section key={g.id} aria-label={GROUP_TITLE[g.id]} style={{ marginTop: 10 }}>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm" style={{ margin: 0, fontWeight: 600, color: 'var(--text-strong)' }}>
                  {GROUP_TITLE[g.id]} <span className="text-muted" style={{ fontWeight: 400 }}>({g.total - (g.entries.length - g.shown.length)})</span>
                </h4>
                <div className="flex-1" />
                {g.id === 'decide' && batchable.length >= 2 && (
                  <>
                    {batchBlock && <span className="text-xs text-muted" role="status">{batchBlock}</span>}
                    <Btn
                      style={small}
                      onClick={() => fixer.dispatchBatch(chosen.map((r) => r.key))}
                      disabled={fixer.busy.size > 0 || chosen.length === 0 || !!batchBlock}
                    >
                      {chosen.length > 0 && fixer.busy.has(chosen[0].key) && fixer.busy.size > 1 ? (
                        <>
                          <span className="sr-spin" aria-hidden />
                          Dispatching…
                        </>
                      ) : (
                        `Dispatch all fixes (${chosen.length})`
                      )}
                    </Btn>
                  </>
                )}
              </div>
              {g.id === 'decide' && fixer.batchFailed && (
                <ErrorNotice
                  message={`Could not dispatch those fixes: ${fixer.batchFailed.why}. Nothing was sent.`}
                  onRetry={() => fixer.dispatchBatch(fixer.batchFailed!.keys)}
                />
              )}
              <NeedGroupList
                g={g}
                render={(e, i) => (
                  <NeedRow
                    key={e.key}
                    e={e}
                    groupId={g.id}
                    first={i === 0}
                    onOpen={() => setDetail({ e, groupId: g.id })}
                    onMark={(how) => post(e.members?.length ? e.members : [e.key], how, `${g.id}:${e.key}`)}
                    onDispatch={g.id === 'decide' && e.handoff_title ? () => fixer.dispatch(e.key) : undefined}
                    busy={fixer.busy.has(e.key)}
                    fix={g.id === 'decide' ? fixOf(e) : undefined}
                    sentHere={fixer.sent[e.key]}
                    failed={g.id === 'decide' ? fixer.failed[e.key] : undefined}
                    excluded={excluded.has(e.key)}
                    investigator={investigator}
                    investigate={investigate}
                    ask={reanalyze}
                    onExclude={
                      g.id === 'decide' && batchable.length >= 2 && batchable.some((r) => r.key === e.key)
                        ? (on) =>
                            setExcluded((prev) => {
                              const next = new Set(prev)
                              if (on) next.add(e.key)
                              else next.delete(e.key)
                              return next
                            })
                        : undefined
                    }
                  />
                )}
              />
            </section>
          ),
        )
      )}
      {dismissFailed && (
        <ErrorNotice message="Could not dismiss that hand-off. Nothing changed." onRetry={() => dismiss(dismissFailed)} />
      )}
      {fixes.length > 0 && (
        <details style={{ marginTop: 12 }} data-testid="fixes-in-flight">
          <summary className="text-sm text-muted" style={{ cursor: 'pointer' }}>
            Fixes in flight ({needs?.fixes_total ?? fixes.length})
          </summary>
          <ul className="flex flex-col" style={{ marginTop: 4 }}>
            {fixes.map((f, i) => {
              const b = f.dispatch.batch ? batchOf.get(f.dispatch.session_key) : undefined
              const head = b && b.keys[0] === f.key
              const line = { padding: '6px 0', borderTop: i === 0 ? 0 : '1px solid var(--border)' }
              const pr = f.dispatch.pr_url && (
                <>
                  {' · '}
                  <a className="underline" href={f.dispatch.pr_url} target="_blank" rel="noreferrer noopener">
                    PR #{f.dispatch.pr_number}
                  </a>
                  <PrStateText ps={f.dispatch.pr_state} />
                </>
              )
              return (
                <li key={f.key} className="text-sm" style={b ? { ...line, ...(head ? {} : { borderTop: 0, paddingTop: 0 }) } : line}>
                  {head && b && (
                    <div data-testid="fix-batch-header" style={{ marginBottom: 4 }}>
                      <SessionLink d={b} />
                      <span className="text-xs text-muted">
                        {' · '}
                        {FIX_STATE[b.state] || b.state || 'sent'}
                        {' · '}
                        <span className="font-mono">{b.repo}</span> · {b.prs_found} PRs found / {b.total} · {ago(b.at)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2" style={b ? { paddingLeft: 16 } : undefined}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {b ? (
                        f.handoff_title
                      ) : (
                        <>
                          <SessionLink d={f.dispatch} />
                          <span className="text-xs text-muted">
                            {' · '}
                            {FIX_STATE[f.dispatch.state] || f.dispatch.state || 'sent'}
                            {' · '}
                            <span className="font-mono">{f.repo}</span> · {ago(f.dispatch.at)}
                          </span>
                        </>
                      )}
                      {pr}
                      <span className="text-xs text-muted"><LastReply ts={f.latest_reply} /></span>
                    </span>
                    <Btn style={small} onClick={() => dismiss(f.key)}>Dismiss</Btn>
                  </div>
                </li>
              )
            })}
          </ul>
        </details>
      )}
      {(needs?.handled_total || 0) > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary className="text-sm text-muted" style={{ cursor: 'pointer' }}>Handled ({needs?.handled_total})</summary>
          <ul className="flex flex-col" style={{ marginTop: 4 }}>
            {handled.map((it, i) => (
              <li
                key={it.key}
                className="text-sm flex items-center gap-2"
                style={{ padding: '6px 0', borderTop: i === 0 ? 0 : '1px solid var(--border)' }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{it.summary || it.text.slice(0, 200)}</span>
                <span className="text-xs text-muted">
                  {it.handled_how === 'ignored' ? 'Ignored' : 'Done'} {ago(it.handled_at)}
                </span>
                <Btn style={small} onClick={() => post([it.key], 'reopen')}>Reopen</Btn>
              </li>
            ))}
          </ul>
        </details>
      )}
      {replied.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary className="text-sm text-muted" style={{ cursor: 'pointer' }}>
            Replied ({needs?.replied_total ?? replied.length})
          </summary>
          <ul className="flex flex-col" style={{ marginTop: 4 }}>
            {replied.map((r, i) => (
              <li
                key={r.key}
                className="text-sm flex items-center gap-2"
                style={{ padding: '6px 0', borderTop: i === 0 ? 0 : '1px solid var(--border)' }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  {r.text.length > 120 ? `${r.text.slice(0, 119)}…` : r.text}
                  <span className="text-xs text-muted">
                    {' · '}
                    {r.summary}
                    {' · '}
                    <span className="font-mono">{r.channel}</span> · {ago(r.at)}
                  </span>
                </span>
                {r.permalink && (
                  <a className="underline text-xs" href={r.permalink} target="_blank" rel="noreferrer noopener">
                    Open reply
                  </a>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {detail && (
        <NeedDetail
          key={`${detail.groupId}:${detail.e.key}`}
          e={detail.e}
          groupId={detail.groupId}
          sentHere={!!fixer.sent[detail.e.key]}
          onClose={() => setDetail(null)}
          onSend={(text, edited) => sendReply(detail.e.key, text, edited, `${detail.groupId}:${detail.e.key}`)}
          onMark={(how) => post(detail.e.members?.length ? detail.e.members : [detail.e.key], how, `${detail.groupId}:${detail.e.key}`)}
          onWhy={() => onWhy(detail.e)}
          onDispatch={detail.groupId === 'decide' && detail.e.handoff_title ? () => fixer.dispatch(detail.e.key) : undefined}
          busy={fixer.busy.has(detail.e.key)}
          reanalyze={reanalyze}
        />
      )}
      {fixer.ui}
    </Card>
  )
}

// At most two tags per row: the status, then one more: "fix merged" / "fix PR closed" once
// the gateway read the dispatched fix's PR as ended, else the priority, else "possibly
// resolved". Everything else goes into the "+N" tag's hover title.
function LedgerRow({ it, first, checked, onToggle }: { it: Item; first: boolean; checked: boolean; onToggle: () => void }) {
  const prState = it.fix_handoff?.pr_state?.state
  const second = prState === 'merged' || prState === 'closed'
    ? { label: prState === 'merged' ? 'fix merged' : 'fix PR closed', variant: (prState === 'merged' ? 'ok' : 'warn') as 'ok' | 'warn' }
    : it.priority
      ? { label: it.priority, variant: (it.priority === 'p0' || it.priority === 'p1' ? 'err' : 'muted') as 'err' | 'muted' }
      : it.possibly_resolved
        ? { label: 'possibly resolved', variant: 'warn' as const }
        : null
  const extra = [
    (prState === 'merged' || prState === 'closed') && it.priority && `priority: ${it.priority}`,
    prState && prState !== 'merged' && prState !== 'closed' && `fix PR: ${prState}`,
    it.category && `category: ${it.category}`,
    it.possibly_resolved && `possibly resolved: ${it.possibly_resolved.reason}`,
  ].filter(Boolean) as string[]
  return (
    <li className="text-sm" style={{ padding: '10px 0', borderTop: first ? 0 : '1px solid var(--border)' }}>
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          aria-label={`Select ${it.key} for investigation`}
          checked={checked}
          onChange={onToggle}
          style={{ marginTop: 4 }}
        />
        <div className="flex items-center gap-1" style={{ flex: 'none' }}>
          <Badge variant={statusVariant(it.status)}>{it.status}</Badge>
          {second && <Badge variant={second.variant}>{second.label}</Badge>}
          {extra.length > 0 && (
            <span className="text-xs text-muted" title={extra.join('\n')} aria-label={extra.join('; ')}>
              +{extra.length}
            </span>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: 'var(--text-strong)' }}>{it.summary || it.text.slice(0, 280)}</div>
          <div className="text-xs text-muted" style={{ marginTop: 2 }}>
            <span data-testid="ledger-ts" data-ts={it.ts_float}>{ago(it.ts_float)}</span>
            {' · '}
            <span className="font-mono">{it.channel}</span>
            {it.user && <> · {it.user}</>}
            {it.reply_count > 0 && <> · {it.reply_count} replies</>}
            {' · '}
            <a className="underline" href={it.permalink} target="_blank" rel="noreferrer noopener">
              open in Slack
            </a>
            {it.links.length > 0 && (
              <>
                {' · linked '}
                {it.links.map((u) => (
                  <a key={u} className="underline mr-2" href={u} target="_blank" rel="noreferrer noopener">
                    {u.replace('https://github.com/', '')}
                  </a>
                ))}
              </>
            )}
          </div>
          {it.note && <p className="text-xs text-muted" style={{ margin: '2px 0 0' }}>{it.note}</p>}
        </div>
      </div>
    </li>
  )
}

// ── Ledger tab ─────────────────────────────────────────────────────────────

// "Needs me": the item waits on the owner (a reply draft, a fix hand-off, or a
// thread that looks resolved).
function needsMe(it: Item): boolean {
  return !!(it.reply_draft?.text || it.fix_handoff?.prompt || it.possibly_resolved)
}

const PRIORITY_FILTERS = ['', 'p0', 'p1', 'p2', 'p3', 'none']

function LedgerTab(props: {
  state: State
  items: Item[]
  filter: string
  setFilter: (f: string) => void
  selected: Set<string>
  setSelected: (s: Set<string>) => void
  busy: string
  onInvestigate: (repo: string) => void
}) {
  const { state, items, selected, setSelected } = props
  const [repo, setRepo] = useState('')
  const [priority, setPriority] = useState('')
  const [category, setCategory] = useState('')
  const [mine, setMine] = useState(false)
  const p = state.counts.open_by_priority
  const categories = useMemo(() => [...new Set(items.map((it) => it.category).filter(Boolean))].sort(), [items])
  const rows = useMemo(
    () =>
      items
        .filter((it) => !priority || (priority === 'none' ? !it.priority : it.priority === priority))
        .filter((it) => !category || it.category === category)
        .filter((it) => !mine || needsMe(it))
        .sort((a, b) => (b.ts_float || 0) - (a.ts_float || 0)),
    [items, priority, category, mine],
  )
  const toggle = (key: string) => {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelected(next)
  }
  const channelRows = useMemo(
    () => state.settings.channels.map((cid) => ({ cid, ...(state.channels[cid] || {}) })),
    [state],
  )
  const select = 'text-sm bg-transparent border rounded px-2 py-1'
  return (
    <div style={{ minWidth: 0 }}>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4">
        <StatCard label="Awaiting triage" value={state.counts.needs_triage} accent />
        <StatCard label="Possibly resolved" value={state.counts.possibly_resolved} />
        <StatCard label="Open p0 / p1" value={`${p.p0 || 0} / ${p.p1 || 0}`} />
        <StatCard label="Tracked items" value={state.counts.total} />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <CardTitle>Ledger</CardTitle>
          <span className="text-xs text-muted" data-testid="ledger-count">
            {rows.length} of {items.length} · newest first
          </span>
          <label className="text-sm text-muted" htmlFor="sr-filter">Status</label>
          <select id="sr-filter" className={select} value={props.filter} onChange={(e) => props.setFilter(e.target.value)}>
            <option value="open">open</option>
            <option value="new">new</option>
            <option value="triaged">triaged</option>
            <option value="investigating">investigating</option>
            <option value="resolved">resolved</option>
            <option value="noise">noise</option>
            <option value="">all</option>
          </select>
          <label className="text-sm text-muted" htmlFor="sr-priority">Priority</label>
          <select id="sr-priority" className={select} value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITY_FILTERS.map((v) => (
              <option key={v} value={v}>{v || 'all'}</option>
            ))}
          </select>
          <label className="text-sm text-muted" htmlFor="sr-category">Category</label>
          <select id="sr-category" className={select} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">all</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label className="text-sm flex items-center gap-1" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
            Needs me
          </label>
          <div className="flex-1" />
          <Input
            aria-label="GitHub repository to search (owner/name, optional)"
            placeholder="owner/repo (optional)"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            className="w-48"
          />
          <Btn onClick={() => props.onInvestigate(repo)} disabled={selected.size === 0 || !!props.busy}>
            Investigate {selected.size || ''}
          </Btn>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={<span aria-hidden>📡</span>}
            title={items.length ? 'Nothing matches these filters' : 'Nothing here yet'}
            subtitle={items.length ? 'Change a filter to see more.' : 'New messages appear after the next poll.'}
          />
        ) : (
          <ul className="flex flex-col" data-testid="ledger-list">
            {rows.map((it, idx) => (
              <LedgerRow key={it.key} it={it} first={idx === 0} checked={selected.has(it.key)} onToggle={() => toggle(it.key)} />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>Channels</CardTitle>
        {channelRows.length === 0 ? (
          <p className="text-sm text-muted">No channels configured.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th scope="col">Channel</th>
                <th scope="col">Last polled</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {channelRows.map((c) => (
                <tr key={c.cid}>
                  <td className="font-mono">{c.cid}</td>
                  <td>{fmtTime(c.last_polled_at)}</td>
                  <td>{c.last_error ? <Badge variant="err" title={c.last_error}>error</Badge> : <Badge variant="ok">ok</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

// ── Board: Today (the Lead's line and the latest digest) ────────────────────

const TOP_ITEMS = 5

/** The digest's item lines (bullets), or its first lines when it has no bullets. */
function digestTop(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const bullets = lines.filter((l) => /^[•\-–]\s/.test(l))
  return (bullets.length ? bullets : lines).slice(0, TOP_ITEMS)
}

function TodayCard({ state, busy, onDigest }: { state: State; busy: string; onDigest: () => void }) {
  const d = state.digest
  const line = state.crew.today
  const top = digestTop(d.last_text || '')
  const where = state.settings.digest_destination === 'self_dm' ? 'DMed to you' : 'dashboard notification'
  return (
    <Card className="mb-4" data-testid="today-card">
      <div className="flex flex-wrap items-center gap-2">
        <CardTitle>Today</CardTitle>
        {d.pending ? <Badge variant="aim">digest being delivered</Badge> : null}
        {d.last_posted_date && (
          <span className="text-xs text-muted" data-testid="digest-time">
            digest {d.last_posted_date} · {where}
          </span>
        )}
        <div className="flex-1" />
        <Btn style={small} onClick={onDigest} disabled={!!busy || !state.crew.live}>Digest now</Btn>
      </div>
      {line?.text && (
        <p style={{ margin: '8px 0 0', fontSize: 15, fontWeight: 600, color: 'var(--text-strong)' }} data-testid="crew-today">
          {line.text}
          {line.at > 0 && <span className="text-xs text-muted" style={{ fontWeight: 400 }}> · {ago(line.at)}</span>}
        </p>
      )}
      {d.last_text ? (
        <>
          <ul className="text-sm flex flex-col gap-1" data-testid="digest-top" style={{ margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
            {top.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          <Details summary="Full digest">
            <pre className="whitespace-pre-wrap text-sm" style={{ fontFamily: 'inherit', margin: 0 }}>
              {d.last_text}
            </pre>
          </Details>
        </>
      ) : (
        <p className="text-sm text-muted" style={{ margin: '8px 0 0' }} data-testid="digest-empty">No digest yet</p>
      )}
      {d.last_error && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{d.last_error}</p>}
    </Card>
  )
}

// ── Board: "Ask the lead" (one line until a conversation starts) ────────────

function RosterStrip({ state }: { state: State }) {
  return (
    <div className="flex items-center gap-2" style={{ marginTop: 10 }}>
      {ROSTER.map((m) => (
        <span key={m.id} title={`${m.title} · ${memberStatus(m, state).label}`}>
          <Avatar m={m} s={state} selected={m.id === 'lead'} size={30} />
          <span className="sr-only">{`${m.title}: ${memberStatus(m, state).label}`}</span>
        </span>
      ))}
    </div>
  )
}

// Open/closed chat, remembered per crew session so a reload keeps an open chat open.
function useChatOpen(slotKey: string): [boolean, (on: boolean) => void] {
  const flag = `slack-radar:chat-open:${slotKey}`
  const read = () => {
    try {
      return window.localStorage.getItem(flag) === '1'
    } catch {
      return false
    }
  }
  const [open, setOpen] = useState(read)
  useEffect(() => setOpen(read()), [flag]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback(
    (on: boolean) => {
      setOpen(on)
      try {
        if (on) window.localStorage.setItem(flag, '1')
        else window.localStorage.removeItem(flag)
      } catch {
        /* private mode: the chat just closes on reload */
      }
    },
    [flag],
  )
  return [open, set]
}

function Chip({ q, onClick, disabled }: { q: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 12,
        border: '1px solid var(--border-strong)',
        borderRadius: 999,
        padding: '4px 10px',
        background: 'transparent',
        color: 'var(--text)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {q}
    </button>
  )
}

function AskLead(props: {
  state: State
  events: EventRow[]
  configured: boolean
  busy: string
  expanded: boolean
  setExpanded: (on: boolean) => void
  pending: string
  setPending: (q: string) => void
  onStart: () => void
  onChanged: () => void
}) {
  const api = useAppApi()
  const { state, expanded, pending } = props
  const lead = ROSTER[0]
  const slotKey = state.crew.slot_key
  const ready = state.crew.live && state.crew.session_open && state.crew.session_agent === state.crew.agent
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState('')
  const [copied, setCopied] = useState(false)
  const st = memberStatus(lead, state)

  // The embed's own composer sends through the same owner route.
  const sendFromEmbed = async (message: string) => {
    await api.post(`${BASE}/crew/message`, { message })
    props.onChanged()
  }
  const ask = async (q: string) => {
    const text = q.trim()
    if (!text) return
    setSending(true)
    setFailed('')
    try {
      await api.post(`${BASE}/crew/message`, { message: text })
      setDraft('')
      if (text === pending) props.setPending('')
      props.setExpanded(true)
      props.onChanged()
    } catch {
      setFailed(text)
    } finally {
      setSending(false)
    }
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pending)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  const notice = failed && (
    <ErrorNotice message="The Radar Lead did not get that message." onRetry={() => ask(failed)} />
  )
  const notReady = (
    <div className="text-sm" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
      {state.crew.live ? (
        <>
          <span>The Radar Lead session opens on its next turn. Open it now to talk here.</span>
          <Btn primary onClick={props.onStart} disabled={!!props.busy || !props.configured}>Open the session</Btn>
        </>
      ) : (
        <span>
          The Radar Lead is paused. Turn on <b>Crew</b> at the top of the page to triage your channels and talk to it here.
        </span>
      )}
    </div>
  )

  if (!expanded) {
    return (
      <Card style={{ padding: '10px 14px' }}>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            ask(draft)
          }}
        >
          <Avatar m={lead} s={state} size={26} />
          <Input
            aria-label="Ask the lead"
            placeholder="Ask the lead…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!ready || sending}
            style={{ flex: 1, minWidth: 200 }}
          />
          <Btn primary type="submit" disabled={!ready || sending || !draft.trim()}>Send</Btn>
          {QUICK_QUESTIONS.map((q) => (
            <Chip key={q} q={q} onClick={() => ask(q)} disabled={!ready || sending} />
          ))}
        </form>
        {!ready && <div style={{ marginTop: 8 }}>{notReady}</div>}
        {notice}
      </Card>
    )
  }

  const crewEvents = props.events.filter((e) => e.kind === 'crew' || e.kind === 'digest').slice(0, 5)
  return (
    <Card
      style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 'min(620px, calc(100vh - 240px))', overflow: 'hidden' }}
    >
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{state.crew.name || lead.title}</span>
          <Badge variant={st.tone === 'muted' ? 'muted' : st.tone === 'aim' ? 'aim' : 'ok'}>{st.label}</Badge>
          <div className="flex-1" />
          <Btn onClick={() => props.setExpanded(false)} aria-expanded>Collapse</Btn>
        </div>
        <div className="text-xs text-muted" style={{ marginTop: 2 }}>
          phase {state.crew_memory.phase} · next: {state.crew_memory.next || '—'}
        </div>
        <RosterStrip state={state} />
      </div>
      <RunningLines state={state} />
      {pending && (
        // ChatEmbed has no API to fill its composer, so the question waits here.
        <div
          className="text-sm flex flex-wrap items-center gap-2"
          style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' }}
        >
          <span style={{ flex: 1, minWidth: 200, userSelect: 'all' }}>{pending}</span>
          <Btn primary style={small} onClick={() => ask(pending)} disabled={!ready || sending}>Send</Btn>
          <Btn style={small} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Btn>
        </div>
      )}
      {notice && <div style={{ padding: '0 16px' }}>{notice}</div>}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {ready ? (
          <ChatEmbed
            key={slotKey}
            slotKey={slotKey}
            agent={state.crew.agent}
            frameless
            startAtBottom
            placeholder="Ask the Radar Lead…"
            onSend={sendFromEmbed}
          />
        ) : (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notReady}
            {!props.configured && <p className="text-xs text-muted">Add a channel in Settings first.</p>}
            {crewEvents.length > 0 && (
              <ul className="text-xs text-muted flex flex-col gap-1" style={{ marginTop: 6 }}>
                {crewEvents.map((e, i) => (
                  <li key={`${e.at}-${i}`}>{ago(e.at)} · {e.text}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2" style={{ padding: '10px 16px 12px', borderTop: '1px solid var(--border)' }}>
        {QUICK_QUESTIONS.map((q) => (
          <Chip key={q} q={q} onClick={() => ask(q)} disabled={!ready || sending} />
        ))}
      </div>
    </Card>
  )
}


// ── Team tab ────────────────────────────────────────────────────────────────

function TeamTab({ state }: { state: State }) {
  return (
    <Card>
      <CardTitle>Team</CardTitle>
      <p className="text-sm text-muted" style={{ marginBottom: 8 }}>
        Who works on your channels. Only the Radar Lead has a session; the others run when needed.
      </p>
      <ul className="flex flex-col">
        {ROSTER.map((m) => {
          const agentId = m.id === 'lead' ? state.crew.agent : m.agent
          return (
            <li
              key={m.id}
              className="flex items-start gap-3"
              style={{ padding: '12px 4px', borderTop: '1px solid var(--border)', opacity: m.planned ? 0.7 : 1 }}
            >
              <Avatar m={m} s={state} size={36} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{m.id === 'lead' ? state.crew.name || m.title : m.title}</span>
                  <Badge variant="muted">{m.layer}</Badge>
                  <span className="text-xs text-muted">{m.kind}</span>
                </div>
                <p className="text-sm" style={{ margin: '4px 0 0' }}>{m.duty}</p>
                {m.id === 'investigator' && (state.investigations?.items || 0) > 0 && (
                  <p className="text-xs text-muted" style={{ margin: '2px 0 0' }}>
                    {state.investigations?.items} item(s) under investigation
                  </p>
                )}
                {agentId && (
                  <Details>
                    <span className="font-mono">
                      agent: {agentId}
                      {m.id === 'lead' && state.crew.slot_key ? ` · session: ${state.crew.slot_key}` : ''}
                    </span>
                  </Details>
                )}
              </div>
              <div data-testid={`team-status-${m.id}`} style={{ maxWidth: 360, minWidth: 0, display: 'flex' }}>
                <MemberStatus m={m} state={state} withName={false} withResting />
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Activity({ events: all, kinds, onShowAll }: { events: EventRow[]; kinds: string[] | null; onShowAll: () => void }) {
  const events = kinds ? all.filter((e) => kinds.includes(e.kind)) : all
  return (
    <Card>
      <CardTitle>Activity</CardTitle>
      {kinds && (
        <p className="text-sm text-muted flex flex-wrap items-center gap-2" style={{ marginBottom: 8 }}>
          <span>Showing the crew and its members only.</span>
          <Btn style={small} onClick={onShowAll}>Show all</Btn>
        </p>
      )}
      {events.length === 0 ? (
        <p className="text-sm text-muted">No activity yet.</p>
      ) : (
        <ul className="text-sm flex flex-col gap-1">
          {events.map((e, i) => (
            <li key={`${e.at}-${i}`}>
              <span className="text-muted">{fmtTime(e.at)}</span> <Badge variant="muted">{e.kind}</Badge> {e.text}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ── Settings: Basics first, Advanced folded ─────────────────────────────────

function SettingsTab({
  state,
  busy,
  act,
  mcp,
  onProbe,
}: {
  state: State
  busy: string
  act: (label: string, fn: () => Promise<unknown>) => Promise<void>
  mcp: McpStatus | null
  onProbe: () => void
}) {
  const api = useAppApi()
  const [channels, setChannels] = useState(state.settings.channels.join('\n'))
  const [destination, setDestination] = useState(state.settings.digest_destination)
  const [login, setLogin] = useState(state.settings.slack_login)
  const [command, setCommand] = useState(state.settings.slack_mcp_command)
  const [workspaceUrl, setWorkspaceUrl] = useState(state.settings.workspace_url)
  const [pollSecs, setPollSecs] = useState(String(state.settings.poll_interval_secs))
  const [backfill, setBackfill] = useState(String(state.settings.backfill_hours))
  const [unattended, setUnattended] = useState(state.crew.unattended)
  const [agent, setAgent] = useState(state.crew.agent)
  const [model, setModel] = useState(state.crew.model)

  const saveSettings = () =>
    act('Save settings', () =>
      api.put(`${BASE}/settings`, {
        channels: channels.split(/[\s,]+/).map((c) => c.trim()).filter(Boolean),
        digest_destination: destination,
        slack_login: login.trim(),
        slack_mcp_command: command.trim(),
        workspace_url: workspaceUrl.trim(),
        poll_interval_secs: Number(pollSecs),
        backfill_hours: Number(backfill),
      }),
    )

  return (
    <>
      {!state.vault_available && (
        <Card className="mb-4">
          <p className="text-sm">The gateway secret vault is unavailable, so settings cannot be saved.</p>
        </Card>
      )}
      <Card className="mb-4">
        <CardTitle>Basics</CardTitle>
        <div className="flex flex-wrap items-center gap-3">
          <div style={{ flex: 1, minWidth: 0 }}>
            <ConnectionLine mcp={mcp} state={state} />
          </div>
          <Btn disabled={!!busy} onClick={onProbe}>Check connection</Btn>
        </div>
        <p className="text-xs text-muted" style={{ margin: '0 0 12px' }}>
          Slack is read as you, read-only: no bot, no invite. The one write is the optional digest DM to yourself.
        </p>
        <label className="block text-sm mb-1" htmlFor="sr-channels">
          Channels to watch (one channel ID per line, e.g. C0123ABCD). Any channel you can read works.
        </label>
        <textarea
          id="sr-channels"
          className="w-full font-mono text-sm border rounded p-2 bg-transparent"
          rows={5}
          value={channels}
          onChange={(e) => setChannels(e.target.value)}
        />
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3">
          <label className="text-sm">
            Digest destination
            <select
              className="block w-full text-sm bg-transparent border rounded px-2 py-1"
              value={destination}
              onChange={(e) => setDestination(e.target.value as 'self_dm' | 'dashboard')}
            >
              <option value="dashboard">Dashboard notification only</option>
              <option value="self_dm">DM to myself in Slack</option>
            </select>
          </label>
          {destination === 'self_dm' && (
            <label className="text-sm">
              Your Slack login (for the DM)
              <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="jdoe" />
            </label>
          )}
          <label className="text-sm">
            Poll interval (seconds, 60–3600)
            <Input type="number" min={60} max={3600} value={pollSecs} onChange={(e) => setPollSecs(e.target.value)} />
            <span data-testid="poll-cadence" className="block text-xs text-muted" style={{ marginTop: 2 }}>
              Runs by itself every {state.settings.poll_interval_secs} s; a manual Poll just runs one cycle now.
            </span>
          </label>
        </div>
        <Btn primary className="mt-3" disabled={!!busy} onClick={saveSettings}>
          Save settings
        </Btn>
      </Card>

      <Card>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-strong)' }}>Advanced</summary>
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3">
            <label className="text-sm">
              MCP server command (a single executable on PATH)
              <Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="ai-community-slack-mcp" />
            </label>
            <label className="text-sm">
              Workspace URL (for permalinks, optional)
              <Input value={workspaceUrl} onChange={(e) => setWorkspaceUrl(e.target.value)} placeholder="https://yourteam.slack.com" />
            </label>
            <label className="text-sm">
              First-poll backfill (hours, 0–168)
              <Input type="number" min={0} max={168} value={backfill} onChange={(e) => setBackfill(e.target.value)} />
            </label>
          </div>
          <Btn className="mt-3" disabled={!!busy} onClick={saveSettings}>
            Save settings
          </Btn>

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 12 }}>
            <div className="text-sm" style={{ fontWeight: 600, marginBottom: 8 }}>Crew</div>
            <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
              <label className="text-sm">
                Agent
                <Input value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="slack-radar-crew" />
                <span className="block text-xs text-muted mt-1">
                  Default: the shipped slack-radar-crew agent. Your own agents are never modified.
                </span>
              </label>
              <label className="text-sm">
                Model (empty = agent default)
                <Input value={model} onChange={(e) => setModel(e.target.value)} />
              </label>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Toggle
                checked={unattended}
                onChange={setUnattended}
                label="Unattended mode (auto-approve investigator commands)"
                describedBy="sr-unattended-risk"
              />
              <span className="text-sm">Unattended mode (auto-approve investigator commands)</span>
            </div>
            <p id="sr-unattended-risk" className="text-xs text-muted mt-1">
              Risk: anyone in a watched channel can write text the crew reads, so a crafted message could steer a command nobody reviews.
            </p>
            <Btn
              primary
              className="mt-3"
              disabled={!!busy}
              onClick={() => act('Save crew', () => api.put(`${BASE}/crew`, { agent, model, unattended }))}
            >
              Save crew
            </Btn>
          </div>
        </details>
      </Card>
    </>
  )
}
