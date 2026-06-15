import { useEffect, useRef } from 'react'
import { useSession } from '@/entities/session'
import { ConnectControls } from '@/features/connect-session'
import { dumpLive } from '@/features/dump-object'
import { EditorPanel } from '@/widgets/editor-panel'
import { LogConsole } from '@/widgets/log-console'
import { StatusBar } from '@/widgets/status-bar'
import { CommandPalette } from '@/widgets/command-palette'

export function StudioPage() {
  const status = useSession((s) => s.status)
  const autoDumped = useRef(false)

  // Auto-dump all live types once the agent is truly alive (hello -> connected),
  // so jedi stubs are ready without a manual Ctrl+K. Re-arms on disconnect.
  useEffect(() => {
    if (status === 'connected' && !autoDumped.current) {
      autoDumped.current = true
      const t = setTimeout(() => void dumpLive('*', 3), 500)
      return () => clearTimeout(t)
    }
    if (status === 'disconnected') autoDumped.current = false
  }, [status])

  return (
    <>
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-edge bg-panel px-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold tracking-tight text-fg">Fuflo WoT REPL</span>
          <span className="text-[11px] text-faint">Ctrl/Cmd+K for commands</span>
        </div>
        <ConnectControls />
      </header>
      <main className="flex min-h-0 flex-1">
        <EditorPanel />
        <LogConsole />
      </main>
      <StatusBar />
      <CommandPalette />
    </>
  )
}
