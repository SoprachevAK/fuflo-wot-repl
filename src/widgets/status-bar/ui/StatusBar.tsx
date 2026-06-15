import { ConnectionBadge } from '@/entities/session'
import { useEditorCursor } from '@/entities/editor'

export function StatusBar() {
  const line = useEditorCursor((s) => s.line)
  const column = useEditorCursor((s) => s.column)

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-edge bg-panel px-3 text-[11px] text-muted">
      <div className="flex items-center gap-3">
        <ConnectionBadge />
        <span className="text-faint">jedi: idle</span>
      </div>
      <span className="text-faint">
        Ln {line}, Col {column}
      </span>
    </footer>
  )
}
