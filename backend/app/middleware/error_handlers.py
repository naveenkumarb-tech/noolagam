import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.core.errors import AppError
from app.core.request_context import request_id_var
from app.middleware.request_id import REQUEST_ID_HEADER

logger = logging.getLogger(__name__)


def error_response(
    status_code: int,
    code: str,
    message: str,
    headers: dict[str, str] | None = None,
    details: list[dict[str, str]] | None = None,
) -> JSONResponse:
    request_id = request_id_var.get()
    error: dict[str, object] = {"code": code, "message": message, "request_id": request_id}
    if details:
        error["details"] = details
    response_headers = dict(headers or {})
    # Unhandled errors are answered outside the request ID middleware, so the header is set here as well.
    if request_id:
        response_headers[REQUEST_ID_HEADER] = request_id
    return JSONResponse(status_code=status_code, content={"error": error}, headers=response_headers)


async def _handle_app_error(_: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, AppError)  # noqa: S101
    return error_response(error.status_code, error.code, error.message, error.headers)


async def _handle_validation_error(_: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, RequestValidationError)  # noqa: S101
    # Only the field and message are returned: the raw errors include the submitted value, such as a password.
    details = [
        {
            "field": ".".join(str(part) for part in item["loc"] if part != "body"),
            "message": item["msg"].removeprefix("Value error, "),
        }
        for item in error.errors()
    ]
    return error_response(422, "VALIDATION_ERROR", "Please check the submitted values", details=details)


async def _handle_http_exception(_: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, HTTPException)  # noqa: S101
    return error_response(
        error.status_code,
        f"HTTP_{error.status_code}",
        str(error.detail),
        dict(error.headers) if error.headers else None,
    )


async def _handle_unexpected_error(_: Request, error: Exception) -> JSONResponse:
    logger.error("Unhandled error", exc_info=error)
    return error_response(500, "INTERNAL_ERROR", "Something went wrong")


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _handle_app_error)
    app.add_exception_handler(RequestValidationError, _handle_validation_error)
    app.add_exception_handler(HTTPException, _handle_http_exception)
    app.add_exception_handler(Exception, _handle_unexpected_error)
