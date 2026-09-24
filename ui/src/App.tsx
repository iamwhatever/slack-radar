import { useAppApi } from '@kirocrew/app-sdk'
import { Badge, Btn, Card, CardTitle, EmptyState, Input, PageHeader, StatCard, Toggle } from '@kirocrew/app-sdk/ui'
import { useCallback, useEffect, useMemo, useState } from 'react'

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
  digest_channel: string
  digest_send_message: boolean
  poll_interval_secs: number
  backfill_hours: number
  recheck_days: number
  recheck_max_per_cycle: number
}

type State = {
  vault_available: boolean
  secrets: { bot_token: string }
  settings: Settings
  crew: {
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
  digest: { last_posted_date: string; last_error: string; pending: unknown }
}

type EventRow = { at: number; kind: string; text: string; key: string }

const fmtTime = (t?: number) => (t ? new Date(t * 1000).toLocaleString() : 'never')

function statusVariant(s: string): 'ok' | 'err' | 'warn' | 'aim' | 'muted' {
  if (s === 'new') return 'warn'
  if (s === 'investigating') return 'aim'
  if (s === 'resolved') return 'ok'
  return 'muted'
}

export default function SlackRadar() {
  const api = useAppApi()
  const [tab, setTab] = useState<'board' | 'activity' | 'settings'>('board')
  const [state, setState] = useState<State | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [filter, setFilter] = useState('open')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

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

  const configured = !!state && !!state.secrets.bot_token && state.settings.channels.length > 0

  return (
    <>
      <PageHeader
        title="Slack Radar"
        subtitle="One crew triaging every channel you watch, with a local ledger and a daily digest"
        actions={
          <div className="flex gap-2">
            {(['board', 'activity', 'settings'] as const).map((t) => (
              <Btn key={t} primary={tab === t} onClick={() => setTab(t)} aria-pressed={tab === t}>
                {t[0].toUpperCase() + t.slice(1)}
              </Btn>
            ))}
          </div>
        }
      />
      <div className="px-6 pb-8 overflow-y-auto flex-1 min-h-0">
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
            onPause={() => act('Pause crew', () => api.post(`${BASE}/crew/pause`, {}))}
            onDigest={() => act('Request digest', () => api.post(`${BASE}/digest/request`, {}))}
          />
        ) : tab === 'activity' ? (
          <Activity events={events} />
        ) : (
          <SettingsTab state={state} busy={busy} act={act} />
        )}
      </div>
    </>
  )
}

function Board(props: {
  state: State
  items: Item[]
  configured: boolean
  filter: string
  setFilter: (f: string) => void
  selected: Set<string>
  setSelected: (s: Set<string>) => void
  busy: string
  onPoll: () => void
  onInvestigate: (repo: string) => void
  onStart: () => void
  onPause: () => void
  onDigest: () => void
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
    <>
      <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-6">
        <StatCard label="Awaiting triage" value={state.counts.needs_triage} accent />
        <StatCard label="Possibly resolved" value={state.counts.possibly_resolved} />
        <StatCard label="Open p0 / p1" value={`${p.p0 || 0} / ${p.p1 || 0}`} />
        <StatCard label="Tracked items" value={state.counts.total} />
      </div>

      {!props.configured && (
        <Card className="mb-4">
          <CardTitle>Finish setup</CardTitle>
          <p className="text-sm text-muted">
            Paste a Slack bot token and at least one channel ID in Settings. Nothing is polled until both are set.
          </p>
        </Card>
      )}

      <Card className="mb-4">
        <CardTitle>Crew</CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={state.crew.live ? 'ok' : 'muted'}>{state.crew.live ? 'running' : 'paused'}</Badge>
          {state.crew.running && <Badge variant="aim">mid-turn</Badge>}
          {state.crew.trusted && <Badge variant="warn">auto-approve on</Badge>}
          <span className="text-muted">
            phase {state.crew_memory.phase} · next: {state.crew_memory.next || '—'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {state.crew.live ? (
            <Btn onClick={props.onPause} disabled={!!props.busy}>Pause crew</Btn>
          ) : (
            <Btn primary onClick={props.onStart} disabled={!!props.busy || !props.configured}>Start crew</Btn>
          )}
          <Btn onClick={props.onPoll} disabled={!!props.busy || !props.configured}>Poll now</Btn>
          <Btn onClick={props.onDigest} disabled={!!props.busy || !state.crew.live}>Request digest</Btn>
        </div>
        <p className="text-xs text-muted mt-2">
          Last poll {fmtTime(state.last_poll_at)}
          {state.last_poll_error ? ` · ${state.last_poll_error}` : ''} · last digest{' '}
          {state.digest.last_posted_date || 'never'}
          {state.digest.last_error ? ` · ${state.digest.last_error}` : ''}
        </p>
      </Card>

      <Card className="mb-4">
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
                  <td>{c.last_error ? <Badge variant="err">{c.last_error}</Badge> : <Badge variant="ok">ok</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
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
          <ul className="flex flex-col gap-2">
            {items.map((it) => (
              <li key={it.key} className="border rounded p-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Select ${it.key} for investigation`}
                    checked={selected.has(it.key)}
                    onChange={() => toggle(it.key)}
                  />
                  <Badge variant={statusVariant(it.status)}>{it.status}</Badge>
                  {it.priority && <Badge variant={it.priority === 'p0' || it.priority === 'p1' ? 'err' : 'muted'}>{it.priority}</Badge>}
                  {it.category && <Badge variant="muted">{it.category}</Badge>}
                  {it.possibly_resolved && <Badge variant="warn">possibly resolved: {it.possibly_resolved.reason}</Badge>}
                  <span className="text-muted font-mono">{it.channel}</span>
                  <a className="underline" href={it.permalink} target="_blank" rel="noreferrer noopener">
                    open in Slack
                  </a>
                  {it.reply_count > 0 && <span className="text-muted">{it.reply_count} replies</span>}
                </div>
                <p className="mt-1">{it.summary || it.text.slice(0, 280)}</p>
                {it.links.length > 0 && (
                  <p className="mt-1 text-muted">
                    Linked:{' '}
                    {it.links.map((u) => (
                      <a key={u} className="underline mr-2" href={u} target="_blank" rel="noreferrer noopener">
                        {u.replace('https://github.com/', '')}
                      </a>
                    ))}
                  </p>
                )}
                {it.note && <p className="mt-1 text-xs text-muted">{it.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
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

function SettingsTab({
  state,
  busy,
  act,
}: {
  state: State
  busy: string
  act: (label: string, fn: () => Promise<unknown>) => Promise<void>
}) {
  const api = useAppApi()
  const [channels, setChannels] = useState(state.settings.channels.join('\n'))
  const [digestChannel, setDigestChannel] = useState(state.settings.digest_channel)
  const [sendMessage, setSendMessage] = useState(state.settings.digest_send_message)
  const [pollSecs, setPollSecs] = useState(String(state.settings.poll_interval_secs))
  const [backfill, setBackfill] = useState(String(state.settings.backfill_hours))
  const [token, setToken] = useState('')
  const [unattended, setUnattended] = useState(state.crew.unattended)
  const [agent, setAgent] = useState(state.crew.agent)
  const [model, setModel] = useState(state.crew.model)

  const saveSettings = () =>
    act('Save settings', () =>
      api.put(`${BASE}/settings`, {
        channels: channels.split(/[\s,]+/).map((c) => c.trim()).filter(Boolean),
        digest_channel: digestChannel.trim(),
        digest_send_message: sendMessage,
        poll_interval_secs: Number(pollSecs),
        backfill_hours: Number(backfill),
      }),
    )

  return (
    <>
      {!state.vault_available && (
        <Card className="mb-4">
          <p className="text-sm">The gateway secret vault is unavailable, so settings and the token cannot be saved.</p>
        </Card>
      )}
      <Card className="mb-4">
        <CardTitle>Slack bot token</CardTitle>
        <p className="text-sm text-muted mb-2">
          Stored in the gateway&apos;s encrypted vault. Agents cannot read it, and it is never shown again after saving.
          Status: {state.secrets.bot_token ? 'set' : 'not set'}.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            type="password"
            autoComplete="off"
            aria-label="Slack Bot User OAuth Token"
            placeholder="xoxb-…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-80"
          />
          <Btn
            primary
            disabled={!token || !!busy}
            onClick={() =>
              act('Save token', async () => {
                await api.put(`${BASE}/token`, { value: token })
                setToken('')
              })
            }
          >
            Save token
          </Btn>
          {state.secrets.bot_token && (
            <Btn danger disabled={!!busy} onClick={() => act('Remove token', () => api.del(`${BASE}/token`))}>
              Remove token
            </Btn>
          )}
        </div>
      </Card>

      <Card className="mb-4">
        <CardTitle>Channels and digest</CardTitle>
        <label className="block text-sm mb-1" htmlFor="sr-channels">
          Channel IDs to watch (one per line; e.g. C0123ABCD). Invite the bot to each one.
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
            Digest channel ID (empty = no Slack post)
            <Input value={digestChannel} onChange={(e) => setDigestChannel(e.target.value)} placeholder="C0DIGEST1" />
          </label>
          <label className="text-sm">
            Poll interval (seconds, 60–3600)
            <Input type="number" min={60} max={3600} value={pollSecs} onChange={(e) => setPollSecs(e.target.value)} />
          </label>
          <label className="text-sm">
            First-poll backfill (hours, 0–168)
            <Input type="number" min={0} max={168} value={backfill} onChange={(e) => setBackfill(e.target.value)} />
          </label>
        </div>
        <div className="mt-3">
          <Toggle checked={sendMessage} onChange={setSendMessage} label="Also send the digest to me with send_message" />
        </div>
        <Btn primary className="mt-3" disabled={!!busy} onClick={saveSettings}>
          Save settings
        </Btn>
      </Card>

      <Card>
        <CardTitle>Crew</CardTitle>
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
          <label className="text-sm">
            Agent
            <Input value={agent} onChange={(e) => setAgent(e.target.value)} />
          </label>
          <label className="text-sm">
            Model (empty = agent default)
            <Input value={model} onChange={(e) => setModel(e.target.value)} />
          </label>
        </div>
        <div className="mt-3">
          <Toggle checked={unattended} onChange={setUnattended} label="Auto-approve the crew's tool calls (unattended)" />
          <p className="text-xs text-muted mt-1">
            The crew reads messages anyone in your channels can write. With auto-approve on, a crafted message can steer
            an unreviewed tool call. Leave it off unless every watched channel is trusted.
          </p>
        </div>
        <Btn
          primary
          className="mt-3"
          disabled={!!busy}
          onClick={() => act('Save crew', () => api.put(`${BASE}/crew`, { agent, model, unattended }))}
        >
          Save crew
        </Btn>
      </Card>
    </>
  )
}
