import type { LogLine } from '@/shared/api'

type LineListener = (lines: LogLine[]) => void
type ClearListener = () => void

const lineListeners = new Set<LineListener>()
const clearListeners = new Set<ClearListener>()

const HISTORY_CAP = 5000
const buffer: LogLine[] = []

function retain(lines: LogLine[]) {
  for (const line of lines) buffer.push(line)
  if (buffer.length > HISTORY_CAP) buffer.splice(0, buffer.length - HISTORY_CAP)
}

// A tiny pub/sub the streaming console subscribes to. Kept out of React state on
// purpose: xterm owns its own scrollback. A bounded ring buffer is retained so the
// widget can re-render scrollback when a filter/search changes.
export const consoleBus = {
  append(lines: LogLine[]) {
    retain(lines)
    lineListeners.forEach((listener) => listener(lines))
  },
  system(text: string) {
    this.append([{ stream: 'system', text }])
  },
  clear() {
    buffer.length = 0
    clearListeners.forEach((listener) => listener())
  },
  history(): LogLine[] {
    return buffer.slice()
  },
  subscribe(listener: LineListener): () => void {
    lineListeners.add(listener)
    return () => {
      lineListeners.delete(listener)
    }
  },
  subscribeClear(listener: ClearListener): () => void {
    clearListeners.add(listener)
    return () => {
      clearListeners.delete(listener)
    }
  },
}
