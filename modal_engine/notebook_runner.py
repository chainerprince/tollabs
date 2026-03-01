"""
Modal function: Sandboxed notebook cell execution on GPU containers.

Usage (remote):
    import modal
    f = modal.Function.from_name("tollabs-compute", "run_notebook_cell")
    result = f.remote(code="print('hello')", session_state={})
"""

from modal_engine.app import app, image


@app.function(image=image, timeout=120)
def run_notebook_cell(code: str, session_state: dict | None = None) -> dict:
    """
    Execute a code cell in a Modal container.
    Accepts prior session_state (variable namespace) and returns updated state.
    Supports !pip install and !shell commands.
    """
    import io
    import re
    import subprocess
    import sys
    import traceback

    stripped = code.strip()

    # ── Handle pip install ────────────────────────────────────
    if re.match(r"^\s*[!%]?pip\s+install\s+", stripped):
        cmd = stripped.lstrip("!%")
        parts = cmd.split()
        try:
            result = subprocess.run(
                [sys.executable, "-m"] + parts,
                capture_output=True, text=True, timeout=120,
            )
            return {
                "stdout": result.stdout or ("Packages installed successfully." if result.returncode == 0 else ""),
                "stderr": result.stderr,
                "result": None,
                "error": None if result.returncode == 0 else result.stderr,
                "session_state": session_state or {},
            }
        except Exception as e:
            return {
                "stdout": "", "stderr": "", "result": None,
                "error": str(e), "session_state": session_state or {},
            }

    # ── Handle shell commands ─────────────────────────────────
    if stripped.startswith("!") and not stripped.startswith("!="):
        cmd = stripped[1:]
        try:
            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True, timeout=30,
            )
            return {
                "stdout": result.stdout, "stderr": result.stderr,
                "result": None,
                "error": None if result.returncode == 0 else result.stderr,
                "session_state": session_state or {},
            }
        except Exception as e:
            return {
                "stdout": "", "stderr": "", "result": None,
                "error": str(e), "session_state": session_state or {},
            }

    # ── Normal Python execution ───────────────────────────────
    namespace = dict(session_state) if session_state else {}
    namespace["__builtins__"] = __builtins__

    old_stdout, old_stderr = sys.stdout, sys.stderr
    cap_out = io.StringIO()
    cap_err = io.StringIO()
    sys.stdout = cap_out
    sys.stderr = cap_err

    result = None
    error = None

    try:
        try:
            compiled = compile(code, "<cell>", "eval")
            result = repr(eval(compiled, namespace))
        except SyntaxError:
            compiled = compile(code, "<cell>", "exec")
            exec(compiled, namespace)
    except Exception:
        error = traceback.format_exc()
    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr

    # Strip non-serialisable items from namespace
    clean_state = {}
    for k, v in namespace.items():
        if k.startswith("_"):
            continue
        try:
            import json
            json.dumps(v)
            clean_state[k] = v
        except (TypeError, ValueError):
            clean_state[k] = repr(v)

    return {
        "stdout": cap_out.getvalue(),
        "stderr": cap_err.getvalue(),
        "result": result,
        "error": error,
        "session_state": clean_state,
    }
