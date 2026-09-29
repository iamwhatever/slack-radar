import { jsxs as a, Fragment as A, jsx as t } from "react/jsx-runtime";
import * as xe from "@kirocrew/app-sdk";
import { useAppApi as ne, ChatEmbed as Le } from "@kirocrew/app-sdk";
import { PageHeader as Be, Toggle as we, Btn as x, Card as E, CardTitle as Q, StatCard as re, Input as K, EmptyState as Fe, Badge as H } from "@kirocrew/app-sdk/ui";
import { useState as h, useCallback as he, useEffect as Y, useRef as pe, useMemo as ke } from "react";
const _ = "/api/apps/slack-radar", Oe = {
  checking: "checking…",
  connected: "connected",
  needs_login: "sign in again",
  binary_not_found: "not installed",
  incompatible: "missing read access",
  error: "not working"
}, ye = ["What needs me today?", "Draft today's digest", "Which threads look resolved?"], Pe = [
  { id: "board", label: "Board" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" }
], ue = (e) => e ? new Date(e * 1e3).toLocaleString() : "never";
function J(e) {
  if (!e) return "never";
  const n = Math.max(0, Date.now() / 1e3 - e);
  return n < 90 ? "just now" : n < 3600 ? `${Math.round(n / 60)} min ago` : n < 86400 ? `${Math.round(n / 3600)} h ago` : ue(e);
}
function Ne(e, n) {
  return n === "needs_login" ? "needs_login" : (e == null ? void 0 : e.status) || "checking";
}
function _e({ children: e, summary: n = "Details" }) {
  return /* @__PURE__ */ a("details", { className: "text-xs text-muted", style: { marginTop: 6 }, children: [
    /* @__PURE__ */ t("summary", { style: { cursor: "pointer" }, children: n }),
    /* @__PURE__ */ t("div", { style: { marginTop: 4 }, children: e })
  ] });
}
const ae = [
  {
    id: "lead",
    title: "Radar Lead",
    initials: "RL",
    layer: "Lead",
    kind: "Resident",
    agent: "slack-radar-crew",
    duty: "Triages every watched channel, sets category and priority, decides when a cluster needs investigating, judges possibly-resolved threads, writes the digest headline, and answers you here."
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
    kind: "Joins on demand",
    agent: "slack-radar-watcher",
    duty: "Judges a batch of possibly-resolved threads when the lead asks, and records resolved or not in the ledger. No shell."
  },
  {
    id: "poller",
    title: "Poller",
    initials: "⟳",
    layer: "System",
    kind: "Code, no model",
    agent: "",
    duty: "Reads new messages and thread replies from Slack, flags likely resolutions, and delivers the digest. Spends no credits.",
    planned: !1
  }
], ce = (e, n) => {
  var s;
  return (s = e.now) == null ? void 0 : s.members.find((i) => i.id === n);
};
function q(e, n) {
  var r;
  const s = ce(n, e.id);
  if (e.id === "lead")
    return (s == null ? void 0 : s.state) === "paused" || !n.crew.live ? { label: "paused", tone: "muted" } : (s ? s.state === "working" : n.crew.running) ? { label: "working", tone: "aim" } : { label: "live", tone: "ok" };
  if (e.id === "poller")
    return n.source_state === "needs_login" ? { label: "sign in again", tone: "warn" } : (s == null ? void 0 : s.state) === "paused" ? { label: "paused", tone: "warn" } : { label: `polled ${J(n.last_poll_at)}`, tone: "muted" };
  const i = s ? s.count : e.id === "investigator" && ((r = n.investigations) == null ? void 0 : r.running) || 0;
  return i ? { label: `${i} running`, tone: "aim" } : (s == null ? void 0 : s.state) === "planned" ? { label: "not started yet", tone: "muted" } : { label: "idle", tone: "muted" };
}
function Me(e) {
  if (!e) return "";
  const n = Math.max(0, Math.round(Date.now() / 1e3 - e));
  return n < 90 ? `${n}s` : n < 90 * 60 ? `${Math.round(n / 60)}m` : `${Math.round(n / 3600)}h`;
}
const Ee = (e, n = 60) => e.length > n ? `${e.slice(0, n - 1).trimEnd()}…` : e;
function ze(e, n) {
  const s = ce(n, e.id);
  return s ? e.id === "poller" ? s.doing : s.state !== "working" ? s.state === "paused" ? `paused: ${s.doing}` : q(e, n).label : e.id === "lead" ? `working: ${s.doing}` : `${s.count} running: ${s.doing}` : q(e, n).label;
}
const je = `@keyframes slack-radar-pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.7) } }
.sr-pulse { animation: slack-radar-pulse 1.4s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .sr-pulse { animation: none } }`;
function Se({ tone: e, pulse: n }) {
  return /* @__PURE__ */ t(
    "i",
    {
      "aria-hidden": !0,
      className: n ? "sr-pulse" : void 0,
      style: { width: 8, height: 8, borderRadius: "50%", flex: "none", display: "inline-block", background: $e[e] }
    }
  );
}
function Ce({ m: e, state: n, withName: s = !0, onOpen: i }) {
  const r = q(e, n), o = ce(n, e.id), d = o ? o.state === "working" : r.tone === "aim", p = ze(e, n), k = e.id === "lead" && n.crew.name || e.title, C = /* @__PURE__ */ a(A, { children: [
    /* @__PURE__ */ t(Se, { tone: r.tone, pulse: d }),
    s && /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: k }),
    /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: Ee(p) })
  ] }), m = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    fontSize: 13,
    opacity: d || r.tone === "warn" ? 1 : 0.6,
    color: "var(--text)"
  }, f = { title: `${k} · ${p}`, "data-member": e.id, "data-state": (o == null ? void 0 : o.state) || (d ? "working" : "idle") };
  return i ? /* @__PURE__ */ t(
    "button",
    {
      type: "button",
      onClick: i,
      ...f,
      "aria-label": `${k}: ${p}. Show activity`,
      style: { ...m, background: "transparent", border: 0, padding: 0, cursor: "pointer" },
      children: C
    }
  ) : /* @__PURE__ */ t("span", { ...f, style: m, children: C });
}
function Ue({ state: e, onOpenActivity: n }) {
  return /* @__PURE__ */ a(
    "div",
    {
      "data-testid": "now-strip",
      role: "status",
      "aria-label": "Who is working right now",
      className: "flex flex-wrap items-center",
      style: { gap: "6px 18px", padding: "8px 12px", marginBottom: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-elevated)", minWidth: 0 },
      children: [
        /* @__PURE__ */ t("span", { className: "text-xs text-muted", style: { fontWeight: 600, letterSpacing: ".04em" }, children: "NOW" }),
        ae.map((s) => /* @__PURE__ */ t(
          Ce,
          {
            m: s,
            state: e,
            onOpen: s.id === "investigator" || s.id === "watcher" ? n : void 0
          },
          s.id
        ))
      ]
    }
  );
}
function Ke({ state: e }) {
  const n = ae.filter((s) => s.id === "investigator" || s.id === "watcher").map((s) => ({ m: s, row: ce(e, s.id) })).filter(({ row: s }) => (s == null ? void 0 : s.state) === "working");
  return n.length ? /* @__PURE__ */ t("div", { "data-testid": "chat-running", style: { padding: "6px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" }, children: n.map(({ m: s, row: i }) => {
    const r = Me(i.since), o = `${s.title} running${i.count > 1 ? ` (${i.count})` : ""} · ${i.doing}${r ? ` · ${r}` : ""}`;
    return /* @__PURE__ */ a("div", { className: "text-xs flex items-center gap-2", title: o, style: { minWidth: 0 }, children: [
      /* @__PURE__ */ t(Se, { tone: "aim", pulse: !0 }),
      /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: o })
    ] }, s.id);
  }) }) : null;
}
const $e = {
  ok: "var(--ok)",
  aim: "var(--aim)",
  warn: "var(--warn)",
  muted: "var(--muted-strong)"
};
function ge({ m: e, s: n, selected: s, size: i = 32 }) {
  const r = q(e, n), o = e.planned || e.id === "poller", d = {
    width: i,
    height: i,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    fontWeight: 700,
    position: "relative",
    flex: "none",
    background: o ? "transparent" : "var(--bg-hover)",
    color: o ? "var(--muted)" : "var(--text-strong)",
    border: `2px ${o ? "dashed" : "solid"} ${s ? "var(--accent)" : o ? "var(--border-strong)" : "transparent"}`,
    opacity: e.planned ? 0.6 : 1
  };
  return /* @__PURE__ */ a("span", { style: d, "aria-hidden": !0, children: [
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
          background: $e[r.tone]
        }
      }
    )
  ] });
}
function He(e) {
  return e === "new" ? "warn" : e === "investigating" ? "aim" : e === "resolved" ? "ok" : "muted";
}
function Ge({ tab: e, setTab: n }) {
  return /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Slack Radar sections", style: { display: "flex", gap: 4 }, children: Pe.map((s) => {
    const i = e === s.id;
    return /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": i,
        onClick: () => n(s.id),
        style: {
          padding: "6px 12px",
          borderRadius: 8,
          border: 0,
          cursor: "pointer",
          fontSize: 14,
          background: i ? "var(--bg-hover)" : "transparent",
          color: i ? "var(--text-strong)" : "var(--muted)"
        },
        children: s.label
      },
      s.id
    );
  }) });
}
function Je({
  state: e,
  configured: n,
  busy: s,
  onStart: i,
  onPause: r
}) {
  const o = e.crew.live;
  return /* @__PURE__ */ a("div", { className: "flex items-center gap-2", title: !o && !n ? "Add a channel in Settings first" : void 0, children: [
    /* @__PURE__ */ t("span", { className: "text-sm", children: "Crew" }),
    /* @__PURE__ */ t(
      we,
      {
        checked: o,
        disabled: !!s || !o && !n,
        onChange: (p) => p ? i() : r(),
        label: o ? "Pause the crew" : "Start the crew"
      }
    ),
    /* @__PURE__ */ a("span", { className: "text-xs text-muted", title: "Whether the crew's commands run without asking you", children: [
      "Unattended: ",
      e.crew.trusted ? "on" : "off"
    ] })
  ] });
}
function ut() {
  const e = ne(), [n, s] = h("board"), [i, r] = h(null), [o, d] = h([]), [p, k] = h(null), [C, m] = h([]), [f, N] = h([]), [I, $] = h("open"), [L, u] = h(/* @__PURE__ */ new Set()), [S, B] = h(""), [R, w] = h(""), [v, P] = h(null), [g, W] = h(null), [M, z] = h(null), y = he(async () => {
    try {
      P(await e.get(`${_}/mcp/status`));
    } catch (D) {
      P({ status: "error", command: "", detail: D.message });
    }
  }, [e]);
  Y(() => {
    y();
  }, [y]);
  const j = he(async () => {
    var D;
    try {
      const [G, X, le, V, Ie] = await Promise.all([
        e.get(`${_}/state`),
        e.get(`${_}/items?status=${encodeURIComponent(I)}&limit=300`),
        e.get(`${_}/events?limit=150`),
        e.get(`${_}/needs`),
        e.get(`${_}/items?handled=1&limit=100`)
      ]);
      r(G), W(((D = G.now) == null ? void 0 : D.members) || null), d(X.items), k(V), m(Ie.items), N(le.events.slice().reverse());
    } catch (G) {
      w(`Could not load: ${G.message}`);
    }
  }, [e, I]);
  Y(() => {
    j();
    const D = window.setInterval(j, 3e4);
    return () => window.clearInterval(D);
  }, [j]);
  const se = !!(g != null && g.some((D) => D.state === "working")), ee = pe("");
  Y(() => {
    if (!se) return;
    const D = async () => {
      try {
        const X = await e.get(`${_}/now`);
        W(X.members);
        const le = X.members.map((V) => `${V.id}:${V.state}:${V.count}`).join(",");
        if (ee.current && le !== ee.current) {
          const V = await e.get(`${_}/events?limit=150`);
          N(V.events.slice().reverse());
        }
        ee.current = le;
      } catch {
      }
    }, G = window.setInterval(D, 5e3);
    return () => window.clearInterval(G);
  }, [se, e]);
  const U = ke(() => i && g ? { ...i, now: { members: g } } : i, [i, g]), l = () => {
    z(["member", "crew", "investigate"]), s("activity");
  }, c = async (D, G) => {
    B(D), w("");
    try {
      await G(), w(`${D}: done`), await j();
    } catch (X) {
      w(`${D} failed: ${X.message}`);
    } finally {
      B("");
    }
  }, b = !!i && i.settings.channels.length > 0, T = (i == null ? void 0 : i.settings.channels.length) || 0, F = i ? `${T ? `Watching ${T} channel${T === 1 ? "" : "s"}` : "No channels yet"} · ${i.crew.live ? "running" : "paused"}` : "A small crew triaging your Slack channels", te = i ? Ne(v, i.source_state) : "checking", ie = () => {
    y(), j();
  };
  return /* @__PURE__ */ a(A, { children: [
    /* @__PURE__ */ t(
      Be,
      {
        title: "Slack Radar",
        subtitle: F,
        actions: /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-4", children: [
          /* @__PURE__ */ t(
            Ge,
            {
              tab: n,
              setTab: (D) => {
                z(null), s(D);
              }
            }
          ),
          i && /* @__PURE__ */ t(
            Je,
            {
              state: i,
              configured: b,
              busy: S,
              onStart: () => c("Start crew", () => e.post(`${_}/crew/start`, {})),
              onPause: () => c("Pause crew", () => e.post(`${_}/crew/pause`, {}))
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ t("style", { children: je }),
    /* @__PURE__ */ a("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      U && n === "board" && /* @__PURE__ */ t(Ue, { state: U, onOpenActivity: l }),
      i && te === "needs_login" && /* @__PURE__ */ t(Qe, { mcp: v, sourceError: i.source_error, busy: S, onCheck: ie }),
      R && /* @__PURE__ */ t("p", { role: "status", className: "text-sm text-muted mb-3", children: R }),
      U ? n === "board" ? /* @__PURE__ */ t(
        Ve,
        {
          state: U,
          items: o,
          needs: p,
          handled: C,
          configured: b,
          mcp: v,
          filter: I,
          setFilter: $,
          selected: L,
          setSelected: u,
          busy: S,
          onPoll: () => c("Poll", () => e.post(`${_}/poll`, {})),
          onInvestigate: (D) => c("Investigate", async () => {
            await e.post(`${_}/investigate`, { keys: [...L], repo: D }), u(/* @__PURE__ */ new Set());
          }),
          onStart: () => c("Start crew", () => e.post(`${_}/crew/start`, {})),
          onDigest: () => c("Request digest", () => e.post(`${_}/digest/request`, {})),
          events: f,
          onChanged: j
        }
      ) : n === "team" ? /* @__PURE__ */ t(rt, { state: U }) : n === "activity" ? /* @__PURE__ */ t(ot, { events: f, kinds: M, onShowAll: () => z(null) }) : /* @__PURE__ */ t(dt, { state: U, busy: S, act: c, mcp: v, onProbe: y }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" })
    ] })
  ] });
}
function Te({ mcp: e, sourceError: n }) {
  var i;
  const s = [
    (e == null ? void 0 : e.status) && `status: ${e.status}`,
    (e == null ? void 0 : e.command) && `command: ${e.command}`,
    n && `error: ${n}`,
    (e == null ? void 0 : e.detail) && e.detail !== n && `detail: ${e.detail}`,
    ((i = e == null ? void 0 : e.missing_read_tools) == null ? void 0 : i.length) && `missing read tools: ${e.missing_read_tools.join(", ")}`
  ].filter(Boolean);
  return s.length ? /* @__PURE__ */ t(_e, { children: /* @__PURE__ */ t("pre", { className: "font-mono whitespace-pre-wrap", style: { margin: 0 }, children: s.join(`
`) }) }) : null;
}
function Qe({ mcp: e, sourceError: n, busy: s, onCheck: i }) {
  return /* @__PURE__ */ a(
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
        /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-3", children: [
          /* @__PURE__ */ a("div", { style: { flex: 1, minWidth: 240 }, children: [
            /* @__PURE__ */ t("div", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: "Slack connection: sign in again" }),
            /* @__PURE__ */ t("div", { className: "text-sm", children: "Your Slack sign-in expired, so no new messages are read. Sign in to Slack again on the computer running Kiro Crew, then check again. Nothing is lost; reading picks up where it stopped." })
          ] }),
          /* @__PURE__ */ t(x, { primary: !0, onClick: i, disabled: !!s, children: "I signed in, check again" })
        ] }),
        /* @__PURE__ */ t(Te, { mcp: e, sourceError: n })
      ]
    }
  );
}
function Re({ mcp: e, state: n, withPoll: s }) {
  const i = Ne(e, n.source_state), r = i === "connected";
  return /* @__PURE__ */ a("div", { className: "mb-4", children: [
    /* @__PURE__ */ a("p", { role: "status", className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { margin: 0 }, children: [
      /* @__PURE__ */ t("span", { "aria-hidden": !0, style: { width: 8, height: 8, borderRadius: "50%", background: r ? "var(--ok)" : i === "checking" ? "var(--muted-strong)" : "var(--warn)", display: "inline-block" } }),
      /* @__PURE__ */ a("span", { children: [
        "Slack connection: ",
        /* @__PURE__ */ t("span", { style: { color: r ? "var(--text)" : "var(--warn)" }, children: Oe[i] || i })
      ] }),
      s && /* @__PURE__ */ a("span", { children: [
        "· last poll ",
        J(n.last_poll_at),
        n.settings.channels.length > 0 && /* @__PURE__ */ a(A, { children: [
          " · watching ",
          n.settings.channels.join(", ")
        ] })
      ] })
    ] }),
    !r && i !== "needs_login" && /* @__PURE__ */ t(Te, { mcp: e, sourceError: n.source_error })
  ] });
}
function Ve(e) {
  const { state: n, items: s, selected: i, setSelected: r } = e, [o, d] = h(""), [p, k] = h(""), [C, m] = it(n.crew.slot_key), f = pe(null), N = n.counts.open_by_priority, I = (u) => {
    const S = new Set(i);
    S.has(u) ? S.delete(u) : S.add(u), r(S);
  }, $ = ke(
    () => n.settings.channels.map((u) => ({ cid: u, ...n.channels[u] || {} })),
    [n]
  ), L = (u) => {
    k(Ye(u)), m(!0), window.requestAnimationFrame(() => {
      var S;
      return (S = f.current) == null ? void 0 : S.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };
  return /* @__PURE__ */ a("div", { style: { minWidth: 0 }, children: [
    /* @__PURE__ */ a("div", { className: "flex flex-wrap items-start gap-3", children: [
      /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(Re, { mcp: e.mcp, state: n, withPoll: !0 }) }),
      /* @__PURE__ */ t(x, { onClick: e.onPoll, disabled: !!e.busy || !e.configured, children: "Poll now" })
    ] }),
    /* @__PURE__ */ t("div", { ref: f, children: /* @__PURE__ */ t(
      lt,
      {
        state: n,
        events: e.events,
        configured: e.configured,
        busy: e.busy,
        expanded: C,
        setExpanded: m,
        pending: p,
        setPending: k,
        onStart: e.onStart,
        onChanged: e.onChanged
      }
    ) }),
    !e.configured && /* @__PURE__ */ a(E, { className: "mb-4", children: [
      /* @__PURE__ */ t(Q, { children: "Finish setup" }),
      /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite." })
    ] }),
    /* @__PURE__ */ t(
      tt,
      {
        needs: e.needs,
        today: n.crew.today,
        handled: e.handled,
        onChanged: e.onChanged,
        onWhy: L
      }
    ),
    /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4", children: [
      /* @__PURE__ */ t(re, { label: "Awaiting triage", value: n.counts.needs_triage, accent: !0 }),
      /* @__PURE__ */ t(re, { label: "Possibly resolved", value: n.counts.possibly_resolved }),
      /* @__PURE__ */ t(re, { label: "Open p0 / p1", value: `${N.p0 || 0} / ${N.p1 || 0}` }),
      /* @__PURE__ */ t(re, { label: "Tracked items", value: n.counts.total })
    ] }),
    /* @__PURE__ */ a(E, { className: "mb-4", children: [
      /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2 mb-3", children: [
        /* @__PURE__ */ t(Q, { children: "Ledger" }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-filter", children: "Show" }),
        /* @__PURE__ */ a(
          "select",
          {
            id: "sr-filter",
            className: "text-sm bg-transparent border rounded px-2 py-1",
            value: e.filter,
            onChange: (u) => e.setFilter(u.target.value),
            children: [
              /* @__PURE__ */ t("option", { value: "open", children: "open" }),
              /* @__PURE__ */ t("option", { value: "new", children: "new" }),
              /* @__PURE__ */ t("option", { value: "triaged", children: "triaged" }),
              /* @__PURE__ */ t("option", { value: "investigating", children: "investigating" }),
              /* @__PURE__ */ t("option", { value: "resolved", children: "resolved" }),
              /* @__PURE__ */ t("option", { value: "noise", children: "noise" }),
              /* @__PURE__ */ t("option", { value: "", children: "all" })
            ]
          }
        ),
        /* @__PURE__ */ t("div", { className: "flex-1" }),
        /* @__PURE__ */ t(
          K,
          {
            "aria-label": "GitHub repository to search (owner/name, optional)",
            placeholder: "owner/repo (optional)",
            value: o,
            onChange: (u) => d(u.target.value),
            className: "w-48"
          }
        ),
        /* @__PURE__ */ a(x, { onClick: () => e.onInvestigate(o), disabled: i.size === 0 || !!e.busy, children: [
          "Investigate ",
          i.size || ""
        ] })
      ] }),
      s.length === 0 ? /* @__PURE__ */ t(Fe, { icon: /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "📡" }), title: "Nothing here yet", subtitle: "New messages appear after the next poll." }) : /* @__PURE__ */ t("ul", { className: "flex flex-col", children: s.map((u, S) => /* @__PURE__ */ t(nt, { it: u, first: S === 0, checked: i.has(u.key), onToggle: () => I(u.key) }, u.key)) })
    ] }),
    /* @__PURE__ */ t(at, { state: n, busy: e.busy, onDigest: e.onDigest }),
    /* @__PURE__ */ a(E, { children: [
      /* @__PURE__ */ t(Q, { children: "Channels" }),
      $.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No channels configured." }) : /* @__PURE__ */ a("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ t("thead", { children: /* @__PURE__ */ a("tr", { className: "text-left text-muted", children: [
          /* @__PURE__ */ t("th", { scope: "col", children: "Channel" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Last polled" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Status" })
        ] }) }),
        /* @__PURE__ */ t("tbody", { children: $.map((u) => /* @__PURE__ */ a("tr", { children: [
          /* @__PURE__ */ t("td", { className: "font-mono", children: u.cid }),
          /* @__PURE__ */ t("td", { children: ue(u.last_polled_at) }),
          /* @__PURE__ */ t("td", { children: u.last_error ? /* @__PURE__ */ t(H, { variant: "err", title: u.last_error, children: "error" }) : /* @__PURE__ */ t(H, { variant: "ok", children: "ok" }) })
        ] }, u.cid)) })
      ] })
    ] })
  ] });
}
const fe = {
  decide: "Needs a decision",
  unanswered: "Questions nobody answered",
  clusters: "Reported more than once"
};
function We(e) {
  return e < 1 ? "under 1 h old" : e < 48 ? `${Math.round(e)} h old` : `${Math.floor(e / 24)} days old`;
}
function Ye(e) {
  return `Why is "${e.summary.length > 80 ? `${e.summary.slice(0, 79)}…` : e.summary}" ${e.priority || "on my list"}?`;
}
function De(e) {
  return e ? /* @__PURE__ */ t(H, { variant: e === "p0" || e === "p1" ? "err" : "muted", children: e }) : null;
}
function Z({ message: e, onRetry: n }) {
  return /* @__PURE__ */ a(
    "div",
    {
      role: "alert",
      className: "text-sm flex flex-wrap items-center gap-2",
      style: { border: "1px solid var(--danger)", borderRadius: 8, padding: "8px 12px", margin: "8px 0" },
      children: [
        /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200 }, children: e }),
        /* @__PURE__ */ t(x, { onClick: n, children: "Try again" })
      ]
    }
  );
}
function oe({ label: e, actions: n }) {
  const s = pe(null);
  return /* @__PURE__ */ a("details", { ref: s, style: { position: "relative" }, children: [
    /* @__PURE__ */ t(
      "summary",
      {
        "aria-label": e,
        title: e,
        style: { listStyle: "none", cursor: "pointer", padding: "2px 8px", borderRadius: 6, color: "var(--muted)" },
        children: "⋯"
      }
    ),
    /* @__PURE__ */ t(
      "div",
      {
        role: "menu",
        style: {
          position: "absolute",
          right: 0,
          top: "100%",
          zIndex: 5,
          minWidth: 180,
          padding: 4,
          background: "var(--card)",
          border: "1px solid var(--border-strong)",
          borderRadius: 8
        },
        children: n.map((i) => /* @__PURE__ */ t(
          "button",
          {
            type: "button",
            role: "menuitem",
            onClick: () => {
              s.current && (s.current.open = !1), i.onClick();
            },
            style: {
              display: "block",
              width: "100%",
              textAlign: "left",
              fontSize: 13,
              padding: "6px 10px",
              border: 0,
              borderRadius: 6,
              background: "transparent",
              color: "var(--text)",
              cursor: "pointer"
            },
            children: i.label
          },
          i.label
        ))
      }
    )
  ] });
}
const O = { fontSize: 12, padding: "2px 10px" };
function qe({
  e,
  first: n,
  onMark: s,
  onWhy: i,
  onSend: r
}) {
  const [o, d] = h(e.reply_draft || "");
  Y(() => d(e.reply_draft || ""), [e.reply_draft]);
  const p = `sr-reply-${e.key.replace(/[^A-Za-z0-9]/g, "-")}`, k = [
    ...e.permalink ? [{ label: "Open in Slack", onClick: () => window.open(e.permalink, "_blank", "noopener,noreferrer") }] : [],
    { label: "Done without sending", onClick: () => s("done") },
    { label: "Why? Ask the lead", onClick: i }
  ];
  return /* @__PURE__ */ t("li", { className: "text-sm", style: { padding: "10px 0", borderTop: n ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ a("div", { className: "flex items-start gap-2", children: [
    /* @__PURE__ */ t("div", { style: { flex: "none", minWidth: 28 }, children: De(e.priority) }),
    /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
      /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        e.reason,
        " · ",
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        " · ",
        We(e.age_hours)
      ] }),
      /* @__PURE__ */ t("label", { htmlFor: p, className: "text-xs text-muted", style: { display: "block", marginTop: 6 }, children: "Reply to the thread, sent as you" }),
      /* @__PURE__ */ t(
        "textarea",
        {
          id: p,
          value: o,
          maxLength: 1500,
          rows: 3,
          onChange: (C) => d(C.target.value),
          style: {
            width: "100%",
            marginTop: 2,
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
    /* @__PURE__ */ a("div", { className: "flex items-center gap-1", style: { flex: "none" }, children: [
      /* @__PURE__ */ t(x, { style: O, disabled: !o.trim(), onClick: () => r(o.trim(), o.trim() !== (e.reply_draft || "").trim()), children: "Send to thread" }),
      /* @__PURE__ */ t(x, { style: O, onClick: () => s("ignored"), children: "Ignore" }),
      /* @__PURE__ */ t(oe, { label: "More actions", actions: k })
    ] })
  ] }) });
}
function Xe({
  e,
  first: n,
  onMark: s,
  onWhy: i,
  onDispatch: r,
  busy: o
}) {
  const d = !!e.handoff_title && !!r, p = e.dispatch;
  return /* @__PURE__ */ t("li", { className: "text-sm", style: { padding: "10px 0", borderTop: n ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ a("div", { className: "flex items-start gap-2", children: [
    /* @__PURE__ */ t("div", { style: { flex: "none", minWidth: 28 }, children: De(e.priority) }),
    /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
      d && !p && /* @__PURE__ */ a("div", { className: "text-xs", style: { marginTop: 2 }, children: [
        "Fix: ",
        e.handoff_title
      ] }),
      p && /* @__PURE__ */ a("div", { className: "text-xs", style: { marginTop: 2 }, "data-testid": "fix-in-progress", children: [
        /* @__PURE__ */ t(de, { d: p }),
        " · ",
        me[p.state] || p.state,
        p.pr_url && /* @__PURE__ */ a(A, { children: [
          " · ",
          /* @__PURE__ */ a("a", { className: "underline", href: p.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
            "PR #",
            p.pr_number
          ] })
        ] })
      ] }),
      /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        e.reason,
        e.words && e.words.length > 0 && /* @__PURE__ */ a(A, { children: [
          " (",
          e.words.join(", "),
          ")"
        ] }),
        " · ",
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        " · ",
        We(e.age_hours),
        e.permalink && /* @__PURE__ */ a(A, { children: [
          " · ",
          /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open in Slack" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ t("div", { className: "flex items-center gap-1", style: { flex: "none" }, children: p ? /* @__PURE__ */ a(A, { children: [
      /* @__PURE__ */ t(x, { style: O, onClick: () => s("ignored"), children: "Ignore" }),
      /* @__PURE__ */ t(
        oe,
        {
          label: "More actions",
          actions: [
            { label: "Done", onClick: () => s("done") },
            { label: "Why? Ask the lead", onClick: i }
          ]
        }
      )
    ] }) : d ? /* @__PURE__ */ a(A, { children: [
      /* @__PURE__ */ t(x, { style: O, onClick: r, disabled: o, children: o ? "Dispatching…" : "Dispatch fix" }),
      /* @__PURE__ */ t(x, { style: O, onClick: () => s("ignored"), children: "Ignore" }),
      /* @__PURE__ */ t(
        oe,
        {
          label: "More actions",
          actions: [
            { label: "Done", onClick: () => s("done") },
            { label: "Why? Ask the lead", onClick: i }
          ]
        }
      )
    ] }) : /* @__PURE__ */ a(A, { children: [
      /* @__PURE__ */ t(x, { style: O, onClick: () => s("done"), children: "Done" }),
      /* @__PURE__ */ t(x, { style: O, onClick: () => s("ignored"), children: "Ignore" }),
      /* @__PURE__ */ t(oe, { label: "More actions", actions: [{ label: "Why? Ask the lead", onClick: i }] })
    ] }) })
  ] }) });
}
const Ae = typeof xe.useChatLauncher == "function" ? xe.useChatLauncher : () => null, me = { running: "working", idle: "waiting", closed: "session closed", unknown: "" };
function de({ d: e }) {
  const n = Ae(), s = `/chat?sid=${encodeURIComponent(e.session_key)}`;
  return /* @__PURE__ */ t(
    "a",
    {
      className: "underline",
      href: s,
      onClick: (i) => {
        n && (i.preventDefault(), n.openChat({ slotKey: e.session_key }));
      },
      children: e.title || "Fix session"
    }
  );
}
function ve(e) {
  try {
    return JSON.parse(String(e.body || "{}"));
  } catch {
    return {};
  }
}
function Ze(e) {
  const n = ne(), s = Ae(), [i, r] = h(""), [o, d] = h(null), [p, k] = h(null), [C, m] = h(null), [f, N] = h(null), [I, $] = h(!1), L = async (R) => {
    if (!i) {
      r(R), k(null);
      try {
        const w = await n.post(`${_}/items/handoff/dispatch`, { key: R });
        w.mode === "server" ? d({ session_key: w.session_key, title: w.title }) : s ? s.openChat({ agent: w.agent, message: w.seed, autoSend: !0 }) : ($(!1), N({ title: w.title, seed: w.seed })), e();
      } catch (w) {
        const v = ve(w);
        v.code === "already_dispatched" && v.session_key ? d({ session_key: v.session_key, title: v.title || "", again: !0 }) : k({ key: R, why: v.error || "the gateway refused it" });
      } finally {
        r("");
      }
    }
  }, u = async (R) => {
    var w;
    if (i || R.length === 0) return !1;
    r("batch"), m(null);
    try {
      const v = await n.post(`${_}/items/handoff/dispatch-batch`, { keys: R });
      return v.mode === "server" ? d({ session_key: v.session_key, title: v.title, batch: !0 }) : s ? s.openChat({ agent: v.agent, message: v.seed, autoSend: !0 }) : ($(!1), N({ title: v.title, seed: v.seed })), e(), !0;
    } catch (v) {
      const P = ve(v), g = (w = P.dispatched) != null && w.length ? `${P.dispatched.length} of them already have a session` : P.error || "the gateway refused it";
      return m({ keys: R, why: g }), !1;
    } finally {
      r("");
    }
  }, S = async () => {
    if (f)
      try {
        await navigator.clipboard.writeText(f.seed), $(!0);
      } catch {
        $(!1);
      }
  }, B = /* @__PURE__ */ a(A, { children: [
    p && /* @__PURE__ */ t(Z, { message: `Could not dispatch that fix: ${p.why}. Nothing was sent.`, onRetry: () => L(p.key) }),
    C && /* @__PURE__ */ t(
      Z,
      {
        message: `Could not dispatch those fixes: ${C.why}. Nothing was sent.`,
        onRetry: () => u(C.keys)
      }
    ),
    o && /* @__PURE__ */ a(
      "div",
      {
        role: "status",
        "data-testid": "dispatch-toast",
        className: "text-sm flex items-center gap-2",
        style: { position: "fixed", right: 16, bottom: 16, zIndex: 40, background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "8px 12px", maxWidth: 480 },
        children: [
          /* @__PURE__ */ a("span", { style: { flex: 1, minWidth: 0 }, children: [
            o.again ? "Already dispatched: " : o.batch ? "Fixes dispatched to one conductor: " : "Fix dispatched to a conductor: ",
            /* @__PURE__ */ t(de, { d: o })
          ] }),
          /* @__PURE__ */ t(x, { style: O, onClick: () => d(null), children: "Close" })
        ]
      }
    ),
    f && /* @__PURE__ */ t(
      "div",
      {
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "sr-fix-title",
        style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" },
        onKeyDown: (R) => R.key === "Escape" && N(null),
        children: /* @__PURE__ */ a("div", { style: { width: "min(720px, 92vw)", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: 16 }, children: [
          /* @__PURE__ */ t("h3", { id: "sr-fix-title", className: "text-sm", style: { margin: "0 0 6px", fontWeight: 600 }, children: f.title }),
          /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 8px" }, children: "This Kiro Crew cannot open the session for you. Copy this task into a new kirocrew-conductor chat." }),
          /* @__PURE__ */ t(
            "textarea",
            {
              readOnly: !0,
              "aria-label": "Fix task",
              value: f.seed,
              style: { width: "100%", height: 260, fontSize: 12, fontFamily: "var(--font-mono, monospace)" }
            }
          ),
          /* @__PURE__ */ a("div", { className: "flex items-center gap-2", style: { marginTop: 8 }, children: [
            /* @__PURE__ */ t(x, { onClick: S, children: I ? "Copied" : "Copy task" }),
            /* @__PURE__ */ t("a", { className: "underline text-sm", href: "/chat?new=1", children: "New chat" }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(x, { onClick: () => N(null), children: "Close" })
          ] })
        ] })
      }
    )
  ] });
  return { dispatch: L, dispatchBatch: u, busyKey: i, ui: B };
}
function et({
  rows: e,
  busy: n,
  onSend: s,
  onCancel: i
}) {
  const [r, o] = h(() => new Set(e.map((m) => m.key))), d = e.filter((m) => r.has(m.key)), k = new Set(d.map((m) => m.repo.toLowerCase())).size > 1, C = (m) => o((f) => {
    const N = new Set(f);
    return N.has(m) ? N.delete(m) : N.add(m), N;
  });
  return /* @__PURE__ */ a(
    "section",
    {
      "aria-label": "Dispatch fixes together",
      "data-testid": "batch-panel",
      style: { margin: "8px 0", padding: 10, border: "1px solid var(--border-strong)", borderRadius: 8 },
      children: [
        /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 6px" }, children: "One conductor gets every checked fix and splits the work. Uncheck any you want to leave out." }),
        /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { margin: 0, padding: 0, listStyle: "none" }, children: e.map((m, f) => /* @__PURE__ */ t("li", { style: { padding: "6px 0", borderTop: f === 0 ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ a("label", { className: "text-sm flex gap-2", style: { alignItems: "flex-start", cursor: "pointer" }, children: [
          /* @__PURE__ */ t("input", { type: "checkbox", checked: r.has(m.key), onChange: () => C(m.key), style: { marginTop: 3 } }),
          /* @__PURE__ */ a("span", { style: { flex: 1, minWidth: 0 }, children: [
            m.title,
            " ",
            /* @__PURE__ */ t("span", { className: "text-xs text-muted font-mono", children: m.repo }),
            /* @__PURE__ */ t("span", { className: "text-xs text-muted", style: { display: "block" }, children: m.prompt.length > 120 ? `${m.prompt.slice(0, 120)}…` : m.prompt })
          ] })
        ] }) }, m.key)) }),
        /* @__PURE__ */ a("div", { className: "flex items-center gap-2", style: { marginTop: 8 }, children: [
          /* @__PURE__ */ t(x, { primary: !0, style: O, disabled: n || d.length === 0 || k, onClick: () => s(d.map((m) => m.key)), children: n ? "Dispatching…" : `Dispatch ${d.length} to one conductor` }),
          /* @__PURE__ */ t(x, { style: O, onClick: i, disabled: n, children: "Cancel" }),
          k && /* @__PURE__ */ t("span", { className: "text-xs text-muted", role: "status", children: "one repo per batch" })
        ] })
      ]
    }
  );
}
function tt({
  needs: e,
  today: n,
  handled: s,
  onChanged: i,
  onWhy: r
}) {
  var U;
  const o = ne(), d = Ze(i), p = (e == null ? void 0 : e.fixes) || [], k = (e == null ? void 0 : e.fix_batches) || [], C = new Map(k.map((l) => [l.session_key, l])), m = new Map(((e == null ? void 0 : e.handoffs) || []).map((l) => [l.key, l.handoff])), f = (((U = ((e == null ? void 0 : e.groups) || []).find((l) => l.id === "decide")) == null ? void 0 : U.entries) || []).filter((l) => l.handoff_title && !l.dispatch && m.has(l.key)).map((l) => {
    const c = m.get(l.key);
    return { key: l.key, title: l.handoff_title || c.title, repo: c.repo || "", prompt: c.prompt || "" };
  }), [N, I] = h(!1), [$, L] = h(null), [u, S] = h("");
  Y(() => {
    if (!u) return;
    const l = window.setTimeout(() => S(""), 4e3);
    return () => window.clearTimeout(l);
  }, [u]);
  const B = async (l, c, b, T) => {
    L(null), W((F) => new Set(F).add(T));
    try {
      b && await o.post(`${_}/items/reply/draft`, { key: l, text: c }), await o.post(`${_}/items/reply/send`, { key: l }), S("Sent as you"), i();
    } catch (F) {
      W((te) => {
        const ie = new Set(te);
        return ie.delete(T), ie;
      }), L({ key: l, text: c, edited: b, why: F.message || "unknown error" });
    }
  }, R = (e == null ? void 0 : e.replied) || [], [w, v] = h(""), P = async (l) => {
    v("");
    try {
      await o.post(`${_}/items/handoff/dismiss`, { key: l }), i();
    } catch {
      v(l);
    }
  }, [g, W] = h(/* @__PURE__ */ new Set()), [M, z] = h(null);
  Y(() => W(/* @__PURE__ */ new Set()), [e]);
  const y = async (l, c, b) => {
    z(null), b && W((T) => new Set(T).add(b));
    try {
      for (const T of l) await o.post(`${_}/items/handle`, { key: T, how: c });
      i();
    } catch {
      b && W((T) => {
        const F = new Set(T);
        return F.delete(b), F;
      }), z({ keys: l, how: c, rowId: b });
    }
  }, j = ((e == null ? void 0 : e.groups) || []).map((l) => ({
    ...l,
    shown: l.entries.filter((c) => !g.has(`${l.id}:${c.key}`))
  })), se = j.every((l) => l.shown.length === 0), ee = (M == null ? void 0 : M.how) === "reopen" ? "reopen" : (M == null ? void 0 : M.how) === "ignored" ? "ignore" : "mark as done";
  return /* @__PURE__ */ a(E, { className: "mb-4", children: [
    /* @__PURE__ */ a("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ t(Q, { children: "Needs you" }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      f.length >= 2 && !N && /* @__PURE__ */ a(x, { style: O, onClick: () => I(!0), disabled: !!d.busyKey, children: [
        "Dispatch all fixes (",
        f.length,
        ")"
      ] })
    ] }),
    N && f.length > 0 && /* @__PURE__ */ t(
      et,
      {
        rows: f,
        busy: d.busyKey === "batch",
        onCancel: () => I(!1),
        onSend: async (l) => {
          await d.dispatchBatch(l) && I(!1);
        }
      }
    ),
    (n == null ? void 0 : n.text) && /* @__PURE__ */ a("p", { className: "text-sm", style: { margin: "0 0 8px" }, "data-testid": "crew-today", children: [
      n.text,
      n.at > 0 && /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
        " · ",
        J(n.at)
      ] })
    ] }),
    u && /* @__PURE__ */ t("p", { role: "status", className: "text-sm", style: { margin: "0 0 8px", color: "var(--success, var(--text))" }, children: u }),
    $ && /* @__PURE__ */ t(
      Z,
      {
        message: `Could not send that reply: ${$.why}`,
        onRetry: () => B($.key, $.text, $.edited, `decide:${$.key}`)
      }
    ),
    M && /* @__PURE__ */ t(
      Z,
      {
        message: `Could not ${ee} that message. Nothing changed.`,
        onRetry: () => y(M.keys, M.how, M.rowId)
      }
    ),
    e ? se ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Nothing needs you right now." }) : j.map(
      (l) => l.shown.length === 0 ? null : /* @__PURE__ */ a("section", { "aria-label": fe[l.id], style: { marginTop: 10 }, children: [
        /* @__PURE__ */ a("h4", { className: "text-sm", style: { margin: 0, fontWeight: 600, color: "var(--text-strong)" }, children: [
          fe[l.id],
          " ",
          /* @__PURE__ */ a("span", { className: "text-muted", style: { fontWeight: 400 }, children: [
            "(",
            l.total - (l.entries.length - l.shown.length),
            ")"
          ] })
        ] }),
        /* @__PURE__ */ t("ul", { className: "flex flex-col", children: l.shown.map((c, b) => l.id === "decide" && c.reply_draft && !c.handoff_title ? /* @__PURE__ */ t(
          qe,
          {
            e: c,
            first: b === 0,
            onMark: (T) => y([c.key], T, `${l.id}:${c.key}`),
            onWhy: () => r(c),
            onSend: (T, F) => B(c.key, T, F, `${l.id}:${c.key}`)
          },
          c.key
        ) : /* @__PURE__ */ t(
          Xe,
          {
            e: c,
            first: b === 0,
            onMark: (T) => {
              var F;
              return y((F = c.members) != null && F.length ? c.members : [c.key], T, `${l.id}:${c.key}`);
            },
            onWhy: () => r(c),
            onDispatch: l.id === "decide" && c.handoff_title ? () => d.dispatch(c.key) : void 0,
            busy: d.busyKey === c.key
          },
          c.key
        )) })
      ] }, l.id)
    ) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" }),
    w && /* @__PURE__ */ t(Z, { message: "Could not dismiss that hand-off. Nothing changed.", onRetry: () => P(w) }),
    p.length > 0 && /* @__PURE__ */ a("details", { style: { marginTop: 12 }, "data-testid": "fixes-in-flight", children: [
      /* @__PURE__ */ a("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Fixes in flight (",
        (e == null ? void 0 : e.fixes_total) ?? p.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: p.map((l, c) => {
        const b = l.dispatch.batch ? C.get(l.dispatch.session_key) : void 0, T = b && b.keys[0] === l.key, F = { padding: "6px 0", borderTop: c === 0 ? 0 : "1px solid var(--border)" }, te = l.dispatch.pr_url && /* @__PURE__ */ a(A, { children: [
          " · ",
          /* @__PURE__ */ a("a", { className: "underline", href: l.dispatch.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
            "PR #",
            l.dispatch.pr_number
          ] })
        ] });
        return /* @__PURE__ */ a("li", { className: "text-sm", style: b ? { ...F, ...T ? {} : { borderTop: 0, paddingTop: 0 } } : F, children: [
          T && b && /* @__PURE__ */ a("div", { "data-testid": "fix-batch-header", style: { marginBottom: 4 }, children: [
            /* @__PURE__ */ t(de, { d: b }),
            /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
              " · ",
              me[b.state] || b.state || "sent",
              " · ",
              /* @__PURE__ */ t("span", { className: "font-mono", children: b.repo }),
              " · ",
              b.prs_found,
              " PRs found / ",
              b.total,
              " · ",
              J(b.at)
            ] })
          ] }),
          /* @__PURE__ */ a("div", { className: "flex items-center gap-2", style: b ? { paddingLeft: 16 } : void 0, children: [
            /* @__PURE__ */ a("span", { style: { flex: 1, minWidth: 0 }, children: [
              b ? l.handoff_title : /* @__PURE__ */ a(A, { children: [
                /* @__PURE__ */ t(de, { d: l.dispatch }),
                /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
                  " · ",
                  me[l.dispatch.state] || l.dispatch.state || "sent",
                  " · ",
                  /* @__PURE__ */ t("span", { className: "font-mono", children: l.repo }),
                  " · ",
                  J(l.dispatch.at)
                ] })
              ] }),
              te
            ] }),
            /* @__PURE__ */ t(x, { style: O, onClick: () => P(l.key), children: "Dismiss" })
          ] })
        ] }, l.key);
      }) })
    ] }),
    ((e == null ? void 0 : e.handled_total) || 0) > 0 && /* @__PURE__ */ a("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ a("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Handled (",
        e == null ? void 0 : e.handled_total,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: s.map((l, c) => /* @__PURE__ */ a(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: c === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 0 }, children: l.summary || l.text.slice(0, 200) }),
            /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
              l.handled_how === "ignored" ? "Ignored" : "Done",
              " ",
              J(l.handled_at)
            ] }),
            /* @__PURE__ */ t(x, { style: O, onClick: () => y([l.key], "reopen"), children: "Reopen" })
          ]
        },
        l.key
      )) })
    ] }),
    R.length > 0 && /* @__PURE__ */ a("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ a("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Replied (",
        (e == null ? void 0 : e.replied_total) ?? R.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: R.map((l, c) => /* @__PURE__ */ a(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: c === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ a("span", { style: { flex: 1, minWidth: 0 }, children: [
              l.text.length > 120 ? `${l.text.slice(0, 119)}…` : l.text,
              /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
                " · ",
                l.summary,
                " · ",
                /* @__PURE__ */ t("span", { className: "font-mono", children: l.channel }),
                " · ",
                J(l.at)
              ] })
            ] }),
            l.permalink && /* @__PURE__ */ t("a", { className: "underline text-xs", href: l.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open reply" })
          ]
        },
        l.key
      )) })
    ] }),
    d.ui
  ] });
}
function nt({ it: e, first: n, checked: s, onToggle: i }) {
  const r = e.priority ? { label: e.priority, variant: e.priority === "p0" || e.priority === "p1" ? "err" : "muted" } : e.possibly_resolved ? { label: "possibly resolved", variant: "warn" } : null, o = [
    e.category && `category: ${e.category}`,
    e.possibly_resolved && `possibly resolved: ${e.possibly_resolved.reason}`
  ].filter(Boolean);
  return /* @__PURE__ */ t("li", { className: "text-sm", style: { padding: "10px 0", borderTop: n ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ a("div", { className: "flex items-start gap-2", children: [
    /* @__PURE__ */ t(
      "input",
      {
        type: "checkbox",
        "aria-label": `Select ${e.key} for investigation`,
        checked: s,
        onChange: i,
        style: { marginTop: 4 }
      }
    ),
    /* @__PURE__ */ a("div", { className: "flex items-center gap-1", style: { flex: "none" }, children: [
      /* @__PURE__ */ t(H, { variant: He(e.status), children: e.status }),
      r && /* @__PURE__ */ t(H, { variant: r.variant, children: r.label }),
      o.length > 0 && /* @__PURE__ */ a("span", { className: "text-xs text-muted", title: o.join(`
`), "aria-label": o.join("; "), children: [
        "+",
        o.length
      ] })
    ] }),
    /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || e.text.slice(0, 280) }),
      /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        e.user && /* @__PURE__ */ a(A, { children: [
          " · ",
          e.user
        ] }),
        e.reply_count > 0 && /* @__PURE__ */ a(A, { children: [
          " · ",
          e.reply_count,
          " replies"
        ] }),
        " · ",
        /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "open in Slack" }),
        e.links.length > 0 && /* @__PURE__ */ a(A, { children: [
          " · linked ",
          e.links.map((d) => /* @__PURE__ */ t("a", { className: "underline mr-2", href: d, target: "_blank", rel: "noreferrer noopener", children: d.replace("https://github.com/", "") }, d))
        ] })
      ] }),
      e.note && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: e.note })
    ] })
  ] }) });
}
function at({ state: e, busy: n, onDigest: s }) {
  const i = e.digest, r = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), o = i.last_posted_date === r;
  return /* @__PURE__ */ a(E, { className: "mb-4", children: [
    /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ t(Q, { children: o ? "Today's digest" : "Latest digest" }),
      i.pending ? /* @__PURE__ */ t(H, { variant: "aim", children: "being delivered" }) : null,
      /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: i.last_posted_date ? `${i.last_posted_date} · ${e.settings.digest_destination === "self_dm" ? "DMed to you" : "dashboard notification"}` : "none yet" }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      /* @__PURE__ */ t(x, { onClick: s, disabled: !!n || !e.crew.live, children: "Request digest" })
    ] }),
    i.last_text ? /* @__PURE__ */ t("pre", { className: "whitespace-pre-wrap text-sm mt-2", style: { fontFamily: "inherit", margin: "8px 0 0" }, children: i.last_text }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted mt-2", children: "The Radar Lead writes one after the daily cron or when you press Request digest." }),
    i.last_error && /* @__PURE__ */ t("p", { className: "text-xs mt-1", style: { color: "var(--danger)" }, children: i.last_error })
  ] });
}
function st({ state: e }) {
  return /* @__PURE__ */ t("div", { className: "flex items-center gap-2", style: { marginTop: 10 }, children: ae.map((n) => /* @__PURE__ */ a("span", { title: `${n.title} · ${q(n, e).label}`, children: [
    /* @__PURE__ */ t(ge, { m: n, s: e, selected: n.id === "lead", size: 30 }),
    /* @__PURE__ */ t("span", { className: "sr-only", children: `${n.title}: ${q(n, e).label}` })
  ] }, n.id)) });
}
function it(e) {
  const n = `slack-radar:chat-open:${e}`, s = () => {
    try {
      return window.localStorage.getItem(n) === "1";
    } catch {
      return !1;
    }
  }, [i, r] = h(s);
  Y(() => r(s()), [n]);
  const o = he(
    (d) => {
      r(d);
      try {
        d ? window.localStorage.setItem(n, "1") : window.localStorage.removeItem(n);
      } catch {
      }
    },
    [n]
  );
  return [i, o];
}
function be({ q: e, onClick: n, disabled: s }) {
  return /* @__PURE__ */ t(
    "button",
    {
      type: "button",
      onClick: n,
      disabled: s,
      style: {
        fontSize: 12,
        border: "1px solid var(--border-strong)",
        borderRadius: 999,
        padding: "4px 10px",
        background: "transparent",
        color: "var(--text)",
        cursor: s ? "not-allowed" : "pointer",
        opacity: s ? 0.5 : 1,
        whiteSpace: "nowrap"
      },
      children: e
    }
  );
}
function lt(e) {
  const n = ne(), { state: s, expanded: i, pending: r } = e, o = ae[0], d = s.crew.slot_key, p = s.crew.live && s.crew.session_open && s.crew.session_agent === s.crew.agent, [k, C] = h(""), [m, f] = h(!1), [N, I] = h(""), [$, L] = h(!1), u = q(o, s), S = async (g) => {
    await n.post(`${_}/crew/message`, { message: g }), e.onChanged();
  }, B = async (g) => {
    const W = g.trim();
    if (W) {
      f(!0), I("");
      try {
        await n.post(`${_}/crew/message`, { message: W }), C(""), W === r && e.setPending(""), e.setExpanded(!0), e.onChanged();
      } catch {
        I(W);
      } finally {
        f(!1);
      }
    }
  }, R = async () => {
    try {
      await navigator.clipboard.writeText(r), L(!0), window.setTimeout(() => L(!1), 1500);
    } catch {
      L(!1);
    }
  }, w = N && /* @__PURE__ */ t(Z, { message: "The Radar Lead did not get that message.", onRetry: () => B(N) }), v = /* @__PURE__ */ t("div", { className: "text-sm", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }, children: s.crew.live ? /* @__PURE__ */ a(A, { children: [
    /* @__PURE__ */ t("span", { children: "The Radar Lead session opens on its next turn. Open it now to talk here." }),
    /* @__PURE__ */ t(x, { primary: !0, onClick: e.onStart, disabled: !!e.busy || !e.configured, children: "Open the session" })
  ] }) : /* @__PURE__ */ a("span", { children: [
    "The Radar Lead is paused. Turn on ",
    /* @__PURE__ */ t("b", { children: "Crew" }),
    " at the top of the page to triage your channels and talk to it here."
  ] }) });
  if (!i)
    return /* @__PURE__ */ a(E, { className: "mb-4", style: { padding: "10px 14px" }, children: [
      /* @__PURE__ */ a(
        "form",
        {
          className: "flex flex-wrap items-center gap-2",
          onSubmit: (g) => {
            g.preventDefault(), B(k);
          },
          children: [
            /* @__PURE__ */ t(ge, { m: o, s, size: 26 }),
            /* @__PURE__ */ t(
              K,
              {
                "aria-label": "Ask the lead",
                placeholder: "Ask the lead…",
                value: k,
                onChange: (g) => C(g.target.value),
                disabled: !p || m,
                style: { flex: 1, minWidth: 200 }
              }
            ),
            /* @__PURE__ */ t(x, { primary: !0, type: "submit", disabled: !p || m || !k.trim(), children: "Send" }),
            ye.map((g) => /* @__PURE__ */ t(be, { q: g, onClick: () => B(g), disabled: !p || m }, g))
          ]
        }
      ),
      !p && /* @__PURE__ */ t("div", { style: { marginTop: 8 }, children: v }),
      w
    ] });
  const P = e.events.filter((g) => g.kind === "crew" || g.kind === "digest").slice(0, 5);
  return /* @__PURE__ */ a(
    E,
    {
      className: "mb-4",
      style: { padding: 0, display: "flex", flexDirection: "column", height: "min(620px, calc(100vh - 180px))", overflow: "hidden" },
      children: [
        /* @__PURE__ */ a("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border)" }, children: [
          /* @__PURE__ */ a("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: s.crew.name || o.title }),
            /* @__PURE__ */ t(H, { variant: u.tone === "muted" ? "muted" : u.tone === "aim" ? "aim" : "ok", children: u.label }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(x, { onClick: () => e.setExpanded(!1), "aria-expanded": !0, children: "Collapse" })
          ] }),
          /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
            "phase ",
            s.crew_memory.phase,
            " · next: ",
            s.crew_memory.next || "—"
          ] }),
          /* @__PURE__ */ t(st, { state: s })
        ] }),
        /* @__PURE__ */ t(Ke, { state: s }),
        r && // ChatEmbed has no API to fill its composer, so the question waits here.
        /* @__PURE__ */ a(
          "div",
          {
            className: "text-sm flex flex-wrap items-center gap-2",
            style: { padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" },
            children: [
              /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200, userSelect: "all" }, children: r }),
              /* @__PURE__ */ t(x, { primary: !0, style: O, onClick: () => B(r), disabled: !p || m, children: "Send" }),
              /* @__PURE__ */ t(x, { style: O, onClick: R, children: $ ? "Copied" : "Copy" })
            ]
          }
        ),
        w && /* @__PURE__ */ t("div", { style: { padding: "0 16px" }, children: w }),
        /* @__PURE__ */ t("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: p ? /* @__PURE__ */ t(
          Le,
          {
            slotKey: d,
            agent: s.crew.agent,
            frameless: !0,
            startAtBottom: !0,
            placeholder: "Ask the Radar Lead…",
            onSend: S
          },
          d
        ) : /* @__PURE__ */ a("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 10 }, children: [
          v,
          !e.configured && /* @__PURE__ */ t("p", { className: "text-xs text-muted", children: "Add a channel in Settings first." }),
          P.length > 0 && /* @__PURE__ */ t("ul", { className: "text-xs text-muted flex flex-col gap-1", style: { marginTop: 6 }, children: P.map((g, W) => /* @__PURE__ */ a("li", { children: [
            J(g.at),
            " · ",
            g.text
          ] }, `${g.at}-${W}`)) })
        ] }) }),
        /* @__PURE__ */ t("div", { className: "flex flex-wrap gap-2", style: { padding: "10px 16px 12px", borderTop: "1px solid var(--border)" }, children: ye.map((g) => /* @__PURE__ */ t(be, { q: g, onClick: () => B(g), disabled: !p || m }, g)) })
      ]
    }
  );
}
function rt({ state: e }) {
  return /* @__PURE__ */ a(E, { children: [
    /* @__PURE__ */ t(Q, { children: "Team" }),
    /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { marginBottom: 8 }, children: "Who works on your channels. Only the Radar Lead has a session; the others run when needed." }),
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: ae.map((n) => {
      var i, r;
      const s = n.id === "lead" ? e.crew.agent : n.agent;
      return /* @__PURE__ */ a(
        "li",
        {
          className: "flex items-start gap-3",
          style: { padding: "12px 4px", borderTop: "1px solid var(--border)", opacity: n.planned ? 0.7 : 1 },
          children: [
            /* @__PURE__ */ t(ge, { m: n, s: e, size: 36 }),
            /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
              /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2", children: [
                /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: n.id === "lead" && e.crew.name || n.title }),
                /* @__PURE__ */ t(H, { variant: "muted", children: n.layer }),
                /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: n.kind })
              ] }),
              /* @__PURE__ */ t("p", { className: "text-sm", style: { margin: "4px 0 0" }, children: n.duty }),
              n.id === "investigator" && (((i = e.investigations) == null ? void 0 : i.items) || 0) > 0 && /* @__PURE__ */ a("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: [
                (r = e.investigations) == null ? void 0 : r.items,
                " item(s) under investigation"
              ] }),
              s && /* @__PURE__ */ t(_e, { children: /* @__PURE__ */ a("span", { className: "font-mono", children: [
                "agent: ",
                s,
                n.id === "lead" && e.crew.slot_key ? ` · session: ${e.crew.slot_key}` : ""
              ] }) })
            ] }),
            /* @__PURE__ */ t("div", { "data-testid": `team-status-${n.id}`, style: { maxWidth: 360, minWidth: 0, display: "flex" }, children: /* @__PURE__ */ t(Ce, { m: n, state: e, withName: !1 }) })
          ]
        },
        n.id
      );
    }) })
  ] });
}
function ot({ events: e, kinds: n, onShowAll: s }) {
  const i = n ? e.filter((r) => n.includes(r.kind)) : e;
  return /* @__PURE__ */ a(E, { children: [
    /* @__PURE__ */ t(Q, { children: "Activity" }),
    n && /* @__PURE__ */ a("p", { className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { marginBottom: 8 }, children: [
      /* @__PURE__ */ t("span", { children: "Showing the crew and its members only." }),
      /* @__PURE__ */ t(x, { style: O, onClick: s, children: "Show all" })
    ] }),
    i.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No activity yet." }) : /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", children: i.map((r, o) => /* @__PURE__ */ a("li", { children: [
      /* @__PURE__ */ t("span", { className: "text-muted", children: ue(r.at) }),
      " ",
      /* @__PURE__ */ t(H, { variant: "muted", children: r.kind }),
      " ",
      r.text
    ] }, `${r.at}-${o}`)) })
  ] });
}
function dt({
  state: e,
  busy: n,
  act: s,
  mcp: i,
  onProbe: r
}) {
  const o = ne(), [d, p] = h(e.settings.channels.join(`
`)), [k, C] = h(e.settings.digest_destination), [m, f] = h(e.settings.slack_login), [N, I] = h(e.settings.slack_mcp_command), [$, L] = h(e.settings.workspace_url), [u, S] = h(String(e.settings.poll_interval_secs)), [B, R] = h(String(e.settings.backfill_hours)), [w, v] = h(e.crew.unattended), [P, g] = h(e.crew.agent), [W, M] = h(e.crew.model), z = () => s(
    "Save settings",
    () => o.put(`${_}/settings`, {
      channels: d.split(/[\s,]+/).map((y) => y.trim()).filter(Boolean),
      digest_destination: k,
      slack_login: m.trim(),
      slack_mcp_command: N.trim(),
      workspace_url: $.trim(),
      poll_interval_secs: Number(u),
      backfill_hours: Number(B)
    })
  );
  return /* @__PURE__ */ a(A, { children: [
    !e.vault_available && /* @__PURE__ */ t(E, { className: "mb-4", children: /* @__PURE__ */ t("p", { className: "text-sm", children: "The gateway secret vault is unavailable, so settings cannot be saved." }) }),
    /* @__PURE__ */ a(E, { className: "mb-4", children: [
      /* @__PURE__ */ t(Q, { children: "Basics" }),
      /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(Re, { mcp: i, state: e }) }),
        /* @__PURE__ */ t(x, { disabled: !!n, onClick: r, children: "Check connection" })
      ] }),
      /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 12px" }, children: "Slack is read as you, read-only: no bot, no invite. The one write is the optional digest DM to yourself." }),
      /* @__PURE__ */ t("label", { className: "block text-sm mb-1", htmlFor: "sr-channels", children: "Channels to watch (one channel ID per line, e.g. C0123ABCD). Any channel you can read works." }),
      /* @__PURE__ */ t(
        "textarea",
        {
          id: "sr-channels",
          className: "w-full font-mono text-sm border rounded p-2 bg-transparent",
          rows: 5,
          value: d,
          onChange: (y) => p(y.target.value)
        }
      ),
      /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Digest destination",
          /* @__PURE__ */ a(
            "select",
            {
              className: "block w-full text-sm bg-transparent border rounded px-2 py-1",
              value: k,
              onChange: (y) => C(y.target.value),
              children: [
                /* @__PURE__ */ t("option", { value: "dashboard", children: "Dashboard notification only" }),
                /* @__PURE__ */ t("option", { value: "self_dm", children: "DM to myself in Slack" })
              ]
            }
          )
        ] }),
        k === "self_dm" && /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Your Slack login (for the DM)",
          /* @__PURE__ */ t(K, { value: m, onChange: (y) => f(y.target.value), placeholder: "jdoe" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Poll interval (seconds, 60–3600)",
          /* @__PURE__ */ t(K, { type: "number", min: 60, max: 3600, value: u, onChange: (y) => S(y.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(x, { primary: !0, className: "mt-3", disabled: !!n, onClick: z, children: "Save settings" })
    ] }),
    /* @__PURE__ */ t(E, { children: /* @__PURE__ */ a("details", { children: [
      /* @__PURE__ */ t("summary", { style: { cursor: "pointer", fontWeight: 600, color: "var(--text-strong)" }, children: "Advanced" }),
      /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "MCP server command (a single executable on PATH)",
          /* @__PURE__ */ t(K, { value: N, onChange: (y) => I(y.target.value), placeholder: "ai-community-slack-mcp" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Workspace URL (for permalinks, optional)",
          /* @__PURE__ */ t(K, { value: $, onChange: (y) => L(y.target.value), placeholder: "https://yourteam.slack.com" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "First-poll backfill (hours, 0–168)",
          /* @__PURE__ */ t(K, { type: "number", min: 0, max: 168, value: B, onChange: (y) => R(y.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(x, { className: "mt-3", disabled: !!n, onClick: z, children: "Save settings" }),
      /* @__PURE__ */ a("div", { style: { borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }, children: [
        /* @__PURE__ */ t("div", { className: "text-sm", style: { fontWeight: 600, marginBottom: 8 }, children: "Crew" }),
        /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
          /* @__PURE__ */ a("label", { className: "text-sm", children: [
            "Agent",
            /* @__PURE__ */ t(K, { value: P, onChange: (y) => g(y.target.value), placeholder: "slack-radar-crew" }),
            /* @__PURE__ */ t("span", { className: "block text-xs text-muted mt-1", children: "Default: the shipped slack-radar-crew agent. Your own agents are never modified." })
          ] }),
          /* @__PURE__ */ a("label", { className: "text-sm", children: [
            "Model (empty = agent default)",
            /* @__PURE__ */ t(K, { value: W, onChange: (y) => M(y.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ a("div", { className: "mt-3 flex items-center gap-2", children: [
          /* @__PURE__ */ t(
            we,
            {
              checked: w,
              onChange: v,
              label: "Unattended mode (auto-approve investigator commands)",
              describedBy: "sr-unattended-risk"
            }
          ),
          /* @__PURE__ */ t("span", { className: "text-sm", children: "Unattended mode (auto-approve investigator commands)" })
        ] }),
        /* @__PURE__ */ t("p", { id: "sr-unattended-risk", className: "text-xs text-muted mt-1", children: "Risk: anyone in a watched channel can write text the crew reads, so a crafted message could steer a command nobody reviews." }),
        /* @__PURE__ */ t(
          x,
          {
            primary: !0,
            className: "mt-3",
            disabled: !!n,
            onClick: () => s("Save crew", () => o.put(`${_}/crew`, { agent: P, model: W, unattended: w })),
            children: "Save crew"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  ut as default
};
