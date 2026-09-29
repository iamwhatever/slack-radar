import { jsxs as s, Fragment as B, jsx as t } from "react/jsx-runtime";
import * as xe from "@kirocrew/app-sdk";
import { useAppApi as ne, ChatEmbed as Ie } from "@kirocrew/app-sdk";
import { PageHeader as Fe, Toggle as _e, Btn as $, Card as M, CardTitle as G, StatCard as le, Input as z, EmptyState as Pe, Badge as U } from "@kirocrew/app-sdk/ui";
import { useState as m, useCallback as he, useEffect as Y, useRef as pe, useMemo as oe } from "react";
const C = "/api/apps/slack-radar", Oe = {
  checking: "checking…",
  connected: "connected",
  needs_login: "sign in again",
  binary_not_found: "not installed",
  incompatible: "missing read access",
  error: "not working"
}, ye = ["What needs me today?", "Draft today's digest", "Which threads look resolved?"], Me = [
  { id: "board", label: "Board" },
  { id: "ledger", label: "Ledger" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" }
], ue = (e) => e ? new Date(e * 1e3).toLocaleString() : "never";
function j(e) {
  if (!e) return "never";
  const n = Math.max(0, Date.now() / 1e3 - e);
  return n < 90 ? "just now" : n < 3600 ? `${Math.round(n / 60)} min ago` : n < 86400 ? `${Math.round(n / 3600)} h ago` : ue(e);
}
function Se(e, n) {
  return n === "needs_login" ? "needs_login" : (e == null ? void 0 : e.status) || "checking";
}
function ge({ children: e, summary: n = "Details" }) {
  return /* @__PURE__ */ s("details", { className: "text-xs text-muted", style: { marginTop: 6 }, children: [
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
  return (a = e.now) == null ? void 0 : a.members.find((i) => i.id === n);
};
function J(e, n) {
  var l;
  const a = ce(n, e.id);
  if (e.id === "lead")
    return (a == null ? void 0 : a.state) === "paused" || !n.crew.live ? { label: "paused", tone: "muted" } : (a ? a.state === "working" : n.crew.running) ? { label: "working", tone: "aim" } : { label: "live", tone: "ok" };
  if (e.id === "poller")
    return n.source_state === "needs_login" ? { label: "sign in again", tone: "warn" } : (a == null ? void 0 : a.state) === "paused" ? { label: "paused", tone: "warn" } : { label: `polled ${j(n.last_poll_at)}`, tone: "muted" };
  const i = a ? a.count : e.id === "investigator" && ((l = n.investigations) == null ? void 0 : l.running) || 0;
  return i ? { label: `${i} running`, tone: "aim" } : (a == null ? void 0 : a.state) === "planned" ? { label: "not started yet", tone: "muted" } : { label: "idle", tone: "muted" };
}
function q(e) {
  if (!e) return "--";
  const n = new Date(e * 1e3), a = n.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: !1 });
  return n.toDateString() === (/* @__PURE__ */ new Date()).toDateString() ? a : `${n.toLocaleDateString([], { month: "short", day: "numeric" })} ${a}`;
}
function Ee(e) {
  if (!e) return "";
  const n = Math.round(e - Date.now() / 1e3);
  return n <= 0 ? "now" : $e(Date.now() / 1e3 - n);
}
function ze(e, n) {
  if (!(n != null && n.last)) return "";
  const { started_at: a, finished_at: i } = n.last;
  if (e.id === "poller") {
    if (!a) return "has not polled yet";
    const l = Ee(n.next_at);
    return `last ${q(a)}${l ? ` · next ${l === "now" ? "due now" : `in ${l}`}` : ""}`;
  }
  return e.id === "lead" ? a ? `last wake ${q(a)}` : "not woken yet" : a ? i ? `last run ${q(a)}–${q(i)}` : `last run ${q(a)}` : "last run --";
}
function je(e) {
  var n, a;
  return !(e != null && e.ran) || e.ran === "running" ? "" : e.ran === "never" ? "never ran" : `idle since ${q(((n = e.last) == null ? void 0 : n.finished_at) || ((a = e.last) == null ? void 0 : a.started_at))}`;
}
function $e(e) {
  if (!e) return "";
  const n = Math.max(0, Math.round(Date.now() / 1e3 - e));
  return n < 90 ? `${n}s` : n < 90 * 60 ? `${Math.round(n / 60)}m` : `${Math.round(n / 3600)}h`;
}
const Ue = (e, n = 60) => e.length > n ? `${e.slice(0, n - 1).trimEnd()}…` : e;
function ve(e, n) {
  const a = ce(n, e.id);
  if (!a) return J(e, n).label;
  const i = ze(e, a);
  return e.id === "poller" ? i && a.state === "paused" ? `${a.doing.split(" · ")[0]} · ${i}` : i || a.doing : a.state !== "working" ? a.state === "paused" ? `paused: ${a.doing}` : i || J(e, n).label : e.id === "lead" ? `working: ${a.doing}` : `${a.count} running: ${a.doing}`;
}
const Ke = `@keyframes slack-radar-pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.7) } }
.sr-pulse { animation: slack-radar-pulse 1.4s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .sr-pulse { animation: none } }`;
function Ce({ tone: e, pulse: n }) {
  return /* @__PURE__ */ t(
    "i",
    {
      "aria-hidden": !0,
      className: n ? "sr-pulse" : void 0,
      style: { width: 8, height: 8, borderRadius: "50%", flex: "none", display: "inline-block", background: Re[e] }
    }
  );
}
function Te({ m: e, state: n, withName: a = !0, withResting: i = !1, onOpen: l }) {
  const d = J(e, n), h = ce(n, e.id), g = h ? h.state === "working" : d.tone === "aim", f = i && (e.id === "investigator" || e.id === "watcher") ? je(h) : "", x = f ? `${f} · ${ve(e, n)}` : ve(e, n), c = e.id === "lead" && n.crew.name || e.title, w = /* @__PURE__ */ s(B, { children: [
    /* @__PURE__ */ t(Ce, { tone: d.tone, pulse: g }),
    a && /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: c }),
    /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: Ue(x) })
  ] }), y = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    fontSize: 13,
    opacity: g || d.tone === "warn" ? 1 : 0.6,
    color: "var(--text)"
  }, S = { title: `${c} · ${x}`, "data-member": e.id, "data-state": (h == null ? void 0 : h.state) || (g ? "working" : "idle") };
  return l ? /* @__PURE__ */ t(
    "button",
    {
      type: "button",
      onClick: l,
      ...S,
      "aria-label": `${c}: ${x}. Show activity`,
      style: { ...y, background: "transparent", border: 0, padding: 0, cursor: "pointer" },
      children: w
    }
  ) : /* @__PURE__ */ t("span", { ...S, style: y, children: w });
}
function He({ state: e, onOpenActivity: n }) {
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
        ae.map((a) => /* @__PURE__ */ t(
          Te,
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
function Ge({ state: e }) {
  const n = ae.filter((a) => a.id === "investigator" || a.id === "watcher").map((a) => ({ m: a, row: ce(e, a.id) })).filter(({ row: a }) => (a == null ? void 0 : a.state) === "working");
  return n.length ? /* @__PURE__ */ t("div", { "data-testid": "chat-running", style: { padding: "6px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" }, children: n.map(({ m: a, row: i }) => {
    const l = $e(i.since), d = `${a.title} running${i.count > 1 ? ` (${i.count})` : ""} · ${i.doing}${l ? ` · ${l}` : ""}`;
    return /* @__PURE__ */ s("div", { className: "text-xs flex items-center gap-2", title: d, style: { minWidth: 0 }, children: [
      /* @__PURE__ */ t(Ce, { tone: "aim", pulse: !0 }),
      /* @__PURE__ */ t("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: d })
    ] }, a.id);
  }) }) : null;
}
const Re = {
  ok: "var(--ok)",
  aim: "var(--aim)",
  warn: "var(--warn)",
  muted: "var(--muted-strong)"
};
function fe({ m: e, s: n, selected: a, size: i = 32 }) {
  const l = J(e, n), d = e.planned || e.id === "poller", h = {
    width: i,
    height: i,
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
  return /* @__PURE__ */ s("span", { style: h, "aria-hidden": !0, children: [
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
          background: Re[l.tone]
        }
      }
    )
  ] });
}
function Qe(e) {
  return e === "new" ? "warn" : e === "investigating" ? "aim" : e === "resolved" ? "ok" : "muted";
}
function Ye({ tab: e, setTab: n }) {
  return /* @__PURE__ */ t("div", { role: "tablist", "aria-label": "Slack Radar sections", style: { display: "flex", gap: 4 }, children: Me.map((a) => {
    const i = e === a.id;
    return /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": i,
        onClick: () => n(a.id),
        style: {
          padding: "6px 12px",
          borderRadius: 8,
          border: 0,
          cursor: "pointer",
          fontSize: 14,
          background: i ? "var(--bg-hover)" : "transparent",
          color: i ? "var(--text-strong)" : "var(--muted)"
        },
        children: a.label
      },
      a.id
    );
  }) });
}
function Je({
  state: e,
  configured: n,
  busy: a,
  onStart: i,
  onPause: l
}) {
  const d = e.crew.live;
  return /* @__PURE__ */ s("div", { className: "flex items-center gap-2", title: !d && !n ? "Add a channel in Settings first" : void 0, children: [
    /* @__PURE__ */ t("span", { className: "text-sm", children: "Crew" }),
    /* @__PURE__ */ t(
      _e,
      {
        checked: d,
        disabled: !!a || !d && !n,
        onChange: (g) => g ? i() : l(),
        label: d ? "Pause the crew" : "Start the crew"
      }
    ),
    /* @__PURE__ */ s("span", { className: "text-xs text-muted", title: "Whether the crew's commands run without asking you", children: [
      "Unattended: ",
      e.crew.trusted ? "on" : "off"
    ] })
  ] });
}
function _t() {
  const e = ne(), [n, a] = m("board"), [i, l] = m(null), [d, h] = m([]), [g, f] = m(null), [x, c] = m([]), [w, y] = m([]), [S, A] = m("open"), [T, D] = m(/* @__PURE__ */ new Set()), [L, k] = m(""), [o, u] = m(""), [N, R] = m(null), [p, W] = m(null), [V, E] = m(null), _ = he(async () => {
    try {
      R(await e.get(`${C}/mcp/status`));
    } catch (P) {
      R({ status: "error", command: "", detail: P.message });
    }
  }, [e]);
  Y(() => {
    _();
  }, [_]);
  const K = he(async () => {
    var P;
    try {
      const [H, Z, re, Q, Be] = await Promise.all([
        e.get(`${C}/state`),
        e.get(`${C}/items?status=${encodeURIComponent(S)}&limit=300`),
        e.get(`${C}/events?limit=150`),
        e.get(`${C}/needs`),
        e.get(`${C}/items?handled=1&limit=100`)
      ]);
      l(H), W(((P = H.now) == null ? void 0 : P.members) || null), h(Z.items), f(Q), c(Be.items), y(re.events.slice().reverse());
    } catch (H) {
      u(`Could not load: ${H.message}`);
    }
  }, [e, S]);
  Y(() => {
    K();
    const P = window.setInterval(K, 3e4);
    return () => window.clearInterval(P);
  }, [K]);
  const se = !!(p != null && p.some((P) => P.state === "working")), X = pe("");
  Y(() => {
    if (!se) return;
    const P = async () => {
      try {
        const Z = await e.get(`${C}/now`);
        W(Z.members);
        const re = Z.members.map((Q) => `${Q.id}:${Q.state}:${Q.count}`).join(",");
        if (X.current && re !== X.current) {
          const Q = await e.get(`${C}/events?limit=150`);
          y(Q.events.slice().reverse());
        }
        X.current = re;
      } catch {
      }
    }, H = window.setInterval(P, 5e3);
    return () => window.clearInterval(H);
  }, [se, e]);
  const r = oe(() => i && p ? { ...i, now: { members: p } } : i, [i, p]), v = () => {
    E(["member", "crew", "investigate"]), a("activity");
  }, b = async (P, H) => {
    k(P), u("");
    try {
      await H(), u(`${P}: done`), await K();
    } catch (Z) {
      u(`${P} failed: ${Z.message}`);
    } finally {
      k("");
    }
  }, I = !!i && i.settings.channels.length > 0, F = (i == null ? void 0 : i.settings.channels.length) || 0, te = i ? `${F ? `Watching ${F} channel${F === 1 ? "" : "s"}` : "No channels yet"} · ${i.crew.live ? "running" : "paused"}` : "A small crew triaging your Slack channels", ie = i ? Se(N, i.source_state) : "checking", Ae = () => {
    _(), K();
  };
  return /* @__PURE__ */ s(B, { children: [
    /* @__PURE__ */ t(
      Fe,
      {
        title: "Slack Radar",
        subtitle: te,
        actions: /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-4", children: [
          /* @__PURE__ */ t(
            Ye,
            {
              tab: n,
              setTab: (P) => {
                E(null), a(P);
              }
            }
          ),
          i && /* @__PURE__ */ t(
            Je,
            {
              state: i,
              configured: I,
              busy: L,
              onStart: () => b("Start crew", () => e.post(`${C}/crew/start`, {})),
              onPause: () => b("Pause crew", () => e.post(`${C}/crew/pause`, {}))
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ t("style", { children: Ke }),
    /* @__PURE__ */ s("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      r && n === "board" && /* @__PURE__ */ t(He, { state: r, onOpenActivity: v }),
      i && ie === "needs_login" && /* @__PURE__ */ t(Ve, { mcp: N, sourceError: i.source_error, busy: L, onCheck: Ae }),
      o && /* @__PURE__ */ t("p", { role: "status", className: "text-sm text-muted mb-3", children: o }),
      r ? n === "board" ? /* @__PURE__ */ t(
        Xe,
        {
          state: r,
          needs: g,
          handled: x,
          configured: I,
          mcp: N,
          busy: L,
          onPoll: () => b("Poll", () => e.post(`${C}/poll`, {})),
          onStart: () => b("Start crew", () => e.post(`${C}/crew/start`, {})),
          onDigest: () => b("Digest now", () => e.post(`${C}/digest/request`, {})),
          events: w,
          onChanged: K
        }
      ) : n === "ledger" ? /* @__PURE__ */ t(
        ct,
        {
          state: r,
          items: d,
          filter: S,
          setFilter: A,
          selected: T,
          setSelected: D,
          busy: L,
          onInvestigate: (P) => b("Investigate", async () => {
            await e.post(`${C}/investigate`, { keys: [...T], repo: P }), D(/* @__PURE__ */ new Set());
          })
        }
      ) : n === "team" ? /* @__PURE__ */ t(xt, { state: r }) : n === "activity" ? /* @__PURE__ */ t(yt, { events: w, kinds: V, onShowAll: () => E(null) }) : /* @__PURE__ */ t(vt, { state: r, busy: L, act: b, mcp: N, onProbe: _ }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" })
    ] })
  ] });
}
function We({ mcp: e, sourceError: n }) {
  var i;
  const a = [
    (e == null ? void 0 : e.status) && `status: ${e.status}`,
    (e == null ? void 0 : e.command) && `command: ${e.command}`,
    n && `error: ${n}`,
    (e == null ? void 0 : e.detail) && e.detail !== n && `detail: ${e.detail}`,
    ((i = e == null ? void 0 : e.missing_read_tools) == null ? void 0 : i.length) && `missing read tools: ${e.missing_read_tools.join(", ")}`
  ].filter(Boolean);
  return a.length ? /* @__PURE__ */ t(ge, { children: /* @__PURE__ */ t("pre", { className: "font-mono whitespace-pre-wrap", style: { margin: 0 }, children: a.join(`
`) }) }) : null;
}
function Ve({ mcp: e, sourceError: n, busy: a, onCheck: i }) {
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
          /* @__PURE__ */ t($, { primary: !0, onClick: i, disabled: !!a, children: "I signed in, check again" })
        ] }),
        /* @__PURE__ */ t(We, { mcp: e, sourceError: n })
      ]
    }
  );
}
function De({ mcp: e, state: n, withPoll: a, action: i }) {
  const l = Se(e, n.source_state), d = l === "connected";
  return /* @__PURE__ */ s("div", { className: i ? "mb-3" : "mb-4", "data-testid": i ? "connection-line" : void 0, children: [
    /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ s("p", { role: "status", className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { margin: 0, flex: 1, minWidth: 0 }, children: [
        /* @__PURE__ */ t("span", { "aria-hidden": !0, style: { width: 8, height: 8, borderRadius: "50%", background: d ? "var(--ok)" : l === "checking" ? "var(--muted-strong)" : "var(--warn)", display: "inline-block" } }),
        /* @__PURE__ */ s("span", { children: [
          "Slack connection: ",
          /* @__PURE__ */ t("span", { style: { color: d ? "var(--text)" : "var(--warn)" }, children: Oe[l] || l })
        ] }),
        a && /* @__PURE__ */ s("span", { children: [
          "· last poll ",
          j(n.last_poll_at),
          n.settings.channels.length > 0 && /* @__PURE__ */ s(B, { children: [
            " · watching ",
            n.settings.channels.join(", ")
          ] })
        ] })
      ] }),
      i
    ] }),
    !d && l !== "needs_login" && /* @__PURE__ */ t(We, { mcp: e, sourceError: n.source_error })
  ] });
}
function Xe(e) {
  const { state: n } = e, [a, i] = m(""), [l, d] = gt(n.crew.slot_key), h = pe(null), g = (f) => {
    i(qe(f)), d(!0), window.requestAnimationFrame(() => {
      var x;
      return (x = h.current) == null ? void 0 : x.scrollIntoView({ block: "end", behavior: "smooth" });
    });
  };
  return /* @__PURE__ */ s("div", { "data-testid": "board", style: { minWidth: 0 }, children: [
    /* @__PURE__ */ t(
      De,
      {
        mcp: e.mcp,
        state: n,
        withPoll: !0,
        action: /* @__PURE__ */ t($, { style: O, onClick: e.onPoll, disabled: !!e.busy || !e.configured, children: "Poll now" })
      }
    ),
    !e.configured && /* @__PURE__ */ s(M, { className: "mb-4", children: [
      /* @__PURE__ */ t(G, { children: "Finish setup" }),
      /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Add at least one channel ID in Settings. Slack Radar reads Slack as you, so there is no bot to invite." })
    ] }),
    /* @__PURE__ */ t(pt, { state: n, busy: e.busy, onDigest: e.onDigest }),
    /* @__PURE__ */ t(rt, { needs: e.needs, handled: e.handled, onChanged: e.onChanged, onWhy: g }),
    /* @__PURE__ */ t(
      "div",
      {
        ref: h,
        "data-testid": "chat-bar",
        "data-expanded": l ? "true" : "false",
        style: { position: "sticky", bottom: 0, zIndex: 5, marginTop: 8, borderRadius: 12, boxShadow: "0 -6px 18px rgba(0,0,0,.18)" },
        children: /* @__PURE__ */ t(
          ft,
          {
            state: n,
            events: e.events,
            configured: e.configured,
            busy: e.busy,
            expanded: l,
            setExpanded: d,
            pending: a,
            setPending: i,
            onStart: e.onStart,
            onChanged: e.onChanged
          }
        )
      }
    )
  ] });
}
const be = {
  decide: "Needs a decision",
  unanswered: "Questions nobody answered",
  clusters: "Reported more than once"
};
function Ze(e) {
  return e < 1 ? `${Math.max(1, Math.round(e * 60))} min ago` : e < 48 ? `${Math.round(e)} h ago` : `${Math.floor(e / 24)} days ago`;
}
const we = 5;
function qe(e) {
  return `Why is "${e.summary.length > 80 ? `${e.summary.slice(0, 79)}…` : e.summary}" ${e.priority || "on my list"}?`;
}
function et(e) {
  return e ? /* @__PURE__ */ t(U, { variant: e === "p0" || e === "p1" ? "err" : "muted", children: e }) : null;
}
function ee({ message: e, onRetry: n }) {
  return /* @__PURE__ */ s(
    "div",
    {
      role: "alert",
      className: "text-sm flex flex-wrap items-center gap-2",
      style: { border: "1px solid var(--danger)", borderRadius: 8, padding: "8px 12px", margin: "8px 0" },
      children: [
        /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200 }, children: e }),
        /* @__PURE__ */ t($, { onClick: n, children: "Try again" })
      ]
    }
  );
}
const O = { fontSize: 12, padding: "2px 10px" };
function tt(e, n) {
  return e === "decide" && n.dispatch ? "Done" : e === "decide" && n.handoff_title ? "Dispatch fix" : e === "decide" && n.reply_draft ? "Reply" : e === "decide" && n.reason.startsWith("Looks resolved") ? "Done" : e === "unanswered" && n.permalink ? "Reply" : "Decide";
}
function nt({
  e,
  groupId: n,
  first: a,
  onMark: i,
  onWhy: l,
  onDispatch: d,
  onSend: h,
  busy: g
}) {
  const f = tt(n, e), x = n === "decide" && !!e.reply_draft && !e.handoff_title && !!h, [c, w] = m(!1), [y, S] = m(e.reply_draft || "");
  Y(() => S(e.reply_draft || ""), [e.reply_draft]);
  const A = pe(null), T = e.key.replace(/[^A-Za-z0-9]/g, "-"), D = `sr-reply-${n}-${T}`, L = `sr-row-${n}-${T}`, k = e.dispatch, o = () => e.permalink && window.open(e.permalink, "_blank", "noopener,noreferrer"), u = () => {
    f === "Dispatch fix" ? d == null || d() : f === "Done" ? i("done") : f === "Reply" && !x ? o() : (w(!0), x && window.requestAnimationFrame(() => {
      var R;
      return (R = A.current) == null ? void 0 : R.focus();
    }));
  }, N = [
    ...f !== "Done" ? [{ label: x ? "Done without sending" : "Done", onClick: () => i("done") }] : [],
    { label: "Ignore", onClick: () => i("ignored") },
    { label: "Why? Ask the lead", onClick: l }
  ];
  return /* @__PURE__ */ s(
    "li",
    {
      className: "text-sm",
      "data-testid": "need-row",
      "data-priority": e.priority || "",
      "data-age-hours": e.age_hours,
      style: { padding: "8px 0", borderTop: a ? 0 : "1px solid var(--border)" },
      children: [
        /* @__PURE__ */ s("div", { className: "flex items-start gap-2", children: [
          /* @__PURE__ */ t("div", { style: { flex: "none", minWidth: 28 }, children: et(e.priority) }),
          /* @__PURE__ */ s("div", { style: { minWidth: 0, flex: 1 }, children: [
            /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || "(no text)" }),
            /* @__PURE__ */ s("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
              e.reason,
              " · ",
              /* @__PURE__ */ t("span", { "data-testid": "need-age", children: Ze(e.age_hours) })
            ] }),
            k && /* @__PURE__ */ s("div", { className: "text-xs", style: { marginTop: 2 }, "data-testid": "fix-in-progress", children: [
              /* @__PURE__ */ t(de, { d: k }),
              " · ",
              me[k.state] || k.state,
              k.pr_url && /* @__PURE__ */ s(B, { children: [
                " · ",
                /* @__PURE__ */ s("a", { className: "underline", href: k.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
                  "PR #",
                  k.pr_number
                ] })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ s("div", { className: "flex items-center gap-1", style: { flex: "none" }, "data-testid": "need-actions", children: [
            /* @__PURE__ */ t($, { primary: !0, style: O, onClick: u, disabled: f === "Dispatch fix" && g, children: f === "Dispatch fix" && g ? "Dispatching…" : f }),
            /* @__PURE__ */ t(
              "button",
              {
                type: "button",
                "aria-expanded": c,
                "aria-controls": L,
                "aria-label": c ? "Hide details" : "Show details and more actions",
                title: c ? "Hide details" : "Details and more actions",
                onClick: () => w(!c),
                style: { border: 0, background: "transparent", cursor: "pointer", padding: "2px 8px", borderRadius: 6, color: "var(--muted)" },
                children: c ? "▴" : "▾"
              }
            )
          ] })
        ] }),
        c && /* @__PURE__ */ s("div", { id: L, "data-testid": "need-more", style: { margin: "6px 0 0 36px" }, children: [
          /* @__PURE__ */ s("div", { className: "text-xs text-muted", children: [
            /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
            e.category && /* @__PURE__ */ s(B, { children: [
              " · ",
              e.category
            ] }),
            e.words && e.words.length > 0 && /* @__PURE__ */ s(B, { children: [
              " · shared words: ",
              e.words.join(", ")
            ] }),
            e.members && e.members.length > 0 && /* @__PURE__ */ s(B, { children: [
              " · Done and Ignore apply to all ",
              e.members.length
            ] }),
            e.permalink && /* @__PURE__ */ s(B, { children: [
              " · ",
              /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "Open in Slack" })
            ] })
          ] }),
          e.handoff_title && !k && /* @__PURE__ */ s("div", { className: "text-xs", style: { marginTop: 4 }, children: [
            "Fix: ",
            e.handoff_title
          ] }),
          x && /* @__PURE__ */ s(B, { children: [
            /* @__PURE__ */ t("label", { htmlFor: D, className: "text-xs text-muted", style: { display: "block", marginTop: 6 }, children: "Reply to the thread, sent as you" }),
            /* @__PURE__ */ t(
              "textarea",
              {
                id: D,
                ref: A,
                value: y,
                maxLength: 1500,
                rows: 3,
                onChange: (R) => S(R.target.value),
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
          /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-1", style: { marginTop: 6 }, "data-testid": "need-secondary", children: [
            x && /* @__PURE__ */ t(
              $,
              {
                primary: !0,
                style: O,
                disabled: !y.trim(),
                onClick: () => h == null ? void 0 : h(y.trim(), y.trim() !== (e.reply_draft || "").trim()),
                children: "Send to thread"
              }
            ),
            N.map((R) => /* @__PURE__ */ t($, { style: O, onClick: R.onClick, children: R.label }, R.label))
          ] })
        ] })
      ]
    }
  );
}
function at({ g: e, render: n }) {
  const [a, i] = m(!1), l = a ? e.shown : e.shown.slice(0, we), d = e.shown.length - l.length;
  return /* @__PURE__ */ s(B, { children: [
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: l.map(n) }),
    (d > 0 || a && e.shown.length > we) && /* @__PURE__ */ t(
      "button",
      {
        type: "button",
        className: "text-xs underline",
        onClick: () => i(!a),
        style: { border: 0, background: "transparent", cursor: "pointer", padding: "4px 0", color: "var(--muted)" },
        children: a ? "Show fewer" : `Show ${d} more`
      }
    )
  ] });
}
const Le = typeof xe.useChatLauncher == "function" ? xe.useChatLauncher : () => null, me = { running: "working", idle: "waiting", closed: "session closed", unknown: "" };
function de({ d: e }) {
  const n = Le(), a = `/chat?sid=${encodeURIComponent(e.session_key)}`;
  return /* @__PURE__ */ t(
    "a",
    {
      className: "underline",
      href: a,
      onClick: (i) => {
        n && (i.preventDefault(), n.openChat({ slotKey: e.session_key }));
      },
      children: e.title || "Fix session"
    }
  );
}
function ke(e) {
  try {
    return JSON.parse(String(e.body || "{}"));
  } catch {
    return {};
  }
}
function st(e) {
  const n = ne(), a = Le(), [i, l] = m(""), [d, h] = m(null), [g, f] = m(null), [x, c] = m(null), [w, y] = m(null), [S, A] = m(!1), T = async (o) => {
    if (!i) {
      l(o), f(null);
      try {
        const u = await n.post(`${C}/items/handoff/dispatch`, { key: o });
        u.mode === "server" ? h({ session_key: u.session_key, title: u.title }) : a ? a.openChat({ agent: u.agent, message: u.seed, autoSend: !0 }) : (A(!1), y({ title: u.title, seed: u.seed })), e();
      } catch (u) {
        const N = ke(u);
        N.code === "already_dispatched" && N.session_key ? h({ session_key: N.session_key, title: N.title || "", again: !0 }) : f({ key: o, why: N.error || "the gateway refused it" });
      } finally {
        l("");
      }
    }
  }, D = async (o) => {
    var u;
    if (i || o.length === 0) return !1;
    l("batch"), c(null);
    try {
      const N = await n.post(`${C}/items/handoff/dispatch-batch`, { keys: o });
      return N.mode === "server" ? h({ session_key: N.session_key, title: N.title, batch: !0 }) : a ? a.openChat({ agent: N.agent, message: N.seed, autoSend: !0 }) : (A(!1), y({ title: N.title, seed: N.seed })), e(), !0;
    } catch (N) {
      const R = ke(N), p = (u = R.dispatched) != null && u.length ? `${R.dispatched.length} of them already have a session` : R.error || "the gateway refused it";
      return c({ keys: o, why: p }), !1;
    } finally {
      l("");
    }
  }, L = async () => {
    if (w)
      try {
        await navigator.clipboard.writeText(w.seed), A(!0);
      } catch {
        A(!1);
      }
  }, k = /* @__PURE__ */ s(B, { children: [
    g && /* @__PURE__ */ t(ee, { message: `Could not dispatch that fix: ${g.why}. Nothing was sent.`, onRetry: () => T(g.key) }),
    x && /* @__PURE__ */ t(
      ee,
      {
        message: `Could not dispatch those fixes: ${x.why}. Nothing was sent.`,
        onRetry: () => D(x.keys)
      }
    ),
    d && /* @__PURE__ */ s(
      "div",
      {
        role: "status",
        "data-testid": "dispatch-toast",
        className: "text-sm flex items-center gap-2",
        style: { position: "fixed", right: 16, bottom: 16, zIndex: 40, background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "8px 12px", maxWidth: 480 },
        children: [
          /* @__PURE__ */ s("span", { style: { flex: 1, minWidth: 0 }, children: [
            d.again ? "Already dispatched: " : d.batch ? "Fixes dispatched to one conductor: " : "Fix dispatched to a conductor: ",
            /* @__PURE__ */ t(de, { d })
          ] }),
          /* @__PURE__ */ t($, { style: O, onClick: () => h(null), children: "Close" })
        ]
      }
    ),
    w && /* @__PURE__ */ t(
      "div",
      {
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "sr-fix-title",
        style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" },
        onKeyDown: (o) => o.key === "Escape" && y(null),
        children: /* @__PURE__ */ s("div", { style: { width: "min(720px, 92vw)", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: 16 }, children: [
          /* @__PURE__ */ t("h3", { id: "sr-fix-title", className: "text-sm", style: { margin: "0 0 6px", fontWeight: 600 }, children: w.title }),
          /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 8px" }, children: "This Kiro Crew cannot open the session for you. Copy this task into a new kirocrew-conductor chat." }),
          /* @__PURE__ */ t(
            "textarea",
            {
              readOnly: !0,
              "aria-label": "Fix task",
              value: w.seed,
              style: { width: "100%", height: 260, fontSize: 12, fontFamily: "var(--font-mono, monospace)" }
            }
          ),
          /* @__PURE__ */ s("div", { className: "flex items-center gap-2", style: { marginTop: 8 }, children: [
            /* @__PURE__ */ t($, { onClick: L, children: S ? "Copied" : "Copy task" }),
            /* @__PURE__ */ t("a", { className: "underline text-sm", href: "/chat?new=1", children: "New chat" }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t($, { onClick: () => y(null), children: "Close" })
          ] })
        ] })
      }
    )
  ] });
  return { dispatch: T, dispatchBatch: D, busyKey: i, ui: k };
}
function it({
  rows: e,
  busy: n,
  onSend: a,
  onCancel: i
}) {
  const [l, d] = m(() => new Set(e.map((c) => c.key))), h = e.filter((c) => l.has(c.key)), f = new Set(h.map((c) => c.repo.toLowerCase())).size > 1, x = (c) => d((w) => {
    const y = new Set(w);
    return y.has(c) ? y.delete(c) : y.add(c), y;
  });
  return /* @__PURE__ */ s(
    "section",
    {
      "aria-label": "Dispatch fixes together",
      "data-testid": "batch-panel",
      style: { margin: "8px 0", padding: 10, border: "1px solid var(--border-strong)", borderRadius: 8 },
      children: [
        /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "0 0 6px" }, children: "One conductor gets every checked fix and splits the work. Uncheck any you want to leave out." }),
        /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { margin: 0, padding: 0, listStyle: "none" }, children: e.map((c, w) => /* @__PURE__ */ t("li", { style: { padding: "6px 0", borderTop: w === 0 ? 0 : "1px solid var(--border)" }, children: /* @__PURE__ */ s("label", { className: "text-sm flex gap-2", style: { alignItems: "flex-start", cursor: "pointer" }, children: [
          /* @__PURE__ */ t("input", { type: "checkbox", checked: l.has(c.key), onChange: () => x(c.key), style: { marginTop: 3 } }),
          /* @__PURE__ */ s("span", { style: { flex: 1, minWidth: 0 }, children: [
            c.title,
            " ",
            /* @__PURE__ */ t("span", { className: "text-xs text-muted font-mono", children: c.repo }),
            /* @__PURE__ */ t("span", { className: "text-xs text-muted", style: { display: "block" }, children: c.prompt.length > 120 ? `${c.prompt.slice(0, 120)}…` : c.prompt })
          ] })
        ] }) }, c.key)) }),
        /* @__PURE__ */ s("div", { className: "flex items-center gap-2", style: { marginTop: 8 }, children: [
          /* @__PURE__ */ t($, { primary: !0, style: O, disabled: n || h.length === 0 || f, onClick: () => a(h.map((c) => c.key)), children: n ? "Dispatching…" : `Dispatch ${h.length} to one conductor` }),
          /* @__PURE__ */ t($, { style: O, onClick: i, disabled: n, children: "Cancel" }),
          f && /* @__PURE__ */ t("span", { className: "text-xs text-muted", role: "status", children: "one repo per batch" })
        ] })
      ]
    }
  );
}
function rt({
  needs: e,
  handled: n,
  onChanged: a,
  onWhy: i
}) {
  var X;
  const l = ne(), d = st(a), h = (e == null ? void 0 : e.fixes) || [], g = (e == null ? void 0 : e.fix_batches) || [], f = new Map(g.map((r) => [r.session_key, r])), x = new Map(((e == null ? void 0 : e.handoffs) || []).map((r) => [r.key, r.handoff])), c = (((X = ((e == null ? void 0 : e.groups) || []).find((r) => r.id === "decide")) == null ? void 0 : X.entries) || []).filter((r) => r.handoff_title && !r.dispatch && x.has(r.key)).map((r) => {
    const v = x.get(r.key);
    return { key: r.key, title: r.handoff_title || v.title, repo: v.repo || "", prompt: v.prompt || "" };
  }), [w, y] = m(!1), [S, A] = m(null), [T, D] = m("");
  Y(() => {
    if (!T) return;
    const r = window.setTimeout(() => D(""), 4e3);
    return () => window.clearTimeout(r);
  }, [T]);
  const L = async (r, v, b, I) => {
    A(null), p((F) => new Set(F).add(I));
    try {
      b && await l.post(`${C}/items/reply/draft`, { key: r, text: v }), await l.post(`${C}/items/reply/send`, { key: r }), D("Sent as you"), a();
    } catch (F) {
      p((te) => {
        const ie = new Set(te);
        return ie.delete(I), ie;
      }), A({ key: r, text: v, edited: b, why: F.message || "unknown error" });
    }
  }, k = (e == null ? void 0 : e.replied) || [], [o, u] = m(""), N = async (r) => {
    u("");
    try {
      await l.post(`${C}/items/handoff/dismiss`, { key: r }), a();
    } catch {
      u(r);
    }
  }, [R, p] = m(/* @__PURE__ */ new Set()), [W, V] = m(null);
  Y(() => p(/* @__PURE__ */ new Set()), [e]);
  const E = async (r, v, b) => {
    V(null), b && p((I) => new Set(I).add(b));
    try {
      for (const I of r) await l.post(`${C}/items/handle`, { key: I, how: v });
      a();
    } catch {
      b && p((I) => {
        const F = new Set(I);
        return F.delete(b), F;
      }), V({ keys: r, how: v, rowId: b });
    }
  }, _ = ((e == null ? void 0 : e.groups) || []).map((r) => ({
    ...r,
    shown: r.entries.filter((v) => !R.has(`${r.id}:${v.key}`))
  })), K = _.every((r) => r.shown.length === 0), se = (W == null ? void 0 : W.how) === "reopen" ? "reopen" : (W == null ? void 0 : W.how) === "ignored" ? "ignore" : "mark as done";
  return /* @__PURE__ */ s(M, { className: "mb-4", children: [
    /* @__PURE__ */ s("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ t(G, { children: "Needs you" }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      c.length >= 2 && !w && /* @__PURE__ */ s($, { style: O, onClick: () => y(!0), disabled: !!d.busyKey, children: [
        "Dispatch all fixes (",
        c.length,
        ")"
      ] })
    ] }),
    w && c.length > 0 && /* @__PURE__ */ t(
      it,
      {
        rows: c,
        busy: d.busyKey === "batch",
        onCancel: () => y(!1),
        onSend: async (r) => {
          await d.dispatchBatch(r) && y(!1);
        }
      }
    ),
    T && /* @__PURE__ */ t("p", { role: "status", className: "text-sm", style: { margin: "0 0 8px", color: "var(--success, var(--text))" }, children: T }),
    S && /* @__PURE__ */ t(
      ee,
      {
        message: `Could not send that reply: ${S.why}`,
        onRetry: () => L(S.key, S.text, S.edited, `decide:${S.key}`)
      }
    ),
    W && /* @__PURE__ */ t(
      ee,
      {
        message: `Could not ${se} that message. Nothing changed.`,
        onRetry: () => E(W.keys, W.how, W.rowId)
      }
    ),
    e ? K ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Nothing needs you right now." }) : _.map(
      (r) => r.shown.length === 0 ? null : /* @__PURE__ */ s("section", { "aria-label": be[r.id], style: { marginTop: 10 }, children: [
        /* @__PURE__ */ s("h4", { className: "text-sm", style: { margin: 0, fontWeight: 600, color: "var(--text-strong)" }, children: [
          be[r.id],
          " ",
          /* @__PURE__ */ s("span", { className: "text-muted", style: { fontWeight: 400 }, children: [
            "(",
            r.total - (r.entries.length - r.shown.length),
            ")"
          ] })
        ] }),
        /* @__PURE__ */ t(
          at,
          {
            g: r,
            render: (v, b) => /* @__PURE__ */ t(
              nt,
              {
                e: v,
                groupId: r.id,
                first: b === 0,
                onMark: (I) => {
                  var F;
                  return E((F = v.members) != null && F.length ? v.members : [v.key], I, `${r.id}:${v.key}`);
                },
                onWhy: () => i(v),
                onDispatch: r.id === "decide" && v.handoff_title ? () => d.dispatch(v.key) : void 0,
                onSend: r.id === "decide" ? (I, F) => L(v.key, I, F, `${r.id}:${v.key}`) : void 0,
                busy: d.busyKey === v.key
              },
              v.key
            )
          }
        )
      ] }, r.id)
    ) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "Loading…" }),
    o && /* @__PURE__ */ t(ee, { message: "Could not dismiss that hand-off. Nothing changed.", onRetry: () => N(o) }),
    h.length > 0 && /* @__PURE__ */ s("details", { style: { marginTop: 12 }, "data-testid": "fixes-in-flight", children: [
      /* @__PURE__ */ s("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Fixes in flight (",
        (e == null ? void 0 : e.fixes_total) ?? h.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: h.map((r, v) => {
        const b = r.dispatch.batch ? f.get(r.dispatch.session_key) : void 0, I = b && b.keys[0] === r.key, F = { padding: "6px 0", borderTop: v === 0 ? 0 : "1px solid var(--border)" }, te = r.dispatch.pr_url && /* @__PURE__ */ s(B, { children: [
          " · ",
          /* @__PURE__ */ s("a", { className: "underline", href: r.dispatch.pr_url, target: "_blank", rel: "noreferrer noopener", children: [
            "PR #",
            r.dispatch.pr_number
          ] })
        ] });
        return /* @__PURE__ */ s("li", { className: "text-sm", style: b ? { ...F, ...I ? {} : { borderTop: 0, paddingTop: 0 } } : F, children: [
          I && b && /* @__PURE__ */ s("div", { "data-testid": "fix-batch-header", style: { marginBottom: 4 }, children: [
            /* @__PURE__ */ t(de, { d: b }),
            /* @__PURE__ */ s("span", { className: "text-xs text-muted", children: [
              " · ",
              me[b.state] || b.state || "sent",
              " · ",
              /* @__PURE__ */ t("span", { className: "font-mono", children: b.repo }),
              " · ",
              b.prs_found,
              " PRs found / ",
              b.total,
              " · ",
              j(b.at)
            ] })
          ] }),
          /* @__PURE__ */ s("div", { className: "flex items-center gap-2", style: b ? { paddingLeft: 16 } : void 0, children: [
            /* @__PURE__ */ s("span", { style: { flex: 1, minWidth: 0 }, children: [
              b ? r.handoff_title : /* @__PURE__ */ s(B, { children: [
                /* @__PURE__ */ t(de, { d: r.dispatch }),
                /* @__PURE__ */ s("span", { className: "text-xs text-muted", children: [
                  " · ",
                  me[r.dispatch.state] || r.dispatch.state || "sent",
                  " · ",
                  /* @__PURE__ */ t("span", { className: "font-mono", children: r.repo }),
                  " · ",
                  j(r.dispatch.at)
                ] })
              ] }),
              te
            ] }),
            /* @__PURE__ */ t($, { style: O, onClick: () => N(r.key), children: "Dismiss" })
          ] })
        ] }, r.key);
      }) })
    ] }),
    ((e == null ? void 0 : e.handled_total) || 0) > 0 && /* @__PURE__ */ s("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ s("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Handled (",
        e == null ? void 0 : e.handled_total,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: n.map((r, v) => /* @__PURE__ */ s(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: v === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 0 }, children: r.summary || r.text.slice(0, 200) }),
            /* @__PURE__ */ s("span", { className: "text-xs text-muted", children: [
              r.handled_how === "ignored" ? "Ignored" : "Done",
              " ",
              j(r.handled_at)
            ] }),
            /* @__PURE__ */ t($, { style: O, onClick: () => E([r.key], "reopen"), children: "Reopen" })
          ]
        },
        r.key
      )) })
    ] }),
    k.length > 0 && /* @__PURE__ */ s("details", { style: { marginTop: 12 }, children: [
      /* @__PURE__ */ s("summary", { className: "text-sm text-muted", style: { cursor: "pointer" }, children: [
        "Replied (",
        (e == null ? void 0 : e.replied_total) ?? k.length,
        ")"
      ] }),
      /* @__PURE__ */ t("ul", { className: "flex flex-col", style: { marginTop: 4 }, children: k.map((r, v) => /* @__PURE__ */ s(
        "li",
        {
          className: "text-sm flex items-center gap-2",
          style: { padding: "6px 0", borderTop: v === 0 ? 0 : "1px solid var(--border)" },
          children: [
            /* @__PURE__ */ s("span", { style: { flex: 1, minWidth: 0 }, children: [
              r.text.length > 120 ? `${r.text.slice(0, 119)}…` : r.text,
              /* @__PURE__ */ s("span", { className: "text-xs text-muted", children: [
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
    d.ui
  ] });
}
function lt({ it: e, first: n, checked: a, onToggle: i }) {
  const l = e.priority ? { label: e.priority, variant: e.priority === "p0" || e.priority === "p1" ? "err" : "muted" } : e.possibly_resolved ? { label: "possibly resolved", variant: "warn" } : null, d = [
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
        onChange: i,
        style: { marginTop: 4 }
      }
    ),
    /* @__PURE__ */ s("div", { className: "flex items-center gap-1", style: { flex: "none" }, children: [
      /* @__PURE__ */ t(U, { variant: Qe(e.status), children: e.status }),
      l && /* @__PURE__ */ t(U, { variant: l.variant, children: l.label }),
      d.length > 0 && /* @__PURE__ */ s("span", { className: "text-xs text-muted", title: d.join(`
`), "aria-label": d.join("; "), children: [
        "+",
        d.length
      ] })
    ] }),
    /* @__PURE__ */ s("div", { style: { minWidth: 0, flex: 1 }, children: [
      /* @__PURE__ */ t("div", { style: { color: "var(--text-strong)" }, children: e.summary || e.text.slice(0, 280) }),
      /* @__PURE__ */ s("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
        /* @__PURE__ */ t("span", { "data-testid": "ledger-ts", "data-ts": e.ts_float, children: j(e.ts_float) }),
        " · ",
        /* @__PURE__ */ t("span", { className: "font-mono", children: e.channel }),
        e.user && /* @__PURE__ */ s(B, { children: [
          " · ",
          e.user
        ] }),
        e.reply_count > 0 && /* @__PURE__ */ s(B, { children: [
          " · ",
          e.reply_count,
          " replies"
        ] }),
        " · ",
        /* @__PURE__ */ t("a", { className: "underline", href: e.permalink, target: "_blank", rel: "noreferrer noopener", children: "open in Slack" }),
        e.links.length > 0 && /* @__PURE__ */ s(B, { children: [
          " · linked ",
          e.links.map((h) => /* @__PURE__ */ t("a", { className: "underline mr-2", href: h, target: "_blank", rel: "noreferrer noopener", children: h.replace("https://github.com/", "") }, h))
        ] })
      ] }),
      e.note && /* @__PURE__ */ t("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: e.note })
    ] })
  ] }) });
}
function ot(e) {
  var n, a;
  return !!((n = e.reply_draft) != null && n.text || (a = e.fix_handoff) != null && a.prompt || e.possibly_resolved);
}
const dt = ["", "p0", "p1", "p2", "p3", "none"];
function ct(e) {
  const { state: n, items: a, selected: i, setSelected: l } = e, [d, h] = m(""), [g, f] = m(""), [x, c] = m(""), [w, y] = m(!1), S = n.counts.open_by_priority, A = oe(() => [...new Set(a.map((o) => o.category).filter(Boolean))].sort(), [a]), T = oe(
    () => a.filter((o) => !g || (g === "none" ? !o.priority : o.priority === g)).filter((o) => !x || o.category === x).filter((o) => !w || ot(o)).sort((o, u) => (u.ts_float || 0) - (o.ts_float || 0)),
    [a, g, x, w]
  ), D = (o) => {
    const u = new Set(i);
    u.has(o) ? u.delete(o) : u.add(o), l(u);
  }, L = oe(
    () => n.settings.channels.map((o) => ({ cid: o, ...n.channels[o] || {} })),
    [n]
  ), k = "text-sm bg-transparent border rounded px-2 py-1";
  return /* @__PURE__ */ s("div", { style: { minWidth: 0 }, children: [
    /* @__PURE__ */ s("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-4", children: [
      /* @__PURE__ */ t(le, { label: "Awaiting triage", value: n.counts.needs_triage, accent: !0 }),
      /* @__PURE__ */ t(le, { label: "Possibly resolved", value: n.counts.possibly_resolved }),
      /* @__PURE__ */ t(le, { label: "Open p0 / p1", value: `${S.p0 || 0} / ${S.p1 || 0}` }),
      /* @__PURE__ */ t(le, { label: "Tracked items", value: n.counts.total })
    ] }),
    /* @__PURE__ */ s(M, { className: "mb-4", children: [
      /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-2 mb-3", children: [
        /* @__PURE__ */ t(G, { children: "Ledger" }),
        /* @__PURE__ */ s("span", { className: "text-xs text-muted", "data-testid": "ledger-count", children: [
          T.length,
          " of ",
          a.length,
          " · newest first"
        ] }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-filter", children: "Status" }),
        /* @__PURE__ */ s("select", { id: "sr-filter", className: k, value: e.filter, onChange: (o) => e.setFilter(o.target.value), children: [
          /* @__PURE__ */ t("option", { value: "open", children: "open" }),
          /* @__PURE__ */ t("option", { value: "new", children: "new" }),
          /* @__PURE__ */ t("option", { value: "triaged", children: "triaged" }),
          /* @__PURE__ */ t("option", { value: "investigating", children: "investigating" }),
          /* @__PURE__ */ t("option", { value: "resolved", children: "resolved" }),
          /* @__PURE__ */ t("option", { value: "noise", children: "noise" }),
          /* @__PURE__ */ t("option", { value: "", children: "all" })
        ] }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-priority", children: "Priority" }),
        /* @__PURE__ */ t("select", { id: "sr-priority", className: k, value: g, onChange: (o) => f(o.target.value), children: dt.map((o) => /* @__PURE__ */ t("option", { value: o, children: o || "all" }, o)) }),
        /* @__PURE__ */ t("label", { className: "text-sm text-muted", htmlFor: "sr-category", children: "Category" }),
        /* @__PURE__ */ s("select", { id: "sr-category", className: k, value: x, onChange: (o) => c(o.target.value), children: [
          /* @__PURE__ */ t("option", { value: "", children: "all" }),
          A.map((o) => /* @__PURE__ */ t("option", { value: o, children: o }, o))
        ] }),
        /* @__PURE__ */ s("label", { className: "text-sm flex items-center gap-1", style: { cursor: "pointer" }, children: [
          /* @__PURE__ */ t("input", { type: "checkbox", checked: w, onChange: (o) => y(o.target.checked) }),
          "Needs me"
        ] }),
        /* @__PURE__ */ t("div", { className: "flex-1" }),
        /* @__PURE__ */ t(
          z,
          {
            "aria-label": "GitHub repository to search (owner/name, optional)",
            placeholder: "owner/repo (optional)",
            value: d,
            onChange: (o) => h(o.target.value),
            className: "w-48"
          }
        ),
        /* @__PURE__ */ s($, { onClick: () => e.onInvestigate(d), disabled: i.size === 0 || !!e.busy, children: [
          "Investigate ",
          i.size || ""
        ] })
      ] }),
      T.length === 0 ? /* @__PURE__ */ t(
        Pe,
        {
          icon: /* @__PURE__ */ t("span", { "aria-hidden": !0, children: "📡" }),
          title: a.length ? "Nothing matches these filters" : "Nothing here yet",
          subtitle: a.length ? "Change a filter to see more." : "New messages appear after the next poll."
        }
      ) : /* @__PURE__ */ t("ul", { className: "flex flex-col", "data-testid": "ledger-list", children: T.map((o, u) => /* @__PURE__ */ t(lt, { it: o, first: u === 0, checked: i.has(o.key), onToggle: () => D(o.key) }, o.key)) })
    ] }),
    /* @__PURE__ */ s(M, { children: [
      /* @__PURE__ */ t(G, { children: "Channels" }),
      L.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No channels configured." }) : /* @__PURE__ */ s("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ t("thead", { children: /* @__PURE__ */ s("tr", { className: "text-left text-muted", children: [
          /* @__PURE__ */ t("th", { scope: "col", children: "Channel" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Last polled" }),
          /* @__PURE__ */ t("th", { scope: "col", children: "Status" })
        ] }) }),
        /* @__PURE__ */ t("tbody", { children: L.map((o) => /* @__PURE__ */ s("tr", { children: [
          /* @__PURE__ */ t("td", { className: "font-mono", children: o.cid }),
          /* @__PURE__ */ t("td", { children: ue(o.last_polled_at) }),
          /* @__PURE__ */ t("td", { children: o.last_error ? /* @__PURE__ */ t(U, { variant: "err", title: o.last_error, children: "error" }) : /* @__PURE__ */ t(U, { variant: "ok", children: "ok" }) })
        ] }, o.cid)) })
      ] })
    ] })
  ] });
}
const ht = 5;
function mt(e) {
  const n = e.split(`
`).map((i) => i.trim()).filter(Boolean), a = n.filter((i) => /^[•\-–]\s/.test(i));
  return (a.length ? a : n).slice(0, ht);
}
function pt({ state: e, busy: n, onDigest: a }) {
  const i = e.digest, l = e.crew.today, d = mt(i.last_text || ""), h = e.settings.digest_destination === "self_dm" ? "DMed to you" : "dashboard notification";
  return /* @__PURE__ */ s(M, { className: "mb-4", "data-testid": "today-card", children: [
    /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ t(G, { children: "Today" }),
      i.pending ? /* @__PURE__ */ t(U, { variant: "aim", children: "digest being delivered" }) : null,
      i.last_posted_date && /* @__PURE__ */ s("span", { className: "text-xs text-muted", "data-testid": "digest-time", children: [
        "digest ",
        i.last_posted_date,
        " · ",
        h
      ] }),
      /* @__PURE__ */ t("div", { className: "flex-1" }),
      /* @__PURE__ */ t($, { style: O, onClick: a, disabled: !!n || !e.crew.live, children: "Digest now" })
    ] }),
    (l == null ? void 0 : l.text) && /* @__PURE__ */ s("p", { style: { margin: "8px 0 0", fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }, "data-testid": "crew-today", children: [
      l.text,
      l.at > 0 && /* @__PURE__ */ s("span", { className: "text-xs text-muted", style: { fontWeight: 400 }, children: [
        " · ",
        j(l.at)
      ] })
    ] }),
    i.last_text ? /* @__PURE__ */ s(B, { children: [
      /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", "data-testid": "digest-top", style: { margin: "8px 0 0", padding: 0, listStyle: "none" }, children: d.map((g, f) => /* @__PURE__ */ t("li", { children: g }, f)) }),
      /* @__PURE__ */ t(ge, { summary: "Full digest", children: /* @__PURE__ */ t("pre", { className: "whitespace-pre-wrap text-sm", style: { fontFamily: "inherit", margin: 0 }, children: i.last_text }) })
    ] }) : /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { margin: "8px 0 0" }, "data-testid": "digest-empty", children: "No digest yet" }),
    i.last_error && /* @__PURE__ */ t("p", { className: "text-xs mt-1", style: { color: "var(--danger)" }, children: i.last_error })
  ] });
}
function ut({ state: e }) {
  return /* @__PURE__ */ t("div", { className: "flex items-center gap-2", style: { marginTop: 10 }, children: ae.map((n) => /* @__PURE__ */ s("span", { title: `${n.title} · ${J(n, e).label}`, children: [
    /* @__PURE__ */ t(fe, { m: n, s: e, selected: n.id === "lead", size: 30 }),
    /* @__PURE__ */ t("span", { className: "sr-only", children: `${n.title}: ${J(n, e).label}` })
  ] }, n.id)) });
}
function gt(e) {
  const n = `slack-radar:chat-open:${e}`, a = () => {
    try {
      return window.localStorage.getItem(n) === "1";
    } catch {
      return !1;
    }
  }, [i, l] = m(a);
  Y(() => l(a()), [n]);
  const d = he(
    (h) => {
      l(h);
      try {
        h ? window.localStorage.setItem(n, "1") : window.localStorage.removeItem(n);
      } catch {
      }
    },
    [n]
  );
  return [i, d];
}
function Ne({ q: e, onClick: n, disabled: a }) {
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
function ft(e) {
  const n = ne(), { state: a, expanded: i, pending: l } = e, d = ae[0], h = a.crew.slot_key, g = a.crew.live && a.crew.session_open && a.crew.session_agent === a.crew.agent, [f, x] = m(""), [c, w] = m(!1), [y, S] = m(""), [A, T] = m(!1), D = J(d, a), L = async (p) => {
    await n.post(`${C}/crew/message`, { message: p }), e.onChanged();
  }, k = async (p) => {
    const W = p.trim();
    if (W) {
      w(!0), S("");
      try {
        await n.post(`${C}/crew/message`, { message: W }), x(""), W === l && e.setPending(""), e.setExpanded(!0), e.onChanged();
      } catch {
        S(W);
      } finally {
        w(!1);
      }
    }
  }, o = async () => {
    try {
      await navigator.clipboard.writeText(l), T(!0), window.setTimeout(() => T(!1), 1500);
    } catch {
      T(!1);
    }
  }, u = y && /* @__PURE__ */ t(ee, { message: "The Radar Lead did not get that message.", onRetry: () => k(y) }), N = /* @__PURE__ */ t("div", { className: "text-sm", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }, children: a.crew.live ? /* @__PURE__ */ s(B, { children: [
    /* @__PURE__ */ t("span", { children: "The Radar Lead session opens on its next turn. Open it now to talk here." }),
    /* @__PURE__ */ t($, { primary: !0, onClick: e.onStart, disabled: !!e.busy || !e.configured, children: "Open the session" })
  ] }) : /* @__PURE__ */ s("span", { children: [
    "The Radar Lead is paused. Turn on ",
    /* @__PURE__ */ t("b", { children: "Crew" }),
    " at the top of the page to triage your channels and talk to it here."
  ] }) });
  if (!i)
    return /* @__PURE__ */ s(M, { style: { padding: "10px 14px" }, children: [
      /* @__PURE__ */ s(
        "form",
        {
          className: "flex flex-wrap items-center gap-2",
          onSubmit: (p) => {
            p.preventDefault(), k(f);
          },
          children: [
            /* @__PURE__ */ t(fe, { m: d, s: a, size: 26 }),
            /* @__PURE__ */ t(
              z,
              {
                "aria-label": "Ask the lead",
                placeholder: "Ask the lead…",
                value: f,
                onChange: (p) => x(p.target.value),
                disabled: !g || c,
                style: { flex: 1, minWidth: 200 }
              }
            ),
            /* @__PURE__ */ t($, { primary: !0, type: "submit", disabled: !g || c || !f.trim(), children: "Send" }),
            ye.map((p) => /* @__PURE__ */ t(Ne, { q: p, onClick: () => k(p), disabled: !g || c }, p))
          ]
        }
      ),
      !g && /* @__PURE__ */ t("div", { style: { marginTop: 8 }, children: N }),
      u
    ] });
  const R = e.events.filter((p) => p.kind === "crew" || p.kind === "digest").slice(0, 5);
  return /* @__PURE__ */ s(
    M,
    {
      style: { padding: 0, display: "flex", flexDirection: "column", height: "min(620px, calc(100vh - 240px))", overflow: "hidden" },
      children: [
        /* @__PURE__ */ s("div", { style: { padding: "12px 16px", borderBottom: "1px solid var(--border)" }, children: [
          /* @__PURE__ */ s("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: a.crew.name || d.title }),
            /* @__PURE__ */ t(U, { variant: D.tone === "muted" ? "muted" : D.tone === "aim" ? "aim" : "ok", children: D.label }),
            /* @__PURE__ */ t("div", { className: "flex-1" }),
            /* @__PURE__ */ t($, { onClick: () => e.setExpanded(!1), "aria-expanded": !0, children: "Collapse" })
          ] }),
          /* @__PURE__ */ s("div", { className: "text-xs text-muted", style: { marginTop: 2 }, children: [
            "phase ",
            a.crew_memory.phase,
            " · next: ",
            a.crew_memory.next || "—"
          ] }),
          /* @__PURE__ */ t(ut, { state: a })
        ] }),
        /* @__PURE__ */ t(Ge, { state: a }),
        l && // ChatEmbed has no API to fill its composer, so the question waits here.
        /* @__PURE__ */ s(
          "div",
          {
            className: "text-sm flex flex-wrap items-center gap-2",
            style: { padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-hover)" },
            children: [
              /* @__PURE__ */ t("span", { style: { flex: 1, minWidth: 200, userSelect: "all" }, children: l }),
              /* @__PURE__ */ t($, { primary: !0, style: O, onClick: () => k(l), disabled: !g || c, children: "Send" }),
              /* @__PURE__ */ t($, { style: O, onClick: o, children: A ? "Copied" : "Copy" })
            ]
          }
        ),
        u && /* @__PURE__ */ t("div", { style: { padding: "0 16px" }, children: u }),
        /* @__PURE__ */ t("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }, children: g ? /* @__PURE__ */ t(
          Ie,
          {
            slotKey: h,
            agent: a.crew.agent,
            frameless: !0,
            startAtBottom: !0,
            placeholder: "Ask the Radar Lead…",
            onSend: L
          },
          h
        ) : /* @__PURE__ */ s("div", { style: { padding: 16, display: "flex", flexDirection: "column", gap: 10 }, children: [
          N,
          !e.configured && /* @__PURE__ */ t("p", { className: "text-xs text-muted", children: "Add a channel in Settings first." }),
          R.length > 0 && /* @__PURE__ */ t("ul", { className: "text-xs text-muted flex flex-col gap-1", style: { marginTop: 6 }, children: R.map((p, W) => /* @__PURE__ */ s("li", { children: [
            j(p.at),
            " · ",
            p.text
          ] }, `${p.at}-${W}`)) })
        ] }) }),
        /* @__PURE__ */ t("div", { className: "flex flex-wrap gap-2", style: { padding: "10px 16px 12px", borderTop: "1px solid var(--border)" }, children: ye.map((p) => /* @__PURE__ */ t(Ne, { q: p, onClick: () => k(p), disabled: !g || c }, p)) })
      ]
    }
  );
}
function xt({ state: e }) {
  return /* @__PURE__ */ s(M, { children: [
    /* @__PURE__ */ t(G, { children: "Team" }),
    /* @__PURE__ */ t("p", { className: "text-sm text-muted", style: { marginBottom: 8 }, children: "Who works on your channels. Only the Radar Lead has a session; the others run when needed." }),
    /* @__PURE__ */ t("ul", { className: "flex flex-col", children: ae.map((n) => {
      var i, l;
      const a = n.id === "lead" ? e.crew.agent : n.agent;
      return /* @__PURE__ */ s(
        "li",
        {
          className: "flex items-start gap-3",
          style: { padding: "12px 4px", borderTop: "1px solid var(--border)", opacity: n.planned ? 0.7 : 1 },
          children: [
            /* @__PURE__ */ t(fe, { m: n, s: e, size: 36 }),
            /* @__PURE__ */ s("div", { style: { minWidth: 0, flex: 1 }, children: [
              /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-2", children: [
                /* @__PURE__ */ t("span", { style: { fontWeight: 600, color: "var(--text-strong)" }, children: n.id === "lead" && e.crew.name || n.title }),
                /* @__PURE__ */ t(U, { variant: "muted", children: n.layer }),
                /* @__PURE__ */ t("span", { className: "text-xs text-muted", children: n.kind })
              ] }),
              /* @__PURE__ */ t("p", { className: "text-sm", style: { margin: "4px 0 0" }, children: n.duty }),
              n.id === "investigator" && (((i = e.investigations) == null ? void 0 : i.items) || 0) > 0 && /* @__PURE__ */ s("p", { className: "text-xs text-muted", style: { margin: "2px 0 0" }, children: [
                (l = e.investigations) == null ? void 0 : l.items,
                " item(s) under investigation"
              ] }),
              a && /* @__PURE__ */ t(ge, { children: /* @__PURE__ */ s("span", { className: "font-mono", children: [
                "agent: ",
                a,
                n.id === "lead" && e.crew.slot_key ? ` · session: ${e.crew.slot_key}` : ""
              ] }) })
            ] }),
            /* @__PURE__ */ t("div", { "data-testid": `team-status-${n.id}`, style: { maxWidth: 360, minWidth: 0, display: "flex" }, children: /* @__PURE__ */ t(Te, { m: n, state: e, withName: !1, withResting: !0 }) })
          ]
        },
        n.id
      );
    }) })
  ] });
}
function yt({ events: e, kinds: n, onShowAll: a }) {
  const i = n ? e.filter((l) => n.includes(l.kind)) : e;
  return /* @__PURE__ */ s(M, { children: [
    /* @__PURE__ */ t(G, { children: "Activity" }),
    n && /* @__PURE__ */ s("p", { className: "text-sm text-muted flex flex-wrap items-center gap-2", style: { marginBottom: 8 }, children: [
      /* @__PURE__ */ t("span", { children: "Showing the crew and its members only." }),
      /* @__PURE__ */ t($, { style: O, onClick: a, children: "Show all" })
    ] }),
    i.length === 0 ? /* @__PURE__ */ t("p", { className: "text-sm text-muted", children: "No activity yet." }) : /* @__PURE__ */ t("ul", { className: "text-sm flex flex-col gap-1", children: i.map((l, d) => /* @__PURE__ */ s("li", { children: [
      /* @__PURE__ */ t("span", { className: "text-muted", children: ue(l.at) }),
      " ",
      /* @__PURE__ */ t(U, { variant: "muted", children: l.kind }),
      " ",
      l.text
    ] }, `${l.at}-${d}`)) })
  ] });
}
function vt({
  state: e,
  busy: n,
  act: a,
  mcp: i,
  onProbe: l
}) {
  const d = ne(), [h, g] = m(e.settings.channels.join(`
`)), [f, x] = m(e.settings.digest_destination), [c, w] = m(e.settings.slack_login), [y, S] = m(e.settings.slack_mcp_command), [A, T] = m(e.settings.workspace_url), [D, L] = m(String(e.settings.poll_interval_secs)), [k, o] = m(String(e.settings.backfill_hours)), [u, N] = m(e.crew.unattended), [R, p] = m(e.crew.agent), [W, V] = m(e.crew.model), E = () => a(
    "Save settings",
    () => d.put(`${C}/settings`, {
      channels: h.split(/[\s,]+/).map((_) => _.trim()).filter(Boolean),
      digest_destination: f,
      slack_login: c.trim(),
      slack_mcp_command: y.trim(),
      workspace_url: A.trim(),
      poll_interval_secs: Number(D),
      backfill_hours: Number(k)
    })
  );
  return /* @__PURE__ */ s(B, { children: [
    !e.vault_available && /* @__PURE__ */ t(M, { className: "mb-4", children: /* @__PURE__ */ t("p", { className: "text-sm", children: "The gateway secret vault is unavailable, so settings cannot be saved." }) }),
    /* @__PURE__ */ s(M, { className: "mb-4", children: [
      /* @__PURE__ */ t(G, { children: "Basics" }),
      /* @__PURE__ */ s("div", { className: "flex flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ t("div", { style: { flex: 1, minWidth: 0 }, children: /* @__PURE__ */ t(De, { mcp: i, state: e }) }),
        /* @__PURE__ */ t($, { disabled: !!n, onClick: l, children: "Check connection" })
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
          onChange: (_) => g(_.target.value)
        }
      ),
      /* @__PURE__ */ s("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "Digest destination",
          /* @__PURE__ */ s(
            "select",
            {
              className: "block w-full text-sm bg-transparent border rounded px-2 py-1",
              value: f,
              onChange: (_) => x(_.target.value),
              children: [
                /* @__PURE__ */ t("option", { value: "dashboard", children: "Dashboard notification only" }),
                /* @__PURE__ */ t("option", { value: "self_dm", children: "DM to myself in Slack" })
              ]
            }
          )
        ] }),
        f === "self_dm" && /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "Your Slack login (for the DM)",
          /* @__PURE__ */ t(z, { value: c, onChange: (_) => w(_.target.value), placeholder: "jdoe" })
        ] }),
        /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "Poll interval (seconds, 60–3600)",
          /* @__PURE__ */ t(z, { type: "number", min: 60, max: 3600, value: D, onChange: (_) => L(_.target.value) }),
          /* @__PURE__ */ s("span", { "data-testid": "poll-cadence", className: "block text-xs text-muted", style: { marginTop: 2 }, children: [
            "Runs by itself every ",
            e.settings.poll_interval_secs,
            " s; a manual Poll just runs one cycle now."
          ] })
        ] })
      ] }),
      /* @__PURE__ */ t($, { primary: !0, className: "mt-3", disabled: !!n, onClick: E, children: "Save settings" })
    ] }),
    /* @__PURE__ */ t(M, { children: /* @__PURE__ */ s("details", { children: [
      /* @__PURE__ */ t("summary", { style: { cursor: "pointer", fontWeight: 600, color: "var(--text-strong)" }, children: "Advanced" }),
      /* @__PURE__ */ s("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "MCP server command (a single executable on PATH)",
          /* @__PURE__ */ t(z, { value: y, onChange: (_) => S(_.target.value), placeholder: "ai-community-slack-mcp" })
        ] }),
        /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "Workspace URL (for permalinks, optional)",
          /* @__PURE__ */ t(z, { value: A, onChange: (_) => T(_.target.value), placeholder: "https://yourteam.slack.com" })
        ] }),
        /* @__PURE__ */ s("label", { className: "text-sm", children: [
          "First-poll backfill (hours, 0–168)",
          /* @__PURE__ */ t(z, { type: "number", min: 0, max: 168, value: k, onChange: (_) => o(_.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ t($, { className: "mt-3", disabled: !!n, onClick: E, children: "Save settings" }),
      /* @__PURE__ */ s("div", { style: { borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 12 }, children: [
        /* @__PURE__ */ t("div", { className: "text-sm", style: { fontWeight: 600, marginBottom: 8 }, children: "Crew" }),
        /* @__PURE__ */ s("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
          /* @__PURE__ */ s("label", { className: "text-sm", children: [
            "Agent",
            /* @__PURE__ */ t(z, { value: R, onChange: (_) => p(_.target.value), placeholder: "slack-radar-crew" }),
            /* @__PURE__ */ t("span", { className: "block text-xs text-muted mt-1", children: "Default: the shipped slack-radar-crew agent. Your own agents are never modified." })
          ] }),
          /* @__PURE__ */ s("label", { className: "text-sm", children: [
            "Model (empty = agent default)",
            /* @__PURE__ */ t(z, { value: W, onChange: (_) => V(_.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ s("div", { className: "mt-3 flex items-center gap-2", children: [
          /* @__PURE__ */ t(
            _e,
            {
              checked: u,
              onChange: N,
              label: "Unattended mode (auto-approve investigator commands)",
              describedBy: "sr-unattended-risk"
            }
          ),
          /* @__PURE__ */ t("span", { className: "text-sm", children: "Unattended mode (auto-approve investigator commands)" })
        ] }),
        /* @__PURE__ */ t("p", { id: "sr-unattended-risk", className: "text-xs text-muted mt-1", children: "Risk: anyone in a watched channel can write text the crew reads, so a crafted message could steer a command nobody reviews." }),
        /* @__PURE__ */ t(
          $,
          {
            primary: !0,
            className: "mt-3",
            disabled: !!n,
            onClick: () => a("Save crew", () => d.put(`${C}/crew`, { agent: R, model: W, unattended: u })),
            children: "Save crew"
          }
        )
      ] })
    ] }) })
  ] });
}
export {
  _t as default
};
