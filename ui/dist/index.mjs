import { jsxs as r, Fragment as W, jsx as t } from "react/jsx-runtime";
import * as we from "@kirocrew/app-sdk";
import { useAppApi as ie, ChatEmbed as Ue } from "@kirocrew/app-sdk";
import { PageHeader as Ke, Toggle as Re, Btn as T, Card as K, CardTitle as te, StatCard as ce, Input as Z, EmptyState as Ye, Badge as Y } from "@kirocrew/app-sdk/ui";
import { useState as p, useCallback as ue, useEffect as re, useRef as le, useMemo as he } from "react";
const I = "/api/apps/slack-radar", Ge = {
  checking: "checking…",
  connected: "connected",
  needs_login: "sign in again",
  binary_not_found: "not installed",
  incompatible: "missing read access",
  error: "not working"
}, ke = ["What needs me today?", "Draft today's digest", "Which threads look resolved?"], Qe = [
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
function Je(e) {
  if (!e) return "";
  const n = Math.round(e - Date.now() / 1e3);
  return n <= 0 ? "now" : De(Date.now() / 1e3 - n);
}
function Ve(e, n) {
  if (!(n != null && n.last)) return "";
  const { started_at: a, finished_at: s } = n.last;
  if (e.id === "poller") {
    if (!a) return "has not polled yet";
    const l = Je(n.next_at);
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
  const s = Ve(e, a);
  return e.id === "poller" ? s && a.state === "paused" ? `${a.doing.split(" · ")[0]} · ${s}` : s || a.doing : a.state !== "working" ? a.state === "paused" ? `paused: ${a.doing}` : s || se(e, n).label : e.id === "lead" ? `working: ${a.doing}` : `${a.count} running: ${a.doing}`;
}
const Xe = `@keyframes slack-radar-pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.7) } }
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
  const o = se(e, n), h = pe(n, e.id), m = h ? h.state === "working" : o.tone === "aim", S = s && (e.id === "investigator" || e.id === "watcher") ? qe(h) : "", b = S ? `${S} · ${Ne(e, n)}` : Ne(e, n), N = e.id === "lead" && n.crew.name || e.title, _ = /* @__PURE__ */ r(W, { children: [
    /* @__PURE__ */ t(Ae, { tone: o.tone, pulse: m }),
    a && /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: N }),
    /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: Le(b) })
  ] }), x = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    fontSize: 13,
    opacity: m || o.tone === "warn" ? 1 : 0.6,
    color: "var(--text)"
  }, R = { title: `${N} · ${b}`, "data-member": e.id, "data-state": (h == null ? void 0 : h.state) || (m ? "working" : "idle") };
  return l ? /* @__PURE__ */ t(
    "button",
    {
      type: "button",
      onClick: l,
      ...R,
      "aria-label": `${N}: ${b}. Show activity`,
      style: { ...x, background: "transparent", border: 0, padding: 0, cursor: "pointer" },
      children: _
    }
  ) : /* @__PURE__ */ t("span", { ...R, style: x, children: _ });
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
function et({ state: e }) {
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
  const l = se(e, n), o = e.planned || e.id === "poller", h = {
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
          background: Ie[l.tone]
        }
      }
    )
  ] });
}
function tt(e) {
  return e === "new" ? "warn" : e === "investigating" ? "aim" : e === "resolved" ? "ok" : "muted";
}
function nt({ tab: e, setTab: n }) {
  return /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Slack Radar sections", style: { display: "flex", gap: 4 }, children: Qe.map((a) => {
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
function at({
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
        onChange: (m) => m ? s() : l(),
        label: o ? "Pause the crew" : "Start the crew"
      }
    ),
    /* @__PURE__ */ r("span", { className: "text-xs text-muted", title: "Whether the crew's commands run without asking you", children: [
      "Unattended: ",
      e.crew.trusted ? "on" : "off"
    ] })
  ] });
}
function Ft() {
  const e = ie(), [n, a] = p("board"), [s, l] = p(null), [o, h] = p([]), [m, S] = p(null), [b, N] = p([]), [_, x] = p([]), [R, L] = p("open"), [$, A] = p(/* @__PURE__ */ new Set()), [D, O] = p(""), [d, y] = p(""), [M, j] = p(null), [v, g] = p(null), [C, k] = p(null), w = ue(async () => {
    try {
      j(await e.get(`${I}/mcp/status`));
    } catch (f) {
      j({ status: "error", command: "", detail: f.message });
    }
  }, [e]);
  re(() => {
    w();
  }, [w]);
  const B = ue(async () => {
    var f;
    try {
      const [F, E, J, X, He] = await Promise.all([
        e.get(`${I}/state`),
        e.get(`${I}/items?status=${encodeURIComponent(R)}&limit=300`),
        e.get(`${I}/events?limit=150`),
        e.get(`${I}/needs`),
        e.get(`${I}/items?handled=1&limit=100`)
      ]);
      l(F), g(((f = F.now) == null ? void 0 : f.members) || null), h(E.items), S(X), N(He.items), x(J.events.slice().reverse());
    } catch (F) {
      y(`Could not load: ${F.message}`);
    }
  }, [e, R]);
  re(() => {
    B();
    const f = window.setInterval(B, 3e4);
    return () => window.clearInterval(f);
  }, [B]);
  const z = !!(v != null && v.some((f) => f.state === "working")), Q = le("");
  re(() => {
    if (!z) return;
    const f = async () => {
      try {
        const E = await e.get(`${I}/now`);
        g(E.members);
        const J = E.members.map((X) => `${X.id}:${X.state}:${X.count}`).join(",");
        if (Q.current && J !== Q.current) {
          const X = await e.get(`${I}/events?limit=150`);
          x(X.events.slice().reverse());
        }
        Q.current = J;
      } catch {
      }
    }, F = window.setInterval(f, 5e3);
    return () => window.clearInterval(F);
  }, [z, e]);
  const U = he(() => s && v ? { ...s, now: { members: v } } : s, [s, v]), ne = () => {
    k(["member", "crew", "investigate"]), a("activity");
  }, G = async (f, F) => {
    O(f), y("");
    try {
      await F(), y(`${f}: done`), await B();
    } catch (E) {
      y(`${f} failed: ${E.message}`);
    } finally {
      O("");
    }
  }, q = !!s && s.settings.channels.length > 0, H = (s == null ? void 0 : s.settings.channels.length) || 0, i = s ? `${H ? `Watching ${H} channel${H === 1 ? "" : "s"}` : "No channels yet"} · ${s.crew.live ? "running" : "paused"}` : "A small crew triaging your Slack channels", u = s ? We(M, s.source_state) : "checking", c = () => {
    w(), B();
  };
  return /* @__PURE__ */ r(W, { children: [
    /* @__PURE__ */ t(
      Ke,
      {
        title: "Slack Radar",
        subtitle: i,
        actions: /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-4", children: [
          /* @__PURE__ */ t(
            nt,
            {
              tab: n,
              setTab: (f) => {
                k(null), a(f);
              }
            }
          ),
          s && /* @__PURE__ */ t(
            at,
            {
              state: s,
              configured: q,
              busy: D,
              onStart: () => G("Start crew", () => e.post(`${I}/crew/start`, {})),
              onPause: () => G("Pause crew", () => e.post(`${I}/crew/pause`, {}))
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ t("style", { children: Xe }),
    /* @__PURE__ */ r("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      U && n === "board" && /* @__PURE__ */ t(Ze, { state: U, onOpenActivity: ne }),
      s && u === "needs_login" && /* @__PURE__ */ t(rt, { mcp: M, sourceError: s.source_error, busy: D, onCheck: c }),
      d && /* @__PURE__ */ t("p", { role: "status", className: "text-sm text-muted mb-3", children: d }),
      U ? n === "board" ? /* @__PURE__ */ t(
        st,
        {
          state: U,
          needs: m,
          handled: b,
          configured: q,
          mcp: M,
          busy: D,
          onPoll: () => G("Poll", () => e.post(`${I}/poll`, {})),
          onStart: () => G("Start crew", () => e.post(`${I}/crew/start`, {})),
          onDigest: () => G("Digest now", () => e.post(`${I}/digest/request`, {})),
          events: _,
          onChanged: B
        }
      ) : n === "ledger" ? /* @__PURE__ */ t(
        vt,
        {
          state: U,
          items: o,
          filter: R,
          setFilter: L,
          selected: $,
          setSelected: A,
          busy: D,
          onInvestigate: (f) => G("Investigate", async () => {
            await e.post(`${I}/investigate`, { keys: [...$], repo: f }), A(/* @__PURE__ */ new Set());
          })
        }
      ) : n === "team" ? /* @__PURE__ */ t(Ct, { state: U }) : n === "activity" ? /* @__PURE__ */ t(Tt, { events: _, kinds: C, onShowAll: () => k(null) }) : /* @__PURE__ */ t(Rt, { state: U, busy: D, act: G, mcp: M, onProbe: w }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" })
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
function rt({ mcp: e, sourceError: n, busy: a, onCheck: s }) {
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
          /* @__PURE__ */ t("span", { style: { color: o ? "var(--text)" : "var(--warn)" }, children: Ge[l] || l })
        ] }),
        a && /* @__PURE__ */ r("span", { children: [
          "· last poll ",
          V(n.last_poll_at),
          n.settings.channels.length > 0 && /* @__PURE__ */ r(W, { children: [
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
function st(e) {
  const { state: n } = e, [a, s] = p(""), [l, o] = St(n.crew.slot_key), h = le(null), m = (S) => {
    s(it(S)), o(!0), window.requestAnimationFrame(() => {
      var b;
      return (b = h.current) == null ? void 0 : b.scrollIntoView({ block: "end", behavior: "smooth" });
    });
  };
  return /* @__PURE__ */ r("div", { "data-testid": "board", style: { minWidth: 0 }, children: [
    /* @__PURE__ */ t(
      Be,
      {
        mcp: e.mcp,
        state: n,
        withPoll: !0,
        action: /* @__PURE__ */ t(T, { style: P, onClick: e.onPoll, disabled: !!e.busy || !e.configured, children: "Poll now" })
      }
    ),
    !e.configured && /* @__PURE__ */ r(K, { className: "mb-4", children: [
      /* @__PURE__ */ t(te, { children: "Finish setup" }),
      /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite." })
    ] }),
    /* @__PURE__ */ t(Nt, { state: n, busy: e.busy, onDigest: e.onDigest }),
    /* @__PURE__ */ t(ft, { needs: e.needs, handled: e.handled, onChanged: e.onChanged, onWhy: m }),
    /* @__PURE__ */ t(
      "div",
      {
        ref: h,
        "data-testid": "chat-bar",
        "data-expanded": l ? "true" : "false",
        style: { position: "sticky", bottom: 0, zIndex: 5, marginTop: 8, borderRadius: 12, boxShadow: "0 -6px 18px rgba(0,0,0,.18)" },
        children: /* @__PURE__ */ t(
          $t,
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
function it(e) {
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
const P = { fontSize: 12, padding: "2px 10px" }, ve = (e, n) => e === "decide" && !!n.reply_draft && !n.handoff_title;
function Pe(e, n, a = !1) {
  return e === "decide" && (n.dispatch || a) ? "Done" : e === "decide" && n.handoff_title ? "Dispatch fix" : ve(e, n) ? "Open" : e === "decide" && n.reason.startsWith("Looks resolved") ? "Done" : e === "unanswered" && n.permalink ? "Reply" : "Decide";
}
function me(e) {
  return e.replace(/<([@#!])([^>|]+)\|([^>]+)>/g, (n, a, s, l) => `${a === "#" ? "#" : "@"}${l}`).replace(/<([@#!])([^>|]+)>/g, (n, a, s) => `${a === "#" ? "#" : "@"}${s}`).replace(/<([^>|]+)\|([^>]+)>/g, "$2").replace(/<([^>]+)>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
const Me = (e, n = 90) => Le(me(e).split(`
`).map((a) => a.trim()).find(Boolean) || "", n), lt = (e) => new Date(e * 1e3).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), ot = 3600, dt = (e, n, a) => `${e} ${e === 1 ? n : a}`;
function ze({ ts: e }) {
  const n = Number(e || 0);
  return n ? /* @__PURE__ */ r("span", { "data-testid": "last-reply", children: [
    " · replies · last ",
    ae(n)
  ] }) : null;
}
function ct(e, n) {
  var s;
  const a = e.dispatch;
  return a ? {
    session_key: a.session_key,
    title: a.title,
    batch: a.batch && ((s = a.batch_keys) == null ? void 0 : s.length) || 0,
    state: a.state,
    pr_url: a.pr_url,
    pr_number: a.pr_number,
    trusted: a.trusted
  } : n || null;
}
function ht({
  e,
  groupId: n,
  first: a,
  onOpen: s,
  onMark: l,
  onDispatch: o,
  busy: h,
  fix: m,
  sentHere: S,
  failed: b,
  excluded: N,
  onExclude: _
}) {
  const x = n === "decide" ? ct(e, S) : null, R = Pe(n, e, !!x), L = ve(n, e), [$, A] = p(!1), D = `sr-fix-${e.key.replace(/[^A-Za-z0-9]/g, "-")}`, O = () => {
    R === "Dispatch fix" ? o == null || o() : R === "Done" ? l("done") : R === "Reply" && e.permalink ? window.open(e.permalink, "_blank", "noopener,noreferrer") : s();
  }, d = x && ge[x.state] || "";
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
              children: L ? /* @__PURE__ */ r(W, { children: [
                /* @__PURE__ */ r("div", { style: { color: "var(--text-strong)" }, children: [
                  /* @__PURE__ */ t("span", { "data-testid": "reply-ready", children: /* @__PURE__ */ t(Y, { variant: "aim", children: "Reply ready" }) }),
                  " ",
                  e.reply_draft_stale && /* @__PURE__ */ r(W, { children: [
                    /* @__PURE__ */ t("span", { "data-testid": "draft-stale", children: /* @__PURE__ */ r(Y, { variant: "warn", children: [
                      dt(e.reply_draft_stale.new_replies, "new reply", "new replies"),
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
              ] }) : /* @__PURE__ */ r(W, { children: [
                /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
                /* @__PURE__ */ r("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
                  e.reason,
                  " · ",
                  /* @__PURE__ */ t("span", { "data-testid": "need-age", children: Se(e.age_hours) })
                ] })
              ] })
            }
          ),
          x && /* @__PURE__ */ r("div", { className: "text-xs", role: "status", style: { marginTop: 2 }, "data-testid": "fix-dispatched", children: [
            /* @__PURE__ */ t("span", { style: { color: "var(--text-strong)" }, children: "Dispatched" }),
            " · ",
            x.launched ? "opened in a new conductor chat" : x.batch ? `batch of ${x.batch}` : x.title || "Fix session",
            d && /* @__PURE__ */ r(W, { children: [
              " · ",
              d
            ] }),
            x.session_key && /* @__PURE__ */ r(W, { children: [
              " · ",
              /* @__PURE__ */ t(fe, { d: x, label: "Open session" })
            ] }),
            x.pr_url && /* @__PURE__ */ r(W, { children: [
              " · ",
              /* @__PURE__ */ r("a", { className: "underline", href: x.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
                "PR #",
                x.pr_number
              ] })
            ] }),
            /* @__PURE__ */ t(ze, { ts: e.latest_reply })
          ] }),
          x && x.trusted === !1 && (x.state === "running" || x.state === "idle") && /* @__PURE__ */ t("div", { className: "text-xs text-muted", "data-testid": "fix-untrusted", children: "Will ask you for each tool: unattended mode is off." }),
          b && !x && /* @__PURE__ */ t(ee, { message: `Could not dispatch that fix: ${b}. Nothing was sent.`, onRetry: () => o == null ? void 0 : o() }),
          m && $ && /* @__PURE__ */ r(
            "div",
            {
              id: D,
              "data-testid": "fix-preview",
              className: "text-xs",
              style: { marginTop: 6, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6 },
              children: [
                /* @__PURE__ */ r("div", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: [
                  m.title,
                  " ",
                  m.repo && /* @__PURE__ */ t("span", { className: "text-muted font-mono", style: { fontWeight: 400 }, children: m.repo })
                ] }),
                /* @__PURE__ */ t(
                  "pre",
                  {
                    "aria-label": "Fix task",
                    style: { margin: "4px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 160, overflowY: "auto", fontFamily: "var(--font-mono, monospace)" },
                    children: m.prompt
                  }
                ),
                _ && /* @__PURE__ */ r("label", { className: "flex items-center gap-1", style: { marginTop: 6, cursor: "pointer" }, children: [
                  /* @__PURE__ */ t("input", { type: "checkbox", checked: !!N, onChange: (y) => _(y.target.checked) }),
                  "Exclude from batch"
                ] })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ t("div", { className: "flex items-center gap-1", style: { flex: "none" }, "data-testid": "need-actions", children: /* @__PURE__ */ t(T, { primary: !0, style: P, onClick: O, disabled: h, children: R === "Dispatch fix" && h ? /* @__PURE__ */ r(W, { children: [
          /* @__PURE__ */ t("span", { className: "sr-spin", "aria-hidden": !0 }),
          "Dispatching…"
        ] }) : R }) }),
        m && /* @__PURE__ */ t(
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
function pt({
  e,
  groupId: n,
  onClose: a,
  onSend: s,
  onMark: l,
  onWhy: o,
  onDispatch: h,
  busy: m,
  sentHere: S,
  reanalyze: b
}) {
  var u;
  const N = ve(n, e), _ = Pe(n, e, S), [x, R] = p(e.reply_draft || ""), [L, $] = p(!1), [A, D] = p(null), [O, d] = p(""), y = le(null), M = le(null), j = le(null), v = e.key.replace(/[^A-Za-z0-9]/g, "-"), g = `sr-detail-${v}`, C = `sr-reply-${v}`, k = e.replies || [], w = e.reply_draft_at || 0, B = (c) => !!e.reply_draft && w > 0 && Number(c.ts) > w, z = ((u = e.reply_draft_stale) == null ? void 0 : u.new_replies) || 0, Q = e.last_thread_check_at || 0, U = Q > 0 && Date.now() / 1e3 - Q > ot;
  re(() => {
    const c = document.activeElement;
    return window.requestAnimationFrame(() => {
      var f;
      return (f = N ? M.current : j.current) == null ? void 0 : f.focus();
    }), () => {
      c && c.isConnected && c.focus();
    };
  }, []);
  const ne = async () => {
    const c = x.trim();
    d(""), $(!0);
    const f = await s(c, c !== (e.reply_draft || "").trim());
    $(!1), f.ok ? D(f.link) : d(f.why);
  }, G = (c) => {
    if (c.key === "Escape") {
      c.stopPropagation(), a();
      return;
    }
    if (c.key !== "Tab" || !y.current) return;
    const f = [...y.current.querySelectorAll("a[href], button:not([disabled]), textarea, input, select")];
    if (f.length === 0) return;
    const F = f[0], E = f[f.length - 1];
    c.shiftKey && document.activeElement === F ? (c.preventDefault(), E.focus()) : !c.shiftKey && document.activeElement === E && (c.preventDefault(), F.focus());
  }, q = (c) => () => {
    c(), a();
  }, H = { marginTop: 14 }, i = { margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "var(--text-strong)" };
  return /* @__PURE__ */ t(
    "div",
    {
      "data-testid": "need-detail-backdrop",
      onMouseDown: (c) => c.target === c.currentTarget && a(),
      style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.35)", display: "flex", justifyContent: "flex-end" },
      children: /* @__PURE__ */ r(
        "div",
        {
          ref: y,
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": g,
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
              /* @__PURE__ */ t("h3", { id: g, style: { margin: 0, flex: 1, fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }, children: Me(e.text || e.summary, 80) || "(no text)" }),
              /* @__PURE__ */ t(
                "button",
                {
                  ref: j,
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
                e.permalink && /* @__PURE__ */ r(W, { children: [
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
                  lt(Q)
                ] })
              ] }),
              k.length === 0 ? /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: 0 }, children: "No replies yet" }) : /* @__PURE__ */ t("ol", { className: "flex flex-col", style: { margin: 0, padding: 0, listStyle: "none" }, children: k.map((c, f) => /* @__PURE__ */ r(
                "li",
                {
                  "data-testid": B(c) ? "reply-new" : "reply-old",
                  style: {
                    padding: B(c) ? "4px 0 4px 8px" : "4px 0",
                    borderTop: f === 0 ? 0 : "1px solid var(--border)",
                    ...B(c) ? { borderLeft: "3px solid var(--warn, #d97706)" } : {}
                  },
                  children: [
                    /* @__PURE__ */ r("div", { className: "text-xs text-muted", children: [
                      B(c) && /* @__PURE__ */ r(W, { children: [
                        /* @__PURE__ */ t(Y, { variant: "warn", children: "new" }),
                        " "
                      ] }),
                      c.user || "someone",
                      " · ",
                      oe(Number(c.ts))
                    ] }),
                    /* @__PURE__ */ t("div", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" }, children: me(c.text) })
                  ]
                },
                `${c.ts}-${f}`
              )) })
            ] }),
            !N && /* @__PURE__ */ r("section", { "aria-label": "Why it is here", style: H, className: "text-xs text-muted", children: [
              e.reason,
              e.category && /* @__PURE__ */ r(W, { children: [
                " · ",
                e.category
              ] }),
              e.words && e.words.length > 0 && /* @__PURE__ */ r(W, { children: [
                " · shared words: ",
                e.words.join(", ")
              ] }),
              e.members && e.members.length > 0 && /* @__PURE__ */ r(W, { children: [
                " · Done and Ignore apply to all ",
                e.members.length
              ] }),
              e.handoff_title && !e.dispatch && !S && /* @__PURE__ */ r("div", { style: { marginTop: 4, color: "var(--text)" }, children: [
                "Fix: ",
                e.handoff_title
              ] })
            ] }),
            N && /* @__PURE__ */ r("section", { "aria-label": "Reply draft", "data-testid": "detail-draft", style: H, children: [
              /* @__PURE__ */ t("label", { htmlFor: C, style: { ...i, display: "block" }, children: "Reply to the thread, sent as you" }),
              /* @__PURE__ */ r("div", { className: "text-xs text-muted", "data-testid": "draft-by", children: [
                e.reply_draft_by === "owner" ? "Edited by you" : "Drafted by the Radar Lead",
                e.reply_draft_at ? ` · ${V(e.reply_draft_at)}` : ""
              ] }),
              /* @__PURE__ */ t(
                "textarea",
                {
                  id: C,
                  ref: M,
                  value: x,
                  maxLength: 1500,
                  rows: 6,
                  readOnly: A !== null,
                  onChange: (c) => R(c.target.value),
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
            N && z > 0 && A === null && /* @__PURE__ */ t("p", { role: "status", "data-testid": "draft-stale-warning", className: "text-sm", style: { ...H, marginBottom: 0, color: "var(--text-strong)" }, children: z === 1 ? "1 reply arrived after this draft — read it first" : `${z} replies arrived after this draft — read them first` }),
            e.needs_reanalysis && b && A === null && /* @__PURE__ */ r("div", { style: H, "data-testid": "detail-reanalyze", children: [
              /* @__PURE__ */ t(T, { style: P, disabled: b.busy || b.inFlight, onClick: () => b.run([e.key], e.key), children: b.inFlight || b.busy ? "Re-analyzing…" : "Re-analyze this" }),
              b.failed && b.failed.from === e.key && /* @__PURE__ */ t(ee, { message: b.failed.why, onRetry: () => b.run(b.failed.keys, e.key) })
            ] }),
            A !== null ? /* @__PURE__ */ r("div", { style: H, className: "flex flex-wrap items-center gap-2", children: [
              /* @__PURE__ */ r("p", { role: "status", style: { margin: 0, flex: 1 }, children: [
                "Sent as you",
                A && /* @__PURE__ */ r(W, { children: [
                  " · ",
                  /* @__PURE__ */ t("a", { className: "underline", href: A, target: "_blank", rel: "noreferrer noopener", "data-testid": "sent-link", children: "Open the reply in Slack" })
                ] })
              ] }),
              /* @__PURE__ */ t(T, { primary: !0, style: P, onClick: a, children: "Close" })
            ] }) : /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-1", style: H, "data-testid": "detail-actions", children: [
              N && /* @__PURE__ */ t(T, { primary: !0, style: P, disabled: !x.trim() || L, onClick: ne, children: L ? "Sending…" : "Send to thread" }),
              _ === "Dispatch fix" && /* @__PURE__ */ t(T, { primary: !0, style: P, disabled: m, onClick: q(() => h == null ? void 0 : h()), children: "Dispatch fix" }),
              _ === "Reply" && e.permalink && /* @__PURE__ */ t(T, { primary: !0, style: P, onClick: () => window.open(e.permalink, "_blank", "noopener,noreferrer"), children: "Reply" }),
              /* @__PURE__ */ t(T, { style: P, onClick: q(() => l("done")), children: N ? "Done without sending" : "Done" }),
              /* @__PURE__ */ t(T, { style: P, onClick: q(() => l("ignored")), children: "Ignore" }),
              /* @__PURE__ */ t(T, { style: P, onClick: q(o), children: "Why? Ask the lead" })
            ] }),
            _ === "Reply" && A === null && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "6px 0 0" }, children: "Reply opens the thread in Slack." })
          ]
        }
      )
    }
  );
}
function ut({ g: e, render: n }) {
  const [a, s] = p(!1), l = a ? e.shown : e.shown.slice(0, $e), o = e.shown.length - l.length;
  return /* @__PURE__ */ r(W, { children: [
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
const je = typeof we.useChatLauncher == "function" ? we.useChatLauncher : () => null, ge = { running: "working", idle: "idle", closed: "done", unknown: "" };
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
function mt(e) {
  const n = ie(), a = je(), [s, l] = p(/* @__PURE__ */ new Set()), [o, h] = p({}), [m, S] = p({}), [b, N] = p(null), [_, x] = p(null), [R, L] = p(!1), $ = (g, C) => h((k) => Object.fromEntries([...Object.entries(k), ...g.map((w) => [w, C])])), A = (g, C) => S((k) => Object.fromEntries([...Object.entries(k), ...g.map((w) => [w, C])])), D = (g) => S((C) => Object.fromEntries(Object.entries(C).filter(([k]) => !g.includes(k)))), O = (g, C, k) => {
    a ? (a.openChat({ agent: g.agent, message: g.seed, autoSend: !0 }), $(C, { session_key: "", title: g.title, batch: k, state: "", pr_url: "", pr_number: 0, launched: !0 })) : (L(!1), x({ title: g.title, seed: g.seed }));
  }, d = async (g, C) => {
    if (!(s.size || g.length === 0)) {
      l(new Set(g));
      try {
        await C();
      } finally {
        l(/* @__PURE__ */ new Set());
      }
    }
  }, y = (g) => d([g], async () => {
    D([g]);
    try {
      const C = await n.post(`${I}/items/handoff/dispatch`, { key: g });
      C.mode === "server" ? $([g], { session_key: C.session_key, title: C.title, batch: 0, state: "running", pr_url: "", pr_number: 0, trusted: C.trusted }) : O(C, [g], 0), e();
    } catch (C) {
      const k = ye(C);
      k.code === "already_dispatched" && k.session_key ? $([g], { session_key: k.session_key, title: k.title || "", batch: 0, state: "", pr_url: "", pr_number: 0 }) : A([g], k.error || "the gateway refused it");
    }
  }), M = (g) => d(g, async () => {
    var C;
    N(null);
    try {
      const k = await n.post(`${I}/items/handoff/dispatch-batch`, { keys: g });
      k.mode === "server" ? $(g, { session_key: k.session_key, title: k.title, batch: g.length, state: "running", pr_url: "", pr_number: 0, trusted: k.trusted }) : O(k, g, g.length), e();
    } catch (k) {
      const w = ye(k), B = (C = w.dispatched) != null && C.length ? `${w.dispatched.length} of them already have a session` : w.error || "the gateway refused it";
      N({ keys: g, why: B });
    }
  }), j = async () => {
    if (_)
      try {
        await navigator.clipboard.writeText(_.seed), L(!0);
      } catch {
        L(!1);
      }
  }, v = _ && /* @__PURE__ */ t(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "sr-fix-title",
      style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" },
      onKeyDown: (g) => g.key === "Escape" && x(null),
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
          /* @__PURE__ */ t(T, { onClick: j, children: R ? "Copied" : "Copy task" }),
          /* @__PURE__ */ t("a", { className: "underline text-sm", href: "/chat?new=1", children: "New chat" }),
          /* @__PURE__ */ t("div", { className: "flex-1" }),
          /* @__PURE__ */ t(T, { onClick: () => x(null), children: "Close" })
        ] })
      ] })
    }
  );
  return { dispatch: y, dispatchBatch: M, busy: s, sent: o, failed: m, batchFailed: b, ui: v };
}
const Ce = 10;
function gt(e, n) {
  var N;
  const a = ie(), [s, l] = p(!1), [o, h] = p(!1), [m, S] = p(null);
  return re(() => h(!1), [e]), { run: async (_, x) => {
    if (!(s || _.length === 0)) {
      S(null), l(!0);
      try {
        await a.post(`${I}/items/reanalyze`, { keys: _ }), h(!0), n();
      } catch (R) {
        const L = ye(R), $ = L.code === "reanalyze_in_flight" ? "The Radar Lead is still re-analyzing the last request. Nothing new was sent." : `Could not ask the Radar Lead to re-analyze: ${L.error || "the gateway refused it"}. Nothing was sent.`;
        S({ keys: _, from: x, why: $ });
      } finally {
        l(!1);
      }
    }
  }, busy: s, inFlight: o || !!((N = e == null ? void 0 : e.reanalyze) != null && N.in_flight), failed: m };
}
function ft({
  needs: e,
  handled: n,
  onChanged: a,
  onWhy: s
}) {
  var H;
  const l = ie(), o = mt(a), h = gt(e, a), m = e == null ? void 0 : e.reanalyze, S = m ? m.total > m.keys.length ? `Re-analyze ${m.keys.length} of ${m.total} stale` : `Re-analyze ${m.total} stale` : "", b = (e == null ? void 0 : e.fixes) || [], N = (e == null ? void 0 : e.fix_batches) || [], _ = new Map(N.map((i) => [i.session_key, i])), x = new Map(((e == null ? void 0 : e.handoffs) || []).map((i) => [i.key, i.handoff])), R = (i) => {
    const u = x.get(i.key);
    return i.handoff_title ? { title: i.handoff_title || (u == null ? void 0 : u.title) || "", prompt: (u == null ? void 0 : u.prompt) || "", repo: (u == null ? void 0 : u.repo) || "" } : void 0;
  }, L = (((H = ((e == null ? void 0 : e.groups) || []).find((i) => i.id === "decide")) == null ? void 0 : H.entries) || []).filter((i) => i.handoff_title && !i.dispatch && !o.sent[i.key] && x.has(i.key)).map((i) => ({ key: i.key, repo: x.get(i.key).repo || "" })), [$, A] = p(/* @__PURE__ */ new Set()), D = L.filter((i) => !$.has(i.key)), d = new Set(D.map((i) => i.repo.toLowerCase())).size > 1 ? "one repo per batch: exclude the others from their ▾" : D.length > Ce ? `at most ${Ce} per batch: exclude some from their ▾` : "", [y, M] = p(null), j = async (i, u, c, f) => {
    var F, E;
    try {
      c && await l.post(`${I}/items/reply/draft`, { key: i, text: u });
      const J = await l.post(`${I}/items/reply/send`, { key: i });
      return B((X) => new Set(X).add(f)), a(), { ok: !0, link: String(((E = (F = J == null ? void 0 : J.item) == null ? void 0 : F.replied) == null ? void 0 : E.permalink) || "") };
    } catch (J) {
      return { ok: !1, why: J.message || "unknown error" };
    }
  }, v = (e == null ? void 0 : e.replied) || [], [g, C] = p(""), k = async (i) => {
    C("");
    try {
      await l.post(`${I}/items/handoff/dismiss`, { key: i }), a();
    } catch {
      C(i);
    }
  }, [w, B] = p(/* @__PURE__ */ new Set()), [z, Q] = p(null);
  re(() => B(/* @__PURE__ */ new Set()), [e]);
  const U = async (i, u, c) => {
    Q(null), c && B((f) => new Set(f).add(c));
    try {
      for (const f of i) await l.post(`${I}/items/handle`, { key: f, how: u });
      a();
    } catch {
      c && B((f) => {
        const F = new Set(f);
        return F.delete(c), F;
      }), Q({ keys: i, how: u, rowId: c });
    }
  }, ne = ((e == null ? void 0 : e.groups) || []).map((i) => ({
    ...i,
    shown: i.entries.filter((u) => !w.has(`${i.id}:${u.key}`))
  })), G = ne.every((i) => i.shown.length === 0), q = (z == null ? void 0 : z.how) === "reopen" ? "reopen" : (z == null ? void 0 : z.how) === "ignored" ? "ignore" : "mark as done";
  return /* @__PURE__ */ r(K, { className: "mb-4", children: [
    /* @__PURE__ */ r("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ t(te, { children: "Needs you" }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      m && (m.total > 0 || h.inFlight) && /* @__PURE__ */ t(
        T,
        {
          primary: !0,
          style: P,
          "data-testid": "reanalyze",
          title: "Ask the Radar Lead to re-read these threads and rewrite or withdraw each draft. Nothing is sent to Slack.",
          disabled: h.busy || h.inFlight || m.keys.length === 0,
          onClick: () => h.run(m.keys, "card"),
          children: h.busy || h.inFlight ? /* @__PURE__ */ r(W, { children: [
            /* @__PURE__ */ t("span", { className: "sr-spin", "aria-hidden": !0 }),
            "Re-analyzing…"
          ] }) : S
        }
      )
    ] }),
    h.failed && h.failed.from === "card" && /* @__PURE__ */ t(ee, { message: h.failed.why, onRetry: () => h.run(h.failed.keys, "card") }),
    z && /* @__PURE__ */ t(
      ee,
      {
        message: `Could not ${q} that message. Nothing changed.`,
        onRetry: () => U(z.keys, z.how, z.rowId)
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
          i.id === "decide" && L.length >= 2 && /* @__PURE__ */ r(W, { children: [
            d && /* @__PURE__ */ t("span", { className: "text-xs text-muted", role: "status", children: d }),
            /* @__PURE__ */ t(
              T,
              {
                style: P,
                onClick: () => o.dispatchBatch(D.map((u) => u.key)),
                disabled: o.busy.size > 0 || D.length === 0 || !!d,
                children: D.length > 0 && o.busy.has(D[0].key) && o.busy.size > 1 ? /* @__PURE__ */ r(W, { children: [
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
          ut,
          {
            g: i,
            render: (u, c) => /* @__PURE__ */ t(
              ht,
              {
                e: u,
                groupId: i.id,
                first: c === 0,
                onOpen: () => M({ e: u, groupId: i.id }),
                onMark: (f) => {
                  var F;
                  return U((F = u.members) != null && F.length ? u.members : [u.key], f, `${i.id}:${u.key}`);
                },
                onDispatch: i.id === "decide" && u.handoff_title ? () => o.dispatch(u.key) : void 0,
                busy: o.busy.has(u.key),
                fix: i.id === "decide" ? R(u) : void 0,
                sentHere: o.sent[u.key],
                failed: i.id === "decide" ? o.failed[u.key] : void 0,
                excluded: $.has(u.key),
                onExclude: i.id === "decide" && L.length >= 2 && L.some((f) => f.key === u.key) ? (f) => A((F) => {
                  const E = new Set(F);
                  return f ? E.add(u.key) : E.delete(u.key), E;
                }) : void 0
              },
              u.key
            )
          }
        )
      ] }, i.id)
    ) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" }),
    g && /* @__PURE__ */ t(ee, { message: "Could not dismiss that hand-off. Nothing changed.", onRetry: () => k(g) }),
    b.length > 0 && /* @__PURE__ */ r("details", { style: { marginTop: 12 }, "data-testid": "fixes-in-flight", children: [
      /* @__PURE__ */ r("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Fixes in flight (",
        (e == null ? void 0 : e.fixes_total) ?? b.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: b.map((i, u) => {
        const c = i.dispatch.batch ? _.get(i.dispatch.session_key) : void 0, f = c && c.keys[0] === i.key, F = { padding: "6px 0", borderTop: u === 0 ? 0 : "1px solid var(--border)" }, E = i.dispatch.pr_url && /* @__PURE__ */ r(W, { children: [
          " · ",
          /* @__PURE__ */ r("a", { className: "underline", href: i.dispatch.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
            "PR #",
            i.dispatch.pr_number
          ] })
        ] });
        return /* @__PURE__ */ r("li", { className: "text-sm", style: c ? { ...F, ...f ? {} : { borderTop: 0, paddingTop: 0 } } : F, children: [
          f && c && /* @__PURE__ */ r("div", { "data-testid": "fix-batch-header", style: { marginBottom: 4 }, children: [
            /* @__PURE__ */ t(fe, { d: c }),
            /* @__PURE__ */ r("span", { className: "text-xs text-muted", children: [
              " · ",
              ge[c.state] || c.state || "sent",
              " · ",
              /* @__PURE__ */ t("span", { className: "font-mono", children: c.repo }),
              " · ",
              c.prs_found,
              " PRs found / ",
              c.total,
              " · ",
              V(c.at)
            ] })
          ] }),
          /* @__PURE__ */ r("div", { className: "flex items-center gap-2", style: c ? { paddingLeft: 16 } : void 0, children: [
            /* @__PURE__ */ r("span", { style: { flex: 1, minWidth: 0 }, children: [
              c ? i.handoff_title : /* @__PURE__ */ r(W, { children: [
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
              E,
              /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: /* @__PURE__ */ t(ze, { ts: i.latest_reply }) })
            ] }),
            /* @__PURE__ */ t(T, { style: P, onClick: () => k(i.key), children: "Dismiss" })
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
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: n.map((i, u) => /* @__PURE__ */ r(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: u === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 0 }, children: i.summary || i.text.slice(0, 200) }),
            /* @__PURE__ */ r("span", { className: "text-xs text-muted", children: [
              i.handled_how === "ignored" ? "Ignored" : "Done",
              " ",
              V(i.handled_at)
            ] }),
            /* @__PURE__ */ t(T, { style: P, onClick: () => U([i.key], "reopen"), children: "Reopen" })
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
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: v.map((i, u) => /* @__PURE__ */ r(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: u === 0 ? 0 : "1px solid var(--border)" },
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
    y && /* @__PURE__ */ t(
      pt,
      {
        e: y.e,
        groupId: y.groupId,
        sentHere: !!o.sent[y.e.key],
        onClose: () => M(null),
        onSend: (i, u) => j(y.e.key, i, u, `${y.groupId}:${y.e.key}`),
        onMark: (i) => {
          var u;
          return U((u = y.e.members) != null && u.length ? y.e.members : [y.e.key], i, `${y.groupId}:${y.e.key}`);
        },
        onWhy: () => s(y.e),
        onDispatch: y.groupId === "decide" && y.e.handoff_title ? () => o.dispatch(y.e.key) : void 0,
        busy: o.busy.has(y.e.key),
        reanalyze: h
      },
      `${y.groupId}:${y.e.key}`
    ),
    o.ui
  ] });
}
function yt({ it: e, first: n, checked: a, onToggle: s }) {
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
        onChange: s,
        style: { marginTop: 4 }
      }
    ),
    /* @__PURE__ */ r("div", { className: "flex items-center gap-1", style: { flex: "none" }, children: [
      /* @__PURE__ */ t(Y, { variant: tt(e.status), children: e.status }),
      l && /* @__PURE__ */ t(Y, { variant: l.variant, children: l.label }),
      o.length > 0 && /* @__PURE__ */ r("span", { className: "text-xs text-muted", title: o.join(`
`), "aria-label": o.join("; "), children: [
        "+",
        o.length
      ] })
    ] }),
    /* @__PURE__ */ r("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || e.text.slice(0, 280) }),
      /* @__PURE__ */ r("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        /* @__PURE__ */ t("span", { "data-testid": "ledger-ts", "data-ts": e.ts_float, children: V(e.ts_float) }),
        " · ",
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        e.user && /* @__PURE__ */ r(W, { children: [
          " · ",
          e.user
        ] }),
        e.reply_count > 0 && /* @__PURE__ */ r(W, { children: [
          " · ",
          e.reply_count,
          " replies"
        ] }),
        " · ",
        /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "open in Slack" }),
        e.links.length > 0 && /* @__PURE__ */ r(W, { children: [
          " · linked ",
          e.links.map((h) => /* @__PURE__ */ t("a", { className: "underline mr-2", href: h, target: "_blank", rel: "noreferrer noopener", children: h.replace("https://github.com/", "") }, h))
        ] })
      ] }),
      e.note && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: e.note })
    ] })
  ] }) });
}
function xt(e) {
  var n, a;
  return !!((n = e.reply_draft) != null && n.text || (a = e.fix_handoff) != null && a.prompt || e.possibly_resolved);
}
const bt = ["", "p0", "p1", "p2", "p3", "none"];
function vt(e) {
  const { state: n, items: a, selected: s, setSelected: l } = e, [o, h] = p(""), [m, S] = p(""), [b, N] = p(""), [_, x] = p(!1), R = n.counts.open_by_priority, L = he(() => [...new Set(a.map((d) => d.category).filter(Boolean))].sort(), [a]), $ = he(
    () => a.filter((d) => !m || (m === "none" ? !d.priority : d.priority === m)).filter((d) => !b || d.category === b).filter((d) => !_ || xt(d)).sort((d, y) => (y.ts_float || 0) - (d.ts_float || 0)),
    [a, m, b, _]
  ), A = (d) => {
    const y = new Set(s);
    y.has(d) ? y.delete(d) : y.add(d), l(y);
  }, D = he(
    () => n.settings.channels.map((d) => ({ cid: d, ...n.channels[d] || {} })),
    [n]
  ), O = "text-sm bg-transparent border rounded px-2 py-1";
  return /* @__PURE__ */ r("div", { style: { minWidth: 0 }, children: [
    /* @__PURE__ */ r("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4", children: [
      /* @__PURE__ */ t(ce, { label: "Awaiting triage", value: n.counts.needs_triage, accent: !0 }),
      /* @__PURE__ */ t(ce, { label: "Possibly resolved", value: n.counts.possibly_resolved }),
      /* @__PURE__ */ t(ce, { label: "Open p0 / p1", value: `${R.p0 || 0} / ${R.p1 || 0}` }),
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
        /* @__PURE__ */ t("select", { id: "sr-priority", className: O, value: m, onChange: (d) => S(d.target.value), children: bt.map((d) => /* @__PURE__ */ t("option", { value: d, children: d || "all" }, d)) }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-category", children: "Category" }),
        /* @__PURE__ */ r("select", { id: "sr-category", className: O, value: b, onChange: (d) => N(d.target.value), children: [
          /* @__PURE__ */ t("option", { value: "", children: "all" }),
          L.map((d) => /* @__PURE__ */ t("option", { value: d, children: d }, d))
        ] }),
        /* @__PURE__ */ r("label", { className: "text-sm flex items-center gap-1", style: { cursor: "pointer" }, children: [
          /* @__PURE__ */ t("input", { type: "checkbox", checked: _, onChange: (d) => x(d.target.checked) }),
          "Needs me"
        ] }),
        /* @__PURE__ */ t("div", { className: "flex-1" }),
        /* @__PURE__ */ t(
          Z,
          {
            "aria-label": "GitHub repository to search (owner/name, optional)",
            placeholder: "owner/repo (optional)",
            value: o,
            onChange: (d) => h(d.target.value),
            className: "w-48"
          }
        ),
        /* @__PURE__ */ r(T, { onClick: () => e.onInvestigate(o), disabled: s.size === 0 || !!e.busy, children: [
          "Investigate ",
          s.size || ""
        ] })
      ] }),
      $.length === 0 ? /* @__PURE__ */ t(
        Ye,
        {
          icon: /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "📡" }),
          title: a.length ? "Nothing matches these filters" : "Nothing here yet",
          subtitle: a.length ? "Change a filter to see more." : "New messages appear after the next poll."
        }
      ) : /* @__PURE__ */ t("ul", { className: "flex flex-col", "data-testid": "ledger-list", children: $.map((d, y) => /* @__PURE__ */ t(yt, { it: d, first: y === 0, checked: s.has(d.key), onToggle: () => A(d.key) }, d.key)) })
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
const wt = 5;
function kt(e) {
  const n = e.split(`
`).map((s) => s.trim()).filter(Boolean), a = n.filter((s) => /^[•\-–]\s/.test(s));
  return (a.length ? a : n).slice(0, wt);
}
function Nt({ state: e, busy: n, onDigest: a }) {
  const s = e.digest, l = e.crew.today, o = kt(s.last_text || ""), h = e.settings.digest_destination === "self_dm" ? "DMed to you" : "dashboard notification";
  return /* @__PURE__ */ r(K, { className: "mb-4", "data-testid": "today-card", children: [
    /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ t(te, { children: "Today" }),
      s.pending ? /* @__PURE__ */ t(Y, { variant: "aim", children: "digest being delivered" }) : null,
      s.last_posted_date && /* @__PURE__ */ r("span", { className: "text-xs text-muted", "data-testid": "digest-time", children: [
        "digest ",
        s.last_posted_date,
        " · ",
        h
      ] }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      /* @__PURE__ */ t(T, { style: P, onClick: a, disabled: !!n || !e.crew.live, children: "Digest now" })
    ] }),
    (l == null ? void 0 : l.text) && /* @__PURE__ */ r("p", { style: { margin: "8px 0 0", fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }, "data-testid": "crew-today", children: [
      l.text,
      l.at > 0 && /* @__PURE__ */ r("span", { className: "text-xs text-muted", style: { fontWeight: 400 }, children: [
        " · ",
        V(l.at)
      ] })
    ] }),
    s.last_text ? /* @__PURE__ */ r(W, { children: [
      /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", "data-testid": "digest-top", style: { margin: "8px 0 0", padding: 0, listStyle: "none" }, children: o.map((m, S) => /* @__PURE__ */ t("li", { children: m }, S)) }),
      /* @__PURE__ */ t(xe, { summary: "Full digest", children: /* @__PURE__ */ t("pre", { className: "whitespace-pre-wrap text-sm", style: { fontFamily: "inherit", margin: 0 }, children: s.last_text }) })
    ] }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { margin: "8px 0 0" }, "data-testid": "digest-empty", children: "No digest yet" }),
    s.last_error && /* @__PURE__ */ t("p", { className: "text-xs mt-1", style: { color: "var(--danger)" }, children: s.last_error })
  ] });
}
function _t({ state: e }) {
  return /* @__PURE__ */ t("div", { className: "flex items-center gap-2", style: { marginTop: 10 }, children: de.map((n) => /* @__PURE__ */ r("span", { title: `${n.title} · ${se(n, e).label}`, children: [
    /* @__PURE__ */ t(be, { m: n, s: e, selected: n.id === "lead", size: 30 }),
    /* @__PURE__ */ t("span", { className: "sr-only", children: `${n.title}: ${se(n, e).label}` })
  ] }, n.id)) });
}
function St(e) {
  const n = `slack-radar:chat-open:${e}`, a = () => {
    try {
      return window.localStorage.getItem(n) === "1";
    } catch {
      return !1;
    }
  }, [s, l] = p(a);
  re(() => l(a()), [n]);
  const o = ue(
    (h) => {
      l(h);
      try {
        h ? window.localStorage.setItem(n, "1") : window.localStorage.removeItem(n);
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
function $t(e) {
  const n = ie(), { state: a, expanded: s, pending: l } = e, o = de[0], h = a.crew.slot_key, m = a.crew.live && a.crew.session_open && a.crew.session_agent === a.crew.agent, [S, b] = p(""), [N, _] = p(!1), [x, R] = p(""), [L, $] = p(!1), A = se(o, a), D = async (v) => {
    await n.post(`${I}/crew/message`, { message: v }), e.onChanged();
  }, O = async (v) => {
    const g = v.trim();
    if (g) {
      _(!0), R("");
      try {
        await n.post(`${I}/crew/message`, { message: g }), b(""), g === l && e.setPending(""), e.setExpanded(!0), e.onChanged();
      } catch {
        R(g);
      } finally {
        _(!1);
      }
    }
  }, d = async () => {
    try {
      await navigator.clipboard.writeText(l), $(!0), window.setTimeout(() => $(!1), 1500);
    } catch {
      $(!1);
    }
  }, y = x && /* @__PURE__ */ t(ee, { message: "The Radar Lead did not get that message.", onRetry: () => O(x) }), M = /* @__PURE__ */ t("div", { className: "text-sm", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }, children: a.crew.live ? /* @__PURE__ */ r(W, { children: [
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
            v.preventDefault(), O(S);
          },
          children: [
            /* @__PURE__ */ t(be, { m: o, s: a, size: 26 }),
            /* @__PURE__ */ t(
              Z,
              {
                "aria-label": "Ask the lead",
                placeholder: "Ask the lead…",
                value: S,
                onChange: (v) => b(v.target.value),
                disabled: !m || N,
                style: { flex: 1, minWidth: 200 }
              }
            ),
            /* @__PURE__ */ t(T, { primary: !0, type: "submit", disabled: !m || N || !S.trim(), children: "Send" }),
            ke.map((v) => /* @__PURE__ */ t(Te, { q: v, onClick: () => O(v), disabled: !m || N }, v))
          ]
        }
      ),
      !m && /* @__PURE__ */ t("div", { style: { marginTop: 8 }, children: M }),
      y
    ] });
  const j = e.events.filter((v) => v.kind === "crew" || v.kind === "digest").slice(0, 5);
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
          /* @__PURE__ */ t(_t, { state: a })
        ] }),
        /* @__PURE__ */ t(et, { state: a }),
        l && // ChatEmbed has no API to fill its composer, so the question waits here.
        /* @__PURE__ */ r(
          "div",
          {
            className: "text-sm flex flex-wrap items-center gap-2",
            style: { padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" },
            children: [
              /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200, userSelect: "all" }, children: l }),
              /* @__PURE__ */ t(T, { primary: !0, style: P, onClick: () => O(l), disabled: !m || N, children: "Send" }),
              /* @__PURE__ */ t(T, { style: P, onClick: d, children: L ? "Copied" : "Copy" })
            ]
          }
        ),
        y && /* @__PURE__ */ t("div", { style: { padding: "0 16px" }, children: y }),
        /* @__PURE__ */ t("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: m ? /* @__PURE__ */ t(
          Ue,
          {
            slotKey: h,
            agent: a.crew.agent,
            frameless: !0,
            startAtBottom: !0,
            placeholder: "Ask the Radar Lead…",
            onSend: D
          },
          h
        ) : /* @__PURE__ */ r("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 10 }, children: [
          M,
          !e.configured && /* @__PURE__ */ t("p", { className: "text-xs text-muted", children: "Add a channel in Settings first." }),
          j.length > 0 && /* @__PURE__ */ t("ul", { className: "text-xs text-muted flex flex-col gap-1", style: { marginTop: 6 }, children: j.map((v, g) => /* @__PURE__ */ r("li", { children: [
            V(v.at),
            " · ",
            v.text
          ] }, `${v.at}-${g}`)) })
        ] }) }),
        /* @__PURE__ */ t("div", { className: "flex flex-wrap gap-2", style: { padding: "10px 16px 12px", borderTop: "1px solid var(--border)" }, children: ke.map((v) => /* @__PURE__ */ t(Te, { q: v, onClick: () => O(v), disabled: !m || N }, v)) })
      ]
    }
  );
}
function Ct({ state: e }) {
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
function Tt({ events: e, kinds: n, onShowAll: a }) {
  const s = n ? e.filter((l) => n.includes(l.kind)) : e;
  return /* @__PURE__ */ r(K, { children: [
    /* @__PURE__ */ t(te, { children: "Activity" }),
    n && /* @__PURE__ */ r("p", { className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { marginBottom: 8 }, children: [
      /* @__PURE__ */ t("span", { children: "Showing the crew and its members only." }),
      /* @__PURE__ */ t(T, { style: P, onClick: a, children: "Show all" })
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
function Rt({
  state: e,
  busy: n,
  act: a,
  mcp: s,
  onProbe: l
}) {
  const o = ie(), [h, m] = p(e.settings.channels.join(`
`)), [S, b] = p(e.settings.digest_destination), [N, _] = p(e.settings.slack_login), [x, R] = p(e.settings.slack_mcp_command), [L, $] = p(e.settings.workspace_url), [A, D] = p(String(e.settings.poll_interval_secs)), [O, d] = p(String(e.settings.backfill_hours)), [y, M] = p(e.crew.unattended), [j, v] = p(e.crew.agent), [g, C] = p(e.crew.model), k = () => a(
    "Save settings",
    () => o.put(`${I}/settings`, {
      channels: h.split(/[\s,]+/).map((w) => w.trim()).filter(Boolean),
      digest_destination: S,
      slack_login: N.trim(),
      slack_mcp_command: x.trim(),
      workspace_url: L.trim(),
      poll_interval_secs: Number(A),
      backfill_hours: Number(O)
    })
  );
  return /* @__PURE__ */ r(W, { children: [
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
          value: h,
          onChange: (w) => m(w.target.value)
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
              onChange: (w) => b(w.target.value),
              children: [
                /* @__PURE__ */ t("option", { value: "dashboard", children: "Dashboard notification only" }),
                /* @__PURE__ */ t("option", { value: "self_dm", children: "DM to myself in Slack" })
              ]
            }
          )
        ] }),
        S === "self_dm" && /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "Your Slack login (for the DM)",
          /* @__PURE__ */ t(Z, { value: N, onChange: (w) => _(w.target.value), placeholder: "jdoe" })
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
          /* @__PURE__ */ t(Z, { value: x, onChange: (w) => R(w.target.value), placeholder: "ai-community-slack-mcp" })
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
            /* @__PURE__ */ t(Z, { value: j, onChange: (w) => v(w.target.value), placeholder: "slack-radar-crew" }),
            /* @__PURE__ */ t("span", { className: "block text-xs text-muted mt-1", children: "Default: the shipped slack-radar-crew agent. Your own agents are never modified." })
          ] }),
          /* @__PURE__ */ r("label", { className: "text-sm", children: [
            "Model (empty = agent default)",
            /* @__PURE__ */ t(Z, { value: g, onChange: (w) => C(w.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ r("div", { className: "mt-3 flex items-center gap-2", children: [
          /* @__PURE__ */ t(
            Re,
            {
              checked: y,
              onChange: M,
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
            onClick: () => a("Save crew", () => o.put(`${I}/crew`, { agent: j, model: g, unattended: y })),
            children: "Save crew"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  Ft as default
};
