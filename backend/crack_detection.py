"""Visual crack assessment with calibrated measurements kept separate."""

import base64
from dataclasses import dataclass
from datetime import datetime, timezone
import io
import json
import math
import os

from groq import (
    APIConnectionError, APIStatusError, APITimeoutError, AuthenticationError,
    BadRequestError, Groq, NotFoundError, RateLimitError,
)
from PIL import Image, ImageDraw, ImageOps, UnidentifiedImageError

try:
    from backend.constants import SENSOR_THRESHOLDS, get_sensor_status
except ImportError:
    from constants import SENSOR_THRESHOLDS, get_sensor_status


VISUAL_SEVERITIES = {"hairline", "minor", "moderate", "severe", "critical"}
CRACK_TYPES = {"flexural", "shear", "longitudinal", "transverse", "diagonal", "map/pattern"}
MATERIALS = {"concrete", "steel", "masonry", "unknown"}
VISION_MODEL = "qwen/qwen3.8-27b"
VISION_FAILURE_MESSAGES = {
    "not_configured": "Vision provider credentials are not configured on the server.",
    "authentication": "The vision provider rejected the server credentials.",
    "rate_limited": "The vision provider is temporarily rate limited. Try again later.",
    "model_unavailable": "The configured vision model is unavailable to this provider account.",
    "invalid_request": "The vision provider rejected this image request.",
    "provider_unreachable": "The vision provider could not be reached. Try again later.",
    "provider_unavailable": "The vision provider is temporarily unavailable. Try again later.",
    "invalid_response": "The vision provider returned an unreadable analysis. Try again later.",
    "provider_error": "Vision analysis failed at the provider. Try again later.",
}


@dataclass(frozen=True)
class VisionResult:
    analysis: dict | None
    error_category: str | None = None
RECOMMEND_CRACK = "Arrange an on-site inspection to verify the detected crack and obtain a calibrated width measurement before planning work."
RECOMMEND_CLEAR = "No crack was identified by the visual model. If a crack is suspected, verify it during an on-site inspection."
RECOMMEND_UNAVAILABLE = "Visual analysis is unavailable. Inspect the image and verify any suspected crack on site, or retry the analysis."


def validate_bridge_selection(bridge_id: int, bridge_name: str, bridges: list[dict]) -> str:
    """Return the canonical name only for a known, matching bridge ID and name."""
    match = next((bridge for bridge in bridges if bridge["id"] == bridge_id), None)
    if match is None or not isinstance(bridge_name, str) or bridge_name.strip().casefold() != match["name"].casefold():
        raise ValueError("Select a valid bridge ID and matching name from the bridge list")
    return match["name"]


def validate_calibrated_width(width_mm, reference):
    """Accept a physical width only with an explicit field measurement reference."""
    if width_mm is None and not reference:
        return None, None
    try:
        width = float(width_mm)
    except (TypeError, ValueError):
        raise ValueError("A calibrated width and its measurement reference are required") from None
    if not math.isfinite(width) or width < 0 or not isinstance(reference, str) or not reference.strip():
        raise ValueError("A non-negative calibrated width and its measurement reference are required")
    return width, reference.strip()


def image_to_base64(image: Image.Image) -> str:
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG", quality=90)
    return base64.b64encode(buffered.getvalue()).decode("ascii")


def analyze_crack_with_groq(image: Image.Image) -> VisionResult:
    """Return model-reported attributes or a safe, actionable failure category."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return VisionResult(None, "not_configured")
    prompt = """Assess the visible image only. Return JSON with:
{
  "crack_detected": true or false,
  "crack_count": integer or null,
  "visual_severity": "hairline", "minor", "moderate", "severe", "critical", or null,
  "crack_type": "flexural", "shear", "longitudinal", "transverse", "diagonal", "map/pattern", or null,
  "material": "concrete", "steel", "masonry", "unknown", or null,
  "regions": [{"x1": 0.0, "y1": 0.0, "x2": 0.0, "y2": 0.0}]
}
Region coordinates must be normalized image coordinates and included only when a crack can be localized. Otherwise return [].
Do not estimate physical width, length, confidence percentages, causes, repair work, costs, deadlines, restrictions, or standards. If no crack is visible, return crack_detected false and regions []."""
    try:
        response = Groq(api_key=api_key, timeout=30.0, max_retries=0).chat.completions.create(
            model=VISION_MODEL,
            messages=[{"role": "user", "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + image_to_base64(image)}},
            ]}],
            max_completion_tokens=1024,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
    except AuthenticationError:
        return VisionResult(None, "authentication")
    except RateLimitError:
        return VisionResult(None, "rate_limited")
    except NotFoundError:
        return VisionResult(None, "model_unavailable")
    except BadRequestError as exc:
        body = exc.body if isinstance(exc.body, dict) else {}
        error = body.get("error", body)
        code = error.get("code") if isinstance(error, dict) else None
        if code in {"model_decommissioned", "model_not_found", "model_not_available", "model_access_denied"}:
            return VisionResult(None, "model_unavailable")
        return VisionResult(None, "invalid_request")
    except (APIConnectionError, APITimeoutError):
        return VisionResult(None, "provider_unreachable")
    except APIStatusError as exc:
        return VisionResult(None, "provider_unavailable" if exc.status_code >= 500 else "provider_error")
    except Exception:
        # Never include provider exception text in the report or logs.
        return VisionResult(None, "provider_error")
    try:
        raw = response.choices[0].message.content
        parsed = json.loads(raw) if isinstance(raw, str) else None
        if not isinstance(parsed, dict) or type(parsed.get("crack_detected")) is not bool:
            return VisionResult(None, "invalid_response")
        return VisionResult(parsed)
    except (AttributeError, IndexError, TypeError, ValueError):
        return VisionResult(None, "invalid_response")


def _validated_regions(raw_regions):
    regions = []
    if not isinstance(raw_regions, list):
        return regions
    for region in raw_regions[:20]:
        if not isinstance(region, dict):
            continue
        try:
            x1, y1, x2, y2 = (float(region[key]) for key in ("x1", "y1", "x2", "y2"))
        except (KeyError, TypeError, ValueError):
            continue
        if all(math.isfinite(value) for value in (x1, y1, x2, y2)) and 0 <= x1 < x2 <= 1 and 0 <= y1 < y2 <= 1:
            if (x2 - x1) * (y2 - y1) < 0.8:
                regions.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2})
    return regions


def create_annotated_image(image: Image.Image, regions: list[dict]) -> str:
    """Draw only validated, model-reported coordinates; never a frame."""
    annotated = image.copy()
    if regions:
        draw = ImageDraw.Draw(annotated)
        width, height = annotated.size
        line_width = max(2, round(min(width, height) / 300))
        for region in regions:
            draw.rectangle(
                [round(region["x1"] * width), round(region["y1"] * height),
                 round(region["x2"] * width), round(region["y2"] * height)],
                outline="#0F6E56", width=line_width,
            )
    return image_to_base64(annotated)


def _model_fields(model_result):
    if not isinstance(model_result, dict) or type(model_result.get("crack_detected")) is not bool:
        return {
            "analysis_status": "unavailable", "crack_detected": None, "crack_count": None,
            "visual_severity": None, "crack_type": None, "material": None, "regions": [],
        }
    detected = model_result["crack_detected"]
    severity = model_result.get("visual_severity") or model_result.get("severity")
    count = model_result.get("crack_count")
    return {
        "analysis_status": "available",
        "crack_detected": detected,
        "crack_count": count if detected and type(count) is int and 0 <= count <= 100 else 0 if not detected else None,
        "visual_severity": severity if detected and severity in VISUAL_SEVERITIES else None,
        "crack_type": model_result.get("crack_type") if detected and model_result.get("crack_type") in CRACK_TYPES else None,
        "material": model_result.get("material") if model_result.get("material") in MATERIALS else None,
        "regions": _validated_regions(model_result.get("regions")) if detected else [],
    }


def recommended_next_step(model: dict, threshold_status: str, width_supplied: bool) -> str:
    """Keep the user measurement and the model's visual finding distinct."""
    if model["analysis_status"] == "unavailable":
        visual_finding = "Visual model analysis is unavailable; it has not confirmed a crack."
        visual_action = RECOMMEND_UNAVAILABLE
    elif model["crack_detected"]:
        visual_finding = "The visual model identified a possible crack."
        visual_action = RECOMMEND_CRACK
    else:
        visual_finding = "The visual model did not identify a crack."
        visual_action = RECOMMEND_CLEAR

    if threshold_status == "Critical":
        return (
            "The user-supplied measured width reaches the project Critical threshold. "
            "Verify that measurement and its reference, and arrange an on-site crack inspection. "
            + visual_finding
        )
    if threshold_status == "Monitor":
        return (
            "The user-supplied measured width reaches the project Monitor threshold. "
            "Verify that measurement and its reference during an on-site crack inspection. "
            + visual_finding
        )
    if width_supplied:
        return visual_action + " The user-supplied measured width is below the project warning threshold; verify its reference."
    return visual_action


def analyze_crack_image(
    image_bytes: bytes, bridge_id: int, bridge_name: str,
    calibrated_width_mm=None, measurement_reference=None,
) -> dict:
    width_mm, reference = validate_calibrated_width(calibrated_width_mm, measurement_reference)
    try:
        with Image.open(io.BytesIO(image_bytes)) as uploaded:
            image = ImageOps.exif_transpose(uploaded).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValueError("The uploaded file is not a readable image") from exc
    image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)

    vision = analyze_crack_with_groq(image)
    model = _model_fields(vision.analysis)
    error_category = vision.error_category
    if model["analysis_status"] == "unavailable" and error_category is None:
        error_category = "invalid_response"
    regions = model.pop("regions")
    if width_mm is None:
        threshold_status = "Unavailable"
        width_source = "Unavailable: no calibrated measurement and reference were provided."
    else:
        threshold_status = get_sensor_status("crack_gap", width_mm)
        width_source = "User-supplied calibrated measurement: " + reference
    recommendation = recommended_next_step(model, threshold_status, width_mm is not None)
    now = datetime.now(timezone.utc)
    return {
        "report_id": "CR-" + now.strftime("%Y%m%d%H%M%S") + "-B" + str(bridge_id),
        "timestamp": now.isoformat(),
        "bridge_id": bridge_id,
        "bridge_name": bridge_name,
        **model,
        "visual_source": "AI visual estimate; verify on site." if model["analysis_status"] == "available" else "Model analysis unavailable.",
        "vision_model": VISION_MODEL,
        "error_category": error_category,
        "error_message": VISION_FAILURE_MESSAGES.get(error_category) if error_category else None,
        "threshold_status": threshold_status,
        "critical_threshold_mm": SENSOR_THRESHOLDS["crack_gap"]["crit"],
        "calibrated_width_mm": width_mm,
        "width_source": width_source,
        "length_mm": None,
        "length_source": "Unavailable: no calibrated length measurement was provided.",
        "confidence_percent": None,
        "confidence_source": "Unavailable: no calibrated model confidence score is provided.",
        "recommended_action": recommendation,
        "regions": regions,
        "annotated_image_base64": create_annotated_image(image, regions),
        "annotation_caption": (
            "Model-estimated crack region; verify its location on site."
            if regions else "No localized crack coordinates returned; the full original image is shown without overlays."
        ),
    }
