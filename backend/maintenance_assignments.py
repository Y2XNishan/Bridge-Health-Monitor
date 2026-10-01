"""Validated, in-process maintenance assignment state and transitions."""

from datetime import date, datetime, timezone
from threading import Lock
from typing import Literal

from pydantic import BaseModel


PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
TASK_TYPES = {
    "ROUTINE_INSPECTION", "CRACK_REPAIR", "SENSOR_REPLACEMENT",
    "STRUCTURAL_REPAIR", "EMERGENCY_RESPONSE", "LOAD_TESTING",
}
TRANSITIONS = {
    "PENDING": {"IN_PROGRESS", "CANCELLED"},
    "IN_PROGRESS": {"COMPLETED", "CANCELLED"},
    "COMPLETED": set(),
    "CANCELLED": set(),
}


class AssignmentCreateRequest(BaseModel):
    bridge_id: int
    assigned_to_id: int
    priority: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    task_type: Literal[
        "ROUTINE_INSPECTION", "CRACK_REPAIR", "SENSOR_REPLACEMENT",
        "STRUCTURAL_REPAIR", "EMERGENCY_RESPONSE", "LOAD_TESTING",
    ]
    description: str
    due_date: date


class AssignmentStatusRequest(BaseModel):
    status: Literal["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]
    notes: str | None = None


class AssignmentError(ValueError):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class AssignmentStore:
    def __init__(self):
        self._items = []
        self._next_id = 1
        self._lock = Lock()

    def list_for(self, user):
        if user["role"] not in {"admin", "engineer", "viewer"}:
            raise AssignmentError(403, "Not authorized to view assignments")
        with self._lock:
            items = self._items if user["role"] != "engineer" else [
                item for item in self._items if item["assigned_to_email"] == user["email"]
            ]
            return [item.copy() for item in items]

    def create(self, payload, user, bridges, users, today: date):
        if user["role"] != "admin":
            raise AssignmentError(403, "Only an admin can create assignments")
        bridge = next((item for item in bridges if item["id"] == payload["bridge_id"]), None)
        if bridge is None:
            raise AssignmentError(422, "Select a valid bridge")
        assignee = next((item for item in users if item["id"] == payload["assigned_to_id"] and item["role"] == "engineer"), None)
        if assignee is None:
            raise AssignmentError(422, "Select a valid engineer")
        if payload["priority"] not in PRIORITIES:
            raise AssignmentError(422, "Select a valid priority")
        if payload["task_type"] not in TASK_TYPES:
            raise AssignmentError(422, "Select a valid task type")
        description = payload["description"].strip()
        if not description:
            raise AssignmentError(422, "Description is required")
        due_date = payload["due_date"]
        if not isinstance(due_date, date):
            raise AssignmentError(422, "Select a valid due date")
        if due_date < today:
            raise AssignmentError(422, "Due date cannot be in the past")

        now = datetime.now(timezone.utc).isoformat()
        with self._lock:
            assignment = {
                "id": self._next_id,
                "bridge_id": bridge["id"],
                "bridge_name": bridge["name"],
                "assigned_to_id": assignee["id"],
                "assigned_to_email": assignee["email"],
                "assigned_to_name": assignee["name"],
                "priority": payload["priority"],
                "task_type": payload["task_type"],
                "description": description,
                "status": "PENDING",
                "created_at": now,
                "updated_at": now,
                "due_date": due_date.isoformat(),
                "created_by": user["email"],
            }
            self._items.append(assignment)
            self._next_id += 1
            return assignment.copy()

    def update_status(self, assignment_id, next_status, notes, user):
        if user["role"] not in {"admin", "engineer"}:
            raise AssignmentError(403, "Not authorized to change assignments")
        with self._lock:
            assignment = next((item for item in self._items if item["id"] == assignment_id), None)
            if assignment is None:
                raise AssignmentError(404, "Assignment not found")
            if user["role"] == "engineer" and assignment["assigned_to_email"] != user["email"]:
                raise AssignmentError(403, "Not your assignment")
            if next_status not in TRANSITIONS[assignment["status"]]:
                from_label = assignment["status"].replace("_", " ").lower()
                to_label = next_status.replace("_", " ").lower()
                raise AssignmentError(409, f"Cannot change {from_label} to {to_label}")
            if user["role"] == "engineer" and next_status == "CANCELLED":
                raise AssignmentError(403, "Only an admin can cancel an assignment")
            assignment["status"] = next_status
            assignment["updated_at"] = datetime.now(timezone.utc).isoformat()
            if notes is not None:
                assignment["notes"] = notes.strip()
            return assignment.copy()

    def delete(self, assignment_id, user):
        if user["role"] != "admin":
            raise AssignmentError(403, "Only an admin can delete assignments")
        with self._lock:
            assignment = next((item for item in self._items if item["id"] == assignment_id), None)
            if assignment is None:
                raise AssignmentError(404, "Assignment not found")
            self._items.remove(assignment)
