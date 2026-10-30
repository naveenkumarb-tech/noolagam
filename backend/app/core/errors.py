class AppError(Exception):
    status_code = 400
    code = "BAD_REQUEST"
    message = "Bad request"

    def __init__(self, headers: dict[str, str] | None = None) -> None:
        super().__init__(self.message)
        self.headers = headers


class EmailAlreadyRegisteredError(AppError):
    status_code = 409
    code = "EMAIL_ALREADY_REGISTERED"
    message = "An account with this email already exists"


class InvalidCredentialsError(AppError):
    status_code = 401
    code = "INVALID_CREDENTIALS"
    message = "Incorrect email or password"


class InvalidCurrentPasswordError(AppError):
    # Not 401, which means the session has expired and makes the app try to renew it.
    status_code = 400
    code = "INVALID_CURRENT_PASSWORD"
    message = "Your current password is not correct"


class NewPasswordSameError(AppError):
    status_code = 422
    code = "NEW_PASSWORD_SAME"
    message = "Choose a password different from your current one"


class InvalidRefreshTokenError(AppError):
    status_code = 401
    code = "INVALID_REFRESH_TOKEN"
    message = "Session expired. Please log in again"


class InvalidResetTokenError(AppError):
    status_code = 400
    code = "INVALID_RESET_TOKEN"
    message = "This reset link has expired or has already been used"


class InvalidVerificationTokenError(AppError):
    status_code = 400
    code = "INVALID_VERIFICATION_TOKEN"
    message = "This verification link has expired or has already been used"


class NotAuthenticatedError(AppError):
    status_code = 401
    code = "NOT_AUTHENTICATED"
    message = "Please log in"

    def __init__(self) -> None:
        super().__init__(headers={"WWW-Authenticate": "Bearer"})


class BookNotFoundError(AppError):
    status_code = 404
    code = "BOOK_NOT_FOUND"
    message = "Book not found"


class InvalidStatusTransitionError(AppError):
    status_code = 409
    code = "INVALID_STATUS_TRANSITION"
    message = "This action is not available for the book's current status"


class PageExceedsTotalError(AppError):
    status_code = 422
    code = "PAGE_EXCEEDS_TOTAL"
    message = "The current page cannot be higher than the book's page count"


class RatingNotAllowedError(AppError):
    status_code = 422
    code = "RATING_NOT_ALLOWED"
    message = "Only finished books can have a rating"


class InvalidBookDateError(AppError):
    status_code = 422
    code = "INVALID_BOOK_DATE"
    message = "These reading dates are not valid for this book"


class BookLookupNotFoundError(AppError):
    status_code = 404
    code = "BOOK_LOOKUP_NOT_FOUND"
    message = "No book was found for this ISBN"


class BookLookupUnavailableError(AppError):
    status_code = 503
    code = "BOOK_LOOKUP_UNAVAILABLE"
    message = "Book lookup is not available right now"


class RateLimitedError(AppError):
    status_code = 429
    code = "RATE_LIMITED"
    message = "Too many attempts. Please try again later"

    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__(headers={"Retry-After": str(retry_after_seconds)})
