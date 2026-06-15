import type * as monaco from 'monaco-editor'
import type { Diagnostic } from '@/shared/api'

// monaco.MarkerSeverity: Hint=1, Info=2, Warning=4, Error=8. Numeric literals keep
// this entity free of a monaco runtime import.
function severityOf(value: string): monaco.MarkerSeverity {
  if (value === 'error') return 8
  if (value === 'warning') return 4
  return 2
}

export function toMonacoMarker(d: Diagnostic): monaco.editor.IMarkerData {
  return {
    severity: severityOf(d.severity),
    message: d.message,
    startLineNumber: d.line,
    startColumn: d.col,
    endLineNumber: d.line,
    endColumn: d.col + 1,
  }
}
