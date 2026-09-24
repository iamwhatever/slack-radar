import { jsxs as n, Fragment as F, jsx as e } from "react/jsx-runtime";
import { useAppApi as M } from "@kirocrew/app-sdk";
import { PageHeader as E, Btn as u, StatCard as D, Card as p, CardTitle as b, Badge as h, Input as f, EmptyState as U, Toggle as L } from "@kirocrew/app-sdk/ui";
import { useState as r, useCallback as j, useEffect as q, useMemo as O } from "react";
const d = "/api/apps/slack-radar", R = (t) => t ? new Date(t * 1e3).toLocaleString() : "never";
function z(t) {
  return t === "new" ? "warn" : t === "investigating" ? "aim" : t === "resolved" ? "ok" : "muted";
}
function X() {
  const t = M(), [l, m] = r("board"), [i, w] = r(null), [y, N] = r([]), [k, _] = r([]), [v, a] = r("open"), [o, $] = r(/* @__PURE__ */ new Set()), [T, C] = r(""), [I, x] = r(""), S = j(async () => {
    try {
      const [s, P, A] = await Promise.all([
        t.get(`${d}/state`),
        t.get(`${d}/items?status=${encodeURIComponent(v)}&limit=300`),
        t.get(`${d}/events?limit=150`)
      ]);
      w(s), N(P.items), _(A.events.slice().reverse());
    } catch (s) {
      x(`Could not load: ${s.message}`);
    }
  }, [t, v]);
  q(() => {
    S();
    const s = window.setInterval(S, 3e4);
    return () => window.clearInterval(s);
  }, [S]);
  const g = async (s, P) => {
    C(s), x("");
    try {
      await P(), x(`${s}: done`), await S();
    } catch (A) {
      x(`${s} failed: ${A.message}`);
    } finally {
      C("");
    }
  }, B = !!i && !!i.secrets.bot_token && i.settings.channels.length > 0;
  return /* @__PURE__ */ n(F, { children: [
    /* @__PURE__ */ e(
      E,
      {
        title: "Slack Radar",
        subtitle: "One crew triaging every channel you watch, with a local ledger and a daily digest",
        actions: /* @__PURE__ */ e("div", { className: "flex gap-2", children: ["board", "activity", "settings"].map((s) => /* @__PURE__ */ e(u, { primary: l === s, onClick: () => m(s), "aria-pressed": l === s, children: s[0].toUpperCase() + s.slice(1) }, s)) })
      }
    ),
    /* @__PURE__ */ n("div", { className: "px-6 pb-8 overflow-y-auto flex-1 min-h-0", children: [
      I && /* @__PURE__ */ e("p", { role: "status", className: "text-sm text-muted mb-3", children: I }),
      i ? l === "board" ? /* @__PURE__ */ e(
        G,
        {
          state: i,
          items: y,
          configured: B,
          filter: v,
          setFilter: a,
          selected: o,
          setSelected: $,
          busy: T,
          onPoll: () => g("Poll", () => t.post(`${d}/poll`, {})),
          onInvestigate: (s) => g("Investigate", async () => {
            await t.post(`${d}/investigate`, { keys: [...o], repo: s }), $(/* @__PURE__ */ new Set());
          }),
          onStart: () => g("Start crew", () => t.post(`${d}/crew/start`, {})),
          onPause: () => g("Pause crew", () => t.post(`${d}/crew/pause`, {})),
          onDigest: () => g("Request digest", () => t.post(`${d}/digest/request`, {}))
        }
      ) : l === "activity" ? /* @__PURE__ */ e(H, { events: k }) : /* @__PURE__ */ e(V, { state: i, busy: T, act: g }) : /* @__PURE__ */ e("p", { className: "text-sm text-muted", children: "Loading…" })
    ] })
  ] });
}
function G(t) {
  const { state: l, items: m, selected: i, setSelected: w } = t, [y, N] = r(""), k = l.counts.open_by_priority, _ = (a) => {
    const o = new Set(i);
    o.has(a) ? o.delete(a) : o.add(a), w(o);
  }, v = O(
    () => l.settings.channels.map((a) => ({ cid: a, ...l.channels[a] || {} })),
    [l]
  );
  return /* @__PURE__ */ n(F, { children: [
    /* @__PURE__ */ n("div", { className: "grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] mb-6", children: [
      /* @__PURE__ */ e(D, { label: "Awaiting triage", value: l.counts.needs_triage, accent: !0 }),
      /* @__PURE__ */ e(D, { label: "Possibly resolved", value: l.counts.possibly_resolved }),
      /* @__PURE__ */ e(D, { label: "Open p0 / p1", value: `${k.p0 || 0} / ${k.p1 || 0}` }),
      /* @__PURE__ */ e(D, { label: "Tracked items", value: l.counts.total })
    ] }),
    !t.configured && /* @__PURE__ */ n(p, { className: "mb-4", children: [
      /* @__PURE__ */ e(b, { children: "Finish setup" }),
      /* @__PURE__ */ e("p", { className: "text-sm text-muted", children: "Paste a Slack bot token and at least one channel ID in Settings. Nothing is polled until both are set." })
    ] }),
    /* @__PURE__ */ n(p, { className: "mb-4", children: [
      /* @__PURE__ */ e(b, { children: "Crew" }),
      /* @__PURE__ */ n("div", { className: "flex flex-wrap items-center gap-2 text-sm", children: [
        /* @__PURE__ */ e(h, { variant: l.crew.live ? "ok" : "muted", children: l.crew.live ? "running" : "paused" }),
        l.crew.running && /* @__PURE__ */ e(h, { variant: "aim", children: "mid-turn" }),
        l.crew.trusted && /* @__PURE__ */ e(h, { variant: "warn", children: "auto-approve on" }),
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
        R(l.last_poll_at),
        l.last_poll_error ? ` · ${l.last_poll_error}` : "",
        " · last digest",
        " ",
        l.digest.last_posted_date || "never",
        l.digest.last_error ? ` · ${l.digest.last_error}` : ""
      ] })
    ] }),
    /* @__PURE__ */ n(p, { className: "mb-4", children: [
      /* @__PURE__ */ e(b, { children: "Channels" }),
      v.length === 0 ? /* @__PURE__ */ e("p", { className: "text-sm text-muted", children: "No channels configured." }) : /* @__PURE__ */ n("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ e("thead", { children: /* @__PURE__ */ n("tr", { className: "text-left text-muted", children: [
          /* @__PURE__ */ e("th", { scope: "col", children: "Channel" }),
          /* @__PURE__ */ e("th", { scope: "col", children: "Last polled" }),
          /* @__PURE__ */ e("th", { scope: "col", children: "Status" })
        ] }) }),
        /* @__PURE__ */ e("tbody", { children: v.map((a) => /* @__PURE__ */ n("tr", { children: [
          /* @__PURE__ */ e("td", { className: "font-mono", children: a.cid }),
          /* @__PURE__ */ e("td", { children: R(a.last_polled_at) }),
          /* @__PURE__ */ e("td", { children: a.last_error ? /* @__PURE__ */ e(h, { variant: "err", children: a.last_error }) : /* @__PURE__ */ e(h, { variant: "ok", children: "ok" }) })
        ] }, a.cid)) })
      ] })
    ] }),
    /* @__PURE__ */ n(p, { children: [
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
          f,
          {
            "aria-label": "GitHub repository to search (owner/name, optional)",
            placeholder: "owner/repo (optional)",
            value: y,
            onChange: (a) => N(a.target.value),
            className: "w-48"
          }
        ),
        /* @__PURE__ */ n(u, { onClick: () => t.onInvestigate(y), disabled: i.size === 0 || !!t.busy, children: [
          "Investigate ",
          i.size || ""
        ] })
      ] }),
      m.length === 0 ? /* @__PURE__ */ e(U, { icon: /* @__PURE__ */ e("span", { "aria-hidden": !0, children: "📡" }), title: "Nothing here yet", subtitle: "New messages appear after the next poll." }) : /* @__PURE__ */ e("ul", { className: "flex flex-col gap-2", children: m.map((a) => /* @__PURE__ */ n("li", { className: "border rounded p-2 text-sm", children: [
        /* @__PURE__ */ n("div", { className: "flex flex-wrap items-center gap-2", children: [
          /* @__PURE__ */ e(
            "input",
            {
              type: "checkbox",
              "aria-label": `Select ${a.key} for investigation`,
              checked: i.has(a.key),
              onChange: () => _(a.key)
            }
          ),
          /* @__PURE__ */ e(h, { variant: z(a.status), children: a.status }),
          a.priority && /* @__PURE__ */ e(h, { variant: a.priority === "p0" || a.priority === "p1" ? "err" : "muted", children: a.priority }),
          a.category && /* @__PURE__ */ e(h, { variant: "muted", children: a.category }),
          a.possibly_resolved && /* @__PURE__ */ n(h, { variant: "warn", children: [
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
function H({ events: t }) {
  return /* @__PURE__ */ n(p, { children: [
    /* @__PURE__ */ e(b, { children: "Activity" }),
    t.length === 0 ? /* @__PURE__ */ e("p", { className: "text-sm text-muted", children: "No activity yet." }) : /* @__PURE__ */ e("ul", { className: "text-sm flex flex-col gap-1", children: t.map((l, m) => /* @__PURE__ */ n("li", { children: [
      /* @__PURE__ */ e("span", { className: "text-muted", children: R(l.at) }),
      " ",
      /* @__PURE__ */ e(h, { variant: "muted", children: l.kind }),
      " ",
      l.text
    ] }, `${l.at}-${m}`)) })
  ] });
}
function V({
  state: t,
  busy: l,
  act: m
}) {
  const i = M(), [w, y] = r(t.settings.channels.join(`
`)), [N, k] = r(t.settings.digest_channel), [_, v] = r(t.settings.digest_send_message), [a, o] = r(String(t.settings.poll_interval_secs)), [$, T] = r(String(t.settings.backfill_hours)), [C, I] = r(""), [x, S] = r(t.crew.unattended), [g, B] = r(t.crew.agent), [s, P] = r(t.crew.model), A = () => m(
    "Save settings",
    () => i.put(`${d}/settings`, {
      channels: w.split(/[\s,]+/).map((c) => c.trim()).filter(Boolean),
      digest_channel: N.trim(),
      digest_send_message: _,
      poll_interval_secs: Number(a),
      backfill_hours: Number($)
    })
  );
  return /* @__PURE__ */ n(F, { children: [
    !t.vault_available && /* @__PURE__ */ e(p, { className: "mb-4", children: /* @__PURE__ */ e("p", { className: "text-sm", children: "The gateway secret vault is unavailable, so settings and the token cannot be saved." }) }),
    /* @__PURE__ */ n(p, { className: "mb-4", children: [
      /* @__PURE__ */ e(b, { children: "Slack bot token" }),
      /* @__PURE__ */ n("p", { className: "text-sm text-muted mb-2", children: [
        "Stored in the gateway's encrypted vault. Agents cannot read it, and it is never shown again after saving. Status: ",
        t.secrets.bot_token ? "set" : "not set",
        "."
      ] }),
      /* @__PURE__ */ n("div", { className: "flex flex-wrap gap-2", children: [
        /* @__PURE__ */ e(
          f,
          {
            type: "password",
            autoComplete: "off",
            "aria-label": "Slack Bot User OAuth Token",
            placeholder: "xoxb-…",
            value: C,
            onChange: (c) => I(c.target.value),
            className: "w-80"
          }
        ),
        /* @__PURE__ */ e(
          u,
          {
            primary: !0,
            disabled: !C || !!l,
            onClick: () => m("Save token", async () => {
              await i.put(`${d}/token`, { value: C }), I("");
            }),
            children: "Save token"
          }
        ),
        t.secrets.bot_token && /* @__PURE__ */ e(u, { danger: !0, disabled: !!l, onClick: () => m("Remove token", () => i.del(`${d}/token`)), children: "Remove token" })
      ] })
    ] }),
    /* @__PURE__ */ n(p, { className: "mb-4", children: [
      /* @__PURE__ */ e(b, { children: "Channels and digest" }),
      /* @__PURE__ */ e("label", { className: "block text-sm mb-1", htmlFor: "sr-channels", children: "Channel IDs to watch (one per line; e.g. C0123ABCD). Invite the bot to each one." }),
      /* @__PURE__ */ e(
        "textarea",
        {
          id: "sr-channels",
          className: "w-full font-mono text-sm border rounded p-2 bg-transparent",
          rows: 5,
          value: w,
          onChange: (c) => y(c.target.value)
        }
      ),
      /* @__PURE__ */ n("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] mt-3", children: [
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "Digest channel ID (empty = no Slack post)",
          /* @__PURE__ */ e(f, { value: N, onChange: (c) => k(c.target.value), placeholder: "C0DIGEST1" })
        ] }),
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "Poll interval (seconds, 60–3600)",
          /* @__PURE__ */ e(f, { type: "number", min: 60, max: 3600, value: a, onChange: (c) => o(c.target.value) })
        ] }),
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "First-poll backfill (hours, 0–168)",
          /* @__PURE__ */ e(f, { type: "number", min: 0, max: 168, value: $, onChange: (c) => T(c.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ e("div", { className: "mt-3", children: /* @__PURE__ */ e(L, { checked: _, onChange: v, label: "Also send the digest to me with send_message" }) }),
      /* @__PURE__ */ e(u, { primary: !0, className: "mt-3", disabled: !!l, onClick: A, children: "Save settings" })
    ] }),
    /* @__PURE__ */ n(p, { children: [
      /* @__PURE__ */ e(b, { children: "Crew" }),
      /* @__PURE__ */ n("div", { className: "grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]", children: [
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "Agent",
          /* @__PURE__ */ e(f, { value: g, onChange: (c) => B(c.target.value) })
        ] }),
        /* @__PURE__ */ n("label", { className: "text-sm", children: [
          "Model (empty = agent default)",
          /* @__PURE__ */ e(f, { value: s, onChange: (c) => P(c.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ n("div", { className: "mt-3", children: [
        /* @__PURE__ */ e(L, { checked: x, onChange: S, label: "Auto-approve the crew's tool calls (unattended)" }),
        /* @__PURE__ */ e("p", { className: "text-xs text-muted mt-1", children: "The crew reads messages anyone in your channels can write. With auto-approve on, a crafted message can steer an unreviewed tool call. Leave it off unless every watched channel is trusted." })
      ] }),
      /* @__PURE__ */ e(
        u,
        {
          primary: !0,
          className: "mt-3",
          disabled: !!l,
          onClick: () => m("Save crew", () => i.put(`${d}/crew`, { agent: g, model: s, unattended: x })),
          children: "Save crew"
        }
      )
    ] })
  ] });
}
export {
  X as default
};
