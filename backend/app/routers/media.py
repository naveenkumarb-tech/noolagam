from fastapi import APIRouter
from fastapi.responses import FileResponse
from starlette.exceptions import HTTPException

from app.services import cover_files

router = APIRouter(prefix="/media", tags=["books"])

ONE_YEAR = 365 * 24 * 60 * 60


@router.get("/covers/{name}", response_class=FileResponse)
def get_cover(name: str) -> FileResponse:
    path = cover_files.path_for(name)
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    # A new photo always gets a new name, so a saved copy of this one can never go out of date.
    return FileResponse(
        path,
        media_type="image/jpeg",
        headers={
            "Cache-Control": f"private, max-age={ONE_YEAR}, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    )
