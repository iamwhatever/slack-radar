"""Thread replies kept on items (LOCAL, poller-owned) and the stricter resolved rule."""

from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from backend import store, watch  # noqa: E402
from test_slack_radar import C1, FakeMcp, settings, ts  # noqa: E402

POSTER = "U1"


def _item_with_thread(tmp_path: Path, replies: list[dict], parent_extra: dict | None = None) -> tuple[str, dict]:
    """Ingest one parent, then re-check its thread once with ``replies``. Returns (key, summary)."""
    now = time.time()
    fake = FakeMcp()
    parent_ts = ts(now - 5000)
    fake.history_msgs[C1] = [{"ts": parent_ts, "user": POSTER, "text": "how do I enable sso?"}]
    watch.run_cycle(tmp_path, fake, settings(channels=[C1]))
    key = store.item_key(C1, parent_ts)
    store.mutate(tmp_path, lambda led: led["items"][key].update(last_thread_check_at=0.0))
    parent = {"ts": parent_ts, "user": POSTER, "text": "how do I enable sso?", **(parent_extra or {})}
    fake.threads[(C1, parent_ts)] = [parent, *replies]
    return key, watch.run_cycle(tmp_path, fake, settings(channels=[C1]))


def _reply(n: int, user: str, text: str) -> dict:
    return {"ts": ts(time.time() - 100 + n), "user": user, "text": text}


# ── storage + bound ────────────────────────────────────────────────────────


def test_recheck_keeps_the_newest_five_replies_clipped(tmp_path: Path) -> None:
    replies = [_reply(i, "U2", f"reply {i} " + "x" * 600) for i in range(8)]
    key, _ = _item_with_thread(tmp_path, replies)
    kept = store.read_ledger(tmp_path)["items"][key]["replies"]
    assert [r["text"].split()[1] for r in kept] == ["3", "4", "5", "6", "7"]
    assert all(len(r["text"]) <= store.MAX_REPLY_TEXT for r in kept)
    assert set(kept[0]) == {"ts", "user", "text"} and kept[0]["user"] == "U2"


def test_reply_text_is_redacted(tmp_path: Path) -> None:
    key, _ = _item_with_thread(tmp_path, [_reply(0, "U2", "use token xoxb-1234567890-abcdef please")])
    assert "xoxb" not in store.read_ledger(tmp_path)["items"][key]["replies"][0]["text"]


def test_new_item_starts_with_no_replies(tmp_path: Path) -> None:
    item = store.normalize_message(C1, {"ts": ts(time.time()), "user": POSTER, "text": "hi"})
    assert item is not None and item["replies"] == []


@pytest.mark.parametrize("status", ["resolved", "noise"])
def test_replies_dropped_when_item_closes(tmp_path: Path, status: str) -> None:
    key, _ = _item_with_thread(tmp_path, [_reply(0, "U2", "try the admin page")])
    assert store.read_ledger(tmp_path)["items"][key]["replies"]
    store.mutate(tmp_path, lambda led: store.apply_crew_record(led, {"items": [{"key": key, "status": status}]}))
    assert store.read_ledger(tmp_path)["items"][key]["replies"] == []


def test_replies_dropped_past_seven_days(tmp_path: Path) -> None:
    key, _ = _item_with_thread(tmp_path, [_reply(0, "U2", "try the admin page")])
    old = time.time() - (store.REPLIES_MAX_AGE_DAYS + 1) * 86400
    store.mutate(tmp_path, lambda led: led["items"][key].update(ts_float=old))
    assert store.read_ledger(tmp_path)["items"][key]["replies"] == []


def test_record_tool_cannot_set_replies(tmp_path: Path) -> None:
    key, _ = _item_with_thread(tmp_path, [_reply(0, "U2", "try the admin page")])
    before = store.read_ledger(tmp_path)["items"][key]["replies"]
    store.mutate(tmp_path, lambda led: store.apply_crew_record(
        led, {"items": [{"key": key, "replies": [{"ts": "1.0", "user": "X", "text": "forged"}], "note": "n"}]}))
    after = store.read_ledger(tmp_path)["items"][key]
    assert after["replies"] == before and after["note"] == "n"


# ── pass-through ───────────────────────────────────────────────────────────


def test_pending_view_thread_updates_carry_replies(tmp_path: Path) -> None:
    key, summary = _item_with_thread(tmp_path, [_reply(0, "U2", "enable it under Admin > SSO")])
    assert summary["thread_changed"] == 1
    store.mutate(tmp_path, lambda led: led["items"][key].update(needs_triage=False))
    view = store.pending_view(store.read_ledger(tmp_path))
    (row,) = [r for r in view["thread_updates"] if r["key"] == key]
    assert row["replies"] == [{"ts": row["replies"][0]["ts"], "user": "U2", "text": "enable it under Admin > SSO"}]


def test_digest_never_carries_reply_text(tmp_path: Path) -> None:
    key, _ = _item_with_thread(tmp_path, [_reply(0, "U2", "REPLY-SECRET-TEXT fixed it")])
    store.mutate(tmp_path, lambda led: store.apply_crew_record(
        led, {"items": [{"key": key, "category": "question", "priority": "p2", "summary": "SSO how-to"}]}))
    text = watch.render_digest(store.read_ledger(tmp_path), "headline", [key])
    assert "REPLY-SECRET-TEXT" not in text and "SSO how-to" in text


# ── resolved rule ──────────────────────────────────────────────────────────


@pytest.mark.parametrize("text", ["thanks!", "thank you so much", "ty", "done", "ok thanks, done"])
def test_thank_you_alone_is_not_flagged(tmp_path: Path, text: str) -> None:
    key, summary = _item_with_thread(tmp_path, [_reply(0, "U2", text)])
    assert summary["possibly_resolved"] == 0
    assert store.read_ledger(tmp_path)["items"][key]["possibly_resolved"] is None


def test_fix_word_from_another_user_is_flagged(tmp_path: Path) -> None:
    key, summary = _item_with_thread(tmp_path, [_reply(0, "U2", "fixed in v0.8")])
    assert summary["possibly_resolved"] == 1
    item = store.read_ledger(tmp_path)["items"][key]
    assert "fixed" in item["possibly_resolved"]["reason"] and item["status"] == "new"


def test_fix_word_from_the_poster_is_not_flagged(tmp_path: Path) -> None:
    _, summary = _item_with_thread(tmp_path, [_reply(0, POSTER, "is this fixed yet?")])
    assert summary["possibly_resolved"] == 0


def test_negated_fix_word_is_not_flagged(tmp_path: Path) -> None:
    _, summary = _item_with_thread(tmp_path, [_reply(0, "U2", "it is still not fixed for me")])
    assert summary["possibly_resolved"] == 0


@pytest.mark.parametrize("users,flagged", [([POSTER], 1), (["U2"], 0), ([], 0)])
def test_check_reaction_counts_only_from_the_poster(tmp_path: Path, users: list[str], flagged: int) -> None:
    extra = {"reactions": [{"name": "white_check_mark", "users": users, "count": len(users)}]}
    _, summary = _item_with_thread(tmp_path, [], parent_extra=extra)
    assert summary["possibly_resolved"] == flagged


@pytest.mark.parametrize("text", ["merged, released in 1.4", "that did it", "works now", "solved by the new flag"])
def test_real_resolution_words(tmp_path: Path, text: str) -> None:
    _, summary = _item_with_thread(tmp_path, [_reply(0, "U2", text)])
    assert summary["possibly_resolved"] == 1
