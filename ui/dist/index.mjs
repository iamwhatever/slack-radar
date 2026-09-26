import { jsxs as n, Fragment as q, jsx as e } from "react/jsx-runtime";
import { useAppApi as E, ChatEmbed as K } from "@kirocrew/app-sdk";
import { PageHeader as J, Btn as b, StatCard as W, Card as v, CardTitle as w, Badge as p, Input as _, EmptyState as Q, Toggle as X } from "@kirocrew/app-sdk/ui";
import { useState as o, useCallback as O, useEffect as U, useMemo as Z } from "react";
const g = "/api/apps/slack-radar", ee = {
  connected: "connected",
  needs_login: "needs re-login",
  binary_not_found: "binary not found",
  incompatible: "connected, but missing read tools",
  error: "error"
}, F = (t) => t ? new Date(t * 1e3).toLocaleString() : "never";
function H(t) {
  if (!t) return "never";
  const a = Math.max(0, Date.now() / 1e3 - t);
  return a < 90 ? "just now" : a < 3600 ? `${Math.round(a / 60)} min ago` : a < 86400 ? `${Math.round(a / 3600)} h ago` : F(t);
}
const j = [
  {
    id: "lead",
    title: "Radar Lead",
    initials: "RL",
    layer: "Lead",
    kind: "Resident session",
    agent: "slack-radar-crew",
    duty: "Triages every watched channel, sets category and priority, decides when a cluster needs investigating, judges possibly-resolved threads, writes the digest headline, and answers you here."
  },
  {
    id: "investigator",
    title: "Investigator",
    initials: "IN",
    layer: "Research",
    kind: "Leaf (spawned per cluster)",
    agent: "slack-radar-investigator",
    duty: "Searches GitHub read-only for issues and pull requests that match a cluster of reports, and links them in the ledger."
  },
  {
    id: "watcher",
    title: "Thread Watcher",
    initials: "TW",
    layer: "Review",
    kind: "Leaf (planned)",
    agent: "slack-radar-watcher",
    duty: "Will judge batches of possibly-resolved threads so the lead does not have to. Coming in Phase 2; the lead does this today.",
    planned: !0
  },
  {
    id: "poller",
    title: "Poller",
    initials: "⟳",
    layer: "System",
    kind: "Code, no model",
    agent: "",
    duty: "Reads new messages and thread replies through your Slack MCP, flags likely resolutions, and delivers the digest. Spends no credits.",
    planned: !1
  }
];
function C(t, a) {
  var r;
  if (t.id === "lead")
    return a.crew.live ? a.crew.running ? { label: "working", tone: "aim" } : { label: "live", tone: "ok" } : { label: "paused", tone: "muted" };
  if (t.id === "investigator") {
    const l = ((r = a.investigations) == null ? void 0 : r.running) || 0;
    return l ? { label: `${l} running`, tone: "aim" } : { label: "standing by", tone: "muted" };
  }
  return t.id === "watcher" ? { label: "Phase 2", tone: "muted" } : a.source_state === "needs_login" ? { label: "needs re-login", tone: "warn" } : { label: `polled ${H(a.last_poll_at)}`, tone: "muted" };
}
const z = {
  ok: "var(--ok)",
  aim: "var(--aim)",
  warn: "var(--warn)",
  muted: "var(--muted-strong)"
};
function G({ m: t, s: a, selected: r, size: l = 32 }) {
  const c = C(t, a), h = t.planned || t.id === "poller", x = {
    width: l,
    height: l,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    fontWeight: 700,
    position: "relative",
    flex: "none",
    background: h ? "transparent" : "var(--bg-hover)",
    color: h ? "var(--muted)" : "var(--text-strong)",
    border: `2px ${h ? "dashed" : "solid"} ${r ? "var(--accent)" : h ? "var(--border-strong)" : "transparent"}`,
    opacity: t.planned ? 0.6 : 1
  };
  return /* @__PURE__ */ n("span", { style: x, "aria-hidden": !0, children: [
    t.initials,
    !t.planned && /* @__PURE__ */ e(
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
          background: z[c.tone]
        }
      }
    )
  ] });
}
function te(t) {
  return t === "new" ? "warn" : t === "investigating" ? "aim" : t === "resolved" ? "ok" : "muted";
}
function ue() {
  const t = E(), [a, r] = o("board"), [l, c] = o(null), [h, x] = o([]), [f, m] = o([]), [y, s] = o("open"), [u, P] = o(/* @__PURE__ */ new Set()), [D, R] = o(""), [A, S] = o(""), [I, T] = o(null), L = O(async () => {
    try {
      T(await t.get(`${g}/mcp/status`));
    } catch (i) {
      T({ status: "error", command: "", detail: i.message });
    }
  }, [t]);
  U(() => {
    L();
  }, [L]);
  const k = O(async () => {
    try {
      const [i, $, M] = await Promise.all([
        t.get(`${g}/state`),
        t.get(`${g}/items?status=${encodeURIComponent(y)}&limit=300`),
        t.get(`${g}/events?limit=150`)
      ]);
      c(i), x($.items), m(M.events.slice().reverse());
    } catch (i) {
      S(`Could not load: ${i.message}`);
    }
  }, [t, y]);
  U(() => {
    k();
    const i = window.setInterval(k, 3e4);
    return () => window.clearInterval(i);
  }, [k]);
  const N = async (i, $) => {
    R(i), S("");
    try {
      await $(), S(`${i}: done`), await k();
    } catch (M) {
      S(`${i} failed: ${M.message}`);
    } finally {
      R("");
    }
  }, B = !!l && l.settings.channels.length > 0;
  return /* @__PURE__ */ n(q, { children: [
    /* @__PURE__ */ e(
      J,
      {
        title: "Slack Radar",
        subtitle: "A small crew triaging your Slack channels, with a local ledger and a daily digest",
        actions: /* @__PURE__ */ e("div", { className: "flex gap-2", children: ["board", "team", "activity", "settings"].map((i) => /* @__PURE__ */ e(b, { primary: a === i, onClick: () => r(i), "aria-pressed": a === i, children: i[0].toUpperCase() + i.slice(1) }, i)) })
      }
    ),
    /* @__PURE__ */ n("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      A && /* @__PURE__ */ e("p", { role: "status", className: "text-sm text-muted mb-3", children: A }),
      l ? a === "board" ? /* @__PURE__ */ e(
        ae,
        {
          state: l,
          items: h,
          configured: B,
          mcp: I,
          filter: y,
          setFilter: s,
          selected: u,
          setSelected: P,
          busy: D,
          onPoll: () => N("Poll", () => t.post(`${g}/poll`, {})),
          onInvestigate: (i) => N("Investigate", async () => {
            await t.post(`${g}/investigate`, { keys: [...u], repo: i }), P(/* @__PURE__ */ new Set());
          }),
          onStart: () => N("Start crew", () => t.post(`${g}/crew/start`, {})),
          onPause: () => N("Pause crew", () => t.post(`${g}/crew/pause`, {})),
          onDigest: () => N("Request digest", () => t.post(`${g}/digest/request`, {})),
          events: f,
          onChanged: k
        }
      ) : a === "team" ? /* @__PURE__ */ e(re, { state: l }) : a === "activity" ? /* @__PURE__ */ e(ie, { events: f }) : /* @__PURE__ */ e(oe, { state: l, busy: D, act: N, mcp: I, onProbe: L }) : /* @__PURE__ */ e("p", { className: "text-sm text-muted", children: "Loading…" })
    ] })
  ] });
}
function ae(t) {
  const { state: a, items: r, selected: l, setSelected: c } = t, [h, x] = o(""), f = a.counts.open_by_priority, m = (s) => {
    const u = new Set(l);
    u.has(s) ? u.delete(s) : u.add(s), c(u);
  }, y = Z(
    () => a.settings.channels.map((s) => ({ cid: s, ...a.channels[s] || {} })),
    [a]
  );
  return /* @__PURE__ */ n("div", { style: { display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 20, alignItems: "start" }, children: [
    /* @__PURE__ */ n("div", { style: { minWidth: 0 }, children: [
      /* @__PURE__ */ n("div", { className: "grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-6", children: [
        /* @__PURE__ */ e(W, { label: "Awaiting triage", value: a.counts.needs_triage, accent: !0 }),
        /* @__PURE__ */ e(W, { label: "Possibly resolved", value: a.counts.possibly_resolved }),
        /* @__PURE__ */ e(W, { label: "Open p0 / p1", value: `${f.p0 || 0} / ${f.p1 || 0}` }),
        /* @__PURE__ */ e(W, { label: "Tracked items", value: a.counts.total })
      ] }),
      /* @__PURE__ */ e(V, { mcp: t.mcp, sourceState: a.source_state, sourceError: a.source_error }),
      !t.configured && /* @__PURE__ */ n(v, { className: "mb-4", children: [
        /* @__PURE__ */ e(w, { children: "Finish setup" }),
        /* @__PURE__ */ e("p", { className: "text-sm text-muted", children: "Add at least one channel ID in Settings. Slack Radar reads with your own Slack identity through your Slack MCP, so there is no bot to invite." })
      ] }),
      /* @__PURE__ */ e(ne, { state: a, busy: t.busy, onDigest: t.onDigest }),
      /* @__PURE__ */ n(v, { className: "mb-4", children: [
        /* @__PURE__ */ e(w, { children: "Channels" }),
        y.length === 0 ? /* @__PURE__ */ e("p", { className: "text-sm text-muted", children: "No channels configured." }) : /* @__PURE__ */ n("table", { className: "w-full text-sm", children: [
          /* @__PURE__ */ e("thead", { children: /* @__PURE__ */ n("tr", { className: "text-left text-muted", children: [
            /* @__PURE__ */ e("th", { scope: "col", children: "Channel" }),
            /* @__PURE__ */ e("th", { scope: "col", children: "Last polled" }),
            /* @__PURE__ */ e("th", { scope: "col", children: "Status" })
          ] }) }),
          /* @__PURE__ */ e("tbody", { children: y.map((s) => /* @__PURE__ */ n("tr", { children: [
            /* @__PURE__ */ e("td", { className: "font-mono", children: s.cid }),
            /* @__PURE__ */ e("td", { children: F(s.last_polled_at) }),
            /* @__PURE__ */ e("td", { children: s.last_error ? /* @__PURE__ */ e(p, { variant: "err", children: s.last_error }) : /* @__PURE__ */ e(p, { variant: "ok", children: "ok" }) })
          ] }, s.cid)) })
        ] })
      ] }),
      /* @__PURE__ */ n(v, { children: [
        /* @__PURE__ */ n("div", { className: "flex flex-wrap items-center gap-2 mb-3", children: [
          /* @__PURE__ */ e(w, { children: "Ledger" }),
          /* @__PURE__ */ e("label", { className: "text-sm text-muted", htmlFor: "sr-filter", children: "Show" }),
          /* @__PURE__ */ n(
            "select",
            {
              id: "sr-filter",
              className: "text-sm bg-transparent border rounded px-2 py-1",
              value: t.filter,
              onChange: (s) => t.setFilter(s.target.value),
              children: [
                /* @__PURE__ */ e("option", { value: "open", children: "open" }),
                /* @__PURE__ */ e("option", { value: "new", children: "new" }),
                /* @__PURE__ */ e("option", { value: "triaged", children: "triaged" }),
                /* @__PURE__ */ e("option", { value: "investigating", children: "investigating" }),
                /* @__PURE__ */ e("option", { value: "resolved", children: "resolved" }),
                /* @__PURE__ */ e("option", { value: "noise", children: "noise" }),
                /* @__PURE__ */ e("option", { value: "", children: "all" })
              ]
            }
          ),
          /* @__PURE__ */ e("div", { className: "flex-1" }),
          /* @__PURE__ */ e(
            _,
            {
              "aria-label": "GitHub repository to search (owner/name, optional)",
              placeholder: "owner/repo (optional)",
              value: h,
              onChange: (s) => x(s.target.value),
              className: "w-48"
            }
          ),
          /* @__PURE__ */ n(b, { onClick: () => t.onInvestigate(h), disabled: l.size === 0 || !!t.busy, children: [
            "Investigate ",
            l.size || ""
          ] })
        ] }),
        r.length === 0 ? /* @__PURE__ */ e(Q, { icon: /* @__PURE__ */ e("span", { "aria-hidden": !0, children: "📡" }), title: "Nothing here yet", subtitle: "New messages appear after the next poll." }) : /* @__PURE__ */ e("ul", { className: "flex flex-col gap-2", children: r.map((s) => /* @__PURE__ */ n("li", { className: "border rounded p-2 text-sm", children: [
          /* @__PURE__ */ n("div", { className: "flex flex-wrap items-center gap-2", children: [
            /* @__PURE__ */ e(
              "input",
              {
                type: "checkbox",
                "aria-label": `Select ${s.key} for investigation`,
                checked: l.has(s.key),
                onChange: () => m(s.key)
              }
            ),
            /* @__PURE__ */ e(p, { variant: te(s.status), children: s.status }),
            s.priority && /* @__PURE__ */ e(p, { variant: s.priority === "p0" || s.priority === "p1" ? "err" : "muted", children: s.priority }),
            s.category && /* @__PURE__ */ e(p, { variant: "muted", children: s.category }),
            s.possibly_resolved && /* @__PURE__ */ n(p, { variant: "warn", children: [
              "possibly resolved: ",
              s.possibly_resolved.reason
            ] }),
            /* @__PURE__ */ e("span", { className: "text-muted font-mono", children: s.channel }),
            /* @__PURE__ */ e("a", { className: "underline", href: s.permalink, target: "_blank", rel: "noreferrer noopener", children: "open in Slack" }),
            s.reply_count > 0 && /* @__PURE__ */ n("span", { className: "text-muted", children: [
              s.reply_count,
              " replies"
            ] })
          ] }),
          /* @__PURE__ */ e("p", { className: "mt-1", children: s.summary || s.text.slice(0, 280) }),
          s.links.length > 0 && /* @__PURE__ */ n("p", { className: "mt-1 text-muted", children: [
            "Linked:",
            " ",
            s.links.map((u) => /* @__PURE__ */ e("a", { className: "underline mr-2", href: u, target: "_blank", rel: "noreferrer noopener", children: u.replace("https://github.com/", "") }, u))
          ] }),
          s.note && /* @__PURE__ */ e("p", { className: "mt-1 text-xs text-muted", children: s.note })
        ] }, s.key)) })
      ] })
    ] }),
    /* @__PURE__ */ e(
      le,
      {
        state: a,
        events: t.events,
        configured: t.configured,
        busy: t.busy,
        onStart: t.onStart,
        onPause: t.onPause,
        onPoll: t.onPoll,
        onChanged: t.onChanged
      }
    )
  ] });
}
function ne({ state: t, busy: a, onDigest: r }) {
  const l = t.digest, c = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), h = l.last_posted_date === c;
  return /* @__PURE__ */ n(v, { className: "mb-4", children: [
    /* @__PURE__ */ n("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ e(w, { children: h ? "Today's digest" : "Latest digest" }),
      l.pending ? /* @__PURE__ */ e(p, { variant: "aim", children: "being delivered" }) : null,
      /* @__PURE__ */ e("span", { className: "text-xs text-muted", children: l.last_posted_date ? `${l.last_posted_date} · ${t.settings.digest_destination === "self_dm" ? "DMed to you" : "dashboard notification"}` : "none yet" }),
      /* @__PURE__ */ e("div", { className: "flex-1" }),
      /* @__PURE__ */ e(b, { onClick: r, disabled: !!a || !t.crew.live, children: "Request digest" })
    ] }),
    l.last_text ? /* @__PURE__ */ e("pre", { className: "whitespace-pre-wrap text-sm mt-2", style: { fontFamily: "inherit", margin: "8px 0 0" }, children: l.last_text }) : /* @__PURE__ */ e("p", { className: "text-sm text-muted mt-2", children: "The Radar Lead writes one after the daily cron or when you press Request digest." }),
    l.last_error && /* @__PURE__ */ e("p", { className: "text-xs mt-1", style: { color: "var(--danger)" }, children: l.last_error })
  ] });
}
function se({ state: t }) {
  return /* @__PURE__ */ e("div", { className: "flex items-center gap-2", style: { marginTop: 10 }, children: j.map((a) => /* @__PURE__ */ n("span", { title: `${a.title} · ${C(a, t).label}`, children: [
    /* @__PURE__ */ e(G, { m: a, s: t, selected: a.id === "lead", size: 30 }),
    /* @__PURE__ */ e("span", { className: "sr-only", children: `${a.title}: ${C(a, t).label}` })
  ] }, a.id)) });
}
function le(t) {
  const a = E(), { state: r } = t, l = j[0], c = r.crew.slot_key, h = r.crew.live && r.crew.session_open && r.crew.session_agent === r.crew.agent, x = async (m) => {
    await a.post(`${g}/crew/message`, { message: m }), t.onChanged();
  }, f = t.events.filter((m) => m.kind === "crew" || m.kind === "digest").slice(0, 5);
  return /* @__PURE__ */ n(v, { style: { position: "sticky", top: 0, padding: 0, display: "flex", flexDirection: "column", height: "min(760px, calc(100vh - 140px))", overflow: "hidden" }, children: [
    /* @__PURE__ */ n("div", { style: { padding: "14px 16px", borderBottom: "1px solid var(--border)" }, children: [
      /* @__PURE__ */ n("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ e("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: r.crew.name || l.title }),
        /* @__PURE__ */ e(p, { variant: C(l, r).tone === "muted" ? "muted" : C(l, r).tone === "aim" ? "aim" : "ok", children: C(l, r).label }),
        /* @__PURE__ */ e("div", { className: "flex-1" }),
        r.crew.live ? /* @__PURE__ */ e(b, { onClick: t.onPause, disabled: !!t.busy, children: "Pause" }) : null,
        /* @__PURE__ */ e(b, { onClick: t.onPoll, disabled: !!t.busy || !t.configured, children: "Poll now" })
      ] }),
      /* @__PURE__ */ n("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        "phase ",
        r.crew_memory.phase,
        " · next: ",
        r.crew_memory.next || "—"
      ] }),
      /* @__PURE__ */ e(se, { state: r })
    ] }),
    /* @__PURE__ */ e("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: h ? /* @__PURE__ */ e(
      K,
      {
        slotKey: c,
        agent: r.crew.agent,
        frameless: !0,
        startAtBottom: !0,
        placeholder: "Ask the Radar Lead…",
        onSend: x
      },
      c
    ) : /* @__PURE__ */ n("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 10 }, children: [
      /* @__PURE__ */ e("p", { className: "text-sm", children: r.crew.live ? "The Radar Lead session opens on its next turn. Start it now to talk here." : "The Radar Lead is paused. Start the crew to triage your channels and talk to it here." }),
      /* @__PURE__ */ e(b, { primary: !0, onClick: t.onStart, disabled: !!t.busy || !t.configured, children: r.crew.live ? "Open the session" : "Start crew" }),
      !t.configured && /* @__PURE__ */ e("p", { className: "text-xs text-muted", children: "Add a channel in Settings first." }),
      f.length > 0 && /* @__PURE__ */ e("ul", { className: "text-xs text-muted flex flex-col gap-1", style: { marginTop: 6 }, children: f.map((m, y) => /* @__PURE__ */ n("li", { children: [
        H(m.at),
        " · ",
        m.text
      ] }, `${m.at}-${y}`)) })
    ] }) })
  ] });
}
function re({ state: t }) {
  return /* @__PURE__ */ n(v, { children: [
    /* @__PURE__ */ e(w, { children: "Team" }),
    /* @__PURE__ */ e("p", { className: "text-sm text-muted", style: { marginBottom: 8 }, children: "Who works on your channels. Only the Radar Lead has a session; the others run when needed." }),
    /* @__PURE__ */ e("ul", { className: "flex flex-col", children: j.map((a) => {
      var l, c;
      const r = C(a, t);
      return /* @__PURE__ */ n(
        "li",
        {
          className: "flex items-start gap-3",
          style: { padding: "12px 4px", borderTop: "1px solid var(--border)", opacity: a.planned ? 0.7 : 1 },
          children: [
            /* @__PURE__ */ e(G, { m: a, s: t, size: 36 }),
            /* @__PURE__ */ n("div", { style: { minWidth: 0, flex: 1 }, children: [
              /* @__PURE__ */ n("div", { className: "flex flex-wrap items-center gap-2", children: [
                /* @__PURE__ */ e("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: a.id === "lead" && t.crew.name || a.title }),
                /* @__PURE__ */ e(p, { variant: "muted", children: a.layer }),
                /* @__PURE__ */ e("span", { className: "text-xs text-muted", children: a.kind }),
                a.agent && /* @__PURE__ */ e("span", { className: "text-xs text-muted font-mono", children: a.id === "lead" ? t.crew.agent : a.agent })
              ] }),
              /* @__PURE__ */ e("p", { className: "text-sm", style: { margin: "4px 0 0" }, children: a.duty }),
              a.id === "investigator" && (((l = t.investigations) == null ? void 0 : l.items) || 0) > 0 && /* @__PURE__ */ n("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: [
                (c = t.investigations) == null ? void 0 : c.items,
                " item(s) under investigation"
              ] })
            ] }),
            /* @__PURE__ */ e("span", { className: "text-xs", style: { color: z[r.tone], whiteSpace: "nowrap" }, children: r.label })
          ]
        },
        a.id
      );
    }) })
  ] });
}
function V({ mcp: t, sourceState: a, sourceError: r }) {
  const l = a === "needs_login" ? "needs_login" : (t == null ? void 0 : t.status) || "checking";
  return /* @__PURE__ */ n("p", { role: "status", className: "text-sm mb-4 flex flex-wrap items-center gap-2", children: [
    /* @__PURE__ */ e("span", { children: "Slack MCP:" }),
    /* @__PURE__ */ e(p, { variant: l === "connected" ? "ok" : l === "checking" ? "muted" : "err", children: ee[l] || l }),
    (t == null ? void 0 : t.command) && /* @__PURE__ */ e("span", { className: "font-mono text-muted", children: t.command }),
    l === "needs_login" && /* @__PURE__ */ e("span", { className: "text-muted", children: "Re-authenticate your Slack MCP (e.g. refresh its browser/Midway login). Polling resumes on the next cycle." }),
    l !== "connected" && (r || (t == null ? void 0 : t.detail)) && /* @__PURE__ */ e("span", { className: "text-muted", children: r || (t == null ? void 0 : t.detail) })
  ] });
}
function ie({ events: t }) {
  return /* @__PURE__ */ n(v, { children: [
    /* @__PURE__ */ e(w, { children: "Activity" }),
    t.length === 0 ? /* @__PURE__ */ e("p", { className: "text-sm text-muted", children: "No activity yet." }) : /* @__PURE__ */ e("ul", { className: "text-sm flex flex-col gap-1", children: t.map((a, r) => /* @__PURE__ */ n("li", { children: [
      /* @__PURE__ */ e("span", { className: "text-muted", children: F(a.at) }),
      " ",
      /* @__PURE__ */ e(p, { variant: "muted", children: a.kind }),
      " ",
      a.text
    ] }, `${a.at}-${r}`)) })
  ] });
}
function oe({
  state: t,
  busy: a,
  act: r,
  mcp: l,
  onProbe: c
}) {
  const h = E(), [x, f] = o(t.settings.channels.join(`
`)), [m, y] = o(t.settings.digest_destination), [s, u] = o(t.settings.slack_login), [P, D] = o(t.settings.slack_mcp_command), [R, A] = o(t.settings.workspace_url), [S, I] = o(String(t.settings.poll_interval_secs)), [T, L] = o(String(t.settings.backfill_hours)), [k, N] = o(t.crew.unattended), [B, i] = o(t.crew.agent), [$, M] = o(t.crew.model), Y = () => r(
    "Save settings",
    () => h.put(`${g}/settings`, {
      channels: x.split(/[\s,]+/).map((d) => d.trim()).filter(Boolean),
      digest_destination: m,
      slack_login: s.trim(),
      slack_mcp_command: P.trim(),
      workspace_url: R.trim(),
      poll_interval_secs: Number(S),
      backfill_hours: Number(T)
    })
  );
  return /* @__PURE__ */ n(q, { children: [
    !t.vault_available && /* @__PURE__ */ e(v, { className: "mb-4", children: /* @__PURE__ */ e("p", { className: "text-sm", children: "The gateway secret vault is unavailable, so settings cannot be saved." }) }),
    /* @__PURE__ */ n(v, { className: "mb-4", children: [
      /* @__PURE__ */ e(w, { children: "Slack MCP" }),
      /* @__PURE__ */ e(V, { mcp: l, sourceState: t.source_state, sourceError: t.source_error }),
      /* @__PURE__ */ n("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "MCP server command (a single executable on PATH)",
          /* @__PURE__ */ e(_, { value: P, onChange: (d) => D(d.target.value), placeholder: "ai-community-slack-mcp" })
        ] }),
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "Workspace URL (for permalinks, optional)",
          /* @__PURE__ */ e(_, { value: R, onChange: (d) => A(d.target.value), placeholder: "https://yourteam.slack.com" })
        ] })
      ] }),
      /* @__PURE__ */ e("p", { className: "text-xs text-muted mt-2", children: "Slack is read with your own identity through this MCP server: read-only tools only, no bot, no invite. The one write is the optional digest DM to yourself." }),
      /* @__PURE__ */ e(b, { className: "mt-2", disabled: !!a, onClick: c, children: "Check connection" })
    ] }),
    /* @__PURE__ */ n(v, { className: "mb-4", children: [
      /* @__PURE__ */ e(w, { children: "Channels and digest" }),
      /* @__PURE__ */ e("label", { className: "block text-sm mb-1", htmlFor: "sr-channels", children: "Channel IDs to watch (one per line; e.g. C0123ABCD). Any channel you can read works." }),
      /* @__PURE__ */ e(
        "textarea",
        {
          id: "sr-channels",
          className: "w-full font-mono text-sm border rounded p-2 bg-transparent",
          rows: 5,
          value: x,
          onChange: (d) => f(d.target.value)
        }
      ),
      /* @__PURE__ */ n("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "Digest destination",
          /* @__PURE__ */ n(
            "select",
            {
              className: "block w-full text-sm bg-transparent border rounded px-2 py-1",
              value: m,
              onChange: (d) => y(d.target.value),
              children: [
                /* @__PURE__ */ e("option", { value: "dashboard", children: "Dashboard notification only" }),
                /* @__PURE__ */ e("option", { value: "self_dm", children: "DM to myself (self_dm)" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "Your Slack login (for the self-DM)",
          /* @__PURE__ */ e(_, { value: s, onChange: (d) => u(d.target.value), placeholder: "jdoe" })
        ] }),
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "Poll interval (seconds, 60–3600)",
          /* @__PURE__ */ e(_, { type: "number", min: 60, max: 3600, value: S, onChange: (d) => I(d.target.value) })
        ] }),
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "First-poll backfill (hours, 0–168)",
          /* @__PURE__ */ e(_, { type: "number", min: 0, max: 168, value: T, onChange: (d) => L(d.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ e(b, { primary: !0, className: "mt-3", disabled: !!a, onClick: Y, children: "Save settings" })
    ] }),
    /* @__PURE__ */ n(v, { children: [
      /* @__PURE__ */ e(w, { children: "Crew" }),
      /* @__PURE__ */ n("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "Agent",
          /* @__PURE__ */ e(_, { value: B, onChange: (d) => i(d.target.value), placeholder: "slack-radar-crew" }),
          /* @__PURE__ */ e("span", { className: "block text-xs text-muted mt-1", children: "Default: the shipped slack-radar-crew agent, which already carries the ledger tools. Your own agents are never modified." })
        ] }),
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "Model (empty = agent default)",
          /* @__PURE__ */ e(_, { value: $, onChange: (d) => M(d.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ n("div", { className: "mt-3", children: [
        /* @__PURE__ */ e(X, { checked: k, onChange: N, label: "Auto-approve the crew's tool calls (unattended)" }),
        /* @__PURE__ */ e("p", { className: "text-xs text-muted mt-1", children: "The crew reads messages anyone in your channels can write. With auto-approve on, a crafted message can steer an unreviewed tool call. Leave it off unless every watched channel is trusted." })
      ] }),
      /* @__PURE__ */ e(
        b,
        {
          primary: !0,
          className: "mt-3",
          disabled: !!a,
          onClick: () => r("Save crew", () => h.put(`${g}/crew`, { agent: B, model: $, unattended: k })),
          children: "Save crew"
        }
      )
    ] })
  ] });
}
export {
  ue as default
};
