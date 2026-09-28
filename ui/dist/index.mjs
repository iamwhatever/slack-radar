import { jsxs as a, Fragment as B, jsx as t } from "react/jsx-runtime";
import * as ne from "@kirocrew/app-sdk";
import { useAppApi as Y, ChatEmbed as ye } from "@kirocrew/app-sdk";
import { PageHeader as fe, Toggle as re, Btn as g, Card as I, CardTitle as z, StatCard as J, Input as M, EmptyState as ve, Badge as E } from "@kirocrew/app-sdk/ui";
import { useState as c, useCallback as q, useEffect as K, useRef as ie, useMemo as be } from "react";
const w = "/api/apps/slack-radar", we = {
  checking: "checking…",
  connected: "connected",
  needs_login: "sign in again",
  binary_not_found: "not installed",
  incompatible: "missing read access",
  error: "not working"
}, ae = ["What needs me today?", "Draft today's digest", "Which threads look resolved?"], ke = [
  { id: "board", label: "Board" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" }
], X = (e) => e ? new Date(e * 1e3).toLocaleString() : "never";
function U(e) {
  if (!e) return "never";
  const n = Math.max(0, Date.now() / 1e3 - e);
  return n < 90 ? "just now" : n < 3600 ? `${Math.round(n / 60)} min ago` : n < 86400 ? `${Math.round(n / 3600)} h ago` : X(e);
}
function oe(e, n) {
  return n === "needs_login" ? "needs_login" : (e == null ? void 0 : e.status) || "checking";
}
function de({ children: e, summary: n = "Details" }) {
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
function Q(e, n) {
  var r;
  if (e.id === "lead")
    return n.crew.live ? n.crew.running ? { label: "working", tone: "aim" } : { label: "live", tone: "ok" } : { label: "paused", tone: "muted" };
  if (e.id === "investigator") {
    const s = ((r = n.investigations) == null ? void 0 : r.running) || 0;
    return s ? { label: `${s} running`, tone: "aim" } : { label: "standing by", tone: "muted" };
  }
  return e.id === "watcher" ? { label: "standing by", tone: "muted" } : n.source_state === "needs_login" ? { label: "sign in again", tone: "warn" } : { label: `polled ${U(n.last_poll_at)}`, tone: "muted" };
}
const ce = {
  ok: "var(--ok)",
  aim: "var(--aim)",
  warn: "var(--warn)",
  muted: "var(--muted-strong)"
};
function te({ m: e, s: n, selected: r, size: s = 32 }) {
  const o = Q(e, n), i = e.planned || e.id === "poller", p = {
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
    border: `2px ${i ? "dashed" : "solid"} ${r ? "var(--accent)" : i ? "var(--border-strong)" : "transparent"}`,
    opacity: e.planned ? 0.6 : 1
  };
  return /* @__PURE__ */ a("span", { style: p, "aria-hidden": !0, children: [
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
          background: ce[o.tone]
        }
      }
    )
  ] });
}
function Ne(e) {
  return e === "new" ? "warn" : e === "investigating" ? "aim" : e === "resolved" ? "ok" : "muted";
}
function Se({ tab: e, setTab: n }) {
  return /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Slack Radar sections", style: { display: "flex", gap: 4 }, children: ke.map((r) => {
    const s = e === r.id;
    return /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": s,
        onClick: () => n(r.id),
        style: {
          padding: "6px 12px",
          borderRadius: 8,
          border: 0,
          cursor: "pointer",
          fontSize: 14,
          background: s ? "var(--bg-hover)" : "transparent",
          color: s ? "var(--text-strong)" : "var(--muted)"
        },
        children: r.label
      },
      r.id
    );
  }) });
}
function Ce({
  state: e,
  configured: n,
  busy: r,
  onStart: s,
  onPause: o
}) {
  const i = e.crew.live;
  return /* @__PURE__ */ a("div", { className: "flex items-center gap-2", title: !i && !n ? "Add a channel in Settings first" : void 0, children: [
    /* @__PURE__ */ t("span", { className: "text-sm", children: "Crew" }),
    /* @__PURE__ */ t(
      re,
      {
        checked: i,
        disabled: !!r || !i && !n,
        onChange: (y) => y ? s() : o(),
        label: i ? "Pause the crew" : "Start the crew"
      }
    ),
    /* @__PURE__ */ a("span", { className: "text-xs text-muted", title: "Whether the crew's commands run without asking you", children: [
      "Unattended: ",
      e.crew.trusted ? "on" : "off"
    ] })
  ] });
}
function Ge() {
  const e = Y(), [n, r] = c("board"), [s, o] = c(null), [i, p] = c([]), [y, x] = c(null), [_, v] = c([]), [R, C] = c([]), [W, A] = c("open"), [$, d] = c(/* @__PURE__ */ new Set()), [f, T] = c(""), [O, N] = c(""), [b, L] = c(null), h = q(async () => {
    try {
      L(await e.get(`${w}/mcp/status`));
    } catch (u) {
      L({ status: "error", command: "", detail: u.message });
    }
  }, [e]);
  K(() => {
    h();
  }, [h]);
  const k = q(async () => {
    try {
      const [u, G, H, ge, xe] = await Promise.all([
        e.get(`${w}/state`),
        e.get(`${w}/items?status=${encodeURIComponent(W)}&limit=300`),
        e.get(`${w}/events?limit=150`),
        e.get(`${w}/needs`),
        e.get(`${w}/items?handled=1&limit=100`)
      ]);
      o(u), p(G.items), x(ge), v(xe.items), C(H.events.slice().reverse());
    } catch (u) {
      N(`Could not load: ${u.message}`);
    }
  }, [e, W]);
  K(() => {
    k();
    const u = window.setInterval(k, 3e4);
    return () => window.clearInterval(u);
  }, [k]);
  const F = async (u, G) => {
    T(u), N("");
    try {
      await G(), N(`${u}: done`), await k();
    } catch (H) {
      N(`${u} failed: ${H.message}`);
    } finally {
      T("");
    }
  }, j = !!s && s.settings.channels.length > 0, l = (s == null ? void 0 : s.settings.channels.length) || 0, m = s ? `${l ? `Watching ${l} channel${l === 1 ? "" : "s"}` : "No channels yet"} · ${s.crew.live ? "running" : "paused"}` : "A small crew triaging your Slack channels", D = s ? oe(b, s.source_state) : "checking", S = () => {
    h(), k();
  };
  return /* @__PURE__ */ a(B, { children: [
    /* @__PURE__ */ t(
      fe,
      {
        title: "Slack Radar",
        subtitle: m,
        actions: /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-4", children: [
          /* @__PURE__ */ t(Se, { tab: n, setTab: r }),
          s && /* @__PURE__ */ t(
            Ce,
            {
              state: s,
              configured: j,
              busy: f,
              onStart: () => F("Start crew", () => e.post(`${w}/crew/start`, {})),
              onPause: () => F("Pause crew", () => e.post(`${w}/crew/pause`, {}))
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ a("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      s && D === "needs_login" && /* @__PURE__ */ t(_e, { mcp: b, sourceError: s.source_error, busy: f, onCheck: S }),
      O && /* @__PURE__ */ t("p", { role: "status", className: "text-sm text-muted mb-3", children: O }),
      s ? n === "board" ? /* @__PURE__ */ t(
        $e,
        {
          state: s,
          items: i,
          needs: y,
          handled: _,
          configured: j,
          mcp: b,
          filter: W,
          setFilter: A,
          selected: $,
          setSelected: d,
          busy: f,
          onPoll: () => F("Poll", () => e.post(`${w}/poll`, {})),
          onInvestigate: (u) => F("Investigate", async () => {
            await e.post(`${w}/investigate`, { keys: [...$], repo: u }), d(/* @__PURE__ */ new Set());
          }),
          onStart: () => F("Start crew", () => e.post(`${w}/crew/start`, {})),
          onDigest: () => F("Request digest", () => e.post(`${w}/digest/request`, {})),
          events: R,
          onChanged: k
        }
      ) : n === "team" ? /* @__PURE__ */ t(Ee, { state: s }) : n === "activity" ? /* @__PURE__ */ t(Oe, { events: R }) : /* @__PURE__ */ t(ze, { state: s, busy: f, act: F, mcp: b, onProbe: h }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" })
    ] })
  ] });
}
function he({ mcp: e, sourceError: n }) {
  var s;
  const r = [
    (e == null ? void 0 : e.status) && `status: ${e.status}`,
    (e == null ? void 0 : e.command) && `command: ${e.command}`,
    n && `error: ${n}`,
    (e == null ? void 0 : e.detail) && e.detail !== n && `detail: ${e.detail}`,
    ((s = e == null ? void 0 : e.missing_read_tools) == null ? void 0 : s.length) && `missing read tools: ${e.missing_read_tools.join(", ")}`
  ].filter(Boolean);
  return r.length ? /* @__PURE__ */ t(de, { children: /* @__PURE__ */ t("pre", { className: "font-mono whitespace-pre-wrap", style: { margin: 0 }, children: r.join(`
`) }) }) : null;
}
function _e({ mcp: e, sourceError: n, busy: r, onCheck: s }) {
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
          /* @__PURE__ */ t(g, { primary: !0, onClick: s, disabled: !!r, children: "I signed in, check again" })
        ] }),
        /* @__PURE__ */ t(he, { mcp: e, sourceError: n })
      ]
    }
  );
}
function me({ mcp: e, state: n, withPoll: r }) {
  const s = oe(e, n.source_state), o = s === "connected";
  return /* @__PURE__ */ a("div", { className: "mb-4", children: [
    /* @__PURE__ */ a("p", { role: "status", className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { margin: 0 }, children: [
      /* @__PURE__ */ t("span", { "aria-hidden": !0, style: { width: 8, height: 8, borderRadius: "50%", background: o ? "var(--ok)" : s === "checking" ? "var(--muted-strong)" : "var(--warn)", display: "inline-block" } }),
      /* @__PURE__ */ a("span", { children: [
        "Slack connection: ",
        /* @__PURE__ */ t("span", { style: { color: o ? "var(--text)" : "var(--warn)" }, children: we[s] || s })
      ] }),
      r && /* @__PURE__ */ a("span", { children: [
        "· last poll ",
        U(n.last_poll_at),
        n.settings.channels.length > 0 && /* @__PURE__ */ a(B, { children: [
          " · watching ",
          n.settings.channels.join(", ")
        ] })
      ] })
    ] }),
    !o && s !== "needs_login" && /* @__PURE__ */ t(he, { mcp: e, sourceError: n.source_error })
  ] });
}
function $e(e) {
  const { state: n, items: r, selected: s, setSelected: o } = e, [i, p] = c(""), [y, x] = c(""), [_, v] = Pe(n.crew.slot_key), R = ie(null), C = n.counts.open_by_priority, W = (d) => {
    const f = new Set(s);
    f.has(d) ? f.delete(d) : f.add(d), o(f);
  }, A = be(
    () => n.settings.channels.map((d) => ({ cid: d, ...n.channels[d] || {} })),
    [n]
  ), $ = (d) => {
    x(Te(d)), v(!0), window.requestAnimationFrame(() => {
      var f;
      return (f = R.current) == null ? void 0 : f.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };
  return /* @__PURE__ */ a("div", { style: { minWidth: 0 }, children: [
    /* @__PURE__ */ a("div", { className: "flex flex-wrap items-start gap-3", children: [
      /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(me, { mcp: e.mcp, state: n, withPoll: !0 }) }),
      /* @__PURE__ */ t(g, { onClick: e.onPoll, disabled: !!e.busy || !e.configured, children: "Poll now" })
    ] }),
    /* @__PURE__ */ t("div", { ref: R, children: /* @__PURE__ */ t(
      Me,
      {
        state: n,
        events: e.events,
        configured: e.configured,
        busy: e.busy,
        expanded: _,
        setExpanded: v,
        pending: y,
        setPending: x,
        onStart: e.onStart,
        onChanged: e.onChanged
      }
    ) }),
    !e.configured && /* @__PURE__ */ a(I, { className: "mb-4", children: [
      /* @__PURE__ */ t(z, { children: "Finish setup" }),
      /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite." })
    ] }),
    /* @__PURE__ */ t(
      Ie,
      {
        needs: e.needs,
        today: n.crew.today,
        handled: e.handled,
        onChanged: e.onChanged,
        onWhy: $
      }
    ),
    /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4", children: [
      /* @__PURE__ */ t(J, { label: "Awaiting triage", value: n.counts.needs_triage, accent: !0 }),
      /* @__PURE__ */ t(J, { label: "Possibly resolved", value: n.counts.possibly_resolved }),
      /* @__PURE__ */ t(J, { label: "Open p0 / p1", value: `${C.p0 || 0} / ${C.p1 || 0}` }),
      /* @__PURE__ */ t(J, { label: "Tracked items", value: n.counts.total })
    ] }),
    /* @__PURE__ */ a(I, { className: "mb-4", children: [
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
          M,
          {
            "aria-label": "GitHub repository to search (owner/name, optional)",
            placeholder: "owner/repo (optional)",
            value: i,
            onChange: (d) => p(d.target.value),
            className: "w-48"
          }
        ),
        /* @__PURE__ */ a(g, { onClick: () => e.onInvestigate(i), disabled: s.size === 0 || !!e.busy, children: [
          "Investigate ",
          s.size || ""
        ] })
      ] }),
      r.length === 0 ? /* @__PURE__ */ t(ve, { icon: /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "📡" }), title: "Nothing here yet", subtitle: "New messages appear after the next poll." }) : /* @__PURE__ */ t("ul", { className: "flex flex-col", children: r.map((d, f) => /* @__PURE__ */ t(Le, { it: d, first: f === 0, checked: s.has(d.key), onToggle: () => W(d.key) }, d.key)) })
    ] }),
    /* @__PURE__ */ t(Fe, { state: n, busy: e.busy, onDigest: e.onDigest }),
    /* @__PURE__ */ a(I, { children: [
      /* @__PURE__ */ t(z, { children: "Channels" }),
      A.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No channels configured." }) : /* @__PURE__ */ a("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ t("thead", { children: /* @__PURE__ */ a("tr", { className: "text-left text-muted", children: [
          /* @__PURE__ */ t("th", { scope: "col", children: "Channel" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Last polled" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Status" })
        ] }) }),
        /* @__PURE__ */ t("tbody", { children: A.map((d) => /* @__PURE__ */ a("tr", { children: [
          /* @__PURE__ */ t("td", { className: "font-mono", children: d.cid }),
          /* @__PURE__ */ t("td", { children: X(d.last_polled_at) }),
          /* @__PURE__ */ t("td", { children: d.last_error ? /* @__PURE__ */ t(E, { variant: "err", title: d.last_error, children: "error" }) : /* @__PURE__ */ t(E, { variant: "ok", children: "ok" }) })
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
function pe(e) {
  return e < 1 ? "under 1 h old" : e < 48 ? `${Math.round(e)} h old` : `${Math.floor(e / 24)} days old`;
}
function Te(e) {
  return `Why is "${e.summary.length > 80 ? `${e.summary.slice(0, 79)}…` : e.summary}" ${e.priority || "on my list"}?`;
}
function ue(e) {
  return e ? /* @__PURE__ */ t(E, { variant: e === "p0" || e === "p1" ? "err" : "muted", children: e }) : null;
}
function V({ message: e, onRetry: n }) {
  return /* @__PURE__ */ a(
    "div",
    {
      role: "alert",
      className: "text-sm flex flex-wrap items-center gap-2",
      style: { border: "1px solid var(--danger)", borderRadius: 8, padding: "8px 12px", margin: "8px 0" },
      children: [
        /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200 }, children: e }),
        /* @__PURE__ */ t(g, { onClick: n, children: "Try again" })
      ]
    }
  );
}
function Z({ label: e, actions: n }) {
  const r = ie(null);
  return /* @__PURE__ */ a("details", { ref: r, style: { position: "relative" }, children: [
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
              r.current && (r.current.open = !1), s.onClick();
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
const P = { fontSize: 12, padding: "2px 10px" };
function Re({
  e,
  first: n,
  onMark: r,
  onWhy: s,
  onSend: o
}) {
  const [i, p] = c(e.reply_draft || "");
  K(() => p(e.reply_draft || ""), [e.reply_draft]);
  const y = `sr-reply-${e.key.replace(/[^A-Za-z0-9]/g, "-")}`, x = [
    ...e.permalink ? [{ label: "Open in Slack", onClick: () => window.open(e.permalink, "_blank", "noopener,noreferrer") }] : [],
    { label: "Done without sending", onClick: () => r("done") },
    { label: "Why? Ask the lead", onClick: s }
  ];
  return /* @__PURE__ */ t("li", { className: "text-sm", style: { padding: "10px 0", borderTop: n ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ a("div", { className: "flex items-start gap-2", children: [
    /* @__PURE__ */ t("div", { style: { flex: "none", minWidth: 28 }, children: ue(e.priority) }),
    /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
      /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        e.reason,
        " · ",
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        " · ",
        pe(e.age_hours)
      ] }),
      /* @__PURE__ */ t("label", { htmlFor: y, className: "text-xs text-muted", style: { display: "block", marginTop: 6 }, children: "Reply to the thread, sent as you" }),
      /* @__PURE__ */ t(
        "textarea",
        {
          id: y,
          value: i,
          maxLength: 1500,
          rows: 3,
          onChange: (_) => p(_.target.value),
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
      /* @__PURE__ */ t(g, { style: P, disabled: !i.trim(), onClick: () => o(i.trim(), i.trim() !== (e.reply_draft || "").trim()), children: "Send to thread" }),
      /* @__PURE__ */ t(g, { style: P, onClick: () => r("ignored"), children: "Ignore" }),
      /* @__PURE__ */ t(Z, { label: "More actions", actions: x })
    ] })
  ] }) });
}
function We({
  e,
  first: n,
  onMark: r,
  onWhy: s,
  onStartFix: o
}) {
  const i = !!e.handoff_title && !!o;
  return /* @__PURE__ */ t("li", { className: "text-sm", style: { padding: "10px 0", borderTop: n ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ a("div", { className: "flex items-start gap-2", children: [
    /* @__PURE__ */ t("div", { style: { flex: "none", minWidth: 28 }, children: ue(e.priority) }),
    /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
      i && /* @__PURE__ */ a("div", { className: "text-xs", style: { marginTop: 2 }, children: [
        "Fix: ",
        e.handoff_title
      ] }),
      /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        e.reason,
        e.words && e.words.length > 0 && /* @__PURE__ */ a(B, { children: [
          " (",
          e.words.join(", "),
          ")"
        ] }),
        " · ",
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        " · ",
        pe(e.age_hours),
        e.permalink && /* @__PURE__ */ a(B, { children: [
          " · ",
          /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open in Slack" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ t("div", { className: "flex items-center gap-1", style: { flex: "none" }, children: i ? /* @__PURE__ */ a(B, { children: [
      /* @__PURE__ */ t(g, { style: P, onClick: o, children: "Start fix session" }),
      /* @__PURE__ */ t(g, { style: P, onClick: () => r("ignored"), children: "Ignore" }),
      /* @__PURE__ */ t(
        Z,
        {
          label: "More actions",
          actions: [
            { label: "Done", onClick: () => r("done") },
            { label: "Why? Ask the lead", onClick: s }
          ]
        }
      )
    ] }) : /* @__PURE__ */ a(B, { children: [
      /* @__PURE__ */ t(g, { style: P, onClick: () => r("done"), children: "Done" }),
      /* @__PURE__ */ t(g, { style: P, onClick: () => r("ignored"), children: "Ignore" }),
      /* @__PURE__ */ t(Z, { label: "More actions", actions: [{ label: "Why? Ask the lead", onClick: s }] })
    ] }) })
  ] }) });
}
const De = typeof ne.useChatLauncher == "function" ? ne.useChatLauncher : () => null;
function Ae() {
  const e = De(), [n, r] = c(null), [s, o] = c(!1), i = (x) => {
    e ? e.openChat({ message: x.prompt, autoSend: !1 }) : (o(!1), r(x));
  }, p = async () => {
    if (n)
      try {
        await navigator.clipboard.writeText(n.prompt), o(!0);
      } catch {
        o(!1);
      }
  }, y = n ? /* @__PURE__ */ t(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "sr-fix-title",
      style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" },
      onKeyDown: (x) => x.key === "Escape" && r(null),
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
          /* @__PURE__ */ t(g, { onClick: p, children: s ? "Copied" : "Copy prompt" }),
          /* @__PURE__ */ t("a", { className: "underline text-sm", href: "/chat?new=1", children: "New chat" }),
          /* @__PURE__ */ t("div", { className: "flex-1" }),
          /* @__PURE__ */ t(g, { onClick: () => r(null), children: "Close" })
        ] })
      ] })
    }
  ) : null;
  return [i, y];
}
function Ie({
  needs: e,
  today: n,
  handled: r,
  onChanged: s,
  onWhy: o
}) {
  const i = Y(), [p, y] = Ae(), x = (e == null ? void 0 : e.handoffs) || [], _ = new Map(x.map((l) => [l.key, l.handoff])), [v, R] = c(null), [C, W] = c("");
  K(() => {
    if (!C) return;
    const l = window.setTimeout(() => W(""), 4e3);
    return () => window.clearTimeout(l);
  }, [C]);
  const A = async (l, m, D, S) => {
    R(null), N((u) => new Set(u).add(S));
    try {
      D && await i.post(`${w}/items/reply/draft`, { key: l, text: m }), await i.post(`${w}/items/reply/send`, { key: l }), W("Sent as you"), s();
    } catch (u) {
      N((G) => {
        const H = new Set(G);
        return H.delete(S), H;
      }), R({ key: l, text: m, edited: D, why: u.message || "unknown error" });
    }
  }, $ = (e == null ? void 0 : e.replied) || [], [d, f] = c(""), T = async (l) => {
    f("");
    try {
      await i.post(`${w}/items/handoff/dismiss`, { key: l }), s();
    } catch {
      f(l);
    }
  }, [O, N] = c(/* @__PURE__ */ new Set()), [b, L] = c(null);
  K(() => N(/* @__PURE__ */ new Set()), [e]);
  const h = async (l, m, D) => {
    L(null), D && N((S) => new Set(S).add(D));
    try {
      for (const S of l) await i.post(`${w}/items/handle`, { key: S, how: m });
      s();
    } catch {
      D && N((S) => {
        const u = new Set(S);
        return u.delete(D), u;
      }), L({ keys: l, how: m, rowId: D });
    }
  }, k = ((e == null ? void 0 : e.groups) || []).map((l) => ({
    ...l,
    shown: l.entries.filter((m) => !O.has(`${l.id}:${m.key}`))
  })), F = k.every((l) => l.shown.length === 0), j = (b == null ? void 0 : b.how) === "reopen" ? "reopen" : (b == null ? void 0 : b.how) === "ignored" ? "ignore" : "mark as done";
  return /* @__PURE__ */ a(I, { className: "mb-4", children: [
    /* @__PURE__ */ t(z, { children: "Needs you" }),
    (n == null ? void 0 : n.text) && /* @__PURE__ */ a("p", { className: "text-sm", style: { margin: "0 0 8px" }, "data-testid": "crew-today", children: [
      n.text,
      n.at > 0 && /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
        " · ",
        U(n.at)
      ] })
    ] }),
    C && /* @__PURE__ */ t("p", { role: "status", className: "text-sm", style: { margin: "0 0 8px", color: "var(--success, var(--text))" }, children: C }),
    v && /* @__PURE__ */ t(
      V,
      {
        message: `Could not send that reply: ${v.why}`,
        onRetry: () => A(v.key, v.text, v.edited, `decide:${v.key}`)
      }
    ),
    b && /* @__PURE__ */ t(
      V,
      {
        message: `Could not ${j} that message. Nothing changed.`,
        onRetry: () => h(b.keys, b.how, b.rowId)
      }
    ),
    e ? F ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Nothing needs you right now." }) : k.map(
      (l) => l.shown.length === 0 ? null : /* @__PURE__ */ a("section", { "aria-label": le[l.id], style: { marginTop: 10 }, children: [
        /* @__PURE__ */ a("h4", { className: "text-sm", style: { margin: 0, fontWeight: 600, color: "var(--text-strong)" }, children: [
          le[l.id],
          " ",
          /* @__PURE__ */ a("span", { className: "text-muted", style: { fontWeight: 400 }, children: [
            "(",
            l.total - (l.entries.length - l.shown.length),
            ")"
          ] })
        ] }),
        /* @__PURE__ */ t("ul", { className: "flex flex-col", children: l.shown.map((m, D) => l.id === "decide" && m.reply_draft && !_.has(m.key) ? /* @__PURE__ */ t(
          Re,
          {
            e: m,
            first: D === 0,
            onMark: (S) => h([m.key], S, `${l.id}:${m.key}`),
            onWhy: () => o(m),
            onSend: (S, u) => A(m.key, S, u, `${l.id}:${m.key}`)
          },
          m.key
        ) : /* @__PURE__ */ t(
          We,
          {
            e: m,
            first: D === 0,
            onMark: (S) => {
              var u;
              return h((u = m.members) != null && u.length ? m.members : [m.key], S, `${l.id}:${m.key}`);
            },
            onWhy: () => o(m),
            onStartFix: l.id === "decide" && _.has(m.key) ? () => p(_.get(m.key)) : void 0
          },
          m.key
        )) })
      ] }, l.id)
    ) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" }),
    d && /* @__PURE__ */ t(V, { message: "Could not dismiss that hand-off. Nothing changed.", onRetry: () => T(d) }),
    x.length > 0 && /* @__PURE__ */ a("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ a("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Fixes handed off (",
        (e == null ? void 0 : e.handoffs_total) ?? x.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: x.map((l, m) => /* @__PURE__ */ a(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: m === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ a("span", { style: { flex: 1, minWidth: 0 }, children: [
              l.handoff.title,
              /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
                " · ",
                l.summary,
                " · ",
                /* @__PURE__ */ t("span", { className: "font-mono", children: l.handoff.repo }),
                " · ",
                U(l.handoff.at)
              ] })
            ] }),
            /* @__PURE__ */ t(g, { style: P, onClick: () => p(l.handoff), children: "Start fix session" }),
            /* @__PURE__ */ t(g, { style: P, onClick: () => T(l.key), children: "Dismiss" })
          ]
        },
        l.key
      )) })
    ] }),
    ((e == null ? void 0 : e.handled_total) || 0) > 0 && /* @__PURE__ */ a("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ a("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Handled (",
        e == null ? void 0 : e.handled_total,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: r.map((l, m) => /* @__PURE__ */ a(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: m === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 0 }, children: l.summary || l.text.slice(0, 200) }),
            /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
              l.handled_how === "ignored" ? "Ignored" : "Done",
              " ",
              U(l.handled_at)
            ] }),
            /* @__PURE__ */ t(g, { style: P, onClick: () => h([l.key], "reopen"), children: "Reopen" })
          ]
        },
        l.key
      )) })
    ] }),
    $.length > 0 && /* @__PURE__ */ a("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ a("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Replied (",
        (e == null ? void 0 : e.replied_total) ?? $.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: $.map((l, m) => /* @__PURE__ */ a(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: m === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ a("span", { style: { flex: 1, minWidth: 0 }, children: [
              l.text.length > 120 ? `${l.text.slice(0, 119)}…` : l.text,
              /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
                " · ",
                l.summary,
                " · ",
                /* @__PURE__ */ t("span", { className: "font-mono", children: l.channel }),
                " · ",
                U(l.at)
              ] })
            ] }),
            l.permalink && /* @__PURE__ */ t("a", { className: "underline text-xs", href: l.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open reply" })
          ]
        },
        l.key
      )) })
    ] }),
    y
  ] });
}
function Le({ it: e, first: n, checked: r, onToggle: s }) {
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
        checked: r,
        onChange: s,
        style: { marginTop: 4 }
      }
    ),
    /* @__PURE__ */ a("div", { className: "flex items-center gap-1", style: { flex: "none" }, children: [
      /* @__PURE__ */ t(E, { variant: Ne(e.status), children: e.status }),
      o && /* @__PURE__ */ t(E, { variant: o.variant, children: o.label }),
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
        e.user && /* @__PURE__ */ a(B, { children: [
          " · ",
          e.user
        ] }),
        e.reply_count > 0 && /* @__PURE__ */ a(B, { children: [
          " · ",
          e.reply_count,
          " replies"
        ] }),
        " · ",
        /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "open in Slack" }),
        e.links.length > 0 && /* @__PURE__ */ a(B, { children: [
          " · linked ",
          e.links.map((p) => /* @__PURE__ */ t("a", { className: "underline mr-2", href: p, target: "_blank", rel: "noreferrer noopener", children: p.replace("https://github.com/", "") }, p))
        ] })
      ] }),
      e.note && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: e.note })
    ] })
  ] }) });
}
function Fe({ state: e, busy: n, onDigest: r }) {
  const s = e.digest, o = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), i = s.last_posted_date === o;
  return /* @__PURE__ */ a(I, { className: "mb-4", children: [
    /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ t(z, { children: i ? "Today's digest" : "Latest digest" }),
      s.pending ? /* @__PURE__ */ t(E, { variant: "aim", children: "being delivered" }) : null,
      /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: s.last_posted_date ? `${s.last_posted_date} · ${e.settings.digest_destination === "self_dm" ? "DMed to you" : "dashboard notification"}` : "none yet" }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      /* @__PURE__ */ t(g, { onClick: r, disabled: !!n || !e.crew.live, children: "Request digest" })
    ] }),
    s.last_text ? /* @__PURE__ */ t("pre", { className: "whitespace-pre-wrap text-sm mt-2", style: { fontFamily: "inherit", margin: "8px 0 0" }, children: s.last_text }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted mt-2", children: "The Radar Lead writes one after the daily cron or when you press Request digest." }),
    s.last_error && /* @__PURE__ */ t("p", { className: "text-xs mt-1", style: { color: "var(--danger)" }, children: s.last_error })
  ] });
}
function Be({ state: e }) {
  return /* @__PURE__ */ t("div", { className: "flex items-center gap-2", style: { marginTop: 10 }, children: ee.map((n) => /* @__PURE__ */ a("span", { title: `${n.title} · ${Q(n, e).label}`, children: [
    /* @__PURE__ */ t(te, { m: n, s: e, selected: n.id === "lead", size: 30 }),
    /* @__PURE__ */ t("span", { className: "sr-only", children: `${n.title}: ${Q(n, e).label}` })
  ] }, n.id)) });
}
function Pe(e) {
  const n = `slack-radar:chat-open:${e}`, r = () => {
    try {
      return window.localStorage.getItem(n) === "1";
    } catch {
      return !1;
    }
  }, [s, o] = c(r);
  K(() => o(r()), [n]);
  const i = q(
    (p) => {
      o(p);
      try {
        p ? window.localStorage.setItem(n, "1") : window.localStorage.removeItem(n);
      } catch {
      }
    },
    [n]
  );
  return [s, i];
}
function se({ q: e, onClick: n, disabled: r }) {
  return /* @__PURE__ */ t(
    "button",
    {
      type: "button",
      onClick: n,
      disabled: r,
      style: {
        fontSize: 12,
        border: "1px solid var(--border-strong)",
        borderRadius: 999,
        padding: "4px 10px",
        background: "transparent",
        color: "var(--text)",
        cursor: r ? "not-allowed" : "pointer",
        opacity: r ? 0.5 : 1,
        whiteSpace: "nowrap"
      },
      children: e
    }
  );
}
function Me(e) {
  const n = Y(), { state: r, expanded: s, pending: o } = e, i = ee[0], p = r.crew.slot_key, y = r.crew.live && r.crew.session_open && r.crew.session_agent === r.crew.agent, [x, _] = c(""), [v, R] = c(!1), [C, W] = c(""), [A, $] = c(!1), d = Q(i, r), f = async (h) => {
    await n.post(`${w}/crew/message`, { message: h }), e.onChanged();
  }, T = async (h) => {
    const k = h.trim();
    if (k) {
      R(!0), W("");
      try {
        await n.post(`${w}/crew/message`, { message: k }), _(""), k === o && e.setPending(""), e.setExpanded(!0), e.onChanged();
      } catch {
        W(k);
      } finally {
        R(!1);
      }
    }
  }, O = async () => {
    try {
      await navigator.clipboard.writeText(o), $(!0), window.setTimeout(() => $(!1), 1500);
    } catch {
      $(!1);
    }
  }, N = C && /* @__PURE__ */ t(V, { message: "The Radar Lead did not get that message.", onRetry: () => T(C) }), b = /* @__PURE__ */ t("div", { className: "text-sm", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }, children: r.crew.live ? /* @__PURE__ */ a(B, { children: [
    /* @__PURE__ */ t("span", { children: "The Radar Lead session opens on its next turn. Open it now to talk here." }),
    /* @__PURE__ */ t(g, { primary: !0, onClick: e.onStart, disabled: !!e.busy || !e.configured, children: "Open the session" })
  ] }) : /* @__PURE__ */ a("span", { children: [
    "The Radar Lead is paused. Turn on ",
    /* @__PURE__ */ t("b", { children: "Crew" }),
    " at the top of the page to triage your channels and talk to it here."
  ] }) });
  if (!s)
    return /* @__PURE__ */ a(I, { className: "mb-4", style: { padding: "10px 14px" }, children: [
      /* @__PURE__ */ a(
        "form",
        {
          className: "flex flex-wrap items-center gap-2",
          onSubmit: (h) => {
            h.preventDefault(), T(x);
          },
          children: [
            /* @__PURE__ */ t(te, { m: i, s: r, size: 26 }),
            /* @__PURE__ */ t(
              M,
              {
                "aria-label": "Ask the lead",
                placeholder: "Ask the lead…",
                value: x,
                onChange: (h) => _(h.target.value),
                disabled: !y || v,
                style: { flex: 1, minWidth: 200 }
              }
            ),
            /* @__PURE__ */ t(g, { primary: !0, type: "submit", disabled: !y || v || !x.trim(), children: "Send" }),
            ae.map((h) => /* @__PURE__ */ t(se, { q: h, onClick: () => T(h), disabled: !y || v }, h))
          ]
        }
      ),
      !y && /* @__PURE__ */ t("div", { style: { marginTop: 8 }, children: b }),
      N
    ] });
  const L = e.events.filter((h) => h.kind === "crew" || h.kind === "digest").slice(0, 5);
  return /* @__PURE__ */ a(
    I,
    {
      className: "mb-4",
      style: { padding: 0, display: "flex", flexDirection: "column", height: "min(620px, calc(100vh - 180px))", overflow: "hidden" },
      children: [
        /* @__PURE__ */ a("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border)" }, children: [
          /* @__PURE__ */ a("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: r.crew.name || i.title }),
            /* @__PURE__ */ t(E, { variant: d.tone === "muted" ? "muted" : d.tone === "aim" ? "aim" : "ok", children: d.label }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(g, { onClick: () => e.setExpanded(!1), "aria-expanded": !0, children: "Collapse" })
          ] }),
          /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
            "phase ",
            r.crew_memory.phase,
            " · next: ",
            r.crew_memory.next || "—"
          ] }),
          /* @__PURE__ */ t(Be, { state: r })
        ] }),
        o && // ChatEmbed has no API to fill its composer, so the question waits here.
        /* @__PURE__ */ a(
          "div",
          {
            className: "text-sm flex flex-wrap items-center gap-2",
            style: { padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" },
            children: [
              /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200, userSelect: "all" }, children: o }),
              /* @__PURE__ */ t(g, { primary: !0, style: P, onClick: () => T(o), disabled: !y || v, children: "Send" }),
              /* @__PURE__ */ t(g, { style: P, onClick: O, children: A ? "Copied" : "Copy" })
            ]
          }
        ),
        N && /* @__PURE__ */ t("div", { style: { padding: "0 16px" }, children: N }),
        /* @__PURE__ */ t("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: y ? /* @__PURE__ */ t(
          ye,
          {
            slotKey: p,
            agent: r.crew.agent,
            frameless: !0,
            startAtBottom: !0,
            placeholder: "Ask the Radar Lead…",
            onSend: f
          },
          p
        ) : /* @__PURE__ */ a("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 10 }, children: [
          b,
          !e.configured && /* @__PURE__ */ t("p", { className: "text-xs text-muted", children: "Add a channel in Settings first." }),
          L.length > 0 && /* @__PURE__ */ t("ul", { className: "text-xs text-muted flex flex-col gap-1", style: { marginTop: 6 }, children: L.map((h, k) => /* @__PURE__ */ a("li", { children: [
            U(h.at),
            " · ",
            h.text
          ] }, `${h.at}-${k}`)) })
        ] }) }),
        /* @__PURE__ */ t("div", { className: "flex flex-wrap gap-2", style: { padding: "10px 16px 12px", borderTop: "1px solid var(--border)" }, children: ae.map((h) => /* @__PURE__ */ t(se, { q: h, onClick: () => T(h), disabled: !y || v }, h)) })
      ]
    }
  );
}
function Ee({ state: e }) {
  return /* @__PURE__ */ a(I, { children: [
    /* @__PURE__ */ t(z, { children: "Team" }),
    /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { marginBottom: 8 }, children: "Who works on your channels. Only the Radar Lead has a session; the others run when needed." }),
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: ee.map((n) => {
      var o, i;
      const r = Q(n, e), s = n.id === "lead" ? e.crew.agent : n.agent;
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
                /* @__PURE__ */ t(E, { variant: "muted", children: n.layer }),
                /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: n.kind })
              ] }),
              /* @__PURE__ */ t("p", { className: "text-sm", style: { margin: "4px 0 0" }, children: n.duty }),
              n.id === "investigator" && (((o = e.investigations) == null ? void 0 : o.items) || 0) > 0 && /* @__PURE__ */ a("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: [
                (i = e.investigations) == null ? void 0 : i.items,
                " item(s) under investigation"
              ] }),
              s && /* @__PURE__ */ t(de, { children: /* @__PURE__ */ a("span", { className: "font-mono", children: [
                "agent: ",
                s,
                n.id === "lead" && e.crew.slot_key ? ` · session: ${e.crew.slot_key}` : ""
              ] }) })
            ] }),
            /* @__PURE__ */ t("span", { className: "text-xs", style: { color: ce[r.tone], whiteSpace: "nowrap" }, children: r.label })
          ]
        },
        n.id
      );
    }) })
  ] });
}
function Oe({ events: e }) {
  return /* @__PURE__ */ a(I, { children: [
    /* @__PURE__ */ t(z, { children: "Activity" }),
    e.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No activity yet." }) : /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", children: e.map((n, r) => /* @__PURE__ */ a("li", { children: [
      /* @__PURE__ */ t("span", { className: "text-muted", children: X(n.at) }),
      " ",
      /* @__PURE__ */ t(E, { variant: "muted", children: n.kind }),
      " ",
      n.text
    ] }, `${n.at}-${r}`)) })
  ] });
}
function ze({
  state: e,
  busy: n,
  act: r,
  mcp: s,
  onProbe: o
}) {
  const i = Y(), [p, y] = c(e.settings.channels.join(`
`)), [x, _] = c(e.settings.digest_destination), [v, R] = c(e.settings.slack_login), [C, W] = c(e.settings.slack_mcp_command), [A, $] = c(e.settings.workspace_url), [d, f] = c(String(e.settings.poll_interval_secs)), [T, O] = c(String(e.settings.backfill_hours)), [N, b] = c(e.crew.unattended), [L, h] = c(e.crew.agent), [k, F] = c(e.crew.model), j = () => r(
    "Save settings",
    () => i.put(`${w}/settings`, {
      channels: p.split(/[\s,]+/).map((l) => l.trim()).filter(Boolean),
      digest_destination: x,
      slack_login: v.trim(),
      slack_mcp_command: C.trim(),
      workspace_url: A.trim(),
      poll_interval_secs: Number(d),
      backfill_hours: Number(T)
    })
  );
  return /* @__PURE__ */ a(B, { children: [
    !e.vault_available && /* @__PURE__ */ t(I, { className: "mb-4", children: /* @__PURE__ */ t("p", { className: "text-sm", children: "The gateway secret vault is unavailable, so settings cannot be saved." }) }),
    /* @__PURE__ */ a(I, { className: "mb-4", children: [
      /* @__PURE__ */ t(z, { children: "Basics" }),
      /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(me, { mcp: s, state: e }) }),
        /* @__PURE__ */ t(g, { disabled: !!n, onClick: o, children: "Check connection" })
      ] }),
      /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 12px" }, children: "Slack is read as you, read-only: no bot, no invite. The one write is the optional digest DM to yourself." }),
      /* @__PURE__ */ t("label", { className: "block text-sm mb-1", htmlFor: "sr-channels", children: "Channels to watch (one channel ID per line, e.g. C0123ABCD). Any channel you can read works." }),
      /* @__PURE__ */ t(
        "textarea",
        {
          id: "sr-channels",
          className: "w-full font-mono text-sm border rounded p-2 bg-transparent",
          rows: 5,
          value: p,
          onChange: (l) => y(l.target.value)
        }
      ),
      /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Digest destination",
          /* @__PURE__ */ a(
            "select",
            {
              className: "block w-full text-sm bg-transparent border rounded px-2 py-1",
              value: x,
              onChange: (l) => _(l.target.value),
              children: [
                /* @__PURE__ */ t("option", { value: "dashboard", children: "Dashboard notification only" }),
                /* @__PURE__ */ t("option", { value: "self_dm", children: "DM to myself in Slack" })
              ]
            }
          )
        ] }),
        x === "self_dm" && /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Your Slack login (for the DM)",
          /* @__PURE__ */ t(M, { value: v, onChange: (l) => R(l.target.value), placeholder: "jdoe" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Poll interval (seconds, 60–3600)",
          /* @__PURE__ */ t(M, { type: "number", min: 60, max: 3600, value: d, onChange: (l) => f(l.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(g, { primary: !0, className: "mt-3", disabled: !!n, onClick: j, children: "Save settings" })
    ] }),
    /* @__PURE__ */ t(I, { children: /* @__PURE__ */ a("details", { children: [
      /* @__PURE__ */ t("summary", { style: { cursor: "pointer", fontWeight: 600, color: "var(--text-strong)" }, children: "Advanced" }),
      /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "MCP server command (a single executable on PATH)",
          /* @__PURE__ */ t(M, { value: C, onChange: (l) => W(l.target.value), placeholder: "ai-community-slack-mcp" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Workspace URL (for permalinks, optional)",
          /* @__PURE__ */ t(M, { value: A, onChange: (l) => $(l.target.value), placeholder: "https://yourteam.slack.com" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "First-poll backfill (hours, 0–168)",
          /* @__PURE__ */ t(M, { type: "number", min: 0, max: 168, value: T, onChange: (l) => O(l.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(g, { className: "mt-3", disabled: !!n, onClick: j, children: "Save settings" }),
      /* @__PURE__ */ a("div", { style: { borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }, children: [
        /* @__PURE__ */ t("div", { className: "text-sm", style: { fontWeight: 600, marginBottom: 8 }, children: "Crew" }),
        /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
          /* @__PURE__ */ a("label", { className: "text-sm", children: [
            "Agent",
            /* @__PURE__ */ t(M, { value: L, onChange: (l) => h(l.target.value), placeholder: "slack-radar-crew" }),
            /* @__PURE__ */ t("span", { className: "block text-xs text-muted mt-1", children: "Default: the shipped slack-radar-crew agent. Your own agents are never modified." })
          ] }),
          /* @__PURE__ */ a("label", { className: "text-sm", children: [
            "Model (empty = agent default)",
            /* @__PURE__ */ t(M, { value: k, onChange: (l) => F(l.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ a("div", { className: "mt-3 flex items-center gap-2", children: [
          /* @__PURE__ */ t(
            re,
            {
              checked: N,
              onChange: b,
              label: "Unattended mode (auto-approve investigator commands)",
              describedBy: "sr-unattended-risk"
            }
          ),
          /* @__PURE__ */ t("span", { className: "text-sm", children: "Unattended mode (auto-approve investigator commands)" })
        ] }),
        /* @__PURE__ */ t("p", { id: "sr-unattended-risk", className: "text-xs text-muted mt-1", children: "Risk: anyone in a watched channel can write text the crew reads, so a crafted message could steer a command nobody reviews." }),
        /* @__PURE__ */ t(
          g,
          {
            primary: !0,
            className: "mt-3",
            disabled: !!n,
            onClick: () => r("Save crew", () => i.put(`${w}/crew`, { agent: L, model: k, unattended: N })),
            children: "Save crew"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  Ge as default
};
