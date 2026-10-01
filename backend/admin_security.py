"""Pure admin identity, authorization, and metric calculations."""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import json
import os


PDF_EXPORT_ACTIONS = {"EXPORT_REPORT", "EXPORT_AGENT_REPORT", "EXPORT_CHAT_REPORT"}


class AdminError(ValueError):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def role_allowed(user, allowed_roles):
    return user.get("role") in allowed_roles


def canonicalize_seed_users(seed_users):
    """Merge only identical seed identities; preserve their login aliases and IDs."""
    users, by_email, id_aliases, password_aliases, conflicts = [], {}, {}, {}, []
    for original in seed_users:
        user = original.copy()
        key = user["email"].strip().lower()
        previous = by_email.get(key)
        if previous is None:
            users.append(user)
            by_email[key] = user
            password_aliases[user["id"]] = {user["password"]}
        elif all(previous.get(field) == user.get(field) for field in ("name", "role", "org")):
            id_aliases[user["id"]] = previous["id"]
            password_aliases[previous["id"]].add(user["password"])
        else:
            # A conflict needs explicit review; never silently merge distinct identities.
            users.append(user)
            password_aliases[user["id"]] = {user["password"]}
            conflicts.append(key)
    return users, id_aliases, password_aliases, conflicts


def session_user_id(record, id_aliases):
    user_id = record.get("user_id") if isinstance(record, dict) else record
    return id_aliases.get(user_id, user_id)


def active_session_count(sessions, users, id_aliases, now=None):
    """Count unexpired session tokens, or report unknown for undated legacy records."""
    now = now or datetime.now(timezone.utc)
    known_user_ids = {user["id"] for user in users}
    count = 0
    for record in sessions.values():
        if session_user_id(record, id_aliases) not in known_user_ids:
            continue
        if not isinstance(record, dict) or not record.get("expires_at"):
            return None
        try:
            expires = datetime.fromisoformat(record["expires_at"].replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return None
        if expires.tzinfo is None:
            return None
        if expires > now:
            count += 1
    return count


def actual_events(events):
    return [event for event in events if event.get("source") == "actual"]


def last_login_by_user(events):
    latest = {}
    for event in actual_events(events):
        if event.get("action") != "LOGIN" or event.get("status") != "SUCCESS":
            continue
        user_id = event.get("user_id")
        timestamp = event.get("timestamp")
        if user_id is not None and timestamp and timestamp > latest.get(user_id, ""):
            latest[user_id] = timestamp
    return latest


def successful_pdf_exports(events):
    return sum(
        event.get("action") in PDF_EXPORT_ACTIONS and event.get("status") == "SUCCESS"
        for event in actual_events(events)
    )


def alerts_today(events, *, complete, now=None):
    """Count recorded alert events on the current Asia/Kolkata day, if complete."""
    if not complete:
        return None
    today = (now or datetime.now(timezone.utc)).astimezone(ZoneInfo("Asia/Kolkata")).date()
    count = 0
    for event in actual_events(events):
        if event.get("action") != "ALERT_TRIGGERED" or event.get("status") != "SUCCESS":
            continue
        try:
            timestamp = datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00"))
        except (KeyError, AttributeError, ValueError):
            return None
        if timestamp.tzinfo is None:
            return None
        if timestamp.astimezone(ZoneInfo("Asia/Kolkata")).date() == today:
            count += 1
    return count


def plan_revoke(users, sessions, actor, target_id, id_aliases):
    """Check the exact account and sessions to revoke without mutating them."""
    if actor["role"] != "admin":
        raise AdminError(403, "Admin access required")
    target = next((user for user in users if user["id"] == target_id), None)
    if target is None:
        raise AdminError(404, "User not found")
    if target["id"] == actor["id"]:
        raise AdminError(409, "You cannot revoke your own account")
    if target["role"] == "admin" and sum(user["role"] == "admin" for user in users) <= 1:
        raise AdminError(409, "The last admin account cannot be revoked")
    tokens = [
        token for token, record in sessions.items()
        if session_user_id(record, id_aliases) == target_id
    ]
    return target, tokens


def apply_revoke(users, sessions, target, tokens):
    """Remove exactly one account and the sessions identified by plan_revoke."""
    users.remove(target)
    for token in tokens:
        sessions.pop(token, None)
    return len(tokens)


def load_revoked_ids(path):
    if not os.path.exists(path):
        return set()
    try:
        with open(path, "r", encoding="utf-8") as file:
            return {int(value) for value in json.load(file)}
    except (OSError, ValueError, TypeError) as exc:
        raise RuntimeError("Revoked user record could not be read; refusing to restore accounts") from exc


def save_revoked_ids(path, ids):
    temporary_path = path + ".tmp"
    with open(temporary_path, "w", encoding="utf-8") as file:
        json.dump(sorted(ids), file)
    os.replace(temporary_path, path)
