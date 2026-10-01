import unittest
from datetime import date, timedelta

from pydantic import ValidationError

from backend.maintenance_assignments import (
    AssignmentCreateRequest, AssignmentError, AssignmentStatusRequest, AssignmentStore,
)


BRIDGES = [{"id": 2, "name": "Test bridge"}]
USERS = [
    {"id": 1, "name": "Admin", "email": "admin@example.test", "role": "admin"},
    {"id": 2, "name": "Engineer", "email": "engineer@example.test", "role": "engineer"},
    {"id": 3, "name": "Other engineer", "email": "other@example.test", "role": "engineer"},
    {"id": 4, "name": "Viewer", "email": "viewer@example.test", "role": "viewer"},
]


class AssignmentStoreTests(unittest.TestCase):
    def setUp(self):
        self.store = AssignmentStore()
        self.today = date(2026, 10, 1)
        self.payload = {
            "bridge_id": 2, "assigned_to_id": 2,
            "priority": "MEDIUM", "task_type": "ROUTINE_INSPECTION",
            "description": "Check expansion joint", "due_date": self.today + timedelta(days=7),
        }

    def create(self, payload=None, user=None):
        return self.store.create(payload or self.payload, user or USERS[0], BRIDGES, USERS, self.today)

    def assert_rejected(self, status, call):
        with self.assertRaises(AssignmentError) as caught:
            call()
        self.assertEqual(caught.exception.status_code, status)

    def test_create_and_refresh_counts_are_consistent(self):
        created = self.create()
        self.assertEqual(created["bridge_name"], "Test bridge")
        self.assertEqual(created["assigned_to_id"], 2)
        self.assertEqual(created["status"], "PENDING")
        first_read = self.store.list_for(USERS[0])
        second_read = self.store.list_for(USERS[0])  # New read, as after a page refresh.
        self.assertEqual(first_read, second_read)
        self.assertEqual(len(second_read), 1)
        self.assertEqual(sum(item["status"] == "PENDING" for item in second_read), 1)
        self.store.update_status(created["id"], "IN_PROGRESS", None, USERS[1])
        refreshed = self.store.list_for(USERS[0])
        self.assertEqual(sum(item["status"] == "PENDING" for item in refreshed), 0)
        self.assertEqual(sum(item["status"] == "IN_PROGRESS" for item in refreshed), 1)
        self.assertEqual(len(refreshed), 1)

    def test_required_fields_and_catalog_values(self):
        for field, invalid in (
            ("bridge_id", 999), ("assigned_to_id", 4), ("assigned_to_id", 999),
            ("priority", "UNKNOWN"), ("task_type", "UNKNOWN"),
            ("description", "  "), ("due_date", "not-a-date"),
            ("due_date", self.today - timedelta(days=1)),
        ):
            with self.subTest(field=field, invalid=invalid):
                self.assert_rejected(422, lambda: self.create({**self.payload, field: invalid}))
        self.assertEqual(self.store.list_for(USERS[0]), [])

    def test_request_schema_rejects_missing_and_invalid_values(self):
        valid = {**self.payload, "due_date": self.payload["due_date"].isoformat()}
        for field in valid:
            with self.subTest(missing=field), self.assertRaises(ValidationError):
                AssignmentCreateRequest.model_validate({key: value for key, value in valid.items() if key != field})
        for field, invalid in (("priority", "NORMAL"), ("task_type", "UNKNOWN"), ("due_date", "2026-02-31")):
            with self.subTest(field=field), self.assertRaises(ValidationError):
                AssignmentCreateRequest.model_validate({**valid, field: invalid})
        with self.assertRaises(ValidationError):
            AssignmentStatusRequest.model_validate({"status": "UNKNOWN"})

    def test_roles_and_supported_transitions(self):
        for user in (USERS[1], USERS[3]):
            self.assert_rejected(403, lambda: self.create(user=user))
        created = self.create()
        assignment_id = created["id"]
        self.assertEqual(len(self.store.list_for(USERS[3])), 1)
        self.assertEqual(len(self.store.list_for(USERS[1])), 1)
        self.assertEqual(len(self.store.list_for(USERS[2])), 0)
        self.assert_rejected(403, lambda: self.store.update_status(assignment_id, "IN_PROGRESS", None, USERS[3]))
        self.assert_rejected(403, lambda: self.store.update_status(assignment_id, "IN_PROGRESS", None, USERS[2]))
        self.assert_rejected(409, lambda: self.store.update_status(assignment_id, "COMPLETED", None, USERS[0]))
        self.assert_rejected(403, lambda: self.store.update_status(assignment_id, "CANCELLED", None, USERS[1]))
        self.store.update_status(assignment_id, "IN_PROGRESS", None, USERS[1])
        self.store.update_status(assignment_id, "COMPLETED", "Verified on site", USERS[1])
        self.assert_rejected(409, lambda: self.store.update_status(assignment_id, "PENDING", None, USERS[0]))
        self.assert_rejected(403, lambda: self.store.delete(assignment_id, USERS[3]))
        self.store.delete(assignment_id, USERS[0])
        self.assertEqual(self.store.list_for(USERS[0]), [])

    def test_admin_can_cancel_pending_or_in_progress_only(self):
        first = self.create()
        second = self.create()
        self.store.update_status(first["id"], "CANCELLED", None, USERS[0])
        self.store.update_status(second["id"], "IN_PROGRESS", None, USERS[1])
        self.store.update_status(second["id"], "CANCELLED", None, USERS[0])
        self.assert_rejected(409, lambda: self.store.update_status(first["id"], "IN_PROGRESS", None, USERS[0]))
        self.assertEqual(sum(item["status"] == "CANCELLED" for item in self.store.list_for(USERS[0])), 2)


if __name__ == "__main__":
    unittest.main()
