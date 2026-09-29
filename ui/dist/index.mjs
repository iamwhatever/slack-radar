import { jsxs as s, Fragment as A, jsx as t } from "react/jsx-runtime";
import * as xe from "@kirocrew/app-sdk";
import { useAppApi as se, ChatEmbed as Ke } from "@kirocrew/app-sdk";
import { PageHeader as je, Toggle as $e, Btn as _, Card as M, CardTitle as J, StatCard as le, Input as Y, EmptyState as Ue, Badge as G } from "@kirocrew/app-sdk/ui";
import { useState as p, useCallback as pe, useEffect as ee, useRef as ne, useMemo as oe } from "react";
const W = "/api/apps/slack-radar", He = {
  checking: "checking…",
  connected: "connected",
  needs_login: "sign in again",
  binary_not_found: "not installed",
  incompatible: "missing read access",
  error: "not working"
}, be = ["What needs me today?", "Draft today's digest", "Which threads look resolved?"], Ge = [
  { id: "board", label: "Board" },
  { id: "ledger", label: "Ledger" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" }
], ae = (e) => e ? new Date(e * 1e3).toLocaleString() : "never";
function H(e) {
  if (!e) return "never";
  const n = Math.max(0, Date.now() / 1e3 - e);
  return n < 90 ? "just now" : n < 3600 ? `${Math.round(n / 60)} min ago` : n < 86400 ? `${Math.round(n / 3600)} h ago` : ae(e);
}
function Ce(e, n) {
  return n === "needs_login" ? "needs_login" : (e == null ? void 0 : e.status) || "checking";
}
function ge({ children: e, summary: n = "Details" }) {
  return /* @__PURE__ */ s("details", { className: "text-xs text-muted", style: { marginTop: 6 }, children: [
    /* @__PURE__ */ t("summary", { style: { cursor: "pointer" }, children: n }),
    /* @__PURE__ */ t("div", { style: { marginTop: 4 }, children: e })
  ] });
}
const re = [
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
], ce = (e, n) => {
  var a;
  return (a = e.now) == null ? void 0 : a.members.find((r) => r.id === n);
};
function q(e, n) {
  var l;
  const a = ce(n, e.id);
  if (e.id === "lead")
    return (a == null ? void 0 : a.state) === "paused" || !n.crew.live ? { label: "paused", tone: "muted" } : (a ? a.state === "working" : n.crew.running) ? { label: "working", tone: "aim" } : { label: "live", tone: "ok" };
  if (e.id === "poller")
    return n.source_state === "needs_login" ? { label: "sign in again", tone: "warn" } : (a == null ? void 0 : a.state) === "paused" ? { label: "paused", tone: "warn" } : { label: `polled ${H(n.last_poll_at)}`, tone: "muted" };
  const r = a ? a.count : e.id === "investigator" && ((l = n.investigations) == null ? void 0 : l.running) || 0;
  return r ? { label: `${r} running`, tone: "aim" } : (a == null ? void 0 : a.state) === "planned" ? { label: "not started yet", tone: "muted" } : { label: "idle", tone: "muted" };
}
function Z(e) {
  if (!e) return "--";
  const n = new Date(e * 1e3), a = n.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: !1 });
  return n.toDateString() === (/* @__PURE__ */ new Date()).toDateString() ? a : `${n.toLocaleDateString([], { month: "short", day: "numeric" })} ${a}`;
}
function Ye(e) {
  if (!e) return "";
  const n = Math.round(e - Date.now() / 1e3);
  return n <= 0 ? "now" : Te(Date.now() / 1e3 - n);
}
function Qe(e, n) {
  if (!(n != null && n.last)) return "";
  const { started_at: a, finished_at: r } = n.last;
  if (e.id === "poller") {
    if (!a) return "has not polled yet";
    const l = Ye(n.next_at);
    return `last ${Z(a)}${l ? ` · next ${l === "now" ? "due now" : `in ${l}`}` : ""}`;
  }
  return e.id === "lead" ? a ? `last wake ${Z(a)}` : "not woken yet" : a ? r ? `last run ${Z(a)}–${Z(r)}` : `last run ${Z(a)}` : "last run --";
}
function Je(e) {
  var n, a;
  return !(e != null && e.ran) || e.ran === "running" ? "" : e.ran === "never" ? "never ran" : `idle since ${Z(((n = e.last) == null ? void 0 : n.finished_at) || ((a = e.last) == null ? void 0 : a.started_at))}`;
}
function Te(e) {
  if (!e) return "";
  const n = Math.max(0, Math.round(Date.now() / 1e3 - e));
  return n < 90 ? `${n}s` : n < 90 * 60 ? `${Math.round(n / 60)}m` : `${Math.round(n / 3600)}h`;
}
const Re = (e, n = 60) => e.length > n ? `${e.slice(0, n - 1).trimEnd()}…` : e;
function ve(e, n) {
  const a = ce(n, e.id);
  if (!a) return q(e, n).label;
  const r = Qe(e, a);
  return e.id === "poller" ? r && a.state === "paused" ? `${a.doing.split(" · ")[0]} · ${r}` : r || a.doing : a.state !== "working" ? a.state === "paused" ? `paused: ${a.doing}` : r || q(e, n).label : e.id === "lead" ? `working: ${a.doing}` : `${a.count} running: ${a.doing}`;
}
const Ve = `@keyframes slack-radar-pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.7) } }
.sr-pulse { animation: slack-radar-pulse 1.4s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .sr-pulse { animation: none } }`;
function We({ tone: e, pulse: n }) {
  return /* @__PURE__ */ t(
    "i",
    {
      "aria-hidden": !0,
      className: n ? "sr-pulse" : void 0,
      style: { width: 8, height: 8, borderRadius: "50%", flex: "none", display: "inline-block", background: Le[e] }
    }
  );
}
function De({ m: e, state: n, withName: a = !0, withResting: r = !1, onOpen: l }) {
  const o = q(e, n), c = ce(n, e.id), m = c ? c.state === "working" : o.tone === "aim", w = r && (e.id === "investigator" || e.id === "watcher") ? Je(c) : "", y = w ? `${w} · ${ve(e, n)}` : ve(e, n), h = e.id === "lead" && n.crew.name || e.title, $ = /* @__PURE__ */ s(A, { children: [
    /* @__PURE__ */ t(We, { tone: o.tone, pulse: m }),
    a && /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: h }),
    /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: Re(y) })
  ] }), S = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    fontSize: 13,
    opacity: m || o.tone === "warn" ? 1 : 0.6,
    color: "var(--text)"
  }, x = { title: `${h} · ${y}`, "data-member": e.id, "data-state": (c == null ? void 0 : c.state) || (m ? "working" : "idle") };
  return l ? /* @__PURE__ */ t(
    "button",
    {
      type: "button",
      onClick: l,
      ...x,
      "aria-label": `${h}: ${y}. Show activity`,
      style: { ...S, background: "transparent", border: 0, padding: 0, cursor: "pointer" },
      children: $
    }
  ) : /* @__PURE__ */ t("span", { ...x, style: S, children: $ });
}
function qe({ state: e, onOpenActivity: n }) {
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
        re.map((a) => /* @__PURE__ */ t(
          De,
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
function Xe({ state: e }) {
  const n = re.filter((a) => a.id === "investigator" || a.id === "watcher").map((a) => ({ m: a, row: ce(e, a.id) })).filter(({ row: a }) => (a == null ? void 0 : a.state) === "working");
  return n.length ? /* @__PURE__ */ t("div", { "data-testid": "chat-running", style: { padding: "6px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" }, children: n.map(({ m: a, row: r }) => {
    const l = Te(r.since), o = `${a.title} running${r.count > 1 ? ` (${r.count})` : ""} · ${r.doing}${l ? ` · ${l}` : ""}`;
    return /* @__PURE__ */ s("div", { className: "text-xs flex items-center gap-2", title: o, style: { minWidth: 0 }, children: [
      /* @__PURE__ */ t(We, { tone: "aim", pulse: !0 }),
      /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: o })
    ] }, a.id);
  }) }) : null;
}
const Le = {
  ok: "var(--ok)",
  aim: "var(--aim)",
  warn: "var(--warn)",
  muted: "var(--muted-strong)"
};
function ye({ m: e, s: n, selected: a, size: r = 32 }) {
  const l = q(e, n), o = e.planned || e.id === "poller", c = {
    width: r,
    height: r,
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
          background: Le[l.tone]
        }
      }
    )
  ] });
}
function Ze(e) {
  return e === "new" ? "warn" : e === "investigating" ? "aim" : e === "resolved" ? "ok" : "muted";
}
function et({ tab: e, setTab: n }) {
  return /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Slack Radar sections", style: { display: "flex", gap: 4 }, children: Ge.map((a) => {
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
function tt({
  state: e,
  configured: n,
  busy: a,
  onStart: r,
  onPause: l
}) {
  const o = e.crew.live;
  return /* @__PURE__ */ s("div", { className: "flex items-center gap-2", title: !o && !n ? "Add a channel in Settings first" : void 0, children: [
    /* @__PURE__ */ t("span", { className: "text-sm", children: "Crew" }),
    /* @__PURE__ */ t(
      $e,
      {
        checked: o,
        disabled: !!a || !o && !n,
        onChange: (m) => m ? r() : l(),
        label: o ? "Pause the crew" : "Start the crew"
      }
    ),
    /* @__PURE__ */ s("span", { className: "text-xs text-muted", title: "Whether the crew's commands run without asking you", children: [
      "Unattended: ",
      e.crew.trusted ? "on" : "off"
    ] })
  ] });
}
function Wt() {
  const e = se(), [n, a] = p("board"), [r, l] = p(null), [o, c] = p([]), [m, w] = p(null), [y, h] = p([]), [$, S] = p([]), [x, D] = p("open"), [P, L] = p(/* @__PURE__ */ new Set()), [B, R] = p(""), [d, b] = p(""), [N, T] = p(null), [f, I] = p(null), [K, j] = p(null), C = pe(async () => {
    try {
      T(await e.get(`${W}/mcp/status`));
    } catch (F) {
      T({ status: "error", command: "", detail: F.message });
    }
  }, [e]);
  ee(() => {
    C();
  }, [C]);
  const z = pe(async () => {
    var F;
    try {
      const [Q, X, ie, V, ze] = await Promise.all([
        e.get(`${W}/state`),
        e.get(`${W}/items?status=${encodeURIComponent(x)}&limit=300`),
        e.get(`${W}/events?limit=150`),
        e.get(`${W}/needs`),
        e.get(`${W}/items?handled=1&limit=100`)
      ]);
      l(Q), I(((F = Q.now) == null ? void 0 : F.members) || null), c(X.items), w(V), h(ze.items), S(ie.events.slice().reverse());
    } catch (Q) {
      b(`Could not load: ${Q.message}`);
    }
  }, [e, x]);
  ee(() => {
    z();
    const F = window.setInterval(z, 3e4);
    return () => window.clearInterval(F);
  }, [z]);
  const i = !!(f != null && f.some((F) => F.state === "working")), u = ne("");
  ee(() => {
    if (!i) return;
    const F = async () => {
      try {
        const X = await e.get(`${W}/now`);
        I(X.members);
        const ie = X.members.map((V) => `${V.id}:${V.state}:${V.count}`).join(",");
        if (u.current && ie !== u.current) {
          const V = await e.get(`${W}/events?limit=150`);
          S(V.events.slice().reverse());
        }
        u.current = ie;
      } catch {
      }
    }, Q = window.setInterval(F, 5e3);
    return () => window.clearInterval(Q);
  }, [i, e]);
  const v = oe(() => r && f ? { ...r, now: { members: f } } : r, [r, f]), g = () => {
    j(["member", "crew", "investigate"]), a("activity");
  }, k = async (F, Q) => {
    R(F), b("");
    try {
      await Q(), b(`${F}: done`), await z();
    } catch (X) {
      b(`${F} failed: ${X.message}`);
    } finally {
      R("");
    }
  }, U = !!r && r.settings.channels.length > 0, E = (r == null ? void 0 : r.settings.channels.length) || 0, he = r ? `${E ? `Watching ${E} channel${E === 1 ? "" : "s"}` : "No channels yet"} · ${r.crew.live ? "running" : "paused"}` : "A small crew triaging your Slack channels", Ee = r ? Ce(N, r.source_state) : "checking", Me = () => {
    C(), z();
  };
  return /* @__PURE__ */ s(A, { children: [
    /* @__PURE__ */ t(
      je,
      {
        title: "Slack Radar",
        subtitle: he,
        actions: /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-4", children: [
          /* @__PURE__ */ t(
            et,
            {
              tab: n,
              setTab: (F) => {
                j(null), a(F);
              }
            }
          ),
          r && /* @__PURE__ */ t(
            tt,
            {
              state: r,
              configured: U,
              busy: B,
              onStart: () => k("Start crew", () => e.post(`${W}/crew/start`, {})),
              onPause: () => k("Pause crew", () => e.post(`${W}/crew/pause`, {}))
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ t("style", { children: Ve }),
    /* @__PURE__ */ s("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      v && n === "board" && /* @__PURE__ */ t(qe, { state: v, onOpenActivity: g }),
      r && Ee === "needs_login" && /* @__PURE__ */ t(nt, { mcp: N, sourceError: r.source_error, busy: B, onCheck: Me }),
      d && /* @__PURE__ */ t("p", { role: "status", className: "text-sm text-muted mb-3", children: d }),
      v ? n === "board" ? /* @__PURE__ */ t(
        at,
        {
          state: v,
          needs: m,
          handled: y,
          configured: U,
          mcp: N,
          busy: B,
          onPoll: () => k("Poll", () => e.post(`${W}/poll`, {})),
          onStart: () => k("Start crew", () => e.post(`${W}/crew/start`, {})),
          onDigest: () => k("Digest now", () => e.post(`${W}/digest/request`, {})),
          events: $,
          onChanged: z
        }
      ) : n === "ledger" ? /* @__PURE__ */ t(
        yt,
        {
          state: v,
          items: o,
          filter: x,
          setFilter: D,
          selected: P,
          setSelected: L,
          busy: B,
          onInvestigate: (F) => k("Investigate", async () => {
            await e.post(`${W}/investigate`, { keys: [...P], repo: F }), L(/* @__PURE__ */ new Set());
          })
        }
      ) : n === "team" ? /* @__PURE__ */ t(Nt, { state: v }) : n === "activity" ? /* @__PURE__ */ t(_t, { events: $, kinds: K, onShowAll: () => j(null) }) : /* @__PURE__ */ t(St, { state: v, busy: B, act: k, mcp: N, onProbe: C }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" })
    ] })
  ] });
}
function Ie({ mcp: e, sourceError: n }) {
  var r;
  const a = [
    (e == null ? void 0 : e.status) && `status: ${e.status}`,
    (e == null ? void 0 : e.command) && `command: ${e.command}`,
    n && `error: ${n}`,
    (e == null ? void 0 : e.detail) && e.detail !== n && `detail: ${e.detail}`,
    ((r = e == null ? void 0 : e.missing_read_tools) == null ? void 0 : r.length) && `missing read tools: ${e.missing_read_tools.join(", ")}`
  ].filter(Boolean);
  return a.length ? /* @__PURE__ */ t(ge, { children: /* @__PURE__ */ t("pre", { className: "font-mono whitespace-pre-wrap", style: { margin: 0 }, children: a.join(`
`) }) }) : null;
}
function nt({ mcp: e, sourceError: n, busy: a, onCheck: r }) {
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
          /* @__PURE__ */ t(_, { primary: !0, onClick: r, disabled: !!a, children: "I signed in, check again" })
        ] }),
        /* @__PURE__ */ t(Ie, { mcp: e, sourceError: n })
      ]
    }
  );
}
function Ae({ mcp: e, state: n, withPoll: a, action: r }) {
  const l = Ce(e, n.source_state), o = l === "connected";
  return /* @__PURE__ */ s("div", { className: r ? "mb-3" : "mb-4", "data-testid": r ? "connection-line" : void 0, children: [
    /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ s("p", { role: "status", className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { margin: 0, flex: 1, minWidth: 0 }, children: [
        /* @__PURE__ */ t("span", { "aria-hidden": !0, style: { width: 8, height: 8, borderRadius: "50%", background: o ? "var(--ok)" : l === "checking" ? "var(--muted-strong)" : "var(--warn)", display: "inline-block" } }),
        /* @__PURE__ */ s("span", { children: [
          "Slack connection: ",
          /* @__PURE__ */ t("span", { style: { color: o ? "var(--text)" : "var(--warn)" }, children: He[l] || l })
        ] }),
        a && /* @__PURE__ */ s("span", { children: [
          "· last poll ",
          H(n.last_poll_at),
          n.settings.channels.length > 0 && /* @__PURE__ */ s(A, { children: [
            " · watching ",
            n.settings.channels.join(", ")
          ] })
        ] })
      ] }),
      r
    ] }),
    !o && l !== "needs_login" && /* @__PURE__ */ t(Ie, { mcp: e, sourceError: n.source_error })
  ] });
}
function at(e) {
  const { state: n } = e, [a, r] = p(""), [l, o] = wt(n.crew.slot_key), c = ne(null), m = (w) => {
    r(st(w)), o(!0), window.requestAnimationFrame(() => {
      var y;
      return (y = c.current) == null ? void 0 : y.scrollIntoView({ block: "end", behavior: "smooth" });
    });
  };
  return /* @__PURE__ */ s("div", { "data-testid": "board", style: { minWidth: 0 }, children: [
    /* @__PURE__ */ t(
      Ae,
      {
        mcp: e.mcp,
        state: n,
        withPoll: !0,
        action: /* @__PURE__ */ t(_, { style: O, onClick: e.onPoll, disabled: !!e.busy || !e.configured, children: "Poll now" })
      }
    ),
    !e.configured && /* @__PURE__ */ s(M, { className: "mb-4", children: [
      /* @__PURE__ */ t(J, { children: "Finish setup" }),
      /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite." })
    ] }),
    /* @__PURE__ */ t(bt, { state: n, busy: e.busy, onDigest: e.onDigest }),
    /* @__PURE__ */ t(pt, { needs: e.needs, handled: e.handled, onChanged: e.onChanged, onWhy: m }),
    /* @__PURE__ */ t(
      "div",
      {
        ref: c,
        "data-testid": "chat-bar",
        "data-expanded": l ? "true" : "false",
        style: { position: "sticky", bottom: 0, zIndex: 5, marginTop: 8, borderRadius: 12, boxShadow: "0 -6px 18px rgba(0,0,0,.18)" },
        children: /* @__PURE__ */ t(
          kt,
          {
            state: n,
            events: e.events,
            configured: e.configured,
            busy: e.busy,
            expanded: l,
            setExpanded: o,
            pending: a,
            setPending: r,
            onStart: e.onStart,
            onChanged: e.onChanged
          }
        )
      }
    )
  ] });
}
const we = {
  decide: "Needs a decision",
  unanswered: "Questions nobody answered",
  clusters: "Reported more than once"
};
function ke(e) {
  return e < 1 ? `${Math.max(1, Math.round(e * 60))} min ago` : e < 48 ? `${Math.round(e)} h ago` : `${Math.floor(e / 24)} days ago`;
}
const Ne = 5;
function st(e) {
  return `Why is "${e.summary.length > 80 ? `${e.summary.slice(0, 79)}…` : e.summary}" ${e.priority || "on my list"}?`;
}
function Be(e) {
  return e ? /* @__PURE__ */ t(G, { variant: e === "p0" || e === "p1" ? "err" : "muted", children: e }) : null;
}
function te({ message: e, onRetry: n }) {
  return /* @__PURE__ */ s(
    "div",
    {
      role: "alert",
      className: "text-sm flex flex-wrap items-center gap-2",
      style: { border: "1px solid var(--danger)", borderRadius: 8, padding: "8px 12px", margin: "8px 0" },
      children: [
        /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200 }, children: e }),
        /* @__PURE__ */ t(_, { onClick: n, children: "Try again" })
      ]
    }
  );
}
const O = { fontSize: 12, padding: "2px 10px" }, fe = (e, n) => e === "decide" && !!n.reply_draft && !n.handoff_title;
function Pe(e, n) {
  return e === "decide" && n.dispatch ? "Done" : e === "decide" && n.handoff_title ? "Dispatch fix" : fe(e, n) ? "Open" : e === "decide" && n.reason.startsWith("Looks resolved") ? "Done" : e === "unanswered" && n.permalink ? "Reply" : "Decide";
}
function me(e) {
  return e.replace(/<([@#!])([^>|]+)\|([^>]+)>/g, (n, a, r, l) => `${a === "#" ? "#" : "@"}${l}`).replace(/<([@#!])([^>|]+)>/g, (n, a, r) => `${a === "#" ? "#" : "@"}${r}`).replace(/<([^>|]+)\|([^>]+)>/g, "$2").replace(/<([^>]+)>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
const Oe = (e, n = 90) => Re(me(e).split(`
`).map((a) => a.trim()).find(Boolean) || "", n), rt = (e) => new Date(e * 1e3).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), it = 3600;
function lt({
  e,
  groupId: n,
  first: a,
  onOpen: r,
  onMark: l,
  onDispatch: o,
  busy: c
}) {
  const m = Pe(n, e), w = fe(n, e), y = e.dispatch, h = () => {
    m === "Dispatch fix" ? o == null || o() : m === "Done" ? l("done") : m === "Reply" && e.permalink ? window.open(e.permalink, "_blank", "noopener,noreferrer") : r();
  };
  return /* @__PURE__ */ t(
    "li",
    {
      className: "text-sm",
      "data-testid": "need-row",
      "data-priority": e.priority || "",
      "data-age-hours": e.age_hours,
      style: { padding: "8px 0", borderTop: a ? 0 : "1px solid var(--border)" },
      children: /* @__PURE__ */ s("div", { className: "flex items-start gap-2", children: [
        /* @__PURE__ */ t("div", { style: { flex: "none", minWidth: 28 }, children: Be(e.priority) }),
        /* @__PURE__ */ s("div", { style: { minWidth: 0, flex: 1 }, children: [
          /* @__PURE__ */ t(
            "button",
            {
              type: "button",
              "data-testid": "need-open",
              onClick: r,
              title: "Open the message and its thread",
              style: { border: 0, background: "transparent", padding: 0, margin: 0, textAlign: "left", cursor: "pointer", width: "100%", color: "inherit", font: "inherit" },
              children: w ? /* @__PURE__ */ s(A, { children: [
                /* @__PURE__ */ s("div", { style: { color: "var(--text-strong)" }, children: [
                  /* @__PURE__ */ t("span", { "data-testid": "reply-ready", children: /* @__PURE__ */ t(G, { variant: "aim", children: "Reply ready" }) }),
                  " ",
                  /* @__PURE__ */ t("span", { "data-testid": "need-first-line", children: Oe(e.text || e.summary) || "(no text)" })
                ] }),
                /* @__PURE__ */ s("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
                  e.user || "someone",
                  " · ",
                  /* @__PURE__ */ t("span", { "data-testid": "need-age", children: ke(e.age_hours) })
                ] })
              ] }) : /* @__PURE__ */ s(A, { children: [
                /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
                /* @__PURE__ */ s("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
                  e.reason,
                  " · ",
                  /* @__PURE__ */ t("span", { "data-testid": "need-age", children: ke(e.age_hours) })
                ] })
              ] })
            }
          ),
          y && /* @__PURE__ */ s("div", { className: "text-xs", style: { marginTop: 2 }, "data-testid": "fix-in-progress", children: [
            /* @__PURE__ */ t(de, { d: y }),
            " · ",
            ue[y.state] || y.state,
            y.pr_url && /* @__PURE__ */ s(A, { children: [
              " · ",
              /* @__PURE__ */ s("a", { className: "underline", href: y.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
                "PR #",
                y.pr_number
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ t("div", { className: "flex items-center gap-1", style: { flex: "none" }, "data-testid": "need-actions", children: /* @__PURE__ */ t(_, { primary: !0, style: O, onClick: h, disabled: m === "Dispatch fix" && c, children: m === "Dispatch fix" && c ? "Dispatching…" : m }) })
      ] })
    }
  );
}
function ot({
  e,
  groupId: n,
  onClose: a,
  onSend: r,
  onMark: l,
  onWhy: o,
  onDispatch: c,
  busy: m
}) {
  const w = fe(n, e), y = Pe(n, e), [h, $] = p(e.reply_draft || ""), [S, x] = p(!1), [D, P] = p(null), [L, B] = p(""), R = ne(null), d = ne(null), b = ne(null), N = e.key.replace(/[^A-Za-z0-9]/g, "-"), T = `sr-detail-${N}`, f = `sr-reply-${N}`, I = e.replies || [], K = e.last_thread_check_at || 0, j = K > 0 && Date.now() / 1e3 - K > it;
  ee(() => {
    const g = document.activeElement;
    return window.requestAnimationFrame(() => {
      var k;
      return (k = w ? d.current : b.current) == null ? void 0 : k.focus();
    }), () => {
      g && g.isConnected && g.focus();
    };
  }, []);
  const C = async () => {
    const g = h.trim();
    B(""), x(!0);
    const k = await r(g, g !== (e.reply_draft || "").trim());
    x(!1), k.ok ? P(k.link) : B(k.why);
  }, z = (g) => {
    if (g.key === "Escape") {
      g.stopPropagation(), a();
      return;
    }
    if (g.key !== "Tab" || !R.current) return;
    const k = [...R.current.querySelectorAll("a[href], button:not([disabled]), textarea, input, select")];
    if (k.length === 0) return;
    const U = k[0], E = k[k.length - 1];
    g.shiftKey && document.activeElement === U ? (g.preventDefault(), E.focus()) : !g.shiftKey && document.activeElement === E && (g.preventDefault(), U.focus());
  }, i = (g) => () => {
    g(), a();
  }, u = { marginTop: 14 }, v = { margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "var(--text-strong)" };
  return /* @__PURE__ */ t(
    "div",
    {
      "data-testid": "need-detail-backdrop",
      onMouseDown: (g) => g.target === g.currentTarget && a(),
      style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.35)", display: "flex", justifyContent: "flex-end" },
      children: /* @__PURE__ */ s(
        "div",
        {
          ref: R,
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": T,
          "data-testid": "need-detail",
          onKeyDown: z,
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
            /* @__PURE__ */ s("div", { className: "flex items-start gap-2", children: [
              /* @__PURE__ */ t("div", { style: { flex: "none" }, children: Be(e.priority) }),
              /* @__PURE__ */ t("h3", { id: T, style: { margin: 0, flex: 1, fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }, children: Oe(e.text || e.summary, 80) || "(no text)" }),
              /* @__PURE__ */ t(
                "button",
                {
                  ref: b,
                  type: "button",
                  "aria-label": "Close",
                  onClick: a,
                  style: { border: 0, background: "transparent", cursor: "pointer", padding: "0 6px", fontSize: 18, lineHeight: 1, color: "var(--muted)" },
                  children: "×"
                }
              )
            ] }),
            /* @__PURE__ */ s("section", { "aria-label": "Original message", "data-testid": "detail-original", style: u, children: [
              /* @__PURE__ */ t("h4", { style: v, children: "Original message" }),
              /* @__PURE__ */ s("div", { className: "text-xs text-muted", children: [
                /* @__PURE__ */ t("span", { "data-testid": "detail-author", children: e.user || "someone" }),
                " · ",
                /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
                " · ",
                ae(e.ts_float),
                e.permalink && /* @__PURE__ */ s(A, { children: [
                  " · ",
                  /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open in Slack" })
                ] })
              ] }),
              /* @__PURE__ */ t("p", { style: { margin: "6px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }, "data-testid": "detail-text", children: me(e.text || e.summary) || "(no text)" })
            ] }),
            /* @__PURE__ */ s("section", { "aria-label": "Thread replies", "data-testid": "detail-replies", style: u, children: [
              /* @__PURE__ */ s("h4", { style: v, children: [
                "Thread replies (",
                I.length,
                ")",
                j && /* @__PURE__ */ s("span", { className: "text-xs text-muted", style: { fontWeight: 400 }, "data-testid": "replies-stale", children: [
                  " · ",
                  "replies as of ",
                  rt(K)
                ] })
              ] }),
              I.length === 0 ? /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: 0 }, children: "No replies yet" }) : /* @__PURE__ */ t("ol", { className: "flex flex-col", style: { margin: 0, padding: 0, listStyle: "none" }, children: I.map((g, k) => /* @__PURE__ */ s("li", { style: { padding: "4px 0", borderTop: k === 0 ? 0 : "1px solid var(--border)" }, children: [
                /* @__PURE__ */ s("div", { className: "text-xs text-muted", children: [
                  g.user || "someone",
                  " · ",
                  ae(Number(g.ts))
                ] }),
                /* @__PURE__ */ t("div", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" }, children: me(g.text) })
              ] }, `${g.ts}-${k}`)) })
            ] }),
            !w && /* @__PURE__ */ s("section", { "aria-label": "Why it is here", style: u, className: "text-xs text-muted", children: [
              e.reason,
              e.category && /* @__PURE__ */ s(A, { children: [
                " · ",
                e.category
              ] }),
              e.words && e.words.length > 0 && /* @__PURE__ */ s(A, { children: [
                " · shared words: ",
                e.words.join(", ")
              ] }),
              e.members && e.members.length > 0 && /* @__PURE__ */ s(A, { children: [
                " · Done and Ignore apply to all ",
                e.members.length
              ] }),
              e.handoff_title && !e.dispatch && /* @__PURE__ */ s("div", { style: { marginTop: 4, color: "var(--text)" }, children: [
                "Fix: ",
                e.handoff_title
              ] })
            ] }),
            w && /* @__PURE__ */ s("section", { "aria-label": "Reply draft", "data-testid": "detail-draft", style: u, children: [
              /* @__PURE__ */ t("label", { htmlFor: f, style: { ...v, display: "block" }, children: "Reply to the thread, sent as you" }),
              /* @__PURE__ */ s("div", { className: "text-xs text-muted", "data-testid": "draft-by", children: [
                e.reply_draft_by === "owner" ? "Edited by you" : "Drafted by the Radar Lead",
                e.reply_draft_at ? ` · ${H(e.reply_draft_at)}` : ""
              ] }),
              /* @__PURE__ */ t(
                "textarea",
                {
                  id: f,
                  ref: d,
                  value: h,
                  maxLength: 1500,
                  rows: 6,
                  readOnly: D !== null,
                  onChange: (g) => $(g.target.value),
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
            L && /* @__PURE__ */ t(te, { message: `Could not send that reply: ${L}`, onRetry: C }),
            D !== null ? /* @__PURE__ */ s("div", { style: u, className: "flex flex-wrap items-center gap-2", children: [
              /* @__PURE__ */ s("p", { role: "status", style: { margin: 0, flex: 1 }, children: [
                "Sent as you",
                D && /* @__PURE__ */ s(A, { children: [
                  " · ",
                  /* @__PURE__ */ t("a", { className: "underline", href: D, target: "_blank", rel: "noreferrer noopener", "data-testid": "sent-link", children: "Open the reply in Slack" })
                ] })
              ] }),
              /* @__PURE__ */ t(_, { primary: !0, style: O, onClick: a, children: "Close" })
            ] }) : /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-1", style: u, "data-testid": "detail-actions", children: [
              w && /* @__PURE__ */ t(_, { primary: !0, style: O, disabled: !h.trim() || S, onClick: C, children: S ? "Sending…" : "Send to thread" }),
              y === "Dispatch fix" && /* @__PURE__ */ t(_, { primary: !0, style: O, disabled: m, onClick: i(() => c == null ? void 0 : c()), children: "Dispatch fix" }),
              y === "Reply" && e.permalink && /* @__PURE__ */ t(_, { primary: !0, style: O, onClick: () => window.open(e.permalink, "_blank", "noopener,noreferrer"), children: "Reply" }),
              /* @__PURE__ */ t(_, { style: O, onClick: i(() => l("done")), children: w ? "Done without sending" : "Done" }),
              /* @__PURE__ */ t(_, { style: O, onClick: i(() => l("ignored")), children: "Ignore" }),
              /* @__PURE__ */ t(_, { style: O, onClick: i(o), children: "Why? Ask the lead" })
            ] }),
            y === "Reply" && D === null && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "6px 0 0" }, children: "Reply opens the thread in Slack." })
          ]
        }
      )
    }
  );
}
function dt({ g: e, render: n }) {
  const [a, r] = p(!1), l = a ? e.shown : e.shown.slice(0, Ne), o = e.shown.length - l.length;
  return /* @__PURE__ */ s(A, { children: [
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: l.map(n) }),
    (o > 0 || a && e.shown.length > Ne) && /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        className: "text-xs underline",
        onClick: () => r(!a),
        style: { border: 0, background: "transparent", cursor: "pointer", padding: "4px 0", color: "var(--muted)" },
        children: a ? "Show fewer" : `Show ${o} more`
      }
    )
  ] });
}
const Fe = typeof xe.useChatLauncher == "function" ? xe.useChatLauncher : () => null, ue = { running: "working", idle: "waiting", closed: "session closed", unknown: "" };
function de({ d: e }) {
  const n = Fe(), a = `/chat?sid=${encodeURIComponent(e.session_key)}`;
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
function _e(e) {
  try {
    return JSON.parse(String(e.body || "{}"));
  } catch {
    return {};
  }
}
function ct(e) {
  const n = se(), a = Fe(), [r, l] = p(""), [o, c] = p(null), [m, w] = p(null), [y, h] = p(null), [$, S] = p(null), [x, D] = p(!1), P = async (d) => {
    if (!r) {
      l(d), w(null);
      try {
        const b = await n.post(`${W}/items/handoff/dispatch`, { key: d });
        b.mode === "server" ? c({ session_key: b.session_key, title: b.title }) : a ? a.openChat({ agent: b.agent, message: b.seed, autoSend: !0 }) : (D(!1), S({ title: b.title, seed: b.seed })), e();
      } catch (b) {
        const N = _e(b);
        N.code === "already_dispatched" && N.session_key ? c({ session_key: N.session_key, title: N.title || "", again: !0 }) : w({ key: d, why: N.error || "the gateway refused it" });
      } finally {
        l("");
      }
    }
  }, L = async (d) => {
    var b;
    if (r || d.length === 0) return !1;
    l("batch"), h(null);
    try {
      const N = await n.post(`${W}/items/handoff/dispatch-batch`, { keys: d });
      return N.mode === "server" ? c({ session_key: N.session_key, title: N.title, batch: !0 }) : a ? a.openChat({ agent: N.agent, message: N.seed, autoSend: !0 }) : (D(!1), S({ title: N.title, seed: N.seed })), e(), !0;
    } catch (N) {
      const T = _e(N), f = (b = T.dispatched) != null && b.length ? `${T.dispatched.length} of them already have a session` : T.error || "the gateway refused it";
      return h({ keys: d, why: f }), !1;
    } finally {
      l("");
    }
  }, B = async () => {
    if ($)
      try {
        await navigator.clipboard.writeText($.seed), D(!0);
      } catch {
        D(!1);
      }
  }, R = /* @__PURE__ */ s(A, { children: [
    m && /* @__PURE__ */ t(te, { message: `Could not dispatch that fix: ${m.why}. Nothing was sent.`, onRetry: () => P(m.key) }),
    y && /* @__PURE__ */ t(
      te,
      {
        message: `Could not dispatch those fixes: ${y.why}. Nothing was sent.`,
        onRetry: () => L(y.keys)
      }
    ),
    o && /* @__PURE__ */ s(
      "div",
      {
        role: "status",
        "data-testid": "dispatch-toast",
        className: "text-sm flex items-center gap-2",
        style: { position: "fixed", right: 16, bottom: 16, zIndex: 40, background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "8px 12px", maxWidth: 480 },
        children: [
          /* @__PURE__ */ s("span", { style: { flex: 1, minWidth: 0 }, children: [
            o.again ? "Already dispatched: " : o.batch ? "Fixes dispatched to one conductor: " : "Fix dispatched to a conductor: ",
            /* @__PURE__ */ t(de, { d: o })
          ] }),
          /* @__PURE__ */ t(_, { style: O, onClick: () => c(null), children: "Close" })
        ]
      }
    ),
    $ && /* @__PURE__ */ t(
      "div",
      {
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "sr-fix-title",
        style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" },
        onKeyDown: (d) => d.key === "Escape" && S(null),
        children: /* @__PURE__ */ s("div", { style: { width: "min(720px, 92vw)", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: 16 }, children: [
          /* @__PURE__ */ t("h3", { id: "sr-fix-title", className: "text-sm", style: { margin: "0 0 6px", fontWeight: 600 }, children: $.title }),
          /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 8px" }, children: "This Kiro Crew cannot open the session for you. Copy this task into a new kirocrew-conductor chat." }),
          /* @__PURE__ */ t(
            "textarea",
            {
              readOnly: !0,
              "aria-label": "Fix task",
              value: $.seed,
              style: { width: "100%", height: 260, fontSize: 12, fontFamily: "var(--font-mono, monospace)" }
            }
          ),
          /* @__PURE__ */ s("div", { className: "flex items-center gap-2", style: { marginTop: 8 }, children: [
            /* @__PURE__ */ t(_, { onClick: B, children: x ? "Copied" : "Copy task" }),
            /* @__PURE__ */ t("a", { className: "underline text-sm", href: "/chat?new=1", children: "New chat" }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(_, { onClick: () => S(null), children: "Close" })
          ] })
        ] })
      }
    )
  ] });
  return { dispatch: P, dispatchBatch: L, busyKey: r, ui: R };
}
function ht({
  rows: e,
  busy: n,
  onSend: a,
  onCancel: r
}) {
  const [l, o] = p(() => new Set(e.map((h) => h.key))), c = e.filter((h) => l.has(h.key)), w = new Set(c.map((h) => h.repo.toLowerCase())).size > 1, y = (h) => o(($) => {
    const S = new Set($);
    return S.has(h) ? S.delete(h) : S.add(h), S;
  });
  return /* @__PURE__ */ s(
    "section",
    {
      "aria-label": "Dispatch fixes together",
      "data-testid": "batch-panel",
      style: { margin: "8px 0", padding: 10, border: "1px solid var(--border-strong)", borderRadius: 8 },
      children: [
        /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 6px" }, children: "One conductor gets every checked fix and splits the work. Uncheck any you want to leave out." }),
        /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { margin: 0, padding: 0, listStyle: "none" }, children: e.map((h, $) => /* @__PURE__ */ t("li", { style: { padding: "6px 0", borderTop: $ === 0 ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ s("label", { className: "text-sm flex gap-2", style: { alignItems: "flex-start", cursor: "pointer" }, children: [
          /* @__PURE__ */ t("input", { type: "checkbox", checked: l.has(h.key), onChange: () => y(h.key), style: { marginTop: 3 } }),
          /* @__PURE__ */ s("span", { style: { flex: 1, minWidth: 0 }, children: [
            h.title,
            " ",
            /* @__PURE__ */ t("span", { className: "text-xs text-muted font-mono", children: h.repo }),
            /* @__PURE__ */ t("span", { className: "text-xs text-muted", style: { display: "block" }, children: h.prompt.length > 120 ? `${h.prompt.slice(0, 120)}…` : h.prompt })
          ] })
        ] }) }, h.key)) }),
        /* @__PURE__ */ s("div", { className: "flex items-center gap-2", style: { marginTop: 8 }, children: [
          /* @__PURE__ */ t(_, { primary: !0, style: O, disabled: n || c.length === 0 || w, onClick: () => a(c.map((h) => h.key)), children: n ? "Dispatching…" : `Dispatch ${c.length} to one conductor` }),
          /* @__PURE__ */ t(_, { style: O, onClick: r, disabled: n, children: "Cancel" }),
          w && /* @__PURE__ */ t("span", { className: "text-xs text-muted", role: "status", children: "one repo per batch" })
        ] })
      ]
    }
  );
}
function pt({
  needs: e,
  handled: n,
  onChanged: a,
  onWhy: r
}) {
  var z;
  const l = se(), o = ct(a), c = (e == null ? void 0 : e.fixes) || [], m = (e == null ? void 0 : e.fix_batches) || [], w = new Map(m.map((i) => [i.session_key, i])), y = new Map(((e == null ? void 0 : e.handoffs) || []).map((i) => [i.key, i.handoff])), h = (((z = ((e == null ? void 0 : e.groups) || []).find((i) => i.id === "decide")) == null ? void 0 : z.entries) || []).filter((i) => i.handoff_title && !i.dispatch && y.has(i.key)).map((i) => {
    const u = y.get(i.key);
    return { key: i.key, title: i.handoff_title || u.title, repo: u.repo || "", prompt: u.prompt || "" };
  }), [$, S] = p(!1), [x, D] = p(null), P = async (i, u, v, g) => {
    var k, U;
    try {
      v && await l.post(`${W}/items/reply/draft`, { key: i, text: u });
      const E = await l.post(`${W}/items/reply/send`, { key: i });
      return N((he) => new Set(he).add(g)), a(), { ok: !0, link: String(((U = (k = E == null ? void 0 : E.item) == null ? void 0 : k.replied) == null ? void 0 : U.permalink) || "") };
    } catch (E) {
      return { ok: !1, why: E.message || "unknown error" };
    }
  }, L = (e == null ? void 0 : e.replied) || [], [B, R] = p(""), d = async (i) => {
    R("");
    try {
      await l.post(`${W}/items/handoff/dismiss`, { key: i }), a();
    } catch {
      R(i);
    }
  }, [b, N] = p(/* @__PURE__ */ new Set()), [T, f] = p(null);
  ee(() => N(/* @__PURE__ */ new Set()), [e]);
  const I = async (i, u, v) => {
    f(null), v && N((g) => new Set(g).add(v));
    try {
      for (const g of i) await l.post(`${W}/items/handle`, { key: g, how: u });
      a();
    } catch {
      v && N((g) => {
        const k = new Set(g);
        return k.delete(v), k;
      }), f({ keys: i, how: u, rowId: v });
    }
  }, K = ((e == null ? void 0 : e.groups) || []).map((i) => ({
    ...i,
    shown: i.entries.filter((u) => !b.has(`${i.id}:${u.key}`))
  })), j = K.every((i) => i.shown.length === 0), C = (T == null ? void 0 : T.how) === "reopen" ? "reopen" : (T == null ? void 0 : T.how) === "ignored" ? "ignore" : "mark as done";
  return /* @__PURE__ */ s(M, { className: "mb-4", children: [
    /* @__PURE__ */ s("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ t(J, { children: "Needs you" }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      h.length >= 2 && !$ && /* @__PURE__ */ s(_, { style: O, onClick: () => S(!0), disabled: !!o.busyKey, children: [
        "Dispatch all fixes (",
        h.length,
        ")"
      ] })
    ] }),
    $ && h.length > 0 && /* @__PURE__ */ t(
      ht,
      {
        rows: h,
        busy: o.busyKey === "batch",
        onCancel: () => S(!1),
        onSend: async (i) => {
          await o.dispatchBatch(i) && S(!1);
        }
      }
    ),
    T && /* @__PURE__ */ t(
      te,
      {
        message: `Could not ${C} that message. Nothing changed.`,
        onRetry: () => I(T.keys, T.how, T.rowId)
      }
    ),
    e ? j ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Nothing needs you right now." }) : K.map(
      (i) => i.shown.length === 0 ? null : /* @__PURE__ */ s("section", { "aria-label": we[i.id], style: { marginTop: 10 }, children: [
        /* @__PURE__ */ s("h4", { className: "text-sm", style: { margin: 0, fontWeight: 600, color: "var(--text-strong)" }, children: [
          we[i.id],
          " ",
          /* @__PURE__ */ s("span", { className: "text-muted", style: { fontWeight: 400 }, children: [
            "(",
            i.total - (i.entries.length - i.shown.length),
            ")"
          ] })
        ] }),
        /* @__PURE__ */ t(
          dt,
          {
            g: i,
            render: (u, v) => /* @__PURE__ */ t(
              lt,
              {
                e: u,
                groupId: i.id,
                first: v === 0,
                onOpen: () => D({ e: u, groupId: i.id }),
                onMark: (g) => {
                  var k;
                  return I((k = u.members) != null && k.length ? u.members : [u.key], g, `${i.id}:${u.key}`);
                },
                onDispatch: i.id === "decide" && u.handoff_title ? () => o.dispatch(u.key) : void 0,
                busy: o.busyKey === u.key
              },
              u.key
            )
          }
        )
      ] }, i.id)
    ) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" }),
    B && /* @__PURE__ */ t(te, { message: "Could not dismiss that hand-off. Nothing changed.", onRetry: () => d(B) }),
    c.length > 0 && /* @__PURE__ */ s("details", { style: { marginTop: 12 }, "data-testid": "fixes-in-flight", children: [
      /* @__PURE__ */ s("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Fixes in flight (",
        (e == null ? void 0 : e.fixes_total) ?? c.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: c.map((i, u) => {
        const v = i.dispatch.batch ? w.get(i.dispatch.session_key) : void 0, g = v && v.keys[0] === i.key, k = { padding: "6px 0", borderTop: u === 0 ? 0 : "1px solid var(--border)" }, U = i.dispatch.pr_url && /* @__PURE__ */ s(A, { children: [
          " · ",
          /* @__PURE__ */ s("a", { className: "underline", href: i.dispatch.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
            "PR #",
            i.dispatch.pr_number
          ] })
        ] });
        return /* @__PURE__ */ s("li", { className: "text-sm", style: v ? { ...k, ...g ? {} : { borderTop: 0, paddingTop: 0 } } : k, children: [
          g && v && /* @__PURE__ */ s("div", { "data-testid": "fix-batch-header", style: { marginBottom: 4 }, children: [
            /* @__PURE__ */ t(de, { d: v }),
            /* @__PURE__ */ s("span", { className: "text-xs text-muted", children: [
              " · ",
              ue[v.state] || v.state || "sent",
              " · ",
              /* @__PURE__ */ t("span", { className: "font-mono", children: v.repo }),
              " · ",
              v.prs_found,
              " PRs found / ",
              v.total,
              " · ",
              H(v.at)
            ] })
          ] }),
          /* @__PURE__ */ s("div", { className: "flex items-center gap-2", style: v ? { paddingLeft: 16 } : void 0, children: [
            /* @__PURE__ */ s("span", { style: { flex: 1, minWidth: 0 }, children: [
              v ? i.handoff_title : /* @__PURE__ */ s(A, { children: [
                /* @__PURE__ */ t(de, { d: i.dispatch }),
                /* @__PURE__ */ s("span", { className: "text-xs text-muted", children: [
                  " · ",
                  ue[i.dispatch.state] || i.dispatch.state || "sent",
                  " · ",
                  /* @__PURE__ */ t("span", { className: "font-mono", children: i.repo }),
                  " · ",
                  H(i.dispatch.at)
                ] })
              ] }),
              U
            ] }),
            /* @__PURE__ */ t(_, { style: O, onClick: () => d(i.key), children: "Dismiss" })
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
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: n.map((i, u) => /* @__PURE__ */ s(
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
            /* @__PURE__ */ t(_, { style: O, onClick: () => I([i.key], "reopen"), children: "Reopen" })
          ]
        },
        i.key
      )) })
    ] }),
    L.length > 0 && /* @__PURE__ */ s("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ s("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Replied (",
        (e == null ? void 0 : e.replied_total) ?? L.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: L.map((i, u) => /* @__PURE__ */ s(
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
    x && /* @__PURE__ */ t(
      ot,
      {
        e: x.e,
        groupId: x.groupId,
        onClose: () => D(null),
        onSend: (i, u) => P(x.e.key, i, u, `${x.groupId}:${x.e.key}`),
        onMark: (i) => {
          var u;
          return I((u = x.e.members) != null && u.length ? x.e.members : [x.e.key], i, `${x.groupId}:${x.e.key}`);
        },
        onWhy: () => r(x.e),
        onDispatch: x.groupId === "decide" && x.e.handoff_title ? () => o.dispatch(x.e.key) : void 0,
        busy: o.busyKey === x.e.key
      },
      `${x.groupId}:${x.e.key}`
    ),
    o.ui
  ] });
}
function mt({ it: e, first: n, checked: a, onToggle: r }) {
  const l = e.priority ? { label: e.priority, variant: e.priority === "p0" || e.priority === "p1" ? "err" : "muted" } : e.possibly_resolved ? { label: "possibly resolved", variant: "warn" } : null, o = [
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
      /* @__PURE__ */ t(G, { variant: Ze(e.status), children: e.status }),
      l && /* @__PURE__ */ t(G, { variant: l.variant, children: l.label }),
      o.length > 0 && /* @__PURE__ */ s("span", { className: "text-xs text-muted", title: o.join(`
`), "aria-label": o.join("; "), children: [
        "+",
        o.length
      ] })
    ] }),
    /* @__PURE__ */ s("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || e.text.slice(0, 280) }),
      /* @__PURE__ */ s("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        /* @__PURE__ */ t("span", { "data-testid": "ledger-ts", "data-ts": e.ts_float, children: H(e.ts_float) }),
        " · ",
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        e.user && /* @__PURE__ */ s(A, { children: [
          " · ",
          e.user
        ] }),
        e.reply_count > 0 && /* @__PURE__ */ s(A, { children: [
          " · ",
          e.reply_count,
          " replies"
        ] }),
        " · ",
        /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "open in Slack" }),
        e.links.length > 0 && /* @__PURE__ */ s(A, { children: [
          " · linked ",
          e.links.map((c) => /* @__PURE__ */ t("a", { className: "underline mr-2", href: c, target: "_blank", rel: "noreferrer noopener", children: c.replace("https://github.com/", "") }, c))
        ] })
      ] }),
      e.note && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: e.note })
    ] })
  ] }) });
}
function ut(e) {
  var n, a;
  return !!((n = e.reply_draft) != null && n.text || (a = e.fix_handoff) != null && a.prompt || e.possibly_resolved);
}
const gt = ["", "p0", "p1", "p2", "p3", "none"];
function yt(e) {
  const { state: n, items: a, selected: r, setSelected: l } = e, [o, c] = p(""), [m, w] = p(""), [y, h] = p(""), [$, S] = p(!1), x = n.counts.open_by_priority, D = oe(() => [...new Set(a.map((d) => d.category).filter(Boolean))].sort(), [a]), P = oe(
    () => a.filter((d) => !m || (m === "none" ? !d.priority : d.priority === m)).filter((d) => !y || d.category === y).filter((d) => !$ || ut(d)).sort((d, b) => (b.ts_float || 0) - (d.ts_float || 0)),
    [a, m, y, $]
  ), L = (d) => {
    const b = new Set(r);
    b.has(d) ? b.delete(d) : b.add(d), l(b);
  }, B = oe(
    () => n.settings.channels.map((d) => ({ cid: d, ...n.channels[d] || {} })),
    [n]
  ), R = "text-sm bg-transparent border rounded px-2 py-1";
  return /* @__PURE__ */ s("div", { style: { minWidth: 0 }, children: [
    /* @__PURE__ */ s("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4", children: [
      /* @__PURE__ */ t(le, { label: "Awaiting triage", value: n.counts.needs_triage, accent: !0 }),
      /* @__PURE__ */ t(le, { label: "Possibly resolved", value: n.counts.possibly_resolved }),
      /* @__PURE__ */ t(le, { label: "Open p0 / p1", value: `${x.p0 || 0} / ${x.p1 || 0}` }),
      /* @__PURE__ */ t(le, { label: "Tracked items", value: n.counts.total })
    ] }),
    /* @__PURE__ */ s(M, { className: "mb-4", children: [
      /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-2 mb-3", children: [
        /* @__PURE__ */ t(J, { children: "Ledger" }),
        /* @__PURE__ */ s("span", { className: "text-xs text-muted", "data-testid": "ledger-count", children: [
          P.length,
          " of ",
          a.length,
          " · newest first"
        ] }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-filter", children: "Status" }),
        /* @__PURE__ */ s("select", { id: "sr-filter", className: R, value: e.filter, onChange: (d) => e.setFilter(d.target.value), children: [
          /* @__PURE__ */ t("option", { value: "open", children: "open" }),
          /* @__PURE__ */ t("option", { value: "new", children: "new" }),
          /* @__PURE__ */ t("option", { value: "triaged", children: "triaged" }),
          /* @__PURE__ */ t("option", { value: "investigating", children: "investigating" }),
          /* @__PURE__ */ t("option", { value: "resolved", children: "resolved" }),
          /* @__PURE__ */ t("option", { value: "noise", children: "noise" }),
          /* @__PURE__ */ t("option", { value: "", children: "all" })
        ] }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-priority", children: "Priority" }),
        /* @__PURE__ */ t("select", { id: "sr-priority", className: R, value: m, onChange: (d) => w(d.target.value), children: gt.map((d) => /* @__PURE__ */ t("option", { value: d, children: d || "all" }, d)) }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-category", children: "Category" }),
        /* @__PURE__ */ s("select", { id: "sr-category", className: R, value: y, onChange: (d) => h(d.target.value), children: [
          /* @__PURE__ */ t("option", { value: "", children: "all" }),
          D.map((d) => /* @__PURE__ */ t("option", { value: d, children: d }, d))
        ] }),
        /* @__PURE__ */ s("label", { className: "text-sm flex items-center gap-1", style: { cursor: "pointer" }, children: [
          /* @__PURE__ */ t("input", { type: "checkbox", checked: $, onChange: (d) => S(d.target.checked) }),
          "Needs me"
        ] }),
        /* @__PURE__ */ t("div", { className: "flex-1" }),
        /* @__PURE__ */ t(
          Y,
          {
            "aria-label": "GitHub repository to search (owner/name, optional)",
            placeholder: "owner/repo (optional)",
            value: o,
            onChange: (d) => c(d.target.value),
            className: "w-48"
          }
        ),
        /* @__PURE__ */ s(_, { onClick: () => e.onInvestigate(o), disabled: r.size === 0 || !!e.busy, children: [
          "Investigate ",
          r.size || ""
        ] })
      ] }),
      P.length === 0 ? /* @__PURE__ */ t(
        Ue,
        {
          icon: /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "📡" }),
          title: a.length ? "Nothing matches these filters" : "Nothing here yet",
          subtitle: a.length ? "Change a filter to see more." : "New messages appear after the next poll."
        }
      ) : /* @__PURE__ */ t("ul", { className: "flex flex-col", "data-testid": "ledger-list", children: P.map((d, b) => /* @__PURE__ */ t(mt, { it: d, first: b === 0, checked: r.has(d.key), onToggle: () => L(d.key) }, d.key)) })
    ] }),
    /* @__PURE__ */ s(M, { children: [
      /* @__PURE__ */ t(J, { children: "Channels" }),
      B.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No channels configured." }) : /* @__PURE__ */ s("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ t("thead", { children: /* @__PURE__ */ s("tr", { className: "text-left text-muted", children: [
          /* @__PURE__ */ t("th", { scope: "col", children: "Channel" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Last polled" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Status" })
        ] }) }),
        /* @__PURE__ */ t("tbody", { children: B.map((d) => /* @__PURE__ */ s("tr", { children: [
          /* @__PURE__ */ t("td", { className: "font-mono", children: d.cid }),
          /* @__PURE__ */ t("td", { children: ae(d.last_polled_at) }),
          /* @__PURE__ */ t("td", { children: d.last_error ? /* @__PURE__ */ t(G, { variant: "err", title: d.last_error, children: "error" }) : /* @__PURE__ */ t(G, { variant: "ok", children: "ok" }) })
        ] }, d.cid)) })
      ] })
    ] })
  ] });
}
const ft = 5;
function xt(e) {
  const n = e.split(`
`).map((r) => r.trim()).filter(Boolean), a = n.filter((r) => /^[•\-–]\s/.test(r));
  return (a.length ? a : n).slice(0, ft);
}
function bt({ state: e, busy: n, onDigest: a }) {
  const r = e.digest, l = e.crew.today, o = xt(r.last_text || ""), c = e.settings.digest_destination === "self_dm" ? "DMed to you" : "dashboard notification";
  return /* @__PURE__ */ s(M, { className: "mb-4", "data-testid": "today-card", children: [
    /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ t(J, { children: "Today" }),
      r.pending ? /* @__PURE__ */ t(G, { variant: "aim", children: "digest being delivered" }) : null,
      r.last_posted_date && /* @__PURE__ */ s("span", { className: "text-xs text-muted", "data-testid": "digest-time", children: [
        "digest ",
        r.last_posted_date,
        " · ",
        c
      ] }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      /* @__PURE__ */ t(_, { style: O, onClick: a, disabled: !!n || !e.crew.live, children: "Digest now" })
    ] }),
    (l == null ? void 0 : l.text) && /* @__PURE__ */ s("p", { style: { margin: "8px 0 0", fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }, "data-testid": "crew-today", children: [
      l.text,
      l.at > 0 && /* @__PURE__ */ s("span", { className: "text-xs text-muted", style: { fontWeight: 400 }, children: [
        " · ",
        H(l.at)
      ] })
    ] }),
    r.last_text ? /* @__PURE__ */ s(A, { children: [
      /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", "data-testid": "digest-top", style: { margin: "8px 0 0", padding: 0, listStyle: "none" }, children: o.map((m, w) => /* @__PURE__ */ t("li", { children: m }, w)) }),
      /* @__PURE__ */ t(ge, { summary: "Full digest", children: /* @__PURE__ */ t("pre", { className: "whitespace-pre-wrap text-sm", style: { fontFamily: "inherit", margin: 0 }, children: r.last_text }) })
    ] }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { margin: "8px 0 0" }, "data-testid": "digest-empty", children: "No digest yet" }),
    r.last_error && /* @__PURE__ */ t("p", { className: "text-xs mt-1", style: { color: "var(--danger)" }, children: r.last_error })
  ] });
}
function vt({ state: e }) {
  return /* @__PURE__ */ t("div", { className: "flex items-center gap-2", style: { marginTop: 10 }, children: re.map((n) => /* @__PURE__ */ s("span", { title: `${n.title} · ${q(n, e).label}`, children: [
    /* @__PURE__ */ t(ye, { m: n, s: e, selected: n.id === "lead", size: 30 }),
    /* @__PURE__ */ t("span", { className: "sr-only", children: `${n.title}: ${q(n, e).label}` })
  ] }, n.id)) });
}
function wt(e) {
  const n = `slack-radar:chat-open:${e}`, a = () => {
    try {
      return window.localStorage.getItem(n) === "1";
    } catch {
      return !1;
    }
  }, [r, l] = p(a);
  ee(() => l(a()), [n]);
  const o = pe(
    (c) => {
      l(c);
      try {
        c ? window.localStorage.setItem(n, "1") : window.localStorage.removeItem(n);
      } catch {
      }
    },
    [n]
  );
  return [r, o];
}
function Se({ q: e, onClick: n, disabled: a }) {
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
function kt(e) {
  const n = se(), { state: a, expanded: r, pending: l } = e, o = re[0], c = a.crew.slot_key, m = a.crew.live && a.crew.session_open && a.crew.session_agent === a.crew.agent, [w, y] = p(""), [h, $] = p(!1), [S, x] = p(""), [D, P] = p(!1), L = q(o, a), B = async (f) => {
    await n.post(`${W}/crew/message`, { message: f }), e.onChanged();
  }, R = async (f) => {
    const I = f.trim();
    if (I) {
      $(!0), x("");
      try {
        await n.post(`${W}/crew/message`, { message: I }), y(""), I === l && e.setPending(""), e.setExpanded(!0), e.onChanged();
      } catch {
        x(I);
      } finally {
        $(!1);
      }
    }
  }, d = async () => {
    try {
      await navigator.clipboard.writeText(l), P(!0), window.setTimeout(() => P(!1), 1500);
    } catch {
      P(!1);
    }
  }, b = S && /* @__PURE__ */ t(te, { message: "The Radar Lead did not get that message.", onRetry: () => R(S) }), N = /* @__PURE__ */ t("div", { className: "text-sm", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }, children: a.crew.live ? /* @__PURE__ */ s(A, { children: [
    /* @__PURE__ */ t("span", { children: "The Radar Lead session opens on its next turn. Open it now to talk here." }),
    /* @__PURE__ */ t(_, { primary: !0, onClick: e.onStart, disabled: !!e.busy || !e.configured, children: "Open the session" })
  ] }) : /* @__PURE__ */ s("span", { children: [
    "The Radar Lead is paused. Turn on ",
    /* @__PURE__ */ t("b", { children: "Crew" }),
    " at the top of the page to triage your channels and talk to it here."
  ] }) });
  if (!r)
    return /* @__PURE__ */ s(M, { style: { padding: "10px 14px" }, children: [
      /* @__PURE__ */ s(
        "form",
        {
          className: "flex flex-wrap items-center gap-2",
          onSubmit: (f) => {
            f.preventDefault(), R(w);
          },
          children: [
            /* @__PURE__ */ t(ye, { m: o, s: a, size: 26 }),
            /* @__PURE__ */ t(
              Y,
              {
                "aria-label": "Ask the lead",
                placeholder: "Ask the lead…",
                value: w,
                onChange: (f) => y(f.target.value),
                disabled: !m || h,
                style: { flex: 1, minWidth: 200 }
              }
            ),
            /* @__PURE__ */ t(_, { primary: !0, type: "submit", disabled: !m || h || !w.trim(), children: "Send" }),
            be.map((f) => /* @__PURE__ */ t(Se, { q: f, onClick: () => R(f), disabled: !m || h }, f))
          ]
        }
      ),
      !m && /* @__PURE__ */ t("div", { style: { marginTop: 8 }, children: N }),
      b
    ] });
  const T = e.events.filter((f) => f.kind === "crew" || f.kind === "digest").slice(0, 5);
  return /* @__PURE__ */ s(
    M,
    {
      style: { padding: 0, display: "flex", flexDirection: "column", height: "min(620px, calc(100vh - 240px))", overflow: "hidden" },
      children: [
        /* @__PURE__ */ s("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border)" }, children: [
          /* @__PURE__ */ s("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: a.crew.name || o.title }),
            /* @__PURE__ */ t(G, { variant: L.tone === "muted" ? "muted" : L.tone === "aim" ? "aim" : "ok", children: L.label }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(_, { onClick: () => e.setExpanded(!1), "aria-expanded": !0, children: "Collapse" })
          ] }),
          /* @__PURE__ */ s("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
            "phase ",
            a.crew_memory.phase,
            " · next: ",
            a.crew_memory.next || "—"
          ] }),
          /* @__PURE__ */ t(vt, { state: a })
        ] }),
        /* @__PURE__ */ t(Xe, { state: a }),
        l && // ChatEmbed has no API to fill its composer, so the question waits here.
        /* @__PURE__ */ s(
          "div",
          {
            className: "text-sm flex flex-wrap items-center gap-2",
            style: { padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" },
            children: [
              /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200, userSelect: "all" }, children: l }),
              /* @__PURE__ */ t(_, { primary: !0, style: O, onClick: () => R(l), disabled: !m || h, children: "Send" }),
              /* @__PURE__ */ t(_, { style: O, onClick: d, children: D ? "Copied" : "Copy" })
            ]
          }
        ),
        b && /* @__PURE__ */ t("div", { style: { padding: "0 16px" }, children: b }),
        /* @__PURE__ */ t("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: m ? /* @__PURE__ */ t(
          Ke,
          {
            slotKey: c,
            agent: a.crew.agent,
            frameless: !0,
            startAtBottom: !0,
            placeholder: "Ask the Radar Lead…",
            onSend: B
          },
          c
        ) : /* @__PURE__ */ s("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 10 }, children: [
          N,
          !e.configured && /* @__PURE__ */ t("p", { className: "text-xs text-muted", children: "Add a channel in Settings first." }),
          T.length > 0 && /* @__PURE__ */ t("ul", { className: "text-xs text-muted flex flex-col gap-1", style: { marginTop: 6 }, children: T.map((f, I) => /* @__PURE__ */ s("li", { children: [
            H(f.at),
            " · ",
            f.text
          ] }, `${f.at}-${I}`)) })
        ] }) }),
        /* @__PURE__ */ t("div", { className: "flex flex-wrap gap-2", style: { padding: "10px 16px 12px", borderTop: "1px solid var(--border)" }, children: be.map((f) => /* @__PURE__ */ t(Se, { q: f, onClick: () => R(f), disabled: !m || h }, f)) })
      ]
    }
  );
}
function Nt({ state: e }) {
  return /* @__PURE__ */ s(M, { children: [
    /* @__PURE__ */ t(J, { children: "Team" }),
    /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { marginBottom: 8 }, children: "Who works on your channels. Only the Radar Lead has a session; the others run when needed." }),
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: re.map((n) => {
      var r, l;
      const a = n.id === "lead" ? e.crew.agent : n.agent;
      return /* @__PURE__ */ s(
        "li",
        {
          className: "flex items-start gap-3",
          style: { padding: "12px 4px", borderTop: "1px solid var(--border)", opacity: n.planned ? 0.7 : 1 },
          children: [
            /* @__PURE__ */ t(ye, { m: n, s: e, size: 36 }),
            /* @__PURE__ */ s("div", { style: { minWidth: 0, flex: 1 }, children: [
              /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-2", children: [
                /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: n.id === "lead" && e.crew.name || n.title }),
                /* @__PURE__ */ t(G, { variant: "muted", children: n.layer }),
                /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: n.kind })
              ] }),
              /* @__PURE__ */ t("p", { className: "text-sm", style: { margin: "4px 0 0" }, children: n.duty }),
              n.id === "investigator" && (((r = e.investigations) == null ? void 0 : r.items) || 0) > 0 && /* @__PURE__ */ s("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: [
                (l = e.investigations) == null ? void 0 : l.items,
                " item(s) under investigation"
              ] }),
              a && /* @__PURE__ */ t(ge, { children: /* @__PURE__ */ s("span", { className: "font-mono", children: [
                "agent: ",
                a,
                n.id === "lead" && e.crew.slot_key ? ` · session: ${e.crew.slot_key}` : ""
              ] }) })
            ] }),
            /* @__PURE__ */ t("div", { "data-testid": `team-status-${n.id}`, style: { maxWidth: 360, minWidth: 0, display: "flex" }, children: /* @__PURE__ */ t(De, { m: n, state: e, withName: !1, withResting: !0 }) })
          ]
        },
        n.id
      );
    }) })
  ] });
}
function _t({ events: e, kinds: n, onShowAll: a }) {
  const r = n ? e.filter((l) => n.includes(l.kind)) : e;
  return /* @__PURE__ */ s(M, { children: [
    /* @__PURE__ */ t(J, { children: "Activity" }),
    n && /* @__PURE__ */ s("p", { className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { marginBottom: 8 }, children: [
      /* @__PURE__ */ t("span", { children: "Showing the crew and its members only." }),
      /* @__PURE__ */ t(_, { style: O, onClick: a, children: "Show all" })
    ] }),
    r.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No activity yet." }) : /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", children: r.map((l, o) => /* @__PURE__ */ s("li", { children: [
      /* @__PURE__ */ t("span", { className: "text-muted", children: ae(l.at) }),
      " ",
      /* @__PURE__ */ t(G, { variant: "muted", children: l.kind }),
      " ",
      l.text
    ] }, `${l.at}-${o}`)) })
  ] });
}
function St({
  state: e,
  busy: n,
  act: a,
  mcp: r,
  onProbe: l
}) {
  const o = se(), [c, m] = p(e.settings.channels.join(`
`)), [w, y] = p(e.settings.digest_destination), [h, $] = p(e.settings.slack_login), [S, x] = p(e.settings.slack_mcp_command), [D, P] = p(e.settings.workspace_url), [L, B] = p(String(e.settings.poll_interval_secs)), [R, d] = p(String(e.settings.backfill_hours)), [b, N] = p(e.crew.unattended), [T, f] = p(e.crew.agent), [I, K] = p(e.crew.model), j = () => a(
    "Save settings",
    () => o.put(`${W}/settings`, {
      channels: c.split(/[\s,]+/).map((C) => C.trim()).filter(Boolean),
      digest_destination: w,
      slack_login: h.trim(),
      slack_mcp_command: S.trim(),
      workspace_url: D.trim(),
      poll_interval_secs: Number(L),
      backfill_hours: Number(R)
    })
  );
  return /* @__PURE__ */ s(A, { children: [
    !e.vault_available && /* @__PURE__ */ t(M, { className: "mb-4", children: /* @__PURE__ */ t("p", { className: "text-sm", children: "The gateway secret vault is unavailable, so settings cannot be saved." }) }),
    /* @__PURE__ */ s(M, { className: "mb-4", children: [
      /* @__PURE__ */ t(J, { children: "Basics" }),
      /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(Ae, { mcp: r, state: e }) }),
        /* @__PURE__ */ t(_, { disabled: !!n, onClick: l, children: "Check connection" })
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
          onChange: (C) => m(C.target.value)
        }
      ),
      /* @__PURE__ */ s("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "Digest destination",
          /* @__PURE__ */ s(
            "select",
            {
              className: "block w-full text-sm bg-transparent border rounded px-2 py-1",
              value: w,
              onChange: (C) => y(C.target.value),
              children: [
                /* @__PURE__ */ t("option", { value: "dashboard", children: "Dashboard notification only" }),
                /* @__PURE__ */ t("option", { value: "self_dm", children: "DM to myself in Slack" })
              ]
            }
          )
        ] }),
        w === "self_dm" && /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "Your Slack login (for the DM)",
          /* @__PURE__ */ t(Y, { value: h, onChange: (C) => $(C.target.value), placeholder: "jdoe" })
        ] }),
        /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "Poll interval (seconds, 60–3600)",
          /* @__PURE__ */ t(Y, { type: "number", min: 60, max: 3600, value: L, onChange: (C) => B(C.target.value) }),
          /* @__PURE__ */ s("span", { "data-testid": "poll-cadence", className: "block text-xs text-muted", style: { marginTop: 2 }, children: [
            "Runs by itself every ",
            e.settings.poll_interval_secs,
            " s; a manual Poll just runs one cycle now."
          ] })
        ] })
      ] }),
      /* @__PURE__ */ t(_, { primary: !0, className: "mt-3", disabled: !!n, onClick: j, children: "Save settings" })
    ] }),
    /* @__PURE__ */ t(M, { children: /* @__PURE__ */ s("details", { children: [
      /* @__PURE__ */ t("summary", { style: { cursor: "pointer", fontWeight: 600, color: "var(--text-strong)" }, children: "Advanced" }),
      /* @__PURE__ */ s("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "MCP server command (a single executable on PATH)",
          /* @__PURE__ */ t(Y, { value: S, onChange: (C) => x(C.target.value), placeholder: "ai-community-slack-mcp" })
        ] }),
        /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "Workspace URL (for permalinks, optional)",
          /* @__PURE__ */ t(Y, { value: D, onChange: (C) => P(C.target.value), placeholder: "https://yourteam.slack.com" })
        ] }),
        /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "First-poll backfill (hours, 0–168)",
          /* @__PURE__ */ t(Y, { type: "number", min: 0, max: 168, value: R, onChange: (C) => d(C.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(_, { className: "mt-3", disabled: !!n, onClick: j, children: "Save settings" }),
      /* @__PURE__ */ s("div", { style: { borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }, children: [
        /* @__PURE__ */ t("div", { className: "text-sm", style: { fontWeight: 600, marginBottom: 8 }, children: "Crew" }),
        /* @__PURE__ */ s("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
          /* @__PURE__ */ s("label", { className: "text-sm", children: [
            "Agent",
            /* @__PURE__ */ t(Y, { value: T, onChange: (C) => f(C.target.value), placeholder: "slack-radar-crew" }),
            /* @__PURE__ */ t("span", { className: "block text-xs text-muted mt-1", children: "Default: the shipped slack-radar-crew agent. Your own agents are never modified." })
          ] }),
          /* @__PURE__ */ s("label", { className: "text-sm", children: [
            "Model (empty = agent default)",
            /* @__PURE__ */ t(Y, { value: I, onChange: (C) => K(C.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ s("div", { className: "mt-3 flex items-center gap-2", children: [
          /* @__PURE__ */ t(
            $e,
            {
              checked: b,
              onChange: N,
              label: "Unattended mode (auto-approve investigator commands)",
              describedBy: "sr-unattended-risk"
            }
          ),
          /* @__PURE__ */ t("span", { className: "text-sm", children: "Unattended mode (auto-approve investigator commands)" })
        ] }),
        /* @__PURE__ */ t("p", { id: "sr-unattended-risk", className: "text-xs text-muted mt-1", children: "Risk: anyone in a watched channel can write text the crew reads, so a crafted message could steer a command nobody reviews." }),
        /* @__PURE__ */ t(
          _,
          {
            primary: !0,
            className: "mt-3",
            disabled: !!n,
            onClick: () => a("Save crew", () => o.put(`${W}/crew`, { agent: T, model: I, unattended: b })),
            children: "Save crew"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  Wt as default
};
