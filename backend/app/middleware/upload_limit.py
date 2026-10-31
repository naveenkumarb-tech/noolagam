from starlette.datastructures import Headers
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.errors import ImageTooLargeError
from app.middleware.error_handlers import error_response
from app.services.cover_files import MAX_UPLOAD_BYTES

# Room for the form's own boundaries and headers around the largest allowed photo.
MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024


class RequestSizeLimitMiddleware:
    """Refuses oversized requests before any of the body is read.

    FastAPI saves a whole form to disk before it runs the route's login and size checks, so without
    this anyone could fill the disk. Photos are the only large thing this API accepts, hence the message.
    A declared length can be trusted because the server never reads past it, which leaves chunked
    requests, with no declared length, to refuse outright. Browsers and the app don't send them.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            headers = Headers(scope=scope)
            length = headers.get("content-length", "0")
            if "transfer-encoding" in headers or (length.isdigit() and int(length) > MAX_REQUEST_BYTES):
                error = ImageTooLargeError()
                response = error_response(error.status_code, error.code, error.message)
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)
