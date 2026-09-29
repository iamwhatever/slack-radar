import { jsxs as r, Fragment as L, jsx as t } from "react/jsx-runtime";
import * as ve from "@kirocrew/app-sdk";
import { useAppApi as le, ChatEmbed as He } from "@kirocrew/app-sdk";
import { PageHeader as Ue, Toggle as Re, Btn as C, Card as H, CardTitle as X, StatCard as ce, Input as J, EmptyState as Ke, Badge as Q } from "@kirocrew/app-sdk/ui";
import { useState as p, useCallback as me, useEffect as ae, useRef as se, useMemo as he } from "react";
const A = "/api/apps/slack-radar", Ye = {
  checking: "checking…",
  connected: "connected",
  needs_login: "sign in again",
  binary_not_found: "not installed",
  incompatible: "missing read access",
  error: "not working"
}, we = ["What needs me today?", "Draft today's digest", "Which threads look resolved?"], Ge = [
  { id: "board", label: "Board" },
  { id: "ledger", label: "Ledger" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" }
], ie = (e) => e ? new Date(e * 1e3).toLocaleString() : "never";
function G(e) {
  if (!e) return "never";
  const n = Math.max(0, Date.now() / 1e3 - e);
  return n < 90 ? "just now" : n < 3600 ? `${Math.round(n / 60)} min ago` : n < 86400 ? `${Math.round(n / 3600)} h ago` : ie(e);
}
function We(e, n) {
  return n === "needs_login" ? "needs_login" : (e == null ? void 0 : e.status) || "checking";
}
function ye({ children: e, summary: n = "Details" }) {
  return /* @__PURE__ */ r("details", { className: "text-xs text-muted", style: { marginTop: 6 }, children: [
    /* @__PURE__ */ t("summary", { style: { cursor: "pointer" }, children: n }),
    /* @__PURE__ */ t("div", { style: { marginTop: 4 }, children: e })
  ] });
}
const oe = [
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
  return (a = e.now) == null ? void 0 : a.members.find((i) => i.id === n);
};
function ee(e, n) {
  var l;
  const a = pe(n, e.id);
  if (e.id === "lead")
    return (a == null ? void 0 : a.state) === "paused" || !n.crew.live ? { label: "paused", tone: "muted" } : (a ? a.state === "working" : n.crew.running) ? { label: "working", tone: "aim" } : { label: "live", tone: "ok" };
  if (e.id === "poller")
    return n.source_state === "needs_login" ? { label: "sign in again", tone: "warn" } : (a == null ? void 0 : a.state) === "paused" ? { label: "paused", tone: "warn" } : { label: `polled ${G(n.last_poll_at)}`, tone: "muted" };
  const i = a ? a.count : e.id === "investigator" && ((l = n.investigations) == null ? void 0 : l.running) || 0;
  return i ? { label: `${i} running`, tone: "aim" } : (a == null ? void 0 : a.state) === "planned" ? { label: "not started yet", tone: "muted" } : { label: "idle", tone: "muted" };
}
function ne(e) {
  if (!e) return "--";
  const n = new Date(e * 1e3), a = n.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: !1 });
  return n.toDateString() === (/* @__PURE__ */ new Date()).toDateString() ? a : `${n.toLocaleDateString([], { month: "short", day: "numeric" })} ${a}`;
}
function Qe(e) {
  if (!e) return "";
  const n = Math.round(e - Date.now() / 1e3);
  return n <= 0 ? "now" : De(Date.now() / 1e3 - n);
}
function Je(e, n) {
  if (!(n != null && n.last)) return "";
  const { started_at: a, finished_at: i } = n.last;
  if (e.id === "poller") {
    if (!a) return "has not polled yet";
    const l = Qe(n.next_at);
    return `last ${ne(a)}${l ? ` · next ${l === "now" ? "due now" : `in ${l}`}` : ""}`;
  }
  return e.id === "lead" ? a ? `last wake ${ne(a)}` : "not woken yet" : a ? i ? `last run ${ne(a)}–${ne(i)}` : `last run ${ne(a)}` : "last run --";
}
function Ve(e) {
  var n, a;
  return !(e != null && e.ran) || e.ran === "running" ? "" : e.ran === "never" ? "never ran" : `idle since ${ne(((n = e.last) == null ? void 0 : n.finished_at) || ((a = e.last) == null ? void 0 : a.started_at))}`;
}
function De(e) {
  if (!e) return "";
  const n = Math.max(0, Math.round(Date.now() / 1e3 - e));
  return n < 90 ? `${n}s` : n < 90 * 60 ? `${Math.round(n / 60)}m` : `${Math.round(n / 3600)}h`;
}
const Le = (e, n = 60) => e.length > n ? `${e.slice(0, n - 1).trimEnd()}…` : e;
function ke(e, n) {
  const a = pe(n, e.id);
  if (!a) return ee(e, n).label;
  const i = Je(e, a);
  return e.id === "poller" ? i && a.state === "paused" ? `${a.doing.split(" · ")[0]} · ${i}` : i || a.doing : a.state !== "working" ? a.state === "paused" ? `paused: ${a.doing}` : i || ee(e, n).label : e.id === "lead" ? `working: ${a.doing}` : `${a.count} running: ${a.doing}`;
}
const Xe = `@keyframes slack-radar-pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.7) } }
.sr-pulse { animation: slack-radar-pulse 1.4s ease-in-out infinite }
@keyframes slack-radar-spin { to { transform: rotate(360deg) } }
.sr-spin { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: slack-radar-spin .8s linear infinite; vertical-align: -1px; margin-right: 6px }
@media (prefers-reduced-motion: reduce) { .sr-pulse, .sr-spin { animation: none } }`;
function Ie({ tone: e, pulse: n }) {
  return /* @__PURE__ */ t(
    "i",
    {
      "aria-hidden": !0,
      className: n ? "sr-pulse" : void 0,
      style: { width: 8, height: 8, borderRadius: "50%", flex: "none", display: "inline-block", background: Oe[e] }
    }
  );
}
function Ae({ m: e, state: n, withName: a = !0, withResting: i = !1, onOpen: l }) {
  const o = ee(e, n), m = pe(n, e.id), g = m ? m.state === "working" : o.tone === "aim", $ = i && (e.id === "investigator" || e.id === "watcher") ? Ve(m) : "", v = $ ? `${$} · ${ke(e, n)}` : ke(e, n), T = e.id === "lead" && n.crew.name || e.title, w = /* @__PURE__ */ r(L, { children: [
    /* @__PURE__ */ t(Ie, { tone: o.tone, pulse: g }),
    a && /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: T }),
    /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: Le(v) })
  ] }), x = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    fontSize: 13,
    opacity: g || o.tone === "warn" ? 1 : 0.6,
    color: "var(--text)"
  }, R = { title: `${T} · ${v}`, "data-member": e.id, "data-state": (m == null ? void 0 : m.state) || (g ? "working" : "idle") };
  return l ? /* @__PURE__ */ t(
    "button",
    {
      type: "button",
      onClick: l,
      ...R,
      "aria-label": `${T}: ${v}. Show activity`,
      style: { ...x, background: "transparent", border: 0, padding: 0, cursor: "pointer" },
      children: w
    }
  ) : /* @__PURE__ */ t("span", { ...R, style: x, children: w });
}
function Ze({ state: e, onOpenActivity: n }) {
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
        oe.map((a) => /* @__PURE__ */ t(
          Ae,
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
function qe({ state: e }) {
  const n = oe.filter((a) => a.id === "investigator" || a.id === "watcher").map((a) => ({ m: a, row: pe(e, a.id) })).filter(({ row: a }) => (a == null ? void 0 : a.state) === "working");
  return n.length ? /* @__PURE__ */ t("div", { "data-testid": "chat-running", style: { padding: "6px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" }, children: n.map(({ m: a, row: i }) => {
    const l = De(i.since), o = `${a.title} running${i.count > 1 ? ` (${i.count})` : ""} · ${i.doing}${l ? ` · ${l}` : ""}`;
    return /* @__PURE__ */ r("div", { className: "text-xs flex items-center gap-2", title: o, style: { minWidth: 0 }, children: [
      /* @__PURE__ */ t(Ie, { tone: "aim", pulse: !0 }),
      /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: o })
    ] }, a.id);
  }) }) : null;
}
const Oe = {
  ok: "var(--ok)",
  aim: "var(--aim)",
  warn: "var(--warn)",
  muted: "var(--muted-strong)"
};
function xe({ m: e, s: n, selected: a, size: i = 32 }) {
  const l = ee(e, n), o = e.planned || e.id === "poller", m = {
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
    border: `2px ${o ? "dashed" : "solid"} ${a ? "var(--accent)" : o ? "var(--border-strong)" : "transparent"}`,
    opacity: e.planned ? 0.6 : 1
  };
  return /* @__PURE__ */ r("span", { style: m, "aria-hidden": !0, children: [
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
          background: Oe[l.tone]
        }
      }
    )
  ] });
}
function et(e) {
  return e === "new" ? "warn" : e === "investigating" ? "aim" : e === "resolved" ? "ok" : "muted";
}
function tt({ tab: e, setTab: n }) {
  return /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Slack Radar sections", style: { display: "flex", gap: 4 }, children: Ge.map((a) => {
    const i = e === a.id;
    return /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": i,
        onClick: () => n(a.id),
        style: {
          padding: "6px 12px",
          borderRadius: 8,
          border: 0,
          cursor: "pointer",
          fontSize: 14,
          background: i ? "var(--bg-hover)" : "transparent",
          color: i ? "var(--text-strong)" : "var(--muted)"
        },
        children: a.label
      },
      a.id
    );
  }) });
}
function nt({
  state: e,
  configured: n,
  busy: a,
  onStart: i,
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
        onChange: (g) => g ? i() : l(),
        label: o ? "Pause the crew" : "Start the crew"
      }
    ),
    /* @__PURE__ */ r("span", { className: "text-xs text-muted", title: "Whether the crew's commands run without asking you", children: [
      "Unattended: ",
      e.crew.trusted ? "on" : "off"
    ] })
  ] });
}
function Dt() {
  const e = le(), [n, a] = p("board"), [i, l] = p(null), [o, m] = p([]), [g, $] = p(null), [v, T] = p([]), [w, x] = p([]), [R, D] = p("open"), [_, O] = p(/* @__PURE__ */ new Set()), [f, W] = p(""), [d, N] = p(""), [B, E] = p(null), [y, h] = p(null), [k, u] = p(null), b = me(async () => {
    try {
      E(await e.get(`${A}/mcp/status`));
    } catch (I) {
      E({ status: "error", command: "", detail: I.message });
    }
  }, [e]);
  ae(() => {
    b();
  }, [b]);
  const P = me(async () => {
    var I;
    try {
      const [Y, te, de, q, je] = await Promise.all([
        e.get(`${A}/state`),
        e.get(`${A}/items?status=${encodeURIComponent(R)}&limit=300`),
        e.get(`${A}/events?limit=150`),
        e.get(`${A}/needs`),
        e.get(`${A}/items?handled=1&limit=100`)
      ]);
      l(Y), h(((I = Y.now) == null ? void 0 : I.members) || null), m(te.items), $(q), T(je.items), x(de.events.slice().reverse());
    } catch (Y) {
      N(`Could not load: ${Y.message}`);
    }
  }, [e, R]);
  ae(() => {
    P();
    const I = window.setInterval(P, 3e4);
    return () => window.clearInterval(I);
  }, [P]);
  const Z = !!(y != null && y.some((I) => I.state === "working")), U = se("");
  ae(() => {
    if (!Z) return;
    const I = async () => {
      try {
        const te = await e.get(`${A}/now`);
        h(te.members);
        const de = te.members.map((q) => `${q.id}:${q.state}:${q.count}`).join(",");
        if (U.current && de !== U.current) {
          const q = await e.get(`${A}/events?limit=150`);
          x(q.events.slice().reverse());
        }
        U.current = de;
      } catch {
      }
    }, Y = window.setInterval(I, 5e3);
    return () => window.clearInterval(Y);
  }, [Z, e]);
  const M = he(() => i && y ? { ...i, now: { members: y } } : i, [i, y]), V = () => {
    u(["member", "crew", "investigate"]), a("activity");
  }, s = async (I, Y) => {
    W(I), N("");
    try {
      await Y(), N(`${I}: done`), await P();
    } catch (te) {
      N(`${I} failed: ${te.message}`);
    } finally {
      W("");
    }
  }, c = !!i && i.settings.channels.length > 0, S = (i == null ? void 0 : i.settings.channels.length) || 0, F = i ? `${S ? `Watching ${S} channel${S === 1 ? "" : "s"}` : "No channels yet"} · ${i.crew.live ? "running" : "paused"}` : "A small crew triaging your Slack channels", j = i ? We(B, i.source_state) : "checking", K = () => {
    b(), P();
  };
  return /* @__PURE__ */ r(L, { children: [
    /* @__PURE__ */ t(
      Ue,
      {
        title: "Slack Radar",
        subtitle: F,
        actions: /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-4", children: [
          /* @__PURE__ */ t(
            tt,
            {
              tab: n,
              setTab: (I) => {
                u(null), a(I);
              }
            }
          ),
          i && /* @__PURE__ */ t(
            nt,
            {
              state: i,
              configured: c,
              busy: f,
              onStart: () => s("Start crew", () => e.post(`${A}/crew/start`, {})),
              onPause: () => s("Pause crew", () => e.post(`${A}/crew/pause`, {}))
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ t("style", { children: Xe }),
    /* @__PURE__ */ r("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      M && n === "board" && /* @__PURE__ */ t(Ze, { state: M, onOpenActivity: V }),
      i && j === "needs_login" && /* @__PURE__ */ t(at, { mcp: B, sourceError: i.source_error, busy: f, onCheck: K }),
      d && /* @__PURE__ */ t("p", { role: "status", className: "text-sm text-muted mb-3", children: d }),
      M ? n === "board" ? /* @__PURE__ */ t(
        rt,
        {
          state: M,
          needs: g,
          handled: v,
          configured: c,
          mcp: B,
          busy: f,
          onPoll: () => s("Poll", () => e.post(`${A}/poll`, {})),
          onStart: () => s("Start crew", () => e.post(`${A}/crew/start`, {})),
          onDigest: () => s("Digest now", () => e.post(`${A}/digest/request`, {})),
          events: w,
          onChanged: P
        }
      ) : n === "ledger" ? /* @__PURE__ */ t(
        yt,
        {
          state: M,
          items: o,
          filter: R,
          setFilter: D,
          selected: _,
          setSelected: O,
          busy: f,
          onInvestigate: (I) => s("Investigate", async () => {
            await e.post(`${A}/investigate`, { keys: [..._], repo: I }), O(/* @__PURE__ */ new Set());
          })
        }
      ) : n === "team" ? /* @__PURE__ */ t(_t, { state: M }) : n === "activity" ? /* @__PURE__ */ t(St, { events: w, kinds: k, onShowAll: () => u(null) }) : /* @__PURE__ */ t($t, { state: M, busy: f, act: s, mcp: B, onProbe: b }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" })
    ] })
  ] });
}
function Fe({ mcp: e, sourceError: n }) {
  var i;
  const a = [
    (e == null ? void 0 : e.status) && `status: ${e.status}`,
    (e == null ? void 0 : e.command) && `command: ${e.command}`,
    n && `error: ${n}`,
    (e == null ? void 0 : e.detail) && e.detail !== n && `detail: ${e.detail}`,
    ((i = e == null ? void 0 : e.missing_read_tools) == null ? void 0 : i.length) && `missing read tools: ${e.missing_read_tools.join(", ")}`
  ].filter(Boolean);
  return a.length ? /* @__PURE__ */ t(ye, { children: /* @__PURE__ */ t("pre", { className: "font-mono whitespace-pre-wrap", style: { margin: 0 }, children: a.join(`
`) }) }) : null;
}
function at({ mcp: e, sourceError: n, busy: a, onCheck: i }) {
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
          /* @__PURE__ */ t(C, { primary: !0, onClick: i, disabled: !!a, children: "I signed in, check again" })
        ] }),
        /* @__PURE__ */ t(Fe, { mcp: e, sourceError: n })
      ]
    }
  );
}
function Be({ mcp: e, state: n, withPoll: a, action: i }) {
  const l = We(e, n.source_state), o = l === "connected";
  return /* @__PURE__ */ r("div", { className: i ? "mb-3" : "mb-4", "data-testid": i ? "connection-line" : void 0, children: [
    /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ r("p", { role: "status", className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { margin: 0, flex: 1, minWidth: 0 }, children: [
        /* @__PURE__ */ t("span", { "aria-hidden": !0, style: { width: 8, height: 8, borderRadius: "50%", background: o ? "var(--ok)" : l === "checking" ? "var(--muted-strong)" : "var(--warn)", display: "inline-block" } }),
        /* @__PURE__ */ r("span", { children: [
          "Slack connection: ",
          /* @__PURE__ */ t("span", { style: { color: o ? "var(--text)" : "var(--warn)" }, children: Ye[l] || l })
        ] }),
        a && /* @__PURE__ */ r("span", { children: [
          "· last poll ",
          G(n.last_poll_at),
          n.settings.channels.length > 0 && /* @__PURE__ */ r(L, { children: [
            " · watching ",
            n.settings.channels.join(", ")
          ] })
        ] })
      ] }),
      i
    ] }),
    !o && l !== "needs_login" && /* @__PURE__ */ t(Fe, { mcp: e, sourceError: n.source_error })
  ] });
}
function rt(e) {
  const { state: n } = e, [a, i] = p(""), [l, o] = kt(n.crew.slot_key), m = se(null), g = ($) => {
    i(st($)), o(!0), window.requestAnimationFrame(() => {
      var v;
      return (v = m.current) == null ? void 0 : v.scrollIntoView({ block: "end", behavior: "smooth" });
    });
  };
  return /* @__PURE__ */ r("div", { "data-testid": "board", style: { minWidth: 0 }, children: [
    /* @__PURE__ */ t(
      Be,
      {
        mcp: e.mcp,
        state: n,
        withPoll: !0,
        action: /* @__PURE__ */ t(C, { style: z, onClick: e.onPoll, disabled: !!e.busy || !e.configured, children: "Poll now" })
      }
    ),
    !e.configured && /* @__PURE__ */ r(H, { className: "mb-4", children: [
      /* @__PURE__ */ t(X, { children: "Finish setup" }),
      /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite." })
    ] }),
    /* @__PURE__ */ t(vt, { state: n, busy: e.busy, onDigest: e.onDigest }),
    /* @__PURE__ */ t(mt, { needs: e.needs, handled: e.handled, onChanged: e.onChanged, onWhy: g }),
    /* @__PURE__ */ t(
      "div",
      {
        ref: m,
        "data-testid": "chat-bar",
        "data-expanded": l ? "true" : "false",
        style: { position: "sticky", bottom: 0, zIndex: 5, marginTop: 8, borderRadius: 12, boxShadow: "0 -6px 18px rgba(0,0,0,.18)" },
        children: /* @__PURE__ */ t(
          Nt,
          {
            state: n,
            events: e.events,
            configured: e.configured,
            busy: e.busy,
            expanded: l,
            setExpanded: o,
            pending: a,
            setPending: i,
            onStart: e.onStart,
            onChanged: e.onChanged
          }
        )
      }
    )
  ] });
}
const Ne = {
  decide: "Needs a decision",
  unanswered: "Questions nobody answered",
  clusters: "Reported more than once"
};
function _e(e) {
  return e < 1 ? `${Math.max(1, Math.round(e * 60))} min ago` : e < 48 ? `${Math.round(e)} h ago` : `${Math.floor(e / 24)} days ago`;
}
const Se = 5;
function st(e) {
  return `Why is "${e.summary.length > 80 ? `${e.summary.slice(0, 79)}…` : e.summary}" ${e.priority || "on my list"}?`;
}
function Ee(e) {
  return e ? /* @__PURE__ */ t(Q, { variant: e === "p0" || e === "p1" ? "err" : "muted", children: e }) : null;
}
function re({ message: e, onRetry: n }) {
  return /* @__PURE__ */ r(
    "div",
    {
      role: "alert",
      className: "text-sm flex flex-wrap items-center gap-2",
      style: { border: "1px solid var(--danger)", borderRadius: 8, padding: "8px 12px", margin: "8px 0" },
      children: [
        /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200 }, children: e }),
        /* @__PURE__ */ t(C, { onClick: n, children: "Try again" })
      ]
    }
  );
}
const z = { fontSize: 12, padding: "2px 10px" }, be = (e, n) => e === "decide" && !!n.reply_draft && !n.handoff_title;
function Pe(e, n, a = !1) {
  return e === "decide" && (n.dispatch || a) ? "Done" : e === "decide" && n.handoff_title ? "Dispatch fix" : be(e, n) ? "Open" : e === "decide" && n.reason.startsWith("Looks resolved") ? "Done" : e === "unanswered" && n.permalink ? "Reply" : "Decide";
}
function ue(e) {
  return e.replace(/<([@#!])([^>|]+)\|([^>]+)>/g, (n, a, i, l) => `${a === "#" ? "#" : "@"}${l}`).replace(/<([@#!])([^>|]+)>/g, (n, a, i) => `${a === "#" ? "#" : "@"}${i}`).replace(/<([^>|]+)\|([^>]+)>/g, "$2").replace(/<([^>]+)>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
const Me = (e, n = 90) => Le(ue(e).split(`
`).map((a) => a.trim()).find(Boolean) || "", n), it = (e) => new Date(e * 1e3).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), lt = 3600;
function ot(e, n) {
  var i;
  const a = e.dispatch;
  return a ? {
    session_key: a.session_key,
    title: a.title,
    batch: a.batch && ((i = a.batch_keys) == null ? void 0 : i.length) || 0,
    state: a.state,
    pr_url: a.pr_url,
    pr_number: a.pr_number
  } : n || null;
}
function dt({
  e,
  groupId: n,
  first: a,
  onOpen: i,
  onMark: l,
  onDispatch: o,
  busy: m,
  fix: g,
  sentHere: $,
  failed: v,
  excluded: T,
  onExclude: w
}) {
  const x = n === "decide" ? ot(e, $) : null, R = Pe(n, e, !!x), D = be(n, e), [_, O] = p(!1), f = `sr-fix-${e.key.replace(/[^A-Za-z0-9]/g, "-")}`, W = () => {
    R === "Dispatch fix" ? o == null || o() : R === "Done" ? l("done") : R === "Reply" && e.permalink ? window.open(e.permalink, "_blank", "noopener,noreferrer") : i();
  }, d = x && ge[x.state] || "";
  return /* @__PURE__ */ t(
    "li",
    {
      className: "text-sm",
      "data-testid": "need-row",
      "data-priority": e.priority || "",
      "data-age-hours": e.age_hours,
      style: { padding: "8px 0", borderTop: a ? 0 : "1px solid var(--border)" },
      children: /* @__PURE__ */ r("div", { className: "flex items-start gap-2", children: [
        /* @__PURE__ */ t("div", { style: { flex: "none", minWidth: 28 }, children: Ee(e.priority) }),
        /* @__PURE__ */ r("div", { style: { minWidth: 0, flex: 1 }, children: [
          /* @__PURE__ */ t(
            "button",
            {
              type: "button",
              "data-testid": "need-open",
              onClick: i,
              title: "Open the message and its thread",
              style: { border: 0, background: "transparent", padding: 0, margin: 0, textAlign: "left", cursor: "pointer", width: "100%", color: "inherit", font: "inherit" },
              children: D ? /* @__PURE__ */ r(L, { children: [
                /* @__PURE__ */ r("div", { style: { color: "var(--text-strong)" }, children: [
                  /* @__PURE__ */ t("span", { "data-testid": "reply-ready", children: /* @__PURE__ */ t(Q, { variant: "aim", children: "Reply ready" }) }),
                  " ",
                  /* @__PURE__ */ t("span", { "data-testid": "need-first-line", children: Me(e.text || e.summary) || "(no text)" })
                ] }),
                /* @__PURE__ */ r("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
                  e.user || "someone",
                  " · ",
                  /* @__PURE__ */ t("span", { "data-testid": "need-age", children: _e(e.age_hours) })
                ] })
              ] }) : /* @__PURE__ */ r(L, { children: [
                /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
                /* @__PURE__ */ r("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
                  e.reason,
                  " · ",
                  /* @__PURE__ */ t("span", { "data-testid": "need-age", children: _e(e.age_hours) })
                ] })
              ] })
            }
          ),
          x && /* @__PURE__ */ r("div", { className: "text-xs", role: "status", style: { marginTop: 2 }, "data-testid": "fix-dispatched", children: [
            /* @__PURE__ */ t("span", { style: { color: "var(--text-strong)" }, children: "Dispatched" }),
            " · ",
            x.launched ? "opened in a new conductor chat" : x.batch ? `batch of ${x.batch}` : x.title || "Fix session",
            d && /* @__PURE__ */ r(L, { children: [
              " · ",
              d
            ] }),
            x.session_key && /* @__PURE__ */ r(L, { children: [
              " · ",
              /* @__PURE__ */ t(fe, { d: x, label: "Open session" })
            ] }),
            x.pr_url && /* @__PURE__ */ r(L, { children: [
              " · ",
              /* @__PURE__ */ r("a", { className: "underline", href: x.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
                "PR #",
                x.pr_number
              ] })
            ] })
          ] }),
          v && !x && /* @__PURE__ */ t(re, { message: `Could not dispatch that fix: ${v}. Nothing was sent.`, onRetry: () => o == null ? void 0 : o() }),
          g && _ && /* @__PURE__ */ r(
            "div",
            {
              id: f,
              "data-testid": "fix-preview",
              className: "text-xs",
              style: { marginTop: 6, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6 },
              children: [
                /* @__PURE__ */ r("div", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: [
                  g.title,
                  " ",
                  g.repo && /* @__PURE__ */ t("span", { className: "text-muted font-mono", style: { fontWeight: 400 }, children: g.repo })
                ] }),
                /* @__PURE__ */ t(
                  "pre",
                  {
                    "aria-label": "Fix task",
                    style: { margin: "4px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 160, overflowY: "auto", fontFamily: "var(--font-mono, monospace)" },
                    children: g.prompt
                  }
                ),
                w && /* @__PURE__ */ r("label", { className: "flex items-center gap-1", style: { marginTop: 6, cursor: "pointer" }, children: [
                  /* @__PURE__ */ t("input", { type: "checkbox", checked: !!T, onChange: (N) => w(N.target.checked) }),
                  "Exclude from batch"
                ] })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ t("div", { className: "flex items-center gap-1", style: { flex: "none" }, "data-testid": "need-actions", children: /* @__PURE__ */ t(C, { primary: !0, style: z, onClick: W, disabled: m, children: R === "Dispatch fix" && m ? /* @__PURE__ */ r(L, { children: [
          /* @__PURE__ */ t("span", { className: "sr-spin", "aria-hidden": !0 }),
          "Dispatching…"
        ] }) : R }) }),
        g && /* @__PURE__ */ t(
          "button",
          {
            type: "button",
            "data-testid": "fix-toggle",
            "aria-expanded": _,
            "aria-controls": f,
            "aria-label": _ ? "Hide the fix" : "Show the fix",
            onClick: () => O(!_),
            style: { flex: "none", border: 0, background: "transparent", cursor: "pointer", padding: "2px 4px", color: "var(--muted)" },
            children: _ ? "▴" : "▾"
          }
        )
      ] })
    }
  );
}
function ct({
  e,
  groupId: n,
  onClose: a,
  onSend: i,
  onMark: l,
  onWhy: o,
  onDispatch: m,
  busy: g,
  sentHere: $
}) {
  const v = be(n, e), T = Pe(n, e, $), [w, x] = p(e.reply_draft || ""), [R, D] = p(!1), [_, O] = p(null), [f, W] = p(""), d = se(null), N = se(null), B = se(null), E = e.key.replace(/[^A-Za-z0-9]/g, "-"), y = `sr-detail-${E}`, h = `sr-reply-${E}`, k = e.replies || [], u = e.last_thread_check_at || 0, b = u > 0 && Date.now() / 1e3 - u > lt;
  ae(() => {
    const s = document.activeElement;
    return window.requestAnimationFrame(() => {
      var c;
      return (c = v ? N.current : B.current) == null ? void 0 : c.focus();
    }), () => {
      s && s.isConnected && s.focus();
    };
  }, []);
  const P = async () => {
    const s = w.trim();
    W(""), D(!0);
    const c = await i(s, s !== (e.reply_draft || "").trim());
    D(!1), c.ok ? O(c.link) : W(c.why);
  }, Z = (s) => {
    if (s.key === "Escape") {
      s.stopPropagation(), a();
      return;
    }
    if (s.key !== "Tab" || !d.current) return;
    const c = [...d.current.querySelectorAll("a[href], button:not([disabled]), textarea, input, select")];
    if (c.length === 0) return;
    const S = c[0], F = c[c.length - 1];
    s.shiftKey && document.activeElement === S ? (s.preventDefault(), F.focus()) : !s.shiftKey && document.activeElement === F && (s.preventDefault(), S.focus());
  }, U = (s) => () => {
    s(), a();
  }, M = { marginTop: 14 }, V = { margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "var(--text-strong)" };
  return /* @__PURE__ */ t(
    "div",
    {
      "data-testid": "need-detail-backdrop",
      onMouseDown: (s) => s.target === s.currentTarget && a(),
      style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.35)", display: "flex", justifyContent: "flex-end" },
      children: /* @__PURE__ */ r(
        "div",
        {
          ref: d,
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": y,
          "data-testid": "need-detail",
          onKeyDown: Z,
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
              /* @__PURE__ */ t("h3", { id: y, style: { margin: 0, flex: 1, fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }, children: Me(e.text || e.summary, 80) || "(no text)" }),
              /* @__PURE__ */ t(
                "button",
                {
                  ref: B,
                  type: "button",
                  "aria-label": "Close",
                  onClick: a,
                  style: { border: 0, background: "transparent", cursor: "pointer", padding: "0 6px", fontSize: 18, lineHeight: 1, color: "var(--muted)" },
                  children: "×"
                }
              )
            ] }),
            /* @__PURE__ */ r("section", { "aria-label": "Original message", "data-testid": "detail-original", style: M, children: [
              /* @__PURE__ */ t("h4", { style: V, children: "Original message" }),
              /* @__PURE__ */ r("div", { className: "text-xs text-muted", children: [
                /* @__PURE__ */ t("span", { "data-testid": "detail-author", children: e.user || "someone" }),
                " · ",
                /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
                " · ",
                ie(e.ts_float),
                e.permalink && /* @__PURE__ */ r(L, { children: [
                  " · ",
                  /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open in Slack" })
                ] })
              ] }),
              /* @__PURE__ */ t("p", { style: { margin: "6px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }, "data-testid": "detail-text", children: ue(e.text || e.summary) || "(no text)" })
            ] }),
            /* @__PURE__ */ r("section", { "aria-label": "Thread replies", "data-testid": "detail-replies", style: M, children: [
              /* @__PURE__ */ r("h4", { style: V, children: [
                "Thread replies (",
                k.length,
                ")",
                b && /* @__PURE__ */ r("span", { className: "text-xs text-muted", style: { fontWeight: 400 }, "data-testid": "replies-stale", children: [
                  " · ",
                  "replies as of ",
                  it(u)
                ] })
              ] }),
              k.length === 0 ? /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: 0 }, children: "No replies yet" }) : /* @__PURE__ */ t("ol", { className: "flex flex-col", style: { margin: 0, padding: 0, listStyle: "none" }, children: k.map((s, c) => /* @__PURE__ */ r("li", { style: { padding: "4px 0", borderTop: c === 0 ? 0 : "1px solid var(--border)" }, children: [
                /* @__PURE__ */ r("div", { className: "text-xs text-muted", children: [
                  s.user || "someone",
                  " · ",
                  ie(Number(s.ts))
                ] }),
                /* @__PURE__ */ t("div", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" }, children: ue(s.text) })
              ] }, `${s.ts}-${c}`)) })
            ] }),
            !v && /* @__PURE__ */ r("section", { "aria-label": "Why it is here", style: M, className: "text-xs text-muted", children: [
              e.reason,
              e.category && /* @__PURE__ */ r(L, { children: [
                " · ",
                e.category
              ] }),
              e.words && e.words.length > 0 && /* @__PURE__ */ r(L, { children: [
                " · shared words: ",
                e.words.join(", ")
              ] }),
              e.members && e.members.length > 0 && /* @__PURE__ */ r(L, { children: [
                " · Done and Ignore apply to all ",
                e.members.length
              ] }),
              e.handoff_title && !e.dispatch && !$ && /* @__PURE__ */ r("div", { style: { marginTop: 4, color: "var(--text)" }, children: [
                "Fix: ",
                e.handoff_title
              ] })
            ] }),
            v && /* @__PURE__ */ r("section", { "aria-label": "Reply draft", "data-testid": "detail-draft", style: M, children: [
              /* @__PURE__ */ t("label", { htmlFor: h, style: { ...V, display: "block" }, children: "Reply to the thread, sent as you" }),
              /* @__PURE__ */ r("div", { className: "text-xs text-muted", "data-testid": "draft-by", children: [
                e.reply_draft_by === "owner" ? "Edited by you" : "Drafted by the Radar Lead",
                e.reply_draft_at ? ` · ${G(e.reply_draft_at)}` : ""
              ] }),
              /* @__PURE__ */ t(
                "textarea",
                {
                  id: h,
                  ref: N,
                  value: w,
                  maxLength: 1500,
                  rows: 6,
                  readOnly: _ !== null,
                  onChange: (s) => x(s.target.value),
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
            f && /* @__PURE__ */ t(re, { message: `Could not send that reply: ${f}`, onRetry: P }),
            _ !== null ? /* @__PURE__ */ r("div", { style: M, className: "flex flex-wrap items-center gap-2", children: [
              /* @__PURE__ */ r("p", { role: "status", style: { margin: 0, flex: 1 }, children: [
                "Sent as you",
                _ && /* @__PURE__ */ r(L, { children: [
                  " · ",
                  /* @__PURE__ */ t("a", { className: "underline", href: _, target: "_blank", rel: "noreferrer noopener", "data-testid": "sent-link", children: "Open the reply in Slack" })
                ] })
              ] }),
              /* @__PURE__ */ t(C, { primary: !0, style: z, onClick: a, children: "Close" })
            ] }) : /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-1", style: M, "data-testid": "detail-actions", children: [
              v && /* @__PURE__ */ t(C, { primary: !0, style: z, disabled: !w.trim() || R, onClick: P, children: R ? "Sending…" : "Send to thread" }),
              T === "Dispatch fix" && /* @__PURE__ */ t(C, { primary: !0, style: z, disabled: g, onClick: U(() => m == null ? void 0 : m()), children: "Dispatch fix" }),
              T === "Reply" && e.permalink && /* @__PURE__ */ t(C, { primary: !0, style: z, onClick: () => window.open(e.permalink, "_blank", "noopener,noreferrer"), children: "Reply" }),
              /* @__PURE__ */ t(C, { style: z, onClick: U(() => l("done")), children: v ? "Done without sending" : "Done" }),
              /* @__PURE__ */ t(C, { style: z, onClick: U(() => l("ignored")), children: "Ignore" }),
              /* @__PURE__ */ t(C, { style: z, onClick: U(o), children: "Why? Ask the lead" })
            ] }),
            T === "Reply" && _ === null && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "6px 0 0" }, children: "Reply opens the thread in Slack." })
          ]
        }
      )
    }
  );
}
function ht({ g: e, render: n }) {
  const [a, i] = p(!1), l = a ? e.shown : e.shown.slice(0, Se), o = e.shown.length - l.length;
  return /* @__PURE__ */ r(L, { children: [
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: l.map(n) }),
    (o > 0 || a && e.shown.length > Se) && /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        className: "text-xs underline",
        onClick: () => i(!a),
        style: { border: 0, background: "transparent", cursor: "pointer", padding: "4px 0", color: "var(--muted)" },
        children: a ? "Show fewer" : `Show ${o} more`
      }
    )
  ] });
}
const ze = typeof ve.useChatLauncher == "function" ? ve.useChatLauncher : () => null, ge = { running: "working", idle: "idle", closed: "done", unknown: "" };
function fe({ d: e, label: n }) {
  const a = ze(), i = `/chat?sid=${encodeURIComponent(e.session_key)}`;
  return /* @__PURE__ */ t(
    "a",
    {
      className: "underline",
      href: i,
      onClick: (l) => {
        a && (l.preventDefault(), a.openChat({ slotKey: e.session_key }));
      },
      children: n || e.title || "Fix session"
    }
  );
}
function $e(e) {
  try {
    return JSON.parse(String(e.body || "{}"));
  } catch {
    return {};
  }
}
function pt(e) {
  const n = le(), a = ze(), [i, l] = p(/* @__PURE__ */ new Set()), [o, m] = p({}), [g, $] = p({}), [v, T] = p(null), [w, x] = p(null), [R, D] = p(!1), _ = (h, k) => m((u) => Object.fromEntries([...Object.entries(u), ...h.map((b) => [b, k])])), O = (h, k) => $((u) => Object.fromEntries([...Object.entries(u), ...h.map((b) => [b, k])])), f = (h) => $((k) => Object.fromEntries(Object.entries(k).filter(([u]) => !h.includes(u)))), W = (h, k, u) => {
    a ? (a.openChat({ agent: h.agent, message: h.seed, autoSend: !0 }), _(k, { session_key: "", title: h.title, batch: u, state: "", pr_url: "", pr_number: 0, launched: !0 })) : (D(!1), x({ title: h.title, seed: h.seed }));
  }, d = async (h, k) => {
    if (!(i.size || h.length === 0)) {
      l(new Set(h));
      try {
        await k();
      } finally {
        l(/* @__PURE__ */ new Set());
      }
    }
  }, N = (h) => d([h], async () => {
    f([h]);
    try {
      const k = await n.post(`${A}/items/handoff/dispatch`, { key: h });
      k.mode === "server" ? _([h], { session_key: k.session_key, title: k.title, batch: 0, state: "running", pr_url: "", pr_number: 0 }) : W(k, [h], 0), e();
    } catch (k) {
      const u = $e(k);
      u.code === "already_dispatched" && u.session_key ? _([h], { session_key: u.session_key, title: u.title || "", batch: 0, state: "", pr_url: "", pr_number: 0 }) : O([h], u.error || "the gateway refused it");
    }
  }), B = (h) => d(h, async () => {
    var k;
    T(null);
    try {
      const u = await n.post(`${A}/items/handoff/dispatch-batch`, { keys: h });
      u.mode === "server" ? _(h, { session_key: u.session_key, title: u.title, batch: h.length, state: "running", pr_url: "", pr_number: 0 }) : W(u, h, h.length), e();
    } catch (u) {
      const b = $e(u), P = (k = b.dispatched) != null && k.length ? `${b.dispatched.length} of them already have a session` : b.error || "the gateway refused it";
      T({ keys: h, why: P });
    }
  }), E = async () => {
    if (w)
      try {
        await navigator.clipboard.writeText(w.seed), D(!0);
      } catch {
        D(!1);
      }
  }, y = w && /* @__PURE__ */ t(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "sr-fix-title",
      style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" },
      onKeyDown: (h) => h.key === "Escape" && x(null),
      children: /* @__PURE__ */ r("div", { style: { width: "min(720px, 92vw)", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: 16 }, children: [
        /* @__PURE__ */ t("h3", { id: "sr-fix-title", className: "text-sm", style: { margin: "0 0 6px", fontWeight: 600 }, children: w.title }),
        /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 8px" }, children: "This Kiro Crew cannot open the session for you. Copy this task into a new kirocrew-conductor chat." }),
        /* @__PURE__ */ t(
          "textarea",
          {
            readOnly: !0,
            "aria-label": "Fix task",
            value: w.seed,
            style: { width: "100%", height: 260, fontSize: 12, fontFamily: "var(--font-mono, monospace)" }
          }
        ),
        /* @__PURE__ */ r("div", { className: "flex items-center gap-2", style: { marginTop: 8 }, children: [
          /* @__PURE__ */ t(C, { onClick: E, children: R ? "Copied" : "Copy task" }),
          /* @__PURE__ */ t("a", { className: "underline text-sm", href: "/chat?new=1", children: "New chat" }),
          /* @__PURE__ */ t("div", { className: "flex-1" }),
          /* @__PURE__ */ t(C, { onClick: () => x(null), children: "Close" })
        ] })
      ] })
    }
  );
  return { dispatch: N, dispatchBatch: B, busy: i, sent: o, failed: g, batchFailed: v, ui: y };
}
const Ce = 10;
function mt({
  needs: e,
  handled: n,
  onChanged: a,
  onWhy: i
}) {
  var V;
  const l = le(), o = pt(a), m = (e == null ? void 0 : e.fixes) || [], g = (e == null ? void 0 : e.fix_batches) || [], $ = new Map(g.map((s) => [s.session_key, s])), v = new Map(((e == null ? void 0 : e.handoffs) || []).map((s) => [s.key, s.handoff])), T = (s) => {
    const c = v.get(s.key);
    return s.handoff_title ? { title: s.handoff_title || (c == null ? void 0 : c.title) || "", prompt: (c == null ? void 0 : c.prompt) || "", repo: (c == null ? void 0 : c.repo) || "" } : void 0;
  }, w = (((V = ((e == null ? void 0 : e.groups) || []).find((s) => s.id === "decide")) == null ? void 0 : V.entries) || []).filter((s) => s.handoff_title && !s.dispatch && !o.sent[s.key] && v.has(s.key)).map((s) => ({ key: s.key, repo: v.get(s.key).repo || "" })), [x, R] = p(/* @__PURE__ */ new Set()), D = w.filter((s) => !x.has(s.key)), O = new Set(D.map((s) => s.repo.toLowerCase())).size > 1 ? "one repo per batch: exclude the others from their ▾" : D.length > Ce ? `at most ${Ce} per batch: exclude some from their ▾` : "", [f, W] = p(null), d = async (s, c, S, F) => {
    var j, K;
    try {
      S && await l.post(`${A}/items/reply/draft`, { key: s, text: c });
      const I = await l.post(`${A}/items/reply/send`, { key: s });
      return k((Y) => new Set(Y).add(F)), a(), { ok: !0, link: String(((K = (j = I == null ? void 0 : I.item) == null ? void 0 : j.replied) == null ? void 0 : K.permalink) || "") };
    } catch (I) {
      return { ok: !1, why: I.message || "unknown error" };
    }
  }, N = (e == null ? void 0 : e.replied) || [], [B, E] = p(""), y = async (s) => {
    E("");
    try {
      await l.post(`${A}/items/handoff/dismiss`, { key: s }), a();
    } catch {
      E(s);
    }
  }, [h, k] = p(/* @__PURE__ */ new Set()), [u, b] = p(null);
  ae(() => k(/* @__PURE__ */ new Set()), [e]);
  const P = async (s, c, S) => {
    b(null), S && k((F) => new Set(F).add(S));
    try {
      for (const F of s) await l.post(`${A}/items/handle`, { key: F, how: c });
      a();
    } catch {
      S && k((F) => {
        const j = new Set(F);
        return j.delete(S), j;
      }), b({ keys: s, how: c, rowId: S });
    }
  }, Z = ((e == null ? void 0 : e.groups) || []).map((s) => ({
    ...s,
    shown: s.entries.filter((c) => !h.has(`${s.id}:${c.key}`))
  })), U = Z.every((s) => s.shown.length === 0), M = (u == null ? void 0 : u.how) === "reopen" ? "reopen" : (u == null ? void 0 : u.how) === "ignored" ? "ignore" : "mark as done";
  return /* @__PURE__ */ r(H, { className: "mb-4", children: [
    /* @__PURE__ */ t("div", { className: "flex items-center gap-2", children: /* @__PURE__ */ t(X, { children: "Needs you" }) }),
    u && /* @__PURE__ */ t(
      re,
      {
        message: `Could not ${M} that message. Nothing changed.`,
        onRetry: () => P(u.keys, u.how, u.rowId)
      }
    ),
    e ? U ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Nothing needs you right now." }) : Z.map(
      (s) => s.shown.length === 0 ? null : /* @__PURE__ */ r("section", { "aria-label": Ne[s.id], style: { marginTop: 10 }, children: [
        /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2", children: [
          /* @__PURE__ */ r("h4", { className: "text-sm", style: { margin: 0, fontWeight: 600, color: "var(--text-strong)" }, children: [
            Ne[s.id],
            " ",
            /* @__PURE__ */ r("span", { className: "text-muted", style: { fontWeight: 400 }, children: [
              "(",
              s.total - (s.entries.length - s.shown.length),
              ")"
            ] })
          ] }),
          /* @__PURE__ */ t("div", { className: "flex-1" }),
          s.id === "decide" && w.length >= 2 && /* @__PURE__ */ r(L, { children: [
            O && /* @__PURE__ */ t("span", { className: "text-xs text-muted", role: "status", children: O }),
            /* @__PURE__ */ t(
              C,
              {
                style: z,
                onClick: () => o.dispatchBatch(D.map((c) => c.key)),
                disabled: o.busy.size > 0 || D.length === 0 || !!O,
                children: D.length > 0 && o.busy.has(D[0].key) && o.busy.size > 1 ? /* @__PURE__ */ r(L, { children: [
                  /* @__PURE__ */ t("span", { className: "sr-spin", "aria-hidden": !0 }),
                  "Dispatching…"
                ] }) : `Dispatch all fixes (${D.length})`
              }
            )
          ] })
        ] }),
        s.id === "decide" && o.batchFailed && /* @__PURE__ */ t(
          re,
          {
            message: `Could not dispatch those fixes: ${o.batchFailed.why}. Nothing was sent.`,
            onRetry: () => o.dispatchBatch(o.batchFailed.keys)
          }
        ),
        /* @__PURE__ */ t(
          ht,
          {
            g: s,
            render: (c, S) => /* @__PURE__ */ t(
              dt,
              {
                e: c,
                groupId: s.id,
                first: S === 0,
                onOpen: () => W({ e: c, groupId: s.id }),
                onMark: (F) => {
                  var j;
                  return P((j = c.members) != null && j.length ? c.members : [c.key], F, `${s.id}:${c.key}`);
                },
                onDispatch: s.id === "decide" && c.handoff_title ? () => o.dispatch(c.key) : void 0,
                busy: o.busy.has(c.key),
                fix: s.id === "decide" ? T(c) : void 0,
                sentHere: o.sent[c.key],
                failed: s.id === "decide" ? o.failed[c.key] : void 0,
                excluded: x.has(c.key),
                onExclude: s.id === "decide" && w.length >= 2 && w.some((F) => F.key === c.key) ? (F) => R((j) => {
                  const K = new Set(j);
                  return F ? K.add(c.key) : K.delete(c.key), K;
                }) : void 0
              },
              c.key
            )
          }
        )
      ] }, s.id)
    ) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" }),
    B && /* @__PURE__ */ t(re, { message: "Could not dismiss that hand-off. Nothing changed.", onRetry: () => y(B) }),
    m.length > 0 && /* @__PURE__ */ r("details", { style: { marginTop: 12 }, "data-testid": "fixes-in-flight", children: [
      /* @__PURE__ */ r("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Fixes in flight (",
        (e == null ? void 0 : e.fixes_total) ?? m.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: m.map((s, c) => {
        const S = s.dispatch.batch ? $.get(s.dispatch.session_key) : void 0, F = S && S.keys[0] === s.key, j = { padding: "6px 0", borderTop: c === 0 ? 0 : "1px solid var(--border)" }, K = s.dispatch.pr_url && /* @__PURE__ */ r(L, { children: [
          " · ",
          /* @__PURE__ */ r("a", { className: "underline", href: s.dispatch.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
            "PR #",
            s.dispatch.pr_number
          ] })
        ] });
        return /* @__PURE__ */ r("li", { className: "text-sm", style: S ? { ...j, ...F ? {} : { borderTop: 0, paddingTop: 0 } } : j, children: [
          F && S && /* @__PURE__ */ r("div", { "data-testid": "fix-batch-header", style: { marginBottom: 4 }, children: [
            /* @__PURE__ */ t(fe, { d: S }),
            /* @__PURE__ */ r("span", { className: "text-xs text-muted", children: [
              " · ",
              ge[S.state] || S.state || "sent",
              " · ",
              /* @__PURE__ */ t("span", { className: "font-mono", children: S.repo }),
              " · ",
              S.prs_found,
              " PRs found / ",
              S.total,
              " · ",
              G(S.at)
            ] })
          ] }),
          /* @__PURE__ */ r("div", { className: "flex items-center gap-2", style: S ? { paddingLeft: 16 } : void 0, children: [
            /* @__PURE__ */ r("span", { style: { flex: 1, minWidth: 0 }, children: [
              S ? s.handoff_title : /* @__PURE__ */ r(L, { children: [
                /* @__PURE__ */ t(fe, { d: s.dispatch }),
                /* @__PURE__ */ r("span", { className: "text-xs text-muted", children: [
                  " · ",
                  ge[s.dispatch.state] || s.dispatch.state || "sent",
                  " · ",
                  /* @__PURE__ */ t("span", { className: "font-mono", children: s.repo }),
                  " · ",
                  G(s.dispatch.at)
                ] })
              ] }),
              K
            ] }),
            /* @__PURE__ */ t(C, { style: z, onClick: () => y(s.key), children: "Dismiss" })
          ] })
        ] }, s.key);
      }) })
    ] }),
    ((e == null ? void 0 : e.handled_total) || 0) > 0 && /* @__PURE__ */ r("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ r("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Handled (",
        e == null ? void 0 : e.handled_total,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: n.map((s, c) => /* @__PURE__ */ r(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: c === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 0 }, children: s.summary || s.text.slice(0, 200) }),
            /* @__PURE__ */ r("span", { className: "text-xs text-muted", children: [
              s.handled_how === "ignored" ? "Ignored" : "Done",
              " ",
              G(s.handled_at)
            ] }),
            /* @__PURE__ */ t(C, { style: z, onClick: () => P([s.key], "reopen"), children: "Reopen" })
          ]
        },
        s.key
      )) })
    ] }),
    N.length > 0 && /* @__PURE__ */ r("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ r("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Replied (",
        (e == null ? void 0 : e.replied_total) ?? N.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: N.map((s, c) => /* @__PURE__ */ r(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: c === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ r("span", { style: { flex: 1, minWidth: 0 }, children: [
              s.text.length > 120 ? `${s.text.slice(0, 119)}…` : s.text,
              /* @__PURE__ */ r("span", { className: "text-xs text-muted", children: [
                " · ",
                s.summary,
                " · ",
                /* @__PURE__ */ t("span", { className: "font-mono", children: s.channel }),
                " · ",
                G(s.at)
              ] })
            ] }),
            s.permalink && /* @__PURE__ */ t("a", { className: "underline text-xs", href: s.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open reply" })
          ]
        },
        s.key
      )) })
    ] }),
    f && /* @__PURE__ */ t(
      ct,
      {
        e: f.e,
        groupId: f.groupId,
        sentHere: !!o.sent[f.e.key],
        onClose: () => W(null),
        onSend: (s, c) => d(f.e.key, s, c, `${f.groupId}:${f.e.key}`),
        onMark: (s) => {
          var c;
          return P((c = f.e.members) != null && c.length ? f.e.members : [f.e.key], s, `${f.groupId}:${f.e.key}`);
        },
        onWhy: () => i(f.e),
        onDispatch: f.groupId === "decide" && f.e.handoff_title ? () => o.dispatch(f.e.key) : void 0,
        busy: o.busy.has(f.e.key)
      },
      `${f.groupId}:${f.e.key}`
    ),
    o.ui
  ] });
}
function ut({ it: e, first: n, checked: a, onToggle: i }) {
  const l = e.priority ? { label: e.priority, variant: e.priority === "p0" || e.priority === "p1" ? "err" : "muted" } : e.possibly_resolved ? { label: "possibly resolved", variant: "warn" } : null, o = [
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
        onChange: i,
        style: { marginTop: 4 }
      }
    ),
    /* @__PURE__ */ r("div", { className: "flex items-center gap-1", style: { flex: "none" }, children: [
      /* @__PURE__ */ t(Q, { variant: et(e.status), children: e.status }),
      l && /* @__PURE__ */ t(Q, { variant: l.variant, children: l.label }),
      o.length > 0 && /* @__PURE__ */ r("span", { className: "text-xs text-muted", title: o.join(`
`), "aria-label": o.join("; "), children: [
        "+",
        o.length
      ] })
    ] }),
    /* @__PURE__ */ r("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || e.text.slice(0, 280) }),
      /* @__PURE__ */ r("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        /* @__PURE__ */ t("span", { "data-testid": "ledger-ts", "data-ts": e.ts_float, children: G(e.ts_float) }),
        " · ",
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        e.user && /* @__PURE__ */ r(L, { children: [
          " · ",
          e.user
        ] }),
        e.reply_count > 0 && /* @__PURE__ */ r(L, { children: [
          " · ",
          e.reply_count,
          " replies"
        ] }),
        " · ",
        /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "open in Slack" }),
        e.links.length > 0 && /* @__PURE__ */ r(L, { children: [
          " · linked ",
          e.links.map((m) => /* @__PURE__ */ t("a", { className: "underline mr-2", href: m, target: "_blank", rel: "noreferrer noopener", children: m.replace("https://github.com/", "") }, m))
        ] })
      ] }),
      e.note && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: e.note })
    ] })
  ] }) });
}
function gt(e) {
  var n, a;
  return !!((n = e.reply_draft) != null && n.text || (a = e.fix_handoff) != null && a.prompt || e.possibly_resolved);
}
const ft = ["", "p0", "p1", "p2", "p3", "none"];
function yt(e) {
  const { state: n, items: a, selected: i, setSelected: l } = e, [o, m] = p(""), [g, $] = p(""), [v, T] = p(""), [w, x] = p(!1), R = n.counts.open_by_priority, D = he(() => [...new Set(a.map((d) => d.category).filter(Boolean))].sort(), [a]), _ = he(
    () => a.filter((d) => !g || (g === "none" ? !d.priority : d.priority === g)).filter((d) => !v || d.category === v).filter((d) => !w || gt(d)).sort((d, N) => (N.ts_float || 0) - (d.ts_float || 0)),
    [a, g, v, w]
  ), O = (d) => {
    const N = new Set(i);
    N.has(d) ? N.delete(d) : N.add(d), l(N);
  }, f = he(
    () => n.settings.channels.map((d) => ({ cid: d, ...n.channels[d] || {} })),
    [n]
  ), W = "text-sm bg-transparent border rounded px-2 py-1";
  return /* @__PURE__ */ r("div", { style: { minWidth: 0 }, children: [
    /* @__PURE__ */ r("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4", children: [
      /* @__PURE__ */ t(ce, { label: "Awaiting triage", value: n.counts.needs_triage, accent: !0 }),
      /* @__PURE__ */ t(ce, { label: "Possibly resolved", value: n.counts.possibly_resolved }),
      /* @__PURE__ */ t(ce, { label: "Open p0 / p1", value: `${R.p0 || 0} / ${R.p1 || 0}` }),
      /* @__PURE__ */ t(ce, { label: "Tracked items", value: n.counts.total })
    ] }),
    /* @__PURE__ */ r(H, { className: "mb-4", children: [
      /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2 mb-3", children: [
        /* @__PURE__ */ t(X, { children: "Ledger" }),
        /* @__PURE__ */ r("span", { className: "text-xs text-muted", "data-testid": "ledger-count", children: [
          _.length,
          " of ",
          a.length,
          " · newest first"
        ] }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-filter", children: "Status" }),
        /* @__PURE__ */ r("select", { id: "sr-filter", className: W, value: e.filter, onChange: (d) => e.setFilter(d.target.value), children: [
          /* @__PURE__ */ t("option", { value: "open", children: "open" }),
          /* @__PURE__ */ t("option", { value: "new", children: "new" }),
          /* @__PURE__ */ t("option", { value: "triaged", children: "triaged" }),
          /* @__PURE__ */ t("option", { value: "investigating", children: "investigating" }),
          /* @__PURE__ */ t("option", { value: "resolved", children: "resolved" }),
          /* @__PURE__ */ t("option", { value: "noise", children: "noise" }),
          /* @__PURE__ */ t("option", { value: "", children: "all" })
        ] }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-priority", children: "Priority" }),
        /* @__PURE__ */ t("select", { id: "sr-priority", className: W, value: g, onChange: (d) => $(d.target.value), children: ft.map((d) => /* @__PURE__ */ t("option", { value: d, children: d || "all" }, d)) }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-category", children: "Category" }),
        /* @__PURE__ */ r("select", { id: "sr-category", className: W, value: v, onChange: (d) => T(d.target.value), children: [
          /* @__PURE__ */ t("option", { value: "", children: "all" }),
          D.map((d) => /* @__PURE__ */ t("option", { value: d, children: d }, d))
        ] }),
        /* @__PURE__ */ r("label", { className: "text-sm flex items-center gap-1", style: { cursor: "pointer" }, children: [
          /* @__PURE__ */ t("input", { type: "checkbox", checked: w, onChange: (d) => x(d.target.checked) }),
          "Needs me"
        ] }),
        /* @__PURE__ */ t("div", { className: "flex-1" }),
        /* @__PURE__ */ t(
          J,
          {
            "aria-label": "GitHub repository to search (owner/name, optional)",
            placeholder: "owner/repo (optional)",
            value: o,
            onChange: (d) => m(d.target.value),
            className: "w-48"
          }
        ),
        /* @__PURE__ */ r(C, { onClick: () => e.onInvestigate(o), disabled: i.size === 0 || !!e.busy, children: [
          "Investigate ",
          i.size || ""
        ] })
      ] }),
      _.length === 0 ? /* @__PURE__ */ t(
        Ke,
        {
          icon: /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "📡" }),
          title: a.length ? "Nothing matches these filters" : "Nothing here yet",
          subtitle: a.length ? "Change a filter to see more." : "New messages appear after the next poll."
        }
      ) : /* @__PURE__ */ t("ul", { className: "flex flex-col", "data-testid": "ledger-list", children: _.map((d, N) => /* @__PURE__ */ t(ut, { it: d, first: N === 0, checked: i.has(d.key), onToggle: () => O(d.key) }, d.key)) })
    ] }),
    /* @__PURE__ */ r(H, { children: [
      /* @__PURE__ */ t(X, { children: "Channels" }),
      f.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No channels configured." }) : /* @__PURE__ */ r("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ t("thead", { children: /* @__PURE__ */ r("tr", { className: "text-left text-muted", children: [
          /* @__PURE__ */ t("th", { scope: "col", children: "Channel" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Last polled" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Status" })
        ] }) }),
        /* @__PURE__ */ t("tbody", { children: f.map((d) => /* @__PURE__ */ r("tr", { children: [
          /* @__PURE__ */ t("td", { className: "font-mono", children: d.cid }),
          /* @__PURE__ */ t("td", { children: ie(d.last_polled_at) }),
          /* @__PURE__ */ t("td", { children: d.last_error ? /* @__PURE__ */ t(Q, { variant: "err", title: d.last_error, children: "error" }) : /* @__PURE__ */ t(Q, { variant: "ok", children: "ok" }) })
        ] }, d.cid)) })
      ] })
    ] })
  ] });
}
const xt = 5;
function bt(e) {
  const n = e.split(`
`).map((i) => i.trim()).filter(Boolean), a = n.filter((i) => /^[•\-–]\s/.test(i));
  return (a.length ? a : n).slice(0, xt);
}
function vt({ state: e, busy: n, onDigest: a }) {
  const i = e.digest, l = e.crew.today, o = bt(i.last_text || ""), m = e.settings.digest_destination === "self_dm" ? "DMed to you" : "dashboard notification";
  return /* @__PURE__ */ r(H, { className: "mb-4", "data-testid": "today-card", children: [
    /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ t(X, { children: "Today" }),
      i.pending ? /* @__PURE__ */ t(Q, { variant: "aim", children: "digest being delivered" }) : null,
      i.last_posted_date && /* @__PURE__ */ r("span", { className: "text-xs text-muted", "data-testid": "digest-time", children: [
        "digest ",
        i.last_posted_date,
        " · ",
        m
      ] }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      /* @__PURE__ */ t(C, { style: z, onClick: a, disabled: !!n || !e.crew.live, children: "Digest now" })
    ] }),
    (l == null ? void 0 : l.text) && /* @__PURE__ */ r("p", { style: { margin: "8px 0 0", fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }, "data-testid": "crew-today", children: [
      l.text,
      l.at > 0 && /* @__PURE__ */ r("span", { className: "text-xs text-muted", style: { fontWeight: 400 }, children: [
        " · ",
        G(l.at)
      ] })
    ] }),
    i.last_text ? /* @__PURE__ */ r(L, { children: [
      /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", "data-testid": "digest-top", style: { margin: "8px 0 0", padding: 0, listStyle: "none" }, children: o.map((g, $) => /* @__PURE__ */ t("li", { children: g }, $)) }),
      /* @__PURE__ */ t(ye, { summary: "Full digest", children: /* @__PURE__ */ t("pre", { className: "whitespace-pre-wrap text-sm", style: { fontFamily: "inherit", margin: 0 }, children: i.last_text }) })
    ] }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { margin: "8px 0 0" }, "data-testid": "digest-empty", children: "No digest yet" }),
    i.last_error && /* @__PURE__ */ t("p", { className: "text-xs mt-1", style: { color: "var(--danger)" }, children: i.last_error })
  ] });
}
function wt({ state: e }) {
  return /* @__PURE__ */ t("div", { className: "flex items-center gap-2", style: { marginTop: 10 }, children: oe.map((n) => /* @__PURE__ */ r("span", { title: `${n.title} · ${ee(n, e).label}`, children: [
    /* @__PURE__ */ t(xe, { m: n, s: e, selected: n.id === "lead", size: 30 }),
    /* @__PURE__ */ t("span", { className: "sr-only", children: `${n.title}: ${ee(n, e).label}` })
  ] }, n.id)) });
}
function kt(e) {
  const n = `slack-radar:chat-open:${e}`, a = () => {
    try {
      return window.localStorage.getItem(n) === "1";
    } catch {
      return !1;
    }
  }, [i, l] = p(a);
  ae(() => l(a()), [n]);
  const o = me(
    (m) => {
      l(m);
      try {
        m ? window.localStorage.setItem(n, "1") : window.localStorage.removeItem(n);
      } catch {
      }
    },
    [n]
  );
  return [i, o];
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
function Nt(e) {
  const n = le(), { state: a, expanded: i, pending: l } = e, o = oe[0], m = a.crew.slot_key, g = a.crew.live && a.crew.session_open && a.crew.session_agent === a.crew.agent, [$, v] = p(""), [T, w] = p(!1), [x, R] = p(""), [D, _] = p(!1), O = ee(o, a), f = async (y) => {
    await n.post(`${A}/crew/message`, { message: y }), e.onChanged();
  }, W = async (y) => {
    const h = y.trim();
    if (h) {
      w(!0), R("");
      try {
        await n.post(`${A}/crew/message`, { message: h }), v(""), h === l && e.setPending(""), e.setExpanded(!0), e.onChanged();
      } catch {
        R(h);
      } finally {
        w(!1);
      }
    }
  }, d = async () => {
    try {
      await navigator.clipboard.writeText(l), _(!0), window.setTimeout(() => _(!1), 1500);
    } catch {
      _(!1);
    }
  }, N = x && /* @__PURE__ */ t(re, { message: "The Radar Lead did not get that message.", onRetry: () => W(x) }), B = /* @__PURE__ */ t("div", { className: "text-sm", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }, children: a.crew.live ? /* @__PURE__ */ r(L, { children: [
    /* @__PURE__ */ t("span", { children: "The Radar Lead session opens on its next turn. Open it now to talk here." }),
    /* @__PURE__ */ t(C, { primary: !0, onClick: e.onStart, disabled: !!e.busy || !e.configured, children: "Open the session" })
  ] }) : /* @__PURE__ */ r("span", { children: [
    "The Radar Lead is paused. Turn on ",
    /* @__PURE__ */ t("b", { children: "Crew" }),
    " at the top of the page to triage your channels and talk to it here."
  ] }) });
  if (!i)
    return /* @__PURE__ */ r(H, { style: { padding: "10px 14px" }, children: [
      /* @__PURE__ */ r(
        "form",
        {
          className: "flex flex-wrap items-center gap-2",
          onSubmit: (y) => {
            y.preventDefault(), W($);
          },
          children: [
            /* @__PURE__ */ t(xe, { m: o, s: a, size: 26 }),
            /* @__PURE__ */ t(
              J,
              {
                "aria-label": "Ask the lead",
                placeholder: "Ask the lead…",
                value: $,
                onChange: (y) => v(y.target.value),
                disabled: !g || T,
                style: { flex: 1, minWidth: 200 }
              }
            ),
            /* @__PURE__ */ t(C, { primary: !0, type: "submit", disabled: !g || T || !$.trim(), children: "Send" }),
            we.map((y) => /* @__PURE__ */ t(Te, { q: y, onClick: () => W(y), disabled: !g || T }, y))
          ]
        }
      ),
      !g && /* @__PURE__ */ t("div", { style: { marginTop: 8 }, children: B }),
      N
    ] });
  const E = e.events.filter((y) => y.kind === "crew" || y.kind === "digest").slice(0, 5);
  return /* @__PURE__ */ r(
    H,
    {
      style: { padding: 0, display: "flex", flexDirection: "column", height: "min(620px, calc(100vh - 240px))", overflow: "hidden" },
      children: [
        /* @__PURE__ */ r("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border)" }, children: [
          /* @__PURE__ */ r("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: a.crew.name || o.title }),
            /* @__PURE__ */ t(Q, { variant: O.tone === "muted" ? "muted" : O.tone === "aim" ? "aim" : "ok", children: O.label }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(C, { onClick: () => e.setExpanded(!1), "aria-expanded": !0, children: "Collapse" })
          ] }),
          /* @__PURE__ */ r("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
            "phase ",
            a.crew_memory.phase,
            " · next: ",
            a.crew_memory.next || "—"
          ] }),
          /* @__PURE__ */ t(wt, { state: a })
        ] }),
        /* @__PURE__ */ t(qe, { state: a }),
        l && // ChatEmbed has no API to fill its composer, so the question waits here.
        /* @__PURE__ */ r(
          "div",
          {
            className: "text-sm flex flex-wrap items-center gap-2",
            style: { padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" },
            children: [
              /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200, userSelect: "all" }, children: l }),
              /* @__PURE__ */ t(C, { primary: !0, style: z, onClick: () => W(l), disabled: !g || T, children: "Send" }),
              /* @__PURE__ */ t(C, { style: z, onClick: d, children: D ? "Copied" : "Copy" })
            ]
          }
        ),
        N && /* @__PURE__ */ t("div", { style: { padding: "0 16px" }, children: N }),
        /* @__PURE__ */ t("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: g ? /* @__PURE__ */ t(
          He,
          {
            slotKey: m,
            agent: a.crew.agent,
            frameless: !0,
            startAtBottom: !0,
            placeholder: "Ask the Radar Lead…",
            onSend: f
          },
          m
        ) : /* @__PURE__ */ r("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 10 }, children: [
          B,
          !e.configured && /* @__PURE__ */ t("p", { className: "text-xs text-muted", children: "Add a channel in Settings first." }),
          E.length > 0 && /* @__PURE__ */ t("ul", { className: "text-xs text-muted flex flex-col gap-1", style: { marginTop: 6 }, children: E.map((y, h) => /* @__PURE__ */ r("li", { children: [
            G(y.at),
            " · ",
            y.text
          ] }, `${y.at}-${h}`)) })
        ] }) }),
        /* @__PURE__ */ t("div", { className: "flex flex-wrap gap-2", style: { padding: "10px 16px 12px", borderTop: "1px solid var(--border)" }, children: we.map((y) => /* @__PURE__ */ t(Te, { q: y, onClick: () => W(y), disabled: !g || T }, y)) })
      ]
    }
  );
}
function _t({ state: e }) {
  return /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ t(X, { children: "Team" }),
    /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { marginBottom: 8 }, children: "Who works on your channels. Only the Radar Lead has a session; the others run when needed." }),
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: oe.map((n) => {
      var i, l;
      const a = n.id === "lead" ? e.crew.agent : n.agent;
      return /* @__PURE__ */ r(
        "li",
        {
          className: "flex items-start gap-3",
          style: { padding: "12px 4px", borderTop: "1px solid var(--border)", opacity: n.planned ? 0.7 : 1 },
          children: [
            /* @__PURE__ */ t(xe, { m: n, s: e, size: 36 }),
            /* @__PURE__ */ r("div", { style: { minWidth: 0, flex: 1 }, children: [
              /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2", children: [
                /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: n.id === "lead" && e.crew.name || n.title }),
                /* @__PURE__ */ t(Q, { variant: "muted", children: n.layer }),
                /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: n.kind })
              ] }),
              /* @__PURE__ */ t("p", { className: "text-sm", style: { margin: "4px 0 0" }, children: n.duty }),
              n.id === "investigator" && (((i = e.investigations) == null ? void 0 : i.items) || 0) > 0 && /* @__PURE__ */ r("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: [
                (l = e.investigations) == null ? void 0 : l.items,
                " item(s) under investigation"
              ] }),
              a && /* @__PURE__ */ t(ye, { children: /* @__PURE__ */ r("span", { className: "font-mono", children: [
                "agent: ",
                a,
                n.id === "lead" && e.crew.slot_key ? ` · session: ${e.crew.slot_key}` : ""
              ] }) })
            ] }),
            /* @__PURE__ */ t("div", { "data-testid": `team-status-${n.id}`, style: { maxWidth: 360, minWidth: 0, display: "flex" }, children: /* @__PURE__ */ t(Ae, { m: n, state: e, withName: !1, withResting: !0 }) })
          ]
        },
        n.id
      );
    }) })
  ] });
}
function St({ events: e, kinds: n, onShowAll: a }) {
  const i = n ? e.filter((l) => n.includes(l.kind)) : e;
  return /* @__PURE__ */ r(H, { children: [
    /* @__PURE__ */ t(X, { children: "Activity" }),
    n && /* @__PURE__ */ r("p", { className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { marginBottom: 8 }, children: [
      /* @__PURE__ */ t("span", { children: "Showing the crew and its members only." }),
      /* @__PURE__ */ t(C, { style: z, onClick: a, children: "Show all" })
    ] }),
    i.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No activity yet." }) : /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", children: i.map((l, o) => /* @__PURE__ */ r("li", { children: [
      /* @__PURE__ */ t("span", { className: "text-muted", children: ie(l.at) }),
      " ",
      /* @__PURE__ */ t(Q, { variant: "muted", children: l.kind }),
      " ",
      l.text
    ] }, `${l.at}-${o}`)) })
  ] });
}
function $t({
  state: e,
  busy: n,
  act: a,
  mcp: i,
  onProbe: l
}) {
  const o = le(), [m, g] = p(e.settings.channels.join(`
`)), [$, v] = p(e.settings.digest_destination), [T, w] = p(e.settings.slack_login), [x, R] = p(e.settings.slack_mcp_command), [D, _] = p(e.settings.workspace_url), [O, f] = p(String(e.settings.poll_interval_secs)), [W, d] = p(String(e.settings.backfill_hours)), [N, B] = p(e.crew.unattended), [E, y] = p(e.crew.agent), [h, k] = p(e.crew.model), u = () => a(
    "Save settings",
    () => o.put(`${A}/settings`, {
      channels: m.split(/[\s,]+/).map((b) => b.trim()).filter(Boolean),
      digest_destination: $,
      slack_login: T.trim(),
      slack_mcp_command: x.trim(),
      workspace_url: D.trim(),
      poll_interval_secs: Number(O),
      backfill_hours: Number(W)
    })
  );
  return /* @__PURE__ */ r(L, { children: [
    !e.vault_available && /* @__PURE__ */ t(H, { className: "mb-4", children: /* @__PURE__ */ t("p", { className: "text-sm", children: "The gateway secret vault is unavailable, so settings cannot be saved." }) }),
    /* @__PURE__ */ r(H, { className: "mb-4", children: [
      /* @__PURE__ */ t(X, { children: "Basics" }),
      /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(Be, { mcp: i, state: e }) }),
        /* @__PURE__ */ t(C, { disabled: !!n, onClick: l, children: "Check connection" })
      ] }),
      /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 12px" }, children: "Slack is read as you, read-only: no bot, no invite. The one write is the optional digest DM to yourself." }),
      /* @__PURE__ */ t("label", { className: "block text-sm mb-1", htmlFor: "sr-channels", children: "Channels to watch (one channel ID per line, e.g. C0123ABCD). Any channel you can read works." }),
      /* @__PURE__ */ t(
        "textarea",
        {
          id: "sr-channels",
          className: "w-full font-mono text-sm border rounded p-2 bg-transparent",
          rows: 5,
          value: m,
          onChange: (b) => g(b.target.value)
        }
      ),
      /* @__PURE__ */ r("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "Digest destination",
          /* @__PURE__ */ r(
            "select",
            {
              className: "block w-full text-sm bg-transparent border rounded px-2 py-1",
              value: $,
              onChange: (b) => v(b.target.value),
              children: [
                /* @__PURE__ */ t("option", { value: "dashboard", children: "Dashboard notification only" }),
                /* @__PURE__ */ t("option", { value: "self_dm", children: "DM to myself in Slack" })
              ]
            }
          )
        ] }),
        $ === "self_dm" && /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "Your Slack login (for the DM)",
          /* @__PURE__ */ t(J, { value: T, onChange: (b) => w(b.target.value), placeholder: "jdoe" })
        ] }),
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "Poll interval (seconds, 60–3600)",
          /* @__PURE__ */ t(J, { type: "number", min: 60, max: 3600, value: O, onChange: (b) => f(b.target.value) }),
          /* @__PURE__ */ r("span", { "data-testid": "poll-cadence", className: "block text-xs text-muted", style: { marginTop: 2 }, children: [
            "Runs by itself every ",
            e.settings.poll_interval_secs,
            " s; a manual Poll just runs one cycle now."
          ] })
        ] })
      ] }),
      /* @__PURE__ */ t(C, { primary: !0, className: "mt-3", disabled: !!n, onClick: u, children: "Save settings" })
    ] }),
    /* @__PURE__ */ t(H, { children: /* @__PURE__ */ r("details", { children: [
      /* @__PURE__ */ t("summary", { style: { cursor: "pointer", fontWeight: 600, color: "var(--text-strong)" }, children: "Advanced" }),
      /* @__PURE__ */ r("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "MCP server command (a single executable on PATH)",
          /* @__PURE__ */ t(J, { value: x, onChange: (b) => R(b.target.value), placeholder: "ai-community-slack-mcp" })
        ] }),
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "Workspace URL (for permalinks, optional)",
          /* @__PURE__ */ t(J, { value: D, onChange: (b) => _(b.target.value), placeholder: "https://yourteam.slack.com" })
        ] }),
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "First-poll backfill (hours, 0–168)",
          /* @__PURE__ */ t(J, { type: "number", min: 0, max: 168, value: W, onChange: (b) => d(b.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(C, { className: "mt-3", disabled: !!n, onClick: u, children: "Save settings" }),
      /* @__PURE__ */ r("div", { style: { borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }, children: [
        /* @__PURE__ */ t("div", { className: "text-sm", style: { fontWeight: 600, marginBottom: 8 }, children: "Crew" }),
        /* @__PURE__ */ r("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
          /* @__PURE__ */ r("label", { className: "text-sm", children: [
            "Agent",
            /* @__PURE__ */ t(J, { value: E, onChange: (b) => y(b.target.value), placeholder: "slack-radar-crew" }),
            /* @__PURE__ */ t("span", { className: "block text-xs text-muted mt-1", children: "Default: the shipped slack-radar-crew agent. Your own agents are never modified." })
          ] }),
          /* @__PURE__ */ r("label", { className: "text-sm", children: [
            "Model (empty = agent default)",
            /* @__PURE__ */ t(J, { value: h, onChange: (b) => k(b.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ r("div", { className: "mt-3 flex items-center gap-2", children: [
          /* @__PURE__ */ t(
            Re,
            {
              checked: N,
              onChange: B,
              label: "Unattended mode (auto-approve investigator commands)",
              describedBy: "sr-unattended-risk"
            }
          ),
          /* @__PURE__ */ t("span", { className: "text-sm", children: "Unattended mode (auto-approve investigator commands)" })
        ] }),
        /* @__PURE__ */ t("p", { id: "sr-unattended-risk", className: "text-xs text-muted mt-1", children: "Risk: anyone in a watched channel can write text the crew reads, so a crafted message could steer a command nobody reviews." }),
        /* @__PURE__ */ t(
          C,
          {
            primary: !0,
            className: "mt-3",
            disabled: !!n,
            onClick: () => a("Save crew", () => o.put(`${A}/crew`, { agent: E, model: h, unattended: N })),
            children: "Save crew"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  Dt as default
};
