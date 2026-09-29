import * as sdk from '@kirocrew/app-sdk'
import { ChatEmbed, useAppApi } from '@kirocrew/app-sdk'
import { Badge, Btn, Card, CardTitle, EmptyState, Input, PageHeader, StatCard, Toggle } from '@kirocrew/app-sdk/ui'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'

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
  dispatch?: FixDispatch
}
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

type TabId = 'board' | 'team' | 'activity' | 'settings'
const TABS: { id: TabId; label: string }[] = [
  { id: 'board', label: 'Board' },
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
    duty: 'Triages every watched channel, sets category and priority, decides when a cluster needs investigating, judges possibly-resolved threads, writes the digest headline, and answers you here.',
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
    kind: 'Joins on demand',
    agent: 'slack-radar-watcher',
    duty: 'Judges a batch of possibly-resolved threads when the lead asks, and records resolved or not in the ledger. No shell.',
  },
  {
    id: 'poller',
    title: 'Poller',
    initials: '⟳',
    layer: 'System',
    kind: 'Code, no model',
    agent: '',
    duty: 'Reads new messages and thread replies from Slack, flags likely resolutions, and delivers the digest. Spends no credits.',
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
  if (m.id === 'poller') return row.doing
  if (row.state !== 'working') return row.state === 'paused' ? `paused: ${row.doing}` : memberStatus(m, s).label
  if (m.id === 'lead') return `working: ${row.doing}`
  return `${row.count} running: ${row.doing}`
}

// One stylesheet for the pulsing dot; still when the reader asks for less motion.
const PULSE_CSS = `@keyframes slack-radar-pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.7) } }
.sr-pulse { animation: slack-radar-pulse 1.4s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .sr-pulse { animation: none } }`

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
function MemberStatus({ m, state, withName = true, onOpen }: { m: Member; state: State; withName?: boolean; onOpen?: () => void }) {
  const st = memberStatus(m, state)
  const row = nowRow(state, m.id)
  const working = row ? row.state === 'working' : st.tone === 'aim'
  const full = doingLine(m, state)
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
            items={items}
            needs={needs}
            handled={handled}
            configured={configured}
            mcp={mcp}
            filter={filter}
            setFilter={setFilter}
            selected={selected}
            setSelected={setSelected}
            busy={busy}
            onPoll={() => act('Poll', () => api.post(`${BASE}/poll`, {}))}
            onInvestigate={(repo) =>
              act('Investigate', async () => {
                await api.post(`${BASE}/investigate`, { keys: [...selected], repo })
                setSelected(new Set())
              })
            }
            onStart={() => act('Start crew', () => api.post(`${BASE}/crew/start`, {}))}
            onDigest={() => act('Request digest', () => api.post(`${BASE}/digest/request`, {}))}
            events={events}
            onChanged={load}
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

function ConnectionLine({ mcp, state, withPoll }: { mcp: McpStatus | null; state: State; withPoll?: boolean }) {
  const status = connectionStatus(mcp, state.source_state)
  const ok = status === 'connected'
  const dot = ok ? 'var(--ok)' : status === 'checking' ? 'var(--muted-strong)' : 'var(--warn)'
  return (
    <div className="mb-4">
      <p role="status" className="text-sm text-muted flex flex-wrap items-center gap-2" style={{ margin: 0 }}>
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
      {!ok && status !== 'needs_login' && <TechDetails mcp={mcp} sourceError={state.source_error} />}
    </div>
  )
}

// ── Board ───────────────────────────────────────────────────────────────────

function Board(props: {
  state: State
  items: Item[]
  needs: Needs | null
  handled: Item[]
  configured: boolean
  mcp: McpStatus | null
  filter: string
  setFilter: (f: string) => void
  selected: Set<string>
  setSelected: (s: Set<string>) => void
  busy: string
  onPoll: () => void
  onInvestigate: (repo: string) => void
  onStart: () => void
  onDigest: () => void
  events: EventRow[]
  onChanged: () => void
}) {
  const { state, items, selected, setSelected } = props
  const [repo, setRepo] = useState('')
  const [pending, setPending] = useState('')
  const [expanded, setExpanded] = useChatOpen(state.crew.slot_key)
  const chatRef = useRef<HTMLDivElement>(null)
  const p = state.counts.open_by_priority
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
  const askWhy = (e: NeedEntry) => {
    setPending(whyQuestion(e))
    setExpanded(true)
    window.requestAnimationFrame(() => chatRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }
  return (
    <div style={{ minWidth: 0 }}>
      <div className="flex flex-wrap items-start gap-3">
        <div style={{ flex: 1, minWidth: 0 }}>
          <ConnectionLine mcp={props.mcp} state={state} withPoll />
        </div>
        <Btn onClick={props.onPoll} disabled={!!props.busy || !props.configured}>Poll now</Btn>
      </div>

      <div ref={chatRef}>
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

      {!props.configured && (
        <Card className="mb-4">
          <CardTitle>Finish setup</CardTitle>
          <p className="text-sm text-muted">
            Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite.
          </p>
        </Card>
      )}

      <NeedsCard
        needs={props.needs}
        today={state.crew.today}
        handled={props.handled}
        onChanged={props.onChanged}
        onWhy={askWhy}
      />

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4">
        <StatCard label="Awaiting triage" value={state.counts.needs_triage} accent />
        <StatCard label="Possibly resolved" value={state.counts.possibly_resolved} />
        <StatCard label="Open p0 / p1" value={`${p.p0 || 0} / ${p.p1 || 0}`} />
        <StatCard label="Tracked items" value={state.counts.total} />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <CardTitle>Ledger</CardTitle>
          <label className="text-sm text-muted" htmlFor="sr-filter">Show</label>
          <select
            id="sr-filter"
            className="text-sm bg-transparent border rounded px-2 py-1"
            value={props.filter}
            onChange={(e) => props.setFilter(e.target.value)}
          >
            <option value="open">open</option>
            <option value="new">new</option>
            <option value="triaged">triaged</option>
            <option value="investigating">investigating</option>
            <option value="resolved">resolved</option>
            <option value="noise">noise</option>
            <option value="">all</option>
          </select>
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
        {items.length === 0 ? (
          <EmptyState icon={<span aria-hidden>📡</span>} title="Nothing here yet" subtitle="New messages appear after the next poll." />
        ) : (
          <ul className="flex flex-col">
            {items.map((it, idx) => (
              <LedgerRow key={it.key} it={it} first={idx === 0} checked={selected.has(it.key)} onToggle={() => toggle(it.key)} />
            ))}
          </ul>
        )}
      </Card>

      <DigestCard state={state} busy={props.busy} onDigest={props.onDigest} />

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

// ── Board: "Needs you" ──────────────────────────────────────────────────────

// Section titles for GET /needs groups, in the order the backend returns them.
const GROUP_TITLE: Record<NeedGroup['id'], string> = {
  decide: 'Needs a decision',
  unanswered: 'Questions nobody answered',
  clusters: 'Reported more than once',
}

type HandleHow = 'done' | 'ignored' | 'reopen'

function fmtAge(h: number): string {
  if (h < 1) return 'under 1 h old'
  if (h < 48) return `${Math.round(h)} h old`
  return `${Math.floor(h / 24)} days old`
}

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

// "⋯": row actions beyond the two visible buttons.
function MoreMenu({ label, actions }: { label: string; actions: { label: string; onClick: () => void }[] }) {
  const ref = useRef<HTMLDetailsElement>(null)
  return (
    <details ref={ref} style={{ position: 'relative' }}>
      <summary
        aria-label={label}
        title={label}
        style={{ listStyle: 'none', cursor: 'pointer', padding: '2px 8px', borderRadius: 6, color: 'var(--muted)' }}
      >
        ⋯
      </summary>
      <div
        role="menu"
        style={{
          position: 'absolute', right: 0, top: '100%', zIndex: 5, minWidth: 180, padding: 4,
          background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 8,
        }}
      >
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            role="menuitem"
            onClick={() => {
              if (ref.current) ref.current.open = false
              a.onClick()
            }}
            style={{
              display: 'block', width: '100%', textAlign: 'left', fontSize: 13, padding: '6px 10px',
              border: 0, borderRadius: 6, background: 'transparent', color: 'var(--text)', cursor: 'pointer',
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </details>
  )
}

const small: CSSProperties = { fontSize: 12, padding: '2px 10px' }

// A row whose item carries a reply draft: the draft in an editable box, Send to thread
// and Ignore. Send saves an edited draft first, then posts as the owner.
function ReplyRow({
  e,
  first,
  onMark,
  onWhy,
  onSend,
}: {
  e: NeedEntry
  first: boolean
  onMark: (how: HandleHow) => void
  onWhy: () => void
  onSend: (text: string, edited: boolean) => void
}) {
  const [text, setText] = useState(e.reply_draft || '')
  useEffect(() => setText(e.reply_draft || ''), [e.reply_draft])
  const id = `sr-reply-${e.key.replace(/[^A-Za-z0-9]/g, '-')}`
  const more = [
    ...(e.permalink ? [{ label: 'Open in Slack', onClick: () => window.open(e.permalink, '_blank', 'noopener,noreferrer') }] : []),
    { label: 'Done without sending', onClick: () => onMark('done') },
    { label: 'Why? Ask the lead', onClick: onWhy },
  ]
  return (
    <li className="text-sm" style={{ padding: '10px 0', borderTop: first ? 0 : '1px solid var(--border)' }}>
      <div className="flex items-start gap-2">
        <div style={{ flex: 'none', minWidth: 28 }}>{priorityBadge(e.priority)}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: 'var(--text-strong)' }}>{e.summary || '(no text)'}</div>
          <div className="text-xs text-muted" style={{ marginTop: 2 }}>
            {e.reason} · <span className="font-mono">{e.channel}</span> · {fmtAge(e.age_hours)}
          </div>
          <label htmlFor={id} className="text-xs text-muted" style={{ display: 'block', marginTop: 6 }}>
            Reply to the thread, sent as you
          </label>
          <textarea
            id={id}
            value={text}
            maxLength={1500}
            rows={3}
            onChange={(ev) => setText(ev.target.value)}
            style={{
              width: '100%', marginTop: 2, fontSize: 13, padding: '6px 8px', borderRadius: 6, resize: 'vertical',
              border: '1px solid var(--border-strong)', background: 'var(--bg)', color: 'var(--text)',
            }}
          />
        </div>
        <div className="flex items-center gap-1" style={{ flex: 'none' }}>
          <Btn style={small} disabled={!text.trim()} onClick={() => onSend(text.trim(), text.trim() !== (e.reply_draft || '').trim())}>
            Send to thread
          </Btn>
          <Btn style={small} onClick={() => onMark('ignored')}>Ignore</Btn>
          <MoreMenu label="More actions" actions={more} />
        </div>
      </div>
    </li>
  )
}

function NeedRow({
  e,
  first,
  onMark,
  onWhy,
  onDispatch,
  busy,
}: {
  e: NeedEntry
  first: boolean
  onMark: (how: HandleHow) => void
  onWhy: () => void
  onDispatch?: () => void
  busy?: boolean
}) {
  const fix = !!e.handoff_title && !!onDispatch
  const sent = e.dispatch
  return (
    <li className="text-sm" style={{ padding: '10px 0', borderTop: first ? 0 : '1px solid var(--border)' }}>
      <div className="flex items-start gap-2">
        <div style={{ flex: 'none', minWidth: 28 }}>{priorityBadge(e.priority)}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: 'var(--text-strong)' }}>{e.summary || '(no text)'}</div>
          {fix && !sent && <div className="text-xs" style={{ marginTop: 2 }}>Fix: {e.handoff_title}</div>}
          {sent && (
            <div className="text-xs" style={{ marginTop: 2 }} data-testid="fix-in-progress">
              <SessionLink d={sent} /> · {FIX_STATE[sent.state] || sent.state}
              {sent.pr_url && (
                <>
                  {' · '}
                  <a className="underline" href={sent.pr_url} target="_blank" rel="noreferrer noopener">
                    PR #{sent.pr_number}
                  </a>
                </>
              )}
            </div>
          )}
          <div className="text-xs text-muted" style={{ marginTop: 2 }}>
            {e.reason}
            {e.words && e.words.length > 0 && <> ({e.words.join(', ')})</>}
            {' · '}
            <span className="font-mono">{e.channel}</span> · {fmtAge(e.age_hours)}
            {e.permalink && (
              <>
                {' · '}
                <a className="underline" href={e.permalink} target="_blank" rel="noreferrer noopener">
                  Open in Slack
                </a>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1" style={{ flex: 'none' }}>
          {sent ? (
            <>
              <Btn style={small} onClick={() => onMark('ignored')}>Ignore</Btn>
              <MoreMenu
                label="More actions"
                actions={[
                  { label: 'Done', onClick: () => onMark('done') },
                  { label: 'Why? Ask the lead', onClick: onWhy },
                ]}
              />
            </>
          ) : fix ? (
            <>
              <Btn style={small} onClick={onDispatch} disabled={busy}>{busy ? 'Dispatching…' : 'Dispatch fix'}</Btn>
              <Btn style={small} onClick={() => onMark('ignored')}>Ignore</Btn>
              <MoreMenu
                label="More actions"
                actions={[
                  { label: 'Done', onClick: () => onMark('done') },
                  { label: 'Why? Ask the lead', onClick: onWhy },
                ]}
              />
            </>
          ) : (
            <>
              <Btn style={small} onClick={() => onMark('done')}>Done</Btn>
              <Btn style={small} onClick={() => onMark('ignored')}>Ignore</Btn>
              <MoreMenu label="More actions" actions={[{ label: 'Why? Ask the lead', onClick: onWhy }]} />
            </>
          )}
        </div>
      </div>
    </li>
  )
}

type LaunchOpts = { message?: string; autoSend?: boolean; agent?: string; slotKey?: string }
type Launcher = { openChat: (opts: LaunchOpts) => void }
// `useChatLauncher` is read off the SDK namespace so an older host without it still loads the app.
const useLauncher: () => Launcher | null =
  typeof (sdk as { useChatLauncher?: unknown }).useChatLauncher === 'function'
    ? (sdk as unknown as { useChatLauncher: () => Launcher }).useChatLauncher
    : () => null

const FIX_STATE: Record<string, string> = { running: 'working', idle: 'waiting', closed: 'session closed', unknown: '' }

// A link to a dispatched session. Inside the dashboard it opens the session in place.
function SessionLink({ d }: { d: { session_key: string; title: string } }) {
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
      {d.title || 'Fix session'}
    </a>
  )
}

type DispatchReply =
  | { ok: true; mode: 'server'; session_key: string; title: string }
  | { ok: true; mode: 'client'; agent: string; title: string; seed: string }

function errorBody(err: unknown): { code?: string; error?: string; session_key?: string; title?: string } {
  try {
    return JSON.parse(String((err as { body?: string }).body || '{}'))
  } catch {
    return {}
  }
}

// Dispatch fix: ONE click is the owner's consent. The server opens a kirocrew-conductor
// session with the hand-off and its Slack context and sends it; a toast links to it.
// When the gateway cannot create sessions for the app, the seed comes back and the
// SDK launcher sends it in a new conductor chat; with no launcher, a copy dialog.
function useDispatchFix(onChanged: () => void): {
  dispatch: (key: string) => void
  dispatchBatch: (keys: string[]) => Promise<boolean>
  busyKey: string
  ui: ReactNode
} {
  const api = useAppApi()
  const launcher = useLauncher()
  const [busyKey, setBusyKey] = useState('')
  const [toast, setToast] = useState<{ session_key: string; title: string; again?: boolean; batch?: boolean } | null>(null)
  const [failed, setFailed] = useState<{ key: string; why: string } | null>(null)
  const [batchFailed, setBatchFailed] = useState<{ keys: string[]; why: string } | null>(null)
  const [shown, setShown] = useState<{ title: string; seed: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const dispatch = async (key: string) => {
    if (busyKey) return
    setBusyKey(key)
    setFailed(null)
    try {
      const r = await api.post<DispatchReply>(`${BASE}/items/handoff/dispatch`, { key })
      if (r.mode === 'server') setToast({ session_key: r.session_key, title: r.title })
      else if (launcher) launcher.openChat({ agent: r.agent, message: r.seed, autoSend: true })
      else {
        setCopied(false)
        setShown({ title: r.title, seed: r.seed })
      }
      onChanged()
    } catch (err) {
      const b = errorBody(err)
      if (b.code === 'already_dispatched' && b.session_key) setToast({ session_key: b.session_key, title: b.title || '', again: true })
      else setFailed({ key, why: b.error || 'the gateway refused it' })
    } finally {
      setBusyKey('')
    }
  }
  // Batch: the reviewed list is the owner's consent for all of it. ONE conductor
  // session gets every checked hand-off. True when it went out.
  const dispatchBatch = async (keys: string[]): Promise<boolean> => {
    if (busyKey || keys.length === 0) return false
    setBusyKey('batch')
    setBatchFailed(null)
    try {
      const r = await api.post<DispatchReply>(`${BASE}/items/handoff/dispatch-batch`, { keys })
      if (r.mode === 'server') setToast({ session_key: r.session_key, title: r.title, batch: true })
      else if (launcher) launcher.openChat({ agent: r.agent, message: r.seed, autoSend: true })
      else {
        setCopied(false)
        setShown({ title: r.title, seed: r.seed })
      }
      onChanged()
      return true
    } catch (err) {
      const b = errorBody(err) as { error?: string; dispatched?: { key: string }[] }
      const why = b.dispatched?.length
        ? `${b.dispatched.length} of them already have a session`
        : b.error || 'the gateway refused it'
      setBatchFailed({ keys, why })
      return false
    } finally {
      setBusyKey('')
    }
  }
  const copy = async () => {
    if (!shown) return
    try {
      await navigator.clipboard.writeText(shown.seed)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  const ui = (
    <>
      {failed && (
        <ErrorNotice message={`Could not dispatch that fix: ${failed.why}. Nothing was sent.`} onRetry={() => dispatch(failed.key)} />
      )}
      {batchFailed && (
        <ErrorNotice
          message={`Could not dispatch those fixes: ${batchFailed.why}. Nothing was sent.`}
          onRetry={() => dispatchBatch(batchFailed.keys)}
        />
      )}
      {toast && (
        <div
          role="status"
          data-testid="dispatch-toast"
          className="text-sm flex items-center gap-2"
          style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 40, background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '8px 12px', maxWidth: 480 }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            {toast.again ? 'Already dispatched: ' : toast.batch ? 'Fixes dispatched to one conductor: ' : 'Fix dispatched to a conductor: '}
            <SessionLink d={toast} />
          </span>
          <Btn style={small} onClick={() => setToast(null)}>Close</Btn>
        </div>
      )}
      {shown && (
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
      )}
    </>
  )
  return { dispatch, dispatchBatch, busyKey, ui }
}

// Batch review panel (inline, not a modal): every undispatched hand-off, all checked.
// Unchecking drops one. The primary button sends the checked ones to ONE conductor.
function BatchPanel({
  rows,
  busy,
  onSend,
  onCancel,
}: {
  rows: { key: string; title: string; repo: string; prompt: string }[]
  busy: boolean
  onSend: (keys: string[]) => void
  onCancel: () => void
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(rows.map((r) => r.key)))
  const chosen = rows.filter((r) => picked.has(r.key))
  const repos = new Set(chosen.map((r) => r.repo.toLowerCase()))
  const mixed = repos.size > 1
  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  return (
    <section
      aria-label="Dispatch fixes together"
      data-testid="batch-panel"
      style={{ margin: '8px 0', padding: 10, border: '1px solid var(--border-strong)', borderRadius: 8 }}
    >
      <p className="text-xs text-muted" style={{ margin: '0 0 6px' }}>
        One conductor gets every checked fix and splits the work. Uncheck any you want to leave out.
      </p>
      <ul className="flex flex-col" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {rows.map((r, i) => (
          <li key={r.key} style={{ padding: '6px 0', borderTop: i === 0 ? 0 : '1px solid var(--border)' }}>
            <label className="text-sm flex gap-2" style={{ alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={picked.has(r.key)} onChange={() => toggle(r.key)} style={{ marginTop: 3 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                {r.title} <span className="text-xs text-muted font-mono">{r.repo}</span>
                <span className="text-xs text-muted" style={{ display: 'block' }}>
                  {r.prompt.length > 120 ? `${r.prompt.slice(0, 120)}…` : r.prompt}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
        <Btn primary style={small} disabled={busy || chosen.length === 0 || mixed} onClick={() => onSend(chosen.map((r) => r.key))}>
          {busy ? 'Dispatching…' : `Dispatch ${chosen.length} to one conductor`}
        </Btn>
        <Btn style={small} onClick={onCancel} disabled={busy}>Cancel</Btn>
        {mixed && <span className="text-xs text-muted" role="status">one repo per batch</span>}
      </div>
    </section>
  )
}

function NeedsCard({
  needs,
  today,
  handled,
  onChanged,
  onWhy,
}: {
  needs: Needs | null
  today?: Today | null
  handled: Item[]
  onChanged: () => void
  onWhy: (e: NeedEntry) => void
}) {
  const api = useAppApi()
  const fixer = useDispatchFix(onChanged)
  const fixes = needs?.fixes || []
  const batches = needs?.fix_batches || []
  const batchOf = new Map(batches.map((b) => [b.session_key, b]))
  // Hand-offs the owner can send together: undispatched rows in "decide".
  const prompts = new Map((needs?.handoffs || []).map((h) => [h.key, h.handoff]))
  const batchable = ((needs?.groups || []).find((g) => g.id === 'decide')?.entries || [])
    .filter((e) => e.handoff_title && !e.dispatch && prompts.has(e.key))
    .map((e) => {
      const h = prompts.get(e.key)!
      return { key: e.key, title: e.handoff_title || h.title, repo: h.repo || '', prompt: h.prompt || '' }
    })
  const [batchOpen, setBatchOpen] = useState(false)
  const [sendFailed, setSendFailed] = useState<{ key: string; text: string; edited: boolean; why: string } | null>(null)
  const [sent, setSent] = useState('')
  useEffect(() => {
    if (!sent) return
    const id = window.setTimeout(() => setSent(''), 4000)
    return () => window.clearTimeout(id)
  }, [sent])
  const sendReply = async (key: string, text: string, edited: boolean, rowId: string) => {
    setSendFailed(null)
    setGone((prev) => new Set(prev).add(rowId))
    try {
      if (edited) await api.post(`${BASE}/items/reply/draft`, { key, text })
      await api.post(`${BASE}/items/reply/send`, { key })
      setSent('Sent as you')
      onChanged()
    } catch (err) {
      setGone((prev) => {
        const next = new Set(prev)
        next.delete(rowId)
        return next
      })
      setSendFailed({ key, text, edited, why: (err as Error).message || 'unknown error' })
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
        {batchable.length >= 2 && !batchOpen && (
          <Btn style={small} onClick={() => setBatchOpen(true)} disabled={!!fixer.busyKey}>
            Dispatch all fixes ({batchable.length})
          </Btn>
        )}
      </div>
      {batchOpen && batchable.length > 0 && (
        <BatchPanel
          rows={batchable}
          busy={fixer.busyKey === 'batch'}
          onCancel={() => setBatchOpen(false)}
          onSend={async (keys) => {
            if (await fixer.dispatchBatch(keys)) setBatchOpen(false)
          }}
        />
      )}
      {today?.text && (
        <p className="text-sm" style={{ margin: '0 0 8px' }} data-testid="crew-today">
          {today.text}
          {today.at > 0 && <span className="text-xs text-muted"> · {ago(today.at)}</span>}
        </p>
      )}
      {sent && (
        <p role="status" className="text-sm" style={{ margin: '0 0 8px', color: 'var(--success, var(--text))' }}>
          {sent}
        </p>
      )}
      {sendFailed && (
        <ErrorNotice
          message={`Could not send that reply: ${sendFailed.why}`}
          onRetry={() => sendReply(sendFailed.key, sendFailed.text, sendFailed.edited, `decide:${sendFailed.key}`)}
        />
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
              <h4 className="text-sm" style={{ margin: 0, fontWeight: 600, color: 'var(--text-strong)' }}>
                {GROUP_TITLE[g.id]} <span className="text-muted" style={{ fontWeight: 400 }}>({g.total - (g.entries.length - g.shown.length)})</span>
              </h4>
              <ul className="flex flex-col">
                {g.shown.map((e, i) => g.id === 'decide' && e.reply_draft && !e.handoff_title ? (
                  <ReplyRow
                    key={e.key}
                    e={e}
                    first={i === 0}
                    onMark={(how) => post([e.key], how, `${g.id}:${e.key}`)}
                    onWhy={() => onWhy(e)}
                    onSend={(text, edited) => sendReply(e.key, text, edited, `${g.id}:${e.key}`)}
                  />
                ) : (
                  <NeedRow
                    key={e.key}
                    e={e}
                    first={i === 0}
                    onMark={(how) => post(e.members?.length ? e.members : [e.key], how, `${g.id}:${e.key}`)}
                    onWhy={() => onWhy(e)}
                    onDispatch={g.id === 'decide' && e.handoff_title ? () => fixer.dispatch(e.key) : undefined}
                    busy={fixer.busyKey === e.key}
                  />
                ))}
              </ul>
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
      {fixer.ui}
    </Card>
  )
}

// At most two tags per row: the status, then one severity (priority, else "possibly
// resolved"). Everything else goes into the "+N" tag's hover title.
function LedgerRow({ it, first, checked, onToggle }: { it: Item; first: boolean; checked: boolean; onToggle: () => void }) {
  const second = it.priority
    ? { label: it.priority, variant: (it.priority === 'p0' || it.priority === 'p1' ? 'err' : 'muted') as 'err' | 'muted' }
    : it.possibly_resolved
      ? { label: 'possibly resolved', variant: 'warn' as const }
      : null
  const extra = [
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

// ── Board: today's digest ───────────────────────────────────────────────────

function DigestCard({ state, busy, onDigest }: { state: State; busy: string; onDigest: () => void }) {
  const d = state.digest
  const today = new Date().toISOString().slice(0, 10)
  const fresh = d.last_posted_date === today
  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <CardTitle>{fresh ? "Today's digest" : 'Latest digest'}</CardTitle>
        {d.pending ? <Badge variant="aim">being delivered</Badge> : null}
        <span className="text-xs text-muted">
          {d.last_posted_date ? `${d.last_posted_date} · ${state.settings.digest_destination === 'self_dm' ? 'DMed to you' : 'dashboard notification'}` : 'none yet'}
        </span>
        <div className="flex-1" />
        <Btn onClick={onDigest} disabled={!!busy || !state.crew.live}>Request digest</Btn>
      </div>
      {d.last_text ? (
        <pre className="whitespace-pre-wrap text-sm mt-2" style={{ fontFamily: 'inherit', margin: '8px 0 0' }}>
          {d.last_text}
        </pre>
      ) : (
        <p className="text-sm text-muted mt-2">The Radar Lead writes one after the daily cron or when you press Request digest.</p>
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
      <Card className="mb-4" style={{ padding: '10px 14px' }}>
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
      className="mb-4"
      style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 'min(620px, calc(100vh - 180px))', overflow: 'hidden' }}
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
                <MemberStatus m={m} state={state} withName={false} />
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
