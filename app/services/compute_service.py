"""
Compute service — proxies code execution to Modal (or mock).
"""

import os
import uuid
from typing import Any

from app.config import settings
from app.mocks.mock_modal import execute_cell as mock_execute_cell, reset_session as mock_reset

# ── Session state store for Modal execution ───────────────────────
_modal_sessions: dict[str, dict[str, Any]] = {}
_modal_user_sessions: dict[int, str] = {}


def run_cell(code: str, session_id: str | None = None, user_id: int | None = None) -> dict:
    """
    Execute a code cell.
    In mock mode: uses in-process exec() (fast, local).
    In production: dispatches to Modal GPU containers.
    """
    if settings.USE_MOCK_MODAL:
        return mock_execute_cell(code, session_id, user_id=user_id)

    return _run_modal_cell(code, session_id, user_id)


def _run_modal_cell(code: str, session_id: str | None, user_id: int | None) -> dict:
    """Execute a code cell on Modal.com (remote GPU container)."""
    import modal

    # Resolve / create session
    if session_id is None and user_id is not None:
        session_id = _modal_user_sessions.get(user_id)
    if session_id is None:
        session_id = uuid.uuid4().hex[:12]
    if user_id is not None:
        _modal_user_sessions[user_id] = session_id

    # Get prior session state (variables from previous cells)
    session_state = _modal_sessions.get(session_id, {})

    # Set Modal credentials for this user
    try:
        from app.services.modal_client import _set_modal_env
        _set_modal_env(user_id)
    except Exception:
        # Fall back to global creds from .env
        if settings.MODAL_TOKEN_ID:
            os.environ["MODAL_TOKEN_ID"] = settings.MODAL_TOKEN_ID
            os.environ["MODAL_TOKEN_SECRET"] = settings.MODAL_TOKEN_SECRET

    # Call the remote Modal function
    try:
        fn = modal.Function.from_name(settings.MODAL_APP_NAME, "run_notebook_cell")
        result = fn.remote(code=code, session_state=session_state)

        # Persist session state for next cell
        _modal_sessions[session_id] = result.get("session_state", {})

        return {
            "session_id": session_id,
            "stdout": result.get("stdout", ""),
            "stderr": result.get("stderr", ""),
            "result": result.get("result"),
            "error": result.get("error"),
            "variables": list(result.get("session_state", {}).keys()),
        }
    except modal.exception.NotFoundError:
        return {
            "session_id": session_id,
            "stdout": "",
            "stderr": "",
            "result": None,
            "error": (
                "Modal app not deployed. Run:\n"
                "  modal deploy modal_engine/app.py\n\n"
                "Or set USE_MOCK_MODAL=True in .env for local execution."
            ),
            "variables": [],
        }
    except Exception as e:
        return {
            "session_id": session_id,
            "stdout": "",
            "stderr": "",
            "result": None,
            "error": f"Modal execution error: {e}",
            "variables": [],
        }


def reset_session(user_id: int) -> None:
    """Clear a user's compute session (both mock and Modal)."""
    mock_reset(user_id)
    # Also clear Modal session state
    sid = _modal_user_sessions.pop(user_id, None)
    if sid and sid in _modal_sessions:
        del _modal_sessions[sid]
