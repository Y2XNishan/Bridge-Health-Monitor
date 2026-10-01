import os
import tempfile
import unittest
from datetime import datetime, timezone

from backend.admin_security import (
    AdminError, active_session_count, actual_events, alerts_today,
    apply_revoke, canonicalize_seed_users, last_login_by_user,
    load_revoked_ids, plan_revoke, role_allowed, save_revoked_ids,
    successful_pdf_exports,
)


class AdminSecurityTests(unittest.TestCase):
    def setUp(self):
        self.seed = [
            {"id": 1, "name": "Admin One", "email": "admin@example.test", "role": "admin", "org": "Office", "password": "first"},
            {"id": 5, "name": "Admin One", "email": "admin@example.test", "role": "admin", "org": "Office", "password": "alias"},
            {"id": 2, "name": "Engineer", "email": "engineer@example.test", "role": "engineer", "org": "Office", "password": "engineer"},
            {"id": 3, "name": "Viewer", "email": "viewer@example.test", "role": "viewer", "org": "Office", "password": "viewer"},
        ]

    def test_duplicate_seed_keeps_stable_id_and_login_alias(self):
        users, aliases, passwords, conflicts = canonicalize_seed_users(self.seed)
        self.assertEqual([user["id"] for user in users], [1, 2, 3])
        self.assertEqual(aliases, {5: 1})
        self.assertEqual(passwords[1], {"first", "alias"})
        self.assertEqual(conflicts, [])
        conflicting = {**self.seed[1], "role": "viewer"}
        users, _, _, conflicts = canonicalize_seed_users([self.seed[0], conflicting])
        self.assertEqual(len(users), 2)
        self.assertEqual(conflicts, ["admin@example.test"])

    def test_viewer_cannot_activate_or_manage_users(self):
        viewer = self.seed[3]
        self.assertFalse(role_allowed(viewer, ["admin", "engineer"]))
        self.assertFalse(role_allowed(viewer, ["admin"]))
        self.assertTrue(role_allowed(viewer, ["viewer", "engineer", "admin"]))

    def test_active_sessions_count_only_unexpired_tokens(self):
        users, aliases, _, _ = canonicalize_seed_users(self.seed)
        now = datetime(2026, 10, 1, 0, 0, tzinfo=timezone.utc)
        sessions = {
            "valid": {"user_id": 5, "expires_at": "2026-10-02T00:00:00+00:00"},
            "expired": {"user_id": 2, "expires_at": "2026-09-30T00:00:00+00:00"},
        }
        self.assertEqual(active_session_count(sessions, users, aliases, now), 1)
        sessions["legacy"] = 3
        self.assertIsNone(active_session_count(sessions, users, aliases, now))

    def test_only_actual_events_drive_login_pdf_and_today_alerts(self):
        events = [
            {"source": "simulated", "action": "ACTIVATE_BRIDGE", "status": "SUCCESS", "user_role": "viewer", "timestamp": "2026-09-30T19:00:00+00:00"},
            {"source": "actual", "action": "LOGIN", "status": "SUCCESS", "user_id": 1, "timestamp": "2026-09-30T19:01:00+00:00"},
            {"source": "actual", "action": "LOGIN", "status": "SUCCESS", "user_id": 1, "timestamp": "2026-09-30T19:05:00+00:00"},
            {"source": "actual", "action": "EXPORT_REPORT", "status": "SUCCESS", "timestamp": "2026-09-30T19:02:00+00:00"},
            {"source": "actual", "action": "EXPORT_AGENT_REPORT", "status": "SUCCESS", "timestamp": "2026-09-30T19:03:00+00:00"},
            {"source": "actual", "action": "EXPORT_CHAT_REPORT", "status": "FAILED", "timestamp": "2026-09-30T19:04:00+00:00"},
            {"source": "actual", "action": "EXPORT_CHAT_REPORT", "status": "SUCCESS", "timestamp": "2026-09-30T19:06:00+00:00"},
            {"source": "actual", "action": "ALERT_TRIGGERED", "status": "SUCCESS", "timestamp": "2026-09-30T18:00:00+00:00"},
            {"source": "actual", "action": "ALERT_TRIGGERED", "status": "SUCCESS", "timestamp": "2026-09-30T19:00:00+00:00"},
        ]
        self.assertEqual(len(actual_events(events)), 8)
        self.assertEqual(last_login_by_user(events)[1], "2026-09-30T19:05:00+00:00")
        self.assertEqual(successful_pdf_exports(events), 3)
        now = datetime(2026, 9, 30, 20, 0, tzinfo=timezone.utc)
        self.assertEqual(alerts_today(events, complete=True, now=now), 1)
        self.assertIsNone(alerts_today(events, complete=False, now=now))

    def test_revoke_scope_guards_and_persistence(self):
        users, aliases, _, _ = canonicalize_seed_users(self.seed)
        sessions = {"admin": {"user_id": 5}, "engineer": {"user_id": 2}, "viewer": {"user_id": 3}}
        with self.assertRaises(AdminError) as caught:
            plan_revoke(users, sessions, users[0], 1, aliases)
        self.assertEqual(caught.exception.status_code, 409)
        with self.assertRaises(AdminError) as caught:
            plan_revoke(users, sessions, users[2], 2, aliases)
        self.assertEqual(caught.exception.status_code, 403)
        target, tokens = plan_revoke(users, sessions, users[0], 2, aliases)
        self.assertEqual(tokens, ["engineer"])
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "revoked.json")
            save_revoked_ids(path, {2})
            self.assertEqual(load_revoked_ids(path), {2})
            self.assertEqual(apply_revoke(users, sessions, target, tokens), 1)
            self.assertEqual([user["id"] for user in users], [1, 3])
            self.assertEqual(set(sessions), {"admin", "viewer"})
            with open(path, "w", encoding="utf-8") as file:
                file.write("invalid")
            with self.assertRaises(RuntimeError):
                load_revoked_ids(path)
        with self.assertRaises(AdminError) as caught:
            plan_revoke(users, sessions, {"id": 9, "role": "admin"}, 1, aliases)
        self.assertEqual(caught.exception.status_code, 409)
        second_admin = {"id": 9, "name": "Admin Two", "email": "other-admin@example.test", "role": "admin"}
        target, tokens = plan_revoke([*users, second_admin], sessions, second_admin, 1, aliases)
        self.assertEqual(target["id"], 1)
        self.assertEqual(tokens, ["admin"])  # Legacy duplicate ID 5 resolves to canonical ID 1.


if __name__ == "__main__":
    unittest.main()
