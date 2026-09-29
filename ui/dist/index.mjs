import { jsxs as a, Fragment as R, jsx as t } from "react/jsx-runtime";
import * as he from "@kirocrew/app-sdk";
import { useAppApi as X, ChatEmbed as Ie } from "@kirocrew/app-sdk";
import { PageHeader as Le, Toggle as ge, Btn as f, Card as M, CardTitle as U, StatCard as te, Input as E, EmptyState as Be, Badge as z } from "@kirocrew/app-sdk/ui";
import { useState as c, useCallback as ie, useEffect as J, useRef as re, useMemo as xe } from "react";
const w = "/api/apps/slack-radar", Fe = {
  checking: "checking…",
  connected: "connected",
  needs_login: "sign in again",
  binary_not_found: "not installed",
  incompatible: "missing read access",
  error: "not working"
}, me = ["What needs me today?", "Draft today's digest", "Which threads look resolved?"], Me = [
  { id: "board", label: "Board" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" }
], le = (e) => e ? new Date(e * 1e3).toLocaleString() : "never";
function G(e) {
  if (!e) return "never";
  const n = Math.max(0, Date.now() / 1e3 - e);
  return n < 90 ? "just now" : n < 3600 ? `${Math.round(n / 60)} min ago` : n < 86400 ? `${Math.round(n / 3600)} h ago` : le(e);
}
function ye(e, n) {
  return n === "needs_login" ? "needs_login" : (e == null ? void 0 : e.status) || "checking";
}
function fe({ children: e, summary: n = "Details" }) {
  return /* @__PURE__ */ a("details", { className: "text-xs text-muted", style: { marginTop: 6 }, children: [
    /* @__PURE__ */ t("summary", { style: { cursor: "pointer" }, children: n }),
    /* @__PURE__ */ t("div", { style: { marginTop: 4 }, children: e })
  ] });
}
const Z = [
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
], ae = (e, n) => {
  var s;
  return (s = e.now) == null ? void 0 : s.members.find((i) => i.id === n);
};
function Q(e, n) {
  var l;
  const s = ae(n, e.id);
  if (e.id === "lead")
    return (s == null ? void 0 : s.state) === "paused" || !n.crew.live ? { label: "paused", tone: "muted" } : (s ? s.state === "working" : n.crew.running) ? { label: "working", tone: "aim" } : { label: "live", tone: "ok" };
  if (e.id === "poller")
    return n.source_state === "needs_login" ? { label: "sign in again", tone: "warn" } : (s == null ? void 0 : s.state) === "paused" ? { label: "paused", tone: "warn" } : { label: `polled ${G(n.last_poll_at)}`, tone: "muted" };
  const i = s ? s.count : e.id === "investigator" && ((l = n.investigations) == null ? void 0 : l.running) || 0;
  return i ? { label: `${i} running`, tone: "aim" } : (s == null ? void 0 : s.state) === "planned" ? { label: "not started yet", tone: "muted" } : { label: "idle", tone: "muted" };
}
function Pe(e) {
  if (!e) return "";
  const n = Math.max(0, Math.round(Date.now() / 1e3 - e));
  return n < 90 ? `${n}s` : n < 90 * 60 ? `${Math.round(n / 60)}m` : `${Math.round(n / 3600)}h`;
}
const Oe = (e, n = 60) => e.length > n ? `${e.slice(0, n - 1).trimEnd()}…` : e;
function Ee(e, n) {
  const s = ae(n, e.id);
  return s ? e.id === "poller" ? s.doing : s.state !== "working" ? s.state === "paused" ? `paused: ${s.doing}` : Q(e, n).label : e.id === "lead" ? `working: ${s.doing}` : `${s.count} running: ${s.doing}` : Q(e, n).label;
}
const ze = `@keyframes slack-radar-pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.7) } }
.sr-pulse { animation: slack-radar-pulse 1.4s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .sr-pulse { animation: none } }`;
function ve({ tone: e, pulse: n }) {
  return /* @__PURE__ */ t(
    "i",
    {
      "aria-hidden": !0,
      className: n ? "sr-pulse" : void 0,
      style: { width: 8, height: 8, borderRadius: "50%", flex: "none", display: "inline-block", background: we[e] }
    }
  );
}
function be({ m: e, state: n, withName: s = !0, onOpen: i }) {
  const l = Q(e, n), o = ae(n, e.id), u = o ? o.state === "working" : l.tone === "aim", h = Ee(e, n), y = e.id === "lead" && n.crew.name || e.title, k = /* @__PURE__ */ a(R, { children: [
    /* @__PURE__ */ t(ve, { tone: l.tone, pulse: u }),
    s && /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: y }),
    /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: Oe(h) })
  ] }), v = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    fontSize: 13,
    opacity: u || l.tone === "warn" ? 1 : 0.6,
    color: "var(--text)"
  }, S = { title: `${y} · ${h}`, "data-member": e.id, "data-state": (o == null ? void 0 : o.state) || (u ? "working" : "idle") };
  return i ? /* @__PURE__ */ t(
    "button",
    {
      type: "button",
      onClick: i,
      ...S,
      "aria-label": `${y}: ${h}. Show activity`,
      style: { ...v, background: "transparent", border: 0, padding: 0, cursor: "pointer" },
      children: k
    }
  ) : /* @__PURE__ */ t("span", { ...S, style: v, children: k });
}
function je({ state: e, onOpenActivity: n }) {
  return /* @__PURE__ */ a(
    "div",
    {
      "data-testid": "now-strip",
      role: "status",
      "aria-label": "Who is working right now",
      className: "flex flex-wrap items-center",
      style: { gap: "6px 18px", padding: "8px 12px", marginBottom: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-elevated)", minWidth: 0 },
      children: [
        /* @__PURE__ */ t("span", { className: "text-xs text-muted", style: { fontWeight: 600, letterSpacing: ".04em" }, children: "NOW" }),
        Z.map((s) => /* @__PURE__ */ t(
          be,
          {
            m: s,
            state: e,
            onOpen: s.id === "investigator" || s.id === "watcher" ? n : void 0
          },
          s.id
        ))
      ]
    }
  );
}
function Ue({ state: e }) {
  const n = Z.filter((s) => s.id === "investigator" || s.id === "watcher").map((s) => ({ m: s, row: ae(e, s.id) })).filter(({ row: s }) => (s == null ? void 0 : s.state) === "working");
  return n.length ? /* @__PURE__ */ t("div", { "data-testid": "chat-running", style: { padding: "6px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" }, children: n.map(({ m: s, row: i }) => {
    const l = Pe(i.since), o = `${s.title} running${i.count > 1 ? ` (${i.count})` : ""} · ${i.doing}${l ? ` · ${l}` : ""}`;
    return /* @__PURE__ */ a("div", { className: "text-xs flex items-center gap-2", title: o, style: { minWidth: 0 }, children: [
      /* @__PURE__ */ t(ve, { tone: "aim", pulse: !0 }),
      /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: o })
    ] }, s.id);
  }) }) : null;
}
const we = {
  ok: "var(--ok)",
  aim: "var(--aim)",
  warn: "var(--warn)",
  muted: "var(--muted-strong)"
};
function oe({ m: e, s: n, selected: s, size: i = 32 }) {
  const l = Q(e, n), o = e.planned || e.id === "poller", u = {
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
    border: `2px ${o ? "dashed" : "solid"} ${s ? "var(--accent)" : o ? "var(--border-strong)" : "transparent"}`,
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
          background: we[l.tone]
        }
      }
    )
  ] });
}
function Ke(e) {
  return e === "new" ? "warn" : e === "investigating" ? "aim" : e === "resolved" ? "ok" : "muted";
}
function He({ tab: e, setTab: n }) {
  return /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Slack Radar sections", style: { display: "flex", gap: 4 }, children: Me.map((s) => {
    const i = e === s.id;
    return /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": i,
        onClick: () => n(s.id),
        style: {
          padding: "6px 12px",
          borderRadius: 8,
          border: 0,
          cursor: "pointer",
          fontSize: 14,
          background: i ? "var(--bg-hover)" : "transparent",
          color: i ? "var(--text-strong)" : "var(--muted)"
        },
        children: s.label
      },
      s.id
    );
  }) });
}
function Ge({
  state: e,
  configured: n,
  busy: s,
  onStart: i,
  onPause: l
}) {
  const o = e.crew.live;
  return /* @__PURE__ */ a("div", { className: "flex items-center gap-2", title: !o && !n ? "Add a channel in Settings first" : void 0, children: [
    /* @__PURE__ */ t("span", { className: "text-sm", children: "Crew" }),
    /* @__PURE__ */ t(
      ge,
      {
        checked: o,
        disabled: !!s || !o && !n,
        onChange: (h) => h ? i() : l(),
        label: o ? "Pause the crew" : "Start the crew"
      }
    ),
    /* @__PURE__ */ a("span", { className: "text-xs text-muted", title: "Whether the crew's commands run without asking you", children: [
      "Unattended: ",
      e.crew.trusted ? "on" : "off"
    ] })
  ] });
}
function ut() {
  const e = X(), [n, s] = c("board"), [i, l] = c(null), [o, u] = c([]), [h, y] = c(null), [k, v] = c([]), [S, _] = c([]), [$, D] = c("open"), [W, d] = c(/* @__PURE__ */ new Set()), [x, b] = c(""), [T, A] = c(""), [I, P] = c(null), [g, L] = c(null), [r, m] = c(null), p = ie(async () => {
    try {
      P(await e.get(`${w}/mcp/status`));
    } catch (C) {
      P({ status: "error", command: "", detail: C.message });
    }
  }, [e]);
  J(() => {
    p();
  }, [p]);
  const N = ie(async () => {
    var C;
    try {
      const [j, V, ee, H, Ae] = await Promise.all([
        e.get(`${w}/state`),
        e.get(`${w}/items?status=${encodeURIComponent($)}&limit=300`),
        e.get(`${w}/events?limit=150`),
        e.get(`${w}/needs`),
        e.get(`${w}/items?handled=1&limit=100`)
      ]);
      l(j), L(((C = j.now) == null ? void 0 : C.members) || null), u(V.items), y(H), v(Ae.items), _(ee.events.slice().reverse());
    } catch (j) {
      A(`Could not load: ${j.message}`);
    }
  }, [e, $]);
  J(() => {
    N();
    const C = window.setInterval(N, 3e4);
    return () => window.clearInterval(C);
  }, [N]);
  const B = !!(g != null && g.some((C) => C.state === "working")), Y = re("");
  J(() => {
    if (!B) return;
    const C = async () => {
      try {
        const V = await e.get(`${w}/now`);
        L(V.members);
        const ee = V.members.map((H) => `${H.id}:${H.state}:${H.count}`).join(",");
        if (Y.current && ee !== Y.current) {
          const H = await e.get(`${w}/events?limit=150`);
          _(H.events.slice().reverse());
        }
        Y.current = ee;
      } catch {
      }
    }, j = window.setInterval(C, 5e3);
    return () => window.clearInterval(j);
  }, [B, e]);
  const O = xe(() => i && g ? { ...i, now: { members: g } } : i, [i, g]), Te = () => {
    m(["member", "crew", "investigate"]), s("activity");
  }, K = async (C, j) => {
    b(C), A("");
    try {
      await j(), A(`${C}: done`), await N();
    } catch (V) {
      A(`${C} failed: ${V.message}`);
    } finally {
      b("");
    }
  }, ce = !!i && i.settings.channels.length > 0, se = (i == null ? void 0 : i.settings.channels.length) || 0, Re = i ? `${se ? `Watching ${se} channel${se === 1 ? "" : "s"}` : "No channels yet"} · ${i.crew.live ? "running" : "paused"}` : "A small crew triaging your Slack channels", We = i ? ye(I, i.source_state) : "checking", De = () => {
    p(), N();
  };
  return /* @__PURE__ */ a(R, { children: [
    /* @__PURE__ */ t(
      Le,
      {
        title: "Slack Radar",
        subtitle: Re,
        actions: /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-4", children: [
          /* @__PURE__ */ t(
            He,
            {
              tab: n,
              setTab: (C) => {
                m(null), s(C);
              }
            }
          ),
          i && /* @__PURE__ */ t(
            Ge,
            {
              state: i,
              configured: ce,
              busy: x,
              onStart: () => K("Start crew", () => e.post(`${w}/crew/start`, {})),
              onPause: () => K("Pause crew", () => e.post(`${w}/crew/pause`, {}))
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ t("style", { children: ze }),
    /* @__PURE__ */ a("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      O && n === "board" && /* @__PURE__ */ t(je, { state: O, onOpenActivity: Te }),
      i && We === "needs_login" && /* @__PURE__ */ t(Je, { mcp: I, sourceError: i.source_error, busy: x, onCheck: De }),
      T && /* @__PURE__ */ t("p", { role: "status", className: "text-sm text-muted mb-3", children: T }),
      O ? n === "board" ? /* @__PURE__ */ t(
        Qe,
        {
          state: O,
          items: o,
          needs: h,
          handled: k,
          configured: ce,
          mcp: I,
          filter: $,
          setFilter: D,
          selected: W,
          setSelected: d,
          busy: x,
          onPoll: () => K("Poll", () => e.post(`${w}/poll`, {})),
          onInvestigate: (C) => K("Investigate", async () => {
            await e.post(`${w}/investigate`, { keys: [...W], repo: C }), d(/* @__PURE__ */ new Set());
          }),
          onStart: () => K("Start crew", () => e.post(`${w}/crew/start`, {})),
          onDigest: () => K("Request digest", () => e.post(`${w}/digest/request`, {})),
          events: S,
          onChanged: N
        }
      ) : n === "team" ? /* @__PURE__ */ t(rt, { state: O }) : n === "activity" ? /* @__PURE__ */ t(lt, { events: S, kinds: r, onShowAll: () => m(null) }) : /* @__PURE__ */ t(ot, { state: O, busy: x, act: K, mcp: I, onProbe: p }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" })
    ] })
  ] });
}
function ke({ mcp: e, sourceError: n }) {
  var i;
  const s = [
    (e == null ? void 0 : e.status) && `status: ${e.status}`,
    (e == null ? void 0 : e.command) && `command: ${e.command}`,
    n && `error: ${n}`,
    (e == null ? void 0 : e.detail) && e.detail !== n && `detail: ${e.detail}`,
    ((i = e == null ? void 0 : e.missing_read_tools) == null ? void 0 : i.length) && `missing read tools: ${e.missing_read_tools.join(", ")}`
  ].filter(Boolean);
  return s.length ? /* @__PURE__ */ t(fe, { children: /* @__PURE__ */ t("pre", { className: "font-mono whitespace-pre-wrap", style: { margin: 0 }, children: s.join(`
`) }) }) : null;
}
function Je({ mcp: e, sourceError: n, busy: s, onCheck: i }) {
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
          /* @__PURE__ */ t(f, { primary: !0, onClick: i, disabled: !!s, children: "I signed in, check again" })
        ] }),
        /* @__PURE__ */ t(ke, { mcp: e, sourceError: n })
      ]
    }
  );
}
function Ne({ mcp: e, state: n, withPoll: s }) {
  const i = ye(e, n.source_state), l = i === "connected";
  return /* @__PURE__ */ a("div", { className: "mb-4", children: [
    /* @__PURE__ */ a("p", { role: "status", className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { margin: 0 }, children: [
      /* @__PURE__ */ t("span", { "aria-hidden": !0, style: { width: 8, height: 8, borderRadius: "50%", background: l ? "var(--ok)" : i === "checking" ? "var(--muted-strong)" : "var(--warn)", display: "inline-block" } }),
      /* @__PURE__ */ a("span", { children: [
        "Slack connection: ",
        /* @__PURE__ */ t("span", { style: { color: l ? "var(--text)" : "var(--warn)" }, children: Fe[i] || i })
      ] }),
      s && /* @__PURE__ */ a("span", { children: [
        "· last poll ",
        G(n.last_poll_at),
        n.settings.channels.length > 0 && /* @__PURE__ */ a(R, { children: [
          " · watching ",
          n.settings.channels.join(", ")
        ] })
      ] })
    ] }),
    !l && i !== "needs_login" && /* @__PURE__ */ t(ke, { mcp: e, sourceError: n.source_error })
  ] });
}
function Qe(e) {
  const { state: n, items: s, selected: i, setSelected: l } = e, [o, u] = c(""), [h, y] = c(""), [k, v] = st(n.crew.slot_key), S = re(null), _ = n.counts.open_by_priority, $ = (d) => {
    const x = new Set(i);
    x.has(d) ? x.delete(d) : x.add(d), l(x);
  }, D = xe(
    () => n.settings.channels.map((d) => ({ cid: d, ...n.channels[d] || {} })),
    [n]
  ), W = (d) => {
    y(Ve(d)), v(!0), window.requestAnimationFrame(() => {
      var x;
      return (x = S.current) == null ? void 0 : x.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };
  return /* @__PURE__ */ a("div", { style: { minWidth: 0 }, children: [
    /* @__PURE__ */ a("div", { className: "flex flex-wrap items-start gap-3", children: [
      /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(Ne, { mcp: e.mcp, state: n, withPoll: !0 }) }),
      /* @__PURE__ */ t(f, { onClick: e.onPoll, disabled: !!e.busy || !e.configured, children: "Poll now" })
    ] }),
    /* @__PURE__ */ t("div", { ref: S, children: /* @__PURE__ */ t(
      it,
      {
        state: n,
        events: e.events,
        configured: e.configured,
        busy: e.busy,
        expanded: k,
        setExpanded: v,
        pending: h,
        setPending: y,
        onStart: e.onStart,
        onChanged: e.onChanged
      }
    ) }),
    !e.configured && /* @__PURE__ */ a(M, { className: "mb-4", children: [
      /* @__PURE__ */ t(U, { children: "Finish setup" }),
      /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite." })
    ] }),
    /* @__PURE__ */ t(
      et,
      {
        needs: e.needs,
        today: n.crew.today,
        handled: e.handled,
        onChanged: e.onChanged,
        onWhy: W
      }
    ),
    /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4", children: [
      /* @__PURE__ */ t(te, { label: "Awaiting triage", value: n.counts.needs_triage, accent: !0 }),
      /* @__PURE__ */ t(te, { label: "Possibly resolved", value: n.counts.possibly_resolved }),
      /* @__PURE__ */ t(te, { label: "Open p0 / p1", value: `${_.p0 || 0} / ${_.p1 || 0}` }),
      /* @__PURE__ */ t(te, { label: "Tracked items", value: n.counts.total })
    ] }),
    /* @__PURE__ */ a(M, { className: "mb-4", children: [
      /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2 mb-3", children: [
        /* @__PURE__ */ t(U, { children: "Ledger" }),
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
          E,
          {
            "aria-label": "GitHub repository to search (owner/name, optional)",
            placeholder: "owner/repo (optional)",
            value: o,
            onChange: (d) => u(d.target.value),
            className: "w-48"
          }
        ),
        /* @__PURE__ */ a(f, { onClick: () => e.onInvestigate(o), disabled: i.size === 0 || !!e.busy, children: [
          "Investigate ",
          i.size || ""
        ] })
      ] }),
      s.length === 0 ? /* @__PURE__ */ t(Be, { icon: /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "📡" }), title: "Nothing here yet", subtitle: "New messages appear after the next poll." }) : /* @__PURE__ */ t("ul", { className: "flex flex-col", children: s.map((d, x) => /* @__PURE__ */ t(tt, { it: d, first: x === 0, checked: i.has(d.key), onToggle: () => $(d.key) }, d.key)) })
    ] }),
    /* @__PURE__ */ t(nt, { state: n, busy: e.busy, onDigest: e.onDigest }),
    /* @__PURE__ */ a(M, { children: [
      /* @__PURE__ */ t(U, { children: "Channels" }),
      D.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No channels configured." }) : /* @__PURE__ */ a("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ t("thead", { children: /* @__PURE__ */ a("tr", { className: "text-left text-muted", children: [
          /* @__PURE__ */ t("th", { scope: "col", children: "Channel" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Last polled" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Status" })
        ] }) }),
        /* @__PURE__ */ t("tbody", { children: D.map((d) => /* @__PURE__ */ a("tr", { children: [
          /* @__PURE__ */ t("td", { className: "font-mono", children: d.cid }),
          /* @__PURE__ */ t("td", { children: le(d.last_polled_at) }),
          /* @__PURE__ */ t("td", { children: d.last_error ? /* @__PURE__ */ t(z, { variant: "err", title: d.last_error, children: "error" }) : /* @__PURE__ */ t(z, { variant: "ok", children: "ok" }) })
        ] }, d.cid)) })
      ] })
    ] })
  ] });
}
const ue = {
  decide: "Needs a decision",
  unanswered: "Questions nobody answered",
  clusters: "Reported more than once"
};
function Se(e) {
  return e < 1 ? "under 1 h old" : e < 48 ? `${Math.round(e)} h old` : `${Math.floor(e / 24)} days old`;
}
function Ve(e) {
  return `Why is "${e.summary.length > 80 ? `${e.summary.slice(0, 79)}…` : e.summary}" ${e.priority || "on my list"}?`;
}
function _e(e) {
  return e ? /* @__PURE__ */ t(z, { variant: e === "p0" || e === "p1" ? "err" : "muted", children: e }) : null;
}
function q({ message: e, onRetry: n }) {
  return /* @__PURE__ */ a(
    "div",
    {
      role: "alert",
      className: "text-sm flex flex-wrap items-center gap-2",
      style: { border: "1px solid var(--danger)", borderRadius: 8, padding: "8px 12px", margin: "8px 0" },
      children: [
        /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200 }, children: e }),
        /* @__PURE__ */ t(f, { onClick: n, children: "Try again" })
      ]
    }
  );
}
function ne({ label: e, actions: n }) {
  const s = re(null);
  return /* @__PURE__ */ a("details", { ref: s, style: { position: "relative" }, children: [
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
        children: n.map((i) => /* @__PURE__ */ t(
          "button",
          {
            type: "button",
            role: "menuitem",
            onClick: () => {
              s.current && (s.current.open = !1), i.onClick();
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
            children: i.label
          },
          i.label
        ))
      }
    )
  ] });
}
const F = { fontSize: 12, padding: "2px 10px" };
function Ye({
  e,
  first: n,
  onMark: s,
  onWhy: i,
  onSend: l
}) {
  const [o, u] = c(e.reply_draft || "");
  J(() => u(e.reply_draft || ""), [e.reply_draft]);
  const h = `sr-reply-${e.key.replace(/[^A-Za-z0-9]/g, "-")}`, y = [
    ...e.permalink ? [{ label: "Open in Slack", onClick: () => window.open(e.permalink, "_blank", "noopener,noreferrer") }] : [],
    { label: "Done without sending", onClick: () => s("done") },
    { label: "Why? Ask the lead", onClick: i }
  ];
  return /* @__PURE__ */ t("li", { className: "text-sm", style: { padding: "10px 0", borderTop: n ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ a("div", { className: "flex items-start gap-2", children: [
    /* @__PURE__ */ t("div", { style: { flex: "none", minWidth: 28 }, children: _e(e.priority) }),
    /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
      /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        e.reason,
        " · ",
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        " · ",
        Se(e.age_hours)
      ] }),
      /* @__PURE__ */ t("label", { htmlFor: h, className: "text-xs text-muted", style: { display: "block", marginTop: 6 }, children: "Reply to the thread, sent as you" }),
      /* @__PURE__ */ t(
        "textarea",
        {
          id: h,
          value: o,
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
      /* @__PURE__ */ t(f, { style: F, disabled: !o.trim(), onClick: () => l(o.trim(), o.trim() !== (e.reply_draft || "").trim()), children: "Send to thread" }),
      /* @__PURE__ */ t(f, { style: F, onClick: () => s("ignored"), children: "Ignore" }),
      /* @__PURE__ */ t(ne, { label: "More actions", actions: y })
    ] })
  ] }) });
}
function qe({
  e,
  first: n,
  onMark: s,
  onWhy: i,
  onDispatch: l,
  busy: o
}) {
  const u = !!e.handoff_title && !!l, h = e.dispatch;
  return /* @__PURE__ */ t("li", { className: "text-sm", style: { padding: "10px 0", borderTop: n ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ a("div", { className: "flex items-start gap-2", children: [
    /* @__PURE__ */ t("div", { style: { flex: "none", minWidth: 28 }, children: _e(e.priority) }),
    /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
      u && !h && /* @__PURE__ */ a("div", { className: "text-xs", style: { marginTop: 2 }, children: [
        "Fix: ",
        e.handoff_title
      ] }),
      h && /* @__PURE__ */ a("div", { className: "text-xs", style: { marginTop: 2 }, "data-testid": "fix-in-progress", children: [
        /* @__PURE__ */ t(de, { d: h }),
        " · ",
        $e[h.state] || h.state,
        h.pr_url && /* @__PURE__ */ a(R, { children: [
          " · ",
          /* @__PURE__ */ a("a", { className: "underline", href: h.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
            "PR #",
            h.pr_number
          ] })
        ] })
      ] }),
      /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        e.reason,
        e.words && e.words.length > 0 && /* @__PURE__ */ a(R, { children: [
          " (",
          e.words.join(", "),
          ")"
        ] }),
        " · ",
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        " · ",
        Se(e.age_hours),
        e.permalink && /* @__PURE__ */ a(R, { children: [
          " · ",
          /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open in Slack" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ t("div", { className: "flex items-center gap-1", style: { flex: "none" }, children: h ? /* @__PURE__ */ a(R, { children: [
      /* @__PURE__ */ t(f, { style: F, onClick: () => s("ignored"), children: "Ignore" }),
      /* @__PURE__ */ t(
        ne,
        {
          label: "More actions",
          actions: [
            { label: "Done", onClick: () => s("done") },
            { label: "Why? Ask the lead", onClick: i }
          ]
        }
      )
    ] }) : u ? /* @__PURE__ */ a(R, { children: [
      /* @__PURE__ */ t(f, { style: F, onClick: l, disabled: o, children: o ? "Dispatching…" : "Dispatch fix" }),
      /* @__PURE__ */ t(f, { style: F, onClick: () => s("ignored"), children: "Ignore" }),
      /* @__PURE__ */ t(
        ne,
        {
          label: "More actions",
          actions: [
            { label: "Done", onClick: () => s("done") },
            { label: "Why? Ask the lead", onClick: i }
          ]
        }
      )
    ] }) : /* @__PURE__ */ a(R, { children: [
      /* @__PURE__ */ t(f, { style: F, onClick: () => s("done"), children: "Done" }),
      /* @__PURE__ */ t(f, { style: F, onClick: () => s("ignored"), children: "Ignore" }),
      /* @__PURE__ */ t(ne, { label: "More actions", actions: [{ label: "Why? Ask the lead", onClick: i }] })
    ] }) })
  ] }) });
}
const Ce = typeof he.useChatLauncher == "function" ? he.useChatLauncher : () => null, $e = { running: "working", idle: "waiting", closed: "session closed", unknown: "" };
function de({ d: e }) {
  const n = Ce(), s = `/chat?sid=${encodeURIComponent(e.session_key)}`;
  return /* @__PURE__ */ t(
    "a",
    {
      className: "underline",
      href: s,
      onClick: (i) => {
        n && (i.preventDefault(), n.openChat({ slotKey: e.session_key }));
      },
      children: e.title || "Fix session"
    }
  );
}
function Xe(e) {
  try {
    return JSON.parse(String(e.body || "{}"));
  } catch {
    return {};
  }
}
function Ze(e) {
  const n = X(), s = Ce(), [i, l] = c(""), [o, u] = c(null), [h, y] = c(null), [k, v] = c(null), [S, _] = c(!1), $ = async (d) => {
    if (!i) {
      l(d), y(null);
      try {
        const x = await n.post(`${w}/items/handoff/dispatch`, { key: d });
        x.mode === "server" ? u({ session_key: x.session_key, title: x.title }) : s ? s.openChat({ agent: x.agent, message: x.seed, autoSend: !0 }) : (_(!1), v({ title: x.title, seed: x.seed })), e();
      } catch (x) {
        const b = Xe(x);
        b.code === "already_dispatched" && b.session_key ? u({ session_key: b.session_key, title: b.title || "", again: !0 }) : y({ key: d, why: b.error || "the gateway refused it" });
      } finally {
        l("");
      }
    }
  }, D = async () => {
    if (k)
      try {
        await navigator.clipboard.writeText(k.seed), _(!0);
      } catch {
        _(!1);
      }
  }, W = /* @__PURE__ */ a(R, { children: [
    h && /* @__PURE__ */ t(q, { message: `Could not dispatch that fix: ${h.why}. Nothing was sent.`, onRetry: () => $(h.key) }),
    o && /* @__PURE__ */ a(
      "div",
      {
        role: "status",
        "data-testid": "dispatch-toast",
        className: "text-sm flex items-center gap-2",
        style: { position: "fixed", right: 16, bottom: 16, zIndex: 40, background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "8px 12px", maxWidth: 480 },
        children: [
          /* @__PURE__ */ a("span", { style: { flex: 1, minWidth: 0 }, children: [
            o.again ? "Already dispatched: " : "Fix dispatched to a conductor: ",
            /* @__PURE__ */ t(de, { d: o })
          ] }),
          /* @__PURE__ */ t(f, { style: F, onClick: () => u(null), children: "Close" })
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
        onKeyDown: (d) => d.key === "Escape" && v(null),
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
            /* @__PURE__ */ t(f, { onClick: D, children: S ? "Copied" : "Copy task" }),
            /* @__PURE__ */ t("a", { className: "underline text-sm", href: "/chat?new=1", children: "New chat" }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(f, { onClick: () => v(null), children: "Close" })
          ] })
        ] })
      }
    )
  ] });
  return { dispatch: $, busyKey: i, ui: W };
}
function et({
  needs: e,
  today: n,
  handled: s,
  onChanged: i,
  onWhy: l
}) {
  const o = X(), u = Ze(i), h = (e == null ? void 0 : e.fixes) || [], [y, k] = c(null), [v, S] = c("");
  J(() => {
    if (!v) return;
    const r = window.setTimeout(() => S(""), 4e3);
    return () => window.clearTimeout(r);
  }, [v]);
  const _ = async (r, m, p, N) => {
    k(null), b((B) => new Set(B).add(N));
    try {
      p && await o.post(`${w}/items/reply/draft`, { key: r, text: m }), await o.post(`${w}/items/reply/send`, { key: r }), S("Sent as you"), i();
    } catch (B) {
      b((Y) => {
        const O = new Set(Y);
        return O.delete(N), O;
      }), k({ key: r, text: m, edited: p, why: B.message || "unknown error" });
    }
  }, $ = (e == null ? void 0 : e.replied) || [], [D, W] = c(""), d = async (r) => {
    W("");
    try {
      await o.post(`${w}/items/handoff/dismiss`, { key: r }), i();
    } catch {
      W(r);
    }
  }, [x, b] = c(/* @__PURE__ */ new Set()), [T, A] = c(null);
  J(() => b(/* @__PURE__ */ new Set()), [e]);
  const I = async (r, m, p) => {
    A(null), p && b((N) => new Set(N).add(p));
    try {
      for (const N of r) await o.post(`${w}/items/handle`, { key: N, how: m });
      i();
    } catch {
      p && b((N) => {
        const B = new Set(N);
        return B.delete(p), B;
      }), A({ keys: r, how: m, rowId: p });
    }
  }, P = ((e == null ? void 0 : e.groups) || []).map((r) => ({
    ...r,
    shown: r.entries.filter((m) => !x.has(`${r.id}:${m.key}`))
  })), g = P.every((r) => r.shown.length === 0), L = (T == null ? void 0 : T.how) === "reopen" ? "reopen" : (T == null ? void 0 : T.how) === "ignored" ? "ignore" : "mark as done";
  return /* @__PURE__ */ a(M, { className: "mb-4", children: [
    /* @__PURE__ */ t(U, { children: "Needs you" }),
    (n == null ? void 0 : n.text) && /* @__PURE__ */ a("p", { className: "text-sm", style: { margin: "0 0 8px" }, "data-testid": "crew-today", children: [
      n.text,
      n.at > 0 && /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
        " · ",
        G(n.at)
      ] })
    ] }),
    v && /* @__PURE__ */ t("p", { role: "status", className: "text-sm", style: { margin: "0 0 8px", color: "var(--success, var(--text))" }, children: v }),
    y && /* @__PURE__ */ t(
      q,
      {
        message: `Could not send that reply: ${y.why}`,
        onRetry: () => _(y.key, y.text, y.edited, `decide:${y.key}`)
      }
    ),
    T && /* @__PURE__ */ t(
      q,
      {
        message: `Could not ${L} that message. Nothing changed.`,
        onRetry: () => I(T.keys, T.how, T.rowId)
      }
    ),
    e ? g ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Nothing needs you right now." }) : P.map(
      (r) => r.shown.length === 0 ? null : /* @__PURE__ */ a("section", { "aria-label": ue[r.id], style: { marginTop: 10 }, children: [
        /* @__PURE__ */ a("h4", { className: "text-sm", style: { margin: 0, fontWeight: 600, color: "var(--text-strong)" }, children: [
          ue[r.id],
          " ",
          /* @__PURE__ */ a("span", { className: "text-muted", style: { fontWeight: 400 }, children: [
            "(",
            r.total - (r.entries.length - r.shown.length),
            ")"
          ] })
        ] }),
        /* @__PURE__ */ t("ul", { className: "flex flex-col", children: r.shown.map((m, p) => r.id === "decide" && m.reply_draft && !m.handoff_title ? /* @__PURE__ */ t(
          Ye,
          {
            e: m,
            first: p === 0,
            onMark: (N) => I([m.key], N, `${r.id}:${m.key}`),
            onWhy: () => l(m),
            onSend: (N, B) => _(m.key, N, B, `${r.id}:${m.key}`)
          },
          m.key
        ) : /* @__PURE__ */ t(
          qe,
          {
            e: m,
            first: p === 0,
            onMark: (N) => {
              var B;
              return I((B = m.members) != null && B.length ? m.members : [m.key], N, `${r.id}:${m.key}`);
            },
            onWhy: () => l(m),
            onDispatch: r.id === "decide" && m.handoff_title ? () => u.dispatch(m.key) : void 0,
            busy: u.busyKey === m.key
          },
          m.key
        )) })
      ] }, r.id)
    ) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" }),
    D && /* @__PURE__ */ t(q, { message: "Could not dismiss that hand-off. Nothing changed.", onRetry: () => d(D) }),
    h.length > 0 && /* @__PURE__ */ a("details", { style: { marginTop: 12 }, "data-testid": "fixes-in-flight", children: [
      /* @__PURE__ */ a("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Fixes in flight (",
        (e == null ? void 0 : e.fixes_total) ?? h.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: h.map((r, m) => /* @__PURE__ */ a(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: m === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ a("span", { style: { flex: 1, minWidth: 0 }, children: [
              /* @__PURE__ */ t(de, { d: r.dispatch }),
              /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
                " · ",
                $e[r.dispatch.state] || r.dispatch.state || "sent",
                " · ",
                /* @__PURE__ */ t("span", { className: "font-mono", children: r.repo }),
                " · ",
                G(r.dispatch.at)
              ] }),
              r.dispatch.pr_url && /* @__PURE__ */ a(R, { children: [
                " · ",
                /* @__PURE__ */ a("a", { className: "underline", href: r.dispatch.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
                  "PR #",
                  r.dispatch.pr_number
                ] })
              ] })
            ] }),
            /* @__PURE__ */ t(f, { style: F, onClick: () => d(r.key), children: "Dismiss" })
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
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: s.map((r, m) => /* @__PURE__ */ a(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: m === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 0 }, children: r.summary || r.text.slice(0, 200) }),
            /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
              r.handled_how === "ignored" ? "Ignored" : "Done",
              " ",
              G(r.handled_at)
            ] }),
            /* @__PURE__ */ t(f, { style: F, onClick: () => I([r.key], "reopen"), children: "Reopen" })
          ]
        },
        r.key
      )) })
    ] }),
    $.length > 0 && /* @__PURE__ */ a("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ a("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Replied (",
        (e == null ? void 0 : e.replied_total) ?? $.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: $.map((r, m) => /* @__PURE__ */ a(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: m === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ a("span", { style: { flex: 1, minWidth: 0 }, children: [
              r.text.length > 120 ? `${r.text.slice(0, 119)}…` : r.text,
              /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
                " · ",
                r.summary,
                " · ",
                /* @__PURE__ */ t("span", { className: "font-mono", children: r.channel }),
                " · ",
                G(r.at)
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
function tt({ it: e, first: n, checked: s, onToggle: i }) {
  const l = e.priority ? { label: e.priority, variant: e.priority === "p0" || e.priority === "p1" ? "err" : "muted" } : e.possibly_resolved ? { label: "possibly resolved", variant: "warn" } : null, o = [
    e.category && `category: ${e.category}`,
    e.possibly_resolved && `possibly resolved: ${e.possibly_resolved.reason}`
  ].filter(Boolean);
  return /* @__PURE__ */ t("li", { className: "text-sm", style: { padding: "10px 0", borderTop: n ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ a("div", { className: "flex items-start gap-2", children: [
    /* @__PURE__ */ t(
      "input",
      {
        type: "checkbox",
        "aria-label": `Select ${e.key} for investigation`,
        checked: s,
        onChange: i,
        style: { marginTop: 4 }
      }
    ),
    /* @__PURE__ */ a("div", { className: "flex items-center gap-1", style: { flex: "none" }, children: [
      /* @__PURE__ */ t(z, { variant: Ke(e.status), children: e.status }),
      l && /* @__PURE__ */ t(z, { variant: l.variant, children: l.label }),
      o.length > 0 && /* @__PURE__ */ a("span", { className: "text-xs text-muted", title: o.join(`
`), "aria-label": o.join("; "), children: [
        "+",
        o.length
      ] })
    ] }),
    /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || e.text.slice(0, 280) }),
      /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        e.user && /* @__PURE__ */ a(R, { children: [
          " · ",
          e.user
        ] }),
        e.reply_count > 0 && /* @__PURE__ */ a(R, { children: [
          " · ",
          e.reply_count,
          " replies"
        ] }),
        " · ",
        /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "open in Slack" }),
        e.links.length > 0 && /* @__PURE__ */ a(R, { children: [
          " · linked ",
          e.links.map((u) => /* @__PURE__ */ t("a", { className: "underline mr-2", href: u, target: "_blank", rel: "noreferrer noopener", children: u.replace("https://github.com/", "") }, u))
        ] })
      ] }),
      e.note && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: e.note })
    ] })
  ] }) });
}
function nt({ state: e, busy: n, onDigest: s }) {
  const i = e.digest, l = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), o = i.last_posted_date === l;
  return /* @__PURE__ */ a(M, { className: "mb-4", children: [
    /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ t(U, { children: o ? "Today's digest" : "Latest digest" }),
      i.pending ? /* @__PURE__ */ t(z, { variant: "aim", children: "being delivered" }) : null,
      /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: i.last_posted_date ? `${i.last_posted_date} · ${e.settings.digest_destination === "self_dm" ? "DMed to you" : "dashboard notification"}` : "none yet" }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      /* @__PURE__ */ t(f, { onClick: s, disabled: !!n || !e.crew.live, children: "Request digest" })
    ] }),
    i.last_text ? /* @__PURE__ */ t("pre", { className: "whitespace-pre-wrap text-sm mt-2", style: { fontFamily: "inherit", margin: "8px 0 0" }, children: i.last_text }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted mt-2", children: "The Radar Lead writes one after the daily cron or when you press Request digest." }),
    i.last_error && /* @__PURE__ */ t("p", { className: "text-xs mt-1", style: { color: "var(--danger)" }, children: i.last_error })
  ] });
}
function at({ state: e }) {
  return /* @__PURE__ */ t("div", { className: "flex items-center gap-2", style: { marginTop: 10 }, children: Z.map((n) => /* @__PURE__ */ a("span", { title: `${n.title} · ${Q(n, e).label}`, children: [
    /* @__PURE__ */ t(oe, { m: n, s: e, selected: n.id === "lead", size: 30 }),
    /* @__PURE__ */ t("span", { className: "sr-only", children: `${n.title}: ${Q(n, e).label}` })
  ] }, n.id)) });
}
function st(e) {
  const n = `slack-radar:chat-open:${e}`, s = () => {
    try {
      return window.localStorage.getItem(n) === "1";
    } catch {
      return !1;
    }
  }, [i, l] = c(s);
  J(() => l(s()), [n]);
  const o = ie(
    (u) => {
      l(u);
      try {
        u ? window.localStorage.setItem(n, "1") : window.localStorage.removeItem(n);
      } catch {
      }
    },
    [n]
  );
  return [i, o];
}
function pe({ q: e, onClick: n, disabled: s }) {
  return /* @__PURE__ */ t(
    "button",
    {
      type: "button",
      onClick: n,
      disabled: s,
      style: {
        fontSize: 12,
        border: "1px solid var(--border-strong)",
        borderRadius: 999,
        padding: "4px 10px",
        background: "transparent",
        color: "var(--text)",
        cursor: s ? "not-allowed" : "pointer",
        opacity: s ? 0.5 : 1,
        whiteSpace: "nowrap"
      },
      children: e
    }
  );
}
function it(e) {
  const n = X(), { state: s, expanded: i, pending: l } = e, o = Z[0], u = s.crew.slot_key, h = s.crew.live && s.crew.session_open && s.crew.session_agent === s.crew.agent, [y, k] = c(""), [v, S] = c(!1), [_, $] = c(""), [D, W] = c(!1), d = Q(o, s), x = async (g) => {
    await n.post(`${w}/crew/message`, { message: g }), e.onChanged();
  }, b = async (g) => {
    const L = g.trim();
    if (L) {
      S(!0), $("");
      try {
        await n.post(`${w}/crew/message`, { message: L }), k(""), L === l && e.setPending(""), e.setExpanded(!0), e.onChanged();
      } catch {
        $(L);
      } finally {
        S(!1);
      }
    }
  }, T = async () => {
    try {
      await navigator.clipboard.writeText(l), W(!0), window.setTimeout(() => W(!1), 1500);
    } catch {
      W(!1);
    }
  }, A = _ && /* @__PURE__ */ t(q, { message: "The Radar Lead did not get that message.", onRetry: () => b(_) }), I = /* @__PURE__ */ t("div", { className: "text-sm", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }, children: s.crew.live ? /* @__PURE__ */ a(R, { children: [
    /* @__PURE__ */ t("span", { children: "The Radar Lead session opens on its next turn. Open it now to talk here." }),
    /* @__PURE__ */ t(f, { primary: !0, onClick: e.onStart, disabled: !!e.busy || !e.configured, children: "Open the session" })
  ] }) : /* @__PURE__ */ a("span", { children: [
    "The Radar Lead is paused. Turn on ",
    /* @__PURE__ */ t("b", { children: "Crew" }),
    " at the top of the page to triage your channels and talk to it here."
  ] }) });
  if (!i)
    return /* @__PURE__ */ a(M, { className: "mb-4", style: { padding: "10px 14px" }, children: [
      /* @__PURE__ */ a(
        "form",
        {
          className: "flex flex-wrap items-center gap-2",
          onSubmit: (g) => {
            g.preventDefault(), b(y);
          },
          children: [
            /* @__PURE__ */ t(oe, { m: o, s, size: 26 }),
            /* @__PURE__ */ t(
              E,
              {
                "aria-label": "Ask the lead",
                placeholder: "Ask the lead…",
                value: y,
                onChange: (g) => k(g.target.value),
                disabled: !h || v,
                style: { flex: 1, minWidth: 200 }
              }
            ),
            /* @__PURE__ */ t(f, { primary: !0, type: "submit", disabled: !h || v || !y.trim(), children: "Send" }),
            me.map((g) => /* @__PURE__ */ t(pe, { q: g, onClick: () => b(g), disabled: !h || v }, g))
          ]
        }
      ),
      !h && /* @__PURE__ */ t("div", { style: { marginTop: 8 }, children: I }),
      A
    ] });
  const P = e.events.filter((g) => g.kind === "crew" || g.kind === "digest").slice(0, 5);
  return /* @__PURE__ */ a(
    M,
    {
      className: "mb-4",
      style: { padding: 0, display: "flex", flexDirection: "column", height: "min(620px, calc(100vh - 180px))", overflow: "hidden" },
      children: [
        /* @__PURE__ */ a("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border)" }, children: [
          /* @__PURE__ */ a("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: s.crew.name || o.title }),
            /* @__PURE__ */ t(z, { variant: d.tone === "muted" ? "muted" : d.tone === "aim" ? "aim" : "ok", children: d.label }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(f, { onClick: () => e.setExpanded(!1), "aria-expanded": !0, children: "Collapse" })
          ] }),
          /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
            "phase ",
            s.crew_memory.phase,
            " · next: ",
            s.crew_memory.next || "—"
          ] }),
          /* @__PURE__ */ t(at, { state: s })
        ] }),
        /* @__PURE__ */ t(Ue, { state: s }),
        l && // ChatEmbed has no API to fill its composer, so the question waits here.
        /* @__PURE__ */ a(
          "div",
          {
            className: "text-sm flex flex-wrap items-center gap-2",
            style: { padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" },
            children: [
              /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200, userSelect: "all" }, children: l }),
              /* @__PURE__ */ t(f, { primary: !0, style: F, onClick: () => b(l), disabled: !h || v, children: "Send" }),
              /* @__PURE__ */ t(f, { style: F, onClick: T, children: D ? "Copied" : "Copy" })
            ]
          }
        ),
        A && /* @__PURE__ */ t("div", { style: { padding: "0 16px" }, children: A }),
        /* @__PURE__ */ t("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: h ? /* @__PURE__ */ t(
          Ie,
          {
            slotKey: u,
            agent: s.crew.agent,
            frameless: !0,
            startAtBottom: !0,
            placeholder: "Ask the Radar Lead…",
            onSend: x
          },
          u
        ) : /* @__PURE__ */ a("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 10 }, children: [
          I,
          !e.configured && /* @__PURE__ */ t("p", { className: "text-xs text-muted", children: "Add a channel in Settings first." }),
          P.length > 0 && /* @__PURE__ */ t("ul", { className: "text-xs text-muted flex flex-col gap-1", style: { marginTop: 6 }, children: P.map((g, L) => /* @__PURE__ */ a("li", { children: [
            G(g.at),
            " · ",
            g.text
          ] }, `${g.at}-${L}`)) })
        ] }) }),
        /* @__PURE__ */ t("div", { className: "flex flex-wrap gap-2", style: { padding: "10px 16px 12px", borderTop: "1px solid var(--border)" }, children: me.map((g) => /* @__PURE__ */ t(pe, { q: g, onClick: () => b(g), disabled: !h || v }, g)) })
      ]
    }
  );
}
function rt({ state: e }) {
  return /* @__PURE__ */ a(M, { children: [
    /* @__PURE__ */ t(U, { children: "Team" }),
    /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { marginBottom: 8 }, children: "Who works on your channels. Only the Radar Lead has a session; the others run when needed." }),
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: Z.map((n) => {
      var i, l;
      const s = n.id === "lead" ? e.crew.agent : n.agent;
      return /* @__PURE__ */ a(
        "li",
        {
          className: "flex items-start gap-3",
          style: { padding: "12px 4px", borderTop: "1px solid var(--border)", opacity: n.planned ? 0.7 : 1 },
          children: [
            /* @__PURE__ */ t(oe, { m: n, s: e, size: 36 }),
            /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
              /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2", children: [
                /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: n.id === "lead" && e.crew.name || n.title }),
                /* @__PURE__ */ t(z, { variant: "muted", children: n.layer }),
                /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: n.kind })
              ] }),
              /* @__PURE__ */ t("p", { className: "text-sm", style: { margin: "4px 0 0" }, children: n.duty }),
              n.id === "investigator" && (((i = e.investigations) == null ? void 0 : i.items) || 0) > 0 && /* @__PURE__ */ a("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: [
                (l = e.investigations) == null ? void 0 : l.items,
                " item(s) under investigation"
              ] }),
              s && /* @__PURE__ */ t(fe, { children: /* @__PURE__ */ a("span", { className: "font-mono", children: [
                "agent: ",
                s,
                n.id === "lead" && e.crew.slot_key ? ` · session: ${e.crew.slot_key}` : ""
              ] }) })
            ] }),
            /* @__PURE__ */ t("div", { "data-testid": `team-status-${n.id}`, style: { maxWidth: 360, minWidth: 0, display: "flex" }, children: /* @__PURE__ */ t(be, { m: n, state: e, withName: !1 }) })
          ]
        },
        n.id
      );
    }) })
  ] });
}
function lt({ events: e, kinds: n, onShowAll: s }) {
  const i = n ? e.filter((l) => n.includes(l.kind)) : e;
  return /* @__PURE__ */ a(M, { children: [
    /* @__PURE__ */ t(U, { children: "Activity" }),
    n && /* @__PURE__ */ a("p", { className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { marginBottom: 8 }, children: [
      /* @__PURE__ */ t("span", { children: "Showing the crew and its members only." }),
      /* @__PURE__ */ t(f, { style: F, onClick: s, children: "Show all" })
    ] }),
    i.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No activity yet." }) : /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", children: i.map((l, o) => /* @__PURE__ */ a("li", { children: [
      /* @__PURE__ */ t("span", { className: "text-muted", children: le(l.at) }),
      " ",
      /* @__PURE__ */ t(z, { variant: "muted", children: l.kind }),
      " ",
      l.text
    ] }, `${l.at}-${o}`)) })
  ] });
}
function ot({
  state: e,
  busy: n,
  act: s,
  mcp: i,
  onProbe: l
}) {
  const o = X(), [u, h] = c(e.settings.channels.join(`
`)), [y, k] = c(e.settings.digest_destination), [v, S] = c(e.settings.slack_login), [_, $] = c(e.settings.slack_mcp_command), [D, W] = c(e.settings.workspace_url), [d, x] = c(String(e.settings.poll_interval_secs)), [b, T] = c(String(e.settings.backfill_hours)), [A, I] = c(e.crew.unattended), [P, g] = c(e.crew.agent), [L, r] = c(e.crew.model), m = () => s(
    "Save settings",
    () => o.put(`${w}/settings`, {
      channels: u.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean),
      digest_destination: y,
      slack_login: v.trim(),
      slack_mcp_command: _.trim(),
      workspace_url: D.trim(),
      poll_interval_secs: Number(d),
      backfill_hours: Number(b)
    })
  );
  return /* @__PURE__ */ a(R, { children: [
    !e.vault_available && /* @__PURE__ */ t(M, { className: "mb-4", children: /* @__PURE__ */ t("p", { className: "text-sm", children: "The gateway secret vault is unavailable, so settings cannot be saved." }) }),
    /* @__PURE__ */ a(M, { className: "mb-4", children: [
      /* @__PURE__ */ t(U, { children: "Basics" }),
      /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(Ne, { mcp: i, state: e }) }),
        /* @__PURE__ */ t(f, { disabled: !!n, onClick: l, children: "Check connection" })
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
          onChange: (p) => h(p.target.value)
        }
      ),
      /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Digest destination",
          /* @__PURE__ */ a(
            "select",
            {
              className: "block w-full text-sm bg-transparent border rounded px-2 py-1",
              value: y,
              onChange: (p) => k(p.target.value),
              children: [
                /* @__PURE__ */ t("option", { value: "dashboard", children: "Dashboard notification only" }),
                /* @__PURE__ */ t("option", { value: "self_dm", children: "DM to myself in Slack" })
              ]
            }
          )
        ] }),
        y === "self_dm" && /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Your Slack login (for the DM)",
          /* @__PURE__ */ t(E, { value: v, onChange: (p) => S(p.target.value), placeholder: "jdoe" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Poll interval (seconds, 60–3600)",
          /* @__PURE__ */ t(E, { type: "number", min: 60, max: 3600, value: d, onChange: (p) => x(p.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(f, { primary: !0, className: "mt-3", disabled: !!n, onClick: m, children: "Save settings" })
    ] }),
    /* @__PURE__ */ t(M, { children: /* @__PURE__ */ a("details", { children: [
      /* @__PURE__ */ t("summary", { style: { cursor: "pointer", fontWeight: 600, color: "var(--text-strong)" }, children: "Advanced" }),
      /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "MCP server command (a single executable on PATH)",
          /* @__PURE__ */ t(E, { value: _, onChange: (p) => $(p.target.value), placeholder: "ai-community-slack-mcp" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Workspace URL (for permalinks, optional)",
          /* @__PURE__ */ t(E, { value: D, onChange: (p) => W(p.target.value), placeholder: "https://yourteam.slack.com" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "First-poll backfill (hours, 0–168)",
          /* @__PURE__ */ t(E, { type: "number", min: 0, max: 168, value: b, onChange: (p) => T(p.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(f, { className: "mt-3", disabled: !!n, onClick: m, children: "Save settings" }),
      /* @__PURE__ */ a("div", { style: { borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }, children: [
        /* @__PURE__ */ t("div", { className: "text-sm", style: { fontWeight: 600, marginBottom: 8 }, children: "Crew" }),
        /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
          /* @__PURE__ */ a("label", { className: "text-sm", children: [
            "Agent",
            /* @__PURE__ */ t(E, { value: P, onChange: (p) => g(p.target.value), placeholder: "slack-radar-crew" }),
            /* @__PURE__ */ t("span", { className: "block text-xs text-muted mt-1", children: "Default: the shipped slack-radar-crew agent. Your own agents are never modified." })
          ] }),
          /* @__PURE__ */ a("label", { className: "text-sm", children: [
            "Model (empty = agent default)",
            /* @__PURE__ */ t(E, { value: L, onChange: (p) => r(p.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ a("div", { className: "mt-3 flex items-center gap-2", children: [
          /* @__PURE__ */ t(
            ge,
            {
              checked: A,
              onChange: I,
              label: "Unattended mode (auto-approve investigator commands)",
              describedBy: "sr-unattended-risk"
            }
          ),
          /* @__PURE__ */ t("span", { className: "text-sm", children: "Unattended mode (auto-approve investigator commands)" })
        ] }),
        /* @__PURE__ */ t("p", { id: "sr-unattended-risk", className: "text-xs text-muted mt-1", children: "Risk: anyone in a watched channel can write text the crew reads, so a crafted message could steer a command nobody reviews." }),
        /* @__PURE__ */ t(
          f,
          {
            primary: !0,
            className: "mt-3",
            disabled: !!n,
            onClick: () => s("Save crew", () => o.put(`${w}/crew`, { agent: P, model: L, unattended: A })),
            children: "Save crew"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  ut as default
};
