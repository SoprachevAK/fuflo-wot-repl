import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { Panel } from '@/shared/ui'
import { paintLine } from '@/shared/lib'
import { consoleBus } from '@/entities/console'

export function LogConsole() {
  const host = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = host.current
    if (!node) return

    const term = new Terminal({
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 13,
      convertEol: false,
      cursorBlink: false,
      scrollback: 20000,
      theme: { background: '#0E1116', foreground: '#C9D3DF', cursor: '#0E1116' },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(node)
    const doFit = () => {
      try {
        fit.fit()
      } catch {
        // container not laid out yet; the observer will retry
      }
    }
    requestAnimationFrame(doFit)

    const observer = new ResizeObserver(doFit)
    observer.observe(node)

    const unsub = consoleBus.subscribe((lines) => {
      for (const line of lines) term.write(paintLine(line))
    })
    const unsubClear = consoleBus.subscribeClear(() => term.reset())

    return () => {
      unsub()
      unsubClear()
      observer.disconnect()
      term.dispose()
    }
  }, [])

  return (
    <Panel title="Console" className="w-[42%]">
      <div ref={host} className="h-full w-full px-2 py-1" />
    </Panel>
  )
}
