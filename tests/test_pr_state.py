"""A dispatched fix's PR state, read with the owner's own ``gh``, and what it changes.

* ``github_state.refresh``: the runner argv, the stored ``fix_handoff.pr_state``, the
  batch cap, the per-URL gap, terminal states never re-read, the ``gh``-unavailable
  backoff, one ``PR #N merged`` event per transition;
* ``store.needs_reanalysis``: a merged/closed fix the Lead has not seen joins the set;
  ``send_reanalyze`` marks it seen;
* ``reanalyze_prompt``: the PR line and the merged/closed rule;
* ``/needs``: a merged fix sits in ``decide`` as ``Fix merged · PR #N`` and leaves
  ``fixes``;
* the record tool cannot write ``pr_state`` or ``pr_state_seen_at``.
"""

from __future__ import annotations

import asyncio
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from backend import crew_runtime, github_state, needs, store  # noqa: E402
from test_needs import _ctx, _Req, _route, _seed, routes  # noqa: E402,F401
from tests.test_wake import _slot, env  # noqa: E402,F401

NOW = 1_800_000_000.0
C1 = "C0AAAAAAA"


def _url(n: int) -> str:
    return f"https://github.com/acme/app/pull/{n}"


def _item(n: int, *, pr: str = "", pr_urls: list[str] | None = None, **kw: Any) -> dict[str, Any]:
    t = NOW - n * 60
    h: dict[str, Any] = {
        "title": f"Fix {n}", "prompt": "p", "repo": "acme/app", "links": [], "at": t,
        "dispatch": {"session_key": f"chat-{n}-1", "title": f"Fix {n}", "agent": "kirocrew-conductor", "at": t},
        "pr_url": pr, "pr_urls": pr_urls or [],
    }
    h.update(kw.pop("handoff", {}))
    base = {"key": f"{C1}:{int(t)}.{n:06d}", "channel": C1, "ts_float": t, "text": f"m{n}", "status": "triaged",
            "priority": "p2", "category": "bug-report", "handled_at": 0.0, "last_thread_check_at": NOW - 1000,
            "fix_handoff": h}
    base.update(kw)
    return base


class FakeGh:
    """Answers ``gh pr view <url> --json ...`` from a table; records every argv."""

    def __init__(self, answers: dict[str, Any] | None = None) -> None:
        self.answers = answers or {}
        self.calls: list[list[str]] = []

    def __call__(self, argv: list[str]) -> tuple[int, str, str]:
        self.calls.append(argv)
        a = self.answers.get(argv[3], {"state": "OPEN", "isDraft": False})
        if isinstance(a, BaseException):
            raise a
        if isinstance(a, tuple):
            return a
        return 0, json.dumps(a), ""

    @property
    def urls(self) -> list[str]:
        return [c[3] for c in self.calls]


def _refresh(data: Path, gh: FakeGh, at: float = NOW) -> dict[str, Any]:
    return asyncio.run(github_state.refresh(data, run=gh, now_=at))


def _ps(data: Path, key: str) -> dict[str, Any]:
    return store.read_ledger(data)["items"][key]["fix_handoff"].get("pr_state")


@pytest.fixture(autouse=True)
def _no_real_gh(monkeypatch: pytest.MonkeyPatch) -> None:
    def _refuse(argv: list[str]) -> tuple[int, str, str]:
        raise AssertionError(f"real gh called: {argv}")

    monkeypatch.setattr(github_state, "runner", _refuse)


# ── github_state.refresh ───────────────────────────────────────────────────


def test_merged_pr_is_read_read_only_and_stored(tmp_path: Path) -> None:
    it = _item(1, pr=_url(412))
    _seed(tmp_path, it)
    gh = FakeGh({_url(412): {"state": "MERGED", "mergedAt": "2026-09-30T10:00:00Z", "isDraft": False}})
    out = _refresh(tmp_path, gh)
    assert gh.calls == [["gh", "pr", "view", _url(412), "--json", "state,mergedAt,closedAt,isDraft"]]
    assert out["merged"] == [it["key"]] and out["checked"] == 1
    assert _ps(tmp_path, it["key"]) == {"state": "merged", "at": NOW, "checked_at": NOW,
                                        "merged_at": "2026-09-30T10:00:00Z"}
    # merged is terminal: never read again
    _refresh(tmp_path, gh, NOW + 10 * 3600)
    assert len(gh.calls) == 1


@pytest.mark.parametrize("answer,state", [
    ({"state": "OPEN", "isDraft": False}, "open"),
    ({"state": "OPEN", "isDraft": True}, "draft"),
    ({"state": "CLOSED", "isDraft": False}, "closed"),
    ({"state": "WAT"}, "unknown"),
])
def test_gh_states_map(tmp_path: Path, answer: dict, state: str) -> None:
    it = _item(1, pr=_url(5))
    _seed(tmp_path, it)
    _refresh(tmp_path, FakeGh({_url(5): answer}))
    assert _ps(tmp_path, it["key"])["state"] == state


def test_batch_cap_and_oldest_checked_first(tmp_path: Path) -> None:
    rows = [_item(i, pr=_url(100 + i)) for i in range(1, 13)]
    _seed(tmp_path, *rows)
    gh = FakeGh()
    _refresh(tmp_path, gh)
    assert len(gh.calls) == github_state.BATCH_MAX
    first = set(gh.urls)
    # the next cycle, past the gap, reads the two left over first
    gh2 = FakeGh()
    _refresh(tmp_path, gh2, NOW + github_state.MIN_GAP_SECS + 1)
    left = {_url(100 + i) for i in range(1, 13)} - first
    assert len(left) == 2 and set(gh2.urls[:2]) == left and len(gh2.calls) == github_state.BATCH_MAX


def test_min_gap_per_url(tmp_path: Path) -> None:
    it = _item(1, pr=_url(7))
    _seed(tmp_path, it)
    gh = FakeGh()
    _refresh(tmp_path, gh)
    _refresh(tmp_path, gh, NOW + github_state.MIN_GAP_SECS - 1)
    assert len(gh.calls) == 1
    _refresh(tmp_path, gh, NOW + github_state.MIN_GAP_SECS + 1)
    assert len(gh.calls) == 2
    ps = _ps(tmp_path, it["key"])
    assert ps["state"] == "open" and ps["at"] == NOW and ps["checked_at"] == NOW + github_state.MIN_GAP_SECS + 1


@pytest.mark.parametrize("failure,why", [
    (FileNotFoundError("gh"), "gh is not installed"),
    ((1, "", "To get started with GitHub CLI, please run:  gh auth login"), "gh is not logged in"),
    ((1, "", "API rate limit exceeded for user"), "gh is rate-limited"),
    (subprocess.TimeoutExpired(["gh"], 20), "gh timed out"),
])
def test_gh_unavailable_records_unknown_once_and_backs_off(tmp_path: Path, failure: Any, why: str) -> None:
    a, b = _item(1, pr=_url(1)), _item(2, pr=_url(2))
    _seed(tmp_path, a, b)
    gh = FakeGh({_url(1): failure, _url(2): failure})
    out = _refresh(tmp_path, gh)
    assert len(gh.calls) == 1 and out["unavailable"] == why
    for it in (a, b):
        ps = _ps(tmp_path, it["key"])
        assert ps["state"] == "unknown" and ps["why"] == why
    # no read at all for an hour, whatever the per-URL gap says
    _refresh(tmp_path, gh, NOW + github_state.MIN_GAP_SECS + 1)
    assert len(gh.calls) == 1
    ok = FakeGh()
    _refresh(tmp_path, ok, NOW + github_state.UNKNOWN_BACKOFF_SECS + 1)
    assert len(ok.calls) == 2 and _ps(tmp_path, a["key"])["state"] == "open"


def test_one_pr_failing_does_not_stop_the_others(tmp_path: Path) -> None:
    a, b = _item(1, pr=_url(1)), _item(2, pr=_url(2))
    _seed(tmp_path, a, b)
    gh = FakeGh({_url(1): (1, "", "GraphQL: Could not resolve to a PullRequest")})
    _refresh(tmp_path, gh)
    assert len(gh.calls) == 2
    assert _ps(tmp_path, a["key"])["state"] == "unknown" and _ps(tmp_path, b["key"])["state"] == "open"
    # an unknown URL waits the backoff, not the normal gap
    _refresh(tmp_path, gh, NOW + github_state.MIN_GAP_SECS + 1)
    assert gh.urls.count(_url(1)) == 1


def test_merged_event_once_per_transition(tmp_path: Path) -> None:
    it = _item(1, pr=_url(9))
    _seed(tmp_path, it)
    _refresh(tmp_path, FakeGh())
    _refresh(tmp_path, FakeGh({_url(9): {"state": "MERGED", "mergedAt": "2026-09-30T00:00:00Z"}}),
             NOW + github_state.MIN_GAP_SECS + 1)
    _refresh(tmp_path, FakeGh({_url(9): {"state": "MERGED"}}), NOW + 99_999)
    texts = [e["text"] for e in store.read_events(tmp_path) if e["kind"] == "dispatch"]
    assert texts == ["PR #9 merged"]
    ps = _ps(tmp_path, it["key"])
    assert ps["at"] == NOW + github_state.MIN_GAP_SECS + 1  # when it changed, not the first read


def test_batch_members_share_one_read_and_one_event(tmp_path: Path) -> None:
    a = _item(1, pr_urls=[_url(50)])
    b = _item(2, pr_urls=[_url(50)])
    _seed(tmp_path, a, b)
    gh = FakeGh({_url(50): {"state": "MERGED"}})
    _refresh(tmp_path, gh)
    assert gh.urls == [_url(50)]
    assert _ps(tmp_path, a["key"])["state"] == _ps(tmp_path, b["key"])["state"] == "merged"
    assert [e["text"] for e in store.read_events(tmp_path) if e["kind"] == "dispatch"] == ["PR #50 merged"]


def test_only_open_unhandled_github_prs_are_read(tmp_path: Path) -> None:
    rows = [
        _item(1, pr=_url(1), status="resolved"),
        _item(2, pr=_url(2), handled_at=NOW - 5),
        _item(3, pr="https://gitlab.com/acme/app/-/merge_requests/3"),
        _item(4),
    ]
    _seed(tmp_path, *rows)
    gh = FakeGh()
    out = _refresh(tmp_path, gh)
    assert gh.calls == [] and out["checked"] == 0


def test_poll_cycle_reads_pr_states(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend import settings as settings_mod, watch

    async def _none(*_a: Any, **_k: Any) -> Any:
        return None

    it = _item(1, pr=_url(3))
    _seed(tmp_path, it)
    gh = FakeGh({_url(3): {"state": "CLOSED"}})
    monkeypatch.setattr(github_state, "runner", gh)
    monkeypatch.setattr(settings_mod, "read_settings", settings_mod.defaults)
    monkeypatch.setattr(crew_runtime, "dispatch_watcher", _none)
    monkeypatch.setattr(crew_runtime, "after_poll", _none)
    summary = asyncio.run(watch.poll_once(tmp_path, client_factory=lambda s: None))
    assert gh.urls == [_url(3)] and summary["pr_states"]["changed"] == [it["key"]]


# ── the re-analyze set ─────────────────────────────────────────────────────


def _merged(at: float = NOW, **extra: Any) -> dict[str, Any]:
    return {"pr_state": {"state": "merged", "at": at, "checked_at": at, "merged_at": "2026-09-30T10:00:00Z"}, **extra}


def test_needs_reanalysis_for_a_merged_fix_until_seen() -> None:
    it = _item(1, pr=_url(412), handoff=_merged())
    assert store.needs_reanalysis(it)
    it["fix_handoff"]["pr_state_seen_at"] = NOW + 1
    assert not store.needs_reanalysis(it)
    it["fix_handoff"]["pr_state"]["at"] = NOW + 2  # changed again after the look
    assert store.needs_reanalysis(it)
    closed = _item(2, pr=_url(9), handoff={"pr_state": {"state": "closed", "at": NOW}})
    assert store.needs_reanalysis(closed)
    for state in ("open", "draft", "unknown"):
        assert not store.needs_reanalysis(_item(3, pr=_url(9), handoff={"pr_state": {"state": state, "at": NOW}}))
    assert not store.needs_reanalysis(_item(4, pr=_url(412), handoff=_merged(), status="resolved"))


def test_reanalyze_prompt_names_the_pr_state() -> None:
    rows = [
        _item(1, pr=_url(412), handoff=_merged()),
        _item(2, pr=_url(5), handoff={"pr_state": {"state": "open", "at": NOW}}),
        _item(3, pr=_url(6), handoff={"pr_state": {"state": "closed", "at": NOW}}),
        _item(4),
    ]
    text = crew_runtime.reanalyze_prompt(rows)
    assert f"PR {_url(412)} · merged 2026-09-30" in text
    assert f"PR {_url(5)} · open" in text and f"PR {_url(6)} · closed, not merged" in text
    assert "PR none yet" in text
    assert crew_runtime.REANALYZE_PR_RULE in text and "possibly_resolved" in text
    brief = (ROOT / "backend" / "crew_brief.md").read_text(encoding="utf-8")
    assert "closed-unmerged" in brief and "merged PR means the fix landed" in brief


def test_send_reanalyze_marks_the_pr_state_seen(env, routes) -> None:
    state, _handler, data = env
    it = _item(1, pr=_url(412), handoff=_merged(at=1_000_000_000.0))
    _seed(data, it)
    req = _Req({"keys": [it["key"]]}, app="slack-radar")
    req.app = {"state": state}
    resp = asyncio.run(_route(routes, "POST", "/items/reanalyze")(req, _ctx(data)))
    assert resp.status == 200
    [prompt] = _slot(state).prompts
    assert f"PR {_url(412)} · merged 2026-09-30" in prompt
    h = store.read_ledger(data)["items"][it["key"]]["fix_handoff"]
    assert h["pr_state_seen_at"] > 1_000_000_000.0 and not store.needs_reanalysis(store.read_ledger(data)["items"][it["key"]])


# ── /needs ─────────────────────────────────────────────────────────────────


def test_merged_fix_moves_to_decide_and_leaves_fixes() -> None:
    merged = _item(1, pr=_url(412), handoff=_merged())
    open_ = _item(2, pr=_url(13), handoff={"pr_state": {"state": "open", "at": NOW}})
    led = {"items": {r["key"]: r for r in (merged, open_)}}
    out = needs.build_needs(led, NOW)
    decide = {e["key"]: e for e in next(g for g in out["groups"] if g["id"] == "decide")["entries"]}
    assert set(decide) == {merged["key"]}
    row = decide[merged["key"]]
    assert row["reason"] == "Fix merged · PR #412" and row["needs_reanalysis"] is True
    assert row["dispatch"]["pr_state"] == {"state": "merged", "at": NOW, "merged_at": "2026-09-30T10:00:00Z"}
    assert [f["key"] for f in out["fixes"]] == [open_["key"]] and out["fixes_total"] == 1
    assert out["fixes"][0]["dispatch"]["pr_state"]["state"] == "open"
    assert out["reanalyze"]["keys"] == [merged["key"]] and out["reanalyze"]["total"] == 1


# ── the record tool ────────────────────────────────────────────────────────


VALID_HANDOFF = {"title": "Fix it", "repo": "acme/app", "links": ["https://github.com/acme/app/issues/1"]}


@pytest.mark.parametrize("extra", [{"pr_state": {"state": "merged"}}, {"pr_state_seen_at": 1.0}])
def test_record_tool_cannot_write_pr_state(extra: dict) -> None:
    it = _item(1, pr=_url(412), handoff=_merged())
    led = {"items": {it["key"]: it}, "crew_memory": store.empty_ledger()["crew_memory"]}
    out = store.apply_crew_record(led, {"items": [{"key": it["key"], "fix_handoff": {**VALID_HANDOFF, **extra}}]})
    assert out["refused"] and "set by the app" in out["refused"][0]["why"]
    assert it["fix_handoff"]["pr_state"]["state"] == "merged" and "pr_state_seen_at" not in it["fix_handoff"]


def test_handoff_rewrite_keeps_the_pr_state() -> None:
    it = _item(1, pr=_url(412), handoff=_merged(pr_state_seen_at=NOW + 5))
    led = {"items": {it["key"]: it}, "crew_memory": store.empty_ledger()["crew_memory"]}
    prompt = f"{it['key']} {VALID_HANDOFF['links'][0]} coverage: full. {store.HANDOFF_NO_MERGE}"
    out = store.apply_crew_record(led, {"items": [{"key": it["key"], "fix_handoff": {**VALID_HANDOFF, "prompt": prompt}}]})
    assert not out["refused"]
    h = it["fix_handoff"]
    assert h["prompt"] == prompt and h["pr_state"]["state"] == "merged" and h["pr_state_seen_at"] == NOW + 5


def test_a_new_dispatch_forgets_the_old_pr_state() -> None:
    it = _item(1, pr=_url(412), handoff=_merged(pr_state_seen_at=NOW))
    led = {"items": {it["key"]: it}}
    store.apply_dispatch(led, it["key"], {"session_key": "chat-9-9", "title": "again", "agent": "a", "at": NOW})
    assert "pr_state" not in it["fix_handoff"] and "pr_state_seen_at" not in it["fix_handoff"]


def test_merge_flags_possibly_resolved_for_the_watcher(tmp_path: Path) -> None:
    fresh = _item(1, pr=_url(412))
    flagged = _item(2, pr=_url(413), possibly_resolved={"reason": "poster reacted :white_check_mark:", "at": NOW - 9})
    _seed(tmp_path, fresh, flagged)
    _refresh(tmp_path, FakeGh({_url(412): {"state": "MERGED"}, _url(413): {"state": "MERGED"}}))
    items = store.read_ledger(tmp_path)["items"]
    assert items[fresh["key"]]["possibly_resolved"] == {"reason": "fix PR #412 merged", "at": NOW}
    assert items[flagged["key"]]["possibly_resolved"]["reason"] == "poster reacted :white_check_mark:"
    assert items[fresh["key"]]["status"] == "triaged"  # a flag, never a verdict
    assert {it["key"] for it in crew_runtime.flagged_for_watcher(store.read_ledger(tmp_path))} == {fresh["key"], flagged["key"]}
