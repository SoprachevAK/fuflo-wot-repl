import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { Panel, HeaderButton } from '@/shared/ui'
import { paintLine } from '@/shared/lib'
import { consoleBus } from '@/entities/console'

function readBuffer(term: Terminal): string {
  const buf = term.buffer.active
  const out: string[] = []
  for (let i = 0; i < buf.length; i++) {
    out.push(buf.getLine(i)?.translateToString(true) ?? '')
  }
  return out.join('\n').replace(/\s+$/, '') + '\n'
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
    } catch {
      // no clipboard access available; nothing more we can do
    }
    document.body.removeChild(ta)
  }
}

export function LogConsole() {
  const host = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)

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
    termRef.current = term
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
      termRef.current = null
    }
  }, [])

  const onCopy = () => {
    const term = termRef.current
    if (term) void copyText(readBuffer(term))
  }

  return (
    <Panel
      title="Console"
      className="w-[42%]"
      actions={
        <div className="flex items-center gap-1.5">
          <HeaderButton onClick={onCopy} title="Copy console to clipboard">
            Copy
          </HeaderButton>
          <HeaderButton onClick={() => consoleBus.clear()} title="Clear console">
            Clear
          </HeaderButton>
        </div>
      }
    >
      <div ref={host} className="h-full w-full px-2 py-1" />
    </Panel>
  )
}
