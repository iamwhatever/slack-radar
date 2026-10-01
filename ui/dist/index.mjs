import { jsxs as r, Fragment as A, jsx as t } from "react/jsx-runtime";
import * as _e from "@kirocrew/app-sdk";
import { useAppApi as le, ChatEmbed as Qe } from "@kirocrew/app-sdk";
import { PageHeader as Xe, Toggle as Fe, Btn as D, Card as G, CardTitle as re, StatCard as pe, Input as te, EmptyState as Je, Badge as Q } from "@kirocrew/app-sdk/ui";
import { useState as u, useCallback as ye, useEffect as ae, useRef as oe, useMemo as ue } from "react";
const O = "/api/apps/slack-radar", Ve = {
  checking: "checking…",
  connected: "connected",
  needs_login: "sign in again",
  binary_not_found: "not installed",
  incompatible: "missing read access",
  error: "not working"
}, Se = ["What needs me today?", "Draft today's digest", "Which threads look resolved?"], Ze = [
  { id: "board", label: "Board" },
  { id: "ledger", label: "Ledger" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" }
], de = (e) => e ? new Date(e * 1e3).toLocaleString() : "never";
function Z(e) {
  if (!e) return "never";
  const n = Math.max(0, Date.now() / 1e3 - e);
  return n < 90 ? "just now" : n < 3600 ? `${Math.round(n / 60)} min ago` : n < 86400 ? `${Math.round(n / 3600)} h ago` : de(e);
}
function Ie(e, n) {
  return n === "needs_login" ? "needs_login" : (e == null ? void 0 : e.status) || "checking";
}
function ve({ children: e, summary: n = "Details" }) {
  return /* @__PURE__ */ r("details", { className: "text-xs text-muted", style: { marginTop: 6 }, children: [
    /* @__PURE__ */ t("summary", { style: { cursor: "pointer" }, children: n }),
    /* @__PURE__ */ t("div", { style: { marginTop: 4 }, children: e })
  ] });
}
const ce = [
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
  return (a = e.now) == null ? void 0 : a.members.find((i) => i.id === n);
};
function ie(e, n) {
  var l;
  const a = he(n, e.id);
  if (e.id === "lead")
    return (a == null ? void 0 : a.state) === "paused" || !n.crew.live ? { label: "paused", tone: "muted" } : (a ? a.state === "working" : n.crew.running) ? { label: "working", tone: "aim" } : { label: "live", tone: "ok" };
  if (e.id === "poller")
    return n.source_state === "needs_login" ? { label: "sign in again", tone: "warn" } : (a == null ? void 0 : a.state) === "paused" ? { label: "paused", tone: "warn" } : { label: `polled ${Z(n.last_poll_at)}`, tone: "muted" };
  const i = a ? a.count : e.id === "investigator" && ((l = n.investigations) == null ? void 0 : l.running) || 0;
  return i ? { label: `${i} running`, tone: "aim" } : (a == null ? void 0 : a.state) === "planned" ? { label: "not started yet", tone: "muted" } : { label: "idle", tone: "muted" };
}
function ne(e) {
  if (!e) return "--";
  const n = new Date(e * 1e3), a = n.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: !1 });
  return n.toDateString() === (/* @__PURE__ */ new Date()).toDateString() ? a : `${n.toLocaleDateString([], { month: "short", day: "numeric" })} ${a}`;
}
function et(e) {
  if (!e) return "";
  const n = Math.round(e - Date.now() / 1e3);
  return n <= 0 ? "now" : Oe(Date.now() / 1e3 - n);
}
function tt(e, n) {
  if (!(n != null && n.last)) return "";
  const { started_at: a, finished_at: i } = n.last;
  if (e.id === "poller") {
    if (!a) return "has not polled yet";
    const l = et(n.next_at);
    return `last ${ne(a)}${l ? ` · next ${l === "now" ? "due now" : `in ${l}`}` : ""}`;
  }
  return e.id === "lead" ? a ? `last wake ${ne(a)}` : "not woken yet" : a ? i ? `last run ${ne(a)}–${ne(i)}` : `last run ${ne(a)}` : "last run --";
}
function nt(e) {
  var n, a;
  return !(e != null && e.ran) || e.ran === "running" ? "" : e.ran === "never" ? "never ran" : `idle since ${ne(((n = e.last) == null ? void 0 : n.finished_at) || ((a = e.last) == null ? void 0 : a.started_at))}`;
}
function Oe(e) {
  if (!e) return "";
  const n = Math.max(0, Math.round(Date.now() / 1e3 - e));
  return n < 90 ? `${n}s` : n < 90 * 60 ? `${Math.round(n / 60)}m` : `${Math.round(n / 3600)}h`;
}
const we = (e, n = 60) => e.length > n ? `${e.slice(0, n - 1).trimEnd()}…` : e;
function $e(e, n) {
  const a = he(n, e.id);
  if (!a) return ie(e, n).label;
  const i = tt(e, a);
  return e.id === "poller" ? i && a.state === "paused" ? `${a.doing.split(" · ")[0]} · ${i}` : i || a.doing : a.state !== "working" ? a.state === "paused" ? `paused: ${a.doing}` : i || ie(e, n).label : e.id === "lead" ? `working: ${a.doing}` : `${a.count} running: ${a.doing}`;
}
const at = `@keyframes slack-radar-pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.7) } }
.sr-pulse { animation: slack-radar-pulse 1.4s ease-in-out infinite }
@keyframes slack-radar-spin { to { transform: rotate(360deg) } }
.sr-spin { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: slack-radar-spin .8s linear infinite; vertical-align: -1px; margin-right: 6px }
@media (prefers-reduced-motion: reduce) { .sr-pulse, .sr-spin { animation: none } }`;
function Ee({ tone: e, pulse: n }) {
  return /* @__PURE__ */ t(
    "i",
    {
      "aria-hidden": !0,
      className: n ? "sr-pulse" : void 0,
      style: { width: 8, height: 8, borderRadius: "50%", flex: "none", display: "inline-block", background: Pe[e] }
    }
  );
}
function Be({ m: e, state: n, withName: a = !0, withResting: i = !1, onOpen: l }) {
  const c = ie(e, n), h = he(n, e.id), p = h ? h.state === "working" : c.tone === "aim", S = i && (e.id === "investigator" || e.id === "watcher") ? nt(h) : "", g = S ? `${S} · ${$e(e, n)}` : $e(e, n), $ = e.id === "lead" && n.crew.name || e.title, _ = /* @__PURE__ */ r(A, { children: [
    /* @__PURE__ */ t(Ee, { tone: c.tone, pulse: p }),
    a && /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: $ }),
    /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: we(g) })
  ] }), k = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    fontSize: 13,
    opacity: p || c.tone === "warn" ? 1 : 0.6,
    color: "var(--text)"
  }, y = { title: `${$} · ${g}`, "data-member": e.id, "data-state": (h == null ? void 0 : h.state) || (p ? "working" : "idle") };
  return l ? /* @__PURE__ */ t(
    "button",
    {
      type: "button",
      onClick: l,
      ...y,
      "aria-label": `${$}: ${g}. Show activity`,
      style: { ...k, background: "transparent", border: 0, padding: 0, cursor: "pointer" },
      children: _
    }
  ) : /* @__PURE__ */ t("span", { ...y, style: k, children: _ });
}
function rt({ state: e, onOpenActivity: n }) {
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
        ce.map((a) => /* @__PURE__ */ t(
          Be,
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
function st({ state: e }) {
  const n = ce.filter((a) => a.id === "investigator" || a.id === "watcher").map((a) => ({ m: a, row: he(e, a.id) })).filter(({ row: a }) => (a == null ? void 0 : a.state) === "working");
  return n.length ? /* @__PURE__ */ t("div", { "data-testid": "chat-running", style: { padding: "6px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" }, children: n.map(({ m: a, row: i }) => {
    const l = Oe(i.since), c = `${a.title} running${i.count > 1 ? ` (${i.count})` : ""} · ${i.doing}${l ? ` · ${l}` : ""}`;
    return /* @__PURE__ */ r("div", { className: "text-xs flex items-center gap-2", title: c, style: { minWidth: 0 }, children: [
      /* @__PURE__ */ t(Ee, { tone: "aim", pulse: !0 }),
      /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: c })
    ] }, a.id);
  }) }) : null;
}
const Pe = {
  ok: "var(--ok)",
  aim: "var(--aim)",
  warn: "var(--warn)",
  muted: "var(--muted-strong)"
};
function ke({ m: e, s: n, selected: a, size: i = 32 }) {
  const l = ie(e, n), c = e.planned || e.id === "poller", h = {
    width: i,
    height: i,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    fontWeight: 700,
    position: "relative",
    flex: "none",
    background: c ? "transparent" : "var(--bg-hover)",
    color: c ? "var(--muted)" : "var(--text-strong)",
    border: `2px ${c ? "dashed" : "solid"} ${a ? "var(--accent)" : c ? "var(--border-strong)" : "transparent"}`,
    opacity: e.planned ? 0.6 : 1
  };
  return /* @__PURE__ */ r("span", { style: h, "aria-hidden": !0, children: [
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
          background: Pe[l.tone]
        }
      }
    )
  ] });
}
function it(e) {
  return e === "new" ? "warn" : e === "investigating" ? "aim" : e === "resolved" ? "ok" : "muted";
}
function lt({ tab: e, setTab: n }) {
  return /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Slack Radar sections", style: { display: "flex", gap: 4 }, children: Ze.map((a) => {
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
function ot({
  state: e,
  configured: n,
  busy: a,
  onStart: i,
  onPause: l
}) {
  const c = e.crew.live;
  return /* @__PURE__ */ r("div", { className: "flex items-center gap-2", title: !c && !n ? "Add a channel in Settings first" : void 0, children: [
    /* @__PURE__ */ t("span", { className: "text-sm", children: "Crew" }),
    /* @__PURE__ */ t(
      Fe,
      {
        checked: c,
        disabled: !!a || !c && !n,
        onChange: (p) => p ? i() : l(),
        label: c ? "Pause the crew" : "Start the crew"
      }
    ),
    /* @__PURE__ */ r("span", { className: "text-xs text-muted", title: "Whether the crew's commands run without asking you", children: [
      "Unattended: ",
      e.crew.trusted ? "on" : "off"
    ] })
  ] });
}
function Kt() {
  const e = le(), [n, a] = u("board"), [i, l] = u(null), [c, h] = u([]), [p, S] = u(null), [g, $] = u([]), [_, k] = u([]), [y, x] = u("open"), [f, b] = u(/* @__PURE__ */ new Set()), [E, W] = u(""), [d, L] = u(""), [F, C] = u(null), [v, m] = u(null), [T, N] = u(null), w = ye(async () => {
    try {
      C(await e.get(`${O}/mcp/status`));
    } catch (o) {
      C({ status: "error", command: "", detail: o.message });
    }
  }, [e]);
  ae(() => {
    w();
  }, [w]);
  const B = ye(async () => {
    var o;
    try {
      const [R, I, M, U, se] = await Promise.all([
        e.get(`${O}/state`),
        e.get(`${O}/items?status=${encodeURIComponent(y)}&limit=300`),
        e.get(`${O}/events?limit=150`),
        e.get(`${O}/needs`),
        e.get(`${O}/items?handled=1&limit=100`)
      ]);
      l(R), m(((o = R.now) == null ? void 0 : o.members) || null), h(I.items), S(U), $(se.items), k(M.events.slice().reverse());
    } catch (R) {
      L(`Could not load: ${R.message}`);
    }
  }, [e, y]);
  ae(() => {
    B();
    const o = window.setInterval(B, 3e4);
    return () => window.clearInterval(o);
  }, [B]);
  const X = !!(v != null && v.some((o) => o.state === "working")), Y = oe("");
  ae(() => {
    if (!X) return;
    const o = async () => {
      try {
        const I = await e.get(`${O}/now`);
        m(I.members);
        const M = I.members.map((U) => `${U.id}:${U.state}:${U.count}`).join(",");
        if (Y.current && M !== Y.current) {
          const U = await e.get(`${O}/events?limit=150`);
          k(U.events.slice().reverse());
        }
        Y.current = M;
      } catch {
      }
    }, R = window.setInterval(o, 5e3);
    return () => window.clearInterval(R);
  }, [X, e]);
  const P = ue(() => i && v ? { ...i, now: { members: v } } : i, [i, v]), q = () => {
    N(["member", "crew", "investigate"]), a("activity");
  }, j = async (o, R) => {
    W(o), L("");
    try {
      await R(), L(`${o}: done`), await B();
    } catch (I) {
      L(`${o} failed: ${I.message}`);
    } finally {
      W("");
    }
  }, H = !!i && i.settings.channels.length > 0, K = (i == null ? void 0 : i.settings.channels.length) || 0, J = i ? `${K ? `Watching ${K} channel${K === 1 ? "" : "s"}` : "No channels yet"} · ${i.crew.live ? "running" : "paused"}` : "A small crew triaging your Slack channels", V = i ? Ie(F, i.source_state) : "checking", s = () => {
    w(), B();
  };
  return /* @__PURE__ */ r(A, { children: [
    /* @__PURE__ */ t(
      Xe,
      {
        title: "Slack Radar",
        subtitle: J,
        actions: /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-4", children: [
          /* @__PURE__ */ t(
            lt,
            {
              tab: n,
              setTab: (o) => {
                N(null), a(o);
              }
            }
          ),
          i && /* @__PURE__ */ t(
            ot,
            {
              state: i,
              configured: H,
              busy: E,
              onStart: () => j("Start crew", () => e.post(`${O}/crew/start`, {})),
              onPause: () => j("Pause crew", () => e.post(`${O}/crew/pause`, {}))
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ t("style", { children: at }),
    /* @__PURE__ */ r("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      P && n === "board" && /* @__PURE__ */ t(rt, { state: P, onOpenActivity: q }),
      i && V === "needs_login" && /* @__PURE__ */ t(dt, { mcp: F, sourceError: i.source_error, busy: E, onCheck: s }),
      d && /* @__PURE__ */ t("p", { role: "status", className: "text-sm text-muted mb-3", children: d }),
      P ? n === "board" ? /* @__PURE__ */ t(
        ct,
        {
          state: P,
          needs: p,
          handled: g,
          configured: H,
          mcp: F,
          busy: E,
          onPoll: () => j("Poll", () => e.post(`${O}/poll`, {})),
          onStart: () => j("Start crew", () => e.post(`${O}/crew/start`, {})),
          onDigest: () => j("Digest now", () => e.post(`${O}/digest/request`, {})),
          events: _,
          onChanged: B
        }
      ) : n === "ledger" ? /* @__PURE__ */ t(
        Wt,
        {
          state: P,
          items: c,
          filter: y,
          setFilter: x,
          selected: f,
          setSelected: b,
          busy: E,
          onInvestigate: (o) => j("Investigate", async () => {
            await e.post(`${O}/investigate`, { keys: [...f], repo: o }), b(/* @__PURE__ */ new Set());
          })
        }
      ) : n === "team" ? /* @__PURE__ */ t(Et, { state: P }) : n === "activity" ? /* @__PURE__ */ t(Bt, { events: _, kinds: T, onShowAll: () => N(null) }) : /* @__PURE__ */ t(Pt, { state: P, busy: E, act: j, mcp: F, onProbe: w }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" })
    ] })
  ] });
}
function Me({ mcp: e, sourceError: n }) {
  var i;
  const a = [
    (e == null ? void 0 : e.status) && `status: ${e.status}`,
    (e == null ? void 0 : e.command) && `command: ${e.command}`,
    n && `error: ${n}`,
    (e == null ? void 0 : e.detail) && e.detail !== n && `detail: ${e.detail}`,
    ((i = e == null ? void 0 : e.missing_read_tools) == null ? void 0 : i.length) && `missing read tools: ${e.missing_read_tools.join(", ")}`
  ].filter(Boolean);
  return a.length ? /* @__PURE__ */ t(ve, { children: /* @__PURE__ */ t("pre", { className: "font-mono whitespace-pre-wrap", style: { margin: 0 }, children: a.join(`
`) }) }) : null;
}
function dt({ mcp: e, sourceError: n, busy: a, onCheck: i }) {
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
          /* @__PURE__ */ t(D, { primary: !0, onClick: i, disabled: !!a, children: "I signed in, check again" })
        ] }),
        /* @__PURE__ */ t(Me, { mcp: e, sourceError: n })
      ]
    }
  );
}
function ze({ mcp: e, state: n, withPoll: a, action: i }) {
  const l = Ie(e, n.source_state), c = l === "connected";
  return /* @__PURE__ */ r("div", { className: i ? "mb-3" : "mb-4", "data-testid": i ? "connection-line" : void 0, children: [
    /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ r("p", { role: "status", className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { margin: 0, flex: 1, minWidth: 0 }, children: [
        /* @__PURE__ */ t("span", { "aria-hidden": !0, style: { width: 8, height: 8, borderRadius: "50%", background: c ? "var(--ok)" : l === "checking" ? "var(--muted-strong)" : "var(--warn)", display: "inline-block" } }),
        /* @__PURE__ */ r("span", { children: [
          "Slack connection: ",
          /* @__PURE__ */ t("span", { style: { color: c ? "var(--text)" : "var(--warn)" }, children: Ve[l] || l })
        ] }),
        a && /* @__PURE__ */ r("span", { children: [
          "· last poll ",
          Z(n.last_poll_at),
          n.settings.channels.length > 0 && /* @__PURE__ */ r(A, { children: [
            " · watching ",
            n.settings.channels.join(", ")
          ] })
        ] })
      ] }),
      i
    ] }),
    !c && l !== "needs_login" && /* @__PURE__ */ t(Me, { mcp: e, sourceError: n.source_error })
  ] });
}
function ct(e) {
  const { state: n } = e, [a, i] = u(""), [l, c] = It(n.crew.slot_key), h = oe(null), p = (S) => {
    i(ht(S)), c(!0), window.requestAnimationFrame(() => {
      var g;
      return (g = h.current) == null ? void 0 : g.scrollIntoView({ block: "end", behavior: "smooth" });
    });
  };
  return /* @__PURE__ */ r("div", { "data-testid": "board", style: { minWidth: 0 }, children: [
    /* @__PURE__ */ t(
      ze,
      {
        mcp: e.mcp,
        state: n,
        withPoll: !0,
        action: /* @__PURE__ */ t(D, { style: z, onClick: e.onPoll, disabled: !!e.busy || !e.configured, children: "Poll now" })
      }
    ),
    !e.configured && /* @__PURE__ */ r(G, { className: "mb-4", children: [
      /* @__PURE__ */ t(re, { children: "Finish setup" }),
      /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite." })
    ] }),
    /* @__PURE__ */ t(At, { state: n, busy: e.busy, onDigest: e.onDigest }),
    /* @__PURE__ */ t(
      $t,
      {
        needs: e.needs,
        handled: e.handled,
        onChanged: e.onChanged,
        onWhy: p,
        investigator: he(n, "investigator")
      }
    ),
    /* @__PURE__ */ t(
      "div",
      {
        ref: h,
        "data-testid": "chat-bar",
        "data-expanded": l ? "true" : "false",
        style: { position: "sticky", bottom: 0, zIndex: 5, marginTop: 8, borderRadius: 12, boxShadow: "0 -6px 18px rgba(0,0,0,.18)" },
        children: /* @__PURE__ */ t(
          Ot,
          {
            state: n,
            events: e.events,
            configured: e.configured,
            busy: e.busy,
            expanded: l,
            setExpanded: c,
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
const Ce = {
  decide: "Needs a decision",
  unanswered: "Questions nobody answered",
  clusters: "Reported more than once"
};
function Te(e) {
  return e < 1 ? `${Math.max(1, Math.round(e * 60))} min ago` : e < 48 ? `${Math.round(e)} h ago` : `${Math.floor(e / 24)} days ago`;
}
const Re = 5;
function ht(e) {
  return `Why is "${e.summary.length > 80 ? `${e.summary.slice(0, 79)}…` : e.summary}" ${e.priority || "on my list"}?`;
}
function je(e) {
  return e ? /* @__PURE__ */ t(Q, { variant: e === "p0" || e === "p1" ? "err" : "muted", children: e }) : null;
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
        /* @__PURE__ */ t(D, { onClick: n, children: "Try again" })
      ]
    }
  );
}
const z = { fontSize: 12, padding: "2px 10px" }, fe = (e) => e.category === "bug-report" || e.category === "feature-request", We = (e) => (e.links_count || 0) > 0 || !!e.investigation && e.status !== "investigating", Ne = (e, n) => e === "decide" && !!n.reply_draft && !n.handoff_title;
function He(e, n, a = !1) {
  return e === "decide" && (n.dispatch || a) ? "Done" : e === "decide" && n.handoff_title ? "Dispatch fix" : Ne(e, n) ? "Open" : e === "decide" && n.reason.startsWith("Looks resolved") ? "Done" : e === "unanswered" && n.permalink ? "Reply" : e === "clusters" ? We(n) && fe(n) && !n.handoff_title && !n.reply_draft ? "Ask lead" : "Investigate" : fe(n) && !We(n) ? "Investigate" : fe(n) && !n.handoff_title && !n.reply_draft ? "Ask lead" : (n.category === "question" || n.category === "already-answered") && !n.reply_draft ? "Open" : "";
}
const pt = (e, n) => !!e.investigation && !e.links_count && e.status === "investigating" && (n == null ? void 0 : n.state) === "working", ut = (e) => {
  var n;
  return (n = e.members) != null && n.length ? e.members : [e.key];
};
function me(e) {
  return e.replace(/<([@#!])([^>|]+)\|([^>]+)>/g, (n, a, i, l) => `${a === "#" ? "#" : "@"}${l}`).replace(/<([@#!])([^>|]+)>/g, (n, a, i) => `${a === "#" ? "#" : "@"}${i}`).replace(/<([^>|]+)\|([^>]+)>/g, "$2").replace(/<([^>]+)>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
const Ke = (e, n = 90) => we(me(e).split(`
`).map((a) => a.trim()).find(Boolean) || "", n), mt = (e) => new Date(e * 1e3).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), gt = 3600, Le = (e, n, a) => `${e} ${e === 1 ? n : a}`;
function Ue({ ts: e }) {
  const n = Number(e || 0);
  return n ? /* @__PURE__ */ r("span", { "data-testid": "last-reply", children: [
    " · replies · last ",
    ne(n)
  ] }) : null;
}
function ft(e) {
  var i;
  if (e.pr_url) return { url: e.pr_url, n: e.pr_number };
  const n = ((i = e.pr_urls) == null ? void 0 : i[0]) || "", a = /\/pull\/(\d+)/.exec(n);
  return { url: n, n: a ? Number(a[1]) : 0 };
}
function yt(e, n) {
  var i;
  const a = e.dispatch;
  return a ? {
    session_key: a.session_key,
    title: a.title,
    batch: a.batch && ((i = a.batch_keys) == null ? void 0 : i.length) || 0,
    state: a.state,
    pr_url: a.pr_url,
    pr_number: a.pr_number,
    trusted: a.trusted,
    pr_state: a.pr_state,
    pr_urls: a.pr_urls
  } : n || null;
}
function xt({
  e,
  groupId: n,
  first: a,
  onOpen: i,
  onMark: l,
  onDispatch: c,
  busy: h,
  fix: p,
  sentHere: S,
  failed: g,
  excluded: $,
  onExclude: _,
  investigator: k,
  investigate: y,
  ask: x
}) {
  var K, J, V;
  const f = n === "decide" ? yt(e, S) : null, b = He(n, e, !!f), E = Ne(n, e), [W, d] = u(!1), L = `sr-fix-${e.key.replace(/[^A-Za-z0-9]/g, "-")}`, F = `${n}:${e.key}`, C = ut(e), v = pt(e, k), m = b === "Investigate" && (v || !!(y != null && y.busy.has(F)) || !!(y != null && y.asked.has(F))), T = b === "Ask lead" && (!!e.reanalyze_in_flight || !!(x != null && x.inFlight) && (x == null ? void 0 : x.lastFrom) === F), N = ((K = y == null ? void 0 : y.failed) == null ? void 0 : K.from) === F ? y.failed : null, w = ((J = x == null ? void 0 : x.failed) == null ? void 0 : J.from) === F ? x.failed : null, B = e.links || [], X = () => {
    b === "Dispatch fix" ? c == null || c() : b === "Done" ? l("done") : b === "Reply" && e.permalink ? window.open(e.permalink, "_blank", "noopener,noreferrer") : b === "Investigate" ? y == null || y.run(C, F) : b === "Ask lead" ? x == null || x.run(C.slice(0, Nt), F) : i();
  }, Y = m ? "Investigating…" : T ? "Lead thinking…" : b, P = h || m || b === "Ask lead" && (T || !!(x != null && x.busy) || !!(x != null && x.inFlight)), q = ((V = f == null ? void 0 : f.pr_state) == null ? void 0 : V.state) === "merged", j = f && !q && xe[f.state] || "", H = f ? q ? ft(f) : { url: f.pr_url, n: f.pr_number } : { url: "", n: 0 };
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
        /* @__PURE__ */ t("div", { style: { flex: "none", minWidth: 28 }, children: je(e.priority) }),
        /* @__PURE__ */ r("div", { style: { minWidth: 0, flex: 1 }, children: [
          /* @__PURE__ */ t(
            "button",
            {
              type: "button",
              "data-testid": "need-open",
              onClick: i,
              title: "Open the message and its thread",
              style: { border: 0, background: "transparent", padding: 0, margin: 0, textAlign: "left", cursor: "pointer", width: "100%", color: "inherit", font: "inherit" },
              children: E ? /* @__PURE__ */ r(A, { children: [
                /* @__PURE__ */ r("div", { style: { color: "var(--text-strong)" }, children: [
                  /* @__PURE__ */ t("span", { "data-testid": "reply-ready", children: /* @__PURE__ */ t(Q, { variant: "aim", children: "Reply ready" }) }),
                  " ",
                  e.reply_draft_stale && /* @__PURE__ */ r(A, { children: [
                    /* @__PURE__ */ t("span", { "data-testid": "draft-stale", children: /* @__PURE__ */ r(Q, { variant: "warn", children: [
                      Le(e.reply_draft_stale.new_replies, "new reply", "new replies"),
                      " since draft"
                    ] }) }),
                    " "
                  ] }),
                  /* @__PURE__ */ t("span", { "data-testid": "need-first-line", children: Ke(e.text || e.summary) || "(no text)" })
                ] }),
                /* @__PURE__ */ r("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
                  e.user || "someone",
                  " · ",
                  /* @__PURE__ */ t("span", { "data-testid": "need-age", children: Te(e.age_hours) })
                ] })
              ] }) : /* @__PURE__ */ r(A, { children: [
                /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
                /* @__PURE__ */ r("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
                  e.reason,
                  " · ",
                  /* @__PURE__ */ t("span", { "data-testid": "need-age", children: Te(e.age_hours) })
                ] })
              ] })
            }
          ),
          v && /* @__PURE__ */ r("div", { className: "text-xs", role: "status", style: { marginTop: 2 }, "data-testid": "row-investigating", children: [
            /* @__PURE__ */ t("span", { style: { color: "var(--text-strong)" }, children: "Investigator" }),
            " · running · since ",
            ne(e.investigation_at || (k == null ? void 0 : k.since))
          ] }),
          !v && !f && (e.links_count || 0) > 0 && /* @__PURE__ */ r("div", { className: "text-xs", role: "status", style: { marginTop: 2 }, "data-testid": "row-investigated", children: [
            /* @__PURE__ */ t("span", { style: { color: "var(--text-strong)" }, children: "Investigated" }),
            " · ",
            Le(e.links_count || 0, "link", "links")
          ] }),
          N && /* @__PURE__ */ t(ee, { message: N.why, onRetry: () => y == null ? void 0 : y.run(N.keys, F) }),
          w && /* @__PURE__ */ t(ee, { message: w.why, onRetry: () => x == null ? void 0 : x.run(w.keys, F) }),
          f && /* @__PURE__ */ r("div", { className: "text-xs", role: "status", style: { marginTop: 2 }, "data-testid": "fix-dispatched", children: [
            /* @__PURE__ */ t("span", { style: { color: "var(--text-strong)" }, children: "Dispatched" }),
            " · ",
            f.launched ? "opened in a new conductor chat" : f.batch ? `batch of ${f.batch}` : f.title || "Fix session",
            j && /* @__PURE__ */ r(A, { children: [
              " · ",
              j
            ] }),
            q && H.url && /* @__PURE__ */ r(A, { children: [
              " · ",
              /* @__PURE__ */ r("span", { "data-testid": "fix-pr-merged", children: [
                /* @__PURE__ */ r("a", { className: "underline", href: H.url, target: "_blank", rel: "noreferrer noopener", children: [
                  "PR #",
                  H.n
                ] }),
                " ",
                "merged ",
                /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "✓" })
              ] })
            ] }),
            f.session_key && /* @__PURE__ */ r(A, { children: [
              " · ",
              /* @__PURE__ */ t(be, { d: f, label: "Open session" })
            ] }),
            !q && H.url && /* @__PURE__ */ r(A, { children: [
              " · ",
              /* @__PURE__ */ r("a", { className: "underline", href: H.url, target: "_blank", rel: "noreferrer noopener", children: [
                "PR #",
                H.n
              ] }),
              /* @__PURE__ */ t(qe, { ps: f.pr_state })
            ] }),
            /* @__PURE__ */ t(Ue, { ts: e.latest_reply })
          ] }),
          f && f.trusted === !1 && (f.state === "running" || f.state === "idle") && /* @__PURE__ */ t("div", { className: "text-xs text-muted", "data-testid": "fix-untrusted", children: "Will ask you for each tool: unattended mode is off." }),
          g && !f && /* @__PURE__ */ t(ee, { message: `Could not dispatch that fix: ${g}. Nothing was sent.`, onRetry: () => c == null ? void 0 : c() }),
          !p && W && /* @__PURE__ */ t(
            "div",
            {
              id: L,
              "data-testid": "row-preview",
              className: "text-xs",
              style: { marginTop: 6, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6 },
              children: B.length > 0 ? /* @__PURE__ */ r("ul", { "data-testid": "row-links", style: { margin: 0, padding: 0, listStyle: "none" }, children: [
                B.map((s) => /* @__PURE__ */ t("li", { style: { overflowWrap: "anywhere" }, children: /* @__PURE__ */ t("a", { className: "underline", href: s, target: "_blank", rel: "noreferrer noopener", children: s.replace(/^https:\/\/github\.com\//, "") }) }, s)),
                (e.links_count || 0) > B.length && /* @__PURE__ */ r("li", { className: "text-muted", children: [
                  "and ",
                  (e.links_count || 0) - B.length,
                  " more"
                ] })
              ] }) : /* @__PURE__ */ r("div", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 160, overflowY: "auto" }, children: [
                e.category && /* @__PURE__ */ r("span", { className: "text-muted", children: [
                  e.category,
                  " · "
                ] }),
                we(me(e.text || e.summary), 400) || "(no text)"
              ] })
            }
          ),
          p && W && /* @__PURE__ */ r(
            "div",
            {
              id: L,
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
                _ && /* @__PURE__ */ r("label", { className: "flex items-center gap-1", style: { marginTop: 6, cursor: "pointer" }, children: [
                  /* @__PURE__ */ t("input", { type: "checkbox", checked: !!$, onChange: (s) => _(s.target.checked) }),
                  "Exclude from batch"
                ] })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ t("div", { className: "flex items-center gap-1", style: { flex: "none" }, "data-testid": "need-actions", children: b && /* @__PURE__ */ t(D, { primary: !0, style: z, onClick: X, disabled: P, "data-primary": b, children: b === "Dispatch fix" && h || m || T ? /* @__PURE__ */ r(A, { children: [
          /* @__PURE__ */ t("span", { className: "sr-spin", "aria-hidden": !0 }),
          b === "Dispatch fix" ? "Dispatching…" : Y
        ] }) : b }) }),
        /* @__PURE__ */ t(
          "button",
          {
            type: "button",
            "data-testid": p ? "fix-toggle" : "row-toggle",
            "aria-expanded": W,
            "aria-controls": L,
            "aria-label": p ? W ? "Hide the fix" : "Show the fix" : B.length ? W ? "Hide the links" : "Show the links" : W ? "Hide the message" : "Show the message",
            onClick: () => d(!W),
            style: { flex: "none", border: 0, background: "transparent", cursor: "pointer", padding: "2px 4px", color: "var(--muted)" },
            children: W ? "▴" : "▾"
          }
        )
      ] })
    }
  );
}
function bt({
  e,
  groupId: n,
  onClose: a,
  onSend: i,
  onMark: l,
  onWhy: c,
  onDispatch: h,
  busy: p,
  sentHere: S,
  reanalyze: g
}) {
  var V;
  const $ = Ne(n, e), _ = He(n, e, S), [k, y] = u(e.reply_draft || ""), [x, f] = u(!1), [b, E] = u(null), [W, d] = u(""), L = oe(null), F = oe(null), C = oe(null), v = e.key.replace(/[^A-Za-z0-9]/g, "-"), m = `sr-detail-${v}`, T = `sr-reply-${v}`, N = e.replies || [], w = e.reply_draft_at || 0, B = (s) => !!e.reply_draft && w > 0 && Number(s.ts) > w, X = ((V = e.reply_draft_stale) == null ? void 0 : V.new_replies) || 0, Y = e.last_thread_check_at || 0, P = Y > 0 && Date.now() / 1e3 - Y > gt;
  ae(() => {
    const s = document.activeElement;
    return window.requestAnimationFrame(() => {
      var o;
      return (o = $ ? F.current : C.current) == null ? void 0 : o.focus();
    }), () => {
      s && s.isConnected && s.focus();
    };
  }, []);
  const q = async () => {
    const s = k.trim();
    d(""), f(!0);
    const o = await i(s, s !== (e.reply_draft || "").trim());
    f(!1), o.ok ? E(o.link) : d(o.why);
  }, j = (s) => {
    if (s.key === "Escape") {
      s.stopPropagation(), a();
      return;
    }
    if (s.key !== "Tab" || !L.current) return;
    const o = [...L.current.querySelectorAll("a[href], button:not([disabled]), textarea, input, select")];
    if (o.length === 0) return;
    const R = o[0], I = o[o.length - 1];
    s.shiftKey && document.activeElement === R ? (s.preventDefault(), I.focus()) : !s.shiftKey && document.activeElement === I && (s.preventDefault(), R.focus());
  }, H = (s) => () => {
    s(), a();
  }, K = { marginTop: 14 }, J = { margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "var(--text-strong)" };
  return /* @__PURE__ */ t(
    "div",
    {
      "data-testid": "need-detail-backdrop",
      onMouseDown: (s) => s.target === s.currentTarget && a(),
      style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.35)", display: "flex", justifyContent: "flex-end" },
      children: /* @__PURE__ */ r(
        "div",
        {
          ref: L,
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": m,
          "data-testid": "need-detail",
          onKeyDown: j,
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
              /* @__PURE__ */ t("div", { style: { flex: "none" }, children: je(e.priority) }),
              /* @__PURE__ */ t("h3", { id: m, style: { margin: 0, flex: 1, fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }, children: Ke(e.text || e.summary, 80) || "(no text)" }),
              /* @__PURE__ */ t(
                "button",
                {
                  ref: C,
                  type: "button",
                  "aria-label": "Close",
                  onClick: a,
                  style: { border: 0, background: "transparent", cursor: "pointer", padding: "0 6px", fontSize: 18, lineHeight: 1, color: "var(--muted)" },
                  children: "×"
                }
              )
            ] }),
            /* @__PURE__ */ r("section", { "aria-label": "Original message", "data-testid": "detail-original", style: K, children: [
              /* @__PURE__ */ t("h4", { style: J, children: "Original message" }),
              /* @__PURE__ */ r("div", { className: "text-xs text-muted", children: [
                /* @__PURE__ */ t("span", { "data-testid": "detail-author", children: e.user || "someone" }),
                " · ",
                /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
                " · ",
                de(e.ts_float),
                e.permalink && /* @__PURE__ */ r(A, { children: [
                  " · ",
                  /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open in Slack" })
                ] })
              ] }),
              /* @__PURE__ */ t("p", { style: { margin: "6px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }, "data-testid": "detail-text", children: me(e.text || e.summary) || "(no text)" })
            ] }),
            /* @__PURE__ */ r("section", { "aria-label": "Thread replies", "data-testid": "detail-replies", style: K, children: [
              /* @__PURE__ */ r("h4", { style: J, children: [
                "Thread replies (",
                N.length,
                ")",
                P && /* @__PURE__ */ r("span", { className: "text-xs text-muted", style: { fontWeight: 400 }, "data-testid": "replies-stale", children: [
                  " · ",
                  "replies as of ",
                  mt(Y)
                ] })
              ] }),
              N.length === 0 ? /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: 0 }, children: "No replies yet" }) : /* @__PURE__ */ t("ol", { className: "flex flex-col", style: { margin: 0, padding: 0, listStyle: "none" }, children: N.map((s, o) => /* @__PURE__ */ r(
                "li",
                {
                  "data-testid": B(s) ? "reply-new" : "reply-old",
                  style: {
                    padding: B(s) ? "4px 0 4px 8px" : "4px 0",
                    borderTop: o === 0 ? 0 : "1px solid var(--border)",
                    ...B(s) ? { borderLeft: "3px solid var(--warn, #d97706)" } : {}
                  },
                  children: [
                    /* @__PURE__ */ r("div", { className: "text-xs text-muted", children: [
                      B(s) && /* @__PURE__ */ r(A, { children: [
                        /* @__PURE__ */ t(Q, { variant: "warn", children: "new" }),
                        " "
                      ] }),
                      s.user || "someone",
                      " · ",
                      de(Number(s.ts))
                    ] }),
                    /* @__PURE__ */ t("div", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" }, children: me(s.text) })
                  ]
                },
                `${s.ts}-${o}`
              )) })
            ] }),
            !$ && /* @__PURE__ */ r("section", { "aria-label": "Why it is here", style: K, className: "text-xs text-muted", children: [
              e.reason,
              e.category && /* @__PURE__ */ r(A, { children: [
                " · ",
                e.category
              ] }),
              e.words && e.words.length > 0 && /* @__PURE__ */ r(A, { children: [
                " · shared words: ",
                e.words.join(", ")
              ] }),
              e.members && e.members.length > 0 && /* @__PURE__ */ r(A, { children: [
                " · Done and Ignore apply to all ",
                e.members.length
              ] }),
              e.handoff_title && !e.dispatch && !S && /* @__PURE__ */ r("div", { style: { marginTop: 4, color: "var(--text)" }, children: [
                "Fix: ",
                e.handoff_title
              ] })
            ] }),
            $ && /* @__PURE__ */ r("section", { "aria-label": "Reply draft", "data-testid": "detail-draft", style: K, children: [
              /* @__PURE__ */ t("label", { htmlFor: T, style: { ...J, display: "block" }, children: "Reply to the thread, sent as you" }),
              /* @__PURE__ */ r("div", { className: "text-xs text-muted", "data-testid": "draft-by", children: [
                e.reply_draft_by === "owner" ? "Edited by you" : "Drafted by the Radar Lead",
                e.reply_draft_at ? ` · ${Z(e.reply_draft_at)}` : ""
              ] }),
              /* @__PURE__ */ t(
                "textarea",
                {
                  id: T,
                  ref: F,
                  value: k,
                  maxLength: 1500,
                  rows: 6,
                  readOnly: b !== null,
                  onChange: (s) => y(s.target.value),
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
            W && /* @__PURE__ */ t(ee, { message: `Could not send that reply: ${W}`, onRetry: q }),
            $ && X > 0 && b === null && /* @__PURE__ */ t("p", { role: "status", "data-testid": "draft-stale-warning", className: "text-sm", style: { ...K, marginBottom: 0, color: "var(--text-strong)" }, children: X === 1 ? "1 reply arrived after this draft — read it first" : `${X} replies arrived after this draft — read them first` }),
            e.needs_reanalysis && g && b === null && /* @__PURE__ */ r("div", { style: K, "data-testid": "detail-reanalyze", children: [
              /* @__PURE__ */ t(D, { style: z, disabled: g.busy || g.inFlight, onClick: () => g.run([e.key], e.key), children: g.inFlight || g.busy ? "Re-analyzing…" : "Re-analyze this" }),
              g.failed && g.failed.from === e.key && /* @__PURE__ */ t(ee, { message: g.failed.why, onRetry: () => g.run(g.failed.keys, e.key) })
            ] }),
            b !== null ? /* @__PURE__ */ r("div", { style: K, className: "flex flex-wrap items-center gap-2", children: [
              /* @__PURE__ */ r("p", { role: "status", style: { margin: 0, flex: 1 }, children: [
                "Sent as you",
                b && /* @__PURE__ */ r(A, { children: [
                  " · ",
                  /* @__PURE__ */ t("a", { className: "underline", href: b, target: "_blank", rel: "noreferrer noopener", "data-testid": "sent-link", children: "Open the reply in Slack" })
                ] })
              ] }),
              /* @__PURE__ */ t(D, { primary: !0, style: z, onClick: a, children: "Close" })
            ] }) : /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-1", style: K, "data-testid": "detail-actions", children: [
              $ && /* @__PURE__ */ t(D, { primary: !0, style: z, disabled: !k.trim() || x, onClick: q, children: x ? "Sending…" : "Send to thread" }),
              _ === "Dispatch fix" && /* @__PURE__ */ t(D, { primary: !0, style: z, disabled: p, onClick: H(() => h == null ? void 0 : h()), children: "Dispatch fix" }),
              _ === "Reply" && e.permalink && /* @__PURE__ */ t(D, { primary: !0, style: z, onClick: () => window.open(e.permalink, "_blank", "noopener,noreferrer"), children: "Reply" }),
              /* @__PURE__ */ t(D, { style: z, onClick: H(() => l("done")), children: $ ? "Done without sending" : "Done" }),
              /* @__PURE__ */ t(D, { style: z, onClick: H(() => l("ignored")), children: "Ignore" }),
              /* @__PURE__ */ t(D, { style: z, onClick: H(c), children: "Why? Ask the lead" })
            ] }),
            _ === "Reply" && b === null && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "6px 0 0" }, children: "Reply opens the thread in Slack." })
          ]
        }
      )
    }
  );
}
function vt({ g: e, render: n }) {
  const [a, i] = u(!1), l = a ? e.shown : e.shown.slice(0, Re), c = e.shown.length - l.length;
  return /* @__PURE__ */ r(A, { children: [
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: l.map(n) }),
    (c > 0 || a && e.shown.length > Re) && /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        className: "text-xs underline",
        onClick: () => i(!a),
        style: { border: 0, background: "transparent", cursor: "pointer", padding: "4px 0", color: "var(--muted)" },
        children: a ? "Show fewer" : `Show ${c} more`
      }
    )
  ] });
}
const Ye = typeof _e.useChatLauncher == "function" ? _e.useChatLauncher : () => null, xe = { running: "working", idle: "idle", closed: "done", unknown: "" }, wt = { open: "open", draft: "draft", closed: "closed, not merged" };
function qe({ ps: e }) {
  const n = e ? wt[e.state] : "";
  return n ? /* @__PURE__ */ r("span", { "data-testid": "fix-pr-state", children: [
    " ",
    n
  ] }) : null;
}
function be({ d: e, label: n }) {
  const a = Ye(), i = `/chat?sid=${encodeURIComponent(e.session_key)}`;
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
function ge(e) {
  try {
    return JSON.parse(String(e.body || "{}"));
  } catch {
    return {};
  }
}
function kt(e) {
  const n = le(), a = Ye(), [i, l] = u(/* @__PURE__ */ new Set()), [c, h] = u({}), [p, S] = u({}), [g, $] = u(null), [_, k] = u(null), [y, x] = u(!1), f = (m, T) => h((N) => Object.fromEntries([...Object.entries(N), ...m.map((w) => [w, T])])), b = (m, T) => S((N) => Object.fromEntries([...Object.entries(N), ...m.map((w) => [w, T])])), E = (m) => S((T) => Object.fromEntries(Object.entries(T).filter(([N]) => !m.includes(N)))), W = (m, T, N) => {
    a ? (a.openChat({ agent: m.agent, message: m.seed, autoSend: !0 }), f(T, { session_key: "", title: m.title, batch: N, state: "", pr_url: "", pr_number: 0, launched: !0 })) : (x(!1), k({ title: m.title, seed: m.seed }));
  }, d = async (m, T) => {
    if (!(i.size || m.length === 0)) {
      l(new Set(m));
      try {
        await T();
      } finally {
        l(/* @__PURE__ */ new Set());
      }
    }
  }, L = (m) => d([m], async () => {
    E([m]);
    try {
      const T = await n.post(`${O}/items/handoff/dispatch`, { key: m });
      T.mode === "server" ? f([m], { session_key: T.session_key, title: T.title, batch: 0, state: "running", pr_url: "", pr_number: 0, trusted: T.trusted }) : W(T, [m], 0), e();
    } catch (T) {
      const N = ge(T);
      N.code === "already_dispatched" && N.session_key ? f([m], { session_key: N.session_key, title: N.title || "", batch: 0, state: "", pr_url: "", pr_number: 0 }) : b([m], N.error || "the gateway refused it");
    }
  }), F = (m) => d(m, async () => {
    var T;
    $(null);
    try {
      const N = await n.post(`${O}/items/handoff/dispatch-batch`, { keys: m });
      N.mode === "server" ? f(m, { session_key: N.session_key, title: N.title, batch: m.length, state: "running", pr_url: "", pr_number: 0, trusted: N.trusted }) : W(N, m, m.length), e();
    } catch (N) {
      const w = ge(N), B = (T = w.dispatched) != null && T.length ? `${w.dispatched.length} of them already have a session` : w.error || "the gateway refused it";
      $({ keys: m, why: B });
    }
  }), C = async () => {
    if (_)
      try {
        await navigator.clipboard.writeText(_.seed), x(!0);
      } catch {
        x(!1);
      }
  }, v = _ && /* @__PURE__ */ t(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "sr-fix-title",
      style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" },
      onKeyDown: (m) => m.key === "Escape" && k(null),
      children: /* @__PURE__ */ r("div", { style: { width: "min(720px, 92vw)", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: 16 }, children: [
        /* @__PURE__ */ t("h3", { id: "sr-fix-title", className: "text-sm", style: { margin: "0 0 6px", fontWeight: 600 }, children: _.title }),
        /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 8px" }, children: "This Kiro Crew cannot open the session for you. Copy this task into a new kirocrew-conductor chat." }),
        /* @__PURE__ */ t(
          "textarea",
          {
            readOnly: !0,
            "aria-label": "Fix task",
            value: _.seed,
            style: { width: "100%", height: 260, fontSize: 12, fontFamily: "var(--font-mono, monospace)" }
          }
        ),
        /* @__PURE__ */ r("div", { className: "flex items-center gap-2", style: { marginTop: 8 }, children: [
          /* @__PURE__ */ t(D, { onClick: C, children: y ? "Copied" : "Copy task" }),
          /* @__PURE__ */ t("a", { className: "underline text-sm", href: "/chat?new=1", children: "New chat" }),
          /* @__PURE__ */ t("div", { className: "flex-1" }),
          /* @__PURE__ */ t(D, { onClick: () => k(null), children: "Close" })
        ] })
      ] })
    }
  );
  return { dispatch: L, dispatchBatch: F, busy: i, sent: c, failed: p, batchFailed: g, ui: v };
}
const De = 10, Nt = 20;
function _t(e, n) {
  var k;
  const a = le(), [i, l] = u(!1), [c, h] = u(!1), [p, S] = u(null), [g, $] = u("");
  return ae(() => h(!1), [e]), { run: async (y, x) => {
    if (!(i || y.length === 0)) {
      S(null), l(!0), $(x);
      try {
        await a.post(`${O}/items/reanalyze`, { keys: y }), h(!0), n();
      } catch (f) {
        const b = ge(f), E = b.code === "reanalyze_in_flight" ? "The Radar Lead is still re-analyzing the last request. Nothing new was sent." : `Could not ask the Radar Lead to re-analyze: ${b.error || "the gateway refused it"}. Nothing was sent.`;
        S({ keys: y, from: x, why: E });
      } finally {
        l(!1);
      }
    }
  }, busy: i, inFlight: c || !!((k = e == null ? void 0 : e.reanalyze) != null && k.in_flight), lastFrom: g, failed: p };
}
function St(e, n) {
  const a = le(), [i, l] = u(/* @__PURE__ */ new Set()), [c, h] = u(/* @__PURE__ */ new Set()), [p, S] = u(null);
  return ae(() => h(/* @__PURE__ */ new Set()), [e]), { run: async ($, _) => {
    if (!(i.has(_) || $.length === 0)) {
      S(null), l((k) => new Set(k).add(_));
      try {
        await a.post(`${O}/investigate`, { keys: $.slice(0, 10), repo: "" }), h((k) => new Set(k).add(_)), n();
      } catch (k) {
        const y = ge(k), x = y.code === "unattended_required" ? "Investigate needs unattended mode: turn it on on the Crew card (Team tab), then try again. Nothing was started." : `Could not start the Investigator: ${y.error || k.message || "the gateway refused it"}. Nothing was started.`;
        S({ keys: $, from: _, why: x });
      } finally {
        l((k) => {
          const y = new Set(k);
          return y.delete(_), y;
        });
      }
    }
  }, busy: i, asked: c, failed: p };
}
function $t({
  needs: e,
  handled: n,
  onChanged: a,
  onWhy: i,
  investigator: l
}) {
  var V;
  const c = le(), h = kt(a), p = _t(e, a), S = St(e, a), g = e == null ? void 0 : e.reanalyze, $ = g ? g.total > g.keys.length ? `Re-analyze ${g.keys.length} of ${g.total} stale` : `Re-analyze ${g.total} stale` : "", _ = (e == null ? void 0 : e.fixes) || [], k = (e == null ? void 0 : e.fix_batches) || [], y = new Map(k.map((s) => [s.session_key, s])), x = new Map(((e == null ? void 0 : e.handoffs) || []).map((s) => [s.key, s.handoff])), f = (s) => {
    const o = x.get(s.key);
    return s.handoff_title ? { title: s.handoff_title || (o == null ? void 0 : o.title) || "", prompt: (o == null ? void 0 : o.prompt) || "", repo: (o == null ? void 0 : o.repo) || "" } : void 0;
  }, b = (((V = ((e == null ? void 0 : e.groups) || []).find((s) => s.id === "decide")) == null ? void 0 : V.entries) || []).filter((s) => s.handoff_title && !s.dispatch && !h.sent[s.key] && x.has(s.key)).map((s) => ({ key: s.key, repo: x.get(s.key).repo || "" })), [E, W] = u(/* @__PURE__ */ new Set()), d = b.filter((s) => !E.has(s.key)), F = new Set(d.map((s) => s.repo.toLowerCase())).size > 1 ? "one repo per batch: exclude the others from their ▾" : d.length > De ? `at most ${De} per batch: exclude some from their ▾` : "", [C, v] = u(null), m = async (s, o, R, I) => {
    var M, U;
    try {
      R && await c.post(`${O}/items/reply/draft`, { key: s, text: o });
      const se = await c.post(`${O}/items/reply/send`, { key: s });
      return Y((Ge) => new Set(Ge).add(I)), a(), { ok: !0, link: String(((U = (M = se == null ? void 0 : se.item) == null ? void 0 : M.replied) == null ? void 0 : U.permalink) || "") };
    } catch (se) {
      return { ok: !1, why: se.message || "unknown error" };
    }
  }, T = (e == null ? void 0 : e.replied) || [], [N, w] = u(""), B = async (s) => {
    w("");
    try {
      await c.post(`${O}/items/handoff/dismiss`, { key: s }), a();
    } catch {
      w(s);
    }
  }, [X, Y] = u(/* @__PURE__ */ new Set()), [P, q] = u(null);
  ae(() => Y(/* @__PURE__ */ new Set()), [e]);
  const j = async (s, o, R) => {
    q(null), R && Y((I) => new Set(I).add(R));
    try {
      for (const I of s) await c.post(`${O}/items/handle`, { key: I, how: o });
      a();
    } catch {
      R && Y((I) => {
        const M = new Set(I);
        return M.delete(R), M;
      }), q({ keys: s, how: o, rowId: R });
    }
  }, H = ((e == null ? void 0 : e.groups) || []).map((s) => ({
    ...s,
    shown: s.entries.filter((o) => !X.has(`${s.id}:${o.key}`))
  })), K = H.every((s) => s.shown.length === 0), J = (P == null ? void 0 : P.how) === "reopen" ? "reopen" : (P == null ? void 0 : P.how) === "ignored" ? "ignore" : "mark as done";
  return /* @__PURE__ */ r(G, { className: "mb-4", children: [
    /* @__PURE__ */ r("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ t(re, { children: "Needs you" }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      g && (g.total > 0 || p.inFlight) && /* @__PURE__ */ t(
        D,
        {
          primary: !0,
          style: z,
          "data-testid": "reanalyze",
          title: "Ask the Radar Lead to re-read these threads and rewrite or withdraw each draft. Nothing is sent to Slack.",
          disabled: p.busy || p.inFlight || g.keys.length === 0,
          onClick: () => p.run(g.keys, "card"),
          children: p.busy || p.inFlight ? /* @__PURE__ */ r(A, { children: [
            /* @__PURE__ */ t("span", { className: "sr-spin", "aria-hidden": !0 }),
            "Re-analyzing…"
          ] }) : $
        }
      )
    ] }),
    p.failed && p.failed.from === "card" && /* @__PURE__ */ t(ee, { message: p.failed.why, onRetry: () => p.run(p.failed.keys, "card") }),
    P && /* @__PURE__ */ t(
      ee,
      {
        message: `Could not ${J} that message. Nothing changed.`,
        onRetry: () => j(P.keys, P.how, P.rowId)
      }
    ),
    e ? K ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Nothing needs you right now." }) : H.map(
      (s) => s.shown.length === 0 ? null : /* @__PURE__ */ r("section", { "aria-label": Ce[s.id], style: { marginTop: 10 }, children: [
        /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2", children: [
          /* @__PURE__ */ r("h4", { className: "text-sm", style: { margin: 0, fontWeight: 600, color: "var(--text-strong)" }, children: [
            Ce[s.id],
            " ",
            /* @__PURE__ */ r("span", { className: "text-muted", style: { fontWeight: 400 }, children: [
              "(",
              s.total - (s.entries.length - s.shown.length),
              ")"
            ] })
          ] }),
          /* @__PURE__ */ t("div", { className: "flex-1" }),
          s.id === "decide" && b.length >= 2 && /* @__PURE__ */ r(A, { children: [
            F && /* @__PURE__ */ t("span", { className: "text-xs text-muted", role: "status", children: F }),
            /* @__PURE__ */ t(
              D,
              {
                style: z,
                onClick: () => h.dispatchBatch(d.map((o) => o.key)),
                disabled: h.busy.size > 0 || d.length === 0 || !!F,
                children: d.length > 0 && h.busy.has(d[0].key) && h.busy.size > 1 ? /* @__PURE__ */ r(A, { children: [
                  /* @__PURE__ */ t("span", { className: "sr-spin", "aria-hidden": !0 }),
                  "Dispatching…"
                ] }) : `Dispatch all fixes (${d.length})`
              }
            )
          ] })
        ] }),
        s.id === "decide" && h.batchFailed && /* @__PURE__ */ t(
          ee,
          {
            message: `Could not dispatch those fixes: ${h.batchFailed.why}. Nothing was sent.`,
            onRetry: () => h.dispatchBatch(h.batchFailed.keys)
          }
        ),
        /* @__PURE__ */ t(
          vt,
          {
            g: s,
            render: (o, R) => /* @__PURE__ */ t(
              xt,
              {
                e: o,
                groupId: s.id,
                first: R === 0,
                onOpen: () => v({ e: o, groupId: s.id }),
                onMark: (I) => {
                  var M;
                  return j((M = o.members) != null && M.length ? o.members : [o.key], I, `${s.id}:${o.key}`);
                },
                onDispatch: s.id === "decide" && o.handoff_title ? () => h.dispatch(o.key) : void 0,
                busy: h.busy.has(o.key),
                fix: s.id === "decide" ? f(o) : void 0,
                sentHere: h.sent[o.key],
                failed: s.id === "decide" ? h.failed[o.key] : void 0,
                excluded: E.has(o.key),
                investigator: l,
                investigate: S,
                ask: p,
                onExclude: s.id === "decide" && b.length >= 2 && b.some((I) => I.key === o.key) ? (I) => W((M) => {
                  const U = new Set(M);
                  return I ? U.add(o.key) : U.delete(o.key), U;
                }) : void 0
              },
              o.key
            )
          }
        )
      ] }, s.id)
    ) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" }),
    N && /* @__PURE__ */ t(ee, { message: "Could not dismiss that hand-off. Nothing changed.", onRetry: () => B(N) }),
    _.length > 0 && /* @__PURE__ */ r("details", { style: { marginTop: 12 }, "data-testid": "fixes-in-flight", children: [
      /* @__PURE__ */ r("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Fixes in flight (",
        (e == null ? void 0 : e.fixes_total) ?? _.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: _.map((s, o) => {
        const R = s.dispatch.batch ? y.get(s.dispatch.session_key) : void 0, I = R && R.keys[0] === s.key, M = { padding: "6px 0", borderTop: o === 0 ? 0 : "1px solid var(--border)" }, U = s.dispatch.pr_url && /* @__PURE__ */ r(A, { children: [
          " · ",
          /* @__PURE__ */ r("a", { className: "underline", href: s.dispatch.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
            "PR #",
            s.dispatch.pr_number
          ] }),
          /* @__PURE__ */ t(qe, { ps: s.dispatch.pr_state })
        ] });
        return /* @__PURE__ */ r("li", { className: "text-sm", style: R ? { ...M, ...I ? {} : { borderTop: 0, paddingTop: 0 } } : M, children: [
          I && R && /* @__PURE__ */ r("div", { "data-testid": "fix-batch-header", style: { marginBottom: 4 }, children: [
            /* @__PURE__ */ t(be, { d: R }),
            /* @__PURE__ */ r("span", { className: "text-xs text-muted", children: [
              " · ",
              xe[R.state] || R.state || "sent",
              " · ",
              /* @__PURE__ */ t("span", { className: "font-mono", children: R.repo }),
              " · ",
              R.prs_found,
              " PRs found / ",
              R.total,
              " · ",
              Z(R.at)
            ] })
          ] }),
          /* @__PURE__ */ r("div", { className: "flex items-center gap-2", style: R ? { paddingLeft: 16 } : void 0, children: [
            /* @__PURE__ */ r("span", { style: { flex: 1, minWidth: 0 }, children: [
              R ? s.handoff_title : /* @__PURE__ */ r(A, { children: [
                /* @__PURE__ */ t(be, { d: s.dispatch }),
                /* @__PURE__ */ r("span", { className: "text-xs text-muted", children: [
                  " · ",
                  xe[s.dispatch.state] || s.dispatch.state || "sent",
                  " · ",
                  /* @__PURE__ */ t("span", { className: "font-mono", children: s.repo }),
                  " · ",
                  Z(s.dispatch.at)
                ] })
              ] }),
              U,
              /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: /* @__PURE__ */ t(Ue, { ts: s.latest_reply }) })
            ] }),
            /* @__PURE__ */ t(D, { style: z, onClick: () => B(s.key), children: "Dismiss" })
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
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: n.map((s, o) => /* @__PURE__ */ r(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: o === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 0 }, children: s.summary || s.text.slice(0, 200) }),
            /* @__PURE__ */ r("span", { className: "text-xs text-muted", children: [
              s.handled_how === "ignored" ? "Ignored" : "Done",
              " ",
              Z(s.handled_at)
            ] }),
            /* @__PURE__ */ t(D, { style: z, onClick: () => j([s.key], "reopen"), children: "Reopen" })
          ]
        },
        s.key
      )) })
    ] }),
    T.length > 0 && /* @__PURE__ */ r("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ r("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Replied (",
        (e == null ? void 0 : e.replied_total) ?? T.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: T.map((s, o) => /* @__PURE__ */ r(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: o === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ r("span", { style: { flex: 1, minWidth: 0 }, children: [
              s.text.length > 120 ? `${s.text.slice(0, 119)}…` : s.text,
              /* @__PURE__ */ r("span", { className: "text-xs text-muted", children: [
                " · ",
                s.summary,
                " · ",
                /* @__PURE__ */ t("span", { className: "font-mono", children: s.channel }),
                " · ",
                Z(s.at)
              ] })
            ] }),
            s.permalink && /* @__PURE__ */ t("a", { className: "underline text-xs", href: s.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open reply" })
          ]
        },
        s.key
      )) })
    ] }),
    C && /* @__PURE__ */ t(
      bt,
      {
        e: C.e,
        groupId: C.groupId,
        sentHere: !!h.sent[C.e.key],
        onClose: () => v(null),
        onSend: (s, o) => m(C.e.key, s, o, `${C.groupId}:${C.e.key}`),
        onMark: (s) => {
          var o;
          return j((o = C.e.members) != null && o.length ? C.e.members : [C.e.key], s, `${C.groupId}:${C.e.key}`);
        },
        onWhy: () => i(C.e),
        onDispatch: C.groupId === "decide" && C.e.handoff_title ? () => h.dispatch(C.e.key) : void 0,
        busy: h.busy.has(C.e.key),
        reanalyze: p
      },
      `${C.groupId}:${C.e.key}`
    ),
    h.ui
  ] });
}
function Ct({ it: e, first: n, checked: a, onToggle: i }) {
  var p, S;
  const l = (S = (p = e.fix_handoff) == null ? void 0 : p.pr_state) == null ? void 0 : S.state, c = l === "merged" || l === "closed" ? { label: l === "merged" ? "fix merged" : "fix PR closed", variant: l === "merged" ? "ok" : "warn" } : e.priority ? { label: e.priority, variant: e.priority === "p0" || e.priority === "p1" ? "err" : "muted" } : e.possibly_resolved ? { label: "possibly resolved", variant: "warn" } : null, h = [
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
        onChange: i,
        style: { marginTop: 4 }
      }
    ),
    /* @__PURE__ */ r("div", { className: "flex items-center gap-1", style: { flex: "none" }, children: [
      /* @__PURE__ */ t(Q, { variant: it(e.status), children: e.status }),
      c && /* @__PURE__ */ t(Q, { variant: c.variant, children: c.label }),
      h.length > 0 && /* @__PURE__ */ r("span", { className: "text-xs text-muted", title: h.join(`
`), "aria-label": h.join("; "), children: [
        "+",
        h.length
      ] })
    ] }),
    /* @__PURE__ */ r("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || e.text.slice(0, 280) }),
      /* @__PURE__ */ r("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        /* @__PURE__ */ t("span", { "data-testid": "ledger-ts", "data-ts": e.ts_float, children: Z(e.ts_float) }),
        " · ",
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        e.user && /* @__PURE__ */ r(A, { children: [
          " · ",
          e.user
        ] }),
        e.reply_count > 0 && /* @__PURE__ */ r(A, { children: [
          " · ",
          e.reply_count,
          " replies"
        ] }),
        " · ",
        /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "open in Slack" }),
        e.links.length > 0 && /* @__PURE__ */ r(A, { children: [
          " · linked ",
          e.links.map((g) => /* @__PURE__ */ t("a", { className: "underline mr-2", href: g, target: "_blank", rel: "noreferrer noopener", children: g.replace("https://github.com/", "") }, g))
        ] })
      ] }),
      e.note && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: e.note })
    ] })
  ] }) });
}
function Tt(e) {
  var n, a;
  return !!((n = e.reply_draft) != null && n.text || (a = e.fix_handoff) != null && a.prompt || e.possibly_resolved);
}
const Rt = ["", "p0", "p1", "p2", "p3", "none"];
function Wt(e) {
  const { state: n, items: a, selected: i, setSelected: l } = e, [c, h] = u(""), [p, S] = u(""), [g, $] = u(""), [_, k] = u(!1), y = n.counts.open_by_priority, x = ue(() => [...new Set(a.map((d) => d.category).filter(Boolean))].sort(), [a]), f = ue(
    () => a.filter((d) => !p || (p === "none" ? !d.priority : d.priority === p)).filter((d) => !g || d.category === g).filter((d) => !_ || Tt(d)).sort((d, L) => (L.ts_float || 0) - (d.ts_float || 0)),
    [a, p, g, _]
  ), b = (d) => {
    const L = new Set(i);
    L.has(d) ? L.delete(d) : L.add(d), l(L);
  }, E = ue(
    () => n.settings.channels.map((d) => ({ cid: d, ...n.channels[d] || {} })),
    [n]
  ), W = "text-sm bg-transparent border rounded px-2 py-1";
  return /* @__PURE__ */ r("div", { style: { minWidth: 0 }, children: [
    /* @__PURE__ */ r("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4", children: [
      /* @__PURE__ */ t(pe, { label: "Awaiting triage", value: n.counts.needs_triage, accent: !0 }),
      /* @__PURE__ */ t(pe, { label: "Possibly resolved", value: n.counts.possibly_resolved }),
      /* @__PURE__ */ t(pe, { label: "Open p0 / p1", value: `${y.p0 || 0} / ${y.p1 || 0}` }),
      /* @__PURE__ */ t(pe, { label: "Tracked items", value: n.counts.total })
    ] }),
    /* @__PURE__ */ r(G, { className: "mb-4", children: [
      /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2 mb-3", children: [
        /* @__PURE__ */ t(re, { children: "Ledger" }),
        /* @__PURE__ */ r("span", { className: "text-xs text-muted", "data-testid": "ledger-count", children: [
          f.length,
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
        /* @__PURE__ */ t("select", { id: "sr-priority", className: W, value: p, onChange: (d) => S(d.target.value), children: Rt.map((d) => /* @__PURE__ */ t("option", { value: d, children: d || "all" }, d)) }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-category", children: "Category" }),
        /* @__PURE__ */ r("select", { id: "sr-category", className: W, value: g, onChange: (d) => $(d.target.value), children: [
          /* @__PURE__ */ t("option", { value: "", children: "all" }),
          x.map((d) => /* @__PURE__ */ t("option", { value: d, children: d }, d))
        ] }),
        /* @__PURE__ */ r("label", { className: "text-sm flex items-center gap-1", style: { cursor: "pointer" }, children: [
          /* @__PURE__ */ t("input", { type: "checkbox", checked: _, onChange: (d) => k(d.target.checked) }),
          "Needs me"
        ] }),
        /* @__PURE__ */ t("div", { className: "flex-1" }),
        /* @__PURE__ */ t(
          te,
          {
            "aria-label": "GitHub repository to search (owner/name, optional)",
            placeholder: "owner/repo (optional)",
            value: c,
            onChange: (d) => h(d.target.value),
            className: "w-48"
          }
        ),
        /* @__PURE__ */ r(D, { onClick: () => e.onInvestigate(c), disabled: i.size === 0 || !!e.busy, children: [
          "Investigate ",
          i.size || ""
        ] })
      ] }),
      f.length === 0 ? /* @__PURE__ */ t(
        Je,
        {
          icon: /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "📡" }),
          title: a.length ? "Nothing matches these filters" : "Nothing here yet",
          subtitle: a.length ? "Change a filter to see more." : "New messages appear after the next poll."
        }
      ) : /* @__PURE__ */ t("ul", { className: "flex flex-col", "data-testid": "ledger-list", children: f.map((d, L) => /* @__PURE__ */ t(Ct, { it: d, first: L === 0, checked: i.has(d.key), onToggle: () => b(d.key) }, d.key)) })
    ] }),
    /* @__PURE__ */ r(G, { children: [
      /* @__PURE__ */ t(re, { children: "Channels" }),
      E.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No channels configured." }) : /* @__PURE__ */ r("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ t("thead", { children: /* @__PURE__ */ r("tr", { className: "text-left text-muted", children: [
          /* @__PURE__ */ t("th", { scope: "col", children: "Channel" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Last polled" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Status" })
        ] }) }),
        /* @__PURE__ */ t("tbody", { children: E.map((d) => /* @__PURE__ */ r("tr", { children: [
          /* @__PURE__ */ t("td", { className: "font-mono", children: d.cid }),
          /* @__PURE__ */ t("td", { children: de(d.last_polled_at) }),
          /* @__PURE__ */ t("td", { children: d.last_error ? /* @__PURE__ */ t(Q, { variant: "err", title: d.last_error, children: "error" }) : /* @__PURE__ */ t(Q, { variant: "ok", children: "ok" }) })
        ] }, d.cid)) })
      ] })
    ] })
  ] });
}
const Lt = 5;
function Dt(e) {
  const n = e.split(`
`).map((i) => i.trim()).filter(Boolean), a = n.filter((i) => /^[•\-–]\s/.test(i));
  return (a.length ? a : n).slice(0, Lt);
}
function At({ state: e, busy: n, onDigest: a }) {
  const i = e.digest, l = e.crew.today, c = Dt(i.last_text || ""), h = e.settings.digest_destination === "self_dm" ? "DMed to you" : "dashboard notification";
  return /* @__PURE__ */ r(G, { className: "mb-4", "data-testid": "today-card", children: [
    /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ t(re, { children: "Today" }),
      i.pending ? /* @__PURE__ */ t(Q, { variant: "aim", children: "digest being delivered" }) : null,
      i.last_posted_date && /* @__PURE__ */ r("span", { className: "text-xs text-muted", "data-testid": "digest-time", children: [
        "digest ",
        i.last_posted_date,
        " · ",
        h
      ] }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      /* @__PURE__ */ t(D, { style: z, onClick: a, disabled: !!n || !e.crew.live, children: "Digest now" })
    ] }),
    (l == null ? void 0 : l.text) && /* @__PURE__ */ r("p", { style: { margin: "8px 0 0", fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }, "data-testid": "crew-today", children: [
      l.text,
      l.at > 0 && /* @__PURE__ */ r("span", { className: "text-xs text-muted", style: { fontWeight: 400 }, children: [
        " · ",
        Z(l.at)
      ] })
    ] }),
    i.last_text ? /* @__PURE__ */ r(A, { children: [
      /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", "data-testid": "digest-top", style: { margin: "8px 0 0", padding: 0, listStyle: "none" }, children: c.map((p, S) => /* @__PURE__ */ t("li", { children: p }, S)) }),
      /* @__PURE__ */ t(ve, { summary: "Full digest", children: /* @__PURE__ */ t("pre", { className: "whitespace-pre-wrap text-sm", style: { fontFamily: "inherit", margin: 0 }, children: i.last_text }) })
    ] }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { margin: "8px 0 0" }, "data-testid": "digest-empty", children: "No digest yet" }),
    i.last_error && /* @__PURE__ */ t("p", { className: "text-xs mt-1", style: { color: "var(--danger)" }, children: i.last_error })
  ] });
}
function Ft({ state: e }) {
  return /* @__PURE__ */ t("div", { className: "flex items-center gap-2", style: { marginTop: 10 }, children: ce.map((n) => /* @__PURE__ */ r("span", { title: `${n.title} · ${ie(n, e).label}`, children: [
    /* @__PURE__ */ t(ke, { m: n, s: e, selected: n.id === "lead", size: 30 }),
    /* @__PURE__ */ t("span", { className: "sr-only", children: `${n.title}: ${ie(n, e).label}` })
  ] }, n.id)) });
}
function It(e) {
  const n = `slack-radar:chat-open:${e}`, a = () => {
    try {
      return window.localStorage.getItem(n) === "1";
    } catch {
      return !1;
    }
  }, [i, l] = u(a);
  ae(() => l(a()), [n]);
  const c = ye(
    (h) => {
      l(h);
      try {
        h ? window.localStorage.setItem(n, "1") : window.localStorage.removeItem(n);
      } catch {
      }
    },
    [n]
  );
  return [i, c];
}
function Ae({ q: e, onClick: n, disabled: a }) {
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
function Ot(e) {
  const n = le(), { state: a, expanded: i, pending: l } = e, c = ce[0], h = a.crew.slot_key, p = a.crew.live && a.crew.session_open && a.crew.session_agent === a.crew.agent, [S, g] = u(""), [$, _] = u(!1), [k, y] = u(""), [x, f] = u(!1), b = ie(c, a), E = async (v) => {
    await n.post(`${O}/crew/message`, { message: v }), e.onChanged();
  }, W = async (v) => {
    const m = v.trim();
    if (m) {
      _(!0), y("");
      try {
        await n.post(`${O}/crew/message`, { message: m }), g(""), m === l && e.setPending(""), e.setExpanded(!0), e.onChanged();
      } catch {
        y(m);
      } finally {
        _(!1);
      }
    }
  }, d = async () => {
    try {
      await navigator.clipboard.writeText(l), f(!0), window.setTimeout(() => f(!1), 1500);
    } catch {
      f(!1);
    }
  }, L = k && /* @__PURE__ */ t(ee, { message: "The Radar Lead did not get that message.", onRetry: () => W(k) }), F = /* @__PURE__ */ t("div", { className: "text-sm", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }, children: a.crew.live ? /* @__PURE__ */ r(A, { children: [
    /* @__PURE__ */ t("span", { children: "The Radar Lead session opens on its next turn. Open it now to talk here." }),
    /* @__PURE__ */ t(D, { primary: !0, onClick: e.onStart, disabled: !!e.busy || !e.configured, children: "Open the session" })
  ] }) : /* @__PURE__ */ r("span", { children: [
    "The Radar Lead is paused. Turn on ",
    /* @__PURE__ */ t("b", { children: "Crew" }),
    " at the top of the page to triage your channels and talk to it here."
  ] }) });
  if (!i)
    return /* @__PURE__ */ r(G, { style: { padding: "10px 14px" }, children: [
      /* @__PURE__ */ r(
        "form",
        {
          className: "flex flex-wrap items-center gap-2",
          onSubmit: (v) => {
            v.preventDefault(), W(S);
          },
          children: [
            /* @__PURE__ */ t(ke, { m: c, s: a, size: 26 }),
            /* @__PURE__ */ t(
              te,
              {
                "aria-label": "Ask the lead",
                placeholder: "Ask the lead…",
                value: S,
                onChange: (v) => g(v.target.value),
                disabled: !p || $,
                style: { flex: 1, minWidth: 200 }
              }
            ),
            /* @__PURE__ */ t(D, { primary: !0, type: "submit", disabled: !p || $ || !S.trim(), children: "Send" }),
            Se.map((v) => /* @__PURE__ */ t(Ae, { q: v, onClick: () => W(v), disabled: !p || $ }, v))
          ]
        }
      ),
      !p && /* @__PURE__ */ t("div", { style: { marginTop: 8 }, children: F }),
      L
    ] });
  const C = e.events.filter((v) => v.kind === "crew" || v.kind === "digest").slice(0, 5);
  return /* @__PURE__ */ r(
    G,
    {
      style: { padding: 0, display: "flex", flexDirection: "column", height: "min(620px, calc(100vh - 240px))", overflow: "hidden" },
      children: [
        /* @__PURE__ */ r("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border)" }, children: [
          /* @__PURE__ */ r("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: a.crew.name || c.title }),
            /* @__PURE__ */ t(Q, { variant: b.tone === "muted" ? "muted" : b.tone === "aim" ? "aim" : "ok", children: b.label }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(D, { onClick: () => e.setExpanded(!1), "aria-expanded": !0, children: "Collapse" })
          ] }),
          /* @__PURE__ */ r("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
            "phase ",
            a.crew_memory.phase,
            " · next: ",
            a.crew_memory.next || "—"
          ] }),
          /* @__PURE__ */ t(Ft, { state: a })
        ] }),
        /* @__PURE__ */ t(st, { state: a }),
        l && // ChatEmbed has no API to fill its composer, so the question waits here.
        /* @__PURE__ */ r(
          "div",
          {
            className: "text-sm flex flex-wrap items-center gap-2",
            style: { padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" },
            children: [
              /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200, userSelect: "all" }, children: l }),
              /* @__PURE__ */ t(D, { primary: !0, style: z, onClick: () => W(l), disabled: !p || $, children: "Send" }),
              /* @__PURE__ */ t(D, { style: z, onClick: d, children: x ? "Copied" : "Copy" })
            ]
          }
        ),
        L && /* @__PURE__ */ t("div", { style: { padding: "0 16px" }, children: L }),
        /* @__PURE__ */ t("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: p ? /* @__PURE__ */ t(
          Qe,
          {
            slotKey: h,
            agent: a.crew.agent,
            frameless: !0,
            startAtBottom: !0,
            placeholder: "Ask the Radar Lead…",
            onSend: E
          },
          h
        ) : /* @__PURE__ */ r("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 10 }, children: [
          F,
          !e.configured && /* @__PURE__ */ t("p", { className: "text-xs text-muted", children: "Add a channel in Settings first." }),
          C.length > 0 && /* @__PURE__ */ t("ul", { className: "text-xs text-muted flex flex-col gap-1", style: { marginTop: 6 }, children: C.map((v, m) => /* @__PURE__ */ r("li", { children: [
            Z(v.at),
            " · ",
            v.text
          ] }, `${v.at}-${m}`)) })
        ] }) }),
        /* @__PURE__ */ t("div", { className: "flex flex-wrap gap-2", style: { padding: "10px 16px 12px", borderTop: "1px solid var(--border)" }, children: Se.map((v) => /* @__PURE__ */ t(Ae, { q: v, onClick: () => W(v), disabled: !p || $ }, v)) })
      ]
    }
  );
}
function Et({ state: e }) {
  return /* @__PURE__ */ r(G, { children: [
    /* @__PURE__ */ t(re, { children: "Team" }),
    /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { marginBottom: 8 }, children: "Who works on your channels. Only the Radar Lead has a session; the others run when needed." }),
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: ce.map((n) => {
      var i, l;
      const a = n.id === "lead" ? e.crew.agent : n.agent;
      return /* @__PURE__ */ r(
        "li",
        {
          className: "flex items-start gap-3",
          style: { padding: "12px 4px", borderTop: "1px solid var(--border)", opacity: n.planned ? 0.7 : 1 },
          children: [
            /* @__PURE__ */ t(ke, { m: n, s: e, size: 36 }),
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
              a && /* @__PURE__ */ t(ve, { children: /* @__PURE__ */ r("span", { className: "font-mono", children: [
                "agent: ",
                a,
                n.id === "lead" && e.crew.slot_key ? ` · session: ${e.crew.slot_key}` : ""
              ] }) })
            ] }),
            /* @__PURE__ */ t("div", { "data-testid": `team-status-${n.id}`, style: { maxWidth: 360, minWidth: 0, display: "flex" }, children: /* @__PURE__ */ t(Be, { m: n, state: e, withName: !1, withResting: !0 }) })
          ]
        },
        n.id
      );
    }) })
  ] });
}
function Bt({ events: e, kinds: n, onShowAll: a }) {
  const i = n ? e.filter((l) => n.includes(l.kind)) : e;
  return /* @__PURE__ */ r(G, { children: [
    /* @__PURE__ */ t(re, { children: "Activity" }),
    n && /* @__PURE__ */ r("p", { className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { marginBottom: 8 }, children: [
      /* @__PURE__ */ t("span", { children: "Showing the crew and its members only." }),
      /* @__PURE__ */ t(D, { style: z, onClick: a, children: "Show all" })
    ] }),
    i.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No activity yet." }) : /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", children: i.map((l, c) => /* @__PURE__ */ r("li", { children: [
      /* @__PURE__ */ t("span", { className: "text-muted", children: de(l.at) }),
      " ",
      /* @__PURE__ */ t(Q, { variant: "muted", children: l.kind }),
      " ",
      l.text
    ] }, `${l.at}-${c}`)) })
  ] });
}
function Pt({
  state: e,
  busy: n,
  act: a,
  mcp: i,
  onProbe: l
}) {
  const c = le(), [h, p] = u(e.settings.channels.join(`
`)), [S, g] = u(e.settings.digest_destination), [$, _] = u(e.settings.slack_login), [k, y] = u(e.settings.slack_mcp_command), [x, f] = u(e.settings.workspace_url), [b, E] = u(String(e.settings.poll_interval_secs)), [W, d] = u(String(e.settings.backfill_hours)), [L, F] = u(e.crew.unattended), [C, v] = u(e.crew.agent), [m, T] = u(e.crew.model), N = () => a(
    "Save settings",
    () => c.put(`${O}/settings`, {
      channels: h.split(/[\s,]+/).map((w) => w.trim()).filter(Boolean),
      digest_destination: S,
      slack_login: $.trim(),
      slack_mcp_command: k.trim(),
      workspace_url: x.trim(),
      poll_interval_secs: Number(b),
      backfill_hours: Number(W)
    })
  );
  return /* @__PURE__ */ r(A, { children: [
    !e.vault_available && /* @__PURE__ */ t(G, { className: "mb-4", children: /* @__PURE__ */ t("p", { className: "text-sm", children: "The gateway secret vault is unavailable, so settings cannot be saved." }) }),
    /* @__PURE__ */ r(G, { className: "mb-4", children: [
      /* @__PURE__ */ t(re, { children: "Basics" }),
      /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(ze, { mcp: i, state: e }) }),
        /* @__PURE__ */ t(D, { disabled: !!n, onClick: l, children: "Check connection" })
      ] }),
      /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 12px" }, children: "Slack is read as you, read-only: no bot, no invite. The one write is the optional digest DM to yourself." }),
      /* @__PURE__ */ t("label", { className: "block text-sm mb-1", htmlFor: "sr-channels", children: "Channels to watch (one channel ID per line, e.g. C0123ABCD). Any channel you can read works." }),
      /* @__PURE__ */ t(
        "textarea",
        {
          id: "sr-channels",
          className: "w-full font-mono text-sm border rounded p-2 bg-transparent",
          rows: 5,
          value: h,
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
              value: S,
              onChange: (w) => g(w.target.value),
              children: [
                /* @__PURE__ */ t("option", { value: "dashboard", children: "Dashboard notification only" }),
                /* @__PURE__ */ t("option", { value: "self_dm", children: "DM to myself in Slack" })
              ]
            }
          )
        ] }),
        S === "self_dm" && /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "Your Slack login (for the DM)",
          /* @__PURE__ */ t(te, { value: $, onChange: (w) => _(w.target.value), placeholder: "jdoe" })
        ] }),
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "Poll interval (seconds, 60–3600)",
          /* @__PURE__ */ t(te, { type: "number", min: 60, max: 3600, value: b, onChange: (w) => E(w.target.value) }),
          /* @__PURE__ */ r("span", { "data-testid": "poll-cadence", className: "block text-xs text-muted", style: { marginTop: 2 }, children: [
            "Runs by itself every ",
            e.settings.poll_interval_secs,
            " s; a manual Poll just runs one cycle now."
          ] })
        ] })
      ] }),
      /* @__PURE__ */ t(D, { primary: !0, className: "mt-3", disabled: !!n, onClick: N, children: "Save settings" })
    ] }),
    /* @__PURE__ */ t(G, { children: /* @__PURE__ */ r("details", { children: [
      /* @__PURE__ */ t("summary", { style: { cursor: "pointer", fontWeight: 600, color: "var(--text-strong)" }, children: "Advanced" }),
      /* @__PURE__ */ r("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "MCP server command (a single executable on PATH)",
          /* @__PURE__ */ t(te, { value: k, onChange: (w) => y(w.target.value), placeholder: "ai-community-slack-mcp" })
        ] }),
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "Workspace URL (for permalinks, optional)",
          /* @__PURE__ */ t(te, { value: x, onChange: (w) => f(w.target.value), placeholder: "https://yourteam.slack.com" })
        ] }),
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "First-poll backfill (hours, 0–168)",
          /* @__PURE__ */ t(te, { type: "number", min: 0, max: 168, value: W, onChange: (w) => d(w.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(D, { className: "mt-3", disabled: !!n, onClick: N, children: "Save settings" }),
      /* @__PURE__ */ r("div", { style: { borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }, children: [
        /* @__PURE__ */ t("div", { className: "text-sm", style: { fontWeight: 600, marginBottom: 8 }, children: "Crew" }),
        /* @__PURE__ */ r("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
          /* @__PURE__ */ r("label", { className: "text-sm", children: [
            "Agent",
            /* @__PURE__ */ t(te, { value: C, onChange: (w) => v(w.target.value), placeholder: "slack-radar-crew" }),
            /* @__PURE__ */ t("span", { className: "block text-xs text-muted mt-1", children: "Default: the shipped slack-radar-crew agent. Your own agents are never modified." })
          ] }),
          /* @__PURE__ */ r("label", { className: "text-sm", children: [
            "Model (empty = agent default)",
            /* @__PURE__ */ t(te, { value: m, onChange: (w) => T(w.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ r("div", { className: "mt-3 flex items-center gap-2", children: [
          /* @__PURE__ */ t(
            Fe,
            {
              checked: L,
              onChange: F,
              label: "Unattended mode (auto-approve investigator commands)",
              describedBy: "sr-unattended-risk"
            }
          ),
          /* @__PURE__ */ t("span", { className: "text-sm", children: "Unattended mode (auto-approve investigator commands)" })
        ] }),
        /* @__PURE__ */ t("p", { id: "sr-unattended-risk", className: "text-xs text-muted mt-1", children: "Risk: anyone in a watched channel can write text the crew reads, so a crafted message could steer a command nobody reviews." }),
        /* @__PURE__ */ t(
          D,
          {
            primary: !0,
            className: "mt-3",
            disabled: !!n,
            onClick: () => a("Save crew", () => c.put(`${O}/crew`, { agent: C, model: m, unattended: L })),
            children: "Save crew"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  Kt as default
};
