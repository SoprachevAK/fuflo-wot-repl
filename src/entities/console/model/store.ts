import type { LogLine } from '@/shared/api'

type LineListener = (lines: LogLine[]) => void
type ClearListener = () => void

const lineListeners = new Set<LineListener>()
const clearListeners = new Set<ClearListener>()

// A tiny pub/sub the streaming console subscribes to. Kept out of React state on
// purpose: xterm owns its own scrollback, so we only forward lines to it.
export const consoleBus = {
  append(lines: LogLine[]) {
    lineListeners.forEach((listener) => listener(lines))
  },
  system(text: string) {
    this.append([{ stream: 'system', text }])
  },
  clear() {
    clearListeners.forEach((listener) => listener())
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
