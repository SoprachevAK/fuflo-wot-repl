import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { disconnect } from '@/features/connect-session'
import { consoleBus } from '@/entities/console'

const COMMANDS = [
  { id: 'clear', title: 'Clear console', run: () => consoleBus.clear() },
  { id: 'disconnect', title: 'Disconnect session', run: () => void disconnect() },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Match the PHYSICAL key via e.code, not e.key: on non-Latin layouts
      // (RU) the K key reports e.key === 'л', so an e.key check never fires.
      // Capture phase so Monaco's Ctrl+K chord can't swallow it first.
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') {
        e.preventDefault()
        e.stopPropagation()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      overlayClassName="fixed inset-0 z-50 bg-black/40"
      contentClassName="fixed left-1/2 top-32 z-50 w-[480px] -translate-x-1/2 overflow-hidden rounded-lg border border-edge bg-panel shadow-2xl"
    >
      <Command.Input
        placeholder="Type a command"
        className="w-full border-b border-edge bg-elevated px-3 py-2 text-[13px] text-fg outline-none placeholder:text-faint"
      />
      <Command.List className="max-h-72 overflow-auto py-1">
        <Command.Empty className="px-3 py-2 text-[12px] text-faint">No commands</Command.Empty>
        {COMMANDS.map((c) => (
          <Command.Item
            key={c.id}
            value={c.title}
            onSelect={() => {
              c.run()
              setOpen(false)
            }}
            className="mx-1 cursor-pointer rounded px-2 py-1.5 text-[13px] text-fg data-[selected=true]:bg-elevated"
          >
            {c.title}
          </Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  )
}
