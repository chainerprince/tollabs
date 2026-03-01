"""
Mock Modal — in-process code execution that mimics Modal's sandboxed containers.
Maintains per-session state so the notebook experience works across cells.
The working directory is set to the user's workspace so file operations just work.
"""

import io
import os
import sys
import traceback
import uuid
from pathlib import Path
from typing import Any


WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent / "workspaces"

# ── Session store (in-memory, keyed by session_id) ────────────────
_sessions: dict[str, dict[str, Any]] = {}
# Map user_id → session_id for stable sessions
_user_sessions: dict[int, str] = {}


def _get_or_create_session(session_id: str | None, user_id: int | None = None) -> tuple[str, dict[str, Any]]:
    """Return (session_id, namespace) — creates if missing."""
    # If user_id provided and no explicit session, reuse their stable session
    if session_id is None and user_id is not None:
        session_id = _user_sessions.get(user_id)

    if session_id is None:
        session_id = uuid.uuid4().hex[:12]

    if user_id is not None:
        _user_sessions[user_id] = session_id

    if session_id not in _sessions:
        # Set up workspace directory for the user
        workspace = WORKSPACE_ROOT / str(user_id or "anonymous")
        workspace.mkdir(parents=True, exist_ok=True)

        _sessions[session_id] = {
            "__builtins__": __builtins__,
            "__session_id__": session_id,
            "__workspace__": str(workspace),
        }

    return session_id, _sessions[session_id]


def execute_cell(code: str, session_id: str | None = None, user_id: int | None = None) -> dict[str, Any]:
    """
    Execute a Python code string in a persisted namespace.
    The working directory is set to the user's workspace so
    pd.read_csv("data.csv") just works after upload.
    """
    session_id, namespace = _get_or_create_session(session_id, user_id)
    workspace = namespace.get("__workspace__", ".")

    # Save and change working directory to the user's workspace
    original_cwd = os.getcwd()

    # Capture stdout / stderr
    old_stdout, old_stderr = sys.stdout, sys.stderr
    captured_out = io.StringIO()
    captured_err = io.StringIO()
    sys.stdout = captured_out
    sys.stderr = captured_err

    result = None
    error = None

    try:
        os.chdir(workspace)

        # Try to compile as an expression first (so we get a return value)
        try:
            compiled = compile(code, "<cell>", "eval")
            result = eval(compiled, namespace)
            result = repr(result)
        except SyntaxError:
            # Not a single expression — execute as statements
            exec(code, namespace)
    except Exception:
        error = traceback.format_exc()
    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        try:
            os.chdir(original_cwd)
        except Exception:
            pass

    # Collect user-visible variable names (skip dunder)
    user_vars = [k for k in namespace if not k.startswith("_")]

    return {
        "session_id": session_id,
        "stdout": captured_out.getvalue(),
        "stderr": captured_err.getvalue(),
        "result": result,
        "error": error,
        "variables": user_vars,
    }


def reset_session(user_id: int) -> None:
    """Clear a user's compute session."""
    sid = _user_sessions.pop(user_id, None)
    if sid and sid in _sessions:
        del _sessions[sid]


def list_sessions() -> list[str]:
    return list(_sessions.keys())


def delete_session(session_id: str) -> bool:
    return _sessions.pop(session_id, None) is not None
