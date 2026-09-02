"""
OpenPMX Monthly Report Generator
Generates PDF reports with OEE, downtime, alerts and cost savings
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from datetime import datetime, timedelta
import os

def generate_monthly_report(
    machine_id: str,
    oee_data: dict,
    downtime_events: list,
    alerts: list,
    readings_count: int,
    hourly_rate: float = 1000,
    repair_cost: float = 5000,
    month: str = None
) -> str:
    """Generate a monthly PDF maintenance report"""

    os.makedirs("reports", exist_ok=True)

    if not month:
        month = datetime.now().strftime("%Y-%m")

    report_id = f"RPT-{machine_id}-{month}"
    pdf_path = f"reports/{report_id}.pdf"

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.75*inch
    )

    styles = getSampleStyleSheet()
    story = []

    # Header
    header_style = ParagraphStyle('Header', parent=styles['Normal'],
        fontSize=22, fontName='Helvetica-Bold',
        textColor=colors.HexColor("#1D9E75"), spaceAfter=4)
    story.append(Paragraph("OpenPMX", header_style))

    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'],
        fontSize=11, textColor=colors.HexColor("#666666"), spaceAfter=12)
    story.append(Paragraph("Open-Source Predictive Maintenance Platform", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#1D9E75")))
    story.append(Spacer(1, 12))

    # Report title
    title_style = ParagraphStyle('Title', parent=styles['Normal'],
        fontSize=18, fontName='Helvetica-Bold', spaceAfter=4)
    story.append(Paragraph("Monthly Maintenance Report", title_style))

    info_style = ParagraphStyle('Info', parent=styles['Normal'],
        fontSize=11, textColor=colors.HexColor("#666666"), spaceAfter=16)
    story.append(Paragraph(f"Machine: {machine_id} | Period: {month} | Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", info_style))

    # ─── OEE Summary ───
    section_style = ParagraphStyle('Section', parent=styles['Normal'],
        fontSize=13, fontName='Helvetica-Bold', spaceBefore=14, spaceAfter=8)
    story.append(Paragraph("OEE Summary", section_style))

    oee_color = colors.HexColor("#1D9E75") if oee_data.get("oee", 0) >= 85 else \
                colors.HexColor("#EF9F27") if oee_data.get("oee", 0) >= 60 else \
                colors.HexColor("#E24B4A")

    oee_data_table = [
        ["Metric", "Value", "Status"],
        ["OEE Score", f"{oee_data.get('oee', 0)}%",
         "World Class" if oee_data.get('oee', 0) >= 85 else "Average" if oee_data.get('oee', 0) >= 60 else "Needs Improvement"],
        ["Availability", f"{oee_data.get('availability', 0)}%", ""],
        ["Total Uptime", f"{round(oee_data.get('uptime_minutes', 0) / 60, 1)} hours", ""],
        ["Total Downtime", f"{round(oee_data.get('total_downtime_minutes', 0), 1)} minutes", ""],
        ["Downtime Events", str(oee_data.get('downtime_events_count', 0)), ""],
        ["Total Readings", str(readings_count), ""],
    ]

    oee_table = Table(oee_data_table, colWidths=[2.5*inch, 2*inch, 2*inch])
    oee_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1D9E75")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTNAME', (0,1), (0,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('PADDING', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#dddddd")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8F9FA")]),
        ('TEXTCOLOR', (1,1), (1,1), oee_color),
        ('FONTNAME', (1,1), (1,1), 'Helvetica-Bold'),
        ('FONTSIZE', (1,1), (1,1), 12),
    ]))
    story.append(oee_table)

    # ─── Cost Savings ───
    story.append(Paragraph("Cost Savings Analysis", section_style))

    downtime_hours = oee_data.get('total_downtime_minutes', 0) / 60
    downtime_cost = downtime_hours * hourly_rate
    repair_costs = oee_data.get('downtime_events_count', 0) * repair_cost
    total_savings = downtime_cost + repair_costs

    cost_data = [
        ["Cost Category", "Calculation", "Amount"],
        ["Downtime Cost Prevented", f"{round(downtime_hours, 1)} hrs × ${hourly_rate}/hr", f"${downtime_cost:,.0f}"],
        ["Repair Costs Prevented", f"{oee_data.get('downtime_events_count', 0)} events × ${repair_cost}", f"${repair_costs:,.0f}"],
        ["Total Savings", "", f"${total_savings:,.0f}"],
        ["OpenPMX License Cost", "Open Source — MIT License", "$0"],
        ["Net ROI", "", f"${total_savings:,.0f}"],
    ]

    cost_table = Table(cost_data, colWidths=[2.5*inch, 2.5*inch, 1.5*inch])
    cost_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1D9E75")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor("#E1F5EE")),
        ('TEXTCOLOR', (2,1), (2,-1), colors.HexColor("#1D9E75")),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('PADDING', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#dddddd")),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, colors.HexColor("#F8F9FA")]),
        ('ALIGN', (2,0), (2,-1), 'RIGHT'),
    ]))
    story.append(cost_table)

    # ─── Downtime Events ───
    story.append(Paragraph("Downtime Events Log", section_style))

    if downtime_events:
        dt_data = [["Start Time", "Duration", "Status", "Cause"]]
        for event in downtime_events[:15]:
            dt_data.append([
                datetime.fromisoformat(event["start_time"]).strftime("%m/%d %H:%M"),
                f"{round(event['duration_minutes'], 0)}m" if event.get('duration_minutes') else "Ongoing",
                "Resolved" if event.get('resolved') else "Active",
                (event.get('cause', '') or '')[:40]
            ])

        dt_table = Table(dt_data, colWidths=[1.3*inch, 1*inch, 1*inch, 3.2*inch])
        dt_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1D9E75")),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 9),
            ('PADDING', (0,0), (-1,-1), 6),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#dddddd")),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8F9FA")]),
        ]))
        story.append(dt_table)
    else:
        story.append(Paragraph("No downtime events recorded this period.", styles['Normal']))

    # ─── Alert Summary ───
    story.append(Paragraph("Alert Summary", section_style))

    if alerts:
        alert_data = [["Timestamp", "Health Score", "Bearing Affected", "Message"]]
        for alert in alerts[:10]:
            alert_data.append([
                datetime.fromisoformat(alert["timestamp"]).strftime("%m/%d %H:%M"),
                f"{alert.get('overall_health', 0)}/100",
                alert.get('bearing_affected', 'N/A'),
                (alert.get('message', '') or '')[:35]
            ])

        alert_table = Table(alert_data, colWidths=[1.3*inch, 1*inch, 1.2*inch, 3*inch])
        alert_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#E24B4A")),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 9),
            ('PADDING', (0,0), (-1,-1), 6),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#dddddd")),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8F9FA")]),
        ]))
        story.append(alert_table)
    else:
        story.append(Paragraph("No alerts recorded this period. Machine operating normally.", styles['Normal']))

    # Footer
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#dddddd")))
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'],
        fontSize=9, textColor=colors.HexColor("#888888"),
        alignment=TA_CENTER, spaceBefore=8)
    story.append(Paragraph(
        f"Generated by OpenPMX v1.0.0 — github.com/SahDhirendra/openpmx | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        footer_style
    ))

    doc.build(story)
    print(f"Monthly report generated: {pdf_path}")
    return pdf_path