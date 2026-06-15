# File-buffer wire protocol

Both sides (desktop Rust backend and in-game py2.7 agent) speak newline-delimited
JSON frames over two append files in a shared directory.

## Files

| File | Writer | Reader | Lock |
|---|---|---|---|
| `c2d` | game agent | desktop | `c2d.lock` |
| `d2c` | desktop | game agent | `d2c.lock` |

Lock = create `<name>.lock` with `O_CREAT \| O_EXCL`; unlock = delete it. A lock
older than 5s is force-broken (peer crash recovery). The writer holds the lock for
the whole append; the reader holds it for the whole read+truncate. One JSON object
per line.

## Desktop -> game (`d2c`)

```jsonc
{ "id": "<uuid>", "type": "exec",    "code": "player = BigWorld.player()" }
{ "id": "<uuid>", "type": "complete","prefix": "BigWorld.pla" }
{ "id": "<uuid>", "type": "inspect", "expr": "BigWorld.player()" }
{ "id": "<uuid>", "type": "lint",    "code": "print x" }
{ "id": "<uuid>", "type": "dump",    "expr": "BigWorld.player()", "depth": 3 }
```

## Game -> desktop (`c2d`)

```jsonc
// continuous stream, no id
{ "type": "stdout", "stream": "stdout|stderr|log", "level": "INFO", "text": "...\n" }
// correlated by id
{ "id": "<uuid>", "type": "result",  "ok": true, "repr": "<Avatar>", "exc": null }
{ "id": "<uuid>", "type": "complete", "candidates": [{"name":"player","source":"live"}] }
{ "id": "<uuid>", "type": "inspect",  "signature": "player()", "doc": "..." }
{ "id": "<uuid>", "type": "lint",     "diagnostics": [{"line":1,"col":1,"severity":"error","message":"..."}] }
{ "id": "<uuid>", "type": "dump",     "roots": [ ... ], "errors": [ ... ], "stubs": { "Avatar": "<.pyi text>" } }
```

## Threading

`exec`, `complete`, `inspect`, `dump` run on the game **main thread** via
`BigWorld.callback(0, ...)`. `lint` is pure and runs on the agent poll thread.
Captured stdout/log is queued on the game thread and shipped by the poll thread.
