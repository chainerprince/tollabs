"""
File storage service — manages user-uploaded data files (CSV, JSON, etc.)
persisted to disk, like Colab's file system.
"""

import os
import json
import shutil
from pathlib import Path
from datetime import datetime, timezone

# Base directory for user workspaces
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent / "workspaces"


def _user_dir(user_id: int) -> Path:
    """Get or create a user's workspace directory."""
    d = WORKSPACE_ROOT / str(user_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def list_files(user_id: int) -> list[dict]:
    """List all files in a user's workspace."""
    d = _user_dir(user_id)
    files = []
    for f in sorted(d.iterdir()):
        if f.is_file() and not f.name.startswith("."):
            stat = f.stat()
            files.append({
                "name": f.name,
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                "type": _file_type(f.name),
            })
    return files


def save_file(user_id: int, filename: str, content: bytes) -> dict:
    """Save an uploaded file to the user's workspace."""
    d = _user_dir(user_id)
    # Sanitize filename
    safe_name = Path(filename).name
    filepath = d / safe_name
    filepath.write_bytes(content)
    stat = filepath.stat()
    return {
        "name": safe_name,
        "size": stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        "type": _file_type(safe_name),
    }


def delete_file(user_id: int, filename: str) -> bool:
    """Delete a file from the user's workspace."""
    filepath = _user_dir(user_id) / Path(filename).name
    if filepath.exists():
        filepath.unlink()
        return True
    return False


def read_file(user_id: int, filename: str) -> str | None:
    """Read file contents as text (for preview)."""
    filepath = _user_dir(user_id) / Path(filename).name
    if not filepath.exists():
        return None
    try:
        return filepath.read_text(errors="replace")[:50_000]  # Cap at 50KB for preview
    except Exception:
        return None


def get_file_path(user_id: int, filename: str) -> str | None:
    """Return absolute path to a user file (for use in exec context)."""
    filepath = _user_dir(user_id) / Path(filename).name
    return str(filepath) if filepath.exists() else None


def import_from_url(user_id: int, url: str, filename: str | None = None) -> dict:
    """Download a file from a URL and save it to the user's workspace."""
    import urllib.request
    import urllib.error

    if not filename:
        # Derive filename from URL
        from urllib.parse import urlparse
        parsed = urlparse(url)
        filename = Path(parsed.path).name or "downloaded_data"
        if not any(filename.endswith(ext) for ext in [".csv", ".json", ".txt", ".parquet", ".xlsx"]):
            filename += ".csv"

    d = _user_dir(user_id)
    filepath = d / Path(filename).name

    try:
        urllib.request.urlretrieve(url, str(filepath))
    except urllib.error.URLError as e:
        raise ValueError(f"Failed to download from URL: {e}")

    stat = filepath.stat()
    return {
        "name": filepath.name,
        "size": stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        "type": _file_type(filepath.name),
    }


def _file_type(name: str) -> str:
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    mapping = {
        "csv": "csv", "json": "json", "txt": "text",
        "py": "python", "ipynb": "notebook",
        "parquet": "parquet", "xlsx": "excel", "xls": "excel",
        "yaml": "yaml", "yml": "yaml", "toml": "toml",
    }
    return mapping.get(ext, "other")
