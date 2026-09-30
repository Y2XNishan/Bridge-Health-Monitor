"""PDF rendering for the AI inspector's bridge report."""

from datetime import date, datetime, timedelta, timezone
from html import escape
import io
import math
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

try:
    from backend.constants import SENSOR_THRESHOLDS, get_sensor_status
except ImportError:
    from constants import SENSOR_THRESHOLDS, get_sensor_status


def _sentence_case(heading: str) -> str:
    result = heading.strip().lower()
    result = re.sub(r"(^|[.!?]\s*)([a-z])", lambda match: match[1] + match[2].upper(), result)
    return re.sub(r"\b(ai|pdf|mpa)\b", lambda match: match[0].upper() if match[0] != "mpa" else "MPa", result)


def _inline_markup(value: object) -> str:
    text = str(value).replace("\\|", " / ").replace("|", " / ")
    text = text.replace("—", "-").replace("–", "-").replace("•", "-")
    text = escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    text = re.sub(r"`([^`]+)`", r"<font face='Courier'>\1</font>", text)
    return text


def _table_cells(line: str) -> list[str]:
    content = line.strip()
    if content.startswith("|"):
        content = content[1:]
    if content.endswith("|") and not content.endswith("\\|"):
        content = content[:-1]
    return [cell.strip().replace("\\|", " / ") for cell in re.split(r"(?<!\\)\|", content)]


def _is_table_divider(line: str, count: int) -> bool:
    cells = _table_cells(line)
    return len(cells) == count and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def _append_report(story: list, report: str, width: float, styles: dict) -> None:
    lines = report.splitlines()
    index = 0
    in_fence = False
    while index < len(lines):
        line = lines[index].strip()
        if re.match(r"^(```|~~~)", line):
            in_fence = not in_fence
            index += 1
            continue
        if not line:
            story.append(Spacer(1, 4))
            index += 1
            continue

        headers = _table_cells(line)
        if not in_fence and "|" in line and index + 1 < len(lines) and _is_table_divider(lines[index + 1], len(headers)):
            index += 2
            rows = []
            while index < len(lines) and lines[index].strip() and ("|" in lines[index] or len(headers) == 1):
                rows.append(_table_cells(lines[index]))
                index += 1
            cells = [[Paragraph(_inline_markup(header), styles["table_header"]) for header in headers]]
            cells.extend([
                [Paragraph(_inline_markup(row[col] if col < len(row) else ""), styles["table_cell"]) for col in range(len(headers))]
                for row in rows
            ])
            report_table = Table(cells, colWidths=[width / len(headers)] * len(headers), repeatRows=1, hAlign="LEFT")
            report_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#17324A")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F8FA")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8E1E8")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.extend((report_table, Spacer(1, 8)))
            continue

        heading = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading:
            style = styles["section"] if len(heading[1]) == 1 else styles["subsection"]
            story.append(Paragraph(_inline_markup(_sentence_case(heading[2])), style))
        elif re.match(r"^[-*+]\s+", line):
            story.append(Paragraph("- " + _inline_markup(re.sub(r"^[-*+]\s+", "", line)), styles["bullet"]))
        elif re.match(r"^\d+[.)]\s+", line):
            story.append(Paragraph(_inline_markup(line), styles["bullet"]))
        else:
            story.append(Paragraph(_inline_markup(line), styles["body"]))
        index += 1


def build_agent_inspection_pdf(report: dict) -> bytes:
    """Return a PDF of one inspection without consulting live or historical data."""
    inspection_date = report.get("inspection_date")
    if isinstance(inspection_date, str):
        inspection_date = date.fromisoformat(inspection_date)
    if inspection_date is None:
        inspection_date = datetime.now(timezone(timedelta(hours=5, minutes=30))).date()

    condition = str(report.get("severity", "Healthy")).strip().lower()
    condition = {"critical": "Critical", "warning": "Monitor", "watch": "Monitor", "monitor": "Monitor"}.get(condition, "Healthy")
    condition_color = {"Healthy": "#0F6E56", "Monitor": "#B45309", "Critical": "#991B1B"}[condition]
    page_width = A4[0] - 72
    output = io.BytesIO()
    document = SimpleDocTemplate(
        output, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=40, bottomMargin=44,
        title="Bridge inspection report", author="Bridge Health Monitor",
    )
    base = getSampleStyleSheet()["Normal"]
    styles = {
        "title": ParagraphStyle("InspectorTitle", parent=base, fontName="Helvetica-Bold", fontSize=21, leading=26, textColor=colors.HexColor("#17283B"), spaceAfter=5),
        "subtitle": ParagraphStyle("InspectorSubtitle", parent=base, fontName="Helvetica", fontSize=10, leading=14, textColor=colors.HexColor("#526579"), spaceAfter=10),
        "section": ParagraphStyle("InspectorSection", parent=base, fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=colors.HexColor("#17283B"), spaceBefore=14, spaceAfter=7, keepWithNext=True),
        "subsection": ParagraphStyle("InspectorSubsection", parent=base, fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=colors.HexColor("#17283B"), spaceBefore=10, spaceAfter=5, keepWithNext=True),
        "body": ParagraphStyle("InspectorBody", parent=base, fontName="Helvetica", fontSize=9.5, leading=14, textColor=colors.HexColor("#334155"), spaceAfter=5),
        "bullet": ParagraphStyle("InspectorBullet", parent=base, fontName="Helvetica", fontSize=9.5, leading=14, leftIndent=13, firstLineIndent=-9, textColor=colors.HexColor("#334155"), spaceAfter=4),
        "table_cell": ParagraphStyle("InspectorTableCell", parent=base, fontName="Helvetica", fontSize=8.5, leading=11, textColor=colors.HexColor("#273747")),
        "table_header": ParagraphStyle("InspectorTableHeader", parent=base, fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=colors.white),
    }

    story = [
        Paragraph("Bridge inspection report", styles["title"]),
        Paragraph(f"Inspection date: {inspection_date.isoformat()}", styles["subtitle"]),
        HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=7),
        Paragraph("General information and overall condition", styles["section"]),
    ]

    info_rows = [
        ("Bridge name", report.get("bridge_name", "Unknown bridge")),
        ("Bridge ID", report.get("bridge_id", "-")),
        ("Inspection date", inspection_date.isoformat()),
        ("Health score", f"{report.get('health_score', '-')}/100"),
        ("Overall condition", condition),
    ]
    info_cells = [[Paragraph(_inline_markup(key), styles["table_cell"]), Paragraph(_inline_markup(value), styles["table_cell"])] for key, value in info_rows]
    info_table = Table(info_cells, colWidths=[128, page_width - 128], hAlign="LEFT")
    info_table.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#F5F8FA")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8E1E8")),
        ("TEXTCOLOR", (1, 4), (1, 4), colors.HexColor(condition_color)),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend((info_table, Paragraph("Sensor readings and project thresholds", styles["section"])))

    sensor_cells = [[Paragraph(name, styles["table_header"]) for name in ("Sensor", "Reading", "Monitor threshold", "Critical threshold", "Condition")]]
    for key, label, decimals in (
        ("vibration", "Vibration", 3),
        ("strain", "Strain", 1),
        ("crack_gap", "Crack gap", 3),
        ("water_level", "Water level", 2),
    ):
        threshold = SENSOR_THRESHOLDS[key]
        value = report.get("sensor_summary", {}).get(key)
        try:
            numeric = float(value) if value is not None else math.nan
        except (TypeError, ValueError):
            numeric = math.nan
        reading = f"{numeric:.{decimals}f} {threshold['unit']}" if math.isfinite(numeric) else "Unavailable"
        sensor_condition = get_sensor_status(key, numeric) if math.isfinite(numeric) else "Unavailable"
        sensor_cells.append([
            Paragraph(label, styles["table_cell"]),
            Paragraph(reading, styles["table_cell"]),
            Paragraph(f"{threshold['warn']:.{decimals}f} {threshold['unit']}", styles["table_cell"]),
            Paragraph(f"{threshold['crit']:.{decimals}f} {threshold['unit']}", styles["table_cell"]),
            Paragraph(sensor_condition, styles["table_cell"]),
        ])
    sensor_table = Table(sensor_cells, colWidths=[85, 92, 116, 116, page_width - 409], repeatRows=1, hAlign="LEFT")
    sensor_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#17324A")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F8FA")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8E1E8")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(sensor_table)

    issues = report.get("issues_detected") or []
    if issues:
        story.append(Paragraph("Threshold findings", styles["section"]))
        for issue in issues:
            story.append(Paragraph("- " + _inline_markup(issue), styles["bullet"]))

    story.append(Paragraph("Inspection analysis", styles["section"]))
    _append_report(story, report.get("full_report") or "", page_width, styles)

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#64748B"))
        canvas.drawString(36, 24, f"Inspection date: {inspection_date.isoformat()}")
        canvas.drawRightString(A4[0] - 36, 24, f"Page {doc.page}")
        canvas.restoreState()

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
