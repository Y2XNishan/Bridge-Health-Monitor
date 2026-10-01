import unittest

from backend.chat_alerts import build_critical_alert
from backend.chat import SYSTEM_PROMPT, _clean_live_data


BRIDGE = {"id": 4, "name": "Fixture bridge"}


class ChatAlertTests(unittest.TestCase):
    def test_critical_crack_names_actual_trigger_and_all_breaches(self):
        alert = build_critical_alert(BRIDGE, {
            "health_score": 87, "vibration": 0.25, "strain": 185,
            "crack_gap": 0.6897, "water_level": 2.0,
        })
        self.assertEqual(alert["condition"], "Critical")
        self.assertEqual([item["sensor"] for item in alert["breaches"]], ["strain", "crack_gap"])
        self.assertIn("Crack gap", alert["triggers"][0])
        self.assertIn("mm", alert["triggers"][0])
        self.assertNotIn("Vibration", " ".join(alert["triggers"]))
        self.assertEqual(alert["breaches"][0]["status"], "Monitor")

    def test_score_trigger_without_sensor_breach(self):
        alert = build_critical_alert(BRIDGE, {
            "health_score": 40, "vibration": 0.2, "strain": 100,
            "crack_gap": 0.1, "water_level": 1.0,
        })
        self.assertEqual(alert["breaches"], [])
        self.assertIn("Health score 40.0/100", alert["triggers"][0])

    def test_healthy_and_monitor_do_not_create_critical_alert(self):
        readings = {"health_score": 90, "vibration": 0.2, "strain": 100, "crack_gap": 0.1, "water_level": 1.0}
        self.assertIsNone(build_critical_alert(BRIDGE, readings))
        self.assertIsNone(build_critical_alert(BRIDGE, {**readings, "strain": 180}))

    def test_critical_sensor_at_boundary_without_score(self):
        alert = build_critical_alert(BRIDGE, {"crack_gap": 0.30})
        self.assertEqual(alert["condition"], "Critical")
        self.assertEqual(alert["health_score"], None)
        self.assertEqual(alert["breaches"][0]["threshold"], 0.30)

    def test_chat_context_reuses_condition_and_breached_sensor_logic(self):
        clean = _clean_live_data({"health_score": 85, "vibration": 0.2, "crack_gap": 0.6897, "alert_level": "NORMAL"})
        self.assertEqual(clean["condition"], "Critical")
        self.assertEqual([item["sensor"] for item in clean["breached_sensors"]], ["crack_gap"])
        self.assertNotIn("alert_level", clean)
        self.assertIn("project sensor thresholds", SYSTEM_PROMPT)
        self.assertNotIn("IRC", SYSTEM_PROMPT)


if __name__ == "__main__":
    unittest.main()
