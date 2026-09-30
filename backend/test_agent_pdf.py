"""Focused checks for AI inspector reports and their PDF exports."""

from io import BytesIO

import pytest
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Table

PdfReader = pytest.importorskip("pypdf").PdfReader

from backend.agent import analyze_sensors
from backend.agent_pdf import _append_report, build_agent_inspection_pdf


@pytest.mark.parametrize(
    ("vibration", "health_score", "condition"),
    [(0.3, 92, "Healthy"), (1.4, 32, "Critical")],
)
def test_report_and_pdf_export(vibration, health_score, condition):
    live_data = {
        "vibration": vibration,
        "strain": 120.0,
        "crack_gap": 0.10,
        "water_level": 2.2,
        "health_score": health_score,
    }
    analysis = analyze_sensors(live_data)
    assert analysis["severity"] == condition

    markdown = (
        "### EXECUTIVE SUMMARY\n"
        f"The bridge condition is {condition}.\n\n"
        "### SENSOR ANALYSIS\n"
        "| Sensor | Reading | Condition |\n"
        "| --- | --- | --- |\n"
        f"| Vibration | {vibration:.2f} g | {condition} |\n"
    )
    styles = getSampleStyleSheet()
    report_styles = {
        "table_header": styles["Normal"],
        "table_cell": styles["Normal"],
        "section": styles["Heading2"],
        "subsection": styles["Heading3"],
        "bullet": styles["Normal"],
        "body": styles["Normal"],
    }
    story = []
    _append_report(story, markdown, 500, report_styles)
    assert any(isinstance(item, Table) and len(item._cellvalues) == 2 for item in story)

    pdf_bytes = build_agent_inspection_pdf({
        "bridge_id": 7,
        "bridge_name": "Test bridge",
        "inspection_date": "2026-09-29",
        "severity": condition,
        "health_score": health_score,
        "sensor_summary": live_data,
        "issues_detected": analysis["issues"],
        "full_report": markdown,
    })
    assert pdf_bytes.startswith(b"%PDF-")
    reader = PdfReader(BytesIO(pdf_bytes))
    text = "\n".join(page.extract_text() for page in reader.pages)
    assert "Bridge inspection report" in text
    assert "Inspection date: 2026-09-29" in text
    assert "Executive summary" in text
    assert "Sensor analysis" in text
    assert "project thresholds" in text
    assert condition in text
    assert "Vibration" in text
    assert "Reading" in text
    assert "|" not in text
    assert "IRC" not in text
    assert "NORMAL" not in text
    assert "WARNING" not in text
