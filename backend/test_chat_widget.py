import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from backend import main
from backend import chat as chat_service


ADMIN = {"id": 1, "name": "Fixture admin", "email": "admin@example.test", "role": "admin"}
VIEWER = {"id": 2, "name": "Fixture viewer", "email": "viewer@example.test", "role": "viewer"}
BRIDGE = {"id": 4, "name": "Fixture bridge"}


class FakeProvider:
    def __init__(self, status_code=200):
        self.posts = []
        self.status_code = status_code

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def post(self, url, json):
        self.posts.append((url, json))
        return SimpleNamespace(status_code=self.status_code, json=lambda: {"ok": self.status_code == 200})


class ChatWidgetRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        self.provider = FakeProvider()
        main.app.dependency_overrides[main.get_current_user] = lambda: ADMIN
        main._chat_dispatch_sent.clear()
        main._chat_dispatch_inflight.clear()

    def tearDown(self):
        main.app.dependency_overrides.clear()
        self.client.close()

    def test_critical_alert_names_sensor_trigger_not_normal_vibration(self):
        readings = {"health_score": 85, "vibration": 0.2, "strain": 185, "crack_gap": 0.6897, "water_level": 2.0}
        with patch.object(main, "_INDIA_BRIDGES", [BRIDGE]), patch.object(main, "_simulators", {4: SimpleNamespace(latest_data=readings)}):
            response = self.client.get("/api/chat/critical-alerts")
        self.assertEqual(response.status_code, 200)
        alert = response.json()["critical_bridges"][0]
        self.assertEqual(alert["bridge_name"], "Fixture bridge")
        self.assertEqual([item["sensor"] for item in alert["breaches"]], ["strain", "crack_gap"])
        self.assertNotIn("Vibration", " ".join(alert["triggers"]))
        self.assertEqual(response.json()["evaluation_errors"], 0)

    def test_alert_evaluation_failure_is_not_silently_healthy(self):
        broken = SimpleNamespace(latest_data=None, tick=lambda: (_ for _ in ()).throw(RuntimeError("fixture failure")))
        with patch.object(main, "_INDIA_BRIDGES", [BRIDGE]), patch.object(main, "_simulators", {4: broken}), patch.object(main.logger, "exception"):
            response = self.client.get("/api/chat/critical-alerts")
        self.assertEqual(response.status_code, 503)

    def test_old_bundled_action_is_disabled_and_viewer_cannot_use_it(self):
        with patch.object(main, "add_audit_entry"):
            main.app.dependency_overrides[main.get_current_user] = lambda: VIEWER
            self.assertEqual(self.client.post("/api/chat/autonomous-action", json={"confirmed": True}).status_code, 403)
            main.app.dependency_overrides[main.get_current_user] = lambda: ADMIN
            self.assertEqual(self.client.post("/api/chat/autonomous-action", json={"confirmed": True}).status_code, 410)

    def test_dispatch_requires_admin_review_and_is_idempotent_without_real_send(self):
        payload = {"bridge_id": 4, "recipient": "Fixture operations channel", "message": "Review Fixture bridge readings.", "confirmed": True, "request_id": "fixture-request-id-0000000001"}
        with patch.dict(os.environ, {"TELEGRAM_BOT_TOKEN": "fixture-token", "TELEGRAM_CHAT_ID": "fixture-chat", "TELEGRAM_RECIPIENT_NAME": "Fixture operations channel"}), patch.object(main, "_INDIA_BRIDGES", [BRIDGE]), patch.object(main, "add_audit_entry") as audit, patch("httpx.AsyncClient", return_value=self.provider):
            preview = self.client.get("/api/chat/dispatch-preview")
            self.assertEqual(preview.json(), {"available": True, "recipient": "Fixture operations channel"})
            self.assertEqual(self.client.post("/api/chat/dispatch", json={**payload, "confirmed": False}).status_code, 422)
            self.assertEqual(self.client.post("/api/chat/dispatch", json={**payload, "recipient": "Wrong channel"}).status_code, 422)
            self.assertEqual(self.client.post("/api/chat/dispatch", json=payload).json()["status"], "sent")
            self.assertEqual(self.client.post("/api/chat/dispatch", json=payload).json()["status"], "already_sent")
            self.assertEqual(len(self.provider.posts), 1)
            audit.assert_called_once()
            main.app.dependency_overrides[main.get_current_user] = lambda: VIEWER
            with patch.object(main, "add_audit_entry"):
                self.assertEqual(self.client.post("/api/chat/dispatch", json=payload).status_code, 403)

    def test_photo_uses_corrected_service_and_preserves_unavailable_state(self):
        base = {"recommended_action": "Arrange an inspection.", "error_category": None, "error_message": None}
        cases = [
            ({"analysis_status": "available", "crack_detected": True, "visual_severity": "moderate"}, "Possible crack identified"),
            ({"analysis_status": "available", "crack_detected": False, "visual_severity": None}, "No crack identified"),
            ({"analysis_status": "unavailable", "crack_detected": None, "error_message": "Provider unavailable"}, "Visual analysis unavailable"),
        ]
        for fields, expected in cases:
            with self.subTest(expected=expected), patch.object(main, "_INDIA_BRIDGES", [BRIDGE]), patch.object(main, "analyze_crack_image", return_value={**base, **fields}) as analyze:
                response = self.client.post("/api/chat/vision", data={"bridge_id": "4", "message": "Check cracks"}, files={"image": ("bridge.png", b"fixture image", "image/png")})
                self.assertEqual(response.status_code, 200)
                self.assertIn(expected, response.json()["reply"])
                self.assertIn("Physical width and length are unavailable", response.json()["reply"])
                analyze.assert_called_once()
        with patch.object(main, "add_audit_entry"):
            main.app.dependency_overrides[main.get_current_user] = lambda: VIEWER
            response = self.client.post("/api/chat/vision", data={"bridge_id": "4", "message": "Check"}, files={"image": ("bridge.png", b"fixture image", "image/png")})
            self.assertEqual(response.status_code, 403)

    def test_dispatch_provider_failure_is_reported_without_success_claim(self):
        payload = {"bridge_id": 4, "recipient": "Fixture operations channel", "message": "Review readings.", "confirmed": True, "request_id": "fixture-request-id-0000000002"}
        provider = FakeProvider(status_code=503)
        with patch.dict(os.environ, {"TELEGRAM_BOT_TOKEN": "fixture-token", "TELEGRAM_CHAT_ID": "fixture-chat", "TELEGRAM_RECIPIENT_NAME": "Fixture operations channel"}), patch.object(main, "_INDIA_BRIDGES", [BRIDGE]), patch.object(main, "add_audit_entry") as audit, patch("httpx.AsyncClient", return_value=provider):
            response = self.client.post("/api/chat/dispatch", json=payload)
            self.assertEqual(response.status_code, 502)
            self.assertIn("did not confirm", response.json()["detail"])
            self.assertNotIn(payload["message"], response.text)
            audit.assert_not_called()

    def test_chat_without_provider_uses_honest_fallback_and_no_live_fetch(self):
        context = {"live": {"health_score": 90, "vibration": 0.2, "strain": 100, "crack_gap": 0.1, "water_level": 1.0}}
        with patch.object(chat_service, "_fetch_bridge_context", new=AsyncMock(return_value=context)), patch.object(chat_service, "_use_local_model", False), patch.dict(os.environ, {"GROQ_API_KEY": ""}):
            response = self.client.post("/api/chat", json={"bridge_id": 4, "message": "How is this bridge?", "history": []})
        self.assertEqual(response.status_code, 200)
        self.assertIn("No answer was generated", response.json()["reply"])
        self.assertNotIn("Critical", response.json()["reply"])
        with patch.object(chat_service, "_fetch_bridge_context", new=AsyncMock()) as fetch_context:
            missing = self.client.post("/api/chat", json={"bridge_id": 99999, "message": "Which bridge?", "history": []})
            self.assertEqual(missing.status_code, 404)
            fetch_context.assert_not_called()

    def test_chat_provider_receives_shared_condition_context(self):
        context = {"live": {"health_score": 85, "vibration": 0.2, "crack_gap": 0.6897}}
        completion = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="**Crack gap requires inspection.**"))])
        with patch.object(chat_service, "_fetch_bridge_context", new=AsyncMock(return_value=context)), patch.object(chat_service, "_use_local_model", False), patch.dict(os.environ, {"GROQ_API_KEY": "fixture-key"}), patch.object(chat_service, "Groq") as provider:
            provider.return_value.chat.completions.create.return_value = completion
            response = self.client.post("/api/chat", json={"bridge_id": 4, "message": "Why Critical?", "history": []})
            self.assertEqual(response.status_code, 200)
            self.assertIn("Crack gap", response.json()["reply"])
            sent = provider.return_value.chat.completions.create.call_args.kwargs["messages"]
            self.assertIn("project sensor thresholds", sent[0]["content"])
            self.assertIn('"condition": "Critical"', sent[-1]["content"])
            self.assertIn('"unit": "mm"', sent[-1]["content"])


if __name__ == "__main__":
    unittest.main()
