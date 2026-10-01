import { jsxs as r, Fragment as R, jsx as t } from "react/jsx-runtime";
import * as we from "@kirocrew/app-sdk";
import { useAppApi as ie, ChatEmbed as Ke } from "@kirocrew/app-sdk";
import { PageHeader as Ye, Toggle as Re, Btn as T, Card as K, CardTitle as te, StatCard as ce, Input as Z, EmptyState as Ge, Badge as Y } from "@kirocrew/app-sdk/ui";
import { useState as u, useCallback as ue, useEffect as re, useRef as le, useMemo as he } from "react";
const I = "/api/apps/slack-radar", Qe = {
  checking: "checking…",
  connected: "connected",
  needs_login: "sign in again",
  binary_not_found: "not installed",
  incompatible: "missing read access",
  error: "not working"
}, ke = ["What needs me today?", "Draft today's digest", "Which threads look resolved?"], Je = [
  { id: "board", label: "Board" },
  { id: "ledger", label: "Ledger" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" }
], oe = (e) => e ? new Date(e * 1e3).toLocaleString() : "never";
function V(e) {
  if (!e) return "never";
  const n = Math.max(0, Date.now() / 1e3 - e);
  return n < 90 ? "just now" : n < 3600 ? `${Math.round(n / 60)} min ago` : n < 86400 ? `${Math.round(n / 3600)} h ago` : oe(e);
}
function We(e, n) {
  return n === "needs_login" ? "needs_login" : (e == null ? void 0 : e.status) || "checking";
}
function xe({ children: e, summary: n = "Details" }) {
  return /* @__PURE__ */ r("details", { className: "text-xs text-muted", style: { marginTop: 6 }, children: [
    /* @__PURE__ */ t("summary", { style: { cursor: "pointer" }, children: n }),
    /* @__PURE__ */ t("div", { style: { marginTop: 4 }, children: e })
  ] });
}
const de = [
  {
    id: "lead",
    title: "Radar Lead",
    initials: "RL",
    layer: "Lead",
    kind: "Resident",
    agent: "slack-radar-crew",
    duty: "Triages every watched channel, sets category and priority, decides when a cluster needs investigating, hands possibly-resolved threads to the Thread Watcher, writes the digest headline, and answers you here. Woken by the Poller when something moved."
  },
  {
    id: "investigator",
    title: "Investigator",
    initials: "IN",
    layer: "Research",
    kind: "Joins on demand",
    agent: "slack-radar-investigator",
    duty: "Searches GitHub read-only for issues and pull requests that match a cluster of reports, and links them in the ledger."
  },
  {
    id: "watcher",
    title: "Thread Watcher",
    initials: "TW",
    layer: "Review",
    kind: "Joins after a poll",
    agent: "slack-radar-watcher",
    duty: "Dispatched for the lead after a poll flags possibly-resolved threads: one run judges the whole batch and records resolved or not in the ledger. No shell."
  },
  {
    id: "poller",
    title: "Poller",
    initials: "⟳",
    layer: "System",
    kind: "Code, no model",
    agent: "",
    duty: "Runs by itself on the poll interval: reads new messages and thread replies from Slack, flags likely resolutions, and delivers the digest. Spends no credits.",
    planned: !1
  }
], pe = (e, n) => {
  var a;
  return (a = e.now) == null ? void 0 : a.members.find((s) => s.id === n);
};
function se(e, n) {
  var l;
  const a = pe(n, e.id);
  if (e.id === "lead")
    return (a == null ? void 0 : a.state) === "paused" || !n.crew.live ? { label: "paused", tone: "muted" } : (a ? a.state === "working" : n.crew.running) ? { label: "working", tone: "aim" } : { label: "live", tone: "ok" };
  if (e.id === "poller")
    return n.source_state === "needs_login" ? { label: "sign in again", tone: "warn" } : (a == null ? void 0 : a.state) === "paused" ? { label: "paused", tone: "warn" } : { label: `polled ${V(n.last_poll_at)}`, tone: "muted" };
  const s = a ? a.count : e.id === "investigator" && ((l = n.investigations) == null ? void 0 : l.running) || 0;
  return s ? { label: `${s} running`, tone: "aim" } : (a == null ? void 0 : a.state) === "planned" ? { label: "not started yet", tone: "muted" } : { label: "idle", tone: "muted" };
}
function ae(e) {
  if (!e) return "--";
  const n = new Date(e * 1e3), a = n.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: !1 });
  return n.toDateString() === (/* @__PURE__ */ new Date()).toDateString() ? a : `${n.toLocaleDateString([], { month: "short", day: "numeric" })} ${a}`;
}
function Ve(e) {
  if (!e) return "";
  const n = Math.round(e - Date.now() / 1e3);
  return n <= 0 ? "now" : De(Date.now() / 1e3 - n);
}
function Xe(e, n) {
  if (!(n != null && n.last)) return "";
  const { started_at: a, finished_at: s } = n.last;
  if (e.id === "poller") {
    if (!a) return "has not polled yet";
    const l = Ve(n.next_at);
    return `last ${ae(a)}${l ? ` · next ${l === "now" ? "due now" : `in ${l}`}` : ""}`;
  }
  return e.id === "lead" ? a ? `last wake ${ae(a)}` : "not woken yet" : a ? s ? `last run ${ae(a)}–${ae(s)}` : `last run ${ae(a)}` : "last run --";
}
function qe(e) {
  var n, a;
  return !(e != null && e.ran) || e.ran === "running" ? "" : e.ran === "never" ? "never ran" : `idle since ${ae(((n = e.last) == null ? void 0 : n.finished_at) || ((a = e.last) == null ? void 0 : a.started_at))}`;
}
function De(e) {
  if (!e) return "";
  const n = Math.max(0, Math.round(Date.now() / 1e3 - e));
  return n < 90 ? `${n}s` : n < 90 * 60 ? `${Math.round(n / 60)}m` : `${Math.round(n / 3600)}h`;
}
const Le = (e, n = 60) => e.length > n ? `${e.slice(0, n - 1).trimEnd()}…` : e;
function Ne(e, n) {
  const a = pe(n, e.id);
  if (!a) return se(e, n).label;
  const s = Xe(e, a);
  return e.id === "poller" ? s && a.state === "paused" ? `${a.doing.split(" · ")[0]} · ${s}` : s || a.doing : a.state !== "working" ? a.state === "paused" ? `paused: ${a.doing}` : s || se(e, n).label : e.id === "lead" ? `working: ${a.doing}` : `${a.count} running: ${a.doing}`;
}
const Ze = `@keyframes slack-radar-pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.7) } }
.sr-pulse { animation: slack-radar-pulse 1.4s ease-in-out infinite }
@keyframes slack-radar-spin { to { transform: rotate(360deg) } }
.sr-spin { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: slack-radar-spin .8s linear infinite; vertical-align: -1px; margin-right: 6px }
@media (prefers-reduced-motion: reduce) { .sr-pulse, .sr-spin { animation: none } }`;
function Ae({ tone: e, pulse: n }) {
  return /* @__PURE__ */ t(
    "i",
    {
      "aria-hidden": !0,
      className: n ? "sr-pulse" : void 0,
      style: { width: 8, height: 8, borderRadius: "50%", flex: "none", display: "inline-block", background: Ie[e] }
    }
  );
}
function Fe({ m: e, state: n, withName: a = !0, withResting: s = !1, onOpen: l }) {
  const o = se(e, n), c = pe(n, e.id), p = c ? c.state === "working" : o.tone === "aim", N = s && (e.id === "investigator" || e.id === "watcher") ? qe(c) : "", b = N ? `${N} · ${Ne(e, n)}` : Ne(e, n), _ = e.id === "lead" && n.crew.name || e.title, S = /* @__PURE__ */ r(R, { children: [
    /* @__PURE__ */ t(Ae, { tone: o.tone, pulse: p }),
    a && /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: _ }),
    /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: Le(b) })
  ] }), g = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    fontSize: 13,
    opacity: p || o.tone === "warn" ? 1 : 0.6,
    color: "var(--text)"
  }, W = { title: `${_} · ${b}`, "data-member": e.id, "data-state": (c == null ? void 0 : c.state) || (p ? "working" : "idle") };
  return l ? /* @__PURE__ */ t(
    "button",
    {
      type: "button",
      onClick: l,
      ...W,
      "aria-label": `${_}: ${b}. Show activity`,
      style: { ...g, background: "transparent", border: 0, padding: 0, cursor: "pointer" },
      children: S
    }
  ) : /* @__PURE__ */ t("span", { ...W, style: g, children: S });
}
function et({ state: e, onOpenActivity: n }) {
  return /* @__PURE__ */ r(
    "div",
    {
      "data-testid": "now-strip",
      role: "status",
      "aria-label": "Who is working right now",
      className: "flex flex-wrap items-center",
      style: { gap: "6px 18px", padding: "8px 12px", marginBottom: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-elevated)", minWidth: 0 },
      children: [
        /* @__PURE__ */ t("span", { className: "text-xs text-muted", style: { fontWeight: 600, letterSpacing: ".04em" }, children: "NOW" }),
        de.map((a) => /* @__PURE__ */ t(
          Fe,
          {
            m: a,
            state: e,
            onOpen: a.id === "investigator" || a.id === "watcher" ? n : void 0
          },
          a.id
        ))
      ]
    }
  );
}
function tt({ state: e }) {
  const n = de.filter((a) => a.id === "investigator" || a.id === "watcher").map((a) => ({ m: a, row: pe(e, a.id) })).filter(({ row: a }) => (a == null ? void 0 : a.state) === "working");
  return n.length ? /* @__PURE__ */ t("div", { "data-testid": "chat-running", style: { padding: "6px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" }, children: n.map(({ m: a, row: s }) => {
    const l = De(s.since), o = `${a.title} running${s.count > 1 ? ` (${s.count})` : ""} · ${s.doing}${l ? ` · ${l}` : ""}`;
    return /* @__PURE__ */ r("div", { className: "text-xs flex items-center gap-2", title: o, style: { minWidth: 0 }, children: [
      /* @__PURE__ */ t(Ae, { tone: "aim", pulse: !0 }),
      /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: o })
    ] }, a.id);
  }) }) : null;
}
const Ie = {
  ok: "var(--ok)",
  aim: "var(--aim)",
  warn: "var(--warn)",
  muted: "var(--muted-strong)"
};
function be({ m: e, s: n, selected: a, size: s = 32 }) {
  const l = se(e, n), o = e.planned || e.id === "poller", c = {
    width: s,
    height: s,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    fontWeight: 700,
    position: "relative",
    flex: "none",
    background: o ? "transparent" : "var(--bg-hover)",
    color: o ? "var(--muted)" : "var(--text-strong)",
    border: `2px ${o ? "dashed" : "solid"} ${a ? "var(--accent)" : o ? "var(--border-strong)" : "transparent"}`,
    opacity: e.planned ? 0.6 : 1
  };
  return /* @__PURE__ */ r("span", { style: c, "aria-hidden": !0, children: [
    e.initials,
    !e.planned && /* @__PURE__ */ t(
      "i",
      {
        style: {
          position: "absolute",
          right: -2,
          bottom: -2,
          width: 10,
          height: 10,
          borderRadius: "50%",
          border: "2px solid var(--card)",
          background: Ie[l.tone]
        }
      }
    )
  ] });
}
function nt(e) {
  return e === "new" ? "warn" : e === "investigating" ? "aim" : e === "resolved" ? "ok" : "muted";
}
function at({ tab: e, setTab: n }) {
  return /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Slack Radar sections", style: { display: "flex", gap: 4 }, children: Je.map((a) => {
    const s = e === a.id;
    return /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": s,
        onClick: () => n(a.id),
        style: {
          padding: "6px 12px",
          borderRadius: 8,
          border: 0,
          cursor: "pointer",
          fontSize: 14,
          background: s ? "var(--bg-hover)" : "transparent",
          color: s ? "var(--text-strong)" : "var(--muted)"
        },
        children: a.label
      },
      a.id
    );
  }) });
}
function rt({
  state: e,
  configured: n,
  busy: a,
  onStart: s,
  onPause: l
}) {
  const o = e.crew.live;
  return /* @__PURE__ */ r("div", { className: "flex items-center gap-2", title: !o && !n ? "Add a channel in Settings first" : void 0, children: [
    /* @__PURE__ */ t("span", { className: "text-sm", children: "Crew" }),
    /* @__PURE__ */ t(
      Re,
      {
        checked: o,
        disabled: !!a || !o && !n,
        onChange: (p) => p ? s() : l(),
        label: o ? "Pause the crew" : "Start the crew"
      }
    ),
    /* @__PURE__ */ r("span", { className: "text-xs text-muted", title: "Whether the crew's commands run without asking you", children: [
      "Unattended: ",
      e.crew.trusted ? "on" : "off"
    ] })
  ] });
}
function Bt() {
  const e = ie(), [n, a] = u("board"), [s, l] = u(null), [o, c] = u([]), [p, N] = u(null), [b, _] = u([]), [S, g] = u([]), [W, L] = u("open"), [$, A] = u(/* @__PURE__ */ new Set()), [D, O] = u(""), [d, x] = u(""), [B, E] = u(null), [v, f] = u(null), [C, k] = u(null), w = ue(async () => {
    try {
      E(await e.get(`${I}/mcp/status`));
    } catch (y) {
      E({ status: "error", command: "", detail: y.message });
    }
  }, [e]);
  re(() => {
    w();
  }, [w]);
  const P = ue(async () => {
    var y;
    try {
      const [F, M, J, q, Ue] = await Promise.all([
        e.get(`${I}/state`),
        e.get(`${I}/items?status=${encodeURIComponent(W)}&limit=300`),
        e.get(`${I}/events?limit=150`),
        e.get(`${I}/needs`),
        e.get(`${I}/items?handled=1&limit=100`)
      ]);
      l(F), f(((y = F.now) == null ? void 0 : y.members) || null), c(M.items), N(q), _(Ue.items), g(J.events.slice().reverse());
    } catch (F) {
      x(`Could not load: ${F.message}`);
    }
  }, [e, W]);
  re(() => {
    P();
    const y = window.setInterval(P, 3e4);
    return () => window.clearInterval(y);
  }, [P]);
  const j = !!(v != null && v.some((y) => y.state === "working")), Q = le("");
  re(() => {
    if (!j) return;
    const y = async () => {
      try {
        const M = await e.get(`${I}/now`);
        f(M.members);
        const J = M.members.map((q) => `${q.id}:${q.state}:${q.count}`).join(",");
        if (Q.current && J !== Q.current) {
          const q = await e.get(`${I}/events?limit=150`);
          g(q.events.slice().reverse());
        }
        Q.current = J;
      } catch {
      }
    }, F = window.setInterval(y, 5e3);
    return () => window.clearInterval(F);
  }, [j, e]);
  const U = he(() => s && v ? { ...s, now: { members: v } } : s, [s, v]), ne = () => {
    k(["member", "crew", "investigate"]), a("activity");
  }, G = async (y, F) => {
    O(y), x("");
    try {
      await F(), x(`${y}: done`), await P();
    } catch (M) {
      x(`${y} failed: ${M.message}`);
    } finally {
      O("");
    }
  }, X = !!s && s.settings.channels.length > 0, H = (s == null ? void 0 : s.settings.channels.length) || 0, i = s ? `${H ? `Watching ${H} channel${H === 1 ? "" : "s"}` : "No channels yet"} · ${s.crew.live ? "running" : "paused"}` : "A small crew triaging your Slack channels", m = s ? We(B, s.source_state) : "checking", h = () => {
    w(), P();
  };
  return /* @__PURE__ */ r(R, { children: [
    /* @__PURE__ */ t(
      Ye,
      {
        title: "Slack Radar",
        subtitle: i,
        actions: /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-4", children: [
          /* @__PURE__ */ t(
            at,
            {
              tab: n,
              setTab: (y) => {
                k(null), a(y);
              }
            }
          ),
          s && /* @__PURE__ */ t(
            rt,
            {
              state: s,
              configured: X,
              busy: D,
              onStart: () => G("Start crew", () => e.post(`${I}/crew/start`, {})),
              onPause: () => G("Pause crew", () => e.post(`${I}/crew/pause`, {}))
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ t("style", { children: Ze }),
    /* @__PURE__ */ r("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      U && n === "board" && /* @__PURE__ */ t(et, { state: U, onOpenActivity: ne }),
      s && m === "needs_login" && /* @__PURE__ */ t(st, { mcp: B, sourceError: s.source_error, busy: D, onCheck: h }),
      d && /* @__PURE__ */ t("p", { role: "status", className: "text-sm text-muted mb-3", children: d }),
      U ? n === "board" ? /* @__PURE__ */ t(
        it,
        {
          state: U,
          needs: p,
          handled: b,
          configured: X,
          mcp: B,
          busy: D,
          onPoll: () => G("Poll", () => e.post(`${I}/poll`, {})),
          onStart: () => G("Start crew", () => e.post(`${I}/crew/start`, {})),
          onDigest: () => G("Digest now", () => e.post(`${I}/digest/request`, {})),
          events: S,
          onChanged: P
        }
      ) : n === "ledger" ? /* @__PURE__ */ t(
        Nt,
        {
          state: U,
          items: o,
          filter: W,
          setFilter: L,
          selected: $,
          setSelected: A,
          busy: D,
          onInvestigate: (y) => G("Investigate", async () => {
            await e.post(`${I}/investigate`, { keys: [...$], repo: y }), A(/* @__PURE__ */ new Set());
          })
        }
      ) : n === "team" ? /* @__PURE__ */ t(Wt, { state: U }) : n === "activity" ? /* @__PURE__ */ t(Dt, { events: S, kinds: C, onShowAll: () => k(null) }) : /* @__PURE__ */ t(Lt, { state: U, busy: D, act: G, mcp: B, onProbe: w }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" })
    ] })
  ] });
}
function Oe({ mcp: e, sourceError: n }) {
  var s;
  const a = [
    (e == null ? void 0 : e.status) && `status: ${e.status}`,
    (e == null ? void 0 : e.command) && `command: ${e.command}`,
    n && `error: ${n}`,
    (e == null ? void 0 : e.detail) && e.detail !== n && `detail: ${e.detail}`,
    ((s = e == null ? void 0 : e.missing_read_tools) == null ? void 0 : s.length) && `missing read tools: ${e.missing_read_tools.join(", ")}`
  ].filter(Boolean);
  return a.length ? /* @__PURE__ */ t(xe, { children: /* @__PURE__ */ t("pre", { className: "font-mono whitespace-pre-wrap", style: { margin: 0 }, children: a.join(`
`) }) }) : null;
}
function st({ mcp: e, sourceError: n, busy: a, onCheck: s }) {
  return /* @__PURE__ */ r(
    "div",
    {
      role: "alert",
      className: "mb-4",
      style: {
        border: "1px solid var(--warn)",
        background: "var(--warn-subtle)",
        borderRadius: 10,
        padding: "12px 16px"
      },
      children: [
        /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-3", children: [
          /* @__PURE__ */ r("div", { style: { flex: 1, minWidth: 240 }, children: [
            /* @__PURE__ */ t("div", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: "Slack connection: sign in again" }),
            /* @__PURE__ */ t("div", { className: "text-sm", children: "Your Slack sign-in expired, so no new messages are read. Sign in to Slack again on the computer running Kiro Crew, then check again. Nothing is lost; reading picks up where it stopped." })
          ] }),
          /* @__PURE__ */ t(T, { primary: !0, onClick: s, disabled: !!a, children: "I signed in, check again" })
        ] }),
        /* @__PURE__ */ t(Oe, { mcp: e, sourceError: n })
      ]
    }
  );
}
function Be({ mcp: e, state: n, withPoll: a, action: s }) {
  const l = We(e, n.source_state), o = l === "connected";
  return /* @__PURE__ */ r("div", { className: s ? "mb-3" : "mb-4", "data-testid": s ? "connection-line" : void 0, children: [
    /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ r("p", { role: "status", className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { margin: 0, flex: 1, minWidth: 0 }, children: [
        /* @__PURE__ */ t("span", { "aria-hidden": !0, style: { width: 8, height: 8, borderRadius: "50%", background: o ? "var(--ok)" : l === "checking" ? "var(--muted-strong)" : "var(--warn)", display: "inline-block" } }),
        /* @__PURE__ */ r("span", { children: [
          "Slack connection: ",
          /* @__PURE__ */ t("span", { style: { color: o ? "var(--text)" : "var(--warn)" }, children: Qe[l] || l })
        ] }),
        a && /* @__PURE__ */ r("span", { children: [
          "· last poll ",
          V(n.last_poll_at),
          n.settings.channels.length > 0 && /* @__PURE__ */ r(R, { children: [
            " · watching ",
            n.settings.channels.join(", ")
          ] })
        ] })
      ] }),
      s
    ] }),
    !o && l !== "needs_login" && /* @__PURE__ */ t(Oe, { mcp: e, sourceError: n.source_error })
  ] });
}
function it(e) {
  const { state: n } = e, [a, s] = u(""), [l, o] = Tt(n.crew.slot_key), c = le(null), p = (N) => {
    s(lt(N)), o(!0), window.requestAnimationFrame(() => {
      var b;
      return (b = c.current) == null ? void 0 : b.scrollIntoView({ block: "end", behavior: "smooth" });
    });
  };
  return /* @__PURE__ */ r("div", { "data-testid": "board", style: { minWidth: 0 }, children: [
    /* @__PURE__ */ t(
      Be,
      {
        mcp: e.mcp,
        state: n,
        withPoll: !0,
        action: /* @__PURE__ */ t(T, { style: z, onClick: e.onPoll, disabled: !!e.busy || !e.configured, children: "Poll now" })
      }
    ),
    !e.configured && /* @__PURE__ */ r(K, { className: "mb-4", children: [
      /* @__PURE__ */ t(te, { children: "Finish setup" }),
      /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite." })
    ] }),
    /* @__PURE__ */ t($t, { state: n, busy: e.busy, onDigest: e.onDigest }),
    /* @__PURE__ */ t(bt, { needs: e.needs, handled: e.handled, onChanged: e.onChanged, onWhy: p }),
    /* @__PURE__ */ t(
      "div",
      {
        ref: c,
        "data-testid": "chat-bar",
        "data-expanded": l ? "true" : "false",
        style: { position: "sticky", bottom: 0, zIndex: 5, marginTop: 8, borderRadius: 12, boxShadow: "0 -6px 18px rgba(0,0,0,.18)" },
        children: /* @__PURE__ */ t(
          Rt,
          {
            state: n,
            events: e.events,
            configured: e.configured,
            busy: e.busy,
            expanded: l,
            setExpanded: o,
            pending: a,
            setPending: s,
            onStart: e.onStart,
            onChanged: e.onChanged
          }
        )
      }
    )
  ] });
}
const _e = {
  decide: "Needs a decision",
  unanswered: "Questions nobody answered",
  clusters: "Reported more than once"
};
function Se(e) {
  return e < 1 ? `${Math.max(1, Math.round(e * 60))} min ago` : e < 48 ? `${Math.round(e)} h ago` : `${Math.floor(e / 24)} days ago`;
}
const $e = 5;
function lt(e) {
  return `Why is "${e.summary.length > 80 ? `${e.summary.slice(0, 79)}…` : e.summary}" ${e.priority || "on my list"}?`;
}
function Ee(e) {
  return e ? /* @__PURE__ */ t(Y, { variant: e === "p0" || e === "p1" ? "err" : "muted", children: e }) : null;
}
function ee({ message: e, onRetry: n }) {
  return /* @__PURE__ */ r(
    "div",
    {
      role: "alert",
      className: "text-sm flex flex-wrap items-center gap-2",
      style: { border: "1px solid var(--danger)", borderRadius: 8, padding: "8px 12px", margin: "8px 0" },
      children: [
        /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200 }, children: e }),
        /* @__PURE__ */ t(T, { onClick: n, children: "Try again" })
      ]
    }
  );
}
const z = { fontSize: 12, padding: "2px 10px" }, ve = (e, n) => e === "decide" && !!n.reply_draft && !n.handoff_title;
function Pe(e, n, a = !1) {
  return e === "decide" && (n.dispatch || a) ? "Done" : e === "decide" && n.handoff_title ? "Dispatch fix" : ve(e, n) ? "Open" : e === "decide" && n.reason.startsWith("Looks resolved") ? "Done" : e === "unanswered" && n.permalink ? "Reply" : "Decide";
}
function me(e) {
  return e.replace(/<([@#!])([^>|]+)\|([^>]+)>/g, (n, a, s, l) => `${a === "#" ? "#" : "@"}${l}`).replace(/<([@#!])([^>|]+)>/g, (n, a, s) => `${a === "#" ? "#" : "@"}${s}`).replace(/<([^>|]+)\|([^>]+)>/g, "$2").replace(/<([^>]+)>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
const Me = (e, n = 90) => Le(me(e).split(`
`).map((a) => a.trim()).find(Boolean) || "", n), ot = (e) => new Date(e * 1e3).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), dt = 3600, ct = (e, n, a) => `${e} ${e === 1 ? n : a}`;
function ze({ ts: e }) {
  const n = Number(e || 0);
  return n ? /* @__PURE__ */ r("span", { "data-testid": "last-reply", children: [
    " · replies · last ",
    ae(n)
  ] }) : null;
}
function ht(e) {
  var s;
  if (e.pr_url) return { url: e.pr_url, n: e.pr_number };
  const n = ((s = e.pr_urls) == null ? void 0 : s[0]) || "", a = /\/pull\/(\d+)/.exec(n);
  return { url: n, n: a ? Number(a[1]) : 0 };
}
function pt(e, n) {
  var s;
  const a = e.dispatch;
  return a ? {
    session_key: a.session_key,
    title: a.title,
    batch: a.batch && ((s = a.batch_keys) == null ? void 0 : s.length) || 0,
    state: a.state,
    pr_url: a.pr_url,
    pr_number: a.pr_number,
    trusted: a.trusted,
    pr_state: a.pr_state,
    pr_urls: a.pr_urls
  } : n || null;
}
function ut({
  e,
  groupId: n,
  first: a,
  onOpen: s,
  onMark: l,
  onDispatch: o,
  busy: c,
  fix: p,
  sentHere: N,
  failed: b,
  excluded: _,
  onExclude: S
}) {
  var E;
  const g = n === "decide" ? pt(e, N) : null, W = Pe(n, e, !!g), L = ve(n, e), [$, A] = u(!1), D = `sr-fix-${e.key.replace(/[^A-Za-z0-9]/g, "-")}`, O = () => {
    W === "Dispatch fix" ? o == null || o() : W === "Done" ? l("done") : W === "Reply" && e.permalink ? window.open(e.permalink, "_blank", "noopener,noreferrer") : s();
  }, d = ((E = g == null ? void 0 : g.pr_state) == null ? void 0 : E.state) === "merged", x = g && !d && ge[g.state] || "", B = g ? d ? ht(g) : { url: g.pr_url, n: g.pr_number } : { url: "", n: 0 };
  return /* @__PURE__ */ t(
    "li",
    {
      className: "text-sm",
      "data-testid": "need-row",
      "data-priority": e.priority || "",
      "data-age-hours": e.age_hours,
      "data-stale": e.reply_draft_stale ? "1" : "0",
      style: { padding: "8px 0", borderTop: a ? 0 : "1px solid var(--border)" },
      children: /* @__PURE__ */ r("div", { className: "flex items-start gap-2", children: [
        /* @__PURE__ */ t("div", { style: { flex: "none", minWidth: 28 }, children: Ee(e.priority) }),
        /* @__PURE__ */ r("div", { style: { minWidth: 0, flex: 1 }, children: [
          /* @__PURE__ */ t(
            "button",
            {
              type: "button",
              "data-testid": "need-open",
              onClick: s,
              title: "Open the message and its thread",
              style: { border: 0, background: "transparent", padding: 0, margin: 0, textAlign: "left", cursor: "pointer", width: "100%", color: "inherit", font: "inherit" },
              children: L ? /* @__PURE__ */ r(R, { children: [
                /* @__PURE__ */ r("div", { style: { color: "var(--text-strong)" }, children: [
                  /* @__PURE__ */ t("span", { "data-testid": "reply-ready", children: /* @__PURE__ */ t(Y, { variant: "aim", children: "Reply ready" }) }),
                  " ",
                  e.reply_draft_stale && /* @__PURE__ */ r(R, { children: [
                    /* @__PURE__ */ t("span", { "data-testid": "draft-stale", children: /* @__PURE__ */ r(Y, { variant: "warn", children: [
                      ct(e.reply_draft_stale.new_replies, "new reply", "new replies"),
                      " since draft"
                    ] }) }),
                    " "
                  ] }),
                  /* @__PURE__ */ t("span", { "data-testid": "need-first-line", children: Me(e.text || e.summary) || "(no text)" })
                ] }),
                /* @__PURE__ */ r("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
                  e.user || "someone",
                  " · ",
                  /* @__PURE__ */ t("span", { "data-testid": "need-age", children: Se(e.age_hours) })
                ] })
              ] }) : /* @__PURE__ */ r(R, { children: [
                /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
                /* @__PURE__ */ r("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
                  e.reason,
                  " · ",
                  /* @__PURE__ */ t("span", { "data-testid": "need-age", children: Se(e.age_hours) })
                ] })
              ] })
            }
          ),
          g && /* @__PURE__ */ r("div", { className: "text-xs", role: "status", style: { marginTop: 2 }, "data-testid": "fix-dispatched", children: [
            /* @__PURE__ */ t("span", { style: { color: "var(--text-strong)" }, children: "Dispatched" }),
            " · ",
            g.launched ? "opened in a new conductor chat" : g.batch ? `batch of ${g.batch}` : g.title || "Fix session",
            x && /* @__PURE__ */ r(R, { children: [
              " · ",
              x
            ] }),
            d && B.url && /* @__PURE__ */ r(R, { children: [
              " · ",
              /* @__PURE__ */ r("span", { "data-testid": "fix-pr-merged", children: [
                /* @__PURE__ */ r("a", { className: "underline", href: B.url, target: "_blank", rel: "noreferrer noopener", children: [
                  "PR #",
                  B.n
                ] }),
                " ",
                "merged ",
                /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "✓" })
              ] })
            ] }),
            g.session_key && /* @__PURE__ */ r(R, { children: [
              " · ",
              /* @__PURE__ */ t(fe, { d: g, label: "Open session" })
            ] }),
            !d && B.url && /* @__PURE__ */ r(R, { children: [
              " · ",
              /* @__PURE__ */ r("a", { className: "underline", href: B.url, target: "_blank", rel: "noreferrer noopener", children: [
                "PR #",
                B.n
              ] }),
              /* @__PURE__ */ t(He, { ps: g.pr_state })
            ] }),
            /* @__PURE__ */ t(ze, { ts: e.latest_reply })
          ] }),
          g && g.trusted === !1 && (g.state === "running" || g.state === "idle") && /* @__PURE__ */ t("div", { className: "text-xs text-muted", "data-testid": "fix-untrusted", children: "Will ask you for each tool: unattended mode is off." }),
          b && !g && /* @__PURE__ */ t(ee, { message: `Could not dispatch that fix: ${b}. Nothing was sent.`, onRetry: () => o == null ? void 0 : o() }),
          p && $ && /* @__PURE__ */ r(
            "div",
            {
              id: D,
              "data-testid": "fix-preview",
              className: "text-xs",
              style: { marginTop: 6, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6 },
              children: [
                /* @__PURE__ */ r("div", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: [
                  p.title,
                  " ",
                  p.repo && /* @__PURE__ */ t("span", { className: "text-muted font-mono", style: { fontWeight: 400 }, children: p.repo })
                ] }),
                /* @__PURE__ */ t(
                  "pre",
                  {
                    "aria-label": "Fix task",
                    style: { margin: "4px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 160, overflowY: "auto", fontFamily: "var(--font-mono, monospace)" },
                    children: p.prompt
                  }
                ),
                S && /* @__PURE__ */ r("label", { className: "flex items-center gap-1", style: { marginTop: 6, cursor: "pointer" }, children: [
                  /* @__PURE__ */ t("input", { type: "checkbox", checked: !!_, onChange: (v) => S(v.target.checked) }),
                  "Exclude from batch"
                ] })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ t("div", { className: "flex items-center gap-1", style: { flex: "none" }, "data-testid": "need-actions", children: /* @__PURE__ */ t(T, { primary: !0, style: z, onClick: O, disabled: c, children: W === "Dispatch fix" && c ? /* @__PURE__ */ r(R, { children: [
          /* @__PURE__ */ t("span", { className: "sr-spin", "aria-hidden": !0 }),
          "Dispatching…"
        ] }) : W }) }),
        p && /* @__PURE__ */ t(
          "button",
          {
            type: "button",
            "data-testid": "fix-toggle",
            "aria-expanded": $,
            "aria-controls": D,
            "aria-label": $ ? "Hide the fix" : "Show the fix",
            onClick: () => A(!$),
            style: { flex: "none", border: 0, background: "transparent", cursor: "pointer", padding: "2px 4px", color: "var(--muted)" },
            children: $ ? "▴" : "▾"
          }
        )
      ] })
    }
  );
}
function mt({
  e,
  groupId: n,
  onClose: a,
  onSend: s,
  onMark: l,
  onWhy: o,
  onDispatch: c,
  busy: p,
  sentHere: N,
  reanalyze: b
}) {
  var m;
  const _ = ve(n, e), S = Pe(n, e, N), [g, W] = u(e.reply_draft || ""), [L, $] = u(!1), [A, D] = u(null), [O, d] = u(""), x = le(null), B = le(null), E = le(null), v = e.key.replace(/[^A-Za-z0-9]/g, "-"), f = `sr-detail-${v}`, C = `sr-reply-${v}`, k = e.replies || [], w = e.reply_draft_at || 0, P = (h) => !!e.reply_draft && w > 0 && Number(h.ts) > w, j = ((m = e.reply_draft_stale) == null ? void 0 : m.new_replies) || 0, Q = e.last_thread_check_at || 0, U = Q > 0 && Date.now() / 1e3 - Q > dt;
  re(() => {
    const h = document.activeElement;
    return window.requestAnimationFrame(() => {
      var y;
      return (y = _ ? B.current : E.current) == null ? void 0 : y.focus();
    }), () => {
      h && h.isConnected && h.focus();
    };
  }, []);
  const ne = async () => {
    const h = g.trim();
    d(""), $(!0);
    const y = await s(h, h !== (e.reply_draft || "").trim());
    $(!1), y.ok ? D(y.link) : d(y.why);
  }, G = (h) => {
    if (h.key === "Escape") {
      h.stopPropagation(), a();
      return;
    }
    if (h.key !== "Tab" || !x.current) return;
    const y = [...x.current.querySelectorAll("a[href], button:not([disabled]), textarea, input, select")];
    if (y.length === 0) return;
    const F = y[0], M = y[y.length - 1];
    h.shiftKey && document.activeElement === F ? (h.preventDefault(), M.focus()) : !h.shiftKey && document.activeElement === M && (h.preventDefault(), F.focus());
  }, X = (h) => () => {
    h(), a();
  }, H = { marginTop: 14 }, i = { margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "var(--text-strong)" };
  return /* @__PURE__ */ t(
    "div",
    {
      "data-testid": "need-detail-backdrop",
      onMouseDown: (h) => h.target === h.currentTarget && a(),
      style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.35)", display: "flex", justifyContent: "flex-end" },
      children: /* @__PURE__ */ r(
        "div",
        {
          ref: x,
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": f,
          "data-testid": "need-detail",
          onKeyDown: G,
          className: "text-sm",
          style: {
            width: "min(560px, 100%)",
            height: "100%",
            overflowY: "auto",
            padding: "16px 20px",
            background: "var(--card, var(--bg))",
            color: "var(--text)",
            borderLeft: "1px solid var(--border)"
          },
          children: [
            /* @__PURE__ */ r("div", { className: "flex items-start gap-2", children: [
              /* @__PURE__ */ t("div", { style: { flex: "none" }, children: Ee(e.priority) }),
              /* @__PURE__ */ t("h3", { id: f, style: { margin: 0, flex: 1, fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }, children: Me(e.text || e.summary, 80) || "(no text)" }),
              /* @__PURE__ */ t(
                "button",
                {
                  ref: E,
                  type: "button",
                  "aria-label": "Close",
                  onClick: a,
                  style: { border: 0, background: "transparent", cursor: "pointer", padding: "0 6px", fontSize: 18, lineHeight: 1, color: "var(--muted)" },
                  children: "×"
                }
              )
            ] }),
            /* @__PURE__ */ r("section", { "aria-label": "Original message", "data-testid": "detail-original", style: H, children: [
              /* @__PURE__ */ t("h4", { style: i, children: "Original message" }),
              /* @__PURE__ */ r("div", { className: "text-xs text-muted", children: [
                /* @__PURE__ */ t("span", { "data-testid": "detail-author", children: e.user || "someone" }),
                " · ",
                /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
                " · ",
                oe(e.ts_float),
                e.permalink && /* @__PURE__ */ r(R, { children: [
                  " · ",
                  /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open in Slack" })
                ] })
              ] }),
              /* @__PURE__ */ t("p", { style: { margin: "6px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }, "data-testid": "detail-text", children: me(e.text || e.summary) || "(no text)" })
            ] }),
            /* @__PURE__ */ r("section", { "aria-label": "Thread replies", "data-testid": "detail-replies", style: H, children: [
              /* @__PURE__ */ r("h4", { style: i, children: [
                "Thread replies (",
                k.length,
                ")",
                U && /* @__PURE__ */ r("span", { className: "text-xs text-muted", style: { fontWeight: 400 }, "data-testid": "replies-stale", children: [
                  " · ",
                  "replies as of ",
                  ot(Q)
                ] })
              ] }),
              k.length === 0 ? /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: 0 }, children: "No replies yet" }) : /* @__PURE__ */ t("ol", { className: "flex flex-col", style: { margin: 0, padding: 0, listStyle: "none" }, children: k.map((h, y) => /* @__PURE__ */ r(
                "li",
                {
                  "data-testid": P(h) ? "reply-new" : "reply-old",
                  style: {
                    padding: P(h) ? "4px 0 4px 8px" : "4px 0",
                    borderTop: y === 0 ? 0 : "1px solid var(--border)",
                    ...P(h) ? { borderLeft: "3px solid var(--warn, #d97706)" } : {}
                  },
                  children: [
                    /* @__PURE__ */ r("div", { className: "text-xs text-muted", children: [
                      P(h) && /* @__PURE__ */ r(R, { children: [
                        /* @__PURE__ */ t(Y, { variant: "warn", children: "new" }),
                        " "
                      ] }),
                      h.user || "someone",
                      " · ",
                      oe(Number(h.ts))
                    ] }),
                    /* @__PURE__ */ t("div", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" }, children: me(h.text) })
                  ]
                },
                `${h.ts}-${y}`
              )) })
            ] }),
            !_ && /* @__PURE__ */ r("section", { "aria-label": "Why it is here", style: H, className: "text-xs text-muted", children: [
              e.reason,
              e.category && /* @__PURE__ */ r(R, { children: [
                " · ",
                e.category
              ] }),
              e.words && e.words.length > 0 && /* @__PURE__ */ r(R, { children: [
                " · shared words: ",
                e.words.join(", ")
              ] }),
              e.members && e.members.length > 0 && /* @__PURE__ */ r(R, { children: [
                " · Done and Ignore apply to all ",
                e.members.length
              ] }),
              e.handoff_title && !e.dispatch && !N && /* @__PURE__ */ r("div", { style: { marginTop: 4, color: "var(--text)" }, children: [
                "Fix: ",
                e.handoff_title
              ] })
            ] }),
            _ && /* @__PURE__ */ r("section", { "aria-label": "Reply draft", "data-testid": "detail-draft", style: H, children: [
              /* @__PURE__ */ t("label", { htmlFor: C, style: { ...i, display: "block" }, children: "Reply to the thread, sent as you" }),
              /* @__PURE__ */ r("div", { className: "text-xs text-muted", "data-testid": "draft-by", children: [
                e.reply_draft_by === "owner" ? "Edited by you" : "Drafted by the Radar Lead",
                e.reply_draft_at ? ` · ${V(e.reply_draft_at)}` : ""
              ] }),
              /* @__PURE__ */ t(
                "textarea",
                {
                  id: C,
                  ref: B,
                  value: g,
                  maxLength: 1500,
                  rows: 6,
                  readOnly: A !== null,
                  onChange: (h) => W(h.target.value),
                  style: {
                    width: "100%",
                    marginTop: 4,
                    fontSize: 13,
                    padding: "6px 8px",
                    borderRadius: 6,
                    resize: "vertical",
                    border: "1px solid var(--border-strong)",
                    background: "var(--bg)",
                    color: "var(--text)"
                  }
                }
              )
            ] }),
            O && /* @__PURE__ */ t(ee, { message: `Could not send that reply: ${O}`, onRetry: ne }),
            _ && j > 0 && A === null && /* @__PURE__ */ t("p", { role: "status", "data-testid": "draft-stale-warning", className: "text-sm", style: { ...H, marginBottom: 0, color: "var(--text-strong)" }, children: j === 1 ? "1 reply arrived after this draft — read it first" : `${j} replies arrived after this draft — read them first` }),
            e.needs_reanalysis && b && A === null && /* @__PURE__ */ r("div", { style: H, "data-testid": "detail-reanalyze", children: [
              /* @__PURE__ */ t(T, { style: z, disabled: b.busy || b.inFlight, onClick: () => b.run([e.key], e.key), children: b.inFlight || b.busy ? "Re-analyzing…" : "Re-analyze this" }),
              b.failed && b.failed.from === e.key && /* @__PURE__ */ t(ee, { message: b.failed.why, onRetry: () => b.run(b.failed.keys, e.key) })
            ] }),
            A !== null ? /* @__PURE__ */ r("div", { style: H, className: "flex flex-wrap items-center gap-2", children: [
              /* @__PURE__ */ r("p", { role: "status", style: { margin: 0, flex: 1 }, children: [
                "Sent as you",
                A && /* @__PURE__ */ r(R, { children: [
                  " · ",
                  /* @__PURE__ */ t("a", { className: "underline", href: A, target: "_blank", rel: "noreferrer noopener", "data-testid": "sent-link", children: "Open the reply in Slack" })
                ] })
              ] }),
              /* @__PURE__ */ t(T, { primary: !0, style: z, onClick: a, children: "Close" })
            ] }) : /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-1", style: H, "data-testid": "detail-actions", children: [
              _ && /* @__PURE__ */ t(T, { primary: !0, style: z, disabled: !g.trim() || L, onClick: ne, children: L ? "Sending…" : "Send to thread" }),
              S === "Dispatch fix" && /* @__PURE__ */ t(T, { primary: !0, style: z, disabled: p, onClick: X(() => c == null ? void 0 : c()), children: "Dispatch fix" }),
              S === "Reply" && e.permalink && /* @__PURE__ */ t(T, { primary: !0, style: z, onClick: () => window.open(e.permalink, "_blank", "noopener,noreferrer"), children: "Reply" }),
              /* @__PURE__ */ t(T, { style: z, onClick: X(() => l("done")), children: _ ? "Done without sending" : "Done" }),
              /* @__PURE__ */ t(T, { style: z, onClick: X(() => l("ignored")), children: "Ignore" }),
              /* @__PURE__ */ t(T, { style: z, onClick: X(o), children: "Why? Ask the lead" })
            ] }),
            S === "Reply" && A === null && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "6px 0 0" }, children: "Reply opens the thread in Slack." })
          ]
        }
      )
    }
  );
}
function gt({ g: e, render: n }) {
  const [a, s] = u(!1), l = a ? e.shown : e.shown.slice(0, $e), o = e.shown.length - l.length;
  return /* @__PURE__ */ r(R, { children: [
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: l.map(n) }),
    (o > 0 || a && e.shown.length > $e) && /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        className: "text-xs underline",
        onClick: () => s(!a),
        style: { border: 0, background: "transparent", cursor: "pointer", padding: "4px 0", color: "var(--muted)" },
        children: a ? "Show fewer" : `Show ${o} more`
      }
    )
  ] });
}
const je = typeof we.useChatLauncher == "function" ? we.useChatLauncher : () => null, ge = { running: "working", idle: "idle", closed: "done", unknown: "" }, ft = { open: "open", draft: "draft", closed: "closed, not merged" };
function He({ ps: e }) {
  const n = e ? ft[e.state] : "";
  return n ? /* @__PURE__ */ r("span", { "data-testid": "fix-pr-state", children: [
    " ",
    n
  ] }) : null;
}
function fe({ d: e, label: n }) {
  const a = je(), s = `/chat?sid=${encodeURIComponent(e.session_key)}`;
  return /* @__PURE__ */ t(
    "a",
    {
      className: "underline",
      href: s,
      onClick: (l) => {
        a && (l.preventDefault(), a.openChat({ slotKey: e.session_key }));
      },
      children: n || e.title || "Fix session"
    }
  );
}
function ye(e) {
  try {
    return JSON.parse(String(e.body || "{}"));
  } catch {
    return {};
  }
}
function yt(e) {
  const n = ie(), a = je(), [s, l] = u(/* @__PURE__ */ new Set()), [o, c] = u({}), [p, N] = u({}), [b, _] = u(null), [S, g] = u(null), [W, L] = u(!1), $ = (f, C) => c((k) => Object.fromEntries([...Object.entries(k), ...f.map((w) => [w, C])])), A = (f, C) => N((k) => Object.fromEntries([...Object.entries(k), ...f.map((w) => [w, C])])), D = (f) => N((C) => Object.fromEntries(Object.entries(C).filter(([k]) => !f.includes(k)))), O = (f, C, k) => {
    a ? (a.openChat({ agent: f.agent, message: f.seed, autoSend: !0 }), $(C, { session_key: "", title: f.title, batch: k, state: "", pr_url: "", pr_number: 0, launched: !0 })) : (L(!1), g({ title: f.title, seed: f.seed }));
  }, d = async (f, C) => {
    if (!(s.size || f.length === 0)) {
      l(new Set(f));
      try {
        await C();
      } finally {
        l(/* @__PURE__ */ new Set());
      }
    }
  }, x = (f) => d([f], async () => {
    D([f]);
    try {
      const C = await n.post(`${I}/items/handoff/dispatch`, { key: f });
      C.mode === "server" ? $([f], { session_key: C.session_key, title: C.title, batch: 0, state: "running", pr_url: "", pr_number: 0, trusted: C.trusted }) : O(C, [f], 0), e();
    } catch (C) {
      const k = ye(C);
      k.code === "already_dispatched" && k.session_key ? $([f], { session_key: k.session_key, title: k.title || "", batch: 0, state: "", pr_url: "", pr_number: 0 }) : A([f], k.error || "the gateway refused it");
    }
  }), B = (f) => d(f, async () => {
    var C;
    _(null);
    try {
      const k = await n.post(`${I}/items/handoff/dispatch-batch`, { keys: f });
      k.mode === "server" ? $(f, { session_key: k.session_key, title: k.title, batch: f.length, state: "running", pr_url: "", pr_number: 0, trusted: k.trusted }) : O(k, f, f.length), e();
    } catch (k) {
      const w = ye(k), P = (C = w.dispatched) != null && C.length ? `${w.dispatched.length} of them already have a session` : w.error || "the gateway refused it";
      _({ keys: f, why: P });
    }
  }), E = async () => {
    if (S)
      try {
        await navigator.clipboard.writeText(S.seed), L(!0);
      } catch {
        L(!1);
      }
  }, v = S && /* @__PURE__ */ t(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "sr-fix-title",
      style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" },
      onKeyDown: (f) => f.key === "Escape" && g(null),
      children: /* @__PURE__ */ r("div", { style: { width: "min(720px, 92vw)", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: 16 }, children: [
        /* @__PURE__ */ t("h3", { id: "sr-fix-title", className: "text-sm", style: { margin: "0 0 6px", fontWeight: 600 }, children: S.title }),
        /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 8px" }, children: "This Kiro Crew cannot open the session for you. Copy this task into a new kirocrew-conductor chat." }),
        /* @__PURE__ */ t(
          "textarea",
          {
            readOnly: !0,
            "aria-label": "Fix task",
            value: S.seed,
            style: { width: "100%", height: 260, fontSize: 12, fontFamily: "var(--font-mono, monospace)" }
          }
        ),
        /* @__PURE__ */ r("div", { className: "flex items-center gap-2", style: { marginTop: 8 }, children: [
          /* @__PURE__ */ t(T, { onClick: E, children: W ? "Copied" : "Copy task" }),
          /* @__PURE__ */ t("a", { className: "underline text-sm", href: "/chat?new=1", children: "New chat" }),
          /* @__PURE__ */ t("div", { className: "flex-1" }),
          /* @__PURE__ */ t(T, { onClick: () => g(null), children: "Close" })
        ] })
      ] })
    }
  );
  return { dispatch: x, dispatchBatch: B, busy: s, sent: o, failed: p, batchFailed: b, ui: v };
}
const Ce = 10;
function xt(e, n) {
  var _;
  const a = ie(), [s, l] = u(!1), [o, c] = u(!1), [p, N] = u(null);
  return re(() => c(!1), [e]), { run: async (S, g) => {
    if (!(s || S.length === 0)) {
      N(null), l(!0);
      try {
        await a.post(`${I}/items/reanalyze`, { keys: S }), c(!0), n();
      } catch (W) {
        const L = ye(W), $ = L.code === "reanalyze_in_flight" ? "The Radar Lead is still re-analyzing the last request. Nothing new was sent." : `Could not ask the Radar Lead to re-analyze: ${L.error || "the gateway refused it"}. Nothing was sent.`;
        N({ keys: S, from: g, why: $ });
      } finally {
        l(!1);
      }
    }
  }, busy: s, inFlight: o || !!((_ = e == null ? void 0 : e.reanalyze) != null && _.in_flight), failed: p };
}
function bt({
  needs: e,
  handled: n,
  onChanged: a,
  onWhy: s
}) {
  var H;
  const l = ie(), o = yt(a), c = xt(e, a), p = e == null ? void 0 : e.reanalyze, N = p ? p.total > p.keys.length ? `Re-analyze ${p.keys.length} of ${p.total} stale` : `Re-analyze ${p.total} stale` : "", b = (e == null ? void 0 : e.fixes) || [], _ = (e == null ? void 0 : e.fix_batches) || [], S = new Map(_.map((i) => [i.session_key, i])), g = new Map(((e == null ? void 0 : e.handoffs) || []).map((i) => [i.key, i.handoff])), W = (i) => {
    const m = g.get(i.key);
    return i.handoff_title ? { title: i.handoff_title || (m == null ? void 0 : m.title) || "", prompt: (m == null ? void 0 : m.prompt) || "", repo: (m == null ? void 0 : m.repo) || "" } : void 0;
  }, L = (((H = ((e == null ? void 0 : e.groups) || []).find((i) => i.id === "decide")) == null ? void 0 : H.entries) || []).filter((i) => i.handoff_title && !i.dispatch && !o.sent[i.key] && g.has(i.key)).map((i) => ({ key: i.key, repo: g.get(i.key).repo || "" })), [$, A] = u(/* @__PURE__ */ new Set()), D = L.filter((i) => !$.has(i.key)), d = new Set(D.map((i) => i.repo.toLowerCase())).size > 1 ? "one repo per batch: exclude the others from their ▾" : D.length > Ce ? `at most ${Ce} per batch: exclude some from their ▾` : "", [x, B] = u(null), E = async (i, m, h, y) => {
    var F, M;
    try {
      h && await l.post(`${I}/items/reply/draft`, { key: i, text: m });
      const J = await l.post(`${I}/items/reply/send`, { key: i });
      return P((q) => new Set(q).add(y)), a(), { ok: !0, link: String(((M = (F = J == null ? void 0 : J.item) == null ? void 0 : F.replied) == null ? void 0 : M.permalink) || "") };
    } catch (J) {
      return { ok: !1, why: J.message || "unknown error" };
    }
  }, v = (e == null ? void 0 : e.replied) || [], [f, C] = u(""), k = async (i) => {
    C("");
    try {
      await l.post(`${I}/items/handoff/dismiss`, { key: i }), a();
    } catch {
      C(i);
    }
  }, [w, P] = u(/* @__PURE__ */ new Set()), [j, Q] = u(null);
  re(() => P(/* @__PURE__ */ new Set()), [e]);
  const U = async (i, m, h) => {
    Q(null), h && P((y) => new Set(y).add(h));
    try {
      for (const y of i) await l.post(`${I}/items/handle`, { key: y, how: m });
      a();
    } catch {
      h && P((y) => {
        const F = new Set(y);
        return F.delete(h), F;
      }), Q({ keys: i, how: m, rowId: h });
    }
  }, ne = ((e == null ? void 0 : e.groups) || []).map((i) => ({
    ...i,
    shown: i.entries.filter((m) => !w.has(`${i.id}:${m.key}`))
  })), G = ne.every((i) => i.shown.length === 0), X = (j == null ? void 0 : j.how) === "reopen" ? "reopen" : (j == null ? void 0 : j.how) === "ignored" ? "ignore" : "mark as done";
  return /* @__PURE__ */ r(K, { className: "mb-4", children: [
    /* @__PURE__ */ r("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ t(te, { children: "Needs you" }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      p && (p.total > 0 || c.inFlight) && /* @__PURE__ */ t(
        T,
        {
          primary: !0,
          style: z,
          "data-testid": "reanalyze",
          title: "Ask the Radar Lead to re-read these threads and rewrite or withdraw each draft. Nothing is sent to Slack.",
          disabled: c.busy || c.inFlight || p.keys.length === 0,
          onClick: () => c.run(p.keys, "card"),
          children: c.busy || c.inFlight ? /* @__PURE__ */ r(R, { children: [
            /* @__PURE__ */ t("span", { className: "sr-spin", "aria-hidden": !0 }),
            "Re-analyzing…"
          ] }) : N
        }
      )
    ] }),
    c.failed && c.failed.from === "card" && /* @__PURE__ */ t(ee, { message: c.failed.why, onRetry: () => c.run(c.failed.keys, "card") }),
    j && /* @__PURE__ */ t(
      ee,
      {
        message: `Could not ${X} that message. Nothing changed.`,
        onRetry: () => U(j.keys, j.how, j.rowId)
      }
    ),
    e ? G ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Nothing needs you right now." }) : ne.map(
      (i) => i.shown.length === 0 ? null : /* @__PURE__ */ r("section", { "aria-label": _e[i.id], style: { marginTop: 10 }, children: [
        /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2", children: [
          /* @__PURE__ */ r("h4", { className: "text-sm", style: { margin: 0, fontWeight: 600, color: "var(--text-strong)" }, children: [
            _e[i.id],
            " ",
            /* @__PURE__ */ r("span", { className: "text-muted", style: { fontWeight: 400 }, children: [
              "(",
              i.total - (i.entries.length - i.shown.length),
              ")"
            ] })
          ] }),
          /* @__PURE__ */ t("div", { className: "flex-1" }),
          i.id === "decide" && L.length >= 2 && /* @__PURE__ */ r(R, { children: [
            d && /* @__PURE__ */ t("span", { className: "text-xs text-muted", role: "status", children: d }),
            /* @__PURE__ */ t(
              T,
              {
                style: z,
                onClick: () => o.dispatchBatch(D.map((m) => m.key)),
                disabled: o.busy.size > 0 || D.length === 0 || !!d,
                children: D.length > 0 && o.busy.has(D[0].key) && o.busy.size > 1 ? /* @__PURE__ */ r(R, { children: [
                  /* @__PURE__ */ t("span", { className: "sr-spin", "aria-hidden": !0 }),
                  "Dispatching…"
                ] }) : `Dispatch all fixes (${D.length})`
              }
            )
          ] })
        ] }),
        i.id === "decide" && o.batchFailed && /* @__PURE__ */ t(
          ee,
          {
            message: `Could not dispatch those fixes: ${o.batchFailed.why}. Nothing was sent.`,
            onRetry: () => o.dispatchBatch(o.batchFailed.keys)
          }
        ),
        /* @__PURE__ */ t(
          gt,
          {
            g: i,
            render: (m, h) => /* @__PURE__ */ t(
              ut,
              {
                e: m,
                groupId: i.id,
                first: h === 0,
                onOpen: () => B({ e: m, groupId: i.id }),
                onMark: (y) => {
                  var F;
                  return U((F = m.members) != null && F.length ? m.members : [m.key], y, `${i.id}:${m.key}`);
                },
                onDispatch: i.id === "decide" && m.handoff_title ? () => o.dispatch(m.key) : void 0,
                busy: o.busy.has(m.key),
                fix: i.id === "decide" ? W(m) : void 0,
                sentHere: o.sent[m.key],
                failed: i.id === "decide" ? o.failed[m.key] : void 0,
                excluded: $.has(m.key),
                onExclude: i.id === "decide" && L.length >= 2 && L.some((y) => y.key === m.key) ? (y) => A((F) => {
                  const M = new Set(F);
                  return y ? M.add(m.key) : M.delete(m.key), M;
                }) : void 0
              },
              m.key
            )
          }
        )
      ] }, i.id)
    ) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" }),
    f && /* @__PURE__ */ t(ee, { message: "Could not dismiss that hand-off. Nothing changed.", onRetry: () => k(f) }),
    b.length > 0 && /* @__PURE__ */ r("details", { style: { marginTop: 12 }, "data-testid": "fixes-in-flight", children: [
      /* @__PURE__ */ r("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Fixes in flight (",
        (e == null ? void 0 : e.fixes_total) ?? b.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: b.map((i, m) => {
        const h = i.dispatch.batch ? S.get(i.dispatch.session_key) : void 0, y = h && h.keys[0] === i.key, F = { padding: "6px 0", borderTop: m === 0 ? 0 : "1px solid var(--border)" }, M = i.dispatch.pr_url && /* @__PURE__ */ r(R, { children: [
          " · ",
          /* @__PURE__ */ r("a", { className: "underline", href: i.dispatch.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
            "PR #",
            i.dispatch.pr_number
          ] }),
          /* @__PURE__ */ t(He, { ps: i.dispatch.pr_state })
        ] });
        return /* @__PURE__ */ r("li", { className: "text-sm", style: h ? { ...F, ...y ? {} : { borderTop: 0, paddingTop: 0 } } : F, children: [
          y && h && /* @__PURE__ */ r("div", { "data-testid": "fix-batch-header", style: { marginBottom: 4 }, children: [
            /* @__PURE__ */ t(fe, { d: h }),
            /* @__PURE__ */ r("span", { className: "text-xs text-muted", children: [
              " · ",
              ge[h.state] || h.state || "sent",
              " · ",
              /* @__PURE__ */ t("span", { className: "font-mono", children: h.repo }),
              " · ",
              h.prs_found,
              " PRs found / ",
              h.total,
              " · ",
              V(h.at)
            ] })
          ] }),
          /* @__PURE__ */ r("div", { className: "flex items-center gap-2", style: h ? { paddingLeft: 16 } : void 0, children: [
            /* @__PURE__ */ r("span", { style: { flex: 1, minWidth: 0 }, children: [
              h ? i.handoff_title : /* @__PURE__ */ r(R, { children: [
                /* @__PURE__ */ t(fe, { d: i.dispatch }),
                /* @__PURE__ */ r("span", { className: "text-xs text-muted", children: [
                  " · ",
                  ge[i.dispatch.state] || i.dispatch.state || "sent",
                  " · ",
                  /* @__PURE__ */ t("span", { className: "font-mono", children: i.repo }),
                  " · ",
                  V(i.dispatch.at)
                ] })
              ] }),
              M,
              /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: /* @__PURE__ */ t(ze, { ts: i.latest_reply }) })
            ] }),
            /* @__PURE__ */ t(T, { style: z, onClick: () => k(i.key), children: "Dismiss" })
          ] })
        ] }, i.key);
      }) })
    ] }),
    ((e == null ? void 0 : e.handled_total) || 0) > 0 && /* @__PURE__ */ r("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ r("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Handled (",
        e == null ? void 0 : e.handled_total,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: n.map((i, m) => /* @__PURE__ */ r(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: m === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 0 }, children: i.summary || i.text.slice(0, 200) }),
            /* @__PURE__ */ r("span", { className: "text-xs text-muted", children: [
              i.handled_how === "ignored" ? "Ignored" : "Done",
              " ",
              V(i.handled_at)
            ] }),
            /* @__PURE__ */ t(T, { style: z, onClick: () => U([i.key], "reopen"), children: "Reopen" })
          ]
        },
        i.key
      )) })
    ] }),
    v.length > 0 && /* @__PURE__ */ r("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ r("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Replied (",
        (e == null ? void 0 : e.replied_total) ?? v.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: v.map((i, m) => /* @__PURE__ */ r(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: m === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ r("span", { style: { flex: 1, minWidth: 0 }, children: [
              i.text.length > 120 ? `${i.text.slice(0, 119)}…` : i.text,
              /* @__PURE__ */ r("span", { className: "text-xs text-muted", children: [
                " · ",
                i.summary,
                " · ",
                /* @__PURE__ */ t("span", { className: "font-mono", children: i.channel }),
                " · ",
                V(i.at)
              ] })
            ] }),
            i.permalink && /* @__PURE__ */ t("a", { className: "underline text-xs", href: i.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open reply" })
          ]
        },
        i.key
      )) })
    ] }),
    x && /* @__PURE__ */ t(
      mt,
      {
        e: x.e,
        groupId: x.groupId,
        sentHere: !!o.sent[x.e.key],
        onClose: () => B(null),
        onSend: (i, m) => E(x.e.key, i, m, `${x.groupId}:${x.e.key}`),
        onMark: (i) => {
          var m;
          return U((m = x.e.members) != null && m.length ? x.e.members : [x.e.key], i, `${x.groupId}:${x.e.key}`);
        },
        onWhy: () => s(x.e),
        onDispatch: x.groupId === "decide" && x.e.handoff_title ? () => o.dispatch(x.e.key) : void 0,
        busy: o.busy.has(x.e.key),
        reanalyze: c
      },
      `${x.groupId}:${x.e.key}`
    ),
    o.ui
  ] });
}
function vt({ it: e, first: n, checked: a, onToggle: s }) {
  var p, N;
  const l = (N = (p = e.fix_handoff) == null ? void 0 : p.pr_state) == null ? void 0 : N.state, o = l === "merged" || l === "closed" ? { label: l === "merged" ? "fix merged" : "fix PR closed", variant: l === "merged" ? "ok" : "warn" } : e.priority ? { label: e.priority, variant: e.priority === "p0" || e.priority === "p1" ? "err" : "muted" } : e.possibly_resolved ? { label: "possibly resolved", variant: "warn" } : null, c = [
    (l === "merged" || l === "closed") && e.priority && `priority: ${e.priority}`,
    l && l !== "merged" && l !== "closed" && `fix PR: ${l}`,
    e.category && `category: ${e.category}`,
    e.possibly_resolved && `possibly resolved: ${e.possibly_resolved.reason}`
  ].filter(Boolean);
  return /* @__PURE__ */ t("li", { className: "text-sm", style: { padding: "10px 0", borderTop: n ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ r("div", { className: "flex items-start gap-2", children: [
    /* @__PURE__ */ t(
      "input",
      {
        type: "checkbox",
        "aria-label": `Select ${e.key} for investigation`,
        checked: a,
        onChange: s,
        style: { marginTop: 4 }
      }
    ),
    /* @__PURE__ */ r("div", { className: "flex items-center gap-1", style: { flex: "none" }, children: [
      /* @__PURE__ */ t(Y, { variant: nt(e.status), children: e.status }),
      o && /* @__PURE__ */ t(Y, { variant: o.variant, children: o.label }),
      c.length > 0 && /* @__PURE__ */ r("span", { className: "text-xs text-muted", title: c.join(`
`), "aria-label": c.join("; "), children: [
        "+",
        c.length
      ] })
    ] }),
    /* @__PURE__ */ r("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || e.text.slice(0, 280) }),
      /* @__PURE__ */ r("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        /* @__PURE__ */ t("span", { "data-testid": "ledger-ts", "data-ts": e.ts_float, children: V(e.ts_float) }),
        " · ",
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        e.user && /* @__PURE__ */ r(R, { children: [
          " · ",
          e.user
        ] }),
        e.reply_count > 0 && /* @__PURE__ */ r(R, { children: [
          " · ",
          e.reply_count,
          " replies"
        ] }),
        " · ",
        /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "open in Slack" }),
        e.links.length > 0 && /* @__PURE__ */ r(R, { children: [
          " · linked ",
          e.links.map((b) => /* @__PURE__ */ t("a", { className: "underline mr-2", href: b, target: "_blank", rel: "noreferrer noopener", children: b.replace("https://github.com/", "") }, b))
        ] })
      ] }),
      e.note && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: e.note })
    ] })
  ] }) });
}
function wt(e) {
  var n, a;
  return !!((n = e.reply_draft) != null && n.text || (a = e.fix_handoff) != null && a.prompt || e.possibly_resolved);
}
const kt = ["", "p0", "p1", "p2", "p3", "none"];
function Nt(e) {
  const { state: n, items: a, selected: s, setSelected: l } = e, [o, c] = u(""), [p, N] = u(""), [b, _] = u(""), [S, g] = u(!1), W = n.counts.open_by_priority, L = he(() => [...new Set(a.map((d) => d.category).filter(Boolean))].sort(), [a]), $ = he(
    () => a.filter((d) => !p || (p === "none" ? !d.priority : d.priority === p)).filter((d) => !b || d.category === b).filter((d) => !S || wt(d)).sort((d, x) => (x.ts_float || 0) - (d.ts_float || 0)),
    [a, p, b, S]
  ), A = (d) => {
    const x = new Set(s);
    x.has(d) ? x.delete(d) : x.add(d), l(x);
  }, D = he(
    () => n.settings.channels.map((d) => ({ cid: d, ...n.channels[d] || {} })),
    [n]
  ), O = "text-sm bg-transparent border rounded px-2 py-1";
  return /* @__PURE__ */ r("div", { style: { minWidth: 0 }, children: [
    /* @__PURE__ */ r("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4", children: [
      /* @__PURE__ */ t(ce, { label: "Awaiting triage", value: n.counts.needs_triage, accent: !0 }),
      /* @__PURE__ */ t(ce, { label: "Possibly resolved", value: n.counts.possibly_resolved }),
      /* @__PURE__ */ t(ce, { label: "Open p0 / p1", value: `${W.p0 || 0} / ${W.p1 || 0}` }),
      /* @__PURE__ */ t(ce, { label: "Tracked items", value: n.counts.total })
    ] }),
    /* @__PURE__ */ r(K, { className: "mb-4", children: [
      /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2 mb-3", children: [
        /* @__PURE__ */ t(te, { children: "Ledger" }),
        /* @__PURE__ */ r("span", { className: "text-xs text-muted", "data-testid": "ledger-count", children: [
          $.length,
          " of ",
          a.length,
          " · newest first"
        ] }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-filter", children: "Status" }),
        /* @__PURE__ */ r("select", { id: "sr-filter", className: O, value: e.filter, onChange: (d) => e.setFilter(d.target.value), children: [
          /* @__PURE__ */ t("option", { value: "open", children: "open" }),
          /* @__PURE__ */ t("option", { value: "new", children: "new" }),
          /* @__PURE__ */ t("option", { value: "triaged", children: "triaged" }),
          /* @__PURE__ */ t("option", { value: "investigating", children: "investigating" }),
          /* @__PURE__ */ t("option", { value: "resolved", children: "resolved" }),
          /* @__PURE__ */ t("option", { value: "noise", children: "noise" }),
          /* @__PURE__ */ t("option", { value: "", children: "all" })
        ] }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-priority", children: "Priority" }),
        /* @__PURE__ */ t("select", { id: "sr-priority", className: O, value: p, onChange: (d) => N(d.target.value), children: kt.map((d) => /* @__PURE__ */ t("option", { value: d, children: d || "all" }, d)) }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-category", children: "Category" }),
        /* @__PURE__ */ r("select", { id: "sr-category", className: O, value: b, onChange: (d) => _(d.target.value), children: [
          /* @__PURE__ */ t("option", { value: "", children: "all" }),
          L.map((d) => /* @__PURE__ */ t("option", { value: d, children: d }, d))
        ] }),
        /* @__PURE__ */ r("label", { className: "text-sm flex items-center gap-1", style: { cursor: "pointer" }, children: [
          /* @__PURE__ */ t("input", { type: "checkbox", checked: S, onChange: (d) => g(d.target.checked) }),
          "Needs me"
        ] }),
        /* @__PURE__ */ t("div", { className: "flex-1" }),
        /* @__PURE__ */ t(
          Z,
          {
            "aria-label": "GitHub repository to search (owner/name, optional)",
            placeholder: "owner/repo (optional)",
            value: o,
            onChange: (d) => c(d.target.value),
            className: "w-48"
          }
        ),
        /* @__PURE__ */ r(T, { onClick: () => e.onInvestigate(o), disabled: s.size === 0 || !!e.busy, children: [
          "Investigate ",
          s.size || ""
        ] })
      ] }),
      $.length === 0 ? /* @__PURE__ */ t(
        Ge,
        {
          icon: /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "📡" }),
          title: a.length ? "Nothing matches these filters" : "Nothing here yet",
          subtitle: a.length ? "Change a filter to see more." : "New messages appear after the next poll."
        }
      ) : /* @__PURE__ */ t("ul", { className: "flex flex-col", "data-testid": "ledger-list", children: $.map((d, x) => /* @__PURE__ */ t(vt, { it: d, first: x === 0, checked: s.has(d.key), onToggle: () => A(d.key) }, d.key)) })
    ] }),
    /* @__PURE__ */ r(K, { children: [
      /* @__PURE__ */ t(te, { children: "Channels" }),
      D.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No channels configured." }) : /* @__PURE__ */ r("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ t("thead", { children: /* @__PURE__ */ r("tr", { className: "text-left text-muted", children: [
          /* @__PURE__ */ t("th", { scope: "col", children: "Channel" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Last polled" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Status" })
        ] }) }),
        /* @__PURE__ */ t("tbody", { children: D.map((d) => /* @__PURE__ */ r("tr", { children: [
          /* @__PURE__ */ t("td", { className: "font-mono", children: d.cid }),
          /* @__PURE__ */ t("td", { children: oe(d.last_polled_at) }),
          /* @__PURE__ */ t("td", { children: d.last_error ? /* @__PURE__ */ t(Y, { variant: "err", title: d.last_error, children: "error" }) : /* @__PURE__ */ t(Y, { variant: "ok", children: "ok" }) })
        ] }, d.cid)) })
      ] })
    ] })
  ] });
}
const _t = 5;
function St(e) {
  const n = e.split(`
`).map((s) => s.trim()).filter(Boolean), a = n.filter((s) => /^[•\-–]\s/.test(s));
  return (a.length ? a : n).slice(0, _t);
}
function $t({ state: e, busy: n, onDigest: a }) {
  const s = e.digest, l = e.crew.today, o = St(s.last_text || ""), c = e.settings.digest_destination === "self_dm" ? "DMed to you" : "dashboard notification";
  return /* @__PURE__ */ r(K, { className: "mb-4", "data-testid": "today-card", children: [
    /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ t(te, { children: "Today" }),
      s.pending ? /* @__PURE__ */ t(Y, { variant: "aim", children: "digest being delivered" }) : null,
      s.last_posted_date && /* @__PURE__ */ r("span", { className: "text-xs text-muted", "data-testid": "digest-time", children: [
        "digest ",
        s.last_posted_date,
        " · ",
        c
      ] }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      /* @__PURE__ */ t(T, { style: z, onClick: a, disabled: !!n || !e.crew.live, children: "Digest now" })
    ] }),
    (l == null ? void 0 : l.text) && /* @__PURE__ */ r("p", { style: { margin: "8px 0 0", fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }, "data-testid": "crew-today", children: [
      l.text,
      l.at > 0 && /* @__PURE__ */ r("span", { className: "text-xs text-muted", style: { fontWeight: 400 }, children: [
        " · ",
        V(l.at)
      ] })
    ] }),
    s.last_text ? /* @__PURE__ */ r(R, { children: [
      /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", "data-testid": "digest-top", style: { margin: "8px 0 0", padding: 0, listStyle: "none" }, children: o.map((p, N) => /* @__PURE__ */ t("li", { children: p }, N)) }),
      /* @__PURE__ */ t(xe, { summary: "Full digest", children: /* @__PURE__ */ t("pre", { className: "whitespace-pre-wrap text-sm", style: { fontFamily: "inherit", margin: 0 }, children: s.last_text }) })
    ] }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { margin: "8px 0 0" }, "data-testid": "digest-empty", children: "No digest yet" }),
    s.last_error && /* @__PURE__ */ t("p", { className: "text-xs mt-1", style: { color: "var(--danger)" }, children: s.last_error })
  ] });
}
function Ct({ state: e }) {
  return /* @__PURE__ */ t("div", { className: "flex items-center gap-2", style: { marginTop: 10 }, children: de.map((n) => /* @__PURE__ */ r("span", { title: `${n.title} · ${se(n, e).label}`, children: [
    /* @__PURE__ */ t(be, { m: n, s: e, selected: n.id === "lead", size: 30 }),
    /* @__PURE__ */ t("span", { className: "sr-only", children: `${n.title}: ${se(n, e).label}` })
  ] }, n.id)) });
}
function Tt(e) {
  const n = `slack-radar:chat-open:${e}`, a = () => {
    try {
      return window.localStorage.getItem(n) === "1";
    } catch {
      return !1;
    }
  }, [s, l] = u(a);
  re(() => l(a()), [n]);
  const o = ue(
    (c) => {
      l(c);
      try {
        c ? window.localStorage.setItem(n, "1") : window.localStorage.removeItem(n);
      } catch {
      }
    },
    [n]
  );
  return [s, o];
}
function Te({ q: e, onClick: n, disabled: a }) {
  return /* @__PURE__ */ t(
    "button",
    {
      type: "button",
      onClick: n,
      disabled: a,
      style: {
        fontSize: 12,
        border: "1px solid var(--border-strong)",
        borderRadius: 999,
        padding: "4px 10px",
        background: "transparent",
        color: "var(--text)",
        cursor: a ? "not-allowed" : "pointer",
        opacity: a ? 0.5 : 1,
        whiteSpace: "nowrap"
      },
      children: e
    }
  );
}
function Rt(e) {
  const n = ie(), { state: a, expanded: s, pending: l } = e, o = de[0], c = a.crew.slot_key, p = a.crew.live && a.crew.session_open && a.crew.session_agent === a.crew.agent, [N, b] = u(""), [_, S] = u(!1), [g, W] = u(""), [L, $] = u(!1), A = se(o, a), D = async (v) => {
    await n.post(`${I}/crew/message`, { message: v }), e.onChanged();
  }, O = async (v) => {
    const f = v.trim();
    if (f) {
      S(!0), W("");
      try {
        await n.post(`${I}/crew/message`, { message: f }), b(""), f === l && e.setPending(""), e.setExpanded(!0), e.onChanged();
      } catch {
        W(f);
      } finally {
        S(!1);
      }
    }
  }, d = async () => {
    try {
      await navigator.clipboard.writeText(l), $(!0), window.setTimeout(() => $(!1), 1500);
    } catch {
      $(!1);
    }
  }, x = g && /* @__PURE__ */ t(ee, { message: "The Radar Lead did not get that message.", onRetry: () => O(g) }), B = /* @__PURE__ */ t("div", { className: "text-sm", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }, children: a.crew.live ? /* @__PURE__ */ r(R, { children: [
    /* @__PURE__ */ t("span", { children: "The Radar Lead session opens on its next turn. Open it now to talk here." }),
    /* @__PURE__ */ t(T, { primary: !0, onClick: e.onStart, disabled: !!e.busy || !e.configured, children: "Open the session" })
  ] }) : /* @__PURE__ */ r("span", { children: [
    "The Radar Lead is paused. Turn on ",
    /* @__PURE__ */ t("b", { children: "Crew" }),
    " at the top of the page to triage your channels and talk to it here."
  ] }) });
  if (!s)
    return /* @__PURE__ */ r(K, { style: { padding: "10px 14px" }, children: [
      /* @__PURE__ */ r(
        "form",
        {
          className: "flex flex-wrap items-center gap-2",
          onSubmit: (v) => {
            v.preventDefault(), O(N);
          },
          children: [
            /* @__PURE__ */ t(be, { m: o, s: a, size: 26 }),
            /* @__PURE__ */ t(
              Z,
              {
                "aria-label": "Ask the lead",
                placeholder: "Ask the lead…",
                value: N,
                onChange: (v) => b(v.target.value),
                disabled: !p || _,
                style: { flex: 1, minWidth: 200 }
              }
            ),
            /* @__PURE__ */ t(T, { primary: !0, type: "submit", disabled: !p || _ || !N.trim(), children: "Send" }),
            ke.map((v) => /* @__PURE__ */ t(Te, { q: v, onClick: () => O(v), disabled: !p || _ }, v))
          ]
        }
      ),
      !p && /* @__PURE__ */ t("div", { style: { marginTop: 8 }, children: B }),
      x
    ] });
  const E = e.events.filter((v) => v.kind === "crew" || v.kind === "digest").slice(0, 5);
  return /* @__PURE__ */ r(
    K,
    {
      style: { padding: 0, display: "flex", flexDirection: "column", height: "min(620px, calc(100vh - 240px))", overflow: "hidden" },
      children: [
        /* @__PURE__ */ r("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border)" }, children: [
          /* @__PURE__ */ r("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: a.crew.name || o.title }),
            /* @__PURE__ */ t(Y, { variant: A.tone === "muted" ? "muted" : A.tone === "aim" ? "aim" : "ok", children: A.label }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(T, { onClick: () => e.setExpanded(!1), "aria-expanded": !0, children: "Collapse" })
          ] }),
          /* @__PURE__ */ r("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
            "phase ",
            a.crew_memory.phase,
            " · next: ",
            a.crew_memory.next || "—"
          ] }),
          /* @__PURE__ */ t(Ct, { state: a })
        ] }),
        /* @__PURE__ */ t(tt, { state: a }),
        l && // ChatEmbed has no API to fill its composer, so the question waits here.
        /* @__PURE__ */ r(
          "div",
          {
            className: "text-sm flex flex-wrap items-center gap-2",
            style: { padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" },
            children: [
              /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200, userSelect: "all" }, children: l }),
              /* @__PURE__ */ t(T, { primary: !0, style: z, onClick: () => O(l), disabled: !p || _, children: "Send" }),
              /* @__PURE__ */ t(T, { style: z, onClick: d, children: L ? "Copied" : "Copy" })
            ]
          }
        ),
        x && /* @__PURE__ */ t("div", { style: { padding: "0 16px" }, children: x }),
        /* @__PURE__ */ t("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: p ? /* @__PURE__ */ t(
          Ke,
          {
            slotKey: c,
            agent: a.crew.agent,
            frameless: !0,
            startAtBottom: !0,
            placeholder: "Ask the Radar Lead…",
            onSend: D
          },
          c
        ) : /* @__PURE__ */ r("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 10 }, children: [
          B,
          !e.configured && /* @__PURE__ */ t("p", { className: "text-xs text-muted", children: "Add a channel in Settings first." }),
          E.length > 0 && /* @__PURE__ */ t("ul", { className: "text-xs text-muted flex flex-col gap-1", style: { marginTop: 6 }, children: E.map((v, f) => /* @__PURE__ */ r("li", { children: [
            V(v.at),
            " · ",
            v.text
          ] }, `${v.at}-${f}`)) })
        ] }) }),
        /* @__PURE__ */ t("div", { className: "flex flex-wrap gap-2", style: { padding: "10px 16px 12px", borderTop: "1px solid var(--border)" }, children: ke.map((v) => /* @__PURE__ */ t(Te, { q: v, onClick: () => O(v), disabled: !p || _ }, v)) })
      ]
    }
  );
}
function Wt({ state: e }) {
  return /* @__PURE__ */ r(K, { children: [
    /* @__PURE__ */ t(te, { children: "Team" }),
    /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { marginBottom: 8 }, children: "Who works on your channels. Only the Radar Lead has a session; the others run when needed." }),
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: de.map((n) => {
      var s, l;
      const a = n.id === "lead" ? e.crew.agent : n.agent;
      return /* @__PURE__ */ r(
        "li",
        {
          className: "flex items-start gap-3",
          style: { padding: "12px 4px", borderTop: "1px solid var(--border)", opacity: n.planned ? 0.7 : 1 },
          children: [
            /* @__PURE__ */ t(be, { m: n, s: e, size: 36 }),
            /* @__PURE__ */ r("div", { style: { minWidth: 0, flex: 1 }, children: [
              /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2", children: [
                /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: n.id === "lead" && e.crew.name || n.title }),
                /* @__PURE__ */ t(Y, { variant: "muted", children: n.layer }),
                /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: n.kind })
              ] }),
              /* @__PURE__ */ t("p", { className: "text-sm", style: { margin: "4px 0 0" }, children: n.duty }),
              n.id === "investigator" && (((s = e.investigations) == null ? void 0 : s.items) || 0) > 0 && /* @__PURE__ */ r("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: [
                (l = e.investigations) == null ? void 0 : l.items,
                " item(s) under investigation"
              ] }),
              a && /* @__PURE__ */ t(xe, { children: /* @__PURE__ */ r("span", { className: "font-mono", children: [
                "agent: ",
                a,
                n.id === "lead" && e.crew.slot_key ? ` · session: ${e.crew.slot_key}` : ""
              ] }) })
            ] }),
            /* @__PURE__ */ t("div", { "data-testid": `team-status-${n.id}`, style: { maxWidth: 360, minWidth: 0, display: "flex" }, children: /* @__PURE__ */ t(Fe, { m: n, state: e, withName: !1, withResting: !0 }) })
          ]
        },
        n.id
      );
    }) })
  ] });
}
function Dt({ events: e, kinds: n, onShowAll: a }) {
  const s = n ? e.filter((l) => n.includes(l.kind)) : e;
  return /* @__PURE__ */ r(K, { children: [
    /* @__PURE__ */ t(te, { children: "Activity" }),
    n && /* @__PURE__ */ r("p", { className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { marginBottom: 8 }, children: [
      /* @__PURE__ */ t("span", { children: "Showing the crew and its members only." }),
      /* @__PURE__ */ t(T, { style: z, onClick: a, children: "Show all" })
    ] }),
    s.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No activity yet." }) : /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", children: s.map((l, o) => /* @__PURE__ */ r("li", { children: [
      /* @__PURE__ */ t("span", { className: "text-muted", children: oe(l.at) }),
      " ",
      /* @__PURE__ */ t(Y, { variant: "muted", children: l.kind }),
      " ",
      l.text
    ] }, `${l.at}-${o}`)) })
  ] });
}
function Lt({
  state: e,
  busy: n,
  act: a,
  mcp: s,
  onProbe: l
}) {
  const o = ie(), [c, p] = u(e.settings.channels.join(`
`)), [N, b] = u(e.settings.digest_destination), [_, S] = u(e.settings.slack_login), [g, W] = u(e.settings.slack_mcp_command), [L, $] = u(e.settings.workspace_url), [A, D] = u(String(e.settings.poll_interval_secs)), [O, d] = u(String(e.settings.backfill_hours)), [x, B] = u(e.crew.unattended), [E, v] = u(e.crew.agent), [f, C] = u(e.crew.model), k = () => a(
    "Save settings",
    () => o.put(`${I}/settings`, {
      channels: c.split(/[\s,]+/).map((w) => w.trim()).filter(Boolean),
      digest_destination: N,
      slack_login: _.trim(),
      slack_mcp_command: g.trim(),
      workspace_url: L.trim(),
      poll_interval_secs: Number(A),
      backfill_hours: Number(O)
    })
  );
  return /* @__PURE__ */ r(R, { children: [
    !e.vault_available && /* @__PURE__ */ t(K, { className: "mb-4", children: /* @__PURE__ */ t("p", { className: "text-sm", children: "The gateway secret vault is unavailable, so settings cannot be saved." }) }),
    /* @__PURE__ */ r(K, { className: "mb-4", children: [
      /* @__PURE__ */ t(te, { children: "Basics" }),
      /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(Be, { mcp: s, state: e }) }),
        /* @__PURE__ */ t(T, { disabled: !!n, onClick: l, children: "Check connection" })
      ] }),
      /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 12px" }, children: "Slack is read as you, read-only: no bot, no invite. The one write is the optional digest DM to yourself." }),
      /* @__PURE__ */ t("label", { className: "block text-sm mb-1", htmlFor: "sr-channels", children: "Channels to watch (one channel ID per line, e.g. C0123ABCD). Any channel you can read works." }),
      /* @__PURE__ */ t(
        "textarea",
        {
          id: "sr-channels",
          className: "w-full font-mono text-sm border rounded p-2 bg-transparent",
          rows: 5,
          value: c,
          onChange: (w) => p(w.target.value)
        }
      ),
      /* @__PURE__ */ r("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "Digest destination",
          /* @__PURE__ */ r(
            "select",
            {
              className: "block w-full text-sm bg-transparent border rounded px-2 py-1",
              value: N,
              onChange: (w) => b(w.target.value),
              children: [
                /* @__PURE__ */ t("option", { value: "dashboard", children: "Dashboard notification only" }),
                /* @__PURE__ */ t("option", { value: "self_dm", children: "DM to myself in Slack" })
              ]
            }
          )
        ] }),
        N === "self_dm" && /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "Your Slack login (for the DM)",
          /* @__PURE__ */ t(Z, { value: _, onChange: (w) => S(w.target.value), placeholder: "jdoe" })
        ] }),
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "Poll interval (seconds, 60–3600)",
          /* @__PURE__ */ t(Z, { type: "number", min: 60, max: 3600, value: A, onChange: (w) => D(w.target.value) }),
          /* @__PURE__ */ r("span", { "data-testid": "poll-cadence", className: "block text-xs text-muted", style: { marginTop: 2 }, children: [
            "Runs by itself every ",
            e.settings.poll_interval_secs,
            " s; a manual Poll just runs one cycle now."
          ] })
        ] })
      ] }),
      /* @__PURE__ */ t(T, { primary: !0, className: "mt-3", disabled: !!n, onClick: k, children: "Save settings" })
    ] }),
    /* @__PURE__ */ t(K, { children: /* @__PURE__ */ r("details", { children: [
      /* @__PURE__ */ t("summary", { style: { cursor: "pointer", fontWeight: 600, color: "var(--text-strong)" }, children: "Advanced" }),
      /* @__PURE__ */ r("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "MCP server command (a single executable on PATH)",
          /* @__PURE__ */ t(Z, { value: g, onChange: (w) => W(w.target.value), placeholder: "ai-community-slack-mcp" })
        ] }),
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "Workspace URL (for permalinks, optional)",
          /* @__PURE__ */ t(Z, { value: L, onChange: (w) => $(w.target.value), placeholder: "https://yourteam.slack.com" })
        ] }),
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "First-poll backfill (hours, 0–168)",
          /* @__PURE__ */ t(Z, { type: "number", min: 0, max: 168, value: O, onChange: (w) => d(w.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(T, { className: "mt-3", disabled: !!n, onClick: k, children: "Save settings" }),
      /* @__PURE__ */ r("div", { style: { borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }, children: [
        /* @__PURE__ */ t("div", { className: "text-sm", style: { fontWeight: 600, marginBottom: 8 }, children: "Crew" }),
        /* @__PURE__ */ r("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
          /* @__PURE__ */ r("label", { className: "text-sm", children: [
            "Agent",
            /* @__PURE__ */ t(Z, { value: E, onChange: (w) => v(w.target.value), placeholder: "slack-radar-crew" }),
            /* @__PURE__ */ t("span", { className: "block text-xs text-muted mt-1", children: "Default: the shipped slack-radar-crew agent. Your own agents are never modified." })
          ] }),
          /* @__PURE__ */ r("label", { className: "text-sm", children: [
            "Model (empty = agent default)",
            /* @__PURE__ */ t(Z, { value: f, onChange: (w) => C(w.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ r("div", { className: "mt-3 flex items-center gap-2", children: [
          /* @__PURE__ */ t(
            Re,
            {
              checked: x,
              onChange: B,
              label: "Unattended mode (auto-approve investigator commands)",
              describedBy: "sr-unattended-risk"
            }
          ),
          /* @__PURE__ */ t("span", { className: "text-sm", children: "Unattended mode (auto-approve investigator commands)" })
        ] }),
        /* @__PURE__ */ t("p", { id: "sr-unattended-risk", className: "text-xs text-muted mt-1", children: "Risk: anyone in a watched channel can write text the crew reads, so a crafted message could steer a command nobody reviews." }),
        /* @__PURE__ */ t(
          T,
          {
            primary: !0,
            className: "mt-3",
            disabled: !!n,
            onClick: () => a("Save crew", () => o.put(`${I}/crew`, { agent: E, model: f, unattended: x })),
            children: "Save crew"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  Bt as default
};
