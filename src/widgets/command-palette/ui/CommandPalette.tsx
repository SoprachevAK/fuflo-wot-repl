import { useEffect, useMemo, useState } from 'react'
import { disconnect } from '@/features/connect-session'
import { consoleBus } from '@/entities/console'

interface Command {
  id: string
  title: string
  run: () => void
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const commands = useMemo<Command[]>(
    () => [
      { id: 'clear', title: 'Clear console', run: () => consoleBus.clear() },
      { id: 'disconnect', title: 'Disconnect session', run: () => void disconnect() },
    ],
    [],
  )

  useEffect(() => {
    // Capture phase: Monaco binds Ctrl+K as a chord prefix and swallows it while
    // the editor is focused, so a bubble-phase window listener never fires. We
    // intercept on the way down and stop Monaco from seeing it.
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        e.stopPropagation()
        setQuery('')
        setOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setOpen((v) => (v ? false : v))
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  if (!open) return null

  const filtered = commands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-32"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[480px] overflow-hidden rounded-lg border border-edge bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command"
          className="w-full border-b border-edge bg-elevated px-3 py-2 text-[13px] text-fg outline-none placeholder:text-faint"
        />
        <ul className="max-h-72 overflow-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-[12px] text-faint">No commands</li>
          ) : (
            filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    c.run()
                    setOpen(false)
                  }}
                  className="block w-full px-3 py-1.5 text-left text-[13px] text-fg hover:bg-elevated"
                >
                  {c.title}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
