import { jsxs as r, Fragment as F, jsx as t } from "react/jsx-runtime";
import * as $e from "@kirocrew/app-sdk";
import { useAppApi as oe, ChatEmbed as Je } from "@kirocrew/app-sdk";
import { PageHeader as Ve, Toggle as Oe, Btn as D, Card as Q, CardTitle as ie, StatCard as me, Input as ne, EmptyState as Ze, Badge as X } from "@kirocrew/app-sdk/ui";
import { useState as m, useCallback as be, useEffect as se, useRef as ce, useMemo as ge } from "react";
const O = "/api/apps/slack-radar", et = {
  checking: "checking…",
  connected: "connected",
  needs_login: "sign in again",
  binary_not_found: "not installed",
  incompatible: "missing read access",
  error: "not working"
}, Ce = ["What needs me today?", "Draft today's digest", "Which threads look resolved?"], tt = [
  { id: "board", label: "Board" },
  { id: "ledger", label: "Ledger" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" }
], he = (e) => e ? new Date(e * 1e3).toLocaleString() : "never";
function Z(e) {
  if (!e) return "never";
  const n = Math.max(0, Date.now() / 1e3 - e);
  return n < 90 ? "just now" : n < 3600 ? `${Math.round(n / 60)} min ago` : n < 86400 ? `${Math.round(n / 3600)} h ago` : he(e);
}
function Ee(e, n) {
  return n === "needs_login" ? "needs_login" : (e == null ? void 0 : e.status) || "checking";
}
function ke({ children: e, summary: n = "Details" }) {
  return /* @__PURE__ */ r("details", { className: "text-xs text-muted", style: { marginTop: 6 }, children: [
    /* @__PURE__ */ t("summary", { style: { cursor: "pointer" }, children: n }),
    /* @__PURE__ */ t("div", { style: { marginTop: 4 }, children: e })
  ] });
}
const pe = [
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
], ue = (e, n) => {
  var a;
  return (a = e.now) == null ? void 0 : a.members.find((s) => s.id === n);
};
function le(e, n) {
  var l;
  const a = ue(n, e.id);
  if (e.id === "lead")
    return (a == null ? void 0 : a.state) === "paused" || !n.crew.live ? { label: "paused", tone: "muted" } : (a ? a.state === "working" : n.crew.running) ? { label: "working", tone: "aim" } : { label: "live", tone: "ok" };
  if (e.id === "poller")
    return n.source_state === "needs_login" ? { label: "sign in again", tone: "warn" } : (a == null ? void 0 : a.state) === "paused" ? { label: "paused", tone: "warn" } : { label: `polled ${Z(n.last_poll_at)}`, tone: "muted" };
  const s = a ? a.count : e.id === "investigator" && ((l = n.investigations) == null ? void 0 : l.running) || 0;
  return s ? { label: `${s} running`, tone: "aim" } : (a == null ? void 0 : a.state) === "planned" ? { label: "not started yet", tone: "muted" } : { label: "idle", tone: "muted" };
}
function re(e) {
  if (!e) return "--";
  const n = new Date(e * 1e3), a = n.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: !1 });
  return n.toDateString() === (/* @__PURE__ */ new Date()).toDateString() ? a : `${n.toLocaleDateString([], { month: "short", day: "numeric" })} ${a}`;
}
function nt(e) {
  if (!e) return "";
  const n = Math.round(e - Date.now() / 1e3);
  return n <= 0 ? "now" : Be(Date.now() / 1e3 - n);
}
function at(e, n) {
  if (!(n != null && n.last)) return "";
  const { started_at: a, finished_at: s } = n.last;
  if (e.id === "poller") {
    if (!a) return "has not polled yet";
    const l = nt(n.next_at);
    return `last ${re(a)}${l ? ` · next ${l === "now" ? "due now" : `in ${l}`}` : ""}`;
  }
  return e.id === "lead" ? a ? `last wake ${re(a)}` : "not woken yet" : a ? s ? `last run ${re(a)}–${re(s)}` : `last run ${re(a)}` : "last run --";
}
function rt(e) {
  var n, a;
  return !(e != null && e.ran) || e.ran === "running" ? "" : e.ran === "never" ? "never ran" : `idle since ${re(((n = e.last) == null ? void 0 : n.finished_at) || ((a = e.last) == null ? void 0 : a.started_at))}`;
}
function Be(e) {
  if (!e) return "";
  const n = Math.max(0, Math.round(Date.now() / 1e3 - e));
  return n < 90 ? `${n}s` : n < 90 * 60 ? `${Math.round(n / 60)}m` : `${Math.round(n / 3600)}h`;
}
const Ne = (e, n = 60) => e.length > n ? `${e.slice(0, n - 1).trimEnd()}…` : e;
function Te(e, n) {
  const a = ue(n, e.id);
  if (!a) return le(e, n).label;
  const s = at(e, a);
  return e.id === "poller" ? s && a.state === "paused" ? `${a.doing.split(" · ")[0]} · ${s}` : s || a.doing : a.state !== "working" ? a.state === "paused" ? `paused: ${a.doing}` : s || le(e, n).label : e.id === "lead" ? `working: ${a.doing}` : `${a.count} running: ${a.doing}`;
}
const st = `@keyframes slack-radar-pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.7) } }
.sr-pulse { animation: slack-radar-pulse 1.4s ease-in-out infinite }
@keyframes slack-radar-spin { to { transform: rotate(360deg) } }
.sr-spin { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: slack-radar-spin .8s linear infinite; vertical-align: -1px; margin-right: 6px }
@media (prefers-reduced-motion: reduce) { .sr-pulse, .sr-spin { animation: none } }`;
function Pe({ tone: e, pulse: n }) {
  return /* @__PURE__ */ t(
    "i",
    {
      "aria-hidden": !0,
      className: n ? "sr-pulse" : void 0,
      style: { width: 8, height: 8, borderRadius: "50%", flex: "none", display: "inline-block", background: ze[e] }
    }
  );
}
function Me({ m: e, state: n, withName: a = !0, withResting: s = !1, onOpen: l }) {
  const d = le(e, n), h = ue(n, e.id), c = h ? h.state === "working" : d.tone === "aim", $ = s && (e.id === "investigator" || e.id === "watcher") ? rt(h) : "", g = $ ? `${$} · ${Te(e, n)}` : Te(e, n), w = e.id === "lead" && n.crew.name || e.title, T = /* @__PURE__ */ r(F, { children: [
    /* @__PURE__ */ t(Pe, { tone: d.tone, pulse: c }),
    a && /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: w }),
    /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: Ne(g) })
  ] }), _ = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    fontSize: 13,
    opacity: c || d.tone === "warn" ? 1 : 0.6,
    color: "var(--text)"
  }, y = { title: `${w} · ${g}`, "data-member": e.id, "data-state": (h == null ? void 0 : h.state) || (c ? "working" : "idle") };
  return l ? /* @__PURE__ */ t(
    "button",
    {
      type: "button",
      onClick: l,
      ...y,
      "aria-label": `${w}: ${g}. Show activity`,
      style: { ..._, background: "transparent", border: 0, padding: 0, cursor: "pointer" },
      children: T
    }
  ) : /* @__PURE__ */ t("span", { ...y, style: _, children: T });
}
function it({ state: e, onOpenActivity: n }) {
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
        pe.map((a) => /* @__PURE__ */ t(
          Me,
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
function lt({ state: e }) {
  const n = pe.filter((a) => a.id === "investigator" || a.id === "watcher").map((a) => ({ m: a, row: ue(e, a.id) })).filter(({ row: a }) => (a == null ? void 0 : a.state) === "working");
  return n.length ? /* @__PURE__ */ t("div", { "data-testid": "chat-running", style: { padding: "6px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" }, children: n.map(({ m: a, row: s }) => {
    const l = Be(s.since), d = `${a.title} running${s.count > 1 ? ` (${s.count})` : ""} · ${s.doing}${l ? ` · ${l}` : ""}`;
    return /* @__PURE__ */ r("div", { className: "text-xs flex items-center gap-2", title: d, style: { minWidth: 0 }, children: [
      /* @__PURE__ */ t(Pe, { tone: "aim", pulse: !0 }),
      /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: d })
    ] }, a.id);
  }) }) : null;
}
const ze = {
  ok: "var(--ok)",
  aim: "var(--aim)",
  warn: "var(--warn)",
  muted: "var(--muted-strong)"
};
function _e({ m: e, s: n, selected: a, size: s = 32 }) {
  const l = le(e, n), d = e.planned || e.id === "poller", h = {
    width: s,
    height: s,
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
          background: ze[l.tone]
        }
      }
    )
  ] });
}
function ot(e) {
  return e === "new" ? "warn" : e === "investigating" ? "aim" : e === "resolved" ? "ok" : "muted";
}
function dt({ tab: e, setTab: n }) {
  return /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Slack Radar sections", style: { display: "flex", gap: 4 }, children: tt.map((a) => {
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
function ct({
  state: e,
  configured: n,
  busy: a,
  onStart: s,
  onPause: l
}) {
  const d = e.crew.live;
  return /* @__PURE__ */ r("div", { className: "flex items-center gap-2", title: !d && !n ? "Add a channel in Settings first" : void 0, children: [
    /* @__PURE__ */ t("span", { className: "text-sm", children: "Crew" }),
    /* @__PURE__ */ t(
      Oe,
      {
        checked: d,
        disabled: !!a || !d && !n,
        onChange: (c) => c ? s() : l(),
        label: d ? "Pause the crew" : "Start the crew"
      }
    ),
    /* @__PURE__ */ r("span", { className: "text-xs text-muted", title: "Whether the crew's commands run without asking you", children: [
      "Unattended: ",
      e.crew.trusted ? "on" : "off"
    ] })
  ] });
}
function Yt() {
  const e = oe(), [n, a] = m("board"), [s, l] = m(null), [d, h] = m([]), [c, $] = m(null), [g, w] = m([]), [T, _] = m([]), [y, x] = m("open"), [f, k] = m(/* @__PURE__ */ new Set()), [B, C] = m(""), [p, L] = m(""), [A, H] = m(null), [b, o] = m(null), [W, S] = m(null), v = be(async () => {
    try {
      H(await e.get(`${O}/mcp/status`));
    } catch (R) {
      H({ status: "error", command: "", detail: R.message });
    }
  }, [e]);
  se(() => {
    v();
  }, [v]);
  const M = be(async () => {
    var R;
    try {
      const [i, u, I, E, U] = await Promise.all([
        e.get(`${O}/state`),
        e.get(`${O}/items?status=${encodeURIComponent(y)}&limit=300`),
        e.get(`${O}/events?limit=150`),
        e.get(`${O}/needs`),
        e.get(`${O}/items?handled=1&limit=100`)
      ]);
      l(i), o(((R = i.now) == null ? void 0 : R.members) || null), h(u.items), $(E), w(U.items), _(I.events.slice().reverse());
    } catch (i) {
      L(`Could not load: ${i.message}`);
    }
  }, [e, y]);
  se(() => {
    M();
    const R = window.setInterval(M, 3e4);
    return () => window.clearInterval(R);
  }, [M]);
  const J = !!(b != null && b.some((R) => R.state === "working")), G = ce("");
  se(() => {
    if (!J) return;
    const R = async () => {
      try {
        const u = await e.get(`${O}/now`);
        o(u.members);
        const I = u.members.map((E) => `${E.id}:${E.state}:${E.count}`).join(",");
        if (G.current && I !== G.current) {
          const E = await e.get(`${O}/events?limit=150`);
          _(E.events.slice().reverse());
        }
        G.current = I;
      } catch {
      }
    }, i = window.setInterval(R, 5e3);
    return () => window.clearInterval(i);
  }, [J, e]);
  const q = ge(() => s && b ? { ...s, now: { members: b } } : s, [s, b]), Y = () => {
    S(["member", "crew", "investigate"]), a("activity");
  }, P = async (R, i) => {
    C(R), L("");
    try {
      await i(), L(`${R}: done`), await M();
    } catch (u) {
      L(`${R} failed: ${u.message}`);
    } finally {
      C("");
    }
  }, K = !!s && s.settings.channels.length > 0, z = (s == null ? void 0 : s.settings.channels.length) || 0, V = s ? `${z ? `Watching ${z} channel${z === 1 ? "" : "s"}` : "No channels yet"} · ${s.crew.live ? "running" : "paused"}` : "A small crew triaging your Slack channels", te = s ? Ee(A, s.source_state) : "checking", N = () => {
    v(), M();
  };
  return /* @__PURE__ */ r(F, { children: [
    /* @__PURE__ */ t(
      Ve,
      {
        title: "Slack Radar",
        subtitle: V,
        actions: /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-4", children: [
          /* @__PURE__ */ t(
            dt,
            {
              tab: n,
              setTab: (R) => {
                S(null), a(R);
              }
            }
          ),
          s && /* @__PURE__ */ t(
            ct,
            {
              state: s,
              configured: K,
              busy: B,
              onStart: () => P("Start crew", () => e.post(`${O}/crew/start`, {})),
              onPause: () => P("Pause crew", () => e.post(`${O}/crew/pause`, {}))
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ t("style", { children: st }),
    /* @__PURE__ */ r("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      q && n === "board" && /* @__PURE__ */ t(it, { state: q, onOpenActivity: Y }),
      s && te === "needs_login" && /* @__PURE__ */ t(ht, { mcp: A, sourceError: s.source_error, busy: B, onCheck: N }),
      p && /* @__PURE__ */ t("p", { role: "status", className: "text-sm text-muted mb-3", children: p }),
      q ? n === "board" ? /* @__PURE__ */ t(
        pt,
        {
          state: q,
          needs: c,
          handled: g,
          configured: K,
          mcp: A,
          busy: B,
          onPoll: () => P("Poll", () => e.post(`${O}/poll`, {})),
          onStart: () => P("Start crew", () => e.post(`${O}/crew/start`, {})),
          onDigest: () => P("Digest now", () => e.post(`${O}/digest/request`, {})),
          events: T,
          onChanged: M
        }
      ) : n === "ledger" ? /* @__PURE__ */ t(
        At,
        {
          state: q,
          items: d,
          filter: y,
          setFilter: x,
          selected: f,
          setSelected: k,
          busy: B,
          onInvestigate: (R) => P("Investigate", async () => {
            await e.post(`${O}/investigate`, { keys: [...f], repo: R }), k(/* @__PURE__ */ new Set());
          })
        }
      ) : n === "team" ? /* @__PURE__ */ t(Pt, { state: q }) : n === "activity" ? /* @__PURE__ */ t(Mt, { events: T, kinds: W, onShowAll: () => S(null) }) : /* @__PURE__ */ t(zt, { state: q, busy: B, act: P, mcp: A, onProbe: v }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" })
    ] })
  ] });
}
function je({ mcp: e, sourceError: n }) {
  var s;
  const a = [
    (e == null ? void 0 : e.status) && `status: ${e.status}`,
    (e == null ? void 0 : e.command) && `command: ${e.command}`,
    n && `error: ${n}`,
    (e == null ? void 0 : e.detail) && e.detail !== n && `detail: ${e.detail}`,
    ((s = e == null ? void 0 : e.missing_read_tools) == null ? void 0 : s.length) && `missing read tools: ${e.missing_read_tools.join(", ")}`
  ].filter(Boolean);
  return a.length ? /* @__PURE__ */ t(ke, { children: /* @__PURE__ */ t("pre", { className: "font-mono whitespace-pre-wrap", style: { margin: 0 }, children: a.join(`
`) }) }) : null;
}
function ht({ mcp: e, sourceError: n, busy: a, onCheck: s }) {
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
          /* @__PURE__ */ t(D, { primary: !0, onClick: s, disabled: !!a, children: "I signed in, check again" })
        ] }),
        /* @__PURE__ */ t(je, { mcp: e, sourceError: n })
      ]
    }
  );
}
function He({ mcp: e, state: n, withPoll: a, action: s }) {
  const l = Ee(e, n.source_state), d = l === "connected";
  return /* @__PURE__ */ r("div", { className: s ? "mb-3" : "mb-4", "data-testid": s ? "connection-line" : void 0, children: [
    /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ r("p", { role: "status", className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { margin: 0, flex: 1, minWidth: 0 }, children: [
        /* @__PURE__ */ t("span", { "aria-hidden": !0, style: { width: 8, height: 8, borderRadius: "50%", background: d ? "var(--ok)" : l === "checking" ? "var(--muted-strong)" : "var(--warn)", display: "inline-block" } }),
        /* @__PURE__ */ r("span", { children: [
          "Slack connection: ",
          /* @__PURE__ */ t("span", { style: { color: d ? "var(--text)" : "var(--warn)" }, children: et[l] || l })
        ] }),
        a && /* @__PURE__ */ r("span", { children: [
          "· last poll ",
          Z(n.last_poll_at),
          n.settings.channels.length > 0 && /* @__PURE__ */ r(F, { children: [
            " · watching ",
            n.settings.channels.join(", ")
          ] })
        ] })
      ] }),
      s
    ] }),
    !d && l !== "needs_login" && /* @__PURE__ */ t(je, { mcp: e, sourceError: n.source_error })
  ] });
}
function pt(e) {
  const { state: n } = e, [a, s] = m(""), [l, d] = Et(n.crew.slot_key), h = ce(null), c = ($) => {
    s(ut($)), d(!0), window.requestAnimationFrame(() => {
      var g;
      return (g = h.current) == null ? void 0 : g.scrollIntoView({ block: "end", behavior: "smooth" });
    });
  };
  return /* @__PURE__ */ r("div", { "data-testid": "board", style: { minWidth: 0 }, children: [
    /* @__PURE__ */ t(
      He,
      {
        mcp: e.mcp,
        state: n,
        withPoll: !0,
        action: /* @__PURE__ */ t(D, { style: j, onClick: e.onPoll, disabled: !!e.busy || !e.configured, children: "Poll now" })
      }
    ),
    !e.configured && /* @__PURE__ */ r(Q, { className: "mb-4", children: [
      /* @__PURE__ */ t(ie, { children: "Finish setup" }),
      /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite." })
    ] }),
    /* @__PURE__ */ t(It, { state: n, busy: e.busy, onDigest: e.onDigest }),
    /* @__PURE__ */ t(
      Tt,
      {
        needs: e.needs,
        handled: e.handled,
        onChanged: e.onChanged,
        onWhy: c,
        investigator: ue(n, "investigator")
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
          Bt,
          {
            state: n,
            events: e.events,
            configured: e.configured,
            busy: e.busy,
            expanded: l,
            setExpanded: d,
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
const Re = {
  decide: "Needs a decision",
  unanswered: "Questions nobody answered",
  clusters: "Reported more than once"
};
function We(e) {
  return e < 1 ? `${Math.max(1, Math.round(e * 60))} min ago` : e < 48 ? `${Math.round(e)} h ago` : `${Math.floor(e / 24)} days ago`;
}
const Le = 5;
function ut(e) {
  return `Why is "${e.summary.length > 80 ? `${e.summary.slice(0, 79)}…` : e.summary}" ${e.priority || "on my list"}?`;
}
function Ke(e) {
  return e ? /* @__PURE__ */ t(X, { variant: e === "p0" || e === "p1" ? "err" : "muted", children: e }) : null;
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
const j = { fontSize: 12, padding: "2px 10px" }, xe = (e) => e.category === "bug-report" || e.category === "feature-request", Ae = (e) => (e.links_count || 0) > 0 || !!e.investigation && e.status !== "investigating", Se = (e, n) => e === "decide" && !!n.reply_draft && !n.handoff_title;
function Ue(e, n, a = !1) {
  return e === "decide" && (n.dispatch || a) ? "Done" : e === "decide" && n.handoff_title ? "Dispatch fix" : Se(e, n) ? "Open" : e === "decide" && n.reason.startsWith("Looks resolved") ? "Done" : e === "unanswered" && n.permalink ? "Reply" : e === "clusters" ? Ae(n) && xe(n) && !n.handoff_title && !n.reply_draft ? "Ask lead" : "Investigate" : xe(n) && !Ae(n) ? "Investigate" : xe(n) && !n.handoff_title && !n.reply_draft ? "Ask lead" : (n.category === "question" || n.category === "already-answered") && !n.reply_draft ? "Open" : "";
}
const mt = (e, n) => !!e.investigation && !e.links_count && e.status === "investigating" && (n == null ? void 0 : n.state) === "working", gt = (e) => {
  var n;
  return (n = e.members) != null && n.length ? e.members : [e.key];
};
function fe(e) {
  return e.replace(/<([@#!])([^>|]+)\|([^>]+)>/g, (n, a, s, l) => `${a === "#" ? "#" : "@"}${l}`).replace(/<([@#!])([^>|]+)>/g, (n, a, s) => `${a === "#" ? "#" : "@"}${s}`).replace(/<([^>|]+)\|([^>]+)>/g, "$2").replace(/<([^>]+)>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
const Ye = (e, n = 90) => Ne(fe(e).split(`
`).map((a) => a.trim()).find(Boolean) || "", n), ft = (e) => new Date(e * 1e3).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), yt = 3600, De = (e, n, a) => `${e} ${e === 1 ? n : a}`;
function qe({ ts: e }) {
  const n = Number(e || 0);
  return n ? /* @__PURE__ */ r("span", { "data-testid": "last-reply", children: [
    " · replies · last ",
    re(n)
  ] }) : null;
}
function xt(e) {
  var s;
  if (e.pr_url) return { url: e.pr_url, n: e.pr_number };
  const n = ((s = e.pr_urls) == null ? void 0 : s[0]) || "", a = /\/pull\/(\d+)/.exec(n);
  return { url: n, n: a ? Number(a[1]) : 0 };
}
function bt(e, n) {
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
function vt({
  e,
  groupId: n,
  first: a,
  onOpen: s,
  onMark: l,
  onDispatch: d,
  busy: h,
  fix: c,
  sentHere: $,
  failed: g,
  excluded: w,
  onExclude: T,
  investigator: _,
  investigate: y,
  ask: x
}) {
  var z, V, te;
  const f = n === "decide" ? bt(e, $) : null, k = Ue(n, e, !!f), B = Se(n, e), [C, p] = m(!1), L = `sr-fix-${e.key.replace(/[^A-Za-z0-9]/g, "-")}`, A = `${n}:${e.key}`, H = gt(e), b = mt(e, _), o = k === "Investigate" && (b || !!(y != null && y.busy.has(A)) || !!(y != null && y.asked.has(A))), W = k === "Ask lead" && (!!e.reanalyze_in_flight || !!(x != null && x.inFlight) && (x == null ? void 0 : x.lastFrom) === A), S = ((z = y == null ? void 0 : y.failed) == null ? void 0 : z.from) === A ? y.failed : null, v = ((V = x == null ? void 0 : x.failed) == null ? void 0 : V.from) === A ? x.failed : null, M = e.links || [], J = () => {
    k === "Dispatch fix" ? d == null || d() : k === "Done" ? l("done") : k === "Reply" && e.permalink ? window.open(e.permalink, "_blank", "noopener,noreferrer") : k === "Investigate" ? y == null || y.run(H, A) : k === "Ask lead" ? x == null || x.run(H.slice(0, St), A) : s();
  }, G = o ? "Investigating…" : W ? "Lead thinking…" : k, q = h || o || k === "Ask lead" && (W || !!(x != null && x.busy) || !!(x != null && x.inFlight)), Y = ((te = f == null ? void 0 : f.pr_state) == null ? void 0 : te.state) === "merged", P = f && !Y && ve[f.state] || "", K = f ? Y ? xt(f) : { url: f.pr_url, n: f.pr_number } : { url: "", n: 0 };
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
        /* @__PURE__ */ t("div", { style: { flex: "none", minWidth: 28 }, children: Ke(e.priority) }),
        /* @__PURE__ */ r("div", { style: { minWidth: 0, flex: 1 }, children: [
          /* @__PURE__ */ t(
            "button",
            {
              type: "button",
              "data-testid": "need-open",
              onClick: s,
              title: "Open the message and its thread",
              style: { border: 0, background: "transparent", padding: 0, margin: 0, textAlign: "left", cursor: "pointer", width: "100%", color: "inherit", font: "inherit" },
              children: B ? /* @__PURE__ */ r(F, { children: [
                /* @__PURE__ */ r("div", { style: { color: "var(--text-strong)" }, children: [
                  /* @__PURE__ */ t("span", { "data-testid": "reply-ready", children: /* @__PURE__ */ t(X, { variant: "aim", children: "Reply ready" }) }),
                  " ",
                  e.reply_draft_stale && /* @__PURE__ */ r(F, { children: [
                    /* @__PURE__ */ t("span", { "data-testid": "draft-stale", children: /* @__PURE__ */ r(X, { variant: "warn", children: [
                      De(e.reply_draft_stale.new_replies, "new reply", "new replies"),
                      " since draft"
                    ] }) }),
                    " "
                  ] }),
                  /* @__PURE__ */ t("span", { "data-testid": "need-first-line", children: Ye(e.text || e.summary) || "(no text)" })
                ] }),
                /* @__PURE__ */ r("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
                  e.user || "someone",
                  " · ",
                  /* @__PURE__ */ t("span", { "data-testid": "need-age", children: We(e.age_hours) })
                ] })
              ] }) : /* @__PURE__ */ r(F, { children: [
                /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
                /* @__PURE__ */ r("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
                  e.reason,
                  " · ",
                  /* @__PURE__ */ t("span", { "data-testid": "need-age", children: We(e.age_hours) })
                ] })
              ] })
            }
          ),
          b && /* @__PURE__ */ r("div", { className: "text-xs", role: "status", style: { marginTop: 2 }, "data-testid": "row-investigating", children: [
            /* @__PURE__ */ t("span", { style: { color: "var(--text-strong)" }, children: "Investigator" }),
            " · running · since ",
            re(e.investigation_at || (_ == null ? void 0 : _.since))
          ] }),
          !b && !f && (e.links_count || 0) > 0 && /* @__PURE__ */ r("div", { className: "text-xs", role: "status", style: { marginTop: 2 }, "data-testid": "row-investigated", children: [
            /* @__PURE__ */ t("span", { style: { color: "var(--text-strong)" }, children: "Investigated" }),
            " · ",
            De(e.links_count || 0, "link", "links")
          ] }),
          S && /* @__PURE__ */ t(ee, { message: S.why, onRetry: () => y == null ? void 0 : y.run(S.keys, A) }),
          v && /* @__PURE__ */ t(ee, { message: v.why, onRetry: () => x == null ? void 0 : x.run(v.keys, A) }),
          f && /* @__PURE__ */ r("div", { className: "text-xs", role: "status", style: { marginTop: 2 }, "data-testid": "fix-dispatched", children: [
            /* @__PURE__ */ t("span", { style: { color: "var(--text-strong)" }, children: "Dispatched" }),
            " · ",
            f.launched ? "opened in a new conductor chat" : f.batch ? `batch of ${f.batch}` : f.title || "Fix session",
            P && /* @__PURE__ */ r(F, { children: [
              " · ",
              P
            ] }),
            Y && K.url && /* @__PURE__ */ r(F, { children: [
              " · ",
              /* @__PURE__ */ r("span", { "data-testid": "fix-pr-merged", children: [
                /* @__PURE__ */ r("a", { className: "underline", href: K.url, target: "_blank", rel: "noreferrer noopener", children: [
                  "PR #",
                  K.n
                ] }),
                " ",
                "merged ",
                /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "✓" })
              ] })
            ] }),
            f.session_key && /* @__PURE__ */ r(F, { children: [
              " · ",
              /* @__PURE__ */ t(we, { d: f, label: "Open session" })
            ] }),
            !Y && K.url && /* @__PURE__ */ r(F, { children: [
              " · ",
              /* @__PURE__ */ r("a", { className: "underline", href: K.url, target: "_blank", rel: "noreferrer noopener", children: [
                "PR #",
                K.n
              ] }),
              /* @__PURE__ */ t(Qe, { ps: f.pr_state })
            ] }),
            /* @__PURE__ */ t(qe, { ts: e.latest_reply })
          ] }),
          f && f.trusted === !1 && (f.state === "running" || f.state === "idle") && /* @__PURE__ */ t("div", { className: "text-xs text-muted", "data-testid": "fix-untrusted", children: "Will ask you for each tool: unattended mode is off." }),
          g && !f && /* @__PURE__ */ t(ee, { message: `Could not dispatch that fix: ${g}. Nothing was sent.`, onRetry: () => d == null ? void 0 : d() }),
          !c && C && /* @__PURE__ */ t(
            "div",
            {
              id: L,
              "data-testid": "row-preview",
              className: "text-xs",
              style: { marginTop: 6, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6 },
              children: M.length > 0 ? /* @__PURE__ */ r("ul", { "data-testid": "row-links", style: { margin: 0, padding: 0, listStyle: "none" }, children: [
                M.map((N) => /* @__PURE__ */ t("li", { style: { overflowWrap: "anywhere" }, children: /* @__PURE__ */ t("a", { className: "underline", href: N, target: "_blank", rel: "noreferrer noopener", children: N.replace(/^https:\/\/github\.com\//, "") }) }, N)),
                (e.links_count || 0) > M.length && /* @__PURE__ */ r("li", { className: "text-muted", children: [
                  "and ",
                  (e.links_count || 0) - M.length,
                  " more"
                ] })
              ] }) : /* @__PURE__ */ r("div", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 160, overflowY: "auto" }, children: [
                e.category && /* @__PURE__ */ r("span", { className: "text-muted", children: [
                  e.category,
                  " · "
                ] }),
                Ne(fe(e.text || e.summary), 400) || "(no text)"
              ] })
            }
          ),
          c && C && /* @__PURE__ */ r(
            "div",
            {
              id: L,
              "data-testid": "fix-preview",
              className: "text-xs",
              style: { marginTop: 6, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6 },
              children: [
                /* @__PURE__ */ r("div", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: [
                  c.title,
                  " ",
                  c.repo && /* @__PURE__ */ t("span", { className: "text-muted font-mono", style: { fontWeight: 400 }, children: c.repo })
                ] }),
                /* @__PURE__ */ t(
                  "pre",
                  {
                    "aria-label": "Fix task",
                    style: { margin: "4px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 160, overflowY: "auto", fontFamily: "var(--font-mono, monospace)" },
                    children: c.prompt
                  }
                ),
                T && /* @__PURE__ */ r("label", { className: "flex items-center gap-1", style: { marginTop: 6, cursor: "pointer" }, children: [
                  /* @__PURE__ */ t("input", { type: "checkbox", checked: !!w, onChange: (N) => T(N.target.checked) }),
                  "Exclude from batch"
                ] })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ t("div", { className: "flex items-center gap-1", style: { flex: "none" }, "data-testid": "need-actions", children: k && /* @__PURE__ */ t(D, { primary: !0, style: j, onClick: J, disabled: q, "data-primary": k, children: k === "Dispatch fix" && h || o || W ? /* @__PURE__ */ r(F, { children: [
          /* @__PURE__ */ t("span", { className: "sr-spin", "aria-hidden": !0 }),
          k === "Dispatch fix" ? "Dispatching…" : G
        ] }) : k }) }),
        /* @__PURE__ */ t(
          "button",
          {
            type: "button",
            "data-testid": c ? "fix-toggle" : "row-toggle",
            "aria-expanded": C,
            "aria-controls": L,
            "aria-label": c ? C ? "Hide the fix" : "Show the fix" : M.length ? C ? "Hide the links" : "Show the links" : C ? "Hide the message" : "Show the message",
            onClick: () => p(!C),
            style: { flex: "none", border: 0, background: "transparent", cursor: "pointer", padding: "2px 4px", color: "var(--muted)" },
            children: C ? "▴" : "▾"
          }
        )
      ] })
    }
  );
}
function wt({
  e,
  groupId: n,
  onClose: a,
  onSend: s,
  onMark: l,
  onWhy: d,
  onDispatch: h,
  busy: c,
  sentHere: $,
  reanalyze: g
}) {
  var te;
  const w = Se(n, e), T = Ue(n, e, $), [_, y] = m(e.reply_draft || ""), [x, f] = m(!1), [k, B] = m(null), [C, p] = m(""), L = ce(null), A = ce(null), H = ce(null), b = e.key.replace(/[^A-Za-z0-9]/g, "-"), o = `sr-detail-${b}`, W = `sr-reply-${b}`, S = e.replies || [], v = e.reply_draft_at || 0, M = (N) => !!e.reply_draft && v > 0 && Number(N.ts) > v, J = ((te = e.reply_draft_stale) == null ? void 0 : te.new_replies) || 0, G = e.last_thread_check_at || 0, q = G > 0 && Date.now() / 1e3 - G > yt;
  se(() => {
    const N = document.activeElement;
    return window.requestAnimationFrame(() => {
      var R;
      return (R = w ? A.current : H.current) == null ? void 0 : R.focus();
    }), () => {
      N && N.isConnected && N.focus();
    };
  }, []);
  const Y = async () => {
    const N = _.trim();
    p(""), f(!0);
    const R = await s(N, N !== (e.reply_draft || "").trim());
    f(!1), R.ok ? B(R.link) : p(R.why);
  }, P = (N) => {
    if (N.key === "Escape") {
      N.stopPropagation(), a();
      return;
    }
    if (N.key !== "Tab" || !L.current) return;
    const R = [...L.current.querySelectorAll("a[href], button:not([disabled]), textarea, input, select")];
    if (R.length === 0) return;
    const i = R[0], u = R[R.length - 1];
    N.shiftKey && document.activeElement === i ? (N.preventDefault(), u.focus()) : !N.shiftKey && document.activeElement === u && (N.preventDefault(), i.focus());
  }, K = (N) => () => {
    N(), a();
  }, z = { marginTop: 14 }, V = { margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "var(--text-strong)" };
  return /* @__PURE__ */ t(
    "div",
    {
      "data-testid": "need-detail-backdrop",
      onMouseDown: (N) => N.target === N.currentTarget && a(),
      style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.35)", display: "flex", justifyContent: "flex-end" },
      children: /* @__PURE__ */ r(
        "div",
        {
          ref: L,
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": o,
          "data-testid": "need-detail",
          onKeyDown: P,
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
              /* @__PURE__ */ t("div", { style: { flex: "none" }, children: Ke(e.priority) }),
              /* @__PURE__ */ t("h3", { id: o, style: { margin: 0, flex: 1, fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }, children: Ye(e.text || e.summary, 80) || "(no text)" }),
              /* @__PURE__ */ t(
                "button",
                {
                  ref: H,
                  type: "button",
                  "aria-label": "Close",
                  onClick: a,
                  style: { border: 0, background: "transparent", cursor: "pointer", padding: "0 6px", fontSize: 18, lineHeight: 1, color: "var(--muted)" },
                  children: "×"
                }
              )
            ] }),
            /* @__PURE__ */ r("section", { "aria-label": "Original message", "data-testid": "detail-original", style: z, children: [
              /* @__PURE__ */ t("h4", { style: V, children: "Original message" }),
              /* @__PURE__ */ r("div", { className: "text-xs text-muted", children: [
                /* @__PURE__ */ t("span", { "data-testid": "detail-author", children: e.user || "someone" }),
                " · ",
                /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
                " · ",
                he(e.ts_float),
                e.permalink && /* @__PURE__ */ r(F, { children: [
                  " · ",
                  /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open in Slack" })
                ] })
              ] }),
              /* @__PURE__ */ t("p", { style: { margin: "6px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }, "data-testid": "detail-text", children: fe(e.text || e.summary) || "(no text)" })
            ] }),
            /* @__PURE__ */ r("section", { "aria-label": "Thread replies", "data-testid": "detail-replies", style: z, children: [
              /* @__PURE__ */ r("h4", { style: V, children: [
                "Thread replies (",
                S.length,
                ")",
                q && /* @__PURE__ */ r("span", { className: "text-xs text-muted", style: { fontWeight: 400 }, "data-testid": "replies-stale", children: [
                  " · ",
                  "replies as of ",
                  ft(G)
                ] })
              ] }),
              S.length === 0 ? /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: 0 }, children: "No replies yet" }) : /* @__PURE__ */ t("ol", { className: "flex flex-col", style: { margin: 0, padding: 0, listStyle: "none" }, children: S.map((N, R) => /* @__PURE__ */ r(
                "li",
                {
                  "data-testid": M(N) ? "reply-new" : "reply-old",
                  style: {
                    padding: M(N) ? "4px 0 4px 8px" : "4px 0",
                    borderTop: R === 0 ? 0 : "1px solid var(--border)",
                    ...M(N) ? { borderLeft: "3px solid var(--warn, #d97706)" } : {}
                  },
                  children: [
                    /* @__PURE__ */ r("div", { className: "text-xs text-muted", children: [
                      M(N) && /* @__PURE__ */ r(F, { children: [
                        /* @__PURE__ */ t(X, { variant: "warn", children: "new" }),
                        " "
                      ] }),
                      N.user || "someone",
                      " · ",
                      he(Number(N.ts))
                    ] }),
                    /* @__PURE__ */ t("div", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" }, children: fe(N.text) })
                  ]
                },
                `${N.ts}-${R}`
              )) })
            ] }),
            !w && /* @__PURE__ */ r("section", { "aria-label": "Why it is here", style: z, className: "text-xs text-muted", children: [
              e.reason,
              e.category && /* @__PURE__ */ r(F, { children: [
                " · ",
                e.category
              ] }),
              e.words && e.words.length > 0 && /* @__PURE__ */ r(F, { children: [
                " · shared words: ",
                e.words.join(", ")
              ] }),
              e.members && e.members.length > 0 && /* @__PURE__ */ r(F, { children: [
                " · Done and Ignore apply to all ",
                e.members.length
              ] }),
              e.handoff_title && !e.dispatch && !$ && /* @__PURE__ */ r("div", { style: { marginTop: 4, color: "var(--text)" }, children: [
                "Fix: ",
                e.handoff_title
              ] })
            ] }),
            w && /* @__PURE__ */ r("section", { "aria-label": "Reply draft", "data-testid": "detail-draft", style: z, children: [
              /* @__PURE__ */ t("label", { htmlFor: W, style: { ...V, display: "block" }, children: "Reply to the thread, sent as you" }),
              /* @__PURE__ */ r("div", { className: "text-xs text-muted", "data-testid": "draft-by", children: [
                e.reply_draft_by === "owner" ? "Edited by you" : "Drafted by the Radar Lead",
                e.reply_draft_at ? ` · ${Z(e.reply_draft_at)}` : ""
              ] }),
              /* @__PURE__ */ t(
                "textarea",
                {
                  id: W,
                  ref: A,
                  value: _,
                  maxLength: 1500,
                  rows: 6,
                  readOnly: k !== null,
                  onChange: (N) => y(N.target.value),
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
            C && /* @__PURE__ */ t(ee, { message: `Could not send that reply: ${C}`, onRetry: Y }),
            w && J > 0 && k === null && /* @__PURE__ */ t("p", { role: "status", "data-testid": "draft-stale-warning", className: "text-sm", style: { ...z, marginBottom: 0, color: "var(--text-strong)" }, children: J === 1 ? "1 reply arrived after this draft — read it first" : `${J} replies arrived after this draft — read them first` }),
            e.needs_reanalysis && g && k === null && /* @__PURE__ */ r("div", { style: z, "data-testid": "detail-reanalyze", children: [
              /* @__PURE__ */ t(D, { style: j, disabled: g.busy || g.inFlight, onClick: () => g.run([e.key], e.key), children: g.inFlight || g.busy ? "Re-analyzing…" : "Re-analyze this" }),
              g.failed && g.failed.from === e.key && /* @__PURE__ */ t(ee, { message: g.failed.why, onRetry: () => g.run(g.failed.keys, e.key) })
            ] }),
            k !== null ? /* @__PURE__ */ r("div", { style: z, className: "flex flex-wrap items-center gap-2", children: [
              /* @__PURE__ */ r("p", { role: "status", style: { margin: 0, flex: 1 }, children: [
                "Sent as you",
                k && /* @__PURE__ */ r(F, { children: [
                  " · ",
                  /* @__PURE__ */ t("a", { className: "underline", href: k, target: "_blank", rel: "noreferrer noopener", "data-testid": "sent-link", children: "Open the reply in Slack" })
                ] })
              ] }),
              /* @__PURE__ */ t(D, { primary: !0, style: j, onClick: a, children: "Close" })
            ] }) : /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-1", style: z, "data-testid": "detail-actions", children: [
              w && /* @__PURE__ */ t(D, { primary: !0, style: j, disabled: !_.trim() || x, onClick: Y, children: x ? "Sending…" : "Send to thread" }),
              T === "Dispatch fix" && /* @__PURE__ */ t(D, { primary: !0, style: j, disabled: c, onClick: K(() => h == null ? void 0 : h()), children: "Dispatch fix" }),
              T === "Reply" && e.permalink && /* @__PURE__ */ t(D, { primary: !0, style: j, onClick: () => window.open(e.permalink, "_blank", "noopener,noreferrer"), children: "Reply" }),
              /* @__PURE__ */ t(D, { style: j, onClick: K(() => l("done")), children: w ? "Done without sending" : "Done" }),
              /* @__PURE__ */ t(D, { style: j, onClick: K(() => l("ignored")), children: "Ignore" }),
              /* @__PURE__ */ t(D, { style: j, onClick: K(d), children: "Why? Ask the lead" })
            ] }),
            T === "Reply" && k === null && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "6px 0 0" }, children: "Reply opens the thread in Slack." })
          ]
        }
      )
    }
  );
}
function kt({ g: e, render: n }) {
  const [a, s] = m(!1), l = a ? e.shown : e.shown.slice(0, Le), d = e.shown.length - l.length;
  return /* @__PURE__ */ r(F, { children: [
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: l.map(n) }),
    (d > 0 || a && e.shown.length > Le) && /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        className: "text-xs underline",
        onClick: () => s(!a),
        style: { border: 0, background: "transparent", cursor: "pointer", padding: "4px 0", color: "var(--muted)" },
        children: a ? "Show fewer" : `Show ${d} more`
      }
    )
  ] });
}
const Ge = typeof $e.useChatLauncher == "function" ? $e.useChatLauncher : () => null, ve = { running: "working", idle: "idle", closed: "done", unknown: "" }, Nt = { open: "open", draft: "draft", closed: "closed, not merged" };
function Qe({ ps: e }) {
  const n = e ? Nt[e.state] : "";
  return n ? /* @__PURE__ */ r("span", { "data-testid": "fix-pr-state", children: [
    " ",
    n
  ] }) : null;
}
function we({ d: e, label: n }) {
  const a = Ge(), s = `/chat?sid=${encodeURIComponent(e.session_key)}`;
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
function _t(e) {
  const n = oe(), a = Ge(), [s, l] = m(/* @__PURE__ */ new Set()), [d, h] = m({}), [c, $] = m({}), [g, w] = m(null), [T, _] = m(null), [y, x] = m(!1), f = (o, W) => h((S) => Object.fromEntries([...Object.entries(S), ...o.map((v) => [v, W])])), k = (o, W) => $((S) => Object.fromEntries([...Object.entries(S), ...o.map((v) => [v, W])])), B = (o) => $((W) => Object.fromEntries(Object.entries(W).filter(([S]) => !o.includes(S)))), C = (o, W, S) => {
    a ? (a.openChat({ agent: o.agent, message: o.seed, autoSend: !0 }), f(W, { session_key: "", title: o.title, batch: S, state: "", pr_url: "", pr_number: 0, launched: !0 })) : (x(!1), _({ title: o.title, seed: o.seed }));
  }, p = async (o, W) => {
    if (!(s.size || o.length === 0)) {
      l(new Set(o));
      try {
        await W();
      } finally {
        l(/* @__PURE__ */ new Set());
      }
    }
  }, L = (o) => p([o], async () => {
    B([o]);
    try {
      const W = await n.post(`${O}/items/handoff/dispatch`, { key: o });
      W.mode === "server" ? f([o], { session_key: W.session_key, title: W.title, batch: 0, state: "running", pr_url: "", pr_number: 0, trusted: W.trusted }) : C(W, [o], 0), e();
    } catch (W) {
      const S = ye(W);
      S.code === "already_dispatched" && S.session_key ? f([o], { session_key: S.session_key, title: S.title || "", batch: 0, state: "", pr_url: "", pr_number: 0 }) : k([o], S.error || "the gateway refused it");
    }
  }), A = (o) => p(o, async () => {
    var W;
    w(null);
    try {
      const S = await n.post(`${O}/items/handoff/dispatch-batch`, { keys: o });
      S.mode === "server" ? f(o, { session_key: S.session_key, title: S.title, batch: o.length, state: "running", pr_url: "", pr_number: 0, trusted: S.trusted }) : C(S, o, o.length), e();
    } catch (S) {
      const v = ye(S), M = (W = v.dispatched) != null && W.length ? `${v.dispatched.length} of them already have a session` : v.error || "the gateway refused it";
      w({ keys: o, why: M });
    }
  }), H = async () => {
    if (T)
      try {
        await navigator.clipboard.writeText(T.seed), x(!0);
      } catch {
        x(!1);
      }
  }, b = T && /* @__PURE__ */ t(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "sr-fix-title",
      style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" },
      onKeyDown: (o) => o.key === "Escape" && _(null),
      children: /* @__PURE__ */ r("div", { style: { width: "min(720px, 92vw)", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: 16 }, children: [
        /* @__PURE__ */ t("h3", { id: "sr-fix-title", className: "text-sm", style: { margin: "0 0 6px", fontWeight: 600 }, children: T.title }),
        /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 8px" }, children: "This Kiro Crew cannot open the session for you. Copy this task into a new kirocrew-conductor chat." }),
        /* @__PURE__ */ t(
          "textarea",
          {
            readOnly: !0,
            "aria-label": "Fix task",
            value: T.seed,
            style: { width: "100%", height: 260, fontSize: 12, fontFamily: "var(--font-mono, monospace)" }
          }
        ),
        /* @__PURE__ */ r("div", { className: "flex items-center gap-2", style: { marginTop: 8 }, children: [
          /* @__PURE__ */ t(D, { onClick: H, children: y ? "Copied" : "Copy task" }),
          /* @__PURE__ */ t("a", { className: "underline text-sm", href: "/chat?new=1", children: "New chat" }),
          /* @__PURE__ */ t("div", { className: "flex-1" }),
          /* @__PURE__ */ t(D, { onClick: () => _(null), children: "Close" })
        ] })
      ] })
    }
  );
  return { dispatch: L, dispatchBatch: A, busy: s, sent: d, failed: c, batchFailed: g, ui: b };
}
const Fe = 10, St = 20;
function $t(e, n) {
  var _, y;
  const a = oe(), [s, l] = m(!1), [d, h] = m(!1), [c, $] = m(null), [g, w] = m("");
  return se(() => h(!1), [e]), { run: async (x, f) => {
    if (!(s || x.length === 0)) {
      $(null), l(!0), w(f);
      try {
        await a.post(`${O}/items/reanalyze`, { keys: x }), h(!0), n();
      } catch (k) {
        const B = ye(k), C = B.code === "reanalyze_in_flight" ? "The Radar Lead is still re-analyzing the last request. Nothing new was sent." : `Could not ask the Radar Lead to re-analyze: ${B.error || "the gateway refused it"}. Nothing was sent.`;
        $({ keys: x, from: f, why: C });
      } finally {
        l(!1);
      }
    }
  }, busy: s, inFlight: d || !!((_ = e == null ? void 0 : e.reanalyze) != null && _.in_flight) || !!((y = e == null ? void 0 : e.ask_lead) != null && y.in_flight), lastFrom: g, failed: c };
}
function Ct(e, n) {
  const a = oe(), [s, l] = m(/* @__PURE__ */ new Set()), [d, h] = m(/* @__PURE__ */ new Set()), [c, $] = m(null);
  return se(() => h(/* @__PURE__ */ new Set()), [e]), { run: async (w, T) => {
    if (!(s.has(T) || w.length === 0)) {
      $(null), l((_) => new Set(_).add(T));
      try {
        await a.post(`${O}/investigate`, { keys: w.slice(0, 10), repo: "" }), h((_) => new Set(_).add(T)), n();
      } catch (_) {
        const y = ye(_), x = y.code === "unattended_required" ? "Investigate needs unattended mode: turn it on on the Crew card (Team tab), then try again. Nothing was started." : `Could not start the Investigator: ${y.error || _.message || "the gateway refused it"}. Nothing was started.`;
        $({ keys: w, from: T, why: x });
      } finally {
        l((_) => {
          const y = new Set(_);
          return y.delete(T), y;
        });
      }
    }
  }, busy: s, asked: d, failed: c };
}
function Tt({
  needs: e,
  handled: n,
  onChanged: a,
  onWhy: s,
  investigator: l
}) {
  var R;
  const d = oe(), h = _t(a), c = $t(e, a), $ = Ct(e, a), g = e == null ? void 0 : e.reanalyze, w = e == null ? void 0 : e.ask_lead, T = w ? c.busy || c.inFlight ? "Lead thinking…" : w.total === 0 ? "Nothing waiting for Lead" : `Ask Lead (${w.keys.length} of ${w.total} waiting)` : "", _ = g ? g.total > g.keys.length ? `Re-analyze ${g.keys.length} of ${g.total} stale` : `Re-analyze ${g.total} stale` : "", y = (e == null ? void 0 : e.fixes) || [], x = (e == null ? void 0 : e.fix_batches) || [], f = new Map(x.map((i) => [i.session_key, i])), k = new Map(((e == null ? void 0 : e.handoffs) || []).map((i) => [i.key, i.handoff])), B = (i) => {
    const u = k.get(i.key);
    return i.handoff_title ? { title: i.handoff_title || (u == null ? void 0 : u.title) || "", prompt: (u == null ? void 0 : u.prompt) || "", repo: (u == null ? void 0 : u.repo) || "" } : void 0;
  }, C = (((R = ((e == null ? void 0 : e.groups) || []).find((i) => i.id === "decide")) == null ? void 0 : R.entries) || []).filter((i) => i.handoff_title && !i.dispatch && !h.sent[i.key] && k.has(i.key)).map((i) => ({ key: i.key, repo: k.get(i.key).repo || "" })), [p, L] = m(/* @__PURE__ */ new Set()), A = C.filter((i) => !p.has(i.key)), b = new Set(A.map((i) => i.repo.toLowerCase())).size > 1 ? "one repo per batch: exclude the others from their ▾" : A.length > Fe ? `at most ${Fe} per batch: exclude some from their ▾` : "", [o, W] = m(null), S = async (i, u, I, E) => {
    var U, ae;
    try {
      I && await d.post(`${O}/items/reply/draft`, { key: i, text: u });
      const de = await d.post(`${O}/items/reply/send`, { key: i });
      return Y((Xe) => new Set(Xe).add(E)), a(), { ok: !0, link: String(((ae = (U = de == null ? void 0 : de.item) == null ? void 0 : U.replied) == null ? void 0 : ae.permalink) || "") };
    } catch (de) {
      return { ok: !1, why: de.message || "unknown error" };
    }
  }, v = (e == null ? void 0 : e.replied) || [], [M, J] = m(""), G = async (i) => {
    J("");
    try {
      await d.post(`${O}/items/handoff/dismiss`, { key: i }), a();
    } catch {
      J(i);
    }
  }, [q, Y] = m(/* @__PURE__ */ new Set()), [P, K] = m(null);
  se(() => Y(/* @__PURE__ */ new Set()), [e]);
  const z = async (i, u, I) => {
    K(null), I && Y((E) => new Set(E).add(I));
    try {
      for (const E of i) await d.post(`${O}/items/handle`, { key: E, how: u });
      a();
    } catch {
      I && Y((E) => {
        const U = new Set(E);
        return U.delete(I), U;
      }), K({ keys: i, how: u, rowId: I });
    }
  }, V = ((e == null ? void 0 : e.groups) || []).map((i) => ({
    ...i,
    shown: i.entries.filter((u) => !q.has(`${i.id}:${u.key}`))
  })), te = V.every((i) => i.shown.length === 0), N = (P == null ? void 0 : P.how) === "reopen" ? "reopen" : (P == null ? void 0 : P.how) === "ignored" ? "ignore" : "mark as done";
  return /* @__PURE__ */ r(Q, { className: "mb-4", children: [
    /* @__PURE__ */ r("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ t(ie, { children: "Needs you" }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      w && /* @__PURE__ */ t(
        D,
        {
          style: j,
          "data-testid": "ask-lead-batch",
          title: "Hand the Radar Lead the oldest waiting items in one turn: it writes a fix hand-off, a reply draft, or closes each. Nothing is sent to Slack.",
          disabled: c.busy || c.inFlight || w.keys.length === 0,
          onClick: () => c.run(w.keys, "ask-batch"),
          children: T
        }
      ),
      g && (g.total > 0 || c.inFlight) && /* @__PURE__ */ t(
        D,
        {
          primary: !0,
          style: j,
          "data-testid": "reanalyze",
          title: "Ask the Radar Lead to re-read these threads and rewrite or withdraw each draft. Nothing is sent to Slack.",
          disabled: c.busy || c.inFlight || g.keys.length === 0,
          onClick: () => c.run(g.keys, "card"),
          children: c.busy || c.inFlight ? /* @__PURE__ */ r(F, { children: [
            /* @__PURE__ */ t("span", { className: "sr-spin", "aria-hidden": !0 }),
            "Re-analyzing…"
          ] }) : _
        }
      )
    ] }),
    c.failed && (c.failed.from === "card" || c.failed.from === "ask-batch") && /* @__PURE__ */ t(ee, { message: c.failed.why, onRetry: () => c.run(c.failed.keys, c.failed.from) }),
    P && /* @__PURE__ */ t(
      ee,
      {
        message: `Could not ${N} that message. Nothing changed.`,
        onRetry: () => z(P.keys, P.how, P.rowId)
      }
    ),
    e ? te ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Nothing needs you right now." }) : V.map(
      (i) => i.shown.length === 0 ? null : /* @__PURE__ */ r("section", { "aria-label": Re[i.id], style: { marginTop: 10 }, children: [
        /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2", children: [
          /* @__PURE__ */ r("h4", { className: "text-sm", style: { margin: 0, fontWeight: 600, color: "var(--text-strong)" }, children: [
            Re[i.id],
            " ",
            /* @__PURE__ */ r("span", { className: "text-muted", style: { fontWeight: 400 }, children: [
              "(",
              i.total - (i.entries.length - i.shown.length),
              ")"
            ] })
          ] }),
          /* @__PURE__ */ t("div", { className: "flex-1" }),
          i.id === "decide" && C.length >= 2 && /* @__PURE__ */ r(F, { children: [
            b && /* @__PURE__ */ t("span", { className: "text-xs text-muted", role: "status", children: b }),
            /* @__PURE__ */ t(
              D,
              {
                style: j,
                onClick: () => h.dispatchBatch(A.map((u) => u.key)),
                disabled: h.busy.size > 0 || A.length === 0 || !!b,
                children: A.length > 0 && h.busy.has(A[0].key) && h.busy.size > 1 ? /* @__PURE__ */ r(F, { children: [
                  /* @__PURE__ */ t("span", { className: "sr-spin", "aria-hidden": !0 }),
                  "Dispatching…"
                ] }) : `Dispatch all fixes (${A.length})`
              }
            )
          ] })
        ] }),
        i.id === "decide" && h.batchFailed && /* @__PURE__ */ t(
          ee,
          {
            message: `Could not dispatch those fixes: ${h.batchFailed.why}. Nothing was sent.`,
            onRetry: () => h.dispatchBatch(h.batchFailed.keys)
          }
        ),
        /* @__PURE__ */ t(
          kt,
          {
            g: i,
            render: (u, I) => /* @__PURE__ */ t(
              vt,
              {
                e: u,
                groupId: i.id,
                first: I === 0,
                onOpen: () => W({ e: u, groupId: i.id }),
                onMark: (E) => {
                  var U;
                  return z((U = u.members) != null && U.length ? u.members : [u.key], E, `${i.id}:${u.key}`);
                },
                onDispatch: i.id === "decide" && u.handoff_title ? () => h.dispatch(u.key) : void 0,
                busy: h.busy.has(u.key),
                fix: i.id === "decide" ? B(u) : void 0,
                sentHere: h.sent[u.key],
                failed: i.id === "decide" ? h.failed[u.key] : void 0,
                excluded: p.has(u.key),
                investigator: l,
                investigate: $,
                ask: c,
                onExclude: i.id === "decide" && C.length >= 2 && C.some((E) => E.key === u.key) ? (E) => L((U) => {
                  const ae = new Set(U);
                  return E ? ae.add(u.key) : ae.delete(u.key), ae;
                }) : void 0
              },
              u.key
            )
          }
        )
      ] }, i.id)
    ) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" }),
    M && /* @__PURE__ */ t(ee, { message: "Could not dismiss that hand-off. Nothing changed.", onRetry: () => G(M) }),
    y.length > 0 && /* @__PURE__ */ r("details", { style: { marginTop: 12 }, "data-testid": "fixes-in-flight", children: [
      /* @__PURE__ */ r("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Fixes in flight (",
        (e == null ? void 0 : e.fixes_total) ?? y.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: y.map((i, u) => {
        const I = i.dispatch.batch ? f.get(i.dispatch.session_key) : void 0, E = I && I.keys[0] === i.key, U = { padding: "6px 0", borderTop: u === 0 ? 0 : "1px solid var(--border)" }, ae = i.dispatch.pr_url && /* @__PURE__ */ r(F, { children: [
          " · ",
          /* @__PURE__ */ r("a", { className: "underline", href: i.dispatch.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
            "PR #",
            i.dispatch.pr_number
          ] }),
          /* @__PURE__ */ t(Qe, { ps: i.dispatch.pr_state })
        ] });
        return /* @__PURE__ */ r("li", { className: "text-sm", style: I ? { ...U, ...E ? {} : { borderTop: 0, paddingTop: 0 } } : U, children: [
          E && I && /* @__PURE__ */ r("div", { "data-testid": "fix-batch-header", style: { marginBottom: 4 }, children: [
            /* @__PURE__ */ t(we, { d: I }),
            /* @__PURE__ */ r("span", { className: "text-xs text-muted", children: [
              " · ",
              ve[I.state] || I.state || "sent",
              " · ",
              /* @__PURE__ */ t("span", { className: "font-mono", children: I.repo }),
              " · ",
              I.prs_found,
              " PRs found / ",
              I.total,
              " · ",
              Z(I.at)
            ] })
          ] }),
          /* @__PURE__ */ r("div", { className: "flex items-center gap-2", style: I ? { paddingLeft: 16 } : void 0, children: [
            /* @__PURE__ */ r("span", { style: { flex: 1, minWidth: 0 }, children: [
              I ? i.handoff_title : /* @__PURE__ */ r(F, { children: [
                /* @__PURE__ */ t(we, { d: i.dispatch }),
                /* @__PURE__ */ r("span", { className: "text-xs text-muted", children: [
                  " · ",
                  ve[i.dispatch.state] || i.dispatch.state || "sent",
                  " · ",
                  /* @__PURE__ */ t("span", { className: "font-mono", children: i.repo }),
                  " · ",
                  Z(i.dispatch.at)
                ] })
              ] }),
              ae,
              /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: /* @__PURE__ */ t(qe, { ts: i.latest_reply }) })
            ] }),
            /* @__PURE__ */ t(D, { style: j, onClick: () => G(i.key), children: "Dismiss" })
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
              Z(i.handled_at)
            ] }),
            /* @__PURE__ */ t(D, { style: j, onClick: () => z([i.key], "reopen"), children: "Reopen" })
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
                Z(i.at)
              ] })
            ] }),
            i.permalink && /* @__PURE__ */ t("a", { className: "underline text-xs", href: i.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open reply" })
          ]
        },
        i.key
      )) })
    ] }),
    o && /* @__PURE__ */ t(
      wt,
      {
        e: o.e,
        groupId: o.groupId,
        sentHere: !!h.sent[o.e.key],
        onClose: () => W(null),
        onSend: (i, u) => S(o.e.key, i, u, `${o.groupId}:${o.e.key}`),
        onMark: (i) => {
          var u;
          return z((u = o.e.members) != null && u.length ? o.e.members : [o.e.key], i, `${o.groupId}:${o.e.key}`);
        },
        onWhy: () => s(o.e),
        onDispatch: o.groupId === "decide" && o.e.handoff_title ? () => h.dispatch(o.e.key) : void 0,
        busy: h.busy.has(o.e.key),
        reanalyze: c
      },
      `${o.groupId}:${o.e.key}`
    ),
    h.ui
  ] });
}
function Rt({ it: e, first: n, checked: a, onToggle: s }) {
  var c, $;
  const l = ($ = (c = e.fix_handoff) == null ? void 0 : c.pr_state) == null ? void 0 : $.state, d = l === "merged" || l === "closed" ? { label: l === "merged" ? "fix merged" : "fix PR closed", variant: l === "merged" ? "ok" : "warn" } : e.priority ? { label: e.priority, variant: e.priority === "p0" || e.priority === "p1" ? "err" : "muted" } : e.possibly_resolved ? { label: "possibly resolved", variant: "warn" } : null, h = [
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
      /* @__PURE__ */ t(X, { variant: ot(e.status), children: e.status }),
      d && /* @__PURE__ */ t(X, { variant: d.variant, children: d.label }),
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
        e.user && /* @__PURE__ */ r(F, { children: [
          " · ",
          e.user
        ] }),
        e.reply_count > 0 && /* @__PURE__ */ r(F, { children: [
          " · ",
          e.reply_count,
          " replies"
        ] }),
        " · ",
        /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "open in Slack" }),
        e.links.length > 0 && /* @__PURE__ */ r(F, { children: [
          " · linked ",
          e.links.map((g) => /* @__PURE__ */ t("a", { className: "underline mr-2", href: g, target: "_blank", rel: "noreferrer noopener", children: g.replace("https://github.com/", "") }, g))
        ] })
      ] }),
      e.note && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: e.note })
    ] })
  ] }) });
}
function Wt(e) {
  var n, a;
  return !!((n = e.reply_draft) != null && n.text || (a = e.fix_handoff) != null && a.prompt || e.possibly_resolved);
}
const Lt = ["", "p0", "p1", "p2", "p3", "none"];
function At(e) {
  const { state: n, items: a, selected: s, setSelected: l } = e, [d, h] = m(""), [c, $] = m(""), [g, w] = m(""), [T, _] = m(!1), y = n.counts.open_by_priority, x = ge(() => [...new Set(a.map((p) => p.category).filter(Boolean))].sort(), [a]), f = ge(
    () => a.filter((p) => !c || (c === "none" ? !p.priority : p.priority === c)).filter((p) => !g || p.category === g).filter((p) => !T || Wt(p)).sort((p, L) => (L.ts_float || 0) - (p.ts_float || 0)),
    [a, c, g, T]
  ), k = (p) => {
    const L = new Set(s);
    L.has(p) ? L.delete(p) : L.add(p), l(L);
  }, B = ge(
    () => n.settings.channels.map((p) => ({ cid: p, ...n.channels[p] || {} })),
    [n]
  ), C = "text-sm bg-transparent border rounded px-2 py-1";
  return /* @__PURE__ */ r("div", { style: { minWidth: 0 }, children: [
    /* @__PURE__ */ r("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4", children: [
      /* @__PURE__ */ t(me, { label: "Awaiting triage", value: n.counts.needs_triage, accent: !0 }),
      /* @__PURE__ */ t(me, { label: "Possibly resolved", value: n.counts.possibly_resolved }),
      /* @__PURE__ */ t(me, { label: "Open p0 / p1", value: `${y.p0 || 0} / ${y.p1 || 0}` }),
      /* @__PURE__ */ t(me, { label: "Tracked items", value: n.counts.total })
    ] }),
    /* @__PURE__ */ r(Q, { className: "mb-4", children: [
      /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2 mb-3", children: [
        /* @__PURE__ */ t(ie, { children: "Ledger" }),
        /* @__PURE__ */ r("span", { className: "text-xs text-muted", "data-testid": "ledger-count", children: [
          f.length,
          " of ",
          a.length,
          " · newest first"
        ] }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-filter", children: "Status" }),
        /* @__PURE__ */ r("select", { id: "sr-filter", className: C, value: e.filter, onChange: (p) => e.setFilter(p.target.value), children: [
          /* @__PURE__ */ t("option", { value: "open", children: "open" }),
          /* @__PURE__ */ t("option", { value: "new", children: "new" }),
          /* @__PURE__ */ t("option", { value: "triaged", children: "triaged" }),
          /* @__PURE__ */ t("option", { value: "investigating", children: "investigating" }),
          /* @__PURE__ */ t("option", { value: "resolved", children: "resolved" }),
          /* @__PURE__ */ t("option", { value: "noise", children: "noise" }),
          /* @__PURE__ */ t("option", { value: "", children: "all" })
        ] }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-priority", children: "Priority" }),
        /* @__PURE__ */ t("select", { id: "sr-priority", className: C, value: c, onChange: (p) => $(p.target.value), children: Lt.map((p) => /* @__PURE__ */ t("option", { value: p, children: p || "all" }, p)) }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-category", children: "Category" }),
        /* @__PURE__ */ r("select", { id: "sr-category", className: C, value: g, onChange: (p) => w(p.target.value), children: [
          /* @__PURE__ */ t("option", { value: "", children: "all" }),
          x.map((p) => /* @__PURE__ */ t("option", { value: p, children: p }, p))
        ] }),
        /* @__PURE__ */ r("label", { className: "text-sm flex items-center gap-1", style: { cursor: "pointer" }, children: [
          /* @__PURE__ */ t("input", { type: "checkbox", checked: T, onChange: (p) => _(p.target.checked) }),
          "Needs me"
        ] }),
        /* @__PURE__ */ t("div", { className: "flex-1" }),
        /* @__PURE__ */ t(
          ne,
          {
            "aria-label": "GitHub repository to search (owner/name, optional)",
            placeholder: "owner/repo (optional)",
            value: d,
            onChange: (p) => h(p.target.value),
            className: "w-48"
          }
        ),
        /* @__PURE__ */ r(D, { onClick: () => e.onInvestigate(d), disabled: s.size === 0 || !!e.busy, children: [
          "Investigate ",
          s.size || ""
        ] })
      ] }),
      f.length === 0 ? /* @__PURE__ */ t(
        Ze,
        {
          icon: /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "📡" }),
          title: a.length ? "Nothing matches these filters" : "Nothing here yet",
          subtitle: a.length ? "Change a filter to see more." : "New messages appear after the next poll."
        }
      ) : /* @__PURE__ */ t("ul", { className: "flex flex-col", "data-testid": "ledger-list", children: f.map((p, L) => /* @__PURE__ */ t(Rt, { it: p, first: L === 0, checked: s.has(p.key), onToggle: () => k(p.key) }, p.key)) })
    ] }),
    /* @__PURE__ */ r(Q, { children: [
      /* @__PURE__ */ t(ie, { children: "Channels" }),
      B.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No channels configured." }) : /* @__PURE__ */ r("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ t("thead", { children: /* @__PURE__ */ r("tr", { className: "text-left text-muted", children: [
          /* @__PURE__ */ t("th", { scope: "col", children: "Channel" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Last polled" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Status" })
        ] }) }),
        /* @__PURE__ */ t("tbody", { children: B.map((p) => /* @__PURE__ */ r("tr", { children: [
          /* @__PURE__ */ t("td", { className: "font-mono", children: p.cid }),
          /* @__PURE__ */ t("td", { children: he(p.last_polled_at) }),
          /* @__PURE__ */ t("td", { children: p.last_error ? /* @__PURE__ */ t(X, { variant: "err", title: p.last_error, children: "error" }) : /* @__PURE__ */ t(X, { variant: "ok", children: "ok" }) })
        ] }, p.cid)) })
      ] })
    ] })
  ] });
}
const Dt = 5;
function Ft(e) {
  const n = e.split(`
`).map((s) => s.trim()).filter(Boolean), a = n.filter((s) => /^[•\-–]\s/.test(s));
  return (a.length ? a : n).slice(0, Dt);
}
function It({ state: e, busy: n, onDigest: a }) {
  const s = e.digest, l = e.crew.today, d = Ft(s.last_text || ""), h = e.settings.digest_destination === "self_dm" ? "DMed to you" : "dashboard notification";
  return /* @__PURE__ */ r(Q, { className: "mb-4", "data-testid": "today-card", children: [
    /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ t(ie, { children: "Today" }),
      s.pending ? /* @__PURE__ */ t(X, { variant: "aim", children: "digest being delivered" }) : null,
      s.last_posted_date && /* @__PURE__ */ r("span", { className: "text-xs text-muted", "data-testid": "digest-time", children: [
        "digest ",
        s.last_posted_date,
        " · ",
        h
      ] }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      /* @__PURE__ */ t(D, { style: j, onClick: a, disabled: !!n || !e.crew.live, children: "Digest now" })
    ] }),
    (l == null ? void 0 : l.text) && /* @__PURE__ */ r("p", { style: { margin: "8px 0 0", fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }, "data-testid": "crew-today", children: [
      l.text,
      l.at > 0 && /* @__PURE__ */ r("span", { className: "text-xs text-muted", style: { fontWeight: 400 }, children: [
        " · ",
        Z(l.at)
      ] })
    ] }),
    s.last_text ? /* @__PURE__ */ r(F, { children: [
      /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", "data-testid": "digest-top", style: { margin: "8px 0 0", padding: 0, listStyle: "none" }, children: d.map((c, $) => /* @__PURE__ */ t("li", { children: c }, $)) }),
      /* @__PURE__ */ t(ke, { summary: "Full digest", children: /* @__PURE__ */ t("pre", { className: "whitespace-pre-wrap text-sm", style: { fontFamily: "inherit", margin: 0 }, children: s.last_text }) })
    ] }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { margin: "8px 0 0" }, "data-testid": "digest-empty", children: "No digest yet" }),
    s.last_error && /* @__PURE__ */ t("p", { className: "text-xs mt-1", style: { color: "var(--danger)" }, children: s.last_error })
  ] });
}
function Ot({ state: e }) {
  return /* @__PURE__ */ t("div", { className: "flex items-center gap-2", style: { marginTop: 10 }, children: pe.map((n) => /* @__PURE__ */ r("span", { title: `${n.title} · ${le(n, e).label}`, children: [
    /* @__PURE__ */ t(_e, { m: n, s: e, selected: n.id === "lead", size: 30 }),
    /* @__PURE__ */ t("span", { className: "sr-only", children: `${n.title}: ${le(n, e).label}` })
  ] }, n.id)) });
}
function Et(e) {
  const n = `slack-radar:chat-open:${e}`, a = () => {
    try {
      return window.localStorage.getItem(n) === "1";
    } catch {
      return !1;
    }
  }, [s, l] = m(a);
  se(() => l(a()), [n]);
  const d = be(
    (h) => {
      l(h);
      try {
        h ? window.localStorage.setItem(n, "1") : window.localStorage.removeItem(n);
      } catch {
      }
    },
    [n]
  );
  return [s, d];
}
function Ie({ q: e, onClick: n, disabled: a }) {
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
function Bt(e) {
  const n = oe(), { state: a, expanded: s, pending: l } = e, d = pe[0], h = a.crew.slot_key, c = a.crew.live && a.crew.session_open && a.crew.session_agent === a.crew.agent, [$, g] = m(""), [w, T] = m(!1), [_, y] = m(""), [x, f] = m(!1), k = le(d, a), B = async (b) => {
    await n.post(`${O}/crew/message`, { message: b }), e.onChanged();
  }, C = async (b) => {
    const o = b.trim();
    if (o) {
      T(!0), y("");
      try {
        await n.post(`${O}/crew/message`, { message: o }), g(""), o === l && e.setPending(""), e.setExpanded(!0), e.onChanged();
      } catch {
        y(o);
      } finally {
        T(!1);
      }
    }
  }, p = async () => {
    try {
      await navigator.clipboard.writeText(l), f(!0), window.setTimeout(() => f(!1), 1500);
    } catch {
      f(!1);
    }
  }, L = _ && /* @__PURE__ */ t(ee, { message: "The Radar Lead did not get that message.", onRetry: () => C(_) }), A = /* @__PURE__ */ t("div", { className: "text-sm", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }, children: a.crew.live ? /* @__PURE__ */ r(F, { children: [
    /* @__PURE__ */ t("span", { children: "The Radar Lead session opens on its next turn. Open it now to talk here." }),
    /* @__PURE__ */ t(D, { primary: !0, onClick: e.onStart, disabled: !!e.busy || !e.configured, children: "Open the session" })
  ] }) : /* @__PURE__ */ r("span", { children: [
    "The Radar Lead is paused. Turn on ",
    /* @__PURE__ */ t("b", { children: "Crew" }),
    " at the top of the page to triage your channels and talk to it here."
  ] }) });
  if (!s)
    return /* @__PURE__ */ r(Q, { style: { padding: "10px 14px" }, children: [
      /* @__PURE__ */ r(
        "form",
        {
          className: "flex flex-wrap items-center gap-2",
          onSubmit: (b) => {
            b.preventDefault(), C($);
          },
          children: [
            /* @__PURE__ */ t(_e, { m: d, s: a, size: 26 }),
            /* @__PURE__ */ t(
              ne,
              {
                "aria-label": "Ask the lead",
                placeholder: "Ask the lead…",
                value: $,
                onChange: (b) => g(b.target.value),
                disabled: !c || w,
                style: { flex: 1, minWidth: 200 }
              }
            ),
            /* @__PURE__ */ t(D, { primary: !0, type: "submit", disabled: !c || w || !$.trim(), children: "Send" }),
            Ce.map((b) => /* @__PURE__ */ t(Ie, { q: b, onClick: () => C(b), disabled: !c || w }, b))
          ]
        }
      ),
      !c && /* @__PURE__ */ t("div", { style: { marginTop: 8 }, children: A }),
      L
    ] });
  const H = e.events.filter((b) => b.kind === "crew" || b.kind === "digest").slice(0, 5);
  return /* @__PURE__ */ r(
    Q,
    {
      style: { padding: 0, display: "flex", flexDirection: "column", height: "min(620px, calc(100vh - 240px))", overflow: "hidden" },
      children: [
        /* @__PURE__ */ r("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border)" }, children: [
          /* @__PURE__ */ r("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: a.crew.name || d.title }),
            /* @__PURE__ */ t(X, { variant: k.tone === "muted" ? "muted" : k.tone === "aim" ? "aim" : "ok", children: k.label }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(D, { onClick: () => e.setExpanded(!1), "aria-expanded": !0, children: "Collapse" })
          ] }),
          /* @__PURE__ */ r("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
            "phase ",
            a.crew_memory.phase,
            " · next: ",
            a.crew_memory.next || "—"
          ] }),
          /* @__PURE__ */ t(Ot, { state: a })
        ] }),
        /* @__PURE__ */ t(lt, { state: a }),
        l && // ChatEmbed has no API to fill its composer, so the question waits here.
        /* @__PURE__ */ r(
          "div",
          {
            className: "text-sm flex flex-wrap items-center gap-2",
            style: { padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" },
            children: [
              /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200, userSelect: "all" }, children: l }),
              /* @__PURE__ */ t(D, { primary: !0, style: j, onClick: () => C(l), disabled: !c || w, children: "Send" }),
              /* @__PURE__ */ t(D, { style: j, onClick: p, children: x ? "Copied" : "Copy" })
            ]
          }
        ),
        L && /* @__PURE__ */ t("div", { style: { padding: "0 16px" }, children: L }),
        /* @__PURE__ */ t("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: c ? /* @__PURE__ */ t(
          Je,
          {
            slotKey: h,
            agent: a.crew.agent,
            frameless: !0,
            startAtBottom: !0,
            placeholder: "Ask the Radar Lead…",
            onSend: B
          },
          h
        ) : /* @__PURE__ */ r("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 10 }, children: [
          A,
          !e.configured && /* @__PURE__ */ t("p", { className: "text-xs text-muted", children: "Add a channel in Settings first." }),
          H.length > 0 && /* @__PURE__ */ t("ul", { className: "text-xs text-muted flex flex-col gap-1", style: { marginTop: 6 }, children: H.map((b, o) => /* @__PURE__ */ r("li", { children: [
            Z(b.at),
            " · ",
            b.text
          ] }, `${b.at}-${o}`)) })
        ] }) }),
        /* @__PURE__ */ t("div", { className: "flex flex-wrap gap-2", style: { padding: "10px 16px 12px", borderTop: "1px solid var(--border)" }, children: Ce.map((b) => /* @__PURE__ */ t(Ie, { q: b, onClick: () => C(b), disabled: !c || w }, b)) })
      ]
    }
  );
}
function Pt({ state: e }) {
  return /* @__PURE__ */ r(Q, { children: [
    /* @__PURE__ */ t(ie, { children: "Team" }),
    /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { marginBottom: 8 }, children: "Who works on your channels. Only the Radar Lead has a session; the others run when needed." }),
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: pe.map((n) => {
      var s, l;
      const a = n.id === "lead" ? e.crew.agent : n.agent;
      return /* @__PURE__ */ r(
        "li",
        {
          className: "flex items-start gap-3",
          style: { padding: "12px 4px", borderTop: "1px solid var(--border)", opacity: n.planned ? 0.7 : 1 },
          children: [
            /* @__PURE__ */ t(_e, { m: n, s: e, size: 36 }),
            /* @__PURE__ */ r("div", { style: { minWidth: 0, flex: 1 }, children: [
              /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-2", children: [
                /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: n.id === "lead" && e.crew.name || n.title }),
                /* @__PURE__ */ t(X, { variant: "muted", children: n.layer }),
                /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: n.kind })
              ] }),
              /* @__PURE__ */ t("p", { className: "text-sm", style: { margin: "4px 0 0" }, children: n.duty }),
              n.id === "investigator" && (((s = e.investigations) == null ? void 0 : s.items) || 0) > 0 && /* @__PURE__ */ r("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: [
                (l = e.investigations) == null ? void 0 : l.items,
                " item(s) under investigation"
              ] }),
              a && /* @__PURE__ */ t(ke, { children: /* @__PURE__ */ r("span", { className: "font-mono", children: [
                "agent: ",
                a,
                n.id === "lead" && e.crew.slot_key ? ` · session: ${e.crew.slot_key}` : ""
              ] }) })
            ] }),
            /* @__PURE__ */ t("div", { "data-testid": `team-status-${n.id}`, style: { maxWidth: 360, minWidth: 0, display: "flex" }, children: /* @__PURE__ */ t(Me, { m: n, state: e, withName: !1, withResting: !0 }) })
          ]
        },
        n.id
      );
    }) })
  ] });
}
function Mt({ events: e, kinds: n, onShowAll: a }) {
  const s = n ? e.filter((l) => n.includes(l.kind)) : e;
  return /* @__PURE__ */ r(Q, { children: [
    /* @__PURE__ */ t(ie, { children: "Activity" }),
    n && /* @__PURE__ */ r("p", { className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { marginBottom: 8 }, children: [
      /* @__PURE__ */ t("span", { children: "Showing the crew and its members only." }),
      /* @__PURE__ */ t(D, { style: j, onClick: a, children: "Show all" })
    ] }),
    s.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No activity yet." }) : /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", children: s.map((l, d) => /* @__PURE__ */ r("li", { children: [
      /* @__PURE__ */ t("span", { className: "text-muted", children: he(l.at) }),
      " ",
      /* @__PURE__ */ t(X, { variant: "muted", children: l.kind }),
      " ",
      l.text
    ] }, `${l.at}-${d}`)) })
  ] });
}
function zt({
  state: e,
  busy: n,
  act: a,
  mcp: s,
  onProbe: l
}) {
  const d = oe(), [h, c] = m(e.settings.channels.join(`
`)), [$, g] = m(e.settings.digest_destination), [w, T] = m(e.settings.slack_login), [_, y] = m(e.settings.slack_mcp_command), [x, f] = m(e.settings.workspace_url), [k, B] = m(String(e.settings.poll_interval_secs)), [C, p] = m(String(e.settings.backfill_hours)), [L, A] = m(e.crew.unattended), [H, b] = m(e.crew.agent), [o, W] = m(e.crew.model), S = () => a(
    "Save settings",
    () => d.put(`${O}/settings`, {
      channels: h.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean),
      digest_destination: $,
      slack_login: w.trim(),
      slack_mcp_command: _.trim(),
      workspace_url: x.trim(),
      poll_interval_secs: Number(k),
      backfill_hours: Number(C)
    })
  );
  return /* @__PURE__ */ r(F, { children: [
    !e.vault_available && /* @__PURE__ */ t(Q, { className: "mb-4", children: /* @__PURE__ */ t("p", { className: "text-sm", children: "The gateway secret vault is unavailable, so settings cannot be saved." }) }),
    /* @__PURE__ */ r(Q, { className: "mb-4", children: [
      /* @__PURE__ */ t(ie, { children: "Basics" }),
      /* @__PURE__ */ r("div", { className: "flex flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(He, { mcp: s, state: e }) }),
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
          onChange: (v) => c(v.target.value)
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
              onChange: (v) => g(v.target.value),
              children: [
                /* @__PURE__ */ t("option", { value: "dashboard", children: "Dashboard notification only" }),
                /* @__PURE__ */ t("option", { value: "self_dm", children: "DM to myself in Slack" })
              ]
            }
          )
        ] }),
        $ === "self_dm" && /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "Your Slack login (for the DM)",
          /* @__PURE__ */ t(ne, { value: w, onChange: (v) => T(v.target.value), placeholder: "jdoe" })
        ] }),
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "Poll interval (seconds, 60–3600)",
          /* @__PURE__ */ t(ne, { type: "number", min: 60, max: 3600, value: k, onChange: (v) => B(v.target.value) }),
          /* @__PURE__ */ r("span", { "data-testid": "poll-cadence", className: "block text-xs text-muted", style: { marginTop: 2 }, children: [
            "Runs by itself every ",
            e.settings.poll_interval_secs,
            " s; a manual Poll just runs one cycle now."
          ] })
        ] })
      ] }),
      /* @__PURE__ */ t(D, { primary: !0, className: "mt-3", disabled: !!n, onClick: S, children: "Save settings" })
    ] }),
    /* @__PURE__ */ t(Q, { children: /* @__PURE__ */ r("details", { children: [
      /* @__PURE__ */ t("summary", { style: { cursor: "pointer", fontWeight: 600, color: "var(--text-strong)" }, children: "Advanced" }),
      /* @__PURE__ */ r("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "MCP server command (a single executable on PATH)",
          /* @__PURE__ */ t(ne, { value: _, onChange: (v) => y(v.target.value), placeholder: "ai-community-slack-mcp" })
        ] }),
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "Workspace URL (for permalinks, optional)",
          /* @__PURE__ */ t(ne, { value: x, onChange: (v) => f(v.target.value), placeholder: "https://yourteam.slack.com" })
        ] }),
        /* @__PURE__ */ r("label", { className: "text-sm", children: [
          "First-poll backfill (hours, 0–168)",
          /* @__PURE__ */ t(ne, { type: "number", min: 0, max: 168, value: C, onChange: (v) => p(v.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(D, { className: "mt-3", disabled: !!n, onClick: S, children: "Save settings" }),
      /* @__PURE__ */ r("div", { style: { borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }, children: [
        /* @__PURE__ */ t("div", { className: "text-sm", style: { fontWeight: 600, marginBottom: 8 }, children: "Crew" }),
        /* @__PURE__ */ r("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
          /* @__PURE__ */ r("label", { className: "text-sm", children: [
            "Agent",
            /* @__PURE__ */ t(ne, { value: H, onChange: (v) => b(v.target.value), placeholder: "slack-radar-crew" }),
            /* @__PURE__ */ t("span", { className: "block text-xs text-muted mt-1", children: "Default: the shipped slack-radar-crew agent. Your own agents are never modified." })
          ] }),
          /* @__PURE__ */ r("label", { className: "text-sm", children: [
            "Model (empty = agent default)",
            /* @__PURE__ */ t(ne, { value: o, onChange: (v) => W(v.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ r("div", { className: "mt-3 flex items-center gap-2", children: [
          /* @__PURE__ */ t(
            Oe,
            {
              checked: L,
              onChange: A,
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
            onClick: () => a("Save crew", () => d.put(`${O}/crew`, { agent: H, model: o, unattended: L })),
            children: "Save crew"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  Yt as default
};
