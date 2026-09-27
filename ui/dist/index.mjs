import { jsxs as a, Fragment as C, jsx as t } from "react/jsx-runtime";
import { useAppApi as F, ChatEmbed as te } from "@kirocrew/app-sdk";
import { PageHeader as ne, Toggle as G, Btn as w, StatCard as j, Card as y, CardTitle as $, Input as N, EmptyState as ae, Badge as _ } from "@kirocrew/app-sdk/ui";
import { useState as c, useCallback as K, useEffect as Y, useMemo as se } from "react";
const u = "/api/apps/slack-radar", le = {
  checking: "checking…",
  connected: "connected",
  needs_login: "sign in again",
  binary_not_found: "not installed",
  incompatible: "missing read access",
  error: "not working"
}, re = ["What needs me today?", "Draft today's digest", "Re-check resolved threads"], ie = [
  { id: "board", label: "Board" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" }
], z = (e) => e ? new Date(e * 1e3).toLocaleString() : "never";
function H(e) {
  if (!e) return "never";
  const n = Math.max(0, Date.now() / 1e3 - e);
  return n < 90 ? "just now" : n < 3600 ? `${Math.round(n / 60)} min ago` : n < 86400 ? `${Math.round(n / 3600)} h ago` : z(e);
}
function Q(e, n) {
  return n === "needs_login" ? "needs_login" : (e == null ? void 0 : e.status) || "checking";
}
function V({ children: e, summary: n = "Details" }) {
  return /* @__PURE__ */ a("details", { className: "text-xs text-muted", style: { marginTop: 6 }, children: [
    /* @__PURE__ */ t("summary", { style: { cursor: "pointer" }, children: n }),
    /* @__PURE__ */ t("div", { style: { marginTop: 4 }, children: e })
  ] });
}
const q = [
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
    kind: "Coming soon",
    agent: "slack-radar-watcher",
    duty: "Will judge batches of possibly-resolved threads so the lead does not have to. The lead does this today.",
    planned: !0
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
function B(e, n) {
  var l;
  if (e.id === "lead")
    return n.crew.live ? n.crew.running ? { label: "working", tone: "aim" } : { label: "live", tone: "ok" } : { label: "paused", tone: "muted" };
  if (e.id === "investigator") {
    const s = ((l = n.investigations) == null ? void 0 : l.running) || 0;
    return s ? { label: `${s} running`, tone: "aim" } : { label: "standing by", tone: "muted" };
  }
  return e.id === "watcher" ? { label: "Coming soon", tone: "muted" } : n.source_state === "needs_login" ? { label: "sign in again", tone: "warn" } : { label: `polled ${H(n.last_poll_at)}`, tone: "muted" };
}
const J = {
  ok: "var(--ok)",
  aim: "var(--aim)",
  warn: "var(--warn)",
  muted: "var(--muted-strong)"
};
function X({ m: e, s: n, selected: l, size: s = 32 }) {
  const d = B(e, n), r = e.planned || e.id === "poller", m = {
    width: s,
    height: s,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    fontWeight: 700,
    position: "relative",
    flex: "none",
    background: r ? "transparent" : "var(--bg-hover)",
    color: r ? "var(--muted)" : "var(--text-strong)",
    border: `2px ${r ? "dashed" : "solid"} ${l ? "var(--accent)" : r ? "var(--border-strong)" : "transparent"}`,
    opacity: e.planned ? 0.6 : 1
  };
  return /* @__PURE__ */ a("span", { style: m, "aria-hidden": !0, children: [
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
          background: J[d.tone]
        }
      }
    )
  ] });
}
function oe(e) {
  return e === "new" ? "warn" : e === "investigating" ? "aim" : e === "resolved" ? "ok" : "muted";
}
function de({ tab: e, setTab: n }) {
  return /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Slack Radar sections", style: { display: "flex", gap: 4 }, children: ie.map((l) => {
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
function ce({
  state: e,
  configured: n,
  busy: l,
  onStart: s,
  onPause: d
}) {
  const r = e.crew.live;
  return /* @__PURE__ */ a("div", { className: "flex items-center gap-2", title: !r && !n ? "Add a channel in Settings first" : void 0, children: [
    /* @__PURE__ */ t("span", { className: "text-sm", children: "Crew" }),
    /* @__PURE__ */ t(
      G,
      {
        checked: r,
        disabled: !!l || !r && !n,
        onChange: (p) => p ? s() : d(),
        label: r ? "Pause the crew" : "Start the crew"
      }
    )
  ] });
}
function _e() {
  const e = F(), [n, l] = c("board"), [s, d] = c(null), [r, m] = c([]), [p, v] = c([]), [x, o] = c("open"), [g, h] = c(/* @__PURE__ */ new Set()), [k, D] = c(""), [P, S] = c(""), [T, A] = c(null), R = K(async () => {
    try {
      A(await e.get(`${u}/mcp/status`));
    } catch (i) {
      A({ status: "error", command: "", detail: i.message });
    }
  }, [e]);
  Y(() => {
    R();
  }, [R]);
  const f = K(async () => {
    try {
      const [i, O, U] = await Promise.all([
        e.get(`${u}/state`),
        e.get(`${u}/items?status=${encodeURIComponent(x)}&limit=300`),
        e.get(`${u}/events?limit=150`)
      ]);
      d(i), m(O.items), v(U.events.slice().reverse());
    } catch (i) {
      S(`Could not load: ${i.message}`);
    }
  }, [e, x]);
  Y(() => {
    f();
    const i = window.setInterval(f, 3e4);
    return () => window.clearInterval(i);
  }, [f]);
  const b = async (i, O) => {
    D(i), S("");
    try {
      await O(), S(`${i}: done`), await f();
    } catch (U) {
      S(`${i} failed: ${U.message}`);
    } finally {
      D("");
    }
  }, I = !!s && s.settings.channels.length > 0, L = (s == null ? void 0 : s.settings.channels.length) || 0, W = s ? `${L ? `Watching ${L} channel${L === 1 ? "" : "s"}` : "No channels yet"} · ${s.crew.live ? "running" : "paused"}` : "A small crew triaging your Slack channels", E = s ? Q(T, s.source_state) : "checking", M = () => {
    R(), f();
  };
  return /* @__PURE__ */ a(C, { children: [
    /* @__PURE__ */ t(
      ne,
      {
        title: "Slack Radar",
        subtitle: W,
        actions: /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-4", children: [
          /* @__PURE__ */ t(de, { tab: n, setTab: l }),
          s && /* @__PURE__ */ t(
            ce,
            {
              state: s,
              configured: I,
              busy: k,
              onStart: () => b("Start crew", () => e.post(`${u}/crew/start`, {})),
              onPause: () => b("Pause crew", () => e.post(`${u}/crew/pause`, {}))
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ a("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      s && E === "needs_login" && /* @__PURE__ */ t(he, { mcp: T, sourceError: s.source_error, busy: k, onCheck: M }),
      P && /* @__PURE__ */ t("p", { role: "status", className: "text-sm text-muted mb-3", children: P }),
      s ? n === "board" ? /* @__PURE__ */ t(
        me,
        {
          state: s,
          items: r,
          configured: I,
          mcp: T,
          filter: x,
          setFilter: o,
          selected: g,
          setSelected: h,
          busy: k,
          onPoll: () => b("Poll", () => e.post(`${u}/poll`, {})),
          onInvestigate: (i) => b("Investigate", async () => {
            await e.post(`${u}/investigate`, { keys: [...g], repo: i }), h(/* @__PURE__ */ new Set());
          }),
          onStart: () => b("Start crew", () => e.post(`${u}/crew/start`, {})),
          onDigest: () => b("Request digest", () => e.post(`${u}/digest/request`, {})),
          events: p,
          onChanged: f
        }
      ) : n === "team" ? /* @__PURE__ */ t(xe, { state: s }) : n === "activity" ? /* @__PURE__ */ t(ye, { events: p }) : /* @__PURE__ */ t(fe, { state: s, busy: k, act: b, mcp: T, onProbe: R }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" })
    ] })
  ] });
}
function Z({ mcp: e, sourceError: n }) {
  var s;
  const l = [
    (e == null ? void 0 : e.status) && `status: ${e.status}`,
    (e == null ? void 0 : e.command) && `command: ${e.command}`,
    n && `error: ${n}`,
    (e == null ? void 0 : e.detail) && e.detail !== n && `detail: ${e.detail}`,
    ((s = e == null ? void 0 : e.missing_read_tools) == null ? void 0 : s.length) && `missing read tools: ${e.missing_read_tools.join(", ")}`
  ].filter(Boolean);
  return l.length ? /* @__PURE__ */ t(V, { children: /* @__PURE__ */ t("pre", { className: "font-mono whitespace-pre-wrap", style: { margin: 0 }, children: l.join(`
`) }) }) : null;
}
function he({ mcp: e, sourceError: n, busy: l, onCheck: s }) {
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
          /* @__PURE__ */ t(w, { primary: !0, onClick: s, disabled: !!l, children: "I signed in, check again" })
        ] }),
        /* @__PURE__ */ t(Z, { mcp: e, sourceError: n })
      ]
    }
  );
}
function ee({ mcp: e, state: n, withPoll: l }) {
  const s = Q(e, n.source_state), d = s === "connected";
  return /* @__PURE__ */ a("div", { className: "mb-4", children: [
    /* @__PURE__ */ a("p", { role: "status", className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { margin: 0 }, children: [
      /* @__PURE__ */ t("span", { "aria-hidden": !0, style: { width: 8, height: 8, borderRadius: "50%", background: d ? "var(--ok)" : s === "checking" ? "var(--muted-strong)" : "var(--warn)", display: "inline-block" } }),
      /* @__PURE__ */ a("span", { children: [
        "Slack connection: ",
        /* @__PURE__ */ t("span", { style: { color: d ? "var(--text)" : "var(--warn)" }, children: le[s] || s })
      ] }),
      l && /* @__PURE__ */ a("span", { children: [
        "· last poll ",
        H(n.last_poll_at),
        n.settings.channels.length > 0 && /* @__PURE__ */ a(C, { children: [
          " · watching ",
          n.settings.channels.join(", ")
        ] })
      ] })
    ] }),
    !d && s !== "needs_login" && /* @__PURE__ */ t(Z, { mcp: e, sourceError: n.source_error })
  ] });
}
function me(e) {
  const { state: n, items: l, selected: s, setSelected: d } = e, [r, m] = c(""), p = n.counts.open_by_priority, v = (o) => {
    const g = new Set(s);
    g.has(o) ? g.delete(o) : g.add(o), d(g);
  }, x = se(
    () => n.settings.channels.map((o) => ({ cid: o, ...n.channels[o] || {} })),
    [n]
  );
  return /* @__PURE__ */ a("div", { style: { display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 20, alignItems: "start" }, children: [
    /* @__PURE__ */ a("div", { style: { minWidth: 0 }, children: [
      /* @__PURE__ */ t(ee, { mcp: e.mcp, state: n, withPoll: !0 }),
      /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4", children: [
        /* @__PURE__ */ t(j, { label: "Awaiting triage", value: n.counts.needs_triage, accent: !0 }),
        /* @__PURE__ */ t(j, { label: "Possibly resolved", value: n.counts.possibly_resolved }),
        /* @__PURE__ */ t(j, { label: "Open p0 / p1", value: `${p.p0 || 0} / ${p.p1 || 0}` }),
        /* @__PURE__ */ t(j, { label: "Tracked items", value: n.counts.total })
      ] }),
      !e.configured && /* @__PURE__ */ a(y, { className: "mb-4", children: [
        /* @__PURE__ */ t($, { children: "Finish setup" }),
        /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite." })
      ] }),
      /* @__PURE__ */ a(y, { className: "mb-4", children: [
        /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2 mb-3", children: [
          /* @__PURE__ */ t($, { children: "Ledger" }),
          /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-filter", children: "Show" }),
          /* @__PURE__ */ a(
            "select",
            {
              id: "sr-filter",
              className: "text-sm bg-transparent border rounded px-2 py-1",
              value: e.filter,
              onChange: (o) => e.setFilter(o.target.value),
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
            N,
            {
              "aria-label": "GitHub repository to search (owner/name, optional)",
              placeholder: "owner/repo (optional)",
              value: r,
              onChange: (o) => m(o.target.value),
              className: "w-48"
            }
          ),
          /* @__PURE__ */ a(w, { onClick: () => e.onInvestigate(r), disabled: s.size === 0 || !!e.busy, children: [
            "Investigate ",
            s.size || ""
          ] })
        ] }),
        l.length === 0 ? /* @__PURE__ */ t(ae, { icon: /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "📡" }), title: "Nothing here yet", subtitle: "New messages appear after the next poll." }) : /* @__PURE__ */ t("ul", { className: "flex flex-col", children: l.map((o, g) => /* @__PURE__ */ t(ge, { it: o, first: g === 0, checked: s.has(o.key), onToggle: () => v(o.key) }, o.key)) })
      ] }),
      /* @__PURE__ */ t(ue, { state: n, busy: e.busy, onDigest: e.onDigest }),
      /* @__PURE__ */ a(y, { children: [
        /* @__PURE__ */ t($, { children: "Channels" }),
        x.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No channels configured." }) : /* @__PURE__ */ a("table", { className: "w-full text-sm", children: [
          /* @__PURE__ */ t("thead", { children: /* @__PURE__ */ a("tr", { className: "text-left text-muted", children: [
            /* @__PURE__ */ t("th", { scope: "col", children: "Channel" }),
            /* @__PURE__ */ t("th", { scope: "col", children: "Last polled" }),
            /* @__PURE__ */ t("th", { scope: "col", children: "Status" })
          ] }) }),
          /* @__PURE__ */ t("tbody", { children: x.map((o) => /* @__PURE__ */ a("tr", { children: [
            /* @__PURE__ */ t("td", { className: "font-mono", children: o.cid }),
            /* @__PURE__ */ t("td", { children: z(o.last_polled_at) }),
            /* @__PURE__ */ t("td", { children: o.last_error ? /* @__PURE__ */ t(_, { variant: "err", title: o.last_error, children: "error" }) : /* @__PURE__ */ t(_, { variant: "ok", children: "ok" }) })
          ] }, o.cid)) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ t(
      ve,
      {
        state: n,
        events: e.events,
        configured: e.configured,
        busy: e.busy,
        onStart: e.onStart,
        onPoll: e.onPoll,
        onChanged: e.onChanged
      }
    )
  ] });
}
function ge({ it: e, first: n, checked: l, onToggle: s }) {
  const d = e.priority ? { label: e.priority, variant: e.priority === "p0" || e.priority === "p1" ? "err" : "muted" } : e.possibly_resolved ? { label: "possibly resolved", variant: "warn" } : null, r = [
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
      /* @__PURE__ */ t(_, { variant: oe(e.status), children: e.status }),
      d && /* @__PURE__ */ t(_, { variant: d.variant, children: d.label }),
      r.length > 0 && /* @__PURE__ */ a("span", { className: "text-xs text-muted", title: r.join(`
`), "aria-label": r.join("; "), children: [
        "+",
        r.length
      ] })
    ] }),
    /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || e.text.slice(0, 280) }),
      /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        e.user && /* @__PURE__ */ a(C, { children: [
          " · ",
          e.user
        ] }),
        e.reply_count > 0 && /* @__PURE__ */ a(C, { children: [
          " · ",
          e.reply_count,
          " replies"
        ] }),
        " · ",
        /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "open in Slack" }),
        e.links.length > 0 && /* @__PURE__ */ a(C, { children: [
          " · linked ",
          e.links.map((m) => /* @__PURE__ */ t("a", { className: "underline mr-2", href: m, target: "_blank", rel: "noreferrer noopener", children: m.replace("https://github.com/", "") }, m))
        ] })
      ] }),
      e.note && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: e.note })
    ] })
  ] }) });
}
function ue({ state: e, busy: n, onDigest: l }) {
  const s = e.digest, d = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), r = s.last_posted_date === d;
  return /* @__PURE__ */ a(y, { className: "mb-4", children: [
    /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ t($, { children: r ? "Today's digest" : "Latest digest" }),
      s.pending ? /* @__PURE__ */ t(_, { variant: "aim", children: "being delivered" }) : null,
      /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: s.last_posted_date ? `${s.last_posted_date} · ${e.settings.digest_destination === "self_dm" ? "DMed to you" : "dashboard notification"}` : "none yet" }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      /* @__PURE__ */ t(w, { onClick: l, disabled: !!n || !e.crew.live, children: "Request digest" })
    ] }),
    s.last_text ? /* @__PURE__ */ t("pre", { className: "whitespace-pre-wrap text-sm mt-2", style: { fontFamily: "inherit", margin: "8px 0 0" }, children: s.last_text }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted mt-2", children: "The Radar Lead writes one after the daily cron or when you press Request digest." }),
    s.last_error && /* @__PURE__ */ t("p", { className: "text-xs mt-1", style: { color: "var(--danger)" }, children: s.last_error })
  ] });
}
function pe({ state: e }) {
  return /* @__PURE__ */ t("div", { className: "flex items-center gap-2", style: { marginTop: 10 }, children: q.map((n) => /* @__PURE__ */ a("span", { title: `${n.title} · ${B(n, e).label}`, children: [
    /* @__PURE__ */ t(X, { m: n, s: e, selected: n.id === "lead", size: 30 }),
    /* @__PURE__ */ t("span", { className: "sr-only", children: `${n.title}: ${B(n, e).label}` })
  ] }, n.id)) });
}
function ve(e) {
  const n = F(), { state: l } = e, s = q[0], d = l.crew.slot_key, r = l.crew.live && l.crew.session_open && l.crew.session_agent === l.crew.agent, [m, p] = c(!1), v = async (h) => {
    await n.post(`${u}/crew/message`, { message: h }), e.onChanged();
  }, x = async (h) => {
    p(!0);
    try {
      await v(h);
    } finally {
      p(!1);
    }
  }, o = e.events.filter((h) => h.kind === "crew" || h.kind === "digest").slice(0, 5), g = B(s, l);
  return /* @__PURE__ */ a(y, { style: { position: "sticky", top: 0, padding: 0, display: "flex", flexDirection: "column", height: "min(760px, calc(100vh - 140px))", overflow: "hidden" }, children: [
    /* @__PURE__ */ a("div", { style: { padding: "14px 16px", borderBottom: "1px solid var(--border)" }, children: [
      /* @__PURE__ */ a("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: l.crew.name || s.title }),
        /* @__PURE__ */ t(_, { variant: g.tone === "muted" ? "muted" : g.tone === "aim" ? "aim" : "ok", children: g.label }),
        /* @__PURE__ */ t("div", { className: "flex-1" }),
        /* @__PURE__ */ t(w, { onClick: e.onPoll, disabled: !!e.busy || !e.configured, children: "Poll now" })
      ] }),
      /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        "phase ",
        l.crew_memory.phase,
        " · next: ",
        l.crew_memory.next || "—"
      ] }),
      /* @__PURE__ */ t(pe, { state: l })
    ] }),
    /* @__PURE__ */ t("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: r ? /* @__PURE__ */ t(
      te,
      {
        slotKey: d,
        agent: l.crew.agent,
        frameless: !0,
        startAtBottom: !0,
        placeholder: "Ask the Radar Lead…",
        onSend: v
      },
      d
    ) : /* @__PURE__ */ a("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 10 }, children: [
      l.crew.live ? /* @__PURE__ */ a(C, { children: [
        /* @__PURE__ */ t("p", { className: "text-sm", children: "The Radar Lead session opens on its next turn. Open it now to talk here." }),
        /* @__PURE__ */ t(w, { primary: !0, onClick: e.onStart, disabled: !!e.busy || !e.configured, children: "Open the session" })
      ] }) : /* @__PURE__ */ a("p", { className: "text-sm", children: [
        "The Radar Lead is paused. Turn on ",
        /* @__PURE__ */ t("b", { children: "Crew" }),
        " at the top of the page to triage your channels and talk to it here."
      ] }),
      !e.configured && /* @__PURE__ */ t("p", { className: "text-xs text-muted", children: "Add a channel in Settings first." }),
      o.length > 0 && /* @__PURE__ */ t("ul", { className: "text-xs text-muted flex flex-col gap-1", style: { marginTop: 6 }, children: o.map((h, k) => /* @__PURE__ */ a("li", { children: [
        H(h.at),
        " · ",
        h.text
      ] }, `${h.at}-${k}`)) })
    ] }) }),
    /* @__PURE__ */ t("div", { className: "flex flex-wrap gap-2", style: { padding: "10px 16px 12px", borderTop: "1px solid var(--border)" }, children: re.map((h) => /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        onClick: () => x(h),
        disabled: !r || m,
        style: {
          fontSize: 12,
          border: "1px solid var(--border-strong)",
          borderRadius: 999,
          padding: "4px 10px",
          background: "transparent",
          color: "var(--text)",
          cursor: r && !m ? "pointer" : "not-allowed",
          opacity: r ? 1 : 0.5
        },
        children: h
      },
      h
    )) })
  ] });
}
function xe({ state: e }) {
  return /* @__PURE__ */ a(y, { children: [
    /* @__PURE__ */ t($, { children: "Team" }),
    /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { marginBottom: 8 }, children: "Who works on your channels. Only the Radar Lead has a session; the others run when needed." }),
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: q.map((n) => {
      var d, r;
      const l = B(n, e), s = n.id === "lead" ? e.crew.agent : n.agent;
      return /* @__PURE__ */ a(
        "li",
        {
          className: "flex items-start gap-3",
          style: { padding: "12px 4px", borderTop: "1px solid var(--border)", opacity: n.planned ? 0.7 : 1 },
          children: [
            /* @__PURE__ */ t(X, { m: n, s: e, size: 36 }),
            /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
              /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2", children: [
                /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: n.id === "lead" && e.crew.name || n.title }),
                /* @__PURE__ */ t(_, { variant: "muted", children: n.layer }),
                /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: n.kind })
              ] }),
              /* @__PURE__ */ t("p", { className: "text-sm", style: { margin: "4px 0 0" }, children: n.duty }),
              n.id === "investigator" && (((d = e.investigations) == null ? void 0 : d.items) || 0) > 0 && /* @__PURE__ */ a("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: [
                (r = e.investigations) == null ? void 0 : r.items,
                " item(s) under investigation"
              ] }),
              s && /* @__PURE__ */ t(V, { children: /* @__PURE__ */ a("span", { className: "font-mono", children: [
                "agent: ",
                s,
                n.id === "lead" && e.crew.slot_key ? ` · session: ${e.crew.slot_key}` : ""
              ] }) })
            ] }),
            /* @__PURE__ */ t("span", { className: "text-xs", style: { color: J[l.tone], whiteSpace: "nowrap" }, children: l.label })
          ]
        },
        n.id
      );
    }) })
  ] });
}
function ye({ events: e }) {
  return /* @__PURE__ */ a(y, { children: [
    /* @__PURE__ */ t($, { children: "Activity" }),
    e.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No activity yet." }) : /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", children: e.map((n, l) => /* @__PURE__ */ a("li", { children: [
      /* @__PURE__ */ t("span", { className: "text-muted", children: z(n.at) }),
      " ",
      /* @__PURE__ */ t(_, { variant: "muted", children: n.kind }),
      " ",
      n.text
    ] }, `${n.at}-${l}`)) })
  ] });
}
function fe({
  state: e,
  busy: n,
  act: l,
  mcp: s,
  onProbe: d
}) {
  const r = F(), [m, p] = c(e.settings.channels.join(`
`)), [v, x] = c(e.settings.digest_destination), [o, g] = c(e.settings.slack_login), [h, k] = c(e.settings.slack_mcp_command), [D, P] = c(e.settings.workspace_url), [S, T] = c(String(e.settings.poll_interval_secs)), [A, R] = c(String(e.settings.backfill_hours)), [f, b] = c(e.crew.unattended), [I, L] = c(e.crew.agent), [W, E] = c(e.crew.model), M = () => l(
    "Save settings",
    () => r.put(`${u}/settings`, {
      channels: m.split(/[\s,]+/).map((i) => i.trim()).filter(Boolean),
      digest_destination: v,
      slack_login: o.trim(),
      slack_mcp_command: h.trim(),
      workspace_url: D.trim(),
      poll_interval_secs: Number(S),
      backfill_hours: Number(A)
    })
  );
  return /* @__PURE__ */ a(C, { children: [
    !e.vault_available && /* @__PURE__ */ t(y, { className: "mb-4", children: /* @__PURE__ */ t("p", { className: "text-sm", children: "The gateway secret vault is unavailable, so settings cannot be saved." }) }),
    /* @__PURE__ */ a(y, { className: "mb-4", children: [
      /* @__PURE__ */ t($, { children: "Basics" }),
      /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(ee, { mcp: s, state: e }) }),
        /* @__PURE__ */ t(w, { disabled: !!n, onClick: d, children: "Check connection" })
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
          onChange: (i) => p(i.target.value)
        }
      ),
      /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Digest destination",
          /* @__PURE__ */ a(
            "select",
            {
              className: "block w-full text-sm bg-transparent border rounded px-2 py-1",
              value: v,
              onChange: (i) => x(i.target.value),
              children: [
                /* @__PURE__ */ t("option", { value: "dashboard", children: "Dashboard notification only" }),
                /* @__PURE__ */ t("option", { value: "self_dm", children: "DM to myself in Slack" })
              ]
            }
          )
        ] }),
        v === "self_dm" && /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Your Slack login (for the DM)",
          /* @__PURE__ */ t(N, { value: o, onChange: (i) => g(i.target.value), placeholder: "jdoe" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Poll interval (seconds, 60–3600)",
          /* @__PURE__ */ t(N, { type: "number", min: 60, max: 3600, value: S, onChange: (i) => T(i.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(w, { primary: !0, className: "mt-3", disabled: !!n, onClick: M, children: "Save settings" })
    ] }),
    /* @__PURE__ */ t(y, { children: /* @__PURE__ */ a("details", { children: [
      /* @__PURE__ */ t("summary", { style: { cursor: "pointer", fontWeight: 600, color: "var(--text-strong)" }, children: "Advanced" }),
      /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "MCP server command (a single executable on PATH)",
          /* @__PURE__ */ t(N, { value: h, onChange: (i) => k(i.target.value), placeholder: "ai-community-slack-mcp" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Workspace URL (for permalinks, optional)",
          /* @__PURE__ */ t(N, { value: D, onChange: (i) => P(i.target.value), placeholder: "https://yourteam.slack.com" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "First-poll backfill (hours, 0–168)",
          /* @__PURE__ */ t(N, { type: "number", min: 0, max: 168, value: A, onChange: (i) => R(i.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(w, { className: "mt-3", disabled: !!n, onClick: M, children: "Save settings" }),
      /* @__PURE__ */ a("div", { style: { borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }, children: [
        /* @__PURE__ */ t("div", { className: "text-sm", style: { fontWeight: 600, marginBottom: 8 }, children: "Crew" }),
        /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
          /* @__PURE__ */ a("label", { className: "text-sm", children: [
            "Agent",
            /* @__PURE__ */ t(N, { value: I, onChange: (i) => L(i.target.value), placeholder: "slack-radar-crew" }),
            /* @__PURE__ */ t("span", { className: "block text-xs text-muted mt-1", children: "Default: the shipped slack-radar-crew agent. Your own agents are never modified." })
          ] }),
          /* @__PURE__ */ a("label", { className: "text-sm", children: [
            "Model (empty = agent default)",
            /* @__PURE__ */ t(N, { value: W, onChange: (i) => E(i.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ a("div", { className: "mt-3 flex items-center gap-2", children: [
          /* @__PURE__ */ t(
            G,
            {
              checked: f,
              onChange: b,
              label: "Unattended mode (auto-approve investigator commands)",
              describedBy: "sr-unattended-risk"
            }
          ),
          /* @__PURE__ */ t("span", { className: "text-sm", children: "Unattended mode (auto-approve investigator commands)" })
        ] }),
        /* @__PURE__ */ t("p", { id: "sr-unattended-risk", className: "text-xs text-muted mt-1", children: "Risk: anyone in a watched channel can write text the crew reads, so a crafted message could steer a command nobody reviews." }),
        /* @__PURE__ */ t(
          w,
          {
            primary: !0,
            className: "mt-3",
            disabled: !!n,
            onClick: () => l("Save crew", () => r.put(`${u}/crew`, { agent: I, model: W, unattended: f })),
            children: "Save crew"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  _e as default
};
