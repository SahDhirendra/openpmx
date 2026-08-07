"""
OpenPMX Email Notification System
Sends alerts to maintenance team when machine health drops
"""

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from typing import List
import os

# Email configuration
# These will be set as environment variables
GMAIL = "dhirusah14@gmail.com"
APP_PASSWORD = "gouexzvmtobhcypx"  # your 16 char password no spaces

conf = ConnectionConfig(
    MAIL_USERNAME=GMAIL,
    MAIL_PASSWORD=APP_PASSWORD,
    MAIL_FROM=GMAIL,
    MAIL_PORT=465,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_FROM_NAME="OpenPMX Alert System",
    MAIL_STARTTLS=False,
    MAIL_SSL_TLS=True,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

async def send_alert_email(
    recipients: List[str],
    machine_id: str,
    overall_health: float,
    message: str,
    bearings: dict,
    timestamp: str,
    dashboard_url: str = "https://openpmx-frontend.onrender.com",
    conf: ConnectionConfig = None
):
    """Send critical alert email to maintenance team"""
    if conf is None:
        conf = ConnectionConfig(
            MAIL_USERNAME=os.getenv("MAIL_USERNAME", ""),
            MAIL_PASSWORD=os.getenv("MAIL_PASSWORD", ""),
            MAIL_FROM=os.getenv("MAIL_FROM", "alerts@openpmx.io"),
            MAIL_PORT=int(os.getenv("MAIL_PORT", "465")),
            MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
            MAIL_FROM_NAME="OpenPMX Alert System",
            MAIL_STARTTLS=False,
            MAIL_SSL_TLS=True,
            USE_CREDENTIALS=True,
            VALIDATE_CERTS=True
        )

    # Find the most critical bearing
    critical_bearings = [
        f"{name.replace('bearing', 'Bearing ')}: {data['health_score']}/100 ({data['status']})"
        for name, data in bearings.items()
        if data['status'] in ['critical', 'warning']
    ]

    bearing_details = "\n".join(critical_bearings) if critical_bearings else "All bearings affected"

    # Build email HTML
    html_content = f"""
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        
        <div style="background: #E24B4A; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">
                ⚠️ OpenPMX Critical Alert
            </h1>
        </div>
        
        <div style="background: #FAECE7; padding: 20px; border: 1px solid #E24B4A;">
            <h2 style="color: #712B13; margin: 0 0 8px;">{message}</h2>
            <p style="color: #712B13; margin: 0;">Immediate attention required</p>
        </div>
        
        <div style="background: white; padding: 20px; border: 1px solid #eee;">
            
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px; color: #666; width: 40%;">Machine ID</td>
                    <td style="padding: 8px; font-weight: 600;">{machine_id}</td>
                </tr>
                <tr style="background: #f9f9f9;">
                    <td style="padding: 8px; color: #666;">Overall Health</td>
                    <td style="padding: 8px; font-weight: 600; color: #E24B4A;">{overall_health}/100</td>
                </tr>
                <tr>
                    <td style="padding: 8px; color: #666;">Timestamp</td>
                    <td style="padding: 8px; font-weight: 600;">{timestamp}</td>
                </tr>
                <tr style="background: #f9f9f9;">
                    <td style="padding: 8px; color: #666; vertical-align: top;">Affected Components</td>
                    <td style="padding: 8px; font-weight: 600;">{bearing_details.replace(chr(10), '<br>')}</td>
                </tr>
            </table>

            <div style="margin-top: 20px; text-align: center;">
                <a href="{dashboard_url}" 
                   style="background: #1D9E75; color: white; padding: 12px 24px; 
                          border-radius: 8px; text-decoration: none; font-weight: 600;">
                    View Dashboard
                </a>
            </div>
        </div>
        
        <div style="background: #f9f9f9; padding: 16px; border-radius: 0 0 8px 8px; 
                    text-align: center; font-size: 12px; color: #888;">
            OpenPMX — Open-source predictive maintenance platform<br>
            <a href="https://github.com/SahDhirendra/openpmx">github.com/SahDhirendra/openpmx</a>
        </div>
        
    </div>
    """

    message_schema = MessageSchema(
        subject=f"🚨 CRITICAL ALERT — {machine_id} Health: {overall_health}/100",
        recipients=recipients,
        body=html_content,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message_schema)
    print(f"Alert email sent to {recipients}")


async def send_daily_summary_email(
    recipients: List[str],
    machine_id: str,
    oee_data: dict,
    dashboard_url: str = "https://openpmx-frontend.onrender.com"
):
    """Send daily health summary email"""

    oee_color = "#1D9E75" if oee_data["oee"] >= 85 else "#EF9F27" if oee_data["oee"] >= 60 else "#E24B4A"
    oee_label = "World class" if oee_data["oee"] >= 85 else "Average" if oee_data["oee"] >= 60 else "Needs improvement"

    html_content = f"""
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        
        <div style="background: #1D9E75; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">
                📊 OpenPMX Daily Summary
            </h1>
        </div>
        
        <div style="background: white; padding: 20px; border: 1px solid #eee;">
            <h2 style="margin: 0 0 16px; font-size: 16px;">Machine: {machine_id}</h2>
            
            <div style="display: flex; gap: 16px; margin-bottom: 20px;">
                <div style="flex: 1; text-align: center; background: #f9f9f9; 
                            padding: 16px; border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: 700; color: {oee_color};">
                        {oee_data["oee"]}%
                    </div>
                    <div style="font-size: 12px; color: #666;">OEE — {oee_label}</div>
                </div>
                <div style="flex: 1; text-align: center; background: #f9f9f9; 
                            padding: 16px; border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: 700; color: #378ADD;">
                        {oee_data["availability"]}%
                    </div>
                    <div style="font-size: 12px; color: #666;">Availability</div>
                </div>
                <div style="flex: 1; text-align: center; background: #f9f9f9; 
                            padding: 16px; border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: 700; color: #E24B4A;">
                        {oee_data["total_downtime_minutes"]}m
                    </div>
                    <div style="font-size: 12px; color: #666;">Downtime</div>
                </div>
            </div>

            <div style="text-align: center;">
                <a href="{dashboard_url}" 
                   style="background: #1D9E75; color: white; padding: 12px 24px; 
                          border-radius: 8px; text-decoration: none; font-weight: 600;">
                    View Full Dashboard
                </a>
            </div>
        </div>
        
        <div style="background: #f9f9f9; padding: 16px; border-radius: 0 0 8px 8px; 
                    text-align: center; font-size: 12px; color: #888;">
            OpenPMX — Open-source predictive maintenance platform
        </div>
        
    </div>
    """

    message_schema = MessageSchema(
        subject=f"📊 Daily Summary — {machine_id} | OEE: {oee_data['oee']}%",
        recipients=recipients,
        body=html_content,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message_schema)
    print(f"Daily summary email sent to {recipients}")