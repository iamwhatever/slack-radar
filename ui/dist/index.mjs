import { jsxs as n, Fragment as E, jsx as e } from "react/jsx-runtime";
import { useAppApi as q } from "@kirocrew/app-sdk";
import { PageHeader as z, Btn as u, StatCard as B, Card as g, CardTitle as b, Badge as m, Input as x, EmptyState as O, Toggle as G } from "@kirocrew/app-sdk/ui";
import { useState as r, useCallback as U, useEffect as j, useMemo as V } from "react";
const h = "/api/apps/slack-radar", Y = {
  connected: "connected",
  needs_login: "needs re-login",
  binary_not_found: "binary not found",
  incompatible: "connected, but missing read tools",
  error: "error"
}, F = (t) => t ? new Date(t * 1e3).toLocaleString() : "never";
function J(t) {
  return t === "new" ? "warn" : t === "investigating" ? "aim" : t === "resolved" ? "ok" : "muted";
}
function ne() {
  const t = q(), [l, d] = r("board"), [i, N] = r(null), [f, k] = r([]), [_, C] = r([]), [p, a] = r("open"), [o, P] = r(/* @__PURE__ */ new Set()), [D, $] = r(""), [I, w] = r(""), [R, M] = r(null), A = U(async () => {
    try {
      M(await t.get(`${h}/mcp/status`));
    } catch (s) {
      M({ status: "error", command: "", detail: s.message });
    }
  }, [t]);
  j(() => {
    A();
  }, [A]);
  const y = U(async () => {
    try {
      const [s, S, L] = await Promise.all([
        t.get(`${h}/state`),
        t.get(`${h}/items?status=${encodeURIComponent(p)}&limit=300`),
        t.get(`${h}/events?limit=150`)
      ]);
      N(s), k(S.items), C(L.events.slice().reverse());
    } catch (s) {
      w(`Could not load: ${s.message}`);
    }
  }, [t, p]);
  j(() => {
    y();
    const s = window.setInterval(y, 3e4);
    return () => window.clearInterval(s);
  }, [y]);
  const v = async (s, S) => {
    $(s), w("");
    try {
      await S(), w(`${s}: done`), await y();
    } catch (L) {
      w(`${s} failed: ${L.message}`);
    } finally {
      $("");
    }
  }, T = !!i && i.settings.channels.length > 0;
  return /* @__PURE__ */ n(E, { children: [
    /* @__PURE__ */ e(
      z,
      {
        title: "Slack Radar",
        subtitle: "One crew triaging every channel you watch, with a local ledger and a daily digest",
        actions: /* @__PURE__ */ e("div", { className: "flex gap-2", children: ["board", "activity", "settings"].map((s) => /* @__PURE__ */ e(u, { primary: l === s, onClick: () => d(s), "aria-pressed": l === s, children: s[0].toUpperCase() + s.slice(1) }, s)) })
      }
    ),
    /* @__PURE__ */ n("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      I && /* @__PURE__ */ e("p", { role: "status", className: "text-sm text-muted mb-3", children: I }),
      i ? l === "board" ? /* @__PURE__ */ e(
        K,
        {
          state: i,
          items: f,
          configured: T,
          mcp: R,
          filter: p,
          setFilter: a,
          selected: o,
          setSelected: P,
          busy: D,
          onPoll: () => v("Poll", () => t.post(`${h}/poll`, {})),
          onInvestigate: (s) => v("Investigate", async () => {
            await t.post(`${h}/investigate`, { keys: [...o], repo: s }), P(/* @__PURE__ */ new Set());
          }),
          onStart: () => v("Start crew", () => t.post(`${h}/crew/start`, {})),
          onPause: () => v("Pause crew", () => t.post(`${h}/crew/pause`, {})),
          onDigest: () => v("Request digest", () => t.post(`${h}/digest/request`, {}))
        }
      ) : l === "activity" ? /* @__PURE__ */ e(Q, { events: _ }) : /* @__PURE__ */ e(X, { state: i, busy: D, act: v, mcp: R, onProbe: A }) : /* @__PURE__ */ e("p", { className: "text-sm text-muted", children: "Loading…" })
    ] })
  ] });
}
function K(t) {
  const { state: l, items: d, selected: i, setSelected: N } = t, [f, k] = r(""), _ = l.counts.open_by_priority, C = (a) => {
    const o = new Set(i);
    o.has(a) ? o.delete(a) : o.add(a), N(o);
  }, p = V(
    () => l.settings.channels.map((a) => ({ cid: a, ...l.channels[a] || {} })),
    [l]
  );
  return /* @__PURE__ */ n(E, { children: [
    /* @__PURE__ */ n("div", { className: "grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-6", children: [
      /* @__PURE__ */ e(B, { label: "Awaiting triage", value: l.counts.needs_triage, accent: !0 }),
      /* @__PURE__ */ e(B, { label: "Possibly resolved", value: l.counts.possibly_resolved }),
      /* @__PURE__ */ e(B, { label: "Open p0 / p1", value: `${_.p0 || 0} / ${_.p1 || 0}` }),
      /* @__PURE__ */ e(B, { label: "Tracked items", value: l.counts.total })
    ] }),
    /* @__PURE__ */ e(H, { mcp: t.mcp, sourceState: l.source_state, sourceError: l.source_error }),
    !t.configured && /* @__PURE__ */ n(g, { className: "mb-4", children: [
      /* @__PURE__ */ e(b, { children: "Finish setup" }),
      /* @__PURE__ */ e("p", { className: "text-sm text-muted", children: "Add at least one channel ID in Settings. Slack Radar reads with your own Slack identity through your Slack MCP, so there is no bot to invite." })
    ] }),
    /* @__PURE__ */ n(g, { className: "mb-4", children: [
      /* @__PURE__ */ e(b, { children: "Crew" }),
      /* @__PURE__ */ n("div", { className: "flex flex-wrap items-center gap-2 text-sm", children: [
        /* @__PURE__ */ e(m, { variant: l.crew.live ? "ok" : "muted", children: l.crew.live ? "running" : "paused" }),
        l.crew.running && /* @__PURE__ */ e(m, { variant: "aim", children: "mid-turn" }),
        l.crew.trusted && /* @__PURE__ */ e(m, { variant: "warn", children: "auto-approve on" }),
        /* @__PURE__ */ n("span", { className: "text-muted", children: [
          "phase ",
          l.crew_memory.phase,
          " · next: ",
          l.crew_memory.next || "—"
        ] })
      ] }),
      /* @__PURE__ */ n("div", { className: "flex flex-wrap gap-2 mt-3", children: [
        l.crew.live ? /* @__PURE__ */ e(u, { onClick: t.onPause, disabled: !!t.busy, children: "Pause crew" }) : /* @__PURE__ */ e(u, { primary: !0, onClick: t.onStart, disabled: !!t.busy || !t.configured, children: "Start crew" }),
        /* @__PURE__ */ e(u, { onClick: t.onPoll, disabled: !!t.busy || !t.configured, children: "Poll now" }),
        /* @__PURE__ */ e(u, { onClick: t.onDigest, disabled: !!t.busy || !l.crew.live, children: "Request digest" })
      ] }),
      /* @__PURE__ */ n("p", { className: "text-xs text-muted mt-2", children: [
        "Last poll ",
        F(l.last_poll_at),
        l.last_poll_error ? ` · ${l.last_poll_error}` : "",
        " · last digest",
        " ",
        l.digest.last_posted_date || "never",
        l.digest.last_error ? ` · ${l.digest.last_error}` : ""
      ] }),
      l.digest.last_text && /* @__PURE__ */ n("details", { className: "mt-2 text-sm", children: [
        /* @__PURE__ */ e("summary", { className: "cursor-pointer", children: "Last digest" }),
        /* @__PURE__ */ e("pre", { className: "whitespace-pre-wrap text-xs mt-1", children: l.digest.last_text })
      ] })
    ] }),
    /* @__PURE__ */ n(g, { className: "mb-4", children: [
      /* @__PURE__ */ e(b, { children: "Channels" }),
      p.length === 0 ? /* @__PURE__ */ e("p", { className: "text-sm text-muted", children: "No channels configured." }) : /* @__PURE__ */ n("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ e("thead", { children: /* @__PURE__ */ n("tr", { className: "text-left text-muted", children: [
          /* @__PURE__ */ e("th", { scope: "col", children: "Channel" }),
          /* @__PURE__ */ e("th", { scope: "col", children: "Last polled" }),
          /* @__PURE__ */ e("th", { scope: "col", children: "Status" })
        ] }) }),
        /* @__PURE__ */ e("tbody", { children: p.map((a) => /* @__PURE__ */ n("tr", { children: [
          /* @__PURE__ */ e("td", { className: "font-mono", children: a.cid }),
          /* @__PURE__ */ e("td", { children: F(a.last_polled_at) }),
          /* @__PURE__ */ e("td", { children: a.last_error ? /* @__PURE__ */ e(m, { variant: "err", children: a.last_error }) : /* @__PURE__ */ e(m, { variant: "ok", children: "ok" }) })
        ] }, a.cid)) })
      ] })
    ] }),
    /* @__PURE__ */ n(g, { children: [
      /* @__PURE__ */ n("div", { className: "flex flex-wrap items-center gap-2 mb-3", children: [
        /* @__PURE__ */ e(b, { children: "Ledger" }),
        /* @__PURE__ */ e("label", { className: "text-sm text-muted", htmlFor: "sr-filter", children: "Show" }),
        /* @__PURE__ */ n(
          "select",
          {
            id: "sr-filter",
            className: "text-sm bg-transparent border rounded px-2 py-1",
            value: t.filter,
            onChange: (a) => t.setFilter(a.target.value),
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
          x,
          {
            "aria-label": "GitHub repository to search (owner/name, optional)",
            placeholder: "owner/repo (optional)",
            value: f,
            onChange: (a) => k(a.target.value),
            className: "w-48"
          }
        ),
        /* @__PURE__ */ n(u, { onClick: () => t.onInvestigate(f), disabled: i.size === 0 || !!t.busy, children: [
          "Investigate ",
          i.size || ""
        ] })
      ] }),
      d.length === 0 ? /* @__PURE__ */ e(O, { icon: /* @__PURE__ */ e("span", { "aria-hidden": !0, children: "📡" }), title: "Nothing here yet", subtitle: "New messages appear after the next poll." }) : /* @__PURE__ */ e("ul", { className: "flex flex-col gap-2", children: d.map((a) => /* @__PURE__ */ n("li", { className: "border rounded p-2 text-sm", children: [
        /* @__PURE__ */ n("div", { className: "flex flex-wrap items-center gap-2", children: [
          /* @__PURE__ */ e(
            "input",
            {
              type: "checkbox",
              "aria-label": `Select ${a.key} for investigation`,
              checked: i.has(a.key),
              onChange: () => C(a.key)
            }
          ),
          /* @__PURE__ */ e(m, { variant: J(a.status), children: a.status }),
          a.priority && /* @__PURE__ */ e(m, { variant: a.priority === "p0" || a.priority === "p1" ? "err" : "muted", children: a.priority }),
          a.category && /* @__PURE__ */ e(m, { variant: "muted", children: a.category }),
          a.possibly_resolved && /* @__PURE__ */ n(m, { variant: "warn", children: [
            "possibly resolved: ",
            a.possibly_resolved.reason
          ] }),
          /* @__PURE__ */ e("span", { className: "text-muted font-mono", children: a.channel }),
          /* @__PURE__ */ e("a", { className: "underline", href: a.permalink, target: "_blank", rel: "noreferrer noopener", children: "open in Slack" }),
          a.reply_count > 0 && /* @__PURE__ */ n("span", { className: "text-muted", children: [
            a.reply_count,
            " replies"
          ] })
        ] }),
        /* @__PURE__ */ e("p", { className: "mt-1", children: a.summary || a.text.slice(0, 280) }),
        a.links.length > 0 && /* @__PURE__ */ n("p", { className: "mt-1 text-muted", children: [
          "Linked:",
          " ",
          a.links.map((o) => /* @__PURE__ */ e("a", { className: "underline mr-2", href: o, target: "_blank", rel: "noreferrer noopener", children: o.replace("https://github.com/", "") }, o))
        ] }),
        a.note && /* @__PURE__ */ e("p", { className: "mt-1 text-xs text-muted", children: a.note })
      ] }, a.key)) })
    ] })
  ] });
}
function H({ mcp: t, sourceState: l, sourceError: d }) {
  const i = l === "needs_login" ? "needs_login" : (t == null ? void 0 : t.status) || "checking";
  return /* @__PURE__ */ n("p", { role: "status", className: "text-sm mb-4 flex flex-wrap items-center gap-2", children: [
    /* @__PURE__ */ e("span", { children: "Slack MCP:" }),
    /* @__PURE__ */ e(m, { variant: i === "connected" ? "ok" : i === "checking" ? "muted" : "err", children: Y[i] || i }),
    (t == null ? void 0 : t.command) && /* @__PURE__ */ e("span", { className: "font-mono text-muted", children: t.command }),
    i === "needs_login" && /* @__PURE__ */ e("span", { className: "text-muted", children: "Re-authenticate your Slack MCP (e.g. refresh its browser/Midway login). Polling resumes on the next cycle." }),
    i !== "connected" && (d || (t == null ? void 0 : t.detail)) && /* @__PURE__ */ e("span", { className: "text-muted", children: d || (t == null ? void 0 : t.detail) })
  ] });
}
function Q({ events: t }) {
  return /* @__PURE__ */ n(g, { children: [
    /* @__PURE__ */ e(b, { children: "Activity" }),
    t.length === 0 ? /* @__PURE__ */ e("p", { className: "text-sm text-muted", children: "No activity yet." }) : /* @__PURE__ */ e("ul", { className: "text-sm flex flex-col gap-1", children: t.map((l, d) => /* @__PURE__ */ n("li", { children: [
      /* @__PURE__ */ e("span", { className: "text-muted", children: F(l.at) }),
      " ",
      /* @__PURE__ */ e(m, { variant: "muted", children: l.kind }),
      " ",
      l.text
    ] }, `${l.at}-${d}`)) })
  ] });
}
function X({
  state: t,
  busy: l,
  act: d,
  mcp: i,
  onProbe: N
}) {
  const f = q(), [k, _] = r(t.settings.channels.join(`
`)), [C, p] = r(t.settings.digest_destination), [a, o] = r(t.settings.slack_login), [P, D] = r(t.settings.slack_mcp_command), [$, I] = r(t.settings.workspace_url), [w, R] = r(String(t.settings.poll_interval_secs)), [M, A] = r(String(t.settings.backfill_hours)), [y, v] = r(t.crew.unattended), [T, s] = r(t.crew.agent), [S, L] = r(t.crew.model), W = () => d(
    "Save settings",
    () => f.put(`${h}/settings`, {
      channels: k.split(/[\s,]+/).map((c) => c.trim()).filter(Boolean),
      digest_destination: C,
      slack_login: a.trim(),
      slack_mcp_command: P.trim(),
      workspace_url: $.trim(),
      poll_interval_secs: Number(w),
      backfill_hours: Number(M)
    })
  );
  return /* @__PURE__ */ n(E, { children: [
    !t.vault_available && /* @__PURE__ */ e(g, { className: "mb-4", children: /* @__PURE__ */ e("p", { className: "text-sm", children: "The gateway secret vault is unavailable, so settings cannot be saved." }) }),
    /* @__PURE__ */ n(g, { className: "mb-4", children: [
      /* @__PURE__ */ e(b, { children: "Slack MCP" }),
      /* @__PURE__ */ e(H, { mcp: i, sourceState: t.source_state, sourceError: t.source_error }),
      /* @__PURE__ */ n("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "MCP server command (a single executable on PATH)",
          /* @__PURE__ */ e(x, { value: P, onChange: (c) => D(c.target.value), placeholder: "ai-community-slack-mcp" })
        ] }),
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "Workspace URL (for permalinks, optional)",
          /* @__PURE__ */ e(x, { value: $, onChange: (c) => I(c.target.value), placeholder: "https://yourteam.slack.com" })
        ] })
      ] }),
      /* @__PURE__ */ e("p", { className: "text-xs text-muted mt-2", children: "Slack is read with your own identity through this MCP server: read-only tools only, no bot, no invite. The one write is the optional digest DM to yourself." }),
      /* @__PURE__ */ e(u, { className: "mt-2", disabled: !!l, onClick: N, children: "Check connection" })
    ] }),
    /* @__PURE__ */ n(g, { className: "mb-4", children: [
      /* @__PURE__ */ e(b, { children: "Channels and digest" }),
      /* @__PURE__ */ e("label", { className: "block text-sm mb-1", htmlFor: "sr-channels", children: "Channel IDs to watch (one per line; e.g. C0123ABCD). Any channel you can read works." }),
      /* @__PURE__ */ e(
        "textarea",
        {
          id: "sr-channels",
          className: "w-full font-mono text-sm border rounded p-2 bg-transparent",
          rows: 5,
          value: k,
          onChange: (c) => _(c.target.value)
        }
      ),
      /* @__PURE__ */ n("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "Digest destination",
          /* @__PURE__ */ n(
            "select",
            {
              className: "block w-full text-sm bg-transparent border rounded px-2 py-1",
              value: C,
              onChange: (c) => p(c.target.value),
              children: [
                /* @__PURE__ */ e("option", { value: "dashboard", children: "Dashboard notification only" }),
                /* @__PURE__ */ e("option", { value: "self_dm", children: "DM to myself (self_dm)" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "Your Slack login (for the self-DM)",
          /* @__PURE__ */ e(x, { value: a, onChange: (c) => o(c.target.value), placeholder: "jdoe" })
        ] }),
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "Poll interval (seconds, 60–3600)",
          /* @__PURE__ */ e(x, { type: "number", min: 60, max: 3600, value: w, onChange: (c) => R(c.target.value) })
        ] }),
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "First-poll backfill (hours, 0–168)",
          /* @__PURE__ */ e(x, { type: "number", min: 0, max: 168, value: M, onChange: (c) => A(c.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ e(u, { primary: !0, className: "mt-3", disabled: !!l, onClick: W, children: "Save settings" })
    ] }),
    /* @__PURE__ */ n(g, { children: [
      /* @__PURE__ */ e(b, { children: "Crew" }),
      /* @__PURE__ */ n("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "Agent",
          /* @__PURE__ */ e(x, { value: T, onChange: (c) => s(c.target.value) })
        ] }),
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "Model (empty = agent default)",
          /* @__PURE__ */ e(x, { value: S, onChange: (c) => L(c.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ n("div", { className: "mt-3", children: [
        /* @__PURE__ */ e(G, { checked: y, onChange: v, label: "Auto-approve the crew's tool calls (unattended)" }),
        /* @__PURE__ */ e("p", { className: "text-xs text-muted mt-1", children: "The crew reads messages anyone in your channels can write. With auto-approve on, a crafted message can steer an unreviewed tool call. Leave it off unless every watched channel is trusted." })
      ] }),
      /* @__PURE__ */ e(
        u,
        {
          primary: !0,
          className: "mt-3",
          disabled: !!l,
          onClick: () => d("Save crew", () => f.put(`${h}/crew`, { agent: T, model: S, unattended: y })),
          children: "Save crew"
        }
      )
    ] })
  ] });
}
export {
  ne as default
};
