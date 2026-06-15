import { loadState, saveState } from '@/shared/lib'

const STORAGE_KEY = 'repl.history'
const MAX_ENTRIES = 100

let entries: string[] = loadState<string[]>(STORAGE_KEY, [])

export function pushHistory(code: string): void {
  const trimmed = code.trim()
  if (!trimmed) return
  if (entries[entries.length - 1] === trimmed) return
  entries = [...entries, trimmed].slice(-MAX_ENTRIES)
  saveState(STORAGE_KEY, entries)
}

export function getHistory(): string[] {
  return entries
}
