"""
Mock Modal — in-process code execution that mimics Modal's sandboxed containers.
Maintains per-session state so the notebook experience works across cells.
Thread-safe, supports pip install, and scopes to user workspaces.
"""

import io
import os
import re
import subprocess
import sys
import traceback
import threading
import uuid
from pathlib import Path
from typing import Any


WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent / "workspaces"

# Thread lock for global state (stdout, stderr, cwd)
_exec_lock = threading.Lock()

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


# ── Magic / shell commands ────────────────────────────────────────

_PIP_RE = re.compile(r"^\s*(?:!pip|%pip|pip)\s+install\s+(.+)", re.MULTILINE)


def _handle_pip_install(line: str) -> tuple[str, str, str | None]:
    """Run a pip install command. Returns (stdout, stderr, error)."""
    # Extract packages from the command
    cmd = line.strip()
    if cmd.startswith("!") or cmd.startswith("%"):
        cmd = cmd[1:]
    parts = cmd.split()  # ["pip", "install", "pkg1", "pkg2", ...]
    try:
        result = subprocess.run(
            [sys.executable, "-m"] + parts,
            capture_output=True, text=True, timeout=120,
        )
        stdout = result.stdout
        stderr = result.stderr
        error = None if result.returncode == 0 else (stderr or f"pip exited with code {result.returncode}")
        return stdout, stderr, error
    except subprocess.TimeoutExpired:
        return "", "", "Package installation timed out (120s limit)"
    except Exception as e:
        return "", "", f"pip install error: {e}"


def _handle_shell_command(line: str) -> tuple[str, str, str | None]:
    """Run a shell command prefixed with !. Returns (stdout, stderr, error)."""
    cmd = line.strip()[1:]  # strip the leading !
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=30,
        )
        return result.stdout, result.stderr, None if result.returncode == 0 else result.stderr
    except subprocess.TimeoutExpired:
        return "", "", "Shell command timed out (30s limit)"
    except Exception as e:
        return "", "", str(e)


# ── Magic-line detection ──────────────────────────────────────────

_MAGIC_RE = re.compile(r"^\s*[!%]")


def _is_magic_line(line: str) -> bool:
    """Return True if a line is a shell (!) or magic (%) command."""
    s = line.strip()
    if not s:
        return False
    if s.startswith("!") and not s.startswith("!="):
        return True
    if s.startswith("%"):
        return True
    return False


def _split_magic_and_code(code: str) -> tuple[list[str], str]:
    """
    Split a cell into magic/shell lines and pure Python code.
    Magic lines (e.g. !pip install ..., !ls, %pip install ...) are
    extracted so the remaining code can be compiled normally.
    """
    magic_lines: list[str] = []
    python_lines: list[str] = []

    for line in code.splitlines():
        if _is_magic_line(line):
            magic_lines.append(line.strip())
        else:
            python_lines.append(line)

    return magic_lines, "\n".join(python_lines)


# ── Cell execution ────────────────────────────────────────────────

def execute_cell(code: str, session_id: str | None = None, user_id: int | None = None) -> dict[str, Any]:
    """
    Execute a Python code string in a persisted namespace.
    The working directory is set to the user's workspace so
    pd.read_csv("data.csv") just works after upload.

    Supports (anywhere in the cell, even mixed with Python):
      - !pip install <packages> / %pip install <packages>
      - !<shell command>
      - Normal Python code
    """
    session_id, namespace = _get_or_create_session(session_id, user_id)
    workspace = namespace.get("__workspace__", ".")

    # ── Separate magic lines from Python code ─────────────────
    magic_lines, python_code = _split_magic_and_code(code)

    all_stdout: list[str] = []
    all_stderr: list[str] = []
    first_error: str | None = None

    # ── Run magic / shell lines first ─────────────────────────
    for line in magic_lines:
        if re.match(r"[!%]?pip\s+install\s+", line):
            stdout, stderr, error = _handle_pip_install(line)
        elif line.startswith("!"):
            stdout, stderr, error = _handle_shell_command(line)
        else:
            # Unknown magic — skip
            continue

        if stdout:
            all_stdout.append(stdout)
        if stderr:
            all_stderr.append(stderr)
        if error and not first_error:
            first_error = error

    # If we only had magic lines (no Python code left), return early
    if not python_code.strip():
        return {
            "session_id": session_id,
            "stdout": "\n".join(all_stdout) or ("Done." if not first_error else ""),
            "stderr": "\n".join(all_stderr),
            "result": None,
            "error": first_error,
            "variables": [k for k in namespace if not k.startswith("_")],
        }

    # ── Normal Python execution (thread-safe) ─────────────────
    with _exec_lock:
        original_cwd = os.getcwd()
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
                compiled = compile(python_code, "<cell>", "eval")
                result = eval(compiled, namespace)
                result = repr(result)
            except SyntaxError:
                # Not a single expression — execute as statements
                compiled = compile(python_code, "<cell>", "exec")
                exec(compiled, namespace)
        except Exception:
            error = traceback.format_exc()
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr
            try:
                os.chdir(original_cwd)
            except Exception:
                pass

    # Merge magic output with Python output
    py_stdout = captured_out.getvalue()
    py_stderr = captured_err.getvalue()
    if py_stdout:
        all_stdout.append(py_stdout)
    if py_stderr:
        all_stderr.append(py_stderr)

    # Collect user-visible variable names (skip dunder)
    user_vars = [k for k in namespace if not k.startswith("_")]

    return {
        "session_id": session_id,
        "stdout": "\n".join(all_stdout),
        "stderr": "\n".join(all_stderr),
        "result": result,
        "error": first_error or error,
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
