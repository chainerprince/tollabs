"""
Compute router — notebook-style code execution + file management + projects.
"""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel

from app.routers.auth import get_current_user
from app.models.user import User
from app.services import compute_service
from app.services import file_service
from app.services import project_service

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


# ── Projects ──────────────────────────────────────────────────────

class CreateProjectRequest(BaseModel):
    model_id: str
    model_name: str
    task: str
    tags: list[str] = []
    parameter_count: str = ""
    description: str = ""


class CreateProjectFromCodeRequest(BaseModel):
    name: str
    code: str
    description: str = ""


@router.post("/projects")
def create_project(body: CreateProjectRequest, user: User = Depends(get_current_user)):
    """Create a new research project from a HuggingFace model."""
    project = project_service.create_project(
        user_id=user.id,
        model_id=body.model_id,
        model_name=body.model_name,
        task=body.task,
        tags=body.tags,
        parameter_count=body.parameter_count,
        description=body.description,
    )
    return project


@router.post("/projects/from-code")
def create_project_from_code(body: CreateProjectFromCodeRequest, user: User = Depends(get_current_user)):
    """Create a project from raw strategy code (Studio → Editor)."""
    project = project_service.create_project_from_code(
        user_id=user.id,
        name=body.name,
        code=body.code,
        description=body.description,
    )
    return project


@router.get("/projects")
def list_projects(user: User = Depends(get_current_user)):
    """List all research projects."""
    return project_service.list_projects(user.id)


@router.get("/projects/{slug}")
def get_project(slug: str, user: User = Depends(get_current_user)):
    """Get project details with files and cells."""
    project = project_service.get_project(user.id, slug)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/projects/{slug}/files/{filename}")
def get_project_file(slug: str, filename: str, user: User = Depends(get_current_user)):
    """Read a file from a project."""
    content = project_service.get_project_file(user.id, slug, filename)
    if content is None:
        raise HTTPException(status_code=404, detail="File not found")
    return {"filename": filename, "content": content}


class UpdateGpuRequest(BaseModel):
    gpu_tier: str


@router.put("/projects/{slug}/gpu")
def update_project_gpu(slug: str, body: UpdateGpuRequest, user: User = Depends(get_current_user)):
    """Update the selected GPU tier for a project."""
    ok = project_service.update_gpu_tier(user.id, slug, body.gpu_tier)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "GPU tier updated", "gpu_tier": body.gpu_tier}


class SaveCellsRequest(BaseModel):
    cells: list[dict]


@router.put("/projects/{slug}/cells")
def save_project_cells(slug: str, body: SaveCellsRequest, user: User = Depends(get_current_user)):
    """Save updated notebook cells."""
    ok = project_service.save_project_cells(user.id, slug, body.cells)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Cells saved"}


# ── GPU Tiers ─────────────────────────────────────────────────────

@router.get("/gpu-tiers")
def list_gpu_tiers(user: User = Depends(get_current_user)):
    """List available GPU tiers and pricing."""
    return project_service.GPU_TIERS
