"""
OpenPMX Work Order Generator
Automatically generates PDF maintenance work orders when alerts trigger
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from datetime import datetime
import os

def generate_work_order(
    machine_id: str,
    overall_health: float,
    message: str,
    bearings: dict,
    timestamp: str,
    work_order_id: str = None
) -> str:
    """
    Generate a PDF maintenance work order
    Returns the path to the generated PDF
    """

    # Create work orders directory
    os.makedirs("work_orders", exist_ok=True)

    # Generate work order ID
    if not work_order_id:
        work_order_id = f"WO-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

    # PDF file path
    pdf_path = f"work_orders/{work_order_id}.pdf"

    # Determine priority
    if overall_health == 0:
        priority = "CRITICAL"
        priority_color = colors.HexColor("#E24B4A")
    elif overall_health < 25:
        priority = "HIGH"
        priority_color = colors.HexColor("#E24B4A")
    elif overall_health < 50:
        priority = "MEDIUM"
        priority_color = colors.HexColor("#EF9F27")
    else:
        priority = "LOW"
        priority_color = colors.HexColor("#1D9E75")

    # Find most critical bearing
    critical_bearings = [
        (name, data) for name, data in bearings.items()
        if data["status"] in ["critical", "warning"]
    ]

    # Recommended actions based on health
    if overall_health == 0:
        recommended_actions = [
            "STOP MACHINE IMMEDIATELY",
            "Do not restart until inspection is complete",
            "Replace or repair affected bearing",
            "Check lubrication system",
            "Inspect adjacent components for damage",
            "Document failure mode and root cause"
        ]
        estimated_time = "4-8 hours"
    elif overall_health < 25:
        recommended_actions = [
            "Schedule immediate maintenance",
            "Reduce machine load if possible",
            "Inspect bearing for wear and damage",
            "Check and replace lubrication",
            "Monitor temperature closely",
            "Prepare replacement parts"
        ]
        estimated_time = "2-4 hours"
    else:
        recommended_actions = [
            "Schedule maintenance within 48 hours",
            "Monitor machine closely",
            "Check lubrication levels",
            "Inspect bearing for early wear signs",
            "Order replacement parts as precaution"
        ]
        estimated_time = "1-2 hours"

    # Create PDF
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
    header_style = ParagraphStyle(
        'Header',
        parent=styles['Normal'],
        fontSize=20,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor("#1D9E75"),
        spaceAfter=4
    )
    story.append(Paragraph("OpenPMX", header_style))

    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor("#666666"),
        spaceAfter=12
    )
    story.append(Paragraph("Open-Source Predictive Maintenance Platform", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#1D9E75")))
    story.append(Spacer(1, 12))

    # Work Order Title
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Normal'],
        fontSize=18,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor("#1a1a1a"),
        spaceAfter=4
    )
    story.append(Paragraph("MAINTENANCE WORK ORDER", title_style))

    wo_style = ParagraphStyle(
        'WO',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.HexColor("#666666"),
        spaceAfter=16
    )
    story.append(Paragraph(f"Work Order ID: {work_order_id}", wo_style))

    # Priority badge
    priority_data = [[f"PRIORITY: {priority}"]]
    priority_table = Table(priority_data, colWidths=[2*inch])
    priority_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), priority_color),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.white),
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 12),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('PADDING', (0,0), (-1,-1), 8),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
    ]))
    story.append(priority_table)
    story.append(Spacer(1, 16))

    # Machine details table
    section_style = ParagraphStyle(
        'Section',
        parent=styles['Normal'],
        fontSize=13,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor("#1a1a1a"),
        spaceAfter=8,
        spaceBefore=12
    )
    story.append(Paragraph("Machine Information", section_style))

    details_data = [
        ["Machine ID", machine_id],
        ["Alert Time", timestamp],
        ["Overall Health", f"{overall_health}/100"],
        ["Alert Message", message],
        ["Estimated Repair Time", estimated_time],
    ]

    details_table = Table(details_data, colWidths=[2*inch, 4.5*inch])
    details_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#F8F9FA")),
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('PADDING', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#dddddd")),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.white, colors.HexColor("#F8F9FA")]),
    ]))
    story.append(details_table)

    # Bearing status
    story.append(Paragraph("Component Health Status", section_style))

    bearing_header = [["Component", "Health Score", "RMS Vibration", "Status"]]
    bearing_rows = []
    for name, data in bearings.items():
        status_color = (
            "#E24B4A" if data["status"] == "critical" else
            "#EF9F27" if data["status"] == "warning" else
            "#378ADD" if data["status"] == "monitor" else
            "#1D9E75"
        )
        bearing_rows.append([
            name.replace("bearing", "Bearing ").title(),
            f"{data['health_score']}/100",
            f"{data['rms']}g",
            data["status"].upper()
        ])

    bearing_data = bearing_header + bearing_rows
    bearing_table = Table(bearing_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 2*inch])
    bearing_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1D9E75")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('PADDING', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#dddddd")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8F9FA")]),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
    ]))
    story.append(bearing_table)

    # Recommended actions
    story.append(Paragraph("Recommended Actions", section_style))

    for i, action in enumerate(recommended_actions, 1):
        action_style = ParagraphStyle(
            'Action',
            parent=styles['Normal'],
            fontSize=10,
            spaceAfter=6,
            leftIndent=20
        )
        story.append(Paragraph(f"{i}. {action}", action_style))

    story.append(Spacer(1, 16))

    # Sign off section
    story.append(Paragraph("Sign Off", section_style))

    signoff_data = [
        ["Assigned To:", "_" * 30, "Date Assigned:", "_" * 20],
        ["Completed By:", "_" * 30, "Date Completed:", "_" * 20],
        ["Supervisor:", "_" * 30, "Signature:", "_" * 20],
    ]

    signoff_table = Table(signoff_data, colWidths=[1.2*inch, 2.3*inch, 1.2*inch, 1.8*inch])
    signoff_table.setStyle(TableStyle([
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('PADDING', (0,0), (-1,-1), 8),
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTNAME', (2,0), (2,-1), 'Helvetica-Bold'),
    ]))
    story.append(signoff_table)

    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#dddddd")))

    # Footer
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor("#888888"),
        alignment=TA_CENTER,
        spaceBefore=8
    )
    story.append(Paragraph(
        f"Generated by OpenPMX — github.com/SahDhirendra/openpmx | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        footer_style
    ))

    # Build PDF
    doc.build(story)
    print(f"Work order generated: {pdf_path}")
    return pdf_path