"""
Compute service — proxies code execution to Modal (or mock).
"""

from app.config import settings
from app.mocks.mock_modal import execute_cell as mock_execute_cell, reset_session as mock_reset


def run_cell(code: str, session_id: str | None = None, user_id: int | None = None) -> dict:
    """
    Execute a code cell.
    In mock mode: uses in-process exec().
    In production: would call Modal function remotely.
    """
    if settings.USE_MOCK_MODAL:
        return mock_execute_cell(code, session_id, user_id=user_id)

    raise NotImplementedError("Real Modal integration not enabled. Set USE_MOCK_MODAL=True.")


def reset_session(user_id: int) -> None:
    """Clear a user's compute session."""
    mock_reset(user_id)
