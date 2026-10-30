import asyncio
import smtplib
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import urlencode

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import generate_url_token
from app.models import AuthTokenPurpose
from app.repositories import auth_tokens, users

_templates = Environment(
    loader=FileSystemLoader(Path(__file__).parent.parent / "templates" / "email"),
    autoescape=select_autoescape(["html"]),
)


def build_message(to: str, subject: str, template: str, **context: object) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = get_settings().email_from
    message["To"] = to
    message.set_content(_templates.get_template(f"{template}.txt").render(**context))
    message.add_alternative(_templates.get_template(f"{template}.html").render(**context), subtype="html")
    return message


def send_message(message: EmailMessage) -> None:
    settings = get_settings()
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        if settings.smtp_user:
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password.get_secret_value())
        smtp.send_message(message)


async def _issue_link_token(
    session: AsyncSession, user_id: int, purpose: AuthTokenPurpose, lifetime: timedelta
) -> str:
    """Runs in the worker rather than the API, so the raw token never passes through the broker.

    Safe to retry: every run replaces the user's unused tokens, so only the newest link works.
    """
    raw_token, token_hash = generate_url_token()
    await auth_tokens.delete_unused(session, user_id, purpose)
    auth_tokens.add(session, user_id, purpose, token_hash, datetime.now(UTC) + lifetime)
    await session.commit()
    return raw_token


def _link(path: str, raw_token: str) -> str:
    return f"{get_settings().frontend_url}/{path}?{urlencode({'token': raw_token})}"


async def deliver_password_reset_email(session: AsyncSession, user_id: int) -> None:
    user = await users.get_by_id(session, user_id)
    if user is None:
        return

    minutes = get_settings().reset_token_minutes
    raw_token = await _issue_link_token(
        session, user.id, AuthTokenPurpose.RESET_PASSWORD, timedelta(minutes=minutes)
    )
    message = build_message(
        to=user.email,
        subject="Reset your Noolagam password",
        template="reset_password",
        name=user.name,
        reset_url=_link("reset-password", raw_token),
        expires_minutes=minutes,
    )
    await asyncio.to_thread(send_message, message)


async def deliver_verification_email(session: AsyncSession, user_id: int) -> None:
    user = await users.get_by_id(session, user_id)
    if user is None or user.is_verified:
        return

    hours = get_settings().verify_token_hours
    raw_token = await _issue_link_token(
        session, user.id, AuthTokenPurpose.VERIFY_EMAIL, timedelta(hours=hours)
    )
    message = build_message(
        to=user.email,
        subject="Verify your Noolagam email",
        template="verify_email",
        name=user.name,
        verify_url=_link("verify-email", raw_token),
        expires_hours=hours,
    )
    await asyncio.to_thread(send_message, message)
