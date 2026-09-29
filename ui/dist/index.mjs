import { jsxs as a, Fragment as F, jsx as t } from "react/jsx-runtime";
import * as xe from "@kirocrew/app-sdk";
import { useAppApi as ne, ChatEmbed as Le } from "@kirocrew/app-sdk";
import { PageHeader as Ae, Toggle as ke, Btn as S, Card as M, CardTitle as Q, StatCard as le, Input as K, EmptyState as Be, Badge as G } from "@kirocrew/app-sdk/ui";
import { useState as h, useCallback as he, useEffect as q, useRef as pe, useMemo as oe } from "react";
const $ = "/api/apps/slack-radar", Ie = {
  checking: "checking…",
  connected: "connected",
  needs_login: "sign in again",
  binary_not_found: "not installed",
  incompatible: "missing read access",
  error: "not working"
}, ye = ["What needs me today?", "Draft today's digest", "Which threads look resolved?"], Fe = [
  { id: "board", label: "Board" },
  { id: "ledger", label: "Ledger" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" }
], ue = (e) => e ? new Date(e * 1e3).toLocaleString() : "never";
function H(e) {
  if (!e) return "never";
  const n = Math.max(0, Date.now() / 1e3 - e);
  return n < 90 ? "just now" : n < 3600 ? `${Math.round(n / 60)} min ago` : n < 86400 ? `${Math.round(n / 3600)} h ago` : ue(e);
}
function Ne(e, n) {
  return n === "needs_login" ? "needs_login" : (e == null ? void 0 : e.status) || "checking";
}
function _e({ children: e, summary: n = "Details" }) {
  return /* @__PURE__ */ a("details", { className: "text-xs text-muted", style: { marginTop: 6 }, children: [
    /* @__PURE__ */ t("summary", { style: { cursor: "pointer" }, children: n }),
    /* @__PURE__ */ t("div", { style: { marginTop: 4 }, children: e })
  ] });
}
const ae = [
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
], ce = (e, n) => {
  var s;
  return (s = e.now) == null ? void 0 : s.members.find((r) => r.id === n);
};
function V(e, n) {
  var o;
  const s = ce(n, e.id);
  if (e.id === "lead")
    return (s == null ? void 0 : s.state) === "paused" || !n.crew.live ? { label: "paused", tone: "muted" } : (s ? s.state === "working" : n.crew.running) ? { label: "working", tone: "aim" } : { label: "live", tone: "ok" };
  if (e.id === "poller")
    return n.source_state === "needs_login" ? { label: "sign in again", tone: "warn" } : (s == null ? void 0 : s.state) === "paused" ? { label: "paused", tone: "warn" } : { label: `polled ${H(n.last_poll_at)}`, tone: "muted" };
  const r = s ? s.count : e.id === "investigator" && ((o = n.investigations) == null ? void 0 : o.running) || 0;
  return r ? { label: `${r} running`, tone: "aim" } : (s == null ? void 0 : s.state) === "planned" ? { label: "not started yet", tone: "muted" } : { label: "idle", tone: "muted" };
}
function Oe(e) {
  if (!e) return "";
  const n = Math.max(0, Math.round(Date.now() / 1e3 - e));
  return n < 90 ? `${n}s` : n < 90 * 60 ? `${Math.round(n / 60)}m` : `${Math.round(n / 3600)}h`;
}
const Pe = (e, n = 60) => e.length > n ? `${e.slice(0, n - 1).trimEnd()}…` : e;
function Me(e, n) {
  const s = ce(n, e.id);
  return s ? e.id === "poller" ? s.doing : s.state !== "working" ? s.state === "paused" ? `paused: ${s.doing}` : V(e, n).label : e.id === "lead" ? `working: ${s.doing}` : `${s.count} running: ${s.doing}` : V(e, n).label;
}
const Ee = `@keyframes slack-radar-pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.7) } }
.sr-pulse { animation: slack-radar-pulse 1.4s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .sr-pulse { animation: none } }`;
function Se({ tone: e, pulse: n }) {
  return /* @__PURE__ */ t(
    "i",
    {
      "aria-hidden": !0,
      className: n ? "sr-pulse" : void 0,
      style: { width: 8, height: 8, borderRadius: "50%", flex: "none", display: "inline-block", background: $e[e] }
    }
  );
}
function Ce({ m: e, state: n, withName: s = !0, onOpen: r }) {
  const o = V(e, n), d = ce(n, e.id), m = d ? d.state === "working" : o.tone === "aim", g = Me(e, n), y = e.id === "lead" && n.crew.name || e.title, v = /* @__PURE__ */ a(F, { children: [
    /* @__PURE__ */ t(Se, { tone: o.tone, pulse: m }),
    s && /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: y }),
    /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: Pe(g) })
  ] }), c = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    fontSize: 13,
    opacity: m || o.tone === "warn" ? 1 : 0.6,
    color: "var(--text)"
  }, f = { title: `${y} · ${g}`, "data-member": e.id, "data-state": (d == null ? void 0 : d.state) || (m ? "working" : "idle") };
  return r ? /* @__PURE__ */ t(
    "button",
    {
      type: "button",
      onClick: r,
      ...f,
      "aria-label": `${y}: ${g}. Show activity`,
      style: { ...c, background: "transparent", border: 0, padding: 0, cursor: "pointer" },
      children: v
    }
  ) : /* @__PURE__ */ t("span", { ...f, style: c, children: v });
}
function ze({ state: e, onOpenActivity: n }) {
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
        ae.map((s) => /* @__PURE__ */ t(
          Ce,
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
function je({ state: e }) {
  const n = ae.filter((s) => s.id === "investigator" || s.id === "watcher").map((s) => ({ m: s, row: ce(e, s.id) })).filter(({ row: s }) => (s == null ? void 0 : s.state) === "working");
  return n.length ? /* @__PURE__ */ t("div", { "data-testid": "chat-running", style: { padding: "6px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" }, children: n.map(({ m: s, row: r }) => {
    const o = Oe(r.since), d = `${s.title} running${r.count > 1 ? ` (${r.count})` : ""} · ${r.doing}${o ? ` · ${o}` : ""}`;
    return /* @__PURE__ */ a("div", { className: "text-xs flex items-center gap-2", title: d, style: { minWidth: 0 }, children: [
      /* @__PURE__ */ t(Se, { tone: "aim", pulse: !0 }),
      /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: d })
    ] }, s.id);
  }) }) : null;
}
const $e = {
  ok: "var(--ok)",
  aim: "var(--aim)",
  warn: "var(--warn)",
  muted: "var(--muted-strong)"
};
function ge({ m: e, s: n, selected: s, size: r = 32 }) {
  const o = V(e, n), d = e.planned || e.id === "poller", m = {
    width: r,
    height: r,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    fontWeight: 700,
    position: "relative",
    flex: "none",
    background: d ? "transparent" : "var(--bg-hover)",
    color: d ? "var(--muted)" : "var(--text-strong)",
    border: `2px ${d ? "dashed" : "solid"} ${s ? "var(--accent)" : d ? "var(--border-strong)" : "transparent"}`,
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
          background: $e[o.tone]
        }
      }
    )
  ] });
}
function Ue(e) {
  return e === "new" ? "warn" : e === "investigating" ? "aim" : e === "resolved" ? "ok" : "muted";
}
function Ke({ tab: e, setTab: n }) {
  return /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Slack Radar sections", style: { display: "flex", gap: 4 }, children: Fe.map((s) => {
    const r = e === s.id;
    return /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": r,
        onClick: () => n(s.id),
        style: {
          padding: "6px 12px",
          borderRadius: 8,
          border: 0,
          cursor: "pointer",
          fontSize: 14,
          background: r ? "var(--bg-hover)" : "transparent",
          color: r ? "var(--text-strong)" : "var(--muted)"
        },
        children: s.label
      },
      s.id
    );
  }) });
}
function He({
  state: e,
  configured: n,
  busy: s,
  onStart: r,
  onPause: o
}) {
  const d = e.crew.live;
  return /* @__PURE__ */ a("div", { className: "flex items-center gap-2", title: !d && !n ? "Add a channel in Settings first" : void 0, children: [
    /* @__PURE__ */ t("span", { className: "text-sm", children: "Crew" }),
    /* @__PURE__ */ t(
      ke,
      {
        checked: d,
        disabled: !!s || !d && !n,
        onChange: (g) => g ? r() : o(),
        label: d ? "Pause the crew" : "Start the crew"
      }
    ),
    /* @__PURE__ */ a("span", { className: "text-xs text-muted", title: "Whether the crew's commands run without asking you", children: [
      "Unattended: ",
      e.crew.trusted ? "on" : "off"
    ] })
  ] });
}
function ft() {
  const e = ne(), [n, s] = h("board"), [r, o] = h(null), [d, m] = h([]), [g, y] = h(null), [v, c] = h([]), [f, k] = h([]), [D, T] = h("open"), [W, R] = h(/* @__PURE__ */ new Set()), [L, w] = h(""), [l, p] = h(""), [b, C] = h(null), [x, B] = h(null), [P, j] = h(null), N = he(async () => {
    try {
      C(await e.get(`${$}/mcp/status`));
    } catch (I) {
      C({ status: "error", command: "", detail: I.message });
    }
  }, [e]);
  q(() => {
    N();
  }, [N]);
  const U = he(async () => {
    var I;
    try {
      const [J, X, ie, Y, De] = await Promise.all([
        e.get(`${$}/state`),
        e.get(`${$}/items?status=${encodeURIComponent(D)}&limit=300`),
        e.get(`${$}/events?limit=150`),
        e.get(`${$}/needs`),
        e.get(`${$}/items?handled=1&limit=100`)
      ]);
      o(J), B(((I = J.now) == null ? void 0 : I.members) || null), m(X.items), y(Y), c(De.items), k(ie.events.slice().reverse());
    } catch (J) {
      p(`Could not load: ${J.message}`);
    }
  }, [e, D]);
  q(() => {
    U();
    const I = window.setInterval(U, 3e4);
    return () => window.clearInterval(I);
  }, [U]);
  const se = !!(x != null && x.some((I) => I.state === "working")), ee = pe("");
  q(() => {
    if (!se) return;
    const I = async () => {
      try {
        const X = await e.get(`${$}/now`);
        B(X.members);
        const ie = X.members.map((Y) => `${Y.id}:${Y.state}:${Y.count}`).join(",");
        if (ee.current && ie !== ee.current) {
          const Y = await e.get(`${$}/events?limit=150`);
          k(Y.events.slice().reverse());
        }
        ee.current = ie;
      } catch {
      }
    }, J = window.setInterval(I, 5e3);
    return () => window.clearInterval(J);
  }, [se, e]);
  const z = oe(() => r && x ? { ...r, now: { members: x } } : r, [r, x]), i = () => {
    j(["member", "crew", "investigate"]), s("activity");
  }, u = async (I, J) => {
    w(I), p("");
    try {
      await J(), p(`${I}: done`), await U();
    } catch (X) {
      p(`${I} failed: ${X.message}`);
    } finally {
      w("");
    }
  }, _ = !!r && r.settings.channels.length > 0, A = (r == null ? void 0 : r.settings.channels.length) || 0, O = r ? `${A ? `Watching ${A} channel${A === 1 ? "" : "s"}` : "No channels yet"} · ${r.crew.live ? "running" : "paused"}` : "A small crew triaging your Slack channels", te = r ? Ne(b, r.source_state) : "checking", re = () => {
    N(), U();
  };
  return /* @__PURE__ */ a(F, { children: [
    /* @__PURE__ */ t(
      Ae,
      {
        title: "Slack Radar",
        subtitle: O,
        actions: /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-4", children: [
          /* @__PURE__ */ t(
            Ke,
            {
              tab: n,
              setTab: (I) => {
                j(null), s(I);
              }
            }
          ),
          r && /* @__PURE__ */ t(
            He,
            {
              state: r,
              configured: _,
              busy: L,
              onStart: () => u("Start crew", () => e.post(`${$}/crew/start`, {})),
              onPause: () => u("Pause crew", () => e.post(`${$}/crew/pause`, {}))
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ t("style", { children: Ee }),
    /* @__PURE__ */ a("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      z && n === "board" && /* @__PURE__ */ t(ze, { state: z, onOpenActivity: i }),
      r && te === "needs_login" && /* @__PURE__ */ t(Ge, { mcp: b, sourceError: r.source_error, busy: L, onCheck: re }),
      l && /* @__PURE__ */ t("p", { role: "status", className: "text-sm text-muted mb-3", children: l }),
      z ? n === "board" ? /* @__PURE__ */ t(
        Je,
        {
          state: z,
          needs: g,
          handled: v,
          configured: _,
          mcp: b,
          busy: L,
          onPoll: () => u("Poll", () => e.post(`${$}/poll`, {})),
          onStart: () => u("Start crew", () => e.post(`${$}/crew/start`, {})),
          onDigest: () => u("Request digest", () => e.post(`${$}/digest/request`, {})),
          events: f,
          onChanged: U
        }
      ) : n === "ledger" ? /* @__PURE__ */ t(
        it,
        {
          state: z,
          items: d,
          filter: D,
          setFilter: T,
          selected: W,
          setSelected: R,
          busy: L,
          onInvestigate: (I) => u("Investigate", async () => {
            await e.post(`${$}/investigate`, { keys: [...W], repo: I }), R(/* @__PURE__ */ new Set());
          })
        }
      ) : n === "team" ? /* @__PURE__ */ t(ht, { state: z }) : n === "activity" ? /* @__PURE__ */ t(mt, { events: f, kinds: P, onShowAll: () => j(null) }) : /* @__PURE__ */ t(pt, { state: z, busy: L, act: u, mcp: b, onProbe: N }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" })
    ] })
  ] });
}
function Te({ mcp: e, sourceError: n }) {
  var r;
  const s = [
    (e == null ? void 0 : e.status) && `status: ${e.status}`,
    (e == null ? void 0 : e.command) && `command: ${e.command}`,
    n && `error: ${n}`,
    (e == null ? void 0 : e.detail) && e.detail !== n && `detail: ${e.detail}`,
    ((r = e == null ? void 0 : e.missing_read_tools) == null ? void 0 : r.length) && `missing read tools: ${e.missing_read_tools.join(", ")}`
  ].filter(Boolean);
  return s.length ? /* @__PURE__ */ t(_e, { children: /* @__PURE__ */ t("pre", { className: "font-mono whitespace-pre-wrap", style: { margin: 0 }, children: s.join(`
`) }) }) : null;
}
function Ge({ mcp: e, sourceError: n, busy: s, onCheck: r }) {
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
          /* @__PURE__ */ t(S, { primary: !0, onClick: r, disabled: !!s, children: "I signed in, check again" })
        ] }),
        /* @__PURE__ */ t(Te, { mcp: e, sourceError: n })
      ]
    }
  );
}
function Re({ mcp: e, state: n, withPoll: s }) {
  const r = Ne(e, n.source_state), o = r === "connected";
  return /* @__PURE__ */ a("div", { className: "mb-4", children: [
    /* @__PURE__ */ a("p", { role: "status", className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { margin: 0 }, children: [
      /* @__PURE__ */ t("span", { "aria-hidden": !0, style: { width: 8, height: 8, borderRadius: "50%", background: o ? "var(--ok)" : r === "checking" ? "var(--muted-strong)" : "var(--warn)", display: "inline-block" } }),
      /* @__PURE__ */ a("span", { children: [
        "Slack connection: ",
        /* @__PURE__ */ t("span", { style: { color: o ? "var(--text)" : "var(--warn)" }, children: Ie[r] || r })
      ] }),
      s && /* @__PURE__ */ a("span", { children: [
        "· last poll ",
        H(n.last_poll_at),
        n.settings.channels.length > 0 && /* @__PURE__ */ a(F, { children: [
          " · watching ",
          n.settings.channels.join(", ")
        ] })
      ] })
    ] }),
    !o && r !== "needs_login" && /* @__PURE__ */ t(Te, { mcp: e, sourceError: n.source_error })
  ] });
}
function Je(e) {
  const { state: n } = e, [s, r] = h(""), [o, d] = dt(n.crew.slot_key), m = pe(null), g = (y) => {
    r(Ye(y)), d(!0), window.requestAnimationFrame(() => {
      var v;
      return (v = m.current) == null ? void 0 : v.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };
  return /* @__PURE__ */ a("div", { style: { minWidth: 0 }, children: [
    /* @__PURE__ */ a("div", { className: "flex flex-wrap items-start gap-3", children: [
      /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(Re, { mcp: e.mcp, state: n, withPoll: !0 }) }),
      /* @__PURE__ */ t(S, { onClick: e.onPoll, disabled: !!e.busy || !e.configured, children: "Poll now" })
    ] }),
    /* @__PURE__ */ t("div", { ref: m, children: /* @__PURE__ */ t(
      ct,
      {
        state: n,
        events: e.events,
        configured: e.configured,
        busy: e.busy,
        expanded: o,
        setExpanded: d,
        pending: s,
        setPending: r,
        onStart: e.onStart,
        onChanged: e.onChanged
      }
    ) }),
    !e.configured && /* @__PURE__ */ a(M, { className: "mb-4", children: [
      /* @__PURE__ */ t(Q, { children: "Finish setup" }),
      /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite." })
    ] }),
    /* @__PURE__ */ t(
      nt,
      {
        needs: e.needs,
        today: n.crew.today,
        handled: e.handled,
        onChanged: e.onChanged,
        onWhy: g
      }
    ),
    /* @__PURE__ */ t(lt, { state: n, busy: e.busy, onDigest: e.onDigest })
  ] });
}
const fe = {
  decide: "Needs a decision",
  unanswered: "Questions nobody answered",
  clusters: "Reported more than once"
};
function Qe(e) {
  return e < 1 ? `${Math.max(1, Math.round(e * 60))} min ago` : e < 48 ? `${Math.round(e)} h ago` : `${Math.floor(e / 24)} days ago`;
}
const ve = 5;
function Ye(e) {
  return `Why is "${e.summary.length > 80 ? `${e.summary.slice(0, 79)}…` : e.summary}" ${e.priority || "on my list"}?`;
}
function qe(e) {
  return e ? /* @__PURE__ */ t(G, { variant: e === "p0" || e === "p1" ? "err" : "muted", children: e }) : null;
}
function Z({ message: e, onRetry: n }) {
  return /* @__PURE__ */ a(
    "div",
    {
      role: "alert",
      className: "text-sm flex flex-wrap items-center gap-2",
      style: { border: "1px solid var(--danger)", borderRadius: 8, padding: "8px 12px", margin: "8px 0" },
      children: [
        /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200 }, children: e }),
        /* @__PURE__ */ t(S, { onClick: n, children: "Try again" })
      ]
    }
  );
}
const E = { fontSize: 12, padding: "2px 10px" };
function Ve(e, n) {
  return e === "decide" && n.dispatch ? "Done" : e === "decide" && n.handoff_title ? "Dispatch fix" : e === "decide" && n.reply_draft ? "Reply" : e === "decide" && n.reason.startsWith("Looks resolved") ? "Done" : e === "unanswered" && n.permalink ? "Reply" : "Decide";
}
function Xe({
  e,
  groupId: n,
  first: s,
  onMark: r,
  onWhy: o,
  onDispatch: d,
  onSend: m,
  busy: g
}) {
  const y = Ve(n, e), v = n === "decide" && !!e.reply_draft && !e.handoff_title && !!m, [c, f] = h(!1), [k, D] = h(e.reply_draft || "");
  q(() => D(e.reply_draft || ""), [e.reply_draft]);
  const T = pe(null), W = e.key.replace(/[^A-Za-z0-9]/g, "-"), R = `sr-reply-${n}-${W}`, L = `sr-row-${n}-${W}`, w = e.dispatch, l = () => e.permalink && window.open(e.permalink, "_blank", "noopener,noreferrer"), p = () => {
    y === "Dispatch fix" ? d == null || d() : y === "Done" ? r("done") : y === "Reply" && !v ? l() : (f(!0), v && window.requestAnimationFrame(() => {
      var C;
      return (C = T.current) == null ? void 0 : C.focus();
    }));
  }, b = [
    ...y !== "Done" ? [{ label: v ? "Done without sending" : "Done", onClick: () => r("done") }] : [],
    { label: "Ignore", onClick: () => r("ignored") },
    { label: "Why? Ask the lead", onClick: o }
  ];
  return /* @__PURE__ */ a(
    "li",
    {
      className: "text-sm",
      "data-testid": "need-row",
      "data-priority": e.priority || "",
      "data-age-hours": e.age_hours,
      style: { padding: "8px 0", borderTop: s ? 0 : "1px solid var(--border)" },
      children: [
        /* @__PURE__ */ a("div", { className: "flex items-start gap-2", children: [
          /* @__PURE__ */ t("div", { style: { flex: "none", minWidth: 28 }, children: qe(e.priority) }),
          /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
            /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
            /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
              e.reason,
              " · ",
              /* @__PURE__ */ t("span", { "data-testid": "need-age", children: Qe(e.age_hours) })
            ] }),
            w && /* @__PURE__ */ a("div", { className: "text-xs", style: { marginTop: 2 }, "data-testid": "fix-in-progress", children: [
              /* @__PURE__ */ t(de, { d: w }),
              " · ",
              me[w.state] || w.state,
              w.pr_url && /* @__PURE__ */ a(F, { children: [
                " · ",
                /* @__PURE__ */ a("a", { className: "underline", href: w.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
                  "PR #",
                  w.pr_number
                ] })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ a("div", { className: "flex items-center gap-1", style: { flex: "none" }, "data-testid": "need-actions", children: [
            /* @__PURE__ */ t(S, { primary: !0, style: E, onClick: p, disabled: y === "Dispatch fix" && g, children: y === "Dispatch fix" && g ? "Dispatching…" : y }),
            /* @__PURE__ */ t(
              "button",
              {
                type: "button",
                "aria-expanded": c,
                "aria-controls": L,
                "aria-label": c ? "Hide details" : "Show details and more actions",
                title: c ? "Hide details" : "Details and more actions",
                onClick: () => f(!c),
                style: { border: 0, background: "transparent", cursor: "pointer", padding: "2px 8px", borderRadius: 6, color: "var(--muted)" },
                children: c ? "▴" : "▾"
              }
            )
          ] })
        ] }),
        c && /* @__PURE__ */ a("div", { id: L, "data-testid": "need-more", style: { margin: "6px 0 0 36px" }, children: [
          /* @__PURE__ */ a("div", { className: "text-xs text-muted", children: [
            /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
            e.category && /* @__PURE__ */ a(F, { children: [
              " · ",
              e.category
            ] }),
            e.words && e.words.length > 0 && /* @__PURE__ */ a(F, { children: [
              " · shared words: ",
              e.words.join(", ")
            ] }),
            e.members && e.members.length > 0 && /* @__PURE__ */ a(F, { children: [
              " · Done and Ignore apply to all ",
              e.members.length
            ] }),
            e.permalink && /* @__PURE__ */ a(F, { children: [
              " · ",
              /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open in Slack" })
            ] })
          ] }),
          e.handoff_title && !w && /* @__PURE__ */ a("div", { className: "text-xs", style: { marginTop: 4 }, children: [
            "Fix: ",
            e.handoff_title
          ] }),
          v && /* @__PURE__ */ a(F, { children: [
            /* @__PURE__ */ t("label", { htmlFor: R, className: "text-xs text-muted", style: { display: "block", marginTop: 6 }, children: "Reply to the thread, sent as you" }),
            /* @__PURE__ */ t(
              "textarea",
              {
                id: R,
                ref: T,
                value: k,
                maxLength: 1500,
                rows: 3,
                onChange: (C) => D(C.target.value),
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
          /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-1", style: { marginTop: 6 }, "data-testid": "need-secondary", children: [
            v && /* @__PURE__ */ t(
              S,
              {
                primary: !0,
                style: E,
                disabled: !k.trim(),
                onClick: () => m == null ? void 0 : m(k.trim(), k.trim() !== (e.reply_draft || "").trim()),
                children: "Send to thread"
              }
            ),
            b.map((C) => /* @__PURE__ */ t(S, { style: E, onClick: C.onClick, children: C.label }, C.label))
          ] })
        ] })
      ]
    }
  );
}
function Ze({ g: e, render: n }) {
  const [s, r] = h(!1), o = s ? e.shown : e.shown.slice(0, ve), d = e.shown.length - o.length;
  return /* @__PURE__ */ a(F, { children: [
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: o.map(n) }),
    (d > 0 || s && e.shown.length > ve) && /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        className: "text-xs underline",
        onClick: () => r(!s),
        style: { border: 0, background: "transparent", cursor: "pointer", padding: "4px 0", color: "var(--muted)" },
        children: s ? "Show fewer" : `Show ${d} more`
      }
    )
  ] });
}
const We = typeof xe.useChatLauncher == "function" ? xe.useChatLauncher : () => null, me = { running: "working", idle: "waiting", closed: "session closed", unknown: "" };
function de({ d: e }) {
  const n = We(), s = `/chat?sid=${encodeURIComponent(e.session_key)}`;
  return /* @__PURE__ */ t(
    "a",
    {
      className: "underline",
      href: s,
      onClick: (r) => {
        n && (r.preventDefault(), n.openChat({ slotKey: e.session_key }));
      },
      children: e.title || "Fix session"
    }
  );
}
function be(e) {
  try {
    return JSON.parse(String(e.body || "{}"));
  } catch {
    return {};
  }
}
function et(e) {
  const n = ne(), s = We(), [r, o] = h(""), [d, m] = h(null), [g, y] = h(null), [v, c] = h(null), [f, k] = h(null), [D, T] = h(!1), W = async (l) => {
    if (!r) {
      o(l), y(null);
      try {
        const p = await n.post(`${$}/items/handoff/dispatch`, { key: l });
        p.mode === "server" ? m({ session_key: p.session_key, title: p.title }) : s ? s.openChat({ agent: p.agent, message: p.seed, autoSend: !0 }) : (T(!1), k({ title: p.title, seed: p.seed })), e();
      } catch (p) {
        const b = be(p);
        b.code === "already_dispatched" && b.session_key ? m({ session_key: b.session_key, title: b.title || "", again: !0 }) : y({ key: l, why: b.error || "the gateway refused it" });
      } finally {
        o("");
      }
    }
  }, R = async (l) => {
    var p;
    if (r || l.length === 0) return !1;
    o("batch"), c(null);
    try {
      const b = await n.post(`${$}/items/handoff/dispatch-batch`, { keys: l });
      return b.mode === "server" ? m({ session_key: b.session_key, title: b.title, batch: !0 }) : s ? s.openChat({ agent: b.agent, message: b.seed, autoSend: !0 }) : (T(!1), k({ title: b.title, seed: b.seed })), e(), !0;
    } catch (b) {
      const C = be(b), x = (p = C.dispatched) != null && p.length ? `${C.dispatched.length} of them already have a session` : C.error || "the gateway refused it";
      return c({ keys: l, why: x }), !1;
    } finally {
      o("");
    }
  }, L = async () => {
    if (f)
      try {
        await navigator.clipboard.writeText(f.seed), T(!0);
      } catch {
        T(!1);
      }
  }, w = /* @__PURE__ */ a(F, { children: [
    g && /* @__PURE__ */ t(Z, { message: `Could not dispatch that fix: ${g.why}. Nothing was sent.`, onRetry: () => W(g.key) }),
    v && /* @__PURE__ */ t(
      Z,
      {
        message: `Could not dispatch those fixes: ${v.why}. Nothing was sent.`,
        onRetry: () => R(v.keys)
      }
    ),
    d && /* @__PURE__ */ a(
      "div",
      {
        role: "status",
        "data-testid": "dispatch-toast",
        className: "text-sm flex items-center gap-2",
        style: { position: "fixed", right: 16, bottom: 16, zIndex: 40, background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "8px 12px", maxWidth: 480 },
        children: [
          /* @__PURE__ */ a("span", { style: { flex: 1, minWidth: 0 }, children: [
            d.again ? "Already dispatched: " : d.batch ? "Fixes dispatched to one conductor: " : "Fix dispatched to a conductor: ",
            /* @__PURE__ */ t(de, { d })
          ] }),
          /* @__PURE__ */ t(S, { style: E, onClick: () => m(null), children: "Close" })
        ]
      }
    ),
    f && /* @__PURE__ */ t(
      "div",
      {
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "sr-fix-title",
        style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" },
        onKeyDown: (l) => l.key === "Escape" && k(null),
        children: /* @__PURE__ */ a("div", { style: { width: "min(720px, 92vw)", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: 16 }, children: [
          /* @__PURE__ */ t("h3", { id: "sr-fix-title", className: "text-sm", style: { margin: "0 0 6px", fontWeight: 600 }, children: f.title }),
          /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 8px" }, children: "This Kiro Crew cannot open the session for you. Copy this task into a new kirocrew-conductor chat." }),
          /* @__PURE__ */ t(
            "textarea",
            {
              readOnly: !0,
              "aria-label": "Fix task",
              value: f.seed,
              style: { width: "100%", height: 260, fontSize: 12, fontFamily: "var(--font-mono, monospace)" }
            }
          ),
          /* @__PURE__ */ a("div", { className: "flex items-center gap-2", style: { marginTop: 8 }, children: [
            /* @__PURE__ */ t(S, { onClick: L, children: D ? "Copied" : "Copy task" }),
            /* @__PURE__ */ t("a", { className: "underline text-sm", href: "/chat?new=1", children: "New chat" }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(S, { onClick: () => k(null), children: "Close" })
          ] })
        ] })
      }
    )
  ] });
  return { dispatch: W, dispatchBatch: R, busyKey: r, ui: w };
}
function tt({
  rows: e,
  busy: n,
  onSend: s,
  onCancel: r
}) {
  const [o, d] = h(() => new Set(e.map((c) => c.key))), m = e.filter((c) => o.has(c.key)), y = new Set(m.map((c) => c.repo.toLowerCase())).size > 1, v = (c) => d((f) => {
    const k = new Set(f);
    return k.has(c) ? k.delete(c) : k.add(c), k;
  });
  return /* @__PURE__ */ a(
    "section",
    {
      "aria-label": "Dispatch fixes together",
      "data-testid": "batch-panel",
      style: { margin: "8px 0", padding: 10, border: "1px solid var(--border-strong)", borderRadius: 8 },
      children: [
        /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 6px" }, children: "One conductor gets every checked fix and splits the work. Uncheck any you want to leave out." }),
        /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { margin: 0, padding: 0, listStyle: "none" }, children: e.map((c, f) => /* @__PURE__ */ t("li", { style: { padding: "6px 0", borderTop: f === 0 ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ a("label", { className: "text-sm flex gap-2", style: { alignItems: "flex-start", cursor: "pointer" }, children: [
          /* @__PURE__ */ t("input", { type: "checkbox", checked: o.has(c.key), onChange: () => v(c.key), style: { marginTop: 3 } }),
          /* @__PURE__ */ a("span", { style: { flex: 1, minWidth: 0 }, children: [
            c.title,
            " ",
            /* @__PURE__ */ t("span", { className: "text-xs text-muted font-mono", children: c.repo }),
            /* @__PURE__ */ t("span", { className: "text-xs text-muted", style: { display: "block" }, children: c.prompt.length > 120 ? `${c.prompt.slice(0, 120)}…` : c.prompt })
          ] })
        ] }) }, c.key)) }),
        /* @__PURE__ */ a("div", { className: "flex items-center gap-2", style: { marginTop: 8 }, children: [
          /* @__PURE__ */ t(S, { primary: !0, style: E, disabled: n || m.length === 0 || y, onClick: () => s(m.map((c) => c.key)), children: n ? "Dispatching…" : `Dispatch ${m.length} to one conductor` }),
          /* @__PURE__ */ t(S, { style: E, onClick: r, disabled: n, children: "Cancel" }),
          y && /* @__PURE__ */ t("span", { className: "text-xs text-muted", role: "status", children: "one repo per batch" })
        ] })
      ]
    }
  );
}
function nt({
  needs: e,
  today: n,
  handled: s,
  onChanged: r,
  onWhy: o
}) {
  var z;
  const d = ne(), m = et(r), g = (e == null ? void 0 : e.fixes) || [], y = (e == null ? void 0 : e.fix_batches) || [], v = new Map(y.map((i) => [i.session_key, i])), c = new Map(((e == null ? void 0 : e.handoffs) || []).map((i) => [i.key, i.handoff])), f = (((z = ((e == null ? void 0 : e.groups) || []).find((i) => i.id === "decide")) == null ? void 0 : z.entries) || []).filter((i) => i.handoff_title && !i.dispatch && c.has(i.key)).map((i) => {
    const u = c.get(i.key);
    return { key: i.key, title: i.handoff_title || u.title, repo: u.repo || "", prompt: u.prompt || "" };
  }), [k, D] = h(!1), [T, W] = h(null), [R, L] = h("");
  q(() => {
    if (!R) return;
    const i = window.setTimeout(() => L(""), 4e3);
    return () => window.clearTimeout(i);
  }, [R]);
  const w = async (i, u, _, A) => {
    W(null), B((O) => new Set(O).add(A));
    try {
      _ && await d.post(`${$}/items/reply/draft`, { key: i, text: u }), await d.post(`${$}/items/reply/send`, { key: i }), L("Sent as you"), r();
    } catch (O) {
      B((te) => {
        const re = new Set(te);
        return re.delete(A), re;
      }), W({ key: i, text: u, edited: _, why: O.message || "unknown error" });
    }
  }, l = (e == null ? void 0 : e.replied) || [], [p, b] = h(""), C = async (i) => {
    b("");
    try {
      await d.post(`${$}/items/handoff/dismiss`, { key: i }), r();
    } catch {
      b(i);
    }
  }, [x, B] = h(/* @__PURE__ */ new Set()), [P, j] = h(null);
  q(() => B(/* @__PURE__ */ new Set()), [e]);
  const N = async (i, u, _) => {
    j(null), _ && B((A) => new Set(A).add(_));
    try {
      for (const A of i) await d.post(`${$}/items/handle`, { key: A, how: u });
      r();
    } catch {
      _ && B((A) => {
        const O = new Set(A);
        return O.delete(_), O;
      }), j({ keys: i, how: u, rowId: _ });
    }
  }, U = ((e == null ? void 0 : e.groups) || []).map((i) => ({
    ...i,
    shown: i.entries.filter((u) => !x.has(`${i.id}:${u.key}`))
  })), se = U.every((i) => i.shown.length === 0), ee = (P == null ? void 0 : P.how) === "reopen" ? "reopen" : (P == null ? void 0 : P.how) === "ignored" ? "ignore" : "mark as done";
  return /* @__PURE__ */ a(M, { className: "mb-4", children: [
    /* @__PURE__ */ a("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ t(Q, { children: "Needs you" }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      f.length >= 2 && !k && /* @__PURE__ */ a(S, { style: E, onClick: () => D(!0), disabled: !!m.busyKey, children: [
        "Dispatch all fixes (",
        f.length,
        ")"
      ] })
    ] }),
    k && f.length > 0 && /* @__PURE__ */ t(
      tt,
      {
        rows: f,
        busy: m.busyKey === "batch",
        onCancel: () => D(!1),
        onSend: async (i) => {
          await m.dispatchBatch(i) && D(!1);
        }
      }
    ),
    (n == null ? void 0 : n.text) && /* @__PURE__ */ a("p", { className: "text-sm", style: { margin: "0 0 8px" }, "data-testid": "crew-today", children: [
      n.text,
      n.at > 0 && /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
        " · ",
        H(n.at)
      ] })
    ] }),
    R && /* @__PURE__ */ t("p", { role: "status", className: "text-sm", style: { margin: "0 0 8px", color: "var(--success, var(--text))" }, children: R }),
    T && /* @__PURE__ */ t(
      Z,
      {
        message: `Could not send that reply: ${T.why}`,
        onRetry: () => w(T.key, T.text, T.edited, `decide:${T.key}`)
      }
    ),
    P && /* @__PURE__ */ t(
      Z,
      {
        message: `Could not ${ee} that message. Nothing changed.`,
        onRetry: () => N(P.keys, P.how, P.rowId)
      }
    ),
    e ? se ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Nothing needs you right now." }) : U.map(
      (i) => i.shown.length === 0 ? null : /* @__PURE__ */ a("section", { "aria-label": fe[i.id], style: { marginTop: 10 }, children: [
        /* @__PURE__ */ a("h4", { className: "text-sm", style: { margin: 0, fontWeight: 600, color: "var(--text-strong)" }, children: [
          fe[i.id],
          " ",
          /* @__PURE__ */ a("span", { className: "text-muted", style: { fontWeight: 400 }, children: [
            "(",
            i.total - (i.entries.length - i.shown.length),
            ")"
          ] })
        ] }),
        /* @__PURE__ */ t(
          Ze,
          {
            g: i,
            render: (u, _) => /* @__PURE__ */ t(
              Xe,
              {
                e: u,
                groupId: i.id,
                first: _ === 0,
                onMark: (A) => {
                  var O;
                  return N((O = u.members) != null && O.length ? u.members : [u.key], A, `${i.id}:${u.key}`);
                },
                onWhy: () => o(u),
                onDispatch: i.id === "decide" && u.handoff_title ? () => m.dispatch(u.key) : void 0,
                onSend: i.id === "decide" ? (A, O) => w(u.key, A, O, `${i.id}:${u.key}`) : void 0,
                busy: m.busyKey === u.key
              },
              u.key
            )
          }
        )
      ] }, i.id)
    ) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" }),
    p && /* @__PURE__ */ t(Z, { message: "Could not dismiss that hand-off. Nothing changed.", onRetry: () => C(p) }),
    g.length > 0 && /* @__PURE__ */ a("details", { style: { marginTop: 12 }, "data-testid": "fixes-in-flight", children: [
      /* @__PURE__ */ a("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Fixes in flight (",
        (e == null ? void 0 : e.fixes_total) ?? g.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: g.map((i, u) => {
        const _ = i.dispatch.batch ? v.get(i.dispatch.session_key) : void 0, A = _ && _.keys[0] === i.key, O = { padding: "6px 0", borderTop: u === 0 ? 0 : "1px solid var(--border)" }, te = i.dispatch.pr_url && /* @__PURE__ */ a(F, { children: [
          " · ",
          /* @__PURE__ */ a("a", { className: "underline", href: i.dispatch.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
            "PR #",
            i.dispatch.pr_number
          ] })
        ] });
        return /* @__PURE__ */ a("li", { className: "text-sm", style: _ ? { ...O, ...A ? {} : { borderTop: 0, paddingTop: 0 } } : O, children: [
          A && _ && /* @__PURE__ */ a("div", { "data-testid": "fix-batch-header", style: { marginBottom: 4 }, children: [
            /* @__PURE__ */ t(de, { d: _ }),
            /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
              " · ",
              me[_.state] || _.state || "sent",
              " · ",
              /* @__PURE__ */ t("span", { className: "font-mono", children: _.repo }),
              " · ",
              _.prs_found,
              " PRs found / ",
              _.total,
              " · ",
              H(_.at)
            ] })
          ] }),
          /* @__PURE__ */ a("div", { className: "flex items-center gap-2", style: _ ? { paddingLeft: 16 } : void 0, children: [
            /* @__PURE__ */ a("span", { style: { flex: 1, minWidth: 0 }, children: [
              _ ? i.handoff_title : /* @__PURE__ */ a(F, { children: [
                /* @__PURE__ */ t(de, { d: i.dispatch }),
                /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
                  " · ",
                  me[i.dispatch.state] || i.dispatch.state || "sent",
                  " · ",
                  /* @__PURE__ */ t("span", { className: "font-mono", children: i.repo }),
                  " · ",
                  H(i.dispatch.at)
                ] })
              ] }),
              te
            ] }),
            /* @__PURE__ */ t(S, { style: E, onClick: () => C(i.key), children: "Dismiss" })
          ] })
        ] }, i.key);
      }) })
    ] }),
    ((e == null ? void 0 : e.handled_total) || 0) > 0 && /* @__PURE__ */ a("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ a("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Handled (",
        e == null ? void 0 : e.handled_total,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: s.map((i, u) => /* @__PURE__ */ a(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: u === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 0 }, children: i.summary || i.text.slice(0, 200) }),
            /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
              i.handled_how === "ignored" ? "Ignored" : "Done",
              " ",
              H(i.handled_at)
            ] }),
            /* @__PURE__ */ t(S, { style: E, onClick: () => N([i.key], "reopen"), children: "Reopen" })
          ]
        },
        i.key
      )) })
    ] }),
    l.length > 0 && /* @__PURE__ */ a("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ a("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Replied (",
        (e == null ? void 0 : e.replied_total) ?? l.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: l.map((i, u) => /* @__PURE__ */ a(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: u === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ a("span", { style: { flex: 1, minWidth: 0 }, children: [
              i.text.length > 120 ? `${i.text.slice(0, 119)}…` : i.text,
              /* @__PURE__ */ a("span", { className: "text-xs text-muted", children: [
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
    m.ui
  ] });
}
function at({ it: e, first: n, checked: s, onToggle: r }) {
  const o = e.priority ? { label: e.priority, variant: e.priority === "p0" || e.priority === "p1" ? "err" : "muted" } : e.possibly_resolved ? { label: "possibly resolved", variant: "warn" } : null, d = [
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
        onChange: r,
        style: { marginTop: 4 }
      }
    ),
    /* @__PURE__ */ a("div", { className: "flex items-center gap-1", style: { flex: "none" }, children: [
      /* @__PURE__ */ t(G, { variant: Ue(e.status), children: e.status }),
      o && /* @__PURE__ */ t(G, { variant: o.variant, children: o.label }),
      d.length > 0 && /* @__PURE__ */ a("span", { className: "text-xs text-muted", title: d.join(`
`), "aria-label": d.join("; "), children: [
        "+",
        d.length
      ] })
    ] }),
    /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || e.text.slice(0, 280) }),
      /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        /* @__PURE__ */ t("span", { "data-testid": "ledger-ts", "data-ts": e.ts_float, children: H(e.ts_float) }),
        " · ",
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        e.user && /* @__PURE__ */ a(F, { children: [
          " · ",
          e.user
        ] }),
        e.reply_count > 0 && /* @__PURE__ */ a(F, { children: [
          " · ",
          e.reply_count,
          " replies"
        ] }),
        " · ",
        /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "open in Slack" }),
        e.links.length > 0 && /* @__PURE__ */ a(F, { children: [
          " · linked ",
          e.links.map((m) => /* @__PURE__ */ t("a", { className: "underline mr-2", href: m, target: "_blank", rel: "noreferrer noopener", children: m.replace("https://github.com/", "") }, m))
        ] })
      ] }),
      e.note && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: e.note })
    ] })
  ] }) });
}
function st(e) {
  var n, s;
  return !!((n = e.reply_draft) != null && n.text || (s = e.fix_handoff) != null && s.prompt || e.possibly_resolved);
}
const rt = ["", "p0", "p1", "p2", "p3", "none"];
function it(e) {
  const { state: n, items: s, selected: r, setSelected: o } = e, [d, m] = h(""), [g, y] = h(""), [v, c] = h(""), [f, k] = h(!1), D = n.counts.open_by_priority, T = oe(() => [...new Set(s.map((l) => l.category).filter(Boolean))].sort(), [s]), W = oe(
    () => s.filter((l) => !g || (g === "none" ? !l.priority : l.priority === g)).filter((l) => !v || l.category === v).filter((l) => !f || st(l)).sort((l, p) => (p.ts_float || 0) - (l.ts_float || 0)),
    [s, g, v, f]
  ), R = (l) => {
    const p = new Set(r);
    p.has(l) ? p.delete(l) : p.add(l), o(p);
  }, L = oe(
    () => n.settings.channels.map((l) => ({ cid: l, ...n.channels[l] || {} })),
    [n]
  ), w = "text-sm bg-transparent border rounded px-2 py-1";
  return /* @__PURE__ */ a("div", { style: { minWidth: 0 }, children: [
    /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4", children: [
      /* @__PURE__ */ t(le, { label: "Awaiting triage", value: n.counts.needs_triage, accent: !0 }),
      /* @__PURE__ */ t(le, { label: "Possibly resolved", value: n.counts.possibly_resolved }),
      /* @__PURE__ */ t(le, { label: "Open p0 / p1", value: `${D.p0 || 0} / ${D.p1 || 0}` }),
      /* @__PURE__ */ t(le, { label: "Tracked items", value: n.counts.total })
    ] }),
    /* @__PURE__ */ a(M, { className: "mb-4", children: [
      /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2 mb-3", children: [
        /* @__PURE__ */ t(Q, { children: "Ledger" }),
        /* @__PURE__ */ a("span", { className: "text-xs text-muted", "data-testid": "ledger-count", children: [
          W.length,
          " of ",
          s.length,
          " · newest first"
        ] }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-filter", children: "Status" }),
        /* @__PURE__ */ a("select", { id: "sr-filter", className: w, value: e.filter, onChange: (l) => e.setFilter(l.target.value), children: [
          /* @__PURE__ */ t("option", { value: "open", children: "open" }),
          /* @__PURE__ */ t("option", { value: "new", children: "new" }),
          /* @__PURE__ */ t("option", { value: "triaged", children: "triaged" }),
          /* @__PURE__ */ t("option", { value: "investigating", children: "investigating" }),
          /* @__PURE__ */ t("option", { value: "resolved", children: "resolved" }),
          /* @__PURE__ */ t("option", { value: "noise", children: "noise" }),
          /* @__PURE__ */ t("option", { value: "", children: "all" })
        ] }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-priority", children: "Priority" }),
        /* @__PURE__ */ t("select", { id: "sr-priority", className: w, value: g, onChange: (l) => y(l.target.value), children: rt.map((l) => /* @__PURE__ */ t("option", { value: l, children: l || "all" }, l)) }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-category", children: "Category" }),
        /* @__PURE__ */ a("select", { id: "sr-category", className: w, value: v, onChange: (l) => c(l.target.value), children: [
          /* @__PURE__ */ t("option", { value: "", children: "all" }),
          T.map((l) => /* @__PURE__ */ t("option", { value: l, children: l }, l))
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm flex items-center gap-1", style: { cursor: "pointer" }, children: [
          /* @__PURE__ */ t("input", { type: "checkbox", checked: f, onChange: (l) => k(l.target.checked) }),
          "Needs me"
        ] }),
        /* @__PURE__ */ t("div", { className: "flex-1" }),
        /* @__PURE__ */ t(
          K,
          {
            "aria-label": "GitHub repository to search (owner/name, optional)",
            placeholder: "owner/repo (optional)",
            value: d,
            onChange: (l) => m(l.target.value),
            className: "w-48"
          }
        ),
        /* @__PURE__ */ a(S, { onClick: () => e.onInvestigate(d), disabled: r.size === 0 || !!e.busy, children: [
          "Investigate ",
          r.size || ""
        ] })
      ] }),
      W.length === 0 ? /* @__PURE__ */ t(
        Be,
        {
          icon: /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "📡" }),
          title: s.length ? "Nothing matches these filters" : "Nothing here yet",
          subtitle: s.length ? "Change a filter to see more." : "New messages appear after the next poll."
        }
      ) : /* @__PURE__ */ t("ul", { className: "flex flex-col", "data-testid": "ledger-list", children: W.map((l, p) => /* @__PURE__ */ t(at, { it: l, first: p === 0, checked: r.has(l.key), onToggle: () => R(l.key) }, l.key)) })
    ] }),
    /* @__PURE__ */ a(M, { children: [
      /* @__PURE__ */ t(Q, { children: "Channels" }),
      L.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No channels configured." }) : /* @__PURE__ */ a("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ t("thead", { children: /* @__PURE__ */ a("tr", { className: "text-left text-muted", children: [
          /* @__PURE__ */ t("th", { scope: "col", children: "Channel" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Last polled" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Status" })
        ] }) }),
        /* @__PURE__ */ t("tbody", { children: L.map((l) => /* @__PURE__ */ a("tr", { children: [
          /* @__PURE__ */ t("td", { className: "font-mono", children: l.cid }),
          /* @__PURE__ */ t("td", { children: ue(l.last_polled_at) }),
          /* @__PURE__ */ t("td", { children: l.last_error ? /* @__PURE__ */ t(G, { variant: "err", title: l.last_error, children: "error" }) : /* @__PURE__ */ t(G, { variant: "ok", children: "ok" }) })
        ] }, l.cid)) })
      ] })
    ] })
  ] });
}
function lt({ state: e, busy: n, onDigest: s }) {
  const r = e.digest, o = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), d = r.last_posted_date === o;
  return /* @__PURE__ */ a(M, { className: "mb-4", children: [
    /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ t(Q, { children: d ? "Today's digest" : "Latest digest" }),
      r.pending ? /* @__PURE__ */ t(G, { variant: "aim", children: "being delivered" }) : null,
      /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: r.last_posted_date ? `${r.last_posted_date} · ${e.settings.digest_destination === "self_dm" ? "DMed to you" : "dashboard notification"}` : "none yet" }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      /* @__PURE__ */ t(S, { onClick: s, disabled: !!n || !e.crew.live, children: "Request digest" })
    ] }),
    r.last_text ? /* @__PURE__ */ t("pre", { className: "whitespace-pre-wrap text-sm mt-2", style: { fontFamily: "inherit", margin: "8px 0 0" }, children: r.last_text }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted mt-2", children: "The Radar Lead writes one after the daily cron or when you press Request digest." }),
    r.last_error && /* @__PURE__ */ t("p", { className: "text-xs mt-1", style: { color: "var(--danger)" }, children: r.last_error })
  ] });
}
function ot({ state: e }) {
  return /* @__PURE__ */ t("div", { className: "flex items-center gap-2", style: { marginTop: 10 }, children: ae.map((n) => /* @__PURE__ */ a("span", { title: `${n.title} · ${V(n, e).label}`, children: [
    /* @__PURE__ */ t(ge, { m: n, s: e, selected: n.id === "lead", size: 30 }),
    /* @__PURE__ */ t("span", { className: "sr-only", children: `${n.title}: ${V(n, e).label}` })
  ] }, n.id)) });
}
function dt(e) {
  const n = `slack-radar:chat-open:${e}`, s = () => {
    try {
      return window.localStorage.getItem(n) === "1";
    } catch {
      return !1;
    }
  }, [r, o] = h(s);
  q(() => o(s()), [n]);
  const d = he(
    (m) => {
      o(m);
      try {
        m ? window.localStorage.setItem(n, "1") : window.localStorage.removeItem(n);
      } catch {
      }
    },
    [n]
  );
  return [r, d];
}
function we({ q: e, onClick: n, disabled: s }) {
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
function ct(e) {
  const n = ne(), { state: s, expanded: r, pending: o } = e, d = ae[0], m = s.crew.slot_key, g = s.crew.live && s.crew.session_open && s.crew.session_agent === s.crew.agent, [y, v] = h(""), [c, f] = h(!1), [k, D] = h(""), [T, W] = h(!1), R = V(d, s), L = async (x) => {
    await n.post(`${$}/crew/message`, { message: x }), e.onChanged();
  }, w = async (x) => {
    const B = x.trim();
    if (B) {
      f(!0), D("");
      try {
        await n.post(`${$}/crew/message`, { message: B }), v(""), B === o && e.setPending(""), e.setExpanded(!0), e.onChanged();
      } catch {
        D(B);
      } finally {
        f(!1);
      }
    }
  }, l = async () => {
    try {
      await navigator.clipboard.writeText(o), W(!0), window.setTimeout(() => W(!1), 1500);
    } catch {
      W(!1);
    }
  }, p = k && /* @__PURE__ */ t(Z, { message: "The Radar Lead did not get that message.", onRetry: () => w(k) }), b = /* @__PURE__ */ t("div", { className: "text-sm", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }, children: s.crew.live ? /* @__PURE__ */ a(F, { children: [
    /* @__PURE__ */ t("span", { children: "The Radar Lead session opens on its next turn. Open it now to talk here." }),
    /* @__PURE__ */ t(S, { primary: !0, onClick: e.onStart, disabled: !!e.busy || !e.configured, children: "Open the session" })
  ] }) : /* @__PURE__ */ a("span", { children: [
    "The Radar Lead is paused. Turn on ",
    /* @__PURE__ */ t("b", { children: "Crew" }),
    " at the top of the page to triage your channels and talk to it here."
  ] }) });
  if (!r)
    return /* @__PURE__ */ a(M, { className: "mb-4", style: { padding: "10px 14px" }, children: [
      /* @__PURE__ */ a(
        "form",
        {
          className: "flex flex-wrap items-center gap-2",
          onSubmit: (x) => {
            x.preventDefault(), w(y);
          },
          children: [
            /* @__PURE__ */ t(ge, { m: d, s, size: 26 }),
            /* @__PURE__ */ t(
              K,
              {
                "aria-label": "Ask the lead",
                placeholder: "Ask the lead…",
                value: y,
                onChange: (x) => v(x.target.value),
                disabled: !g || c,
                style: { flex: 1, minWidth: 200 }
              }
            ),
            /* @__PURE__ */ t(S, { primary: !0, type: "submit", disabled: !g || c || !y.trim(), children: "Send" }),
            ye.map((x) => /* @__PURE__ */ t(we, { q: x, onClick: () => w(x), disabled: !g || c }, x))
          ]
        }
      ),
      !g && /* @__PURE__ */ t("div", { style: { marginTop: 8 }, children: b }),
      p
    ] });
  const C = e.events.filter((x) => x.kind === "crew" || x.kind === "digest").slice(0, 5);
  return /* @__PURE__ */ a(
    M,
    {
      className: "mb-4",
      style: { padding: 0, display: "flex", flexDirection: "column", height: "min(620px, calc(100vh - 180px))", overflow: "hidden" },
      children: [
        /* @__PURE__ */ a("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border)" }, children: [
          /* @__PURE__ */ a("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: s.crew.name || d.title }),
            /* @__PURE__ */ t(G, { variant: R.tone === "muted" ? "muted" : R.tone === "aim" ? "aim" : "ok", children: R.label }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t(S, { onClick: () => e.setExpanded(!1), "aria-expanded": !0, children: "Collapse" })
          ] }),
          /* @__PURE__ */ a("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
            "phase ",
            s.crew_memory.phase,
            " · next: ",
            s.crew_memory.next || "—"
          ] }),
          /* @__PURE__ */ t(ot, { state: s })
        ] }),
        /* @__PURE__ */ t(je, { state: s }),
        o && // ChatEmbed has no API to fill its composer, so the question waits here.
        /* @__PURE__ */ a(
          "div",
          {
            className: "text-sm flex flex-wrap items-center gap-2",
            style: { padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" },
            children: [
              /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200, userSelect: "all" }, children: o }),
              /* @__PURE__ */ t(S, { primary: !0, style: E, onClick: () => w(o), disabled: !g || c, children: "Send" }),
              /* @__PURE__ */ t(S, { style: E, onClick: l, children: T ? "Copied" : "Copy" })
            ]
          }
        ),
        p && /* @__PURE__ */ t("div", { style: { padding: "0 16px" }, children: p }),
        /* @__PURE__ */ t("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: g ? /* @__PURE__ */ t(
          Le,
          {
            slotKey: m,
            agent: s.crew.agent,
            frameless: !0,
            startAtBottom: !0,
            placeholder: "Ask the Radar Lead…",
            onSend: L
          },
          m
        ) : /* @__PURE__ */ a("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 10 }, children: [
          b,
          !e.configured && /* @__PURE__ */ t("p", { className: "text-xs text-muted", children: "Add a channel in Settings first." }),
          C.length > 0 && /* @__PURE__ */ t("ul", { className: "text-xs text-muted flex flex-col gap-1", style: { marginTop: 6 }, children: C.map((x, B) => /* @__PURE__ */ a("li", { children: [
            H(x.at),
            " · ",
            x.text
          ] }, `${x.at}-${B}`)) })
        ] }) }),
        /* @__PURE__ */ t("div", { className: "flex flex-wrap gap-2", style: { padding: "10px 16px 12px", borderTop: "1px solid var(--border)" }, children: ye.map((x) => /* @__PURE__ */ t(we, { q: x, onClick: () => w(x), disabled: !g || c }, x)) })
      ]
    }
  );
}
function ht({ state: e }) {
  return /* @__PURE__ */ a(M, { children: [
    /* @__PURE__ */ t(Q, { children: "Team" }),
    /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { marginBottom: 8 }, children: "Who works on your channels. Only the Radar Lead has a session; the others run when needed." }),
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: ae.map((n) => {
      var r, o;
      const s = n.id === "lead" ? e.crew.agent : n.agent;
      return /* @__PURE__ */ a(
        "li",
        {
          className: "flex items-start gap-3",
          style: { padding: "12px 4px", borderTop: "1px solid var(--border)", opacity: n.planned ? 0.7 : 1 },
          children: [
            /* @__PURE__ */ t(ge, { m: n, s: e, size: 36 }),
            /* @__PURE__ */ a("div", { style: { minWidth: 0, flex: 1 }, children: [
              /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-2", children: [
                /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: n.id === "lead" && e.crew.name || n.title }),
                /* @__PURE__ */ t(G, { variant: "muted", children: n.layer }),
                /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: n.kind })
              ] }),
              /* @__PURE__ */ t("p", { className: "text-sm", style: { margin: "4px 0 0" }, children: n.duty }),
              n.id === "investigator" && (((r = e.investigations) == null ? void 0 : r.items) || 0) > 0 && /* @__PURE__ */ a("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: [
                (o = e.investigations) == null ? void 0 : o.items,
                " item(s) under investigation"
              ] }),
              s && /* @__PURE__ */ t(_e, { children: /* @__PURE__ */ a("span", { className: "font-mono", children: [
                "agent: ",
                s,
                n.id === "lead" && e.crew.slot_key ? ` · session: ${e.crew.slot_key}` : ""
              ] }) })
            ] }),
            /* @__PURE__ */ t("div", { "data-testid": `team-status-${n.id}`, style: { maxWidth: 360, minWidth: 0, display: "flex" }, children: /* @__PURE__ */ t(Ce, { m: n, state: e, withName: !1 }) })
          ]
        },
        n.id
      );
    }) })
  ] });
}
function mt({ events: e, kinds: n, onShowAll: s }) {
  const r = n ? e.filter((o) => n.includes(o.kind)) : e;
  return /* @__PURE__ */ a(M, { children: [
    /* @__PURE__ */ t(Q, { children: "Activity" }),
    n && /* @__PURE__ */ a("p", { className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { marginBottom: 8 }, children: [
      /* @__PURE__ */ t("span", { children: "Showing the crew and its members only." }),
      /* @__PURE__ */ t(S, { style: E, onClick: s, children: "Show all" })
    ] }),
    r.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No activity yet." }) : /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", children: r.map((o, d) => /* @__PURE__ */ a("li", { children: [
      /* @__PURE__ */ t("span", { className: "text-muted", children: ue(o.at) }),
      " ",
      /* @__PURE__ */ t(G, { variant: "muted", children: o.kind }),
      " ",
      o.text
    ] }, `${o.at}-${d}`)) })
  ] });
}
function pt({
  state: e,
  busy: n,
  act: s,
  mcp: r,
  onProbe: o
}) {
  const d = ne(), [m, g] = h(e.settings.channels.join(`
`)), [y, v] = h(e.settings.digest_destination), [c, f] = h(e.settings.slack_login), [k, D] = h(e.settings.slack_mcp_command), [T, W] = h(e.settings.workspace_url), [R, L] = h(String(e.settings.poll_interval_secs)), [w, l] = h(String(e.settings.backfill_hours)), [p, b] = h(e.crew.unattended), [C, x] = h(e.crew.agent), [B, P] = h(e.crew.model), j = () => s(
    "Save settings",
    () => d.put(`${$}/settings`, {
      channels: m.split(/[\s,]+/).map((N) => N.trim()).filter(Boolean),
      digest_destination: y,
      slack_login: c.trim(),
      slack_mcp_command: k.trim(),
      workspace_url: T.trim(),
      poll_interval_secs: Number(R),
      backfill_hours: Number(w)
    })
  );
  return /* @__PURE__ */ a(F, { children: [
    !e.vault_available && /* @__PURE__ */ t(M, { className: "mb-4", children: /* @__PURE__ */ t("p", { className: "text-sm", children: "The gateway secret vault is unavailable, so settings cannot be saved." }) }),
    /* @__PURE__ */ a(M, { className: "mb-4", children: [
      /* @__PURE__ */ t(Q, { children: "Basics" }),
      /* @__PURE__ */ a("div", { className: "flex flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(Re, { mcp: r, state: e }) }),
        /* @__PURE__ */ t(S, { disabled: !!n, onClick: o, children: "Check connection" })
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
          onChange: (N) => g(N.target.value)
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
              onChange: (N) => v(N.target.value),
              children: [
                /* @__PURE__ */ t("option", { value: "dashboard", children: "Dashboard notification only" }),
                /* @__PURE__ */ t("option", { value: "self_dm", children: "DM to myself in Slack" })
              ]
            }
          )
        ] }),
        y === "self_dm" && /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Your Slack login (for the DM)",
          /* @__PURE__ */ t(K, { value: c, onChange: (N) => f(N.target.value), placeholder: "jdoe" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Poll interval (seconds, 60–3600)",
          /* @__PURE__ */ t(K, { type: "number", min: 60, max: 3600, value: R, onChange: (N) => L(N.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(S, { primary: !0, className: "mt-3", disabled: !!n, onClick: j, children: "Save settings" })
    ] }),
    /* @__PURE__ */ t(M, { children: /* @__PURE__ */ a("details", { children: [
      /* @__PURE__ */ t("summary", { style: { cursor: "pointer", fontWeight: 600, color: "var(--text-strong)" }, children: "Advanced" }),
      /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "MCP server command (a single executable on PATH)",
          /* @__PURE__ */ t(K, { value: k, onChange: (N) => D(N.target.value), placeholder: "ai-community-slack-mcp" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "Workspace URL (for permalinks, optional)",
          /* @__PURE__ */ t(K, { value: T, onChange: (N) => W(N.target.value), placeholder: "https://yourteam.slack.com" })
        ] }),
        /* @__PURE__ */ a("label", { className: "text-sm", children: [
          "First-poll backfill (hours, 0–168)",
          /* @__PURE__ */ t(K, { type: "number", min: 0, max: 168, value: w, onChange: (N) => l(N.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t(S, { className: "mt-3", disabled: !!n, onClick: j, children: "Save settings" }),
      /* @__PURE__ */ a("div", { style: { borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }, children: [
        /* @__PURE__ */ t("div", { className: "text-sm", style: { fontWeight: 600, marginBottom: 8 }, children: "Crew" }),
        /* @__PURE__ */ a("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
          /* @__PURE__ */ a("label", { className: "text-sm", children: [
            "Agent",
            /* @__PURE__ */ t(K, { value: C, onChange: (N) => x(N.target.value), placeholder: "slack-radar-crew" }),
            /* @__PURE__ */ t("span", { className: "block text-xs text-muted mt-1", children: "Default: the shipped slack-radar-crew agent. Your own agents are never modified." })
          ] }),
          /* @__PURE__ */ a("label", { className: "text-sm", children: [
            "Model (empty = agent default)",
            /* @__PURE__ */ t(K, { value: B, onChange: (N) => P(N.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ a("div", { className: "mt-3 flex items-center gap-2", children: [
          /* @__PURE__ */ t(
            ke,
            {
              checked: p,
              onChange: b,
              label: "Unattended mode (auto-approve investigator commands)",
              describedBy: "sr-unattended-risk"
            }
          ),
          /* @__PURE__ */ t("span", { className: "text-sm", children: "Unattended mode (auto-approve investigator commands)" })
        ] }),
        /* @__PURE__ */ t("p", { id: "sr-unattended-risk", className: "text-xs text-muted mt-1", children: "Risk: anyone in a watched channel can write text the crew reads, so a crafted message could steer a command nobody reviews." }),
        /* @__PURE__ */ t(
          S,
          {
            primary: !0,
            className: "mt-3",
            disabled: !!n,
            onClick: () => s("Save crew", () => d.put(`${$}/crew`, { agent: C, model: B, unattended: p })),
            children: "Save crew"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  ft as default
};
