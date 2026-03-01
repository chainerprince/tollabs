"""
Modal function: Sandboxed notebook cell execution.

Usage (remote):
    import modal
    f = modal.Function.from_name("tollabs-compute", "run_notebook_cell")
    result = f.remote(code="print('hello')", session_state={})
"""

from modal_engine.app import app, image


@app.function(image=image, timeout=60)
def run_notebook_cell(code: str, session_state: dict | None = None) -> dict:
    """
    Execute a code cell in a Modal container.
    Accepts prior session_state (variable namespace) and returns updated state.
    """
    import io
    import sys
    import traceback

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
            exec(code, namespace)
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
