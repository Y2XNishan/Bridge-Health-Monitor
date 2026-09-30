"""Focused checks for predictive maintenance forecasts and schedules."""

from datetime import date, timedelta
import math
import unittest

from backend.agent import analyze_sensors
from backend.constants import SENSOR_THRESHOLDS, get_bridge_condition
from backend.survival import (
    HEALTH_BOUNDARIES,
    build_survival_overview,
    calculate_degradation_rate,
    predict_time_to_threshold,
    run_survival_analysis,
    simulate_repair,
)


class PredictiveMaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.inspection_date = date(2026, 9, 30)
        self.healthy = {
            "health_score": 85.0,
            "anomaly_score": 0.2,
            "risk_score": 0.3,
            "vibration": 0.2,
            "strain": 30.0,
            "crack_gap": 0.05,
            "water_level": 1.0,
        }
        self.critical = {
            **self.healthy,
            "health_score": 30.0,
            "vibration": SENSOR_THRESHOLDS["vibration"]["crit"] * 1.25,
            "crack_gap": SENSOR_THRESHOLDS["crack_gap"]["crit"],
        }

    def test_healthy_forecast_uses_shared_boundaries_and_factors(self):
        overview = build_survival_overview(1, "Healthy bridge", self.healthy, self.inspection_date)
        detail = run_survival_analysis(1, "Healthy bridge", self.healthy)
        self.assertEqual(overview["health_condition"], "Healthy")
        self.assertEqual(overview["urgency"], "LOW")
        self.assertEqual(get_bridge_condition(85, self.healthy), "Healthy")
        self.assertEqual(analyze_sensors(self.healthy)["severity"], "Healthy")
        self.assertTrue(all(item["condition"] == "Healthy" for item in detail["sensor_readings"]))
        self.assertEqual(detail["degradation_rate"], overview["degradation_rate"])
        self.assertEqual(detail["survival_predictions"], overview["survival_predictions"])
        self.assertEqual(overview["health_boundaries"], {"monitor": 60, "critical": 40, "failure": 20})
        self.assertNotEqual(HEALTH_BOUNDARIES["failure"], SENSOR_THRESHOLDS["vibration"]["crit"])

        factors = overview["degradation_breakdown"]
        expected_raw = factors["base_rate"] * (1 + 0.2 * 0.8) * (1 + 0.3 * 1.5)
        self.assertAlmostEqual(factors["raw_rate"], round(expected_raw, 3))
        self.assertEqual(overview["degradation_rate"], round(max(expected_raw, factors["minimum_rate"]), 3))
        self.assertEqual(
            overview["survival_predictions"]["days_to_failure"],
            math.ceil((85 - HEALTH_BOUNDARIES["failure"]) / overview["degradation_rate"]),
        )
        self.assertEqual(
            overview["forecast_dates"]["days_to_failure"],
            (self.inspection_date + timedelta(days=overview["survival_predictions"]["days_to_failure"])).isoformat(),
        )
        healthy_schedule = detail["maintenance_schedule"]
        self.assertEqual(set(healthy_schedule), {"immediate", "scheduled", "long_term"})
        self.assertTrue(all(isinstance(items, list) and items for items in healthy_schedule.values()))
        self.assertNotIn("IRC", " ".join(sum(healthy_schedule.values(), [])))
        healthy_repair = simulate_repair(85, overview["degradation_rate"], 0, 90, self.inspection_date)
        self.assertTrue(healthy_repair["scenario"]["available"])
        self.assertFalse(simulate_repair(85, overview["degradation_rate"], overview["survival_predictions"]["days_to_failure"] + 1, 90, self.inspection_date)["scenario"]["available"])

    def test_godavari_critical_crack_overrides_score_only_status(self):
        godavari = {**self.healthy, "crack_gap": 0.6897}
        overview = build_survival_overview(48, "Godavari Fourth Bridge", godavari, self.inspection_date)
        detail = run_survival_analysis(48, "Godavari Fourth Bridge", godavari)
        self.assertEqual(get_bridge_condition(85, godavari), "Critical")
        self.assertEqual(analyze_sensors(godavari)["severity"], "Critical")
        self.assertEqual(overview["health_condition"], "Critical")
        self.assertEqual(overview["urgency"], "CRITICAL")
        self.assertEqual(detail["health_condition"], overview["health_condition"])
        self.assertEqual(detail["urgency"], overview["urgency"])
        self.assertEqual(next(item for item in detail["sensor_readings"] if item["key"] == "crack_gap")["condition"], "Critical")
        self.assertGreater(overview["survival_predictions"]["days_to_critical"], 30)
        expected_rate = calculate_degradation_rate(
            85, 0.2, None, 48, risk_score=0.3,
            sensor_overload=0.6897 / SENSOR_THRESHOLDS["crack_gap"]["crit"],
        )["daily_degradation_rate"]
        self.assertEqual(overview["degradation_rate"], expected_rate)
        self.assertTrue(any("crack gap" in action for action in detail["maintenance_schedule"]["immediate"]))

    def test_critical_schedule_has_separate_action_arrays(self):
        detail = run_survival_analysis(2, "Critical bridge", self.critical)
        self.assertEqual(detail["health_condition"], "Critical")
        self.assertEqual(detail["urgency"], "CRITICAL")
        self.assertEqual(detail["survival_predictions"]["days_to_critical"], 0)
        self.assertEqual(detail["sensor_readings"][0]["condition"], "Critical")
        schedule = detail["maintenance_schedule"]
        self.assertEqual(set(schedule), {"immediate", "scheduled", "long_term"})
        self.assertTrue(all(isinstance(section, list) for section in schedule.values()))
        self.assertTrue(any("vibration" in item for item in schedule["immediate"]))
        self.assertTrue(any("structural assessment" in item for item in schedule["immediate"]))
        self.assertTrue(schedule["scheduled"])
        self.assertTrue(schedule["long_term"])
        text = " ".join(item for section in schedule.values() for item in section).lower()
        for unsupported in ("irc", "replace sensor", "guarantee", "cost saving", "emergency shoring"):
            self.assertNotIn(unsupported, text)
        self.assertTrue(all(not item.startswith(("Immediate", "Scheduled", "Long-term")) for item in schedule["immediate"]))

    def test_repair_today_and_later_use_same_failure_boundary(self):
        overview = build_survival_overview(2, "Critical bridge", self.critical, self.inspection_date)
        rate = overview["degradation_rate"]
        baseline = overview["survival_predictions"]["days_to_failure"]
        self.assertGreater(baseline, 2)
        for repair_day in (0, 2):
            result = simulate_repair(30, rate, repair_day, 65, self.inspection_date)
            scenario = result["scenario"]
            self.assertTrue(scenario["available"])
            self.assertEqual(result["failure_boundary"], HEALTH_BOUNDARIES["failure"])
            self.assertEqual(result["baseline_days"], baseline)
            self.assertEqual(scenario["days_after_repair"], predict_time_to_threshold(65, rate, 20))
            self.assertEqual(scenario["total_days_from_today"], repair_day + scenario["days_after_repair"])
            self.assertEqual(scenario["additional_days_gained"], scenario["total_days_from_today"] - baseline)
            self.assertEqual(scenario["repaired_failure_date"], (self.inspection_date + timedelta(days=scenario["total_days_from_today"])).isoformat())
            self.assertEqual(result["repair_date"], (self.inspection_date + timedelta(days=repair_day)).isoformat())
            self.assertEqual(next(row for row in result["comparison"] if row["repair_day"] == repair_day)["total_days_from_today"], scenario["total_days_from_today"])
            self.assertTrue(any(point["without_repair"] == 20 for point in result["chart_data"]))
            self.assertTrue(any(point["with_repair"] == 20 for point in result["chart_data"]))
            repair_points = [point for point in result["chart_data"] if point["day"] == repair_day]
            self.assertEqual(len(repair_points), 2)
            self.assertEqual(repair_points[0]["with_repair"], scenario["health_at_repair"])
            self.assertEqual(repair_points[1]["with_repair"], scenario["post_repair_health"])

    def test_repair_at_or_after_failure_is_unavailable(self):
        baseline = predict_time_to_threshold(30, 1.8, HEALTH_BOUNDARIES["failure"])
        for repair_day in (baseline, baseline + 1):
            result = simulate_repair(30, 1.8, repair_day, 65, self.inspection_date)
            self.assertFalse(result["scenario"]["available"])
            self.assertIn("failure boundary was reached", result["scenario"]["reason"])
            self.assertNotIn("total_days_from_today", result["scenario"])
            self.assertEqual(result["baseline_days"], baseline)
        missing = simulate_repair(None, None, 0, 65, self.inspection_date)
        self.assertIsNone(missing["baseline_days"])
        self.assertFalse(missing["scenario"]["available"])

    def test_missing_measurements_are_not_sensor_failure_predictions(self):
        detail = run_survival_analysis(3, "Unknown bridge", {})
        self.assertEqual(detail["health_condition"], "Unavailable")
        self.assertIsNone(detail["degradation_rate"])
        self.assertTrue(all(value is None for value in detail["survival_predictions"].values()))
        self.assertTrue(all(item["condition"] == "Unavailable" for item in detail["sensor_readings"]))
        self.assertNotIn("sensor_risks", detail)
        self.assertEqual(get_bridge_condition(None, self.healthy), "Unavailable")


if __name__ == "__main__":
    unittest.main()
