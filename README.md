# Fuflo WoT REPL

A desktop IDE for World of Tanks Python mod development: a **live REPL into the
running game client**, with code completion and linting that no existing tool
(notably PJOrion) provides. A modern, cliche-free reimplementation of PJOrion's
"WOT-Client" workflow.

> Dev/private use only. Injecting a loader and running arbitrary code in the client
> is against WG ToS and detectable; hiding that is explicitly out of scope.

See [`docs/PLAN.md`](docs/PLAN.md) for the full design and
[`docs/PROTOCOL.md`](docs/PROTOCOL.md) for the wire protocol.

## Architecture

```
Desktop (Tauri 2 + React 19 + TS + Tailwind 4, FSD)
  Monaco editor  ── completion / lint / hover providers ─┐
  xterm console  ◄── Channel<LogBatch> ──────────────────┤
        │ invoke()                                        │
  Rust backend                                            │
    commands ─ session ─ protocol ─ transport (file-buffer)
                      │                          │
            JediWorker (py2.7)        c2d / d2c + *.lock files
                                                 │
In-game agent (py2.7 / BigWorld)
  bw_site loader ─ capture (stdout + BigWorld.log*) ─ main-thread runner ─ handlers
```

Three channels over one file-buffer transport: continuous **stdout/log stream**,
**exec results** by id, and **complete / inspect / lint / dump** request/response.
Completion and lint are two-layer: static (jedi over the decompiled source, works
offline) merged with dynamic runtime introspection from the live game.

## Layout

| Path | What |
|---|---|
| `src/` | FSD frontend (`app` / `pages` / `widgets` / `features` / `entities` / `shared`) |
| `src-tauri/` | Rust backend (protocol, transport, jedi supervisor, commands) |
| `mod/` | universal `.mod` source tree, Python 2.7 builder, and agent tests |
| `tools/jedi_worker/` | CPython 2.7 jedi static worker (stdio JSON) |
| `docs/PLAN.md` | full implementation plan |

## Prerequisites

- Node 20+ and Rust 1.77+ (desktop app)
- CPython **2.7** for the in-game agent and the jedi static worker
  (`jedi==0.17.2` + `parso 0.7.x` are the last py2-capable releases; see
  `tools/jedi_worker/requirements.txt`). The `python27.dll` + stdlib bundled with
  PJOrion works as that interpreter.

## Develop

```sh
npm install
npm run dev            # frontend development server
npm run build          # tsc + vite production build
npm run lint:fsd       # steiger FSD boundary check
```

## Build for Windows

```powershell
.\build-windows.ps1
.\build-windows.ps1 -Version v0.5.0
```

Without `-Version`, the version comes from `package.json`; an explicit version
may include the Git tag's `v` prefix. The same version is used for the universal `.mod`
and Tauri installers. The script also runs the Python 2.7 agent and Rust tests,
checks FSD boundaries, and produces the final Windows installers. The release
workflow calls the same script from a clean checkout.

## Status

| Milestone | State |
|---|---|
| M0 scaffold (Tauri + React + TS + Tailwind 4 + FSD) | done, builds green |
| M1 stdout stream | code complete; agent capture + Rust watcher + xterm wired |
| M2 exec round-trip | code complete; Monaco + main-thread runner |
| M3 static completion/lint | code complete; jedi worker + Monaco providers |
| M4 dynamic layer | code complete; runtime complete/inspect/stubgen + merge |
| M5 polish | command palette, connect controls, design system |

Verified without a game: frontend `tsc`+`vite` build, `cargo check`, steiger FSD
check, agent unit + integration tests (`mod/tests/selftest.py`, `mod/tests/itest.py`), jedi
worker protocol. **Needs a live WoT client** to validate `BigWorld.callback`
main-thread marshaling, the real log volume, and end-to-end injection.
