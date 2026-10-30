import smtplib
import ssl
from email.message import EmailMessage
from unittest.mock import MagicMock

import pytest

from app.core.config import get_settings
from app.services import email as email_service
from app.worker import tasks


def _message() -> EmailMessage:
    return email_service.build_message(
        to="ravi@example.com",
        subject="Reset",
        template="reset_password",
        name="<Ravi>",
        reset_url="http://app.test/reset-password?token=abc",
        expires_minutes=30,
    )


def test_message_has_plain_text_and_html_with_the_link() -> None:
    message = _message()
    plain = message.get_body(("plain",))
    html = message.get_body(("html",))

    assert plain is not None and html is not None
    assert "http://app.test/reset-password?token=abc" in plain.get_content()
    assert 'href="http://app.test/reset-password?token=abc"' in html.get_content()


def test_html_escapes_user_supplied_values() -> None:
    html = _message().get_body(("html",))

    assert html is not None
    assert "&lt;Ravi&gt;" in html.get_content()
    assert "<Ravi>" not in html.get_content()


def test_send_without_credentials_skips_login(monkeypatch: pytest.MonkeyPatch) -> None:
    smtp = MagicMock()
    monkeypatch.setattr(smtplib, "SMTP", smtp)
    monkeypatch.setattr(get_settings(), "smtp_user", "")

    email_service.send_message(_message())

    connection = smtp.return_value.__enter__.return_value
    connection.login.assert_not_called()
    connection.send_message.assert_called_once()


def test_send_with_credentials_uses_tls(monkeypatch: pytest.MonkeyPatch) -> None:
    smtp = MagicMock()
    monkeypatch.setattr(smtplib, "SMTP", smtp)
    monkeypatch.setattr(get_settings(), "smtp_user", "mailer")

    email_service.send_message(_message())

    connection = smtp.return_value.__enter__.return_value
    connection.starttls.assert_called_once()
    context = connection.starttls.call_args.kwargs["context"]
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.check_hostname is True
    connection.login.assert_called_once()


def test_task_retries_on_mail_failures_with_backoff() -> None:
    task = tasks.send_password_reset_email

    assert smtplib.SMTPException in task.autoretry_for
    assert OSError in task.autoretry_for
    assert task.retry_backoff is True
    assert task.max_retries == 5


def test_queueing_failure_does_not_raise(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        tasks.send_password_reset_email, "apply_async", MagicMock(side_effect=ConnectionError)
    )

    tasks.enqueue_password_reset_email(1)
