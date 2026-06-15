import type * as monaco from 'monaco-editor'
import { api, type Candidate } from '@/shared/api'
import { extractArray } from '@/shared/lib'
import { toMonacoCompletion } from '@/entities/completion-item'

// Two-layer completion: live runtime (agent) merged over static (jedi). Live wins
// on name collisions; both failures degrade to an empty list.
async function gather(prefixLine: string, fullCode: string, line: number, column: number): Promise<Candidate[]> {
  const [live, statc] = await Promise.allSettled([
    api.complete(prefixLine),
    api.jediComplete(fullCode, line, column),
  ])

  const merged = new Map<string, Candidate>()
  if (statc.status === 'fulfilled') {
    for (const c of extractArray<Candidate>(statc.value, 'candidates')) merged.set(c.name, { ...c, source: 'static' })
  }
  if (live.status === 'fulfilled' && live.value.type === 'complete') {
    for (const c of live.value.candidates) merged.set(c.name, { ...c, source: 'live' })
  }
  return [...merged.values()]
}

export function registerPythonCompletion(m: typeof monaco): monaco.IDisposable {
  return m.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.'],
    async provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }
      const prefixLine = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      })
      const candidates = await gather(
        prefixLine,
        model.getValue(),
        position.lineNumber,
        position.column - 1,
      )
      return { suggestions: candidates.map((c) => toMonacoCompletion(c, range)) }
    },
  })
}
