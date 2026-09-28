import { jsxs as a, Fragment as I, jsx as t } from "react/jsx-runtime";
import * as X from "@kirocrew/app-sdk";
import { useAppApi as H, ChatEmbed as pe } from "@kirocrew/app-sdk";
import { PageHeader as xe, Toggle as ae, Btn as x, Card as D, CardTitle as E, StatCard as z, Input as L, EmptyState as fe, Badge as F } from "@kirocrew/app-sdk/ui";
import { useState as h, useCallback as Q, useEffect as U, useRef as se, useMemo as ye } from "react";
const w = "/api/apps/slack-radar", ve = {
  checking: "checking…",
  connected: "connected",
  needs_login: "sign in again",
  binary_not_found: "not installed",
  incompatible: "missing read access",
  error: "not working"
}, Z = ["What needs me today?", "Draft today's digest", "Which threads look resolved?"], be = [
  { id: "board", label: "Board" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" }
], V = (e) => e ? new Date(e * 1e3).toLocaleString() : "never";
function M(e) {
  if (!e) return "never";
  const n = Math.max(0, Date.now() / 1e3 - e);
  return n < 90 ? "just now" : n < 3600 ? `${Math.round(n / 60)} min ago` : n < 86400 ? `${Math.round(n / 3600)} h ago` : V(e);
}
function le(e, n) {
  return n === "needs_login" ? "needs_login" : (e == null ? void 0 : e.status) || "checking";
}
function re({ children: e, summary: n = "Details" }) {
  return /* @__PURE__ */ a("details", { className: "text-xs text-muted", style: { marginTop: 6 }, children: [
    /* @__PURE__ */ t("summary", { style: { cursor: "pointer" }, children: n }),
    /* @__PURE__ */ t("div", { style: { marginTop: 4 }, children: e })
  ] });
}
const Y = [
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
];
function j(e, n) {
  var l;
  if (e.id === "lead")
    return n.crew.live ? n.crew.running ? { label: "working", tone: "aim" } : { label: "live", tone: "ok" } : { label: "paused", tone: "muted" };
  if (e.id === "investigator") {
    const s = ((l = n.investigations) == null ? void 0 : l.running) || 0;
    return s ? { label: `${s} running`, tone: "aim" } : { label: "standing by", tone: "muted" };
  }
  return e.id === "watcher" ? { label: "standing by", tone: "muted" } : n.source_state === "needs_login" ? { label: "sign in again", tone: "warn" } : { label: `polled ${M(n.last_poll_at)}`, tone: "muted" };
}
const ie = {
  ok: "var(--ok)",
  aim: "var(--aim)",
  warn: "var(--warn)",
  muted: "var(--muted-strong)"
};
function q({ m: e, s: n, selected: l, size: s = 32 }) {
  const o = j(e, n), i = e.planned || e.id === "poller", u = {
    width: s,
    height: s,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    fontWeight: 700,
    position: "relative",
    flex: "none",
    background: i ? "transparent" : "var(--bg-hover)",
    color: i ? "var(--muted)" : "var(--text-strong)",
    border: `2px ${i ? "dashed" : "solid"} ${l ? "var(--accent)" : i ? "var(--border-strong)" : "transparent"}`,
    opacity: e.planned ? 0.6 : 1
  };
  return /* @__PURE__ */ a("span", { style: u, "aria-hidden": !0, children: [
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
          background: ie[o.tone]
        }
      }
    )
  ] });
}
function we(e) {
  return e === "new" ? "warn" : e === "investigating" ? "aim" : e === "resolved" ? "ok" : "muted";
}
function ke({ tab: e, setTab: n }) {
  return /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Slack Radar sections", style: { display: "flex", gap: 4 }, children: be.map((l) => {
    const s = e === l.id;
    return /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": s,
        onClick: () => n(l.id),
        style: {
          padding: "6px 12px",
          borderRadius: 8,
          border: 0,
          cursor: "pointer",
          fontSize: 14,
          background: s ? "var(--bg-hover)" : "transparent",
          color: s ? "var(--text-strong)" : "var(--muted)"
        },
        children: l.label
      },
      l.id
    );
  }) });
}
function Ne({
  state: e,
  configured: n,
  busy: l,
  onStart: s,
  onPause: o
}) {
  const i = e.crew.live;
  return /* @__PURE__ */ a("div", { className: "flex items-center gap-2", title: !i && !n ? "Add a channel in Settings first" : void 0, children: [
    /* @__PURE__ */ t("span", { className: "text-sm", children: "Crew" }),
    /* @__PURE__ */ t(
      ae,
      {
        checked: i,
        disabled: !!l || !i && !n,
        onChange: (b) => b ? s() : o(),
        label: i ? "Pause the crew" : "Start the crew"
      }
    ),
    /* @__PURE__ */ a("span", { className: "text-xs text-muted", title: "Whether the crew's commands run without asking you", children: [
      "Unattended: ",
      e.crew.trusted ? "on" : "off"
    ] })
  ] });
}
function Ke() {
  const e = H(), [n, l] = h("board"), [s, o] = h(null), [i, u] = h([]), [b, f] = h(null), [A, k] = h([]), [S, _] = h([]), [W, $] = h("open"), [v, c] = h(/* @__PURE__ */ new Set()), [y, C] = h(""), [P, T] = h(""), [r, m] = h(null), d = Q(async () => {
    try {
      m(await e.get(`${w}/mcp/status`));
    } catch (R) {
      m({ status: "error", command: "", detail: R.message });
    }
  }, [e]);
  U(() => {
    d();
  }, [d]);
  const g = Q(async () => {
    try {
      const [R, K, G, ue, ge] = await Promise.all([
        e.get(`${w}/state`),
        e.get(`${w}/items?status=${encodeURIComponent(W)}&limit=300`),
        e.get(`${w}/events?limit=150`),
        e.get(`${w}/needs`),
        e.get(`${w}/items?handled=1&limit=100`)
      ]);
      o(R), u(K.items), f(ue), k(ge.items), _(G.events.slice().reverse());
    } catch (R) {
      T(`Could not load: ${R.message}`);
    }
  }, [e, W]);
  U(() => {
    g();
    const R = window.setInterval(g, 3e4);
    return () => window.clearInterval(R);
  }, [g]);
  const N = async (R, K) => {
    C(R), T("");
    try {
      await K(), T(`${R}: done`), await g();
    } catch (G) {
      T(`${R} failed: ${G.message}`);
    } finally {
      C("");
    }
  }, O = !!s && s.settings.channels.length > 0, p = (s == null ? void 0 : s.settings.channels.length) || 0, ce = s ? `${p ? `Watching ${p} channel${p === 1 ? "" : "s"}` : "No channels yet"} · ${s.crew.live ? "running" : "paused"}` : "A small crew triaging your Slack channels", he = s ? le(r, s.source_state) : "checking", me = () => {
    d(), g();
  };
  return /* @__PURE__ */ a(I, { children: [
    /* @__PURE__ */ t(
      xe,
      {
        title: "Slack Radar",
        subtitle: ce,
        actions: /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-4", children: [
          /* @__PURE__ */ t(ke, { tab: n, setTab: l }),
          s && /* @__PURE__ */ t(
            Ne,
            {
              state: s,
              configured: O,
              busy: y,
              onStart: () => N("Start crew", () => e.post(`${w}/crew/start`, {})),
              onPause: () => N("Pause crew", () => e.post(`${w}/crew/pause`, {}))
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ a("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      s && he === "needs_login" && /* @__PURE__ */ t(Ce, { mcp: r, sourceError: s.source_error, busy: y, onCheck: me }),
      P && /* @__PURE__ */ t("p", { role: "status", className: "text-sm text-muted mb-3", children: P }),
      s ? n === "board" ? /* @__PURE__ */ t(
        Se,
        {
          state: s,
          items: i,
          needs: b,
          handled: A,
          configured: O,
          mcp: r,
          filter: W,
          setFilter: $,
          selected: v,
          setSelected: c,
          busy: y,
          onPoll: () => N("Poll", () => e.post(`${w}/poll`, {})),
          onInvestigate: (R) => N("Investigate", async () => {
            await e.post(`${w}/investigate`, { keys: [...v], repo: R }), c(/* @__PURE__ */ new Set());
          }),
          onStart: () => N("Start crew", () => e.post(`${w}/crew/start`, {})),
          onDigest: () => N("Request digest", () => e.post(`${w}/digest/request`, {})),
          events: S,
          onChanged: g
        }
      ) : n === "team" ? /* @__PURE__ */ t(Ee, { state: s }) : n === "activity" ? /* @__PURE__ */ t(Me, { events: S }) : /* @__PURE__ */ t(Oe, { state: s, busy: y, act: N, mcp: r, onProbe: d }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" })
    ] })
  ] });
}
function oe({ mcp: e, sourceError: n }) {
  var s;
  const l = [
    (e == null ? void 0 : e.status) && `status: ${e.status}`,
    (e == null ? void 0 : e.command) && `command: ${e.command}`,
    n && `error: ${n}`,
    (e == null ? void 0 : e.detail) && e.detail !== n && `detail: ${e.detail}`,
    ((s = e == null ? void 0 : e.missing_read_tools) == null ? void 0 : s.length) && `missing read tools: ${e.missing_read_tools.join(", ")}`
  ].filter(Boolean);
  return l.length ? /* @__PURE__ */ t(re, { children: /* @__PURE__ */ t("pre", { className: "font-mono whitespace-pre-wrap", style: { margin: 0 }, children: l.join(`
`) }) }) : null;
}
function Ce({ mcp: e, sourceError: n, busy: l, onCheck: s }) {
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
          /* @__PURE__ */ t(x, { primary: !0, onClick: s, disabled: !!l, children: "I signed in, check again" })
        ] }),
        /* @__PURE__ */ t(oe, { mcp: e, sourceError: n })
      ]
    }
  );
}
function de({ mcp: e, state: n, withPoll: l }) {
  const s = le(e, n.source_state), o = s === "connected";
  return /* @__PURE__ */ a("div", { className: "mb-4", children: [
    /* @__PURE__ */ a("p", { role: "status", className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { margin: 0 }, children: [
      /* @__PURE__ */ t("span", { "aria-hidden": !0, style: { width: 8, height: 8, borderRadius: "50%", background: o ? "var(--ok)" : s === "checking" ? "var(--muted-strong)" : "var(--warn)", display: "inline-block" } }),
      /* @__PURE__ */ a("span", { children: [
        "Slack connection: ",
        /* @__PURE__ */ t("span", { style: { color: o ? "var(--text)" : "var(--warn)" }, children: ve[s] || s })
      ] }),
      l && /* @__PURE__ */ a("span", { children: [
        "· last poll ",
        M(n.last_poll_at),
        n.settings.channels.length > 0 && /* @__PURE__ */ a(I, { children: [
          " · watching ",
          n.settings.channels.join(", ")
        ] })
      ] })
    ] }),
    !o && s !== "needs_login" && /* @__PURE__ */ t(oe, { mcp: e, sourceError: n.source_error })
  ] });
}
function Se(e) {
  const { state: n, items: l, selected: s, setSelected: o } = e, [i, u] = h(""), [b, f] = h(""), [A, k] = Fe(n.crew.slot_key), S = se(null), _ = n.counts.open_by_priority, W = (c) => {
    const y = new Set(s);
    y.has(c) ? y.delete(c) : y.add(c), o(y);
  }, $ = ye(
    () => n.settings.channels.map((c) => ({ cid: c, ...n.channels[c] || {} })),
    [n]
  ), v = (c) => {
    f($e(c)), k(!0), window.requestAnimationFrame(() => {
      var y;
      return (y = S.current) == null ? void 0 : y.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };
  return /* @__PURE__ */ a("div", { style: { minWidth: 0 }, children: [
    /* @__PURE__ */ a("div", { className: "flex flex-wrap items-start gap-3", children: [
      /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(de, { mcp: e.mcp, state: n, withPoll: !0 }) }),
      /* @__PURE__ */ t(x, { onClick: e.onPoll, disabled: !!e.busy || !e.configured, children: "Poll now" })
    ] }),
    /* @__PURE__ */ t("div", { ref: S, children: /* @__PURE__ */ t(
      Pe,
      {
        state: n,
        events: e.events,
        configured: e.configured,
        busy: e.busy,
        expanded: A,
        setExpanded: k,
        pending: b,
        setPending: f,
        onStart: e.onStart,
        onChanged: e.onChanged
      }
    ) }),
    !e.configured && /* @__PURE__ */ a(D, { className: "mb-4", children: [
      /* @__PURE__ */ t(E, { children: "Finish setup" }),
      /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite." })
    ] }),
    /* @__PURE__ */ t(
      Ae,
      {
        needs: e.needs,
        today: n.crew.today,
        handled: e.handled,
        onChanged: e.onChanged,
        onWhy: v
      }
    ),
    /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4", children: [
      /* @__PURE__ */ t(z, { label: "Awaiting triage", value: n.counts.needs_triage, accent: !0 }),
      /* @__PURE__ */ t(z, { label: "Possibly resolved", value: n.counts.possibly_resolved }),
      /* @__PURE__ */ t(z, { label: "Open p0 / p1", value: `${_.p0 || 0} / ${_.p1 || 0}` }),
      /* @__PURE__ */ t(z, { label: "Tracked items", value: n.counts.total })
    ] }),
    /* @__PURE__ */ a(D, { className: "mb-4", children: [
      /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2 mb-3", children: [
        /* @__PURE__ */ t(E, { children: "Ledger" }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-filter", children: "Show" }),
        /* @__PURE__ */ a(
          "select",
          {
            id: "sr-filter",
            className: "text-sm bg-transparent border rounded px-2 py-1",
            value: e.filter,
            onChange: (c) => e.setFilter(c.target.value),
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
          L,
          {
            "aria-label": "GitHub repository to search (owner/name, optional)",
            placeholder: "owner/repo (optional)",
            value: i,
            onChange: (c) => u(c.target.value),
            className: "w-48"
          }
        ),
        /* @__PURE__ */ a(x, { onClick: () => e.onInvestigate(i), disabled: s.size === 0 || !!e.busy, children: [
          "Investigate ",
          s.size || ""
        ] })
      ] }),
      l.length === 0 ? /* @__PURE__ */ t(fe, { icon: /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "📡" }), title: "Nothing here yet", subtitle: "New messages appear after the next poll." }) : /* @__PURE__ */ t("ul", { className: "flex flex-col", children: l.map((c, y) => /* @__PURE__ */ t(Ie, { it: c, first: y === 0, checked: s.has(c.key), onToggle: () => W(c.key) }, c.key)) })
    ] }),
    /* @__PURE__ */ t(Le, { state: n, busy: e.busy, onDigest: e.onDigest }),
    /* @__PURE__ */ a(D, { children: [
      /* @__PURE__ */ t(E, { children: "Channels" }),
      $.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No channels configured." }) : /* @__PURE__ */ a("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ t("thead", { children: /* @__PURE__ */ a("tr", { className: "text-left text-muted", children: [
          /* @__PURE__ */ t("th", { scope: "col", children: "Channel" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Last polled" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Status" })
        ] }) }),
        /* @__PURE__ */ t("tbody", { children: $.map((c) => /* @__PURE__ */ a("tr", { children: [
          /* @__PURE__ */ t("td", { className: "font-mono", children: c.cid }),
          /* @__PURE__ */ t("td", { children: V(c.last_polled_at) }),
          /* @__PURE__ */ t("td", { children: c.last_error ? /* @__PURE__ */ t(F, { variant: "err", title: c.last_error, children: "error" }) : /* @__PURE__ */ t(F, { variant: "ok", children: "ok" }) })
        ] }, c.cid)) })
      ] })
    ] })
  ] });
}
const ee = {
  decide: "Needs a decision",
  unanswered: "Questions nobody answered",
  clusters: "Reported more than once"
};
function _e(e) {
  return e < 1 ? "under 1 h old" : e < 48 ? `${Math.round(e)} h old` : `${Math.floor(e / 24)} days old`;
}
function $e(e) {
  return `Why is "${e.summary.length > 80 ? `${e.summary.slice(0, 79)}…` : e.summary}" ${e.priority || "on my list"}?`;
}
function Te(e) {
  return e ? /* @__PURE__ */ t(F, { variant: e === "p0" || e === "p1" ? "err" : "muted", children: e }) : null;
}
function J({ message: e, onRetry: n }) {
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
function te({ label: e, actions: n }) {
  const l = se(null);
  return /* @__PURE__ */ a("details", { ref: l, style: { position: "relative" }, children: [
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
        children: n.map((s) => /* @__PURE__ */ t(
          "button",
          {
            type: "button",
            role: "menuitem",
            onClick: () => {
              l.current && (l.current.open = !1), s.onClick();
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
            children: s.label
          },
          s.label
        ))
      }
    )
  ] });
}
const B = { fontSize: 12, padding: "2px 10px" };
function Re({
  e,
  first: n,
  onMark: l,
  onWhy: s,
  onStartFix: o
}) {
  const i = !!e.handoff_title && !!o;
  return /* @__PURE__ */ t("li", { className: "text-sm", style: { padding: "10px 0", borderTop: n ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ a("div", { className: "flex items-start gap-2", children: [
    /* @__PURE__ */ t("div", { style: { flex: "none", minWidth: 28 }, children: Te(e.priority) }),
    /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
      i && /* @__PURE__ */ a("div", { className: "text-xs", style: { marginTop: 2 }, children: [
        "Fix: ",
        e.handoff_title
      ] }),
      /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        e.reason,
        e.words && e.words.length > 0 && /* @__PURE__ */ a(I, { children: [
          " (",
          e.words.join(", "),
          ")"
        ] }),
        " · ",
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        " · ",
        _e(e.age_hours),
        e.permalink && /* @__PURE__ */ a(I, { children: [
          " · ",
          /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open in Slack" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ t("div", { className: "flex items-center gap-1", style: { flex: "none" }, children: i ? /* @__PURE__ */ a(I, { children: [
      /* @__PURE__ */ t(x, { style: B, onClick: o, children: "Start fix session" }),
      /* @__PURE__ */ t(x, { style: B, onClick: () => l("ignored"), children: "Ignore" }),
      /* @__PURE__ */ t(
        te,
        {
          label: "More actions",
          actions: [
            { label: "Done", onClick: () => l("done") },
            { label: "Why? Ask the lead", onClick: s }
          ]
        }
      )
    ] }) : /* @__PURE__ */ a(I, { children: [
      /* @__PURE__ */ t(x, { style: B, onClick: () => l("done"), children: "Done" }),
      /* @__PURE__ */ t(x, { style: B, onClick: () => l("ignored"), children: "Ignore" }),
      /* @__PURE__ */ t(te, { label: "More actions", actions: [{ label: "Why? Ask the lead", onClick: s }] })
    ] }) })
  ] }) });
}
const We = typeof X.useChatLauncher == "function" ? X.useChatLauncher : () => null;
function De() {
  const e = We(), [n, l] = h(null), [s, o] = h(!1), i = (f) => {
    e ? e.openChat({ message: f.prompt, autoSend: !1 }) : (o(!1), l(f));
  }, u = async () => {
    if (n)
      try {
        await navigator.clipboard.writeText(n.prompt), o(!0);
      } catch {
        o(!1);
      }
  }, b = n ? /* @__PURE__ */ t(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "sr-fix-title",
      style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" },
      onKeyDown: (f) => f.key === "Escape" && l(null),
      children: /* @__PURE__ */ a("div", { style: { width: "min(720px, 92vw)", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: 16 }, children: [
        /* @__PURE__ */ t("h3", { id: "sr-fix-title", className: "text-sm", style: { margin: "0 0 6px", fontWeight: 600 }, children: n.title }),
        /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 8px" }, children: "Copy this task into a new chat. Nothing is sent for you." }),
        /* @__PURE__ */ t(
          "textarea",
          {
            readOnly: !0,
            "aria-label": "Fix task",
            value: n.prompt,
            style: { width: "100%", height: 260, fontSize: 12, fontFamily: "var(--font-mono, monospace)" }
          }
        ),
        /* @__PURE__ */ a("div", { className: "flex items-center gap-2", style: { marginTop: 8 }, children: [
          /* @__PURE__ */ t(x, { onClick: u, children: s ? "Copied" : "Copy prompt" }),
          /* @__PURE__ */ t("a", { className: "underline text-sm", href: "/chat?new=1", children: "New chat" }),
          /* @__PURE__ */ t("div", { className: "flex-1" }),
          /* @__PURE__ */ t(x, { onClick: () => l(null), children: "Close" })
        ] })
      ] })
    }
  ) : null;
  return [i, b];
}
function Ae({
  needs: e,
  today: n,
  handled: l,
  onChanged: s,
  onWhy: o
}) {
  const i = H(), [u, b] = De(), f = (e == null ? void 0 : e.handoffs) || [], A = new Map(f.map((r) => [r.key, r.handoff])), [k, S] = h(""), _ = async (r) => {
    S("");
    try {
      await i.post(`${w}/items/handoff/dismiss`, { key: r }), s();
    } catch {
      S(r);
    }
  }, [W, $] = h(/* @__PURE__ */ new Set()), [v, c] = h(null);
  U(() => $(/* @__PURE__ */ new Set()), [e]);
  const y = async (r, m, d) => {
    c(null), d && $((g) => new Set(g).add(d));
    try {
      for (const g of r) await i.post(`${w}/items/handle`, { key: g, how: m });
      s();
    } catch {
      d && $((g) => {
        const N = new Set(g);
        return N.delete(d), N;
      }), c({ keys: r, how: m, rowId: d });
    }
  }, C = ((e == null ? void 0 : e.groups) || []).map((r) => ({
    ...r,
    shown: r.entries.filter((m) => !W.has(`${r.id}:${m.key}`))
  })), P = C.every((r) => r.shown.length === 0), T = (v == null ? void 0 : v.how) === "reopen" ? "reopen" : (v == null ? void 0 : v.how) === "ignored" ? "ignore" : "mark as done";
  return /* @__PURE__ */ a(D, { className: "mb-4", children: [
    /* @__PURE__ */ t(E, { children: "Needs you" }),
    (n == null ? void 0 : n.text) && /* @__PURE__ */ a("p", { className: "text-sm", style: { margin: "0 0 8px" }, "data-testid": "crew-today", children: [
      n.text,
      n.at > 0 && /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
        " · ",
        M(n.at)
      ] })
    ] }),
    v && /* @__PURE__ */ t(
      J,
      {
        message: `Could not ${T} that message. Nothing changed.`,
        onRetry: () => y(v.keys, v.how, v.rowId)
      }
    ),
    e ? P ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Nothing needs you right now." }) : C.map(
      (r) => r.shown.length === 0 ? null : /* @__PURE__ */ a("section", { "aria-label": ee[r.id], style: { marginTop: 10 }, children: [
        /* @__PURE__ */ a("h4", { className: "text-sm", style: { margin: 0, fontWeight: 600, color: "var(--text-strong)" }, children: [
          ee[r.id],
          " ",
          /* @__PURE__ */ a("span", { className: "text-muted", style: { fontWeight: 400 }, children: [
            "(",
            r.total - (r.entries.length - r.shown.length),
            ")"
          ] })
        ] }),
        /* @__PURE__ */ t("ul", { className: "flex flex-col", children: r.shown.map((m, d) => /* @__PURE__ */ t(
          Re,
          {
            e: m,
            first: d === 0,
            onMark: (g) => {
              var N;
              return y((N = m.members) != null && N.length ? m.members : [m.key], g, `${r.id}:${m.key}`);
            },
            onWhy: () => o(m),
            onStartFix: r.id === "decide" && A.has(m.key) ? () => u(A.get(m.key)) : void 0
          },
          m.key
        )) })
      ] }, r.id)
    ) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" }),
    k && /* @__PURE__ */ t(J, { message: "Could not dismiss that hand-off. Nothing changed.", onRetry: () => _(k) }),
    f.length > 0 && /* @__PURE__ */ a("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ a("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Fixes handed off (",
        (e == null ? void 0 : e.handoffs_total) ?? f.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: f.map((r, m) => /* @__PURE__ */ a(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: m === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ a("span", { style: { flex: 1, minWidth: 0 }, children: [
              r.handoff.title,
              /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
                " · ",
                r.summary,
                " · ",
                /* @__PURE__ */ t("span", { className: "font-mono", children: r.handoff.repo }),
                " · ",
                M(r.handoff.at)
              ] })
            ] }),
            /* @__PURE__ */ t(x, { style: B, onClick: () => u(r.handoff), children: "Start fix session" }),
            /* @__PURE__ */ t(x, { style: B, onClick: () => _(r.key), children: "Dismiss" })
          ]
        },
        r.key
      )) })
    ] }),
    ((e == null ? void 0 : e.handled_total) || 0) > 0 && /* @__PURE__ */ a("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ a("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Handled (",
        e == null ? void 0 : e.handled_total,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: l.map((r, m) => /* @__PURE__ */ a(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: m === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 0 }, children: r.summary || r.text.slice(0, 200) }),
            /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
              r.handled_how === "ignored" ? "Ignored" : "Done",
              " ",
              M(r.handled_at)
            ] }),
            /* @__PURE__ */ t(x, { style: B, onClick: () => y([r.key], "reopen"), children: "Reopen" })
          ]
        },
        r.key
      )) })
    ] }),
    b
  ] });
}
function Ie({ it: e, first: n, checked: l, onToggle: s }) {
  const o = e.priority ? { label: e.priority, variant: e.priority === "p0" || e.priority === "p1" ? "err" : "muted" } : e.possibly_resolved ? { label: "possibly resolved", variant: "warn" } : null, i = [
    e.category && `category: ${e.category}`,
    e.possibly_resolved && `possibly resolved: ${e.possibly_resolved.reason}`
  ].filter(Boolean);
  return /* @__PURE__ */ t("li", { className: "text-sm", style: { padding: "10px 0", borderTop: n ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ a("div", { className: "flex items-start gap-2", children: [
    /* @__PURE__ */ t(
      "input",
      {
        type: "checkbox",
        "aria-label": `Select ${e.key} for investigation`,
        checked: l,
        onChange: s,
        style: { marginTop: 4 }
      }
    ),
    /* @__PURE__ */ a("div", { className: "flex items-center gap-1", style: { flex: "none" }, children: [
      /* @__PURE__ */ t(F, { variant: we(e.status), children: e.status }),
      o && /* @__PURE__ */ t(F, { variant: o.variant, children: o.label }),
      i.length > 0 && /* @__PURE__ */ a("span", { className: "text-xs text-muted", title: i.join(`
`), "aria-label": i.join("; "), children: [
        "+",
        i.length
      ] })
    ] }),
    /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || e.text.slice(0, 280) }),
      /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        e.user && /* @__PURE__ */ a(I, { children: [
          " · ",
          e.user
        ] }),
        e.reply_count > 0 && /* @__PURE__ */ a(I, { children: [
          " · ",
          e.reply_count,
          " replies"
        ] }),
        " · ",
        /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "open in Slack" }),
        e.links.length > 0 && /* @__PURE__ */ a(I, { children: [
          " · linked ",
          e.links.map((u) => /* @__PURE__ */ t("a", { className: "underline mr-2", href: u, target: "_blank", rel: "noreferrer noopener", children: u.replace("https://github.com/", "") }, u))
        ] })
      ] }),
      e.note && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: e.note })
    ] })
  ] }) });
}
function Le({ state: e, busy: n, onDigest: l }) {
  const s = e.digest, o = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), i = s.last_posted_date === o;
  return /* @__PURE__ */ a(D, { className: "mb-4", children: [
    /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ t(E, { children: i ? "Today's digest" : "Latest digest" }),
      s.pending ? /* @__PURE__ */ t(F, { variant: "aim", children: "being delivered" }) : null,
      /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: s.last_posted_date ? `${s.last_posted_date} · ${e.settings.digest_destination === "self_dm" ? "DMed to you" : "dashboard notification"}` : "none yet" }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      /* @__PURE__ */ t(x, { onClick: l, disabled: !!n || !e.crew.live, children: "Request digest" })
    ] }),
    s.last_text ? /* @__PURE__ */ t("pre", { className: "whitespace-pre-wrap text-sm mt-2", style: { fontFamily: "inherit", margin: "8px 0 0" }, children: s.last_text }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted mt-2", children: "The Radar Lead writes one after the daily cron or when you press Request digest." }),
    s.last_error && /* @__PURE__ */ t("p", { className: "text-xs mt-1", style: { color: "var(--danger)" }, children: s.last_error })
  ] });
}
function Be({ state: e }) {
  return /* @__PURE__ */ t("div", { className: "flex items-center gap-2", style: { marginTop: 10 }, children: Y.map((n) => /* @__PURE__ */ a("span", { title: `${n.title} · ${j(n, e).label}`, children: [
    /* @__PURE__ */ t(q, { m: n, s: e, selected: n.id === "lead", size: 30 }),
    /* @__PURE__ */ t("span", { className: "sr-only", children: `${n.title}: ${j(n, e).label}` })
  ] }, n.id)) });
}
function Fe(e) {
  const n = `slack-radar:chat-open:${e}`, l = () => {
    try {
      return window.localStorage.getItem(n) === "1";
    } catch {
      return !1;
    }
  }, [s, o] = h(l);
  U(() => o(l()), [n]);
  const i = Q(
    (u) => {
      o(u);
      try {
        u ? window.localStorage.setItem(n, "1") : window.localStorage.removeItem(n);
      } catch {
      }
    },
    [n]
  );
  return [s, i];
}
function ne({ q: e, onClick: n, disabled: l }) {
  return /* @__PURE__ */ t(
    "button",
    {
      type: "button",
      onClick: n,
      disabled: l,
      style: {
        fontSize: 12,
        border: "1px solid var(--border-strong)",
        borderRadius: 999,
        padding: "4px 10px",
        background: "transparent",
        color: "var(--text)",
        cursor: l ? "not-allowed" : "pointer",
        opacity: l ? 0.5 : 1,
        whiteSpace: "nowrap"
      },
      children: e
    }
  );
}
function Pe(e) {
  const n = H(), { state: l, expanded: s, pending: o } = e, i = Y[0], u = l.crew.slot_key, b = l.crew.live && l.crew.session_open && l.crew.session_agent === l.crew.agent, [f, A] = h(""), [k, S] = h(!1), [_, W] = h(""), [$, v] = h(!1), c = j(i, l), y = async (d) => {
    await n.post(`${w}/crew/message`, { message: d }), e.onChanged();
  }, C = async (d) => {
    const g = d.trim();
    if (g) {
      S(!0), W("");
      try {
        await n.post(`${w}/crew/message`, { message: g }), A(""), g === o && e.setPending(""), e.setExpanded(!0), e.onChanged();
      } catch {
        W(g);
      } finally {
        S(!1);
      }
    }
  }, P = async () => {
    try {
      await navigator.clipboard.writeText(o), v(!0), window.setTimeout(() => v(!1), 1500);
    } catch {
      v(!1);
    }
  }, T = _ && /* @__PURE__ */ t(J, { message: "The Radar Lead did not get that message.", onRetry: () => C(_) }), r = /* @__PURE__ */ t("div", { className: "text-sm", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }, children: l.crew.live ? /* @__PURE__ */ a(I, { children: [
    /* @__PURE__ */ t("span", { children: "The Radar Lead session opens on its next turn. Open it now to talk here." }),
    /* @__PURE__ */ t(x, { primary: !0, onClick: e.onStart, disabled: !!e.busy || !e.configured, children: "Open the session" })
  ] }) : /* @__PURE__ */ a("span", { children: [
    "The Radar Lead is paused. Turn on ",
    /* @__PURE__ */ t("b", { children: "Crew" }),
    " at the top of the page to triage your channels and talk to it here."
  ] }) });
  if (!s)
    return /* @__PURE__ */ a(D, { className: "mb-4", style: { padding: "10px 14px" }, children: [
      /* @__PURE__ */ a(
        "form",
        {
          className: "flex flex-wrap items-center gap-2",
          onSubmit: (d) => {
            d.preventDefault(), C(f);
          },
          children: [
            /* @__PURE__ */ t(q, { m: i, s: l, size: 26 }),
            /* @__PURE__ */ t(
              L,
              {
                "aria-label": "Ask the lead",
                placeholder: "Ask the lead…",
                value: f,
                onChange: (d) => A(d.target.value),
                disabled: !b || k,
                style: { flex: 1, minWidth: 200 }
              }
            ),
            /* @__PURE__ */ t(x, { primary: !0, type: "submit", disabled: !b || k || !f.trim(), children: "Send" }),
            Z.map((d) => /* @__PURE__ */ t(ne, { q: d, onClick: () => C(d), disabled: !b || k }, d))
          ]
        }
      ),
      !b && /* @__PURE__ */ t("div", { style: { marginTop: 8 }, children: r }),
      T
    ] });
  const m = e.events.filter((d) => d.kind === "crew" || d.kind === "digest").slice(0, 5);
  return /* @__PURE__ */ a(
    D,
    {
      className: "mb-4",
      style: { padding: 0, display: "flex", flexDirection: "column", height: "min(620px, calc(100vh - 180px))", overflow: "hidden" },
      children: [
        /* @__PURE__ */ a("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border)" }, children: [
          /* @__PURE__ */ a("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: l.crew.name || i.title }),
            /* @__PURE__ */ t(F, { variant: c.tone === "muted" ? "muted" : c.tone === "aim" ? "aim" : "ok", children: c.label }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(x, { onClick: () => e.setExpanded(!1), "aria-expanded": !0, children: "Collapse" })
          ] }),
          /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
            "phase ",
            l.crew_memory.phase,
            " · next: ",
            l.crew_memory.next || "—"
          ] }),
          /* @__PURE__ */ t(Be, { state: l })
        ] }),
        o && // ChatEmbed has no API to fill its composer, so the question waits here.
        /* @__PURE__ */ a(
          "div",
          {
            className: "text-sm flex flex-wrap items-center gap-2",
            style: { padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" },
            children: [
              /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200, userSelect: "all" }, children: o }),
              /* @__PURE__ */ t(x, { primary: !0, style: B, onClick: () => C(o), disabled: !b || k, children: "Send" }),
              /* @__PURE__ */ t(x, { style: B, onClick: P, children: $ ? "Copied" : "Copy" })
            ]
          }
        ),
        T && /* @__PURE__ */ t("div", { style: { padding: "0 16px" }, children: T }),
        /* @__PURE__ */ t("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: b ? /* @__PURE__ */ t(
          pe,
          {
            slotKey: u,
            agent: l.crew.agent,
            frameless: !0,
            startAtBottom: !0,
            placeholder: "Ask the Radar Lead…",
            onSend: y
          },
          u
        ) : /* @__PURE__ */ a("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 10 }, children: [
          r,
          !e.configured && /* @__PURE__ */ t("p", { className: "text-xs text-muted", children: "Add a channel in Settings first." }),
          m.length > 0 && /* @__PURE__ */ t("ul", { className: "text-xs text-muted flex flex-col gap-1", style: { marginTop: 6 }, children: m.map((d, g) => /* @__PURE__ */ a("li", { children: [
            M(d.at),
            " · ",
            d.text
          ] }, `${d.at}-${g}`)) })
        ] }) }),
        /* @__PURE__ */ t("div", { className: "flex flex-wrap gap-2", style: { padding: "10px 16px 12px", borderTop: "1px solid var(--border)" }, children: Z.map((d) => /* @__PURE__ */ t(ne, { q: d, onClick: () => C(d), disabled: !b || k }, d)) })
      ]
    }
  );
}
function Ee({ state: e }) {
  return /* @__PURE__ */ a(D, { children: [
    /* @__PURE__ */ t(E, { children: "Team" }),
    /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { marginBottom: 8 }, children: "Who works on your channels. Only the Radar Lead has a session; the others run when needed." }),
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: Y.map((n) => {
      var o, i;
      const l = j(n, e), s = n.id === "lead" ? e.crew.agent : n.agent;
      return /* @__PURE__ */ a(
        "li",
        {
          className: "flex items-start gap-3",
          style: { padding: "12px 4px", borderTop: "1px solid var(--border)", opacity: n.planned ? 0.7 : 1 },
          children: [
            /* @__PURE__ */ t(q, { m: n, s: e, size: 36 }),
            /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
              /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2", children: [
                /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: n.id === "lead" && e.crew.name || n.title }),
                /* @__PURE__ */ t(F, { variant: "muted", children: n.layer }),
                /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: n.kind })
              ] }),
              /* @__PURE__ */ t("p", { className: "text-sm", style: { margin: "4px 0 0" }, children: n.duty }),
              n.id === "investigator" && (((o = e.investigations) == null ? void 0 : o.items) || 0) > 0 && /* @__PURE__ */ a("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: [
                (i = e.investigations) == null ? void 0 : i.items,
                " item(s) under investigation"
              ] }),
              s && /* @__PURE__ */ t(re, { children: /* @__PURE__ */ a("span", { className: "font-mono", children: [
                "agent: ",
                s,
                n.id === "lead" && e.crew.slot_key ? ` · session: ${e.crew.slot_key}` : ""
              ] }) })
            ] }),
            /* @__PURE__ */ t("span", { className: "text-xs", style: { color: ie[l.tone], whiteSpace: "nowrap" }, children: l.label })
          ]
        },
        n.id
      );
    }) })
  ] });
}
function Me({ events: e }) {
  return /* @__PURE__ */ a(D, { children: [
    /* @__PURE__ */ t(E, { children: "Activity" }),
    e.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No activity yet." }) : /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", children: e.map((n, l) => /* @__PURE__ */ a("li", { children: [
      /* @__PURE__ */ t("span", { className: "text-muted", children: V(n.at) }),
      " ",
      /* @__PURE__ */ t(F, { variant: "muted", children: n.kind }),
      " ",
      n.text
    ] }, `${n.at}-${l}`)) })
  ] });
}
function Oe({
  state: e,
  busy: n,
  act: l,
  mcp: s,
  onProbe: o
}) {
  const i = H(), [u, b] = h(e.settings.channels.join(`
`)), [f, A] = h(e.settings.digest_destination), [k, S] = h(e.settings.slack_login), [_, W] = h(e.settings.slack_mcp_command), [$, v] = h(e.settings.workspace_url), [c, y] = h(String(e.settings.poll_interval_secs)), [C, P] = h(String(e.settings.backfill_hours)), [T, r] = h(e.crew.unattended), [m, d] = h(e.crew.agent), [g, N] = h(e.crew.model), O = () => l(
    "Save settings",
    () => i.put(`${w}/settings`, {
      channels: u.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean),
      digest_destination: f,
      slack_login: k.trim(),
      slack_mcp_command: _.trim(),
      workspace_url: $.trim(),
      poll_interval_secs: Number(c),
      backfill_hours: Number(C)
    })
  );
  return /* @__PURE__ */ a(I, { children: [
    !e.vault_available && /* @__PURE__ */ t(D, { className: "mb-4", children: /* @__PURE__ */ t("p", { className: "text-sm", children: "The gateway secret vault is unavailable, so settings cannot be saved." }) }),
    /* @__PURE__ */ a(D, { className: "mb-4", children: [
      /* @__PURE__ */ t(E, { children: "Basics" }),
      /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(de, { mcp: s, state: e }) }),
        /* @__PURE__ */ t(x, { disabled: !!n, onClick: o, children: "Check connection" })
      ] }),
      /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 12px" }, children: "Slack is read as you, read-only: no bot, no invite. The one write is the optional digest DM to yourself." }),
      /* @__PURE__ */ t("label", { className: "block text-sm mb-1", htmlFor: "sr-channels", children: "Channels to watch (one channel ID per line, e.g. C0123ABCD). Any channel you can read works." }),
      /* @__PURE__ */ t(
        "textarea",
        {
          id: "sr-channels",
          className: "w-full font-mono text-sm border rounded p-2 bg-transparent",
          rows: 5,
          value: u,
          onChange: (p) => b(p.target.value)
        }
      ),
      /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Digest destination",
          /* @__PURE__ */ a(
            "select",
            {
              className: "block w-full text-sm bg-transparent border rounded px-2 py-1",
              value: f,
              onChange: (p) => A(p.target.value),
              children: [
                /* @__PURE__ */ t("option", { value: "dashboard", children: "Dashboard notification only" }),
                /* @__PURE__ */ t("option", { value: "self_dm", children: "DM to myself in Slack" })
              ]
            }
          )
        ] }),
        f === "self_dm" && /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Your Slack login (for the DM)",
          /* @__PURE__ */ t(L, { value: k, onChange: (p) => S(p.target.value), placeholder: "jdoe" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Poll interval (seconds, 60–3600)",
          /* @__PURE__ */ t(L, { type: "number", min: 60, max: 3600, value: c, onChange: (p) => y(p.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(x, { primary: !0, className: "mt-3", disabled: !!n, onClick: O, children: "Save settings" })
    ] }),
    /* @__PURE__ */ t(D, { children: /* @__PURE__ */ a("details", { children: [
      /* @__PURE__ */ t("summary", { style: { cursor: "pointer", fontWeight: 600, color: "var(--text-strong)" }, children: "Advanced" }),
      /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "MCP server command (a single executable on PATH)",
          /* @__PURE__ */ t(L, { value: _, onChange: (p) => W(p.target.value), placeholder: "ai-community-slack-mcp" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Workspace URL (for permalinks, optional)",
          /* @__PURE__ */ t(L, { value: $, onChange: (p) => v(p.target.value), placeholder: "https://yourteam.slack.com" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "First-poll backfill (hours, 0–168)",
          /* @__PURE__ */ t(L, { type: "number", min: 0, max: 168, value: C, onChange: (p) => P(p.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(x, { className: "mt-3", disabled: !!n, onClick: O, children: "Save settings" }),
      /* @__PURE__ */ a("div", { style: { borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }, children: [
        /* @__PURE__ */ t("div", { className: "text-sm", style: { fontWeight: 600, marginBottom: 8 }, children: "Crew" }),
        /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
          /* @__PURE__ */ a("label", { className: "text-sm", children: [
            "Agent",
            /* @__PURE__ */ t(L, { value: m, onChange: (p) => d(p.target.value), placeholder: "slack-radar-crew" }),
            /* @__PURE__ */ t("span", { className: "block text-xs text-muted mt-1", children: "Default: the shipped slack-radar-crew agent. Your own agents are never modified." })
          ] }),
          /* @__PURE__ */ a("label", { className: "text-sm", children: [
            "Model (empty = agent default)",
            /* @__PURE__ */ t(L, { value: g, onChange: (p) => N(p.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ a("div", { className: "mt-3 flex items-center gap-2", children: [
          /* @__PURE__ */ t(
            ae,
            {
              checked: T,
              onChange: r,
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
            onClick: () => l("Save crew", () => i.put(`${w}/crew`, { agent: m, model: g, unattended: T })),
            children: "Save crew"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  Ke as default
};
