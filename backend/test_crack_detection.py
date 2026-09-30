"""Crack detection must not invent measurements or findings."""

import base64
from io import BytesIO
import json
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import httpx
from groq import BadRequestError
from PIL import Image

from backend.crack_detection import (
    analyze_crack_image,
    analyze_crack_with_groq,
    VISION_MODEL,
    VisionResult,
    validate_bridge_selection,
    validate_calibrated_width,
)


def photo_bytes():
    buffer = BytesIO()
    Image.new("RGB", (200, 100), "white").save(buffer, format="PNG")
    return buffer.getvalue()


class CrackDetectionTests(unittest.TestCase):
    def test_crack_and_calibrated_threshold_are_separate(self):
        model = {
            "crack_detected": True,
            "crack_count": 1,
            "visual_severity": "minor",
            "crack_type": "transverse",
            "material": "concrete",
            "regions": [{"x1": 0.2, "y1": 0.2, "x2": 0.5, "y2": 0.6}],
            "confidence_percent": 97,
            "estimated_width_mm": 0.12,
        }
        with patch("backend.crack_detection.analyze_crack_with_groq", return_value=VisionResult(model)):
            report = analyze_crack_image(photo_bytes(), 1, "Brahmaputra Main Bridge", 0.31, "field crack gauge")
        self.assertEqual(report["visual_severity"], "minor")
        self.assertEqual(report["threshold_status"], "Critical")
        self.assertEqual(report["calibrated_width_mm"], 0.31)
        self.assertIn("field crack gauge", report["width_source"])
        self.assertIn("user-supplied measured width", report["recommended_action"].lower())
        self.assertIn("visual model identified", report["recommended_action"].lower())
        self.assertIsNone(report["length_mm"])
        self.assertIsNone(report["confidence_percent"])
        self.assertNotIn("estimated_width_mm", report)
        self.assertEqual(len(report["regions"]), 1)
        image = Image.open(BytesIO(base64.b64decode(report["annotated_image_base64"])))
        self.assertEqual(image.size, (200, 100))
        self.assertGreater(image.getpixel((0, 0))[0], 240)
        self.assertLess(image.getpixel((40, 20))[0], 140)
        self.assertIn("Model-estimated", report["annotation_caption"])
        text = " ".join(str(value) for value in report.values()).lower()
        for unsupported in ("irc:", "₹", "restrict vehicles", "repair within", "estimated_repair_cost"):
            self.assertNotIn(unsupported, text)

    def test_no_crack_has_no_fake_border_or_dimensions(self):
        with patch("backend.crack_detection.analyze_crack_with_groq", return_value=VisionResult({
            "crack_detected": False, "regions": [{"x1": 0, "y1": 0, "x2": 1, "y2": 1}],
        })):
            report = analyze_crack_image(photo_bytes(), 2, "Saraighat Rail Bridge")
        self.assertEqual(report["analysis_status"], "available")
        self.assertFalse(report["crack_detected"])
        self.assertEqual(report["threshold_status"], "Unavailable")
        self.assertIsNone(report["calibrated_width_mm"])
        self.assertIsNone(report["length_mm"])
        self.assertEqual(report["regions"], [])
        self.assertIn("without overlays", report["annotation_caption"])
        image = Image.open(BytesIO(base64.b64decode(report["annotated_image_base64"])))
        self.assertGreater(image.getpixel((5, 5))[0], 240)
        with patch("backend.crack_detection.analyze_crack_with_groq", return_value=VisionResult({
            "crack_detected": True, "regions": [{"x1": 0, "y1": 0, "x2": 1, "y2": 1}],
        })):
            full_frame = analyze_crack_image(photo_bytes(), 2, "Saraighat Rail Bridge")
        self.assertEqual(full_frame["regions"], [])

    def test_model_failure_is_unavailable_not_a_mock_crack(self):
        with patch("backend.crack_detection.analyze_crack_with_groq", return_value=VisionResult(None, "rate_limited")):
            report = analyze_crack_image(photo_bytes(), 1, "Brahmaputra Main Bridge")
        self.assertEqual(report["analysis_status"], "unavailable")
        self.assertIsNone(report["crack_detected"])
        self.assertIsNone(report["crack_count"])
        self.assertEqual(report["regions"], [])
        self.assertEqual(report["threshold_status"], "Unavailable")
        self.assertEqual(report["error_category"], "rate_limited")
        self.assertIn("rate limited", report["error_message"])
        self.assertIn("retry", report["recommended_action"])

    def test_critical_field_width_requires_inspection_despite_no_visual_crack(self):
        with patch("backend.crack_detection.analyze_crack_with_groq", return_value=VisionResult({
            "crack_detected": False, "regions": [],
        })):
            report = analyze_crack_image(photo_bytes(), 2, "Saraighat Rail Bridge", 0.31, "field crack gauge")
        self.assertFalse(report["crack_detected"])
        self.assertEqual(report["threshold_status"], "Critical")
        action = report["recommended_action"].lower()
        self.assertIn("user-supplied measured width", action)
        self.assertIn("verify that measurement", action)
        self.assertIn("on-site crack inspection", action)
        self.assertIn("visual model did not identify a crack", action)

    def test_critical_field_width_still_guides_when_visual_model_fails(self):
        with patch("backend.crack_detection.analyze_crack_with_groq", return_value=VisionResult(None, "provider_unavailable")):
            report = analyze_crack_image(photo_bytes(), 2, "Saraighat Rail Bridge", 0.31, "field crack gauge")
        self.assertEqual(report["analysis_status"], "unavailable")
        self.assertEqual(report["threshold_status"], "Critical")
        self.assertIn("on-site crack inspection", report["recommended_action"])
        self.assertIn("visual model analysis is unavailable", report["recommended_action"].lower())

    def test_model_client_failure_returns_no_fabricated_result(self):
        with patch("backend.crack_detection.os.getenv", return_value="test-key"), patch(
            "backend.crack_detection.Groq", side_effect=RuntimeError("model unavailable")
        ):
            outcome = analyze_crack_with_groq(Image.new("RGB", (20, 10), "white"))
        self.assertIsNone(outcome.analysis)
        self.assertEqual(outcome.error_category, "provider_error")

    def test_provider_request_and_json_parsing_for_crack_and_no_crack(self):
        self.assertEqual(VISION_MODEL, "qwen/qwen3.8-27b")
        for detected in (True, False):
            analysis = {"crack_detected": detected, "crack_count": 1 if detected else 0, "regions": []}
            response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(analysis)))])
            create = Mock(return_value=response)
            client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
            with patch("backend.crack_detection.os.getenv", return_value="test-key"), patch(
                "backend.crack_detection.Groq", return_value=client
            ):
                outcome = analyze_crack_with_groq(Image.new("RGB", (20, 10), "white"))
            self.assertEqual(outcome.analysis, analysis)
            self.assertIsNone(outcome.error_category)
            self.assertEqual(create.call_args.kwargs["model"], VISION_MODEL)
            self.assertEqual(create.call_args.kwargs["response_format"], {"type": "json_object"})

    def test_missing_credentials_and_invalid_provider_json_are_categorized(self):
        with patch("backend.crack_detection.os.getenv", return_value=None):
            missing = analyze_crack_with_groq(Image.new("RGB", (20, 10), "white"))
        self.assertEqual(missing.error_category, "not_configured")
        response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="not json"))])
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=Mock(return_value=response))))
        with patch("backend.crack_detection.os.getenv", return_value="test-key"), patch(
            "backend.crack_detection.Groq", return_value=client
        ):
            invalid = analyze_crack_with_groq(Image.new("RGB", (20, 10), "white"))
        self.assertEqual(invalid.error_category, "invalid_response")

    def test_retired_model_error_has_safe_category(self):
        response = httpx.Response(
            400, request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
        )
        retired = BadRequestError(
            "provider detail not for users", response=response,
            body={"error": {"code": "model_decommissioned"}},
        )
        with patch("backend.crack_detection.os.getenv", return_value="test-key"), patch(
            "backend.crack_detection.Groq", side_effect=retired
        ):
            outcome = analyze_crack_with_groq(Image.new("RGB", (20, 10), "white"))
        self.assertEqual(outcome.error_category, "model_unavailable")
        self.assertNotIn("provider detail", str(outcome))

    def test_bridge_and_measurement_validation(self):
        bridges = [{"id": 1, "name": "Brahmaputra Main Bridge"}]
        self.assertEqual(validate_bridge_selection(1, "Brahmaputra Main Bridge", bridges), bridges[0]["name"])
        for bridge_id, bridge_name in [(2, "Brahmaputra Main Bridge"), (1, "Wrong name")]:
            with self.assertRaises(ValueError):
                validate_bridge_selection(bridge_id, bridge_name, bridges)
        self.assertEqual(validate_calibrated_width(None, None), (None, None))
        with self.assertRaises(ValueError):
            validate_calibrated_width(0.31, None)
        with self.assertRaises(ValueError):
            validate_calibrated_width(-0.1, "gauge")


if __name__ == "__main__":
    unittest.main()
