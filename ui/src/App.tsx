import { ChatEmbed, useAppApi } from '@kirocrew/app-sdk'
import { Badge, Btn, Card, CardTitle, EmptyState, Input, PageHeader, StatCard, Toggle } from '@kirocrew/app-sdk/ui'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'

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
}

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
  }
  crew_memory: { phase: string; next: string; updated_at: number }
  investigations?: { items: number; running: number }
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

// The three quick questions the A mockup shows under the Radar Lead chat.
const QUICK_QUESTIONS = ['What needs me today?', "Draft today's digest", 'Re-check resolved threads']

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

// ── crew roster (static until members.json lands in Phase 2) ────────────────

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
    kind: 'Coming soon',
    agent: 'slack-radar-watcher',
    duty: 'Will judge batches of possibly-resolved threads so the lead does not have to. The lead does this today.',
    planned: true,
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

type MemberStatus = { label: string; tone: 'ok' | 'aim' | 'warn' | 'muted' }

function memberStatus(m: Member, s: State): MemberStatus {
  if (m.id === 'lead') {
    if (!s.crew.live) return { label: 'paused', tone: 'muted' }
    return s.crew.running ? { label: 'working', tone: 'aim' } : { label: 'live', tone: 'ok' }
  }
  if (m.id === 'investigator') {
    const n = s.investigations?.running || 0
    return n ? { label: `${n} running`, tone: 'aim' } : { label: 'standing by', tone: 'muted' }
  }
  if (m.id === 'watcher') return { label: 'Coming soon', tone: 'muted' }
  if (s.source_state === 'needs_login') return { label: 'sign in again', tone: 'warn' }
  return { label: `polled ${ago(s.last_poll_at)}`, tone: 'muted' }
}

const TONE_VAR: Record<MemberStatus['tone'], string> = {
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
    </div>
  )
}

export default function SlackRadar() {
  const api = useAppApi()
  const [tab, setTab] = useState<TabId>('board')
  const [state, setState] = useState<State | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [filter, setFilter] = useState('open')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [mcp, setMcp] = useState<McpStatus | null>(null)

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
      const [s, i, e] = await Promise.all([
        api.get<State>(`${BASE}/state`),
        api.get<{ items: Item[] }>(`${BASE}/items?status=${encodeURIComponent(filter)}&limit=300`),
        api.get<{ events: EventRow[] }>(`${BASE}/events?limit=150`),
      ])
      setState(s)
      setItems(i.items)
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
            <TabStrip tab={tab} setTab={setTab} />
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
      <div className="px-6 pb-8 overflow-y-auto flex-1 min-h-0">
        {state && conn === 'needs_login' && (
          <SignInBanner mcp={mcp} sourceError={state.source_error} busy={busy} onCheck={recheck} />
        )}
        {message && (
          <p role="status" className="text-sm text-muted mb-3">
            {message}
          </p>
        )}
        {!state ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : tab === 'board' ? (
          <Board
            state={state}
            items={items}
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
          <TeamTab state={state} />
        ) : tab === 'activity' ? (
          <Activity events={events} />
        ) : (
          <SettingsTab state={state} busy={busy} act={act} mcp={mcp} onProbe={probe} />
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
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 20, alignItems: 'start' }}>
    <div style={{ minWidth: 0 }}>
      <ConnectionLine mcp={props.mcp} state={state} withPoll />

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4">
        <StatCard label="Awaiting triage" value={state.counts.needs_triage} accent />
        <StatCard label="Possibly resolved" value={state.counts.possibly_resolved} />
        <StatCard label="Open p0 / p1" value={`${p.p0 || 0} / ${p.p1 || 0}`} />
        <StatCard label="Tracked items" value={state.counts.total} />
      </div>

      {!props.configured && (
        <Card className="mb-4">
          <CardTitle>Finish setup</CardTitle>
          <p className="text-sm text-muted">
            Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite.
          </p>
        </Card>
      )}

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
      <LeadCard
        state={state}
        events={props.events}
        configured={props.configured}
        busy={props.busy}
        onStart={props.onStart}
        onPoll={props.onPoll}
        onChanged={props.onChanged}
      />
    </div>
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

// ── Board: the Radar Lead chat card ─────────────────────────────────────────

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

function LeadCard(props: {
  state: State
  events: EventRow[]
  configured: boolean
  busy: string
  onStart: () => void
  onPoll: () => void
  onChanged: () => void
}) {
  const api = useAppApi()
  const { state } = props
  const lead = ROSTER[0]
  const slotKey = state.crew.slot_key
  const ready = state.crew.live && state.crew.session_open && state.crew.session_agent === state.crew.agent
  const [asking, setAsking] = useState(false)
  const send = async (message: string) => {
    await api.post(`${BASE}/crew/message`, { message })
    props.onChanged()
  }
  const ask = async (q: string) => {
    setAsking(true)
    try {
      await send(q)
    } finally {
      setAsking(false)
    }
  }
  const crewEvents = props.events.filter((e) => e.kind === 'crew' || e.kind === 'digest').slice(0, 5)
  const st = memberStatus(lead, state)
  return (
    <Card style={{ position: 'sticky', top: 0, padding: 0, display: 'flex', flexDirection: 'column', height: 'min(760px, calc(100vh - 140px))', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{state.crew.name || lead.title}</span>
          <Badge variant={st.tone === 'muted' ? 'muted' : st.tone === 'aim' ? 'aim' : 'ok'}>{st.label}</Badge>
          <div className="flex-1" />
          <Btn onClick={props.onPoll} disabled={!!props.busy || !props.configured}>Poll now</Btn>
        </div>
        <div className="text-xs text-muted" style={{ marginTop: 2 }}>
          phase {state.crew_memory.phase} · next: {state.crew_memory.next || '—'}
        </div>
        <RosterStrip state={state} />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {ready ? (
          <ChatEmbed
            key={slotKey}
            slotKey={slotKey}
            agent={state.crew.agent}
            frameless
            startAtBottom
            placeholder="Ask the Radar Lead…"
            onSend={send}
          />
        ) : (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {state.crew.live ? (
              <>
                <p className="text-sm">The Radar Lead session opens on its next turn. Open it now to talk here.</p>
                <Btn primary onClick={props.onStart} disabled={!!props.busy || !props.configured}>Open the session</Btn>
              </>
            ) : (
              <p className="text-sm">
                The Radar Lead is paused. Turn on <b>Crew</b> at the top of the page to triage your channels and talk to it here.
              </p>
            )}
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
          <button
            key={q}
            type="button"
            onClick={() => ask(q)}
            disabled={!ready || asking}
            style={{
              fontSize: 12,
              border: '1px solid var(--border-strong)',
              borderRadius: 999,
              padding: '4px 10px',
              background: 'transparent',
              color: 'var(--text)',
              cursor: ready && !asking ? 'pointer' : 'not-allowed',
              opacity: ready ? 1 : 0.5,
            }}
          >
            {q}
          </button>
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
          const st = memberStatus(m, state)
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
              <span className="text-xs" style={{ color: TONE_VAR[st.tone], whiteSpace: 'nowrap' }}>{st.label}</span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Activity({ events }: { events: EventRow[] }) {
  return (
    <Card>
      <CardTitle>Activity</CardTitle>
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
