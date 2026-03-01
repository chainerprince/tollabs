"""
Compute router — notebook-style code execution + file management.
"""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel

from app.routers.auth import get_current_user
from app.models.user import User
from app.services import compute_service
from app.services import file_service

router = APIRouter(prefix="/compute", tags=["Compute"])


# ── Code execution ────────────────────────────────────────────────

class RunCellRequest(BaseModel):
    code: str
    session_id: str | None = None


@router.post("/run-cell")
def run_cell(body: RunCellRequest, user: User = Depends(get_current_user)):
    """Execute a Python code cell with access to the user's workspace files."""
    result = compute_service.run_cell(body.code, body.session_id, user_id=user.id)
    return result


@router.post("/reset-session")
def reset_session(user: User = Depends(get_current_user)):
    """Reset the compute session (clear all variables)."""
    compute_service.reset_session(user.id)
    return {"message": "Session reset"}


# ── File management ───────────────────────────────────────────────

@router.get("/files")
def list_files(user: User = Depends(get_current_user)):
    """List all files in the user's workspace."""
    return {"files": file_service.list_files(user.id)}


@router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """Upload a CSV, JSON, or other data file."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:  # 50 MB limit
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")
    result = file_service.save_file(user.id, file.filename, content)
    return result


class ImportUrlRequest(BaseModel):
    url: str
    filename: str | None = None


@router.post("/files/import-url")
def import_from_url(body: ImportUrlRequest, user: User = Depends(get_current_user)):
    """Import a data file from a URL."""
    try:
        result = file_service.import_from_url(user.id, body.url, body.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@router.get("/files/{filename}")
def preview_file(filename: str, user: User = Depends(get_current_user)):
    """Preview the first portion of a file."""
    content = file_service.read_file(user.id, filename)
    if content is None:
        raise HTTPException(status_code=404, detail="File not found")
    return {"filename": filename, "content": content[:5000], "truncated": len(content) > 5000}


@router.delete("/files/{filename}")
def delete_file(filename: str, user: User = Depends(get_current_user)):
    """Delete a file from the workspace."""
    ok = file_service.delete_file(user.id, filename)
    if not ok:
        raise HTTPException(status_code=404, detail="File not found")
    return {"message": f"Deleted {filename}"}
