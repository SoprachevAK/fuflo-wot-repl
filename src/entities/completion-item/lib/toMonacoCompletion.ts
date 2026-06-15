import type * as monaco from 'monaco-editor'
import type { Candidate } from '@/shared/api'

// monaco.languages.CompletionItemKind numeric literals (avoid a monaco runtime
// import in this entity): Function = 1, Class = 5, Property = 9.
const KIND_FUNCTION = 1 as monaco.languages.CompletionItemKind
const KIND_CLASS = 5 as monaco.languages.CompletionItemKind
const KIND_PROPERTY = 9 as monaco.languages.CompletionItemKind

function kindOf(c: Candidate): monaco.languages.CompletionItemKind {
  if (c.kind === 'class') return KIND_CLASS
  if (c.signature || c.kind === 'function') return KIND_FUNCTION
  return KIND_PROPERTY
}

export function toMonacoCompletion(
  c: Candidate,
  range: monaco.IRange,
): monaco.languages.CompletionItem {
  const live = c.source === 'live'
  // Show the typed signature inline next to the name (e.g.
  // "spaceLoadStatus(distance: float = -1.0) -> float"); the live/static origin
  // moves to the faint right-aligned description.
  return {
    label: {
      label: c.name,
      // inline signature next to the name when known (e.g. "(x: int) -> bool")
      detail: c.signature ? ` ${c.signature}` : '',
      // right-aligned: the actual TYPE (function/class/int/Vector3/...), not 'live'
      description: c.kind ?? (live ? 'live' : ''),
    },
    kind: kindOf(c),
    insertText: c.name,
    detail: c.signature ?? c.kind ?? (live ? 'live' : 'static'),
    documentation: c.doc ?? undefined,
    range,
    sortText: live ? `0_${c.name}` : `1_${c.name}`,
  }
}
