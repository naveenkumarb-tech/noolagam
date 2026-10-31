import io
import logging
import os
import re
import uuid
import warnings
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import get_settings
from app.core.errors import InvalidImageError

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_PIXELS = 100_000_000
MAX_DIMENSION = 1200
JPEG_QUALITY = 85
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

COVER_URL_PREFIX = "/api/v1/media/covers/"
COVER_NAME = re.compile(r"[0-9a-f]{32}\.jpg")


def process(data: bytes) -> bytes:
    """Rebuilds the upload as a small JPEG. The file's type is judged from its content, not its name.

    Saving a new image drops everything but the pixels, including a phone photo's GPS location.
    """
    try:
        with warnings.catch_warnings():
            # An image with an enormous pixel count can use up the server's memory, so it's refused unread.
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                if image.format not in ALLOWED_FORMATS:
                    raise InvalidImageError()
                if image.width * image.height > MAX_PIXELS:
                    raise InvalidImageError()
                # Phones store the rotation separately, and it would be lost along with the other metadata.
                upright = ImageOps.exif_transpose(image).convert("RGB")
                upright.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
                output = io.BytesIO()
                upright.save(output, format="JPEG", quality=JPEG_QUALITY, optimize=True)
                return output.getvalue()
    except InvalidImageError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError,
            Image.DecompressionBombWarning) as error:  # fmt: skip
        raise InvalidImageError() from error


def _directory() -> Path:
    directory = Path(get_settings().media_dir) / "covers"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def path_for(name: str) -> Path | None:
    """The only way from a name to a path: anything not shaped like a saved cover, such as ../, gets none."""
    return _directory() / name if COVER_NAME.fullmatch(name) else None


def save(photo: bytes) -> str:
    """Stores a processed photo under a random name and returns its URL.

    Images can't send a login token, so the unguessable name is what keeps a photo private.
    """
    name = f"{uuid.uuid4().hex}.jpg"
    target = _directory() / name
    temporary = target.with_suffix(".tmp")
    temporary.write_bytes(photo)
    # Renamed last, so that a half-written file is never served.
    os.replace(temporary, target)
    return f"{COVER_URL_PREFIX}{name}"


def remove(url: str | None) -> None:
    """Never raises: a leftover file must not fail the request. Covers from Open Library have no file."""
    if not url or not url.startswith(COVER_URL_PREFIX):
        return
    path = path_for(url.removeprefix(COVER_URL_PREFIX))
    if path is None:
        return
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logger.exception("Could not delete cover file %s", path.name)
