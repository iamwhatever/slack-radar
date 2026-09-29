import { jsxs as a, Fragment as D, jsx as t } from "react/jsx-runtime";
import * as ae from "@kirocrew/app-sdk";
import { useAppApi as G, ChatEmbed as be } from "@kirocrew/app-sdk";
import { PageHeader as we, Toggle as ie, Btn as y, Card as P, CardTitle as z, StatCard as J, Input as O, EmptyState as ke, Badge as M } from "@kirocrew/app-sdk/ui";
import { useState as h, useCallback as X, useEffect as U, useRef as oe, useMemo as Ne } from "react";
const w = "/api/apps/slack-radar", _e = {
  checking: "checking…",
  connected: "connected",
  needs_login: "sign in again",
  binary_not_found: "not installed",
  incompatible: "missing read access",
  error: "not working"
}, se = ["What needs me today?", "Draft today's digest", "Which threads look resolved?"], Ce = [
  { id: "board", label: "Board" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" }
], Z = (e) => e ? new Date(e * 1e3).toLocaleString() : "never";
function j(e) {
  if (!e) return "never";
  const n = Math.max(0, Date.now() / 1e3 - e);
  return n < 90 ? "just now" : n < 3600 ? `${Math.round(n / 60)} min ago` : n < 86400 ? `${Math.round(n / 3600)} h ago` : Z(e);
}
function de(e, n) {
  return n === "needs_login" ? "needs_login" : (e == null ? void 0 : e.status) || "checking";
}
function ce({ children: e, summary: n = "Details" }) {
  return /* @__PURE__ */ a("details", { className: "text-xs text-muted", style: { marginTop: 6 }, children: [
    /* @__PURE__ */ t("summary", { style: { cursor: "pointer" }, children: n }),
    /* @__PURE__ */ t("div", { style: { marginTop: 4 }, children: e })
  ] });
}
const ee = [
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
function H(e, n) {
  var l;
  if (e.id === "lead")
    return n.crew.live ? n.crew.running ? { label: "working", tone: "aim" } : { label: "live", tone: "ok" } : { label: "paused", tone: "muted" };
  if (e.id === "investigator") {
    const s = ((l = n.investigations) == null ? void 0 : l.running) || 0;
    return s ? { label: `${s} running`, tone: "aim" } : { label: "standing by", tone: "muted" };
  }
  return e.id === "watcher" ? { label: "standing by", tone: "muted" } : n.source_state === "needs_login" ? { label: "sign in again", tone: "warn" } : { label: `polled ${j(n.last_poll_at)}`, tone: "muted" };
}
const he = {
  ok: "var(--ok)",
  aim: "var(--aim)",
  warn: "var(--warn)",
  muted: "var(--muted-strong)"
};
function te({ m: e, s: n, selected: l, size: s = 32 }) {
  const o = H(e, n), i = e.planned || e.id === "poller", u = {
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
          background: he[o.tone]
        }
      }
    )
  ] });
}
function Se(e) {
  return e === "new" ? "warn" : e === "investigating" ? "aim" : e === "resolved" ? "ok" : "muted";
}
function $e({ tab: e, setTab: n }) {
  return /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Slack Radar sections", style: { display: "flex", gap: 4 }, children: Ce.map((l) => {
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
function Te({
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
      ie,
      {
        checked: i,
        disabled: !!l || !i && !n,
        onChange: (m) => m ? s() : o(),
        label: i ? "Pause the crew" : "Start the crew"
      }
    ),
    /* @__PURE__ */ a("span", { className: "text-xs text-muted", title: "Whether the crew's commands run without asking you", children: [
      "Unattended: ",
      e.crew.trusted ? "on" : "off"
    ] })
  ] });
}
function Ve() {
  const e = G(), [n, l] = h("board"), [s, o] = h(null), [i, u] = h([]), [m, f] = h(null), [k, b] = h([]), [R, _] = h([]), [C, A] = h("open"), [W, d] = h(/* @__PURE__ */ new Set()), [x, v] = h(""), [S, I] = h(""), [L, E] = h(null), g = X(async () => {
    try {
      E(await e.get(`${w}/mcp/status`));
    } catch (T) {
      E({ status: "error", command: "", detail: T.message });
    }
  }, [e]);
  U(() => {
    g();
  }, [g]);
  const N = X(async () => {
    try {
      const [T, Y, q, fe, ve] = await Promise.all([
        e.get(`${w}/state`),
        e.get(`${w}/items?status=${encodeURIComponent(C)}&limit=300`),
        e.get(`${w}/events?limit=150`),
        e.get(`${w}/needs`),
        e.get(`${w}/items?handled=1&limit=100`)
      ]);
      o(T), u(Y.items), f(fe), b(ve.items), _(q.events.slice().reverse());
    } catch (T) {
      I(`Could not load: ${T.message}`);
    }
  }, [e, C]);
  U(() => {
    N();
    const T = window.setInterval(N, 3e4);
    return () => window.clearInterval(T);
  }, [N]);
  const r = async (T, Y) => {
    v(T), I("");
    try {
      await Y(), I(`${T}: done`), await N();
    } catch (q) {
      I(`${T} failed: ${q.message}`);
    } finally {
      v("");
    }
  }, c = !!s && s.settings.channels.length > 0, p = (s == null ? void 0 : s.settings.channels.length) || 0, $ = s ? `${p ? `Watching ${p} channel${p === 1 ? "" : "s"}` : "No channels yet"} · ${s.crew.live ? "running" : "paused"}` : "A small crew triaging your Slack channels", F = s ? de(L, s.source_state) : "checking", V = () => {
    g(), N();
  };
  return /* @__PURE__ */ a(D, { children: [
    /* @__PURE__ */ t(
      we,
      {
        title: "Slack Radar",
        subtitle: $,
        actions: /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-4", children: [
          /* @__PURE__ */ t($e, { tab: n, setTab: l }),
          s && /* @__PURE__ */ t(
            Te,
            {
              state: s,
              configured: c,
              busy: x,
              onStart: () => r("Start crew", () => e.post(`${w}/crew/start`, {})),
              onPause: () => r("Pause crew", () => e.post(`${w}/crew/pause`, {}))
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ a("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      s && F === "needs_login" && /* @__PURE__ */ t(Re, { mcp: L, sourceError: s.source_error, busy: x, onCheck: V }),
      S && /* @__PURE__ */ t("p", { role: "status", className: "text-sm text-muted mb-3", children: S }),
      s ? n === "board" ? /* @__PURE__ */ t(
        We,
        {
          state: s,
          items: i,
          needs: m,
          handled: k,
          configured: c,
          mcp: L,
          filter: C,
          setFilter: A,
          selected: W,
          setSelected: d,
          busy: x,
          onPoll: () => r("Poll", () => e.post(`${w}/poll`, {})),
          onInvestigate: (T) => r("Investigate", async () => {
            await e.post(`${w}/investigate`, { keys: [...W], repo: T }), d(/* @__PURE__ */ new Set());
          }),
          onStart: () => r("Start crew", () => e.post(`${w}/crew/start`, {})),
          onDigest: () => r("Request digest", () => e.post(`${w}/digest/request`, {})),
          events: R,
          onChanged: N
        }
      ) : n === "team" ? /* @__PURE__ */ t(je, { state: s }) : n === "activity" ? /* @__PURE__ */ t(Ue, { events: R }) : /* @__PURE__ */ t(Ke, { state: s, busy: x, act: r, mcp: L, onProbe: g }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" })
    ] })
  ] });
}
function me({ mcp: e, sourceError: n }) {
  var s;
  const l = [
    (e == null ? void 0 : e.status) && `status: ${e.status}`,
    (e == null ? void 0 : e.command) && `command: ${e.command}`,
    n && `error: ${n}`,
    (e == null ? void 0 : e.detail) && e.detail !== n && `detail: ${e.detail}`,
    ((s = e == null ? void 0 : e.missing_read_tools) == null ? void 0 : s.length) && `missing read tools: ${e.missing_read_tools.join(", ")}`
  ].filter(Boolean);
  return l.length ? /* @__PURE__ */ t(ce, { children: /* @__PURE__ */ t("pre", { className: "font-mono whitespace-pre-wrap", style: { margin: 0 }, children: l.join(`
`) }) }) : null;
}
function Re({ mcp: e, sourceError: n, busy: l, onCheck: s }) {
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
          /* @__PURE__ */ t(y, { primary: !0, onClick: s, disabled: !!l, children: "I signed in, check again" })
        ] }),
        /* @__PURE__ */ t(me, { mcp: e, sourceError: n })
      ]
    }
  );
}
function pe({ mcp: e, state: n, withPoll: l }) {
  const s = de(e, n.source_state), o = s === "connected";
  return /* @__PURE__ */ a("div", { className: "mb-4", children: [
    /* @__PURE__ */ a("p", { role: "status", className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { margin: 0 }, children: [
      /* @__PURE__ */ t("span", { "aria-hidden": !0, style: { width: 8, height: 8, borderRadius: "50%", background: o ? "var(--ok)" : s === "checking" ? "var(--muted-strong)" : "var(--warn)", display: "inline-block" } }),
      /* @__PURE__ */ a("span", { children: [
        "Slack connection: ",
        /* @__PURE__ */ t("span", { style: { color: o ? "var(--text)" : "var(--warn)" }, children: _e[s] || s })
      ] }),
      l && /* @__PURE__ */ a("span", { children: [
        "· last poll ",
        j(n.last_poll_at),
        n.settings.channels.length > 0 && /* @__PURE__ */ a(D, { children: [
          " · watching ",
          n.settings.channels.join(", ")
        ] })
      ] })
    ] }),
    !o && s !== "needs_login" && /* @__PURE__ */ t(me, { mcp: e, sourceError: n.source_error })
  ] });
}
function We(e) {
  const { state: n, items: l, selected: s, setSelected: o } = e, [i, u] = h(""), [m, f] = h(""), [k, b] = Me(n.crew.slot_key), R = oe(null), _ = n.counts.open_by_priority, C = (d) => {
    const x = new Set(s);
    x.has(d) ? x.delete(d) : x.add(d), o(x);
  }, A = Ne(
    () => n.settings.channels.map((d) => ({ cid: d, ...n.channels[d] || {} })),
    [n]
  ), W = (d) => {
    f(De(d)), b(!0), window.requestAnimationFrame(() => {
      var x;
      return (x = R.current) == null ? void 0 : x.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };
  return /* @__PURE__ */ a("div", { style: { minWidth: 0 }, children: [
    /* @__PURE__ */ a("div", { className: "flex flex-wrap items-start gap-3", children: [
      /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(pe, { mcp: e.mcp, state: n, withPoll: !0 }) }),
      /* @__PURE__ */ t(y, { onClick: e.onPoll, disabled: !!e.busy || !e.configured, children: "Poll now" })
    ] }),
    /* @__PURE__ */ t("div", { ref: R, children: /* @__PURE__ */ t(
      ze,
      {
        state: n,
        events: e.events,
        configured: e.configured,
        busy: e.busy,
        expanded: k,
        setExpanded: b,
        pending: m,
        setPending: f,
        onStart: e.onStart,
        onChanged: e.onChanged
      }
    ) }),
    !e.configured && /* @__PURE__ */ a(P, { className: "mb-4", children: [
      /* @__PURE__ */ t(z, { children: "Finish setup" }),
      /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite." })
    ] }),
    /* @__PURE__ */ t(
      Be,
      {
        needs: e.needs,
        today: n.crew.today,
        handled: e.handled,
        onChanged: e.onChanged,
        onWhy: W
      }
    ),
    /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4", children: [
      /* @__PURE__ */ t(J, { label: "Awaiting triage", value: n.counts.needs_triage, accent: !0 }),
      /* @__PURE__ */ t(J, { label: "Possibly resolved", value: n.counts.possibly_resolved }),
      /* @__PURE__ */ t(J, { label: "Open p0 / p1", value: `${_.p0 || 0} / ${_.p1 || 0}` }),
      /* @__PURE__ */ t(J, { label: "Tracked items", value: n.counts.total })
    ] }),
    /* @__PURE__ */ a(P, { className: "mb-4", children: [
      /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2 mb-3", children: [
        /* @__PURE__ */ t(z, { children: "Ledger" }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-filter", children: "Show" }),
        /* @__PURE__ */ a(
          "select",
          {
            id: "sr-filter",
            className: "text-sm bg-transparent border rounded px-2 py-1",
            value: e.filter,
            onChange: (d) => e.setFilter(d.target.value),
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
          O,
          {
            "aria-label": "GitHub repository to search (owner/name, optional)",
            placeholder: "owner/repo (optional)",
            value: i,
            onChange: (d) => u(d.target.value),
            className: "w-48"
          }
        ),
        /* @__PURE__ */ a(y, { onClick: () => e.onInvestigate(i), disabled: s.size === 0 || !!e.busy, children: [
          "Investigate ",
          s.size || ""
        ] })
      ] }),
      l.length === 0 ? /* @__PURE__ */ t(ke, { icon: /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "📡" }), title: "Nothing here yet", subtitle: "New messages appear after the next poll." }) : /* @__PURE__ */ t("ul", { className: "flex flex-col", children: l.map((d, x) => /* @__PURE__ */ t(Pe, { it: d, first: x === 0, checked: s.has(d.key), onToggle: () => C(d.key) }, d.key)) })
    ] }),
    /* @__PURE__ */ t(Ee, { state: n, busy: e.busy, onDigest: e.onDigest }),
    /* @__PURE__ */ a(P, { children: [
      /* @__PURE__ */ t(z, { children: "Channels" }),
      A.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No channels configured." }) : /* @__PURE__ */ a("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ t("thead", { children: /* @__PURE__ */ a("tr", { className: "text-left text-muted", children: [
          /* @__PURE__ */ t("th", { scope: "col", children: "Channel" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Last polled" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Status" })
        ] }) }),
        /* @__PURE__ */ t("tbody", { children: A.map((d) => /* @__PURE__ */ a("tr", { children: [
          /* @__PURE__ */ t("td", { className: "font-mono", children: d.cid }),
          /* @__PURE__ */ t("td", { children: Z(d.last_polled_at) }),
          /* @__PURE__ */ t("td", { children: d.last_error ? /* @__PURE__ */ t(M, { variant: "err", title: d.last_error, children: "error" }) : /* @__PURE__ */ t(M, { variant: "ok", children: "ok" }) })
        ] }, d.cid)) })
      ] })
    ] })
  ] });
}
const le = {
  decide: "Needs a decision",
  unanswered: "Questions nobody answered",
  clusters: "Reported more than once"
};
function ue(e) {
  return e < 1 ? "under 1 h old" : e < 48 ? `${Math.round(e)} h old` : `${Math.floor(e / 24)} days old`;
}
function De(e) {
  return `Why is "${e.summary.length > 80 ? `${e.summary.slice(0, 79)}…` : e.summary}" ${e.priority || "on my list"}?`;
}
function ge(e) {
  return e ? /* @__PURE__ */ t(M, { variant: e === "p0" || e === "p1" ? "err" : "muted", children: e }) : null;
}
function K({ message: e, onRetry: n }) {
  return /* @__PURE__ */ a(
    "div",
    {
      role: "alert",
      className: "text-sm flex flex-wrap items-center gap-2",
      style: { border: "1px solid var(--danger)", borderRadius: 8, padding: "8px 12px", margin: "8px 0" },
      children: [
        /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200 }, children: e }),
        /* @__PURE__ */ t(y, { onClick: n, children: "Try again" })
      ]
    }
  );
}
function Q({ label: e, actions: n }) {
  const l = oe(null);
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
function Ae({
  e,
  first: n,
  onMark: l,
  onWhy: s,
  onSend: o
}) {
  const [i, u] = h(e.reply_draft || "");
  U(() => u(e.reply_draft || ""), [e.reply_draft]);
  const m = `sr-reply-${e.key.replace(/[^A-Za-z0-9]/g, "-")}`, f = [
    ...e.permalink ? [{ label: "Open in Slack", onClick: () => window.open(e.permalink, "_blank", "noopener,noreferrer") }] : [],
    { label: "Done without sending", onClick: () => l("done") },
    { label: "Why? Ask the lead", onClick: s }
  ];
  return /* @__PURE__ */ t("li", { className: "text-sm", style: { padding: "10px 0", borderTop: n ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ a("div", { className: "flex items-start gap-2", children: [
    /* @__PURE__ */ t("div", { style: { flex: "none", minWidth: 28 }, children: ge(e.priority) }),
    /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
      /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        e.reason,
        " · ",
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        " · ",
        ue(e.age_hours)
      ] }),
      /* @__PURE__ */ t("label", { htmlFor: m, className: "text-xs text-muted", style: { display: "block", marginTop: 6 }, children: "Reply to the thread, sent as you" }),
      /* @__PURE__ */ t(
        "textarea",
        {
          id: m,
          value: i,
          maxLength: 1500,
          rows: 3,
          onChange: (k) => u(k.target.value),
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
      /* @__PURE__ */ t(y, { style: B, disabled: !i.trim(), onClick: () => o(i.trim(), i.trim() !== (e.reply_draft || "").trim()), children: "Send to thread" }),
      /* @__PURE__ */ t(y, { style: B, onClick: () => l("ignored"), children: "Ignore" }),
      /* @__PURE__ */ t(Q, { label: "More actions", actions: f })
    ] })
  ] }) });
}
function Ie({
  e,
  first: n,
  onMark: l,
  onWhy: s,
  onDispatch: o,
  busy: i
}) {
  const u = !!e.handoff_title && !!o, m = e.dispatch;
  return /* @__PURE__ */ t("li", { className: "text-sm", style: { padding: "10px 0", borderTop: n ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ a("div", { className: "flex items-start gap-2", children: [
    /* @__PURE__ */ t("div", { style: { flex: "none", minWidth: 28 }, children: ge(e.priority) }),
    /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
      u && !m && /* @__PURE__ */ a("div", { className: "text-xs", style: { marginTop: 2 }, children: [
        "Fix: ",
        e.handoff_title
      ] }),
      m && /* @__PURE__ */ a("div", { className: "text-xs", style: { marginTop: 2 }, "data-testid": "fix-in-progress", children: [
        /* @__PURE__ */ t(ne, { d: m }),
        " · ",
        ye[m.state] || m.state,
        m.pr_url && /* @__PURE__ */ a(D, { children: [
          " · ",
          /* @__PURE__ */ a("a", { className: "underline", href: m.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
            "PR #",
            m.pr_number
          ] })
        ] })
      ] }),
      /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        e.reason,
        e.words && e.words.length > 0 && /* @__PURE__ */ a(D, { children: [
          " (",
          e.words.join(", "),
          ")"
        ] }),
        " · ",
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        " · ",
        ue(e.age_hours),
        e.permalink && /* @__PURE__ */ a(D, { children: [
          " · ",
          /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open in Slack" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ t("div", { className: "flex items-center gap-1", style: { flex: "none" }, children: m ? /* @__PURE__ */ a(D, { children: [
      /* @__PURE__ */ t(y, { style: B, onClick: () => l("ignored"), children: "Ignore" }),
      /* @__PURE__ */ t(
        Q,
        {
          label: "More actions",
          actions: [
            { label: "Done", onClick: () => l("done") },
            { label: "Why? Ask the lead", onClick: s }
          ]
        }
      )
    ] }) : u ? /* @__PURE__ */ a(D, { children: [
      /* @__PURE__ */ t(y, { style: B, onClick: o, disabled: i, children: i ? "Dispatching…" : "Dispatch fix" }),
      /* @__PURE__ */ t(y, { style: B, onClick: () => l("ignored"), children: "Ignore" }),
      /* @__PURE__ */ t(
        Q,
        {
          label: "More actions",
          actions: [
            { label: "Done", onClick: () => l("done") },
            { label: "Why? Ask the lead", onClick: s }
          ]
        }
      )
    ] }) : /* @__PURE__ */ a(D, { children: [
      /* @__PURE__ */ t(y, { style: B, onClick: () => l("done"), children: "Done" }),
      /* @__PURE__ */ t(y, { style: B, onClick: () => l("ignored"), children: "Ignore" }),
      /* @__PURE__ */ t(Q, { label: "More actions", actions: [{ label: "Why? Ask the lead", onClick: s }] })
    ] }) })
  ] }) });
}
const xe = typeof ae.useChatLauncher == "function" ? ae.useChatLauncher : () => null, ye = { running: "working", idle: "waiting", closed: "session closed", unknown: "" };
function ne({ d: e }) {
  const n = xe(), l = `/chat?sid=${encodeURIComponent(e.session_key)}`;
  return /* @__PURE__ */ t(
    "a",
    {
      className: "underline",
      href: l,
      onClick: (s) => {
        n && (s.preventDefault(), n.openChat({ slotKey: e.session_key }));
      },
      children: e.title || "Fix session"
    }
  );
}
function Le(e) {
  try {
    return JSON.parse(String(e.body || "{}"));
  } catch {
    return {};
  }
}
function Fe(e) {
  const n = G(), l = xe(), [s, o] = h(""), [i, u] = h(null), [m, f] = h(null), [k, b] = h(null), [R, _] = h(!1), C = async (d) => {
    if (!s) {
      o(d), f(null);
      try {
        const x = await n.post(`${w}/items/handoff/dispatch`, { key: d });
        x.mode === "server" ? u({ session_key: x.session_key, title: x.title }) : l ? l.openChat({ agent: x.agent, message: x.seed, autoSend: !0 }) : (_(!1), b({ title: x.title, seed: x.seed })), e();
      } catch (x) {
        const v = Le(x);
        v.code === "already_dispatched" && v.session_key ? u({ session_key: v.session_key, title: v.title || "", again: !0 }) : f({ key: d, why: v.error || "the gateway refused it" });
      } finally {
        o("");
      }
    }
  }, A = async () => {
    if (k)
      try {
        await navigator.clipboard.writeText(k.seed), _(!0);
      } catch {
        _(!1);
      }
  }, W = /* @__PURE__ */ a(D, { children: [
    m && /* @__PURE__ */ t(K, { message: `Could not dispatch that fix: ${m.why}. Nothing was sent.`, onRetry: () => C(m.key) }),
    i && /* @__PURE__ */ a(
      "div",
      {
        role: "status",
        "data-testid": "dispatch-toast",
        className: "text-sm flex items-center gap-2",
        style: { position: "fixed", right: 16, bottom: 16, zIndex: 40, background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "8px 12px", maxWidth: 480 },
        children: [
          /* @__PURE__ */ a("span", { style: { flex: 1, minWidth: 0 }, children: [
            i.again ? "Already dispatched: " : "Fix dispatched to a conductor: ",
            /* @__PURE__ */ t(ne, { d: i })
          ] }),
          /* @__PURE__ */ t(y, { style: B, onClick: () => u(null), children: "Close" })
        ]
      }
    ),
    k && /* @__PURE__ */ t(
      "div",
      {
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "sr-fix-title",
        style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" },
        onKeyDown: (d) => d.key === "Escape" && b(null),
        children: /* @__PURE__ */ a("div", { style: { width: "min(720px, 92vw)", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: 16 }, children: [
          /* @__PURE__ */ t("h3", { id: "sr-fix-title", className: "text-sm", style: { margin: "0 0 6px", fontWeight: 600 }, children: k.title }),
          /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 8px" }, children: "This Kiro Crew cannot open the session for you. Copy this task into a new kirocrew-conductor chat." }),
          /* @__PURE__ */ t(
            "textarea",
            {
              readOnly: !0,
              "aria-label": "Fix task",
              value: k.seed,
              style: { width: "100%", height: 260, fontSize: 12, fontFamily: "var(--font-mono, monospace)" }
            }
          ),
          /* @__PURE__ */ a("div", { className: "flex items-center gap-2", style: { marginTop: 8 }, children: [
            /* @__PURE__ */ t(y, { onClick: A, children: R ? "Copied" : "Copy task" }),
            /* @__PURE__ */ t("a", { className: "underline text-sm", href: "/chat?new=1", children: "New chat" }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(y, { onClick: () => b(null), children: "Close" })
          ] })
        ] })
      }
    )
  ] });
  return { dispatch: C, busyKey: s, ui: W };
}
function Be({
  needs: e,
  today: n,
  handled: l,
  onChanged: s,
  onWhy: o
}) {
  const i = G(), u = Fe(s), m = (e == null ? void 0 : e.fixes) || [], [f, k] = h(null), [b, R] = h("");
  U(() => {
    if (!b) return;
    const r = window.setTimeout(() => R(""), 4e3);
    return () => window.clearTimeout(r);
  }, [b]);
  const _ = async (r, c, p, $) => {
    k(null), v((F) => new Set(F).add($));
    try {
      p && await i.post(`${w}/items/reply/draft`, { key: r, text: c }), await i.post(`${w}/items/reply/send`, { key: r }), R("Sent as you"), s();
    } catch (F) {
      v((V) => {
        const T = new Set(V);
        return T.delete($), T;
      }), k({ key: r, text: c, edited: p, why: F.message || "unknown error" });
    }
  }, C = (e == null ? void 0 : e.replied) || [], [A, W] = h(""), d = async (r) => {
    W("");
    try {
      await i.post(`${w}/items/handoff/dismiss`, { key: r }), s();
    } catch {
      W(r);
    }
  }, [x, v] = h(/* @__PURE__ */ new Set()), [S, I] = h(null);
  U(() => v(/* @__PURE__ */ new Set()), [e]);
  const L = async (r, c, p) => {
    I(null), p && v(($) => new Set($).add(p));
    try {
      for (const $ of r) await i.post(`${w}/items/handle`, { key: $, how: c });
      s();
    } catch {
      p && v(($) => {
        const F = new Set($);
        return F.delete(p), F;
      }), I({ keys: r, how: c, rowId: p });
    }
  }, E = ((e == null ? void 0 : e.groups) || []).map((r) => ({
    ...r,
    shown: r.entries.filter((c) => !x.has(`${r.id}:${c.key}`))
  })), g = E.every((r) => r.shown.length === 0), N = (S == null ? void 0 : S.how) === "reopen" ? "reopen" : (S == null ? void 0 : S.how) === "ignored" ? "ignore" : "mark as done";
  return /* @__PURE__ */ a(P, { className: "mb-4", children: [
    /* @__PURE__ */ t(z, { children: "Needs you" }),
    (n == null ? void 0 : n.text) && /* @__PURE__ */ a("p", { className: "text-sm", style: { margin: "0 0 8px" }, "data-testid": "crew-today", children: [
      n.text,
      n.at > 0 && /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
        " · ",
        j(n.at)
      ] })
    ] }),
    b && /* @__PURE__ */ t("p", { role: "status", className: "text-sm", style: { margin: "0 0 8px", color: "var(--success, var(--text))" }, children: b }),
    f && /* @__PURE__ */ t(
      K,
      {
        message: `Could not send that reply: ${f.why}`,
        onRetry: () => _(f.key, f.text, f.edited, `decide:${f.key}`)
      }
    ),
    S && /* @__PURE__ */ t(
      K,
      {
        message: `Could not ${N} that message. Nothing changed.`,
        onRetry: () => L(S.keys, S.how, S.rowId)
      }
    ),
    e ? g ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Nothing needs you right now." }) : E.map(
      (r) => r.shown.length === 0 ? null : /* @__PURE__ */ a("section", { "aria-label": le[r.id], style: { marginTop: 10 }, children: [
        /* @__PURE__ */ a("h4", { className: "text-sm", style: { margin: 0, fontWeight: 600, color: "var(--text-strong)" }, children: [
          le[r.id],
          " ",
          /* @__PURE__ */ a("span", { className: "text-muted", style: { fontWeight: 400 }, children: [
            "(",
            r.total - (r.entries.length - r.shown.length),
            ")"
          ] })
        ] }),
        /* @__PURE__ */ t("ul", { className: "flex flex-col", children: r.shown.map((c, p) => r.id === "decide" && c.reply_draft && !c.handoff_title ? /* @__PURE__ */ t(
          Ae,
          {
            e: c,
            first: p === 0,
            onMark: ($) => L([c.key], $, `${r.id}:${c.key}`),
            onWhy: () => o(c),
            onSend: ($, F) => _(c.key, $, F, `${r.id}:${c.key}`)
          },
          c.key
        ) : /* @__PURE__ */ t(
          Ie,
          {
            e: c,
            first: p === 0,
            onMark: ($) => {
              var F;
              return L((F = c.members) != null && F.length ? c.members : [c.key], $, `${r.id}:${c.key}`);
            },
            onWhy: () => o(c),
            onDispatch: r.id === "decide" && c.handoff_title ? () => u.dispatch(c.key) : void 0,
            busy: u.busyKey === c.key
          },
          c.key
        )) })
      ] }, r.id)
    ) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" }),
    A && /* @__PURE__ */ t(K, { message: "Could not dismiss that hand-off. Nothing changed.", onRetry: () => d(A) }),
    m.length > 0 && /* @__PURE__ */ a("details", { style: { marginTop: 12 }, "data-testid": "fixes-in-flight", children: [
      /* @__PURE__ */ a("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Fixes in flight (",
        (e == null ? void 0 : e.fixes_total) ?? m.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: m.map((r, c) => /* @__PURE__ */ a(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: c === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ a("span", { style: { flex: 1, minWidth: 0 }, children: [
              /* @__PURE__ */ t(ne, { d: r.dispatch }),
              /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
                " · ",
                ye[r.dispatch.state] || r.dispatch.state || "sent",
                " · ",
                /* @__PURE__ */ t("span", { className: "font-mono", children: r.repo }),
                " · ",
                j(r.dispatch.at)
              ] }),
              r.dispatch.pr_url && /* @__PURE__ */ a(D, { children: [
                " · ",
                /* @__PURE__ */ a("a", { className: "underline", href: r.dispatch.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
                  "PR #",
                  r.dispatch.pr_number
                ] })
              ] })
            ] }),
            /* @__PURE__ */ t(y, { style: B, onClick: () => d(r.key), children: "Dismiss" })
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
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: l.map((r, c) => /* @__PURE__ */ a(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: c === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 0 }, children: r.summary || r.text.slice(0, 200) }),
            /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
              r.handled_how === "ignored" ? "Ignored" : "Done",
              " ",
              j(r.handled_at)
            ] }),
            /* @__PURE__ */ t(y, { style: B, onClick: () => L([r.key], "reopen"), children: "Reopen" })
          ]
        },
        r.key
      )) })
    ] }),
    C.length > 0 && /* @__PURE__ */ a("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ a("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Replied (",
        (e == null ? void 0 : e.replied_total) ?? C.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: C.map((r, c) => /* @__PURE__ */ a(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: c === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ a("span", { style: { flex: 1, minWidth: 0 }, children: [
              r.text.length > 120 ? `${r.text.slice(0, 119)}…` : r.text,
              /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
                " · ",
                r.summary,
                " · ",
                /* @__PURE__ */ t("span", { className: "font-mono", children: r.channel }),
                " · ",
                j(r.at)
              ] })
            ] }),
            r.permalink && /* @__PURE__ */ t("a", { className: "underline text-xs", href: r.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open reply" })
          ]
        },
        r.key
      )) })
    ] }),
    u.ui
  ] });
}
function Pe({ it: e, first: n, checked: l, onToggle: s }) {
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
      /* @__PURE__ */ t(M, { variant: Se(e.status), children: e.status }),
      o && /* @__PURE__ */ t(M, { variant: o.variant, children: o.label }),
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
        e.user && /* @__PURE__ */ a(D, { children: [
          " · ",
          e.user
        ] }),
        e.reply_count > 0 && /* @__PURE__ */ a(D, { children: [
          " · ",
          e.reply_count,
          " replies"
        ] }),
        " · ",
        /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "open in Slack" }),
        e.links.length > 0 && /* @__PURE__ */ a(D, { children: [
          " · linked ",
          e.links.map((u) => /* @__PURE__ */ t("a", { className: "underline mr-2", href: u, target: "_blank", rel: "noreferrer noopener", children: u.replace("https://github.com/", "") }, u))
        ] })
      ] }),
      e.note && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: e.note })
    ] })
  ] }) });
}
function Ee({ state: e, busy: n, onDigest: l }) {
  const s = e.digest, o = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), i = s.last_posted_date === o;
  return /* @__PURE__ */ a(P, { className: "mb-4", children: [
    /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ t(z, { children: i ? "Today's digest" : "Latest digest" }),
      s.pending ? /* @__PURE__ */ t(M, { variant: "aim", children: "being delivered" }) : null,
      /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: s.last_posted_date ? `${s.last_posted_date} · ${e.settings.digest_destination === "self_dm" ? "DMed to you" : "dashboard notification"}` : "none yet" }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      /* @__PURE__ */ t(y, { onClick: l, disabled: !!n || !e.crew.live, children: "Request digest" })
    ] }),
    s.last_text ? /* @__PURE__ */ t("pre", { className: "whitespace-pre-wrap text-sm mt-2", style: { fontFamily: "inherit", margin: "8px 0 0" }, children: s.last_text }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted mt-2", children: "The Radar Lead writes one after the daily cron or when you press Request digest." }),
    s.last_error && /* @__PURE__ */ t("p", { className: "text-xs mt-1", style: { color: "var(--danger)" }, children: s.last_error })
  ] });
}
function Oe({ state: e }) {
  return /* @__PURE__ */ t("div", { className: "flex items-center gap-2", style: { marginTop: 10 }, children: ee.map((n) => /* @__PURE__ */ a("span", { title: `${n.title} · ${H(n, e).label}`, children: [
    /* @__PURE__ */ t(te, { m: n, s: e, selected: n.id === "lead", size: 30 }),
    /* @__PURE__ */ t("span", { className: "sr-only", children: `${n.title}: ${H(n, e).label}` })
  ] }, n.id)) });
}
function Me(e) {
  const n = `slack-radar:chat-open:${e}`, l = () => {
    try {
      return window.localStorage.getItem(n) === "1";
    } catch {
      return !1;
    }
  }, [s, o] = h(l);
  U(() => o(l()), [n]);
  const i = X(
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
function re({ q: e, onClick: n, disabled: l }) {
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
function ze(e) {
  const n = G(), { state: l, expanded: s, pending: o } = e, i = ee[0], u = l.crew.slot_key, m = l.crew.live && l.crew.session_open && l.crew.session_agent === l.crew.agent, [f, k] = h(""), [b, R] = h(!1), [_, C] = h(""), [A, W] = h(!1), d = H(i, l), x = async (g) => {
    await n.post(`${w}/crew/message`, { message: g }), e.onChanged();
  }, v = async (g) => {
    const N = g.trim();
    if (N) {
      R(!0), C("");
      try {
        await n.post(`${w}/crew/message`, { message: N }), k(""), N === o && e.setPending(""), e.setExpanded(!0), e.onChanged();
      } catch {
        C(N);
      } finally {
        R(!1);
      }
    }
  }, S = async () => {
    try {
      await navigator.clipboard.writeText(o), W(!0), window.setTimeout(() => W(!1), 1500);
    } catch {
      W(!1);
    }
  }, I = _ && /* @__PURE__ */ t(K, { message: "The Radar Lead did not get that message.", onRetry: () => v(_) }), L = /* @__PURE__ */ t("div", { className: "text-sm", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }, children: l.crew.live ? /* @__PURE__ */ a(D, { children: [
    /* @__PURE__ */ t("span", { children: "The Radar Lead session opens on its next turn. Open it now to talk here." }),
    /* @__PURE__ */ t(y, { primary: !0, onClick: e.onStart, disabled: !!e.busy || !e.configured, children: "Open the session" })
  ] }) : /* @__PURE__ */ a("span", { children: [
    "The Radar Lead is paused. Turn on ",
    /* @__PURE__ */ t("b", { children: "Crew" }),
    " at the top of the page to triage your channels and talk to it here."
  ] }) });
  if (!s)
    return /* @__PURE__ */ a(P, { className: "mb-4", style: { padding: "10px 14px" }, children: [
      /* @__PURE__ */ a(
        "form",
        {
          className: "flex flex-wrap items-center gap-2",
          onSubmit: (g) => {
            g.preventDefault(), v(f);
          },
          children: [
            /* @__PURE__ */ t(te, { m: i, s: l, size: 26 }),
            /* @__PURE__ */ t(
              O,
              {
                "aria-label": "Ask the lead",
                placeholder: "Ask the lead…",
                value: f,
                onChange: (g) => k(g.target.value),
                disabled: !m || b,
                style: { flex: 1, minWidth: 200 }
              }
            ),
            /* @__PURE__ */ t(y, { primary: !0, type: "submit", disabled: !m || b || !f.trim(), children: "Send" }),
            se.map((g) => /* @__PURE__ */ t(re, { q: g, onClick: () => v(g), disabled: !m || b }, g))
          ]
        }
      ),
      !m && /* @__PURE__ */ t("div", { style: { marginTop: 8 }, children: L }),
      I
    ] });
  const E = e.events.filter((g) => g.kind === "crew" || g.kind === "digest").slice(0, 5);
  return /* @__PURE__ */ a(
    P,
    {
      className: "mb-4",
      style: { padding: 0, display: "flex", flexDirection: "column", height: "min(620px, calc(100vh - 180px))", overflow: "hidden" },
      children: [
        /* @__PURE__ */ a("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border)" }, children: [
          /* @__PURE__ */ a("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: l.crew.name || i.title }),
            /* @__PURE__ */ t(M, { variant: d.tone === "muted" ? "muted" : d.tone === "aim" ? "aim" : "ok", children: d.label }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(y, { onClick: () => e.setExpanded(!1), "aria-expanded": !0, children: "Collapse" })
          ] }),
          /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
            "phase ",
            l.crew_memory.phase,
            " · next: ",
            l.crew_memory.next || "—"
          ] }),
          /* @__PURE__ */ t(Oe, { state: l })
        ] }),
        o && // ChatEmbed has no API to fill its composer, so the question waits here.
        /* @__PURE__ */ a(
          "div",
          {
            className: "text-sm flex flex-wrap items-center gap-2",
            style: { padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" },
            children: [
              /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200, userSelect: "all" }, children: o }),
              /* @__PURE__ */ t(y, { primary: !0, style: B, onClick: () => v(o), disabled: !m || b, children: "Send" }),
              /* @__PURE__ */ t(y, { style: B, onClick: S, children: A ? "Copied" : "Copy" })
            ]
          }
        ),
        I && /* @__PURE__ */ t("div", { style: { padding: "0 16px" }, children: I }),
        /* @__PURE__ */ t("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: m ? /* @__PURE__ */ t(
          be,
          {
            slotKey: u,
            agent: l.crew.agent,
            frameless: !0,
            startAtBottom: !0,
            placeholder: "Ask the Radar Lead…",
            onSend: x
          },
          u
        ) : /* @__PURE__ */ a("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 10 }, children: [
          L,
          !e.configured && /* @__PURE__ */ t("p", { className: "text-xs text-muted", children: "Add a channel in Settings first." }),
          E.length > 0 && /* @__PURE__ */ t("ul", { className: "text-xs text-muted flex flex-col gap-1", style: { marginTop: 6 }, children: E.map((g, N) => /* @__PURE__ */ a("li", { children: [
            j(g.at),
            " · ",
            g.text
          ] }, `${g.at}-${N}`)) })
        ] }) }),
        /* @__PURE__ */ t("div", { className: "flex flex-wrap gap-2", style: { padding: "10px 16px 12px", borderTop: "1px solid var(--border)" }, children: se.map((g) => /* @__PURE__ */ t(re, { q: g, onClick: () => v(g), disabled: !m || b }, g)) })
      ]
    }
  );
}
function je({ state: e }) {
  return /* @__PURE__ */ a(P, { children: [
    /* @__PURE__ */ t(z, { children: "Team" }),
    /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { marginBottom: 8 }, children: "Who works on your channels. Only the Radar Lead has a session; the others run when needed." }),
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: ee.map((n) => {
      var o, i;
      const l = H(n, e), s = n.id === "lead" ? e.crew.agent : n.agent;
      return /* @__PURE__ */ a(
        "li",
        {
          className: "flex items-start gap-3",
          style: { padding: "12px 4px", borderTop: "1px solid var(--border)", opacity: n.planned ? 0.7 : 1 },
          children: [
            /* @__PURE__ */ t(te, { m: n, s: e, size: 36 }),
            /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
              /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2", children: [
                /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: n.id === "lead" && e.crew.name || n.title }),
                /* @__PURE__ */ t(M, { variant: "muted", children: n.layer }),
                /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: n.kind })
              ] }),
              /* @__PURE__ */ t("p", { className: "text-sm", style: { margin: "4px 0 0" }, children: n.duty }),
              n.id === "investigator" && (((o = e.investigations) == null ? void 0 : o.items) || 0) > 0 && /* @__PURE__ */ a("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: [
                (i = e.investigations) == null ? void 0 : i.items,
                " item(s) under investigation"
              ] }),
              s && /* @__PURE__ */ t(ce, { children: /* @__PURE__ */ a("span", { className: "font-mono", children: [
                "agent: ",
                s,
                n.id === "lead" && e.crew.slot_key ? ` · session: ${e.crew.slot_key}` : ""
              ] }) })
            ] }),
            /* @__PURE__ */ t("span", { className: "text-xs", style: { color: he[l.tone], whiteSpace: "nowrap" }, children: l.label })
          ]
        },
        n.id
      );
    }) })
  ] });
}
function Ue({ events: e }) {
  return /* @__PURE__ */ a(P, { children: [
    /* @__PURE__ */ t(z, { children: "Activity" }),
    e.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No activity yet." }) : /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", children: e.map((n, l) => /* @__PURE__ */ a("li", { children: [
      /* @__PURE__ */ t("span", { className: "text-muted", children: Z(n.at) }),
      " ",
      /* @__PURE__ */ t(M, { variant: "muted", children: n.kind }),
      " ",
      n.text
    ] }, `${n.at}-${l}`)) })
  ] });
}
function Ke({
  state: e,
  busy: n,
  act: l,
  mcp: s,
  onProbe: o
}) {
  const i = G(), [u, m] = h(e.settings.channels.join(`
`)), [f, k] = h(e.settings.digest_destination), [b, R] = h(e.settings.slack_login), [_, C] = h(e.settings.slack_mcp_command), [A, W] = h(e.settings.workspace_url), [d, x] = h(String(e.settings.poll_interval_secs)), [v, S] = h(String(e.settings.backfill_hours)), [I, L] = h(e.crew.unattended), [E, g] = h(e.crew.agent), [N, r] = h(e.crew.model), c = () => l(
    "Save settings",
    () => i.put(`${w}/settings`, {
      channels: u.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean),
      digest_destination: f,
      slack_login: b.trim(),
      slack_mcp_command: _.trim(),
      workspace_url: A.trim(),
      poll_interval_secs: Number(d),
      backfill_hours: Number(v)
    })
  );
  return /* @__PURE__ */ a(D, { children: [
    !e.vault_available && /* @__PURE__ */ t(P, { className: "mb-4", children: /* @__PURE__ */ t("p", { className: "text-sm", children: "The gateway secret vault is unavailable, so settings cannot be saved." }) }),
    /* @__PURE__ */ a(P, { className: "mb-4", children: [
      /* @__PURE__ */ t(z, { children: "Basics" }),
      /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(pe, { mcp: s, state: e }) }),
        /* @__PURE__ */ t(y, { disabled: !!n, onClick: o, children: "Check connection" })
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
          onChange: (p) => m(p.target.value)
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
              onChange: (p) => k(p.target.value),
              children: [
                /* @__PURE__ */ t("option", { value: "dashboard", children: "Dashboard notification only" }),
                /* @__PURE__ */ t("option", { value: "self_dm", children: "DM to myself in Slack" })
              ]
            }
          )
        ] }),
        f === "self_dm" && /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Your Slack login (for the DM)",
          /* @__PURE__ */ t(O, { value: b, onChange: (p) => R(p.target.value), placeholder: "jdoe" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Poll interval (seconds, 60–3600)",
          /* @__PURE__ */ t(O, { type: "number", min: 60, max: 3600, value: d, onChange: (p) => x(p.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(y, { primary: !0, className: "mt-3", disabled: !!n, onClick: c, children: "Save settings" })
    ] }),
    /* @__PURE__ */ t(P, { children: /* @__PURE__ */ a("details", { children: [
      /* @__PURE__ */ t("summary", { style: { cursor: "pointer", fontWeight: 600, color: "var(--text-strong)" }, children: "Advanced" }),
      /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "MCP server command (a single executable on PATH)",
          /* @__PURE__ */ t(O, { value: _, onChange: (p) => C(p.target.value), placeholder: "ai-community-slack-mcp" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Workspace URL (for permalinks, optional)",
          /* @__PURE__ */ t(O, { value: A, onChange: (p) => W(p.target.value), placeholder: "https://yourteam.slack.com" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "First-poll backfill (hours, 0–168)",
          /* @__PURE__ */ t(O, { type: "number", min: 0, max: 168, value: v, onChange: (p) => S(p.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(y, { className: "mt-3", disabled: !!n, onClick: c, children: "Save settings" }),
      /* @__PURE__ */ a("div", { style: { borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }, children: [
        /* @__PURE__ */ t("div", { className: "text-sm", style: { fontWeight: 600, marginBottom: 8 }, children: "Crew" }),
        /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
          /* @__PURE__ */ a("label", { className: "text-sm", children: [
            "Agent",
            /* @__PURE__ */ t(O, { value: E, onChange: (p) => g(p.target.value), placeholder: "slack-radar-crew" }),
            /* @__PURE__ */ t("span", { className: "block text-xs text-muted mt-1", children: "Default: the shipped slack-radar-crew agent. Your own agents are never modified." })
          ] }),
          /* @__PURE__ */ a("label", { className: "text-sm", children: [
            "Model (empty = agent default)",
            /* @__PURE__ */ t(O, { value: N, onChange: (p) => r(p.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ a("div", { className: "mt-3 flex items-center gap-2", children: [
          /* @__PURE__ */ t(
            ie,
            {
              checked: I,
              onChange: L,
              label: "Unattended mode (auto-approve investigator commands)",
              describedBy: "sr-unattended-risk"
            }
          ),
          /* @__PURE__ */ t("span", { className: "text-sm", children: "Unattended mode (auto-approve investigator commands)" })
        ] }),
        /* @__PURE__ */ t("p", { id: "sr-unattended-risk", className: "text-xs text-muted mt-1", children: "Risk: anyone in a watched channel can write text the crew reads, so a crafted message could steer a command nobody reviews." }),
        /* @__PURE__ */ t(
          y,
          {
            primary: !0,
            className: "mt-3",
            disabled: !!n,
            onClick: () => l("Save crew", () => i.put(`${w}/crew`, { agent: E, model: N, unattended: I })),
            children: "Save crew"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  Ve as default
};
