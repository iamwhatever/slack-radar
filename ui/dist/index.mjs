import { jsxs as s, Fragment as F, jsx as t } from "react/jsx-runtime";
import * as xe from "@kirocrew/app-sdk";
import { useAppApi as ae, ChatEmbed as Ie } from "@kirocrew/app-sdk";
import { PageHeader as Fe, Toggle as _e, Btn as S, Card as M, CardTitle as Y, StatCard as oe, Input as K, EmptyState as Pe, Badge as G } from "@kirocrew/app-sdk/ui";
import { useState as m, useCallback as me, useEffect as J, useRef as ue, useMemo as de } from "react";
const C = "/api/apps/slack-radar", Oe = {
  checking: "checking…",
  connected: "connected",
  needs_login: "sign in again",
  binary_not_found: "not installed",
  incompatible: "missing read access",
  error: "not working"
}, ye = ["What needs me today?", "Draft today's digest", "Which threads look resolved?"], Me = [
  { id: "board", label: "Board" },
  { id: "ledger", label: "Ledger" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" }
], ge = (e) => e ? new Date(e * 1e3).toLocaleString() : "never";
function H(e) {
  if (!e) return "never";
  const n = Math.max(0, Date.now() / 1e3 - e);
  return n < 90 ? "just now" : n < 3600 ? `${Math.round(n / 60)} min ago` : n < 86400 ? `${Math.round(n / 3600)} h ago` : ge(e);
}
function Se(e, n) {
  return n === "needs_login" ? "needs_login" : (e == null ? void 0 : e.status) || "checking";
}
function $e({ children: e, summary: n = "Details" }) {
  return /* @__PURE__ */ s("details", { className: "text-xs text-muted", style: { marginTop: 6 }, children: [
    /* @__PURE__ */ t("summary", { style: { cursor: "pointer" }, children: n }),
    /* @__PURE__ */ t("div", { style: { marginTop: 4 }, children: e })
  ] });
}
const se = [
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
], he = (e, n) => {
  var a;
  return (a = e.now) == null ? void 0 : a.members.find((r) => r.id === n);
};
function V(e, n) {
  var o;
  const a = he(n, e.id);
  if (e.id === "lead")
    return (a == null ? void 0 : a.state) === "paused" || !n.crew.live ? { label: "paused", tone: "muted" } : (a ? a.state === "working" : n.crew.running) ? { label: "working", tone: "aim" } : { label: "live", tone: "ok" };
  if (e.id === "poller")
    return n.source_state === "needs_login" ? { label: "sign in again", tone: "warn" } : (a == null ? void 0 : a.state) === "paused" ? { label: "paused", tone: "warn" } : { label: `polled ${H(n.last_poll_at)}`, tone: "muted" };
  const r = a ? a.count : e.id === "investigator" && ((o = n.investigations) == null ? void 0 : o.running) || 0;
  return r ? { label: `${r} running`, tone: "aim" } : (a == null ? void 0 : a.state) === "planned" ? { label: "not started yet", tone: "muted" } : { label: "idle", tone: "muted" };
}
function Z(e) {
  if (!e) return "--";
  const n = new Date(e * 1e3), a = n.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: !1 });
  return n.toDateString() === (/* @__PURE__ */ new Date()).toDateString() ? a : `${n.toLocaleDateString([], { month: "short", day: "numeric" })} ${a}`;
}
function Ee(e) {
  if (!e) return "";
  const n = Math.round(e - Date.now() / 1e3);
  return n <= 0 ? "now" : Ce(Date.now() / 1e3 - n);
}
function ze(e, n) {
  if (!(n != null && n.last)) return "";
  const { started_at: a, finished_at: r } = n.last;
  if (e.id === "poller") {
    if (!a) return "has not polled yet";
    const o = Ee(n.next_at);
    return `last ${Z(a)}${o ? ` · next ${o === "now" ? "due now" : `in ${o}`}` : ""}`;
  }
  return e.id === "lead" ? a ? `last wake ${Z(a)}` : "not woken yet" : a ? r ? `last run ${Z(a)}–${Z(r)}` : `last run ${Z(a)}` : "last run --";
}
function je(e) {
  var n, a;
  return !(e != null && e.ran) || e.ran === "running" ? "" : e.ran === "never" ? "never ran" : `idle since ${Z(((n = e.last) == null ? void 0 : n.finished_at) || ((a = e.last) == null ? void 0 : a.started_at))}`;
}
function Ce(e) {
  if (!e) return "";
  const n = Math.max(0, Math.round(Date.now() / 1e3 - e));
  return n < 90 ? `${n}s` : n < 90 * 60 ? `${Math.round(n / 60)}m` : `${Math.round(n / 3600)}h`;
}
const Ue = (e, n = 60) => e.length > n ? `${e.slice(0, n - 1).trimEnd()}…` : e;
function ve(e, n) {
  const a = he(n, e.id);
  if (!a) return V(e, n).label;
  const r = ze(e, a);
  return e.id === "poller" ? r && a.state === "paused" ? `${a.doing.split(" · ")[0]} · ${r}` : r || a.doing : a.state !== "working" ? a.state === "paused" ? `paused: ${a.doing}` : r || V(e, n).label : e.id === "lead" ? `working: ${a.doing}` : `${a.count} running: ${a.doing}`;
}
const Ke = `@keyframes slack-radar-pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.7) } }
.sr-pulse { animation: slack-radar-pulse 1.4s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .sr-pulse { animation: none } }`;
function Te({ tone: e, pulse: n }) {
  return /* @__PURE__ */ t(
    "i",
    {
      "aria-hidden": !0,
      className: n ? "sr-pulse" : void 0,
      style: { width: 8, height: 8, borderRadius: "50%", flex: "none", display: "inline-block", background: De[e] }
    }
  );
}
function Re({ m: e, state: n, withName: a = !0, withResting: r = !1, onOpen: o }) {
  const d = V(e, n), c = he(n, e.id), g = c ? c.state === "working" : d.tone === "aim", x = r && (e.id === "investigator" || e.id === "watcher") ? je(c) : "", y = x ? `${x} · ${ve(e, n)}` : ve(e, n), h = e.id === "lead" && n.crew.name || e.title, v = /* @__PURE__ */ s(F, { children: [
    /* @__PURE__ */ t(Te, { tone: d.tone, pulse: g }),
    a && /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: h }),
    /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: Ue(y) })
  ] }), b = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    fontSize: 13,
    opacity: g || d.tone === "warn" ? 1 : 0.6,
    color: "var(--text)"
  }, T = { title: `${h} · ${y}`, "data-member": e.id, "data-state": (c == null ? void 0 : c.state) || (g ? "working" : "idle") };
  return o ? /* @__PURE__ */ t(
    "button",
    {
      type: "button",
      onClick: o,
      ...T,
      "aria-label": `${h}: ${y}. Show activity`,
      style: { ...b, background: "transparent", border: 0, padding: 0, cursor: "pointer" },
      children: v
    }
  ) : /* @__PURE__ */ t("span", { ...T, style: b, children: v });
}
function He({ state: e, onOpenActivity: n }) {
  return /* @__PURE__ */ s(
    "div",
    {
      "data-testid": "now-strip",
      role: "status",
      "aria-label": "Who is working right now",
      className: "flex flex-wrap items-center",
      style: { gap: "6px 18px", padding: "8px 12px", marginBottom: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-elevated)", minWidth: 0 },
      children: [
        /* @__PURE__ */ t("span", { className: "text-xs text-muted", style: { fontWeight: 600, letterSpacing: ".04em" }, children: "NOW" }),
        se.map((a) => /* @__PURE__ */ t(
          Re,
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
function Ge({ state: e }) {
  const n = se.filter((a) => a.id === "investigator" || a.id === "watcher").map((a) => ({ m: a, row: he(e, a.id) })).filter(({ row: a }) => (a == null ? void 0 : a.state) === "working");
  return n.length ? /* @__PURE__ */ t("div", { "data-testid": "chat-running", style: { padding: "6px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" }, children: n.map(({ m: a, row: r }) => {
    const o = Ce(r.since), d = `${a.title} running${r.count > 1 ? ` (${r.count})` : ""} · ${r.doing}${o ? ` · ${o}` : ""}`;
    return /* @__PURE__ */ s("div", { className: "text-xs flex items-center gap-2", title: d, style: { minWidth: 0 }, children: [
      /* @__PURE__ */ t(Te, { tone: "aim", pulse: !0 }),
      /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: d })
    ] }, a.id);
  }) }) : null;
}
const De = {
  ok: "var(--ok)",
  aim: "var(--aim)",
  warn: "var(--warn)",
  muted: "var(--muted-strong)"
};
function fe({ m: e, s: n, selected: a, size: r = 32 }) {
  const o = V(e, n), d = e.planned || e.id === "poller", c = {
    width: r,
    height: r,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    fontWeight: 700,
    position: "relative",
    flex: "none",
    background: d ? "transparent" : "var(--bg-hover)",
    color: d ? "var(--muted)" : "var(--text-strong)",
    border: `2px ${d ? "dashed" : "solid"} ${a ? "var(--accent)" : d ? "var(--border-strong)" : "transparent"}`,
    opacity: e.planned ? 0.6 : 1
  };
  return /* @__PURE__ */ s("span", { style: c, "aria-hidden": !0, children: [
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
          background: De[o.tone]
        }
      }
    )
  ] });
}
function Qe(e) {
  return e === "new" ? "warn" : e === "investigating" ? "aim" : e === "resolved" ? "ok" : "muted";
}
function Ye({ tab: e, setTab: n }) {
  return /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Slack Radar sections", style: { display: "flex", gap: 4 }, children: Me.map((a) => {
    const r = e === a.id;
    return /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": r,
        onClick: () => n(a.id),
        style: {
          padding: "6px 12px",
          borderRadius: 8,
          border: 0,
          cursor: "pointer",
          fontSize: 14,
          background: r ? "var(--bg-hover)" : "transparent",
          color: r ? "var(--text-strong)" : "var(--muted)"
        },
        children: a.label
      },
      a.id
    );
  }) });
}
function qe({
  state: e,
  configured: n,
  busy: a,
  onStart: r,
  onPause: o
}) {
  const d = e.crew.live;
  return /* @__PURE__ */ s("div", { className: "flex items-center gap-2", title: !d && !n ? "Add a channel in Settings first" : void 0, children: [
    /* @__PURE__ */ t("span", { className: "text-sm", children: "Crew" }),
    /* @__PURE__ */ t(
      _e,
      {
        checked: d,
        disabled: !!a || !d && !n,
        onChange: (g) => g ? r() : o(),
        label: d ? "Pause the crew" : "Start the crew"
      }
    ),
    /* @__PURE__ */ s("span", { className: "text-xs text-muted", title: "Whether the crew's commands run without asking you", children: [
      "Unattended: ",
      e.crew.trusted ? "on" : "off"
    ] })
  ] });
}
function kt() {
  const e = ae(), [n, a] = m("board"), [r, o] = m(null), [d, c] = m([]), [g, x] = m(null), [y, h] = m([]), [v, b] = m([]), [T, R] = m("open"), [W, D] = m(/* @__PURE__ */ new Set()), [L, k] = m(""), [l, p] = m(""), [w, $] = m(null), [f, B] = m(null), [O, j] = m(null), N = me(async () => {
    try {
      $(await e.get(`${C}/mcp/status`));
    } catch (I) {
      $({ status: "error", command: "", detail: I.message });
    }
  }, [e]);
  J(() => {
    N();
  }, [N]);
  const U = me(async () => {
    var I;
    try {
      const [Q, X, le, q, Be] = await Promise.all([
        e.get(`${C}/state`),
        e.get(`${C}/items?status=${encodeURIComponent(T)}&limit=300`),
        e.get(`${C}/events?limit=150`),
        e.get(`${C}/needs`),
        e.get(`${C}/items?handled=1&limit=100`)
      ]);
      o(Q), B(((I = Q.now) == null ? void 0 : I.members) || null), c(X.items), x(q), h(Be.items), b(le.events.slice().reverse());
    } catch (Q) {
      p(`Could not load: ${Q.message}`);
    }
  }, [e, T]);
  J(() => {
    U();
    const I = window.setInterval(U, 3e4);
    return () => window.clearInterval(I);
  }, [U]);
  const re = !!(f != null && f.some((I) => I.state === "working")), te = ue("");
  J(() => {
    if (!re) return;
    const I = async () => {
      try {
        const X = await e.get(`${C}/now`);
        B(X.members);
        const le = X.members.map((q) => `${q.id}:${q.state}:${q.count}`).join(",");
        if (te.current && le !== te.current) {
          const q = await e.get(`${C}/events?limit=150`);
          b(q.events.slice().reverse());
        }
        te.current = le;
      } catch {
      }
    }, Q = window.setInterval(I, 5e3);
    return () => window.clearInterval(Q);
  }, [re, e]);
  const z = de(() => r && f ? { ...r, now: { members: f } } : r, [r, f]), i = () => {
    j(["member", "crew", "investigate"]), a("activity");
  }, u = async (I, Q) => {
    k(I), p("");
    try {
      await Q(), p(`${I}: done`), await U();
    } catch (X) {
      p(`${I} failed: ${X.message}`);
    } finally {
      k("");
    }
  }, _ = !!r && r.settings.channels.length > 0, A = (r == null ? void 0 : r.settings.channels.length) || 0, P = r ? `${A ? `Watching ${A} channel${A === 1 ? "" : "s"}` : "No channels yet"} · ${r.crew.live ? "running" : "paused"}` : "A small crew triaging your Slack channels", ne = r ? Se(w, r.source_state) : "checking", ie = () => {
    N(), U();
  };
  return /* @__PURE__ */ s(F, { children: [
    /* @__PURE__ */ t(
      Fe,
      {
        title: "Slack Radar",
        subtitle: P,
        actions: /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-4", children: [
          /* @__PURE__ */ t(
            Ye,
            {
              tab: n,
              setTab: (I) => {
                j(null), a(I);
              }
            }
          ),
          r && /* @__PURE__ */ t(
            qe,
            {
              state: r,
              configured: _,
              busy: L,
              onStart: () => u("Start crew", () => e.post(`${C}/crew/start`, {})),
              onPause: () => u("Pause crew", () => e.post(`${C}/crew/pause`, {}))
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ t("style", { children: Ke }),
    /* @__PURE__ */ s("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      z && n === "board" && /* @__PURE__ */ t(He, { state: z, onOpenActivity: i }),
      r && ne === "needs_login" && /* @__PURE__ */ t(Je, { mcp: w, sourceError: r.source_error, busy: L, onCheck: ie }),
      l && /* @__PURE__ */ t("p", { role: "status", className: "text-sm text-muted mb-3", children: l }),
      z ? n === "board" ? /* @__PURE__ */ t(
        Ve,
        {
          state: z,
          needs: g,
          handled: y,
          configured: _,
          mcp: w,
          busy: L,
          onPoll: () => u("Poll", () => e.post(`${C}/poll`, {})),
          onStart: () => u("Start crew", () => e.post(`${C}/crew/start`, {})),
          onDigest: () => u("Request digest", () => e.post(`${C}/digest/request`, {})),
          events: v,
          onChanged: U
        }
      ) : n === "ledger" ? /* @__PURE__ */ t(
        ct,
        {
          state: z,
          items: d,
          filter: T,
          setFilter: R,
          selected: W,
          setSelected: D,
          busy: L,
          onInvestigate: (I) => u("Investigate", async () => {
            await e.post(`${C}/investigate`, { keys: [...W], repo: I }), D(/* @__PURE__ */ new Set());
          })
        }
      ) : n === "team" ? /* @__PURE__ */ t(gt, { state: z }) : n === "activity" ? /* @__PURE__ */ t(ft, { events: v, kinds: O, onShowAll: () => j(null) }) : /* @__PURE__ */ t(xt, { state: z, busy: L, act: u, mcp: w, onProbe: N }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" })
    ] })
  ] });
}
function We({ mcp: e, sourceError: n }) {
  var r;
  const a = [
    (e == null ? void 0 : e.status) && `status: ${e.status}`,
    (e == null ? void 0 : e.command) && `command: ${e.command}`,
    n && `error: ${n}`,
    (e == null ? void 0 : e.detail) && e.detail !== n && `detail: ${e.detail}`,
    ((r = e == null ? void 0 : e.missing_read_tools) == null ? void 0 : r.length) && `missing read tools: ${e.missing_read_tools.join(", ")}`
  ].filter(Boolean);
  return a.length ? /* @__PURE__ */ t($e, { children: /* @__PURE__ */ t("pre", { className: "font-mono whitespace-pre-wrap", style: { margin: 0 }, children: a.join(`
`) }) }) : null;
}
function Je({ mcp: e, sourceError: n, busy: a, onCheck: r }) {
  return /* @__PURE__ */ s(
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
        /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-3", children: [
          /* @__PURE__ */ s("div", { style: { flex: 1, minWidth: 240 }, children: [
            /* @__PURE__ */ t("div", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: "Slack connection: sign in again" }),
            /* @__PURE__ */ t("div", { className: "text-sm", children: "Your Slack sign-in expired, so no new messages are read. Sign in to Slack again on the computer running Kiro Crew, then check again. Nothing is lost; reading picks up where it stopped." })
          ] }),
          /* @__PURE__ */ t(S, { primary: !0, onClick: r, disabled: !!a, children: "I signed in, check again" })
        ] }),
        /* @__PURE__ */ t(We, { mcp: e, sourceError: n })
      ]
    }
  );
}
function Le({ mcp: e, state: n, withPoll: a }) {
  const r = Se(e, n.source_state), o = r === "connected";
  return /* @__PURE__ */ s("div", { className: "mb-4", children: [
    /* @__PURE__ */ s("p", { role: "status", className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { margin: 0 }, children: [
      /* @__PURE__ */ t("span", { "aria-hidden": !0, style: { width: 8, height: 8, borderRadius: "50%", background: o ? "var(--ok)" : r === "checking" ? "var(--muted-strong)" : "var(--warn)", display: "inline-block" } }),
      /* @__PURE__ */ s("span", { children: [
        "Slack connection: ",
        /* @__PURE__ */ t("span", { style: { color: o ? "var(--text)" : "var(--warn)" }, children: Oe[r] || r })
      ] }),
      a && /* @__PURE__ */ s("span", { children: [
        "· last poll ",
        H(n.last_poll_at),
        n.settings.channels.length > 0 && /* @__PURE__ */ s(F, { children: [
          " · watching ",
          n.settings.channels.join(", ")
        ] })
      ] })
    ] }),
    !o && r !== "needs_login" && /* @__PURE__ */ t(We, { mcp: e, sourceError: n.source_error })
  ] });
}
function Ve(e) {
  const { state: n } = e, [a, r] = m(""), [o, d] = pt(n.crew.slot_key), c = ue(null), g = (x) => {
    r(Ze(x)), d(!0), window.requestAnimationFrame(() => {
      var y;
      return (y = c.current) == null ? void 0 : y.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };
  return /* @__PURE__ */ s("div", { style: { minWidth: 0 }, children: [
    /* @__PURE__ */ s("div", { className: "flex flex-wrap items-start gap-3", children: [
      /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(Le, { mcp: e.mcp, state: n, withPoll: !0 }) }),
      /* @__PURE__ */ t(S, { onClick: e.onPoll, disabled: !!e.busy || !e.configured, children: "Poll now" })
    ] }),
    /* @__PURE__ */ t("div", { ref: c, children: /* @__PURE__ */ t(
      ut,
      {
        state: n,
        events: e.events,
        configured: e.configured,
        busy: e.busy,
        expanded: o,
        setExpanded: d,
        pending: a,
        setPending: r,
        onStart: e.onStart,
        onChanged: e.onChanged
      }
    ) }),
    !e.configured && /* @__PURE__ */ s(M, { className: "mb-4", children: [
      /* @__PURE__ */ t(Y, { children: "Finish setup" }),
      /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite." })
    ] }),
    /* @__PURE__ */ t(
      it,
      {
        needs: e.needs,
        today: n.crew.today,
        handled: e.handled,
        onChanged: e.onChanged,
        onWhy: g
      }
    ),
    /* @__PURE__ */ t(ht, { state: n, busy: e.busy, onDigest: e.onDigest })
  ] });
}
const be = {
  decide: "Needs a decision",
  unanswered: "Questions nobody answered",
  clusters: "Reported more than once"
};
function Xe(e) {
  return e < 1 ? `${Math.max(1, Math.round(e * 60))} min ago` : e < 48 ? `${Math.round(e)} h ago` : `${Math.floor(e / 24)} days ago`;
}
const we = 5;
function Ze(e) {
  return `Why is "${e.summary.length > 80 ? `${e.summary.slice(0, 79)}…` : e.summary}" ${e.priority || "on my list"}?`;
}
function et(e) {
  return e ? /* @__PURE__ */ t(G, { variant: e === "p0" || e === "p1" ? "err" : "muted", children: e }) : null;
}
function ee({ message: e, onRetry: n }) {
  return /* @__PURE__ */ s(
    "div",
    {
      role: "alert",
      className: "text-sm flex flex-wrap items-center gap-2",
      style: { border: "1px solid var(--danger)", borderRadius: 8, padding: "8px 12px", margin: "8px 0" },
      children: [
        /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200 }, children: e }),
        /* @__PURE__ */ t(S, { onClick: n, children: "Try again" })
      ]
    }
  );
}
const E = { fontSize: 12, padding: "2px 10px" };
function tt(e, n) {
  return e === "decide" && n.dispatch ? "Done" : e === "decide" && n.handoff_title ? "Dispatch fix" : e === "decide" && n.reply_draft ? "Reply" : e === "decide" && n.reason.startsWith("Looks resolved") ? "Done" : e === "unanswered" && n.permalink ? "Reply" : "Decide";
}
function nt({
  e,
  groupId: n,
  first: a,
  onMark: r,
  onWhy: o,
  onDispatch: d,
  onSend: c,
  busy: g
}) {
  const x = tt(n, e), y = n === "decide" && !!e.reply_draft && !e.handoff_title && !!c, [h, v] = m(!1), [b, T] = m(e.reply_draft || "");
  J(() => T(e.reply_draft || ""), [e.reply_draft]);
  const R = ue(null), W = e.key.replace(/[^A-Za-z0-9]/g, "-"), D = `sr-reply-${n}-${W}`, L = `sr-row-${n}-${W}`, k = e.dispatch, l = () => e.permalink && window.open(e.permalink, "_blank", "noopener,noreferrer"), p = () => {
    x === "Dispatch fix" ? d == null || d() : x === "Done" ? r("done") : x === "Reply" && !y ? l() : (v(!0), y && window.requestAnimationFrame(() => {
      var $;
      return ($ = R.current) == null ? void 0 : $.focus();
    }));
  }, w = [
    ...x !== "Done" ? [{ label: y ? "Done without sending" : "Done", onClick: () => r("done") }] : [],
    { label: "Ignore", onClick: () => r("ignored") },
    { label: "Why? Ask the lead", onClick: o }
  ];
  return /* @__PURE__ */ s(
    "li",
    {
      className: "text-sm",
      "data-testid": "need-row",
      "data-priority": e.priority || "",
      "data-age-hours": e.age_hours,
      style: { padding: "8px 0", borderTop: a ? 0 : "1px solid var(--border)" },
      children: [
        /* @__PURE__ */ s("div", { className: "flex items-start gap-2", children: [
          /* @__PURE__ */ t("div", { style: { flex: "none", minWidth: 28 }, children: et(e.priority) }),
          /* @__PURE__ */ s("div", { style: { minWidth: 0, flex: 1 }, children: [
            /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
            /* @__PURE__ */ s("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
              e.reason,
              " · ",
              /* @__PURE__ */ t("span", { "data-testid": "need-age", children: Xe(e.age_hours) })
            ] }),
            k && /* @__PURE__ */ s("div", { className: "text-xs", style: { marginTop: 2 }, "data-testid": "fix-in-progress", children: [
              /* @__PURE__ */ t(ce, { d: k }),
              " · ",
              pe[k.state] || k.state,
              k.pr_url && /* @__PURE__ */ s(F, { children: [
                " · ",
                /* @__PURE__ */ s("a", { className: "underline", href: k.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
                  "PR #",
                  k.pr_number
                ] })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ s("div", { className: "flex items-center gap-1", style: { flex: "none" }, "data-testid": "need-actions", children: [
            /* @__PURE__ */ t(S, { primary: !0, style: E, onClick: p, disabled: x === "Dispatch fix" && g, children: x === "Dispatch fix" && g ? "Dispatching…" : x }),
            /* @__PURE__ */ t(
              "button",
              {
                type: "button",
                "aria-expanded": h,
                "aria-controls": L,
                "aria-label": h ? "Hide details" : "Show details and more actions",
                title: h ? "Hide details" : "Details and more actions",
                onClick: () => v(!h),
                style: { border: 0, background: "transparent", cursor: "pointer", padding: "2px 8px", borderRadius: 6, color: "var(--muted)" },
                children: h ? "▴" : "▾"
              }
            )
          ] })
        ] }),
        h && /* @__PURE__ */ s("div", { id: L, "data-testid": "need-more", style: { margin: "6px 0 0 36px" }, children: [
          /* @__PURE__ */ s("div", { className: "text-xs text-muted", children: [
            /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
            e.category && /* @__PURE__ */ s(F, { children: [
              " · ",
              e.category
            ] }),
            e.words && e.words.length > 0 && /* @__PURE__ */ s(F, { children: [
              " · shared words: ",
              e.words.join(", ")
            ] }),
            e.members && e.members.length > 0 && /* @__PURE__ */ s(F, { children: [
              " · Done and Ignore apply to all ",
              e.members.length
            ] }),
            e.permalink && /* @__PURE__ */ s(F, { children: [
              " · ",
              /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open in Slack" })
            ] })
          ] }),
          e.handoff_title && !k && /* @__PURE__ */ s("div", { className: "text-xs", style: { marginTop: 4 }, children: [
            "Fix: ",
            e.handoff_title
          ] }),
          y && /* @__PURE__ */ s(F, { children: [
            /* @__PURE__ */ t("label", { htmlFor: D, className: "text-xs text-muted", style: { display: "block", marginTop: 6 }, children: "Reply to the thread, sent as you" }),
            /* @__PURE__ */ t(
              "textarea",
              {
                id: D,
                ref: R,
                value: b,
                maxLength: 1500,
                rows: 3,
                onChange: ($) => T($.target.value),
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
          /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-1", style: { marginTop: 6 }, "data-testid": "need-secondary", children: [
            y && /* @__PURE__ */ t(
              S,
              {
                primary: !0,
                style: E,
                disabled: !b.trim(),
                onClick: () => c == null ? void 0 : c(b.trim(), b.trim() !== (e.reply_draft || "").trim()),
                children: "Send to thread"
              }
            ),
            w.map(($) => /* @__PURE__ */ t(S, { style: E, onClick: $.onClick, children: $.label }, $.label))
          ] })
        ] })
      ]
    }
  );
}
function at({ g: e, render: n }) {
  const [a, r] = m(!1), o = a ? e.shown : e.shown.slice(0, we), d = e.shown.length - o.length;
  return /* @__PURE__ */ s(F, { children: [
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: o.map(n) }),
    (d > 0 || a && e.shown.length > we) && /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        className: "text-xs underline",
        onClick: () => r(!a),
        style: { border: 0, background: "transparent", cursor: "pointer", padding: "4px 0", color: "var(--muted)" },
        children: a ? "Show fewer" : `Show ${d} more`
      }
    )
  ] });
}
const Ae = typeof xe.useChatLauncher == "function" ? xe.useChatLauncher : () => null, pe = { running: "working", idle: "waiting", closed: "session closed", unknown: "" };
function ce({ d: e }) {
  const n = Ae(), a = `/chat?sid=${encodeURIComponent(e.session_key)}`;
  return /* @__PURE__ */ t(
    "a",
    {
      className: "underline",
      href: a,
      onClick: (r) => {
        n && (r.preventDefault(), n.openChat({ slotKey: e.session_key }));
      },
      children: e.title || "Fix session"
    }
  );
}
function ke(e) {
  try {
    return JSON.parse(String(e.body || "{}"));
  } catch {
    return {};
  }
}
function st(e) {
  const n = ae(), a = Ae(), [r, o] = m(""), [d, c] = m(null), [g, x] = m(null), [y, h] = m(null), [v, b] = m(null), [T, R] = m(!1), W = async (l) => {
    if (!r) {
      o(l), x(null);
      try {
        const p = await n.post(`${C}/items/handoff/dispatch`, { key: l });
        p.mode === "server" ? c({ session_key: p.session_key, title: p.title }) : a ? a.openChat({ agent: p.agent, message: p.seed, autoSend: !0 }) : (R(!1), b({ title: p.title, seed: p.seed })), e();
      } catch (p) {
        const w = ke(p);
        w.code === "already_dispatched" && w.session_key ? c({ session_key: w.session_key, title: w.title || "", again: !0 }) : x({ key: l, why: w.error || "the gateway refused it" });
      } finally {
        o("");
      }
    }
  }, D = async (l) => {
    var p;
    if (r || l.length === 0) return !1;
    o("batch"), h(null);
    try {
      const w = await n.post(`${C}/items/handoff/dispatch-batch`, { keys: l });
      return w.mode === "server" ? c({ session_key: w.session_key, title: w.title, batch: !0 }) : a ? a.openChat({ agent: w.agent, message: w.seed, autoSend: !0 }) : (R(!1), b({ title: w.title, seed: w.seed })), e(), !0;
    } catch (w) {
      const $ = ke(w), f = (p = $.dispatched) != null && p.length ? `${$.dispatched.length} of them already have a session` : $.error || "the gateway refused it";
      return h({ keys: l, why: f }), !1;
    } finally {
      o("");
    }
  }, L = async () => {
    if (v)
      try {
        await navigator.clipboard.writeText(v.seed), R(!0);
      } catch {
        R(!1);
      }
  }, k = /* @__PURE__ */ s(F, { children: [
    g && /* @__PURE__ */ t(ee, { message: `Could not dispatch that fix: ${g.why}. Nothing was sent.`, onRetry: () => W(g.key) }),
    y && /* @__PURE__ */ t(
      ee,
      {
        message: `Could not dispatch those fixes: ${y.why}. Nothing was sent.`,
        onRetry: () => D(y.keys)
      }
    ),
    d && /* @__PURE__ */ s(
      "div",
      {
        role: "status",
        "data-testid": "dispatch-toast",
        className: "text-sm flex items-center gap-2",
        style: { position: "fixed", right: 16, bottom: 16, zIndex: 40, background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "8px 12px", maxWidth: 480 },
        children: [
          /* @__PURE__ */ s("span", { style: { flex: 1, minWidth: 0 }, children: [
            d.again ? "Already dispatched: " : d.batch ? "Fixes dispatched to one conductor: " : "Fix dispatched to a conductor: ",
            /* @__PURE__ */ t(ce, { d })
          ] }),
          /* @__PURE__ */ t(S, { style: E, onClick: () => c(null), children: "Close" })
        ]
      }
    ),
    v && /* @__PURE__ */ t(
      "div",
      {
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "sr-fix-title",
        style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" },
        onKeyDown: (l) => l.key === "Escape" && b(null),
        children: /* @__PURE__ */ s("div", { style: { width: "min(720px, 92vw)", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: 16 }, children: [
          /* @__PURE__ */ t("h3", { id: "sr-fix-title", className: "text-sm", style: { margin: "0 0 6px", fontWeight: 600 }, children: v.title }),
          /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 8px" }, children: "This Kiro Crew cannot open the session for you. Copy this task into a new kirocrew-conductor chat." }),
          /* @__PURE__ */ t(
            "textarea",
            {
              readOnly: !0,
              "aria-label": "Fix task",
              value: v.seed,
              style: { width: "100%", height: 260, fontSize: 12, fontFamily: "var(--font-mono, monospace)" }
            }
          ),
          /* @__PURE__ */ s("div", { className: "flex items-center gap-2", style: { marginTop: 8 }, children: [
            /* @__PURE__ */ t(S, { onClick: L, children: T ? "Copied" : "Copy task" }),
            /* @__PURE__ */ t("a", { className: "underline text-sm", href: "/chat?new=1", children: "New chat" }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(S, { onClick: () => b(null), children: "Close" })
          ] })
        ] })
      }
    )
  ] });
  return { dispatch: W, dispatchBatch: D, busyKey: r, ui: k };
}
function rt({
  rows: e,
  busy: n,
  onSend: a,
  onCancel: r
}) {
  const [o, d] = m(() => new Set(e.map((h) => h.key))), c = e.filter((h) => o.has(h.key)), x = new Set(c.map((h) => h.repo.toLowerCase())).size > 1, y = (h) => d((v) => {
    const b = new Set(v);
    return b.has(h) ? b.delete(h) : b.add(h), b;
  });
  return /* @__PURE__ */ s(
    "section",
    {
      "aria-label": "Dispatch fixes together",
      "data-testid": "batch-panel",
      style: { margin: "8px 0", padding: 10, border: "1px solid var(--border-strong)", borderRadius: 8 },
      children: [
        /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 6px" }, children: "One conductor gets every checked fix and splits the work. Uncheck any you want to leave out." }),
        /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { margin: 0, padding: 0, listStyle: "none" }, children: e.map((h, v) => /* @__PURE__ */ t("li", { style: { padding: "6px 0", borderTop: v === 0 ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ s("label", { className: "text-sm flex gap-2", style: { alignItems: "flex-start", cursor: "pointer" }, children: [
          /* @__PURE__ */ t("input", { type: "checkbox", checked: o.has(h.key), onChange: () => y(h.key), style: { marginTop: 3 } }),
          /* @__PURE__ */ s("span", { style: { flex: 1, minWidth: 0 }, children: [
            h.title,
            " ",
            /* @__PURE__ */ t("span", { className: "text-xs text-muted font-mono", children: h.repo }),
            /* @__PURE__ */ t("span", { className: "text-xs text-muted", style: { display: "block" }, children: h.prompt.length > 120 ? `${h.prompt.slice(0, 120)}…` : h.prompt })
          ] })
        ] }) }, h.key)) }),
        /* @__PURE__ */ s("div", { className: "flex items-center gap-2", style: { marginTop: 8 }, children: [
          /* @__PURE__ */ t(S, { primary: !0, style: E, disabled: n || c.length === 0 || x, onClick: () => a(c.map((h) => h.key)), children: n ? "Dispatching…" : `Dispatch ${c.length} to one conductor` }),
          /* @__PURE__ */ t(S, { style: E, onClick: r, disabled: n, children: "Cancel" }),
          x && /* @__PURE__ */ t("span", { className: "text-xs text-muted", role: "status", children: "one repo per batch" })
        ] })
      ]
    }
  );
}
function it({
  needs: e,
  today: n,
  handled: a,
  onChanged: r,
  onWhy: o
}) {
  var z;
  const d = ae(), c = st(r), g = (e == null ? void 0 : e.fixes) || [], x = (e == null ? void 0 : e.fix_batches) || [], y = new Map(x.map((i) => [i.session_key, i])), h = new Map(((e == null ? void 0 : e.handoffs) || []).map((i) => [i.key, i.handoff])), v = (((z = ((e == null ? void 0 : e.groups) || []).find((i) => i.id === "decide")) == null ? void 0 : z.entries) || []).filter((i) => i.handoff_title && !i.dispatch && h.has(i.key)).map((i) => {
    const u = h.get(i.key);
    return { key: i.key, title: i.handoff_title || u.title, repo: u.repo || "", prompt: u.prompt || "" };
  }), [b, T] = m(!1), [R, W] = m(null), [D, L] = m("");
  J(() => {
    if (!D) return;
    const i = window.setTimeout(() => L(""), 4e3);
    return () => window.clearTimeout(i);
  }, [D]);
  const k = async (i, u, _, A) => {
    W(null), B((P) => new Set(P).add(A));
    try {
      _ && await d.post(`${C}/items/reply/draft`, { key: i, text: u }), await d.post(`${C}/items/reply/send`, { key: i }), L("Sent as you"), r();
    } catch (P) {
      B((ne) => {
        const ie = new Set(ne);
        return ie.delete(A), ie;
      }), W({ key: i, text: u, edited: _, why: P.message || "unknown error" });
    }
  }, l = (e == null ? void 0 : e.replied) || [], [p, w] = m(""), $ = async (i) => {
    w("");
    try {
      await d.post(`${C}/items/handoff/dismiss`, { key: i }), r();
    } catch {
      w(i);
    }
  }, [f, B] = m(/* @__PURE__ */ new Set()), [O, j] = m(null);
  J(() => B(/* @__PURE__ */ new Set()), [e]);
  const N = async (i, u, _) => {
    j(null), _ && B((A) => new Set(A).add(_));
    try {
      for (const A of i) await d.post(`${C}/items/handle`, { key: A, how: u });
      r();
    } catch {
      _ && B((A) => {
        const P = new Set(A);
        return P.delete(_), P;
      }), j({ keys: i, how: u, rowId: _ });
    }
  }, U = ((e == null ? void 0 : e.groups) || []).map((i) => ({
    ...i,
    shown: i.entries.filter((u) => !f.has(`${i.id}:${u.key}`))
  })), re = U.every((i) => i.shown.length === 0), te = (O == null ? void 0 : O.how) === "reopen" ? "reopen" : (O == null ? void 0 : O.how) === "ignored" ? "ignore" : "mark as done";
  return /* @__PURE__ */ s(M, { className: "mb-4", children: [
    /* @__PURE__ */ s("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ t(Y, { children: "Needs you" }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      v.length >= 2 && !b && /* @__PURE__ */ s(S, { style: E, onClick: () => T(!0), disabled: !!c.busyKey, children: [
        "Dispatch all fixes (",
        v.length,
        ")"
      ] })
    ] }),
    b && v.length > 0 && /* @__PURE__ */ t(
      rt,
      {
        rows: v,
        busy: c.busyKey === "batch",
        onCancel: () => T(!1),
        onSend: async (i) => {
          await c.dispatchBatch(i) && T(!1);
        }
      }
    ),
    (n == null ? void 0 : n.text) && /* @__PURE__ */ s("p", { className: "text-sm", style: { margin: "0 0 8px" }, "data-testid": "crew-today", children: [
      n.text,
      n.at > 0 && /* @__PURE__ */ s("span", { className: "text-xs text-muted", children: [
        " · ",
        H(n.at)
      ] })
    ] }),
    D && /* @__PURE__ */ t("p", { role: "status", className: "text-sm", style: { margin: "0 0 8px", color: "var(--success, var(--text))" }, children: D }),
    R && /* @__PURE__ */ t(
      ee,
      {
        message: `Could not send that reply: ${R.why}`,
        onRetry: () => k(R.key, R.text, R.edited, `decide:${R.key}`)
      }
    ),
    O && /* @__PURE__ */ t(
      ee,
      {
        message: `Could not ${te} that message. Nothing changed.`,
        onRetry: () => N(O.keys, O.how, O.rowId)
      }
    ),
    e ? re ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Nothing needs you right now." }) : U.map(
      (i) => i.shown.length === 0 ? null : /* @__PURE__ */ s("section", { "aria-label": be[i.id], style: { marginTop: 10 }, children: [
        /* @__PURE__ */ s("h4", { className: "text-sm", style: { margin: 0, fontWeight: 600, color: "var(--text-strong)" }, children: [
          be[i.id],
          " ",
          /* @__PURE__ */ s("span", { className: "text-muted", style: { fontWeight: 400 }, children: [
            "(",
            i.total - (i.entries.length - i.shown.length),
            ")"
          ] })
        ] }),
        /* @__PURE__ */ t(
          at,
          {
            g: i,
            render: (u, _) => /* @__PURE__ */ t(
              nt,
              {
                e: u,
                groupId: i.id,
                first: _ === 0,
                onMark: (A) => {
                  var P;
                  return N((P = u.members) != null && P.length ? u.members : [u.key], A, `${i.id}:${u.key}`);
                },
                onWhy: () => o(u),
                onDispatch: i.id === "decide" && u.handoff_title ? () => c.dispatch(u.key) : void 0,
                onSend: i.id === "decide" ? (A, P) => k(u.key, A, P, `${i.id}:${u.key}`) : void 0,
                busy: c.busyKey === u.key
              },
              u.key
            )
          }
        )
      ] }, i.id)
    ) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" }),
    p && /* @__PURE__ */ t(ee, { message: "Could not dismiss that hand-off. Nothing changed.", onRetry: () => $(p) }),
    g.length > 0 && /* @__PURE__ */ s("details", { style: { marginTop: 12 }, "data-testid": "fixes-in-flight", children: [
      /* @__PURE__ */ s("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Fixes in flight (",
        (e == null ? void 0 : e.fixes_total) ?? g.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: g.map((i, u) => {
        const _ = i.dispatch.batch ? y.get(i.dispatch.session_key) : void 0, A = _ && _.keys[0] === i.key, P = { padding: "6px 0", borderTop: u === 0 ? 0 : "1px solid var(--border)" }, ne = i.dispatch.pr_url && /* @__PURE__ */ s(F, { children: [
          " · ",
          /* @__PURE__ */ s("a", { className: "underline", href: i.dispatch.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
            "PR #",
            i.dispatch.pr_number
          ] })
        ] });
        return /* @__PURE__ */ s("li", { className: "text-sm", style: _ ? { ...P, ...A ? {} : { borderTop: 0, paddingTop: 0 } } : P, children: [
          A && _ && /* @__PURE__ */ s("div", { "data-testid": "fix-batch-header", style: { marginBottom: 4 }, children: [
            /* @__PURE__ */ t(ce, { d: _ }),
            /* @__PURE__ */ s("span", { className: "text-xs text-muted", children: [
              " · ",
              pe[_.state] || _.state || "sent",
              " · ",
              /* @__PURE__ */ t("span", { className: "font-mono", children: _.repo }),
              " · ",
              _.prs_found,
              " PRs found / ",
              _.total,
              " · ",
              H(_.at)
            ] })
          ] }),
          /* @__PURE__ */ s("div", { className: "flex items-center gap-2", style: _ ? { paddingLeft: 16 } : void 0, children: [
            /* @__PURE__ */ s("span", { style: { flex: 1, minWidth: 0 }, children: [
              _ ? i.handoff_title : /* @__PURE__ */ s(F, { children: [
                /* @__PURE__ */ t(ce, { d: i.dispatch }),
                /* @__PURE__ */ s("span", { className: "text-xs text-muted", children: [
                  " · ",
                  pe[i.dispatch.state] || i.dispatch.state || "sent",
                  " · ",
                  /* @__PURE__ */ t("span", { className: "font-mono", children: i.repo }),
                  " · ",
                  H(i.dispatch.at)
                ] })
              ] }),
              ne
            ] }),
            /* @__PURE__ */ t(S, { style: E, onClick: () => $(i.key), children: "Dismiss" })
          ] })
        ] }, i.key);
      }) })
    ] }),
    ((e == null ? void 0 : e.handled_total) || 0) > 0 && /* @__PURE__ */ s("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ s("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Handled (",
        e == null ? void 0 : e.handled_total,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: a.map((i, u) => /* @__PURE__ */ s(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: u === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 0 }, children: i.summary || i.text.slice(0, 200) }),
            /* @__PURE__ */ s("span", { className: "text-xs text-muted", children: [
              i.handled_how === "ignored" ? "Ignored" : "Done",
              " ",
              H(i.handled_at)
            ] }),
            /* @__PURE__ */ t(S, { style: E, onClick: () => N([i.key], "reopen"), children: "Reopen" })
          ]
        },
        i.key
      )) })
    ] }),
    l.length > 0 && /* @__PURE__ */ s("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ s("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Replied (",
        (e == null ? void 0 : e.replied_total) ?? l.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: l.map((i, u) => /* @__PURE__ */ s(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: u === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ s("span", { style: { flex: 1, minWidth: 0 }, children: [
              i.text.length > 120 ? `${i.text.slice(0, 119)}…` : i.text,
              /* @__PURE__ */ s("span", { className: "text-xs text-muted", children: [
                " · ",
                i.summary,
                " · ",
                /* @__PURE__ */ t("span", { className: "font-mono", children: i.channel }),
                " · ",
                H(i.at)
              ] })
            ] }),
            i.permalink && /* @__PURE__ */ t("a", { className: "underline text-xs", href: i.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open reply" })
          ]
        },
        i.key
      )) })
    ] }),
    c.ui
  ] });
}
function lt({ it: e, first: n, checked: a, onToggle: r }) {
  const o = e.priority ? { label: e.priority, variant: e.priority === "p0" || e.priority === "p1" ? "err" : "muted" } : e.possibly_resolved ? { label: "possibly resolved", variant: "warn" } : null, d = [
    e.category && `category: ${e.category}`,
    e.possibly_resolved && `possibly resolved: ${e.possibly_resolved.reason}`
  ].filter(Boolean);
  return /* @__PURE__ */ t("li", { className: "text-sm", style: { padding: "10px 0", borderTop: n ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ s("div", { className: "flex items-start gap-2", children: [
    /* @__PURE__ */ t(
      "input",
      {
        type: "checkbox",
        "aria-label": `Select ${e.key} for investigation`,
        checked: a,
        onChange: r,
        style: { marginTop: 4 }
      }
    ),
    /* @__PURE__ */ s("div", { className: "flex items-center gap-1", style: { flex: "none" }, children: [
      /* @__PURE__ */ t(G, { variant: Qe(e.status), children: e.status }),
      o && /* @__PURE__ */ t(G, { variant: o.variant, children: o.label }),
      d.length > 0 && /* @__PURE__ */ s("span", { className: "text-xs text-muted", title: d.join(`
`), "aria-label": d.join("; "), children: [
        "+",
        d.length
      ] })
    ] }),
    /* @__PURE__ */ s("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || e.text.slice(0, 280) }),
      /* @__PURE__ */ s("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        /* @__PURE__ */ t("span", { "data-testid": "ledger-ts", "data-ts": e.ts_float, children: H(e.ts_float) }),
        " · ",
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        e.user && /* @__PURE__ */ s(F, { children: [
          " · ",
          e.user
        ] }),
        e.reply_count > 0 && /* @__PURE__ */ s(F, { children: [
          " · ",
          e.reply_count,
          " replies"
        ] }),
        " · ",
        /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "open in Slack" }),
        e.links.length > 0 && /* @__PURE__ */ s(F, { children: [
          " · linked ",
          e.links.map((c) => /* @__PURE__ */ t("a", { className: "underline mr-2", href: c, target: "_blank", rel: "noreferrer noopener", children: c.replace("https://github.com/", "") }, c))
        ] })
      ] }),
      e.note && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: e.note })
    ] })
  ] }) });
}
function ot(e) {
  var n, a;
  return !!((n = e.reply_draft) != null && n.text || (a = e.fix_handoff) != null && a.prompt || e.possibly_resolved);
}
const dt = ["", "p0", "p1", "p2", "p3", "none"];
function ct(e) {
  const { state: n, items: a, selected: r, setSelected: o } = e, [d, c] = m(""), [g, x] = m(""), [y, h] = m(""), [v, b] = m(!1), T = n.counts.open_by_priority, R = de(() => [...new Set(a.map((l) => l.category).filter(Boolean))].sort(), [a]), W = de(
    () => a.filter((l) => !g || (g === "none" ? !l.priority : l.priority === g)).filter((l) => !y || l.category === y).filter((l) => !v || ot(l)).sort((l, p) => (p.ts_float || 0) - (l.ts_float || 0)),
    [a, g, y, v]
  ), D = (l) => {
    const p = new Set(r);
    p.has(l) ? p.delete(l) : p.add(l), o(p);
  }, L = de(
    () => n.settings.channels.map((l) => ({ cid: l, ...n.channels[l] || {} })),
    [n]
  ), k = "text-sm bg-transparent border rounded px-2 py-1";
  return /* @__PURE__ */ s("div", { style: { minWidth: 0 }, children: [
    /* @__PURE__ */ s("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4", children: [
      /* @__PURE__ */ t(oe, { label: "Awaiting triage", value: n.counts.needs_triage, accent: !0 }),
      /* @__PURE__ */ t(oe, { label: "Possibly resolved", value: n.counts.possibly_resolved }),
      /* @__PURE__ */ t(oe, { label: "Open p0 / p1", value: `${T.p0 || 0} / ${T.p1 || 0}` }),
      /* @__PURE__ */ t(oe, { label: "Tracked items", value: n.counts.total })
    ] }),
    /* @__PURE__ */ s(M, { className: "mb-4", children: [
      /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-2 mb-3", children: [
        /* @__PURE__ */ t(Y, { children: "Ledger" }),
        /* @__PURE__ */ s("span", { className: "text-xs text-muted", "data-testid": "ledger-count", children: [
          W.length,
          " of ",
          a.length,
          " · newest first"
        ] }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-filter", children: "Status" }),
        /* @__PURE__ */ s("select", { id: "sr-filter", className: k, value: e.filter, onChange: (l) => e.setFilter(l.target.value), children: [
          /* @__PURE__ */ t("option", { value: "open", children: "open" }),
          /* @__PURE__ */ t("option", { value: "new", children: "new" }),
          /* @__PURE__ */ t("option", { value: "triaged", children: "triaged" }),
          /* @__PURE__ */ t("option", { value: "investigating", children: "investigating" }),
          /* @__PURE__ */ t("option", { value: "resolved", children: "resolved" }),
          /* @__PURE__ */ t("option", { value: "noise", children: "noise" }),
          /* @__PURE__ */ t("option", { value: "", children: "all" })
        ] }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-priority", children: "Priority" }),
        /* @__PURE__ */ t("select", { id: "sr-priority", className: k, value: g, onChange: (l) => x(l.target.value), children: dt.map((l) => /* @__PURE__ */ t("option", { value: l, children: l || "all" }, l)) }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-category", children: "Category" }),
        /* @__PURE__ */ s("select", { id: "sr-category", className: k, value: y, onChange: (l) => h(l.target.value), children: [
          /* @__PURE__ */ t("option", { value: "", children: "all" }),
          R.map((l) => /* @__PURE__ */ t("option", { value: l, children: l }, l))
        ] }),
        /* @__PURE__ */ s("label", { className: "text-sm flex items-center gap-1", style: { cursor: "pointer" }, children: [
          /* @__PURE__ */ t("input", { type: "checkbox", checked: v, onChange: (l) => b(l.target.checked) }),
          "Needs me"
        ] }),
        /* @__PURE__ */ t("div", { className: "flex-1" }),
        /* @__PURE__ */ t(
          K,
          {
            "aria-label": "GitHub repository to search (owner/name, optional)",
            placeholder: "owner/repo (optional)",
            value: d,
            onChange: (l) => c(l.target.value),
            className: "w-48"
          }
        ),
        /* @__PURE__ */ s(S, { onClick: () => e.onInvestigate(d), disabled: r.size === 0 || !!e.busy, children: [
          "Investigate ",
          r.size || ""
        ] })
      ] }),
      W.length === 0 ? /* @__PURE__ */ t(
        Pe,
        {
          icon: /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "📡" }),
          title: a.length ? "Nothing matches these filters" : "Nothing here yet",
          subtitle: a.length ? "Change a filter to see more." : "New messages appear after the next poll."
        }
      ) : /* @__PURE__ */ t("ul", { className: "flex flex-col", "data-testid": "ledger-list", children: W.map((l, p) => /* @__PURE__ */ t(lt, { it: l, first: p === 0, checked: r.has(l.key), onToggle: () => D(l.key) }, l.key)) })
    ] }),
    /* @__PURE__ */ s(M, { children: [
      /* @__PURE__ */ t(Y, { children: "Channels" }),
      L.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No channels configured." }) : /* @__PURE__ */ s("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ t("thead", { children: /* @__PURE__ */ s("tr", { className: "text-left text-muted", children: [
          /* @__PURE__ */ t("th", { scope: "col", children: "Channel" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Last polled" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Status" })
        ] }) }),
        /* @__PURE__ */ t("tbody", { children: L.map((l) => /* @__PURE__ */ s("tr", { children: [
          /* @__PURE__ */ t("td", { className: "font-mono", children: l.cid }),
          /* @__PURE__ */ t("td", { children: ge(l.last_polled_at) }),
          /* @__PURE__ */ t("td", { children: l.last_error ? /* @__PURE__ */ t(G, { variant: "err", title: l.last_error, children: "error" }) : /* @__PURE__ */ t(G, { variant: "ok", children: "ok" }) })
        ] }, l.cid)) })
      ] })
    ] })
  ] });
}
function ht({ state: e, busy: n, onDigest: a }) {
  const r = e.digest, o = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), d = r.last_posted_date === o;
  return /* @__PURE__ */ s(M, { className: "mb-4", children: [
    /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ t(Y, { children: d ? "Today's digest" : "Latest digest" }),
      r.pending ? /* @__PURE__ */ t(G, { variant: "aim", children: "being delivered" }) : null,
      /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: r.last_posted_date ? `${r.last_posted_date} · ${e.settings.digest_destination === "self_dm" ? "DMed to you" : "dashboard notification"}` : "none yet" }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      /* @__PURE__ */ t(S, { onClick: a, disabled: !!n || !e.crew.live, children: "Request digest" })
    ] }),
    r.last_text ? /* @__PURE__ */ t("pre", { className: "whitespace-pre-wrap text-sm mt-2", style: { fontFamily: "inherit", margin: "8px 0 0" }, children: r.last_text }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted mt-2", children: "The Radar Lead writes one after the daily cron or when you press Request digest." }),
    r.last_error && /* @__PURE__ */ t("p", { className: "text-xs mt-1", style: { color: "var(--danger)" }, children: r.last_error })
  ] });
}
function mt({ state: e }) {
  return /* @__PURE__ */ t("div", { className: "flex items-center gap-2", style: { marginTop: 10 }, children: se.map((n) => /* @__PURE__ */ s("span", { title: `${n.title} · ${V(n, e).label}`, children: [
    /* @__PURE__ */ t(fe, { m: n, s: e, selected: n.id === "lead", size: 30 }),
    /* @__PURE__ */ t("span", { className: "sr-only", children: `${n.title}: ${V(n, e).label}` })
  ] }, n.id)) });
}
function pt(e) {
  const n = `slack-radar:chat-open:${e}`, a = () => {
    try {
      return window.localStorage.getItem(n) === "1";
    } catch {
      return !1;
    }
  }, [r, o] = m(a);
  J(() => o(a()), [n]);
  const d = me(
    (c) => {
      o(c);
      try {
        c ? window.localStorage.setItem(n, "1") : window.localStorage.removeItem(n);
      } catch {
      }
    },
    [n]
  );
  return [r, d];
}
function Ne({ q: e, onClick: n, disabled: a }) {
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
function ut(e) {
  const n = ae(), { state: a, expanded: r, pending: o } = e, d = se[0], c = a.crew.slot_key, g = a.crew.live && a.crew.session_open && a.crew.session_agent === a.crew.agent, [x, y] = m(""), [h, v] = m(!1), [b, T] = m(""), [R, W] = m(!1), D = V(d, a), L = async (f) => {
    await n.post(`${C}/crew/message`, { message: f }), e.onChanged();
  }, k = async (f) => {
    const B = f.trim();
    if (B) {
      v(!0), T("");
      try {
        await n.post(`${C}/crew/message`, { message: B }), y(""), B === o && e.setPending(""), e.setExpanded(!0), e.onChanged();
      } catch {
        T(B);
      } finally {
        v(!1);
      }
    }
  }, l = async () => {
    try {
      await navigator.clipboard.writeText(o), W(!0), window.setTimeout(() => W(!1), 1500);
    } catch {
      W(!1);
    }
  }, p = b && /* @__PURE__ */ t(ee, { message: "The Radar Lead did not get that message.", onRetry: () => k(b) }), w = /* @__PURE__ */ t("div", { className: "text-sm", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }, children: a.crew.live ? /* @__PURE__ */ s(F, { children: [
    /* @__PURE__ */ t("span", { children: "The Radar Lead session opens on its next turn. Open it now to talk here." }),
    /* @__PURE__ */ t(S, { primary: !0, onClick: e.onStart, disabled: !!e.busy || !e.configured, children: "Open the session" })
  ] }) : /* @__PURE__ */ s("span", { children: [
    "The Radar Lead is paused. Turn on ",
    /* @__PURE__ */ t("b", { children: "Crew" }),
    " at the top of the page to triage your channels and talk to it here."
  ] }) });
  if (!r)
    return /* @__PURE__ */ s(M, { className: "mb-4", style: { padding: "10px 14px" }, children: [
      /* @__PURE__ */ s(
        "form",
        {
          className: "flex flex-wrap items-center gap-2",
          onSubmit: (f) => {
            f.preventDefault(), k(x);
          },
          children: [
            /* @__PURE__ */ t(fe, { m: d, s: a, size: 26 }),
            /* @__PURE__ */ t(
              K,
              {
                "aria-label": "Ask the lead",
                placeholder: "Ask the lead…",
                value: x,
                onChange: (f) => y(f.target.value),
                disabled: !g || h,
                style: { flex: 1, minWidth: 200 }
              }
            ),
            /* @__PURE__ */ t(S, { primary: !0, type: "submit", disabled: !g || h || !x.trim(), children: "Send" }),
            ye.map((f) => /* @__PURE__ */ t(Ne, { q: f, onClick: () => k(f), disabled: !g || h }, f))
          ]
        }
      ),
      !g && /* @__PURE__ */ t("div", { style: { marginTop: 8 }, children: w }),
      p
    ] });
  const $ = e.events.filter((f) => f.kind === "crew" || f.kind === "digest").slice(0, 5);
  return /* @__PURE__ */ s(
    M,
    {
      className: "mb-4",
      style: { padding: 0, display: "flex", flexDirection: "column", height: "min(620px, calc(100vh - 180px))", overflow: "hidden" },
      children: [
        /* @__PURE__ */ s("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border)" }, children: [
          /* @__PURE__ */ s("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: a.crew.name || d.title }),
            /* @__PURE__ */ t(G, { variant: D.tone === "muted" ? "muted" : D.tone === "aim" ? "aim" : "ok", children: D.label }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(S, { onClick: () => e.setExpanded(!1), "aria-expanded": !0, children: "Collapse" })
          ] }),
          /* @__PURE__ */ s("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
            "phase ",
            a.crew_memory.phase,
            " · next: ",
            a.crew_memory.next || "—"
          ] }),
          /* @__PURE__ */ t(mt, { state: a })
        ] }),
        /* @__PURE__ */ t(Ge, { state: a }),
        o && // ChatEmbed has no API to fill its composer, so the question waits here.
        /* @__PURE__ */ s(
          "div",
          {
            className: "text-sm flex flex-wrap items-center gap-2",
            style: { padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" },
            children: [
              /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200, userSelect: "all" }, children: o }),
              /* @__PURE__ */ t(S, { primary: !0, style: E, onClick: () => k(o), disabled: !g || h, children: "Send" }),
              /* @__PURE__ */ t(S, { style: E, onClick: l, children: R ? "Copied" : "Copy" })
            ]
          }
        ),
        p && /* @__PURE__ */ t("div", { style: { padding: "0 16px" }, children: p }),
        /* @__PURE__ */ t("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: g ? /* @__PURE__ */ t(
          Ie,
          {
            slotKey: c,
            agent: a.crew.agent,
            frameless: !0,
            startAtBottom: !0,
            placeholder: "Ask the Radar Lead…",
            onSend: L
          },
          c
        ) : /* @__PURE__ */ s("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 10 }, children: [
          w,
          !e.configured && /* @__PURE__ */ t("p", { className: "text-xs text-muted", children: "Add a channel in Settings first." }),
          $.length > 0 && /* @__PURE__ */ t("ul", { className: "text-xs text-muted flex flex-col gap-1", style: { marginTop: 6 }, children: $.map((f, B) => /* @__PURE__ */ s("li", { children: [
            H(f.at),
            " · ",
            f.text
          ] }, `${f.at}-${B}`)) })
        ] }) }),
        /* @__PURE__ */ t("div", { className: "flex flex-wrap gap-2", style: { padding: "10px 16px 12px", borderTop: "1px solid var(--border)" }, children: ye.map((f) => /* @__PURE__ */ t(Ne, { q: f, onClick: () => k(f), disabled: !g || h }, f)) })
      ]
    }
  );
}
function gt({ state: e }) {
  return /* @__PURE__ */ s(M, { children: [
    /* @__PURE__ */ t(Y, { children: "Team" }),
    /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { marginBottom: 8 }, children: "Who works on your channels. Only the Radar Lead has a session; the others run when needed." }),
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: se.map((n) => {
      var r, o;
      const a = n.id === "lead" ? e.crew.agent : n.agent;
      return /* @__PURE__ */ s(
        "li",
        {
          className: "flex items-start gap-3",
          style: { padding: "12px 4px", borderTop: "1px solid var(--border)", opacity: n.planned ? 0.7 : 1 },
          children: [
            /* @__PURE__ */ t(fe, { m: n, s: e, size: 36 }),
            /* @__PURE__ */ s("div", { style: { minWidth: 0, flex: 1 }, children: [
              /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-2", children: [
                /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: n.id === "lead" && e.crew.name || n.title }),
                /* @__PURE__ */ t(G, { variant: "muted", children: n.layer }),
                /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: n.kind })
              ] }),
              /* @__PURE__ */ t("p", { className: "text-sm", style: { margin: "4px 0 0" }, children: n.duty }),
              n.id === "investigator" && (((r = e.investigations) == null ? void 0 : r.items) || 0) > 0 && /* @__PURE__ */ s("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: [
                (o = e.investigations) == null ? void 0 : o.items,
                " item(s) under investigation"
              ] }),
              a && /* @__PURE__ */ t($e, { children: /* @__PURE__ */ s("span", { className: "font-mono", children: [
                "agent: ",
                a,
                n.id === "lead" && e.crew.slot_key ? ` · session: ${e.crew.slot_key}` : ""
              ] }) })
            ] }),
            /* @__PURE__ */ t("div", { "data-testid": `team-status-${n.id}`, style: { maxWidth: 360, minWidth: 0, display: "flex" }, children: /* @__PURE__ */ t(Re, { m: n, state: e, withName: !1, withResting: !0 }) })
          ]
        },
        n.id
      );
    }) })
  ] });
}
function ft({ events: e, kinds: n, onShowAll: a }) {
  const r = n ? e.filter((o) => n.includes(o.kind)) : e;
  return /* @__PURE__ */ s(M, { children: [
    /* @__PURE__ */ t(Y, { children: "Activity" }),
    n && /* @__PURE__ */ s("p", { className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { marginBottom: 8 }, children: [
      /* @__PURE__ */ t("span", { children: "Showing the crew and its members only." }),
      /* @__PURE__ */ t(S, { style: E, onClick: a, children: "Show all" })
    ] }),
    r.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No activity yet." }) : /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", children: r.map((o, d) => /* @__PURE__ */ s("li", { children: [
      /* @__PURE__ */ t("span", { className: "text-muted", children: ge(o.at) }),
      " ",
      /* @__PURE__ */ t(G, { variant: "muted", children: o.kind }),
      " ",
      o.text
    ] }, `${o.at}-${d}`)) })
  ] });
}
function xt({
  state: e,
  busy: n,
  act: a,
  mcp: r,
  onProbe: o
}) {
  const d = ae(), [c, g] = m(e.settings.channels.join(`
`)), [x, y] = m(e.settings.digest_destination), [h, v] = m(e.settings.slack_login), [b, T] = m(e.settings.slack_mcp_command), [R, W] = m(e.settings.workspace_url), [D, L] = m(String(e.settings.poll_interval_secs)), [k, l] = m(String(e.settings.backfill_hours)), [p, w] = m(e.crew.unattended), [$, f] = m(e.crew.agent), [B, O] = m(e.crew.model), j = () => a(
    "Save settings",
    () => d.put(`${C}/settings`, {
      channels: c.split(/[\s,]+/).map((N) => N.trim()).filter(Boolean),
      digest_destination: x,
      slack_login: h.trim(),
      slack_mcp_command: b.trim(),
      workspace_url: R.trim(),
      poll_interval_secs: Number(D),
      backfill_hours: Number(k)
    })
  );
  return /* @__PURE__ */ s(F, { children: [
    !e.vault_available && /* @__PURE__ */ t(M, { className: "mb-4", children: /* @__PURE__ */ t("p", { className: "text-sm", children: "The gateway secret vault is unavailable, so settings cannot be saved." }) }),
    /* @__PURE__ */ s(M, { className: "mb-4", children: [
      /* @__PURE__ */ t(Y, { children: "Basics" }),
      /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(Le, { mcp: r, state: e }) }),
        /* @__PURE__ */ t(S, { disabled: !!n, onClick: o, children: "Check connection" })
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
          onChange: (N) => g(N.target.value)
        }
      ),
      /* @__PURE__ */ s("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "Digest destination",
          /* @__PURE__ */ s(
            "select",
            {
              className: "block w-full text-sm bg-transparent border rounded px-2 py-1",
              value: x,
              onChange: (N) => y(N.target.value),
              children: [
                /* @__PURE__ */ t("option", { value: "dashboard", children: "Dashboard notification only" }),
                /* @__PURE__ */ t("option", { value: "self_dm", children: "DM to myself in Slack" })
              ]
            }
          )
        ] }),
        x === "self_dm" && /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "Your Slack login (for the DM)",
          /* @__PURE__ */ t(K, { value: h, onChange: (N) => v(N.target.value), placeholder: "jdoe" })
        ] }),
        /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "Poll interval (seconds, 60–3600)",
          /* @__PURE__ */ t(K, { type: "number", min: 60, max: 3600, value: D, onChange: (N) => L(N.target.value) }),
          /* @__PURE__ */ s("span", { "data-testid": "poll-cadence", className: "block text-xs text-muted", style: { marginTop: 2 }, children: [
            "Runs by itself every ",
            e.settings.poll_interval_secs,
            " s; a manual Poll just runs one cycle now."
          ] })
        ] })
      ] }),
      /* @__PURE__ */ t(S, { primary: !0, className: "mt-3", disabled: !!n, onClick: j, children: "Save settings" })
    ] }),
    /* @__PURE__ */ t(M, { children: /* @__PURE__ */ s("details", { children: [
      /* @__PURE__ */ t("summary", { style: { cursor: "pointer", fontWeight: 600, color: "var(--text-strong)" }, children: "Advanced" }),
      /* @__PURE__ */ s("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "MCP server command (a single executable on PATH)",
          /* @__PURE__ */ t(K, { value: b, onChange: (N) => T(N.target.value), placeholder: "ai-community-slack-mcp" })
        ] }),
        /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "Workspace URL (for permalinks, optional)",
          /* @__PURE__ */ t(K, { value: R, onChange: (N) => W(N.target.value), placeholder: "https://yourteam.slack.com" })
        ] }),
        /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "First-poll backfill (hours, 0–168)",
          /* @__PURE__ */ t(K, { type: "number", min: 0, max: 168, value: k, onChange: (N) => l(N.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(S, { className: "mt-3", disabled: !!n, onClick: j, children: "Save settings" }),
      /* @__PURE__ */ s("div", { style: { borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }, children: [
        /* @__PURE__ */ t("div", { className: "text-sm", style: { fontWeight: 600, marginBottom: 8 }, children: "Crew" }),
        /* @__PURE__ */ s("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
          /* @__PURE__ */ s("label", { className: "text-sm", children: [
            "Agent",
            /* @__PURE__ */ t(K, { value: $, onChange: (N) => f(N.target.value), placeholder: "slack-radar-crew" }),
            /* @__PURE__ */ t("span", { className: "block text-xs text-muted mt-1", children: "Default: the shipped slack-radar-crew agent. Your own agents are never modified." })
          ] }),
          /* @__PURE__ */ s("label", { className: "text-sm", children: [
            "Model (empty = agent default)",
            /* @__PURE__ */ t(K, { value: B, onChange: (N) => O(N.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ s("div", { className: "mt-3 flex items-center gap-2", children: [
          /* @__PURE__ */ t(
            _e,
            {
              checked: p,
              onChange: w,
              label: "Unattended mode (auto-approve investigator commands)",
              describedBy: "sr-unattended-risk"
            }
          ),
          /* @__PURE__ */ t("span", { className: "text-sm", children: "Unattended mode (auto-approve investigator commands)" })
        ] }),
        /* @__PURE__ */ t("p", { id: "sr-unattended-risk", className: "text-xs text-muted mt-1", children: "Risk: anyone in a watched channel can write text the crew reads, so a crafted message could steer a command nobody reviews." }),
        /* @__PURE__ */ t(
          S,
          {
            primary: !0,
            className: "mt-3",
            disabled: !!n,
            onClick: () => a("Save crew", () => d.put(`${C}/crew`, { agent: $, model: B, unattended: p })),
            children: "Save crew"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  kt as default
};
