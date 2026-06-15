"""Static completion / lint worker for WoT Mod Studio.

Runs under CPython 2.7 with jedi==0.17.2 (the last py2-capable release) so it can
parse and resolve the decompiled WoT source (print statements, `except X, e`).
Speaks newline-delimited JSON over stdio; the Rust backend supervises it.

Ops:
    {"id","op":"configure","root":"...","sys_path":[...]}  -> {"ok":true}
    {"id","op":"complete","code":"...","line":1,"column":9} -> {"candidates":[...]}
    {"id","op":"infer","code":"...","line":1,"column":3}    -> {"signatures":[...],"doc":...}
    {"id","op":"lint","code":"...","path":"<repl>"}         -> {"diagnostics":[...]}
    {"id","op":"ping"}                                      -> {"pong":true}

jedi is optional: without it, completion/infer report unavailable but lint still
works (authoritative py2.7 compile() + optional pyflakes), so the protocol and
the Rust supervisor can be exercised before jedi is installed.
"""

import sys
import json

try:
    import jedi
    _HAS_JEDI = True
except ImportError:
    jedi = None
    _HAS_JEDI = False

_PROJECT = None
_ENV = None


def _short(text, limit=400):
    if not text:
        return ""
    return text if len(text) <= limit else text[:limit] + "..."


def do_configure(req):
    global _PROJECT, _ENV
    if not _HAS_JEDI:
        return {"ok": False, "error": "jedi-unavailable"}
    try:
        # Force the py2.7 grammar by binding to the running interpreter.
        _ENV = jedi.create_environment(sys.executable, safe=False)
    except Exception:
        _ENV = None
    _PROJECT = jedi.Project(
        req.get("root", "."),
        added_sys_path=req.get("sys_path", []),
    )
    return {"ok": True, "jedi": jedi.__version__}


def _script(req):
    return jedi.Script(
        code=req.get("code", ""),
        path=req.get("path") or None,
        project=_PROJECT,
        environment=_ENV,
    )


def do_complete(req):
    if not _HAS_JEDI:
        return {"candidates": [], "error": "jedi-unavailable"}
    script = _script(req)
    comps = script.complete(req.get("line", 1), req.get("column", 0))
    out = []
    for c in comps[:200]:
        signature = ""
        try:
            first = (c.docstring(raw=False) or "").split("\n", 1)[0].strip()
            if first.startswith(c.name + "("):
                signature = first[len(c.name):]  # "(args) -> ret"
        except Exception:
            pass
        out.append({
            "name": c.name,
            "kind": c.type,
            "complete": c.complete,
            "signature": signature,
            "doc": _short(c.docstring(raw=True)),
            "source": "static",
        })
    return {"candidates": out}


def do_infer(req):
    if not _HAS_JEDI:
        return {"signatures": [], "doc": None, "error": "jedi-unavailable"}
    script = _script(req)
    line, column = req.get("line", 1), req.get("column", 0)
    signatures = [s.to_string() for s in script.get_signatures(line, column)]
    doc = None
    for name in script.help(line, column):
        doc = name.docstring(raw=True)
        if doc:
            break
    return {"signatures": signatures, "doc": _short(doc, 2000)}


class _FlakeCapture(object):
    def __init__(self):
        self.items = []

    def unexpectedError(self, filename, msg):
        self.items.append({"line": 1, "col": 1, "severity": "error", "message": str(msg)})

    def syntaxError(self, filename, msg, lineno, offset, text):
        self.items.append({
            "line": lineno or 1, "col": offset or 1,
            "severity": "error", "message": msg,
        })

    def flake(self, message):
        try:
            text = message.message % message.message_args
        except Exception:
            text = str(getattr(message, "message", "warning"))
        self.items.append({
            "line": getattr(message, "lineno", 1),
            "col": getattr(message, "col", 0) + 1,
            "severity": "warning",
            "message": text,
        })


def _pyflakes(code, path):
    try:
        from pyflakes.api import check
    except ImportError:
        return []
    reporter = _FlakeCapture()
    try:
        check(code, path, reporter)
    except Exception:
        return []
    return reporter.items


def do_lint(req):
    code = req.get("code", "")
    path = req.get("path", "<repl>")
    diagnostics = []
    try:
        compile(code, path, "exec")
    except SyntaxError as exc:
        diagnostics.append({
            "line": exc.lineno or 1,
            "col": exc.offset or 1,
            "severity": "error",
            "message": exc.msg,
        })
        return {"diagnostics": diagnostics}
    diagnostics.extend(_pyflakes(code, path))
    return {"diagnostics": diagnostics}


_OPS = {
    "configure": do_configure,
    "complete": do_complete,
    "infer": do_infer,
    "lint": do_lint,
    "ping": lambda req: {"pong": True, "jedi": _HAS_JEDI},
}


def main():
    for raw in iter(sys.stdin.readline, ""):
        raw = raw.strip()
        if not raw:
            continue
        try:
            req = json.loads(raw)
        except ValueError:
            continue
        handler = _OPS.get(req.get("op"))
        if handler is None:
            resp = {"error": "unknown op: %s" % req.get("op")}
        else:
            try:
                resp = handler(req)
            except Exception:
                import traceback
                resp = {"error": traceback.format_exc()}
        resp["id"] = req.get("id")
        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
