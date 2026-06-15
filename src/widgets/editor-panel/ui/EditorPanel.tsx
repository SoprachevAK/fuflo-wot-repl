import { useEffect, useRef } from 'react'
import { monaco } from '@/shared/lib'
import { Panel } from '@/shared/ui'
import { registerPythonCompletion } from '@/features/complete-code'
import { attachLinter } from '@/features/lint-code'
import { runCode } from '@/features/run-code'
import { useEditorCursor } from '@/entities/editor'

const SAMPLE = [
  '# Ctrl/Cmd+Enter runs the selection (or the whole buffer) in the live game.',
  'import BigWorld',
  'print BigWorld.player()',
  '',
].join('\n')

let completionDisposable: monaco.IDisposable | null = null

export function EditorPanel() {
  const container = useRef<HTMLDivElement | null>(null)
  const setCursor = useEditorCursor((s) => s.setCursor)

  useEffect(() => {
    const host = container.current
    if (!host) return
    if (!completionDisposable) completionDisposable = registerPythonCompletion(monaco)

    const editor = monaco.editor.create(host, {
      value: SAMPLE,
      language: 'python',
      theme: 'wms-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 13,
      scrollBeyondLastLine: false,
      renderLineHighlight: 'line',
      padding: { top: 8 },
      // Only show OUR providers (live agent + jedi). Monaco's word-based
      // suggestions otherwise pollute the list with words from the buffer text.
      wordBasedSuggestions: 'off',
      suggest: { showWords: false },
      // Render suggest/hover widgets at document-body level so the editor panel's
      // overflow:auto doesn't clip them (and Monaco flips them to fit the window).
      fixedOverflowWidgets: true,
    })

    const model = editor.getModel()
    const detachLint = model ? attachLinter(monaco, model) : () => undefined

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      const selection = editor.getSelection()
      const code =
        selection && !selection.isEmpty()
          ? (editor.getModel()?.getValueInRange(selection) ?? '')
          : editor.getValue()
      void runCode(code)
    })

    const cursorSub = editor.onDidChangeCursorPosition((e) =>
      setCursor(e.position.lineNumber, e.position.column),
    )

    return () => {
      cursorSub.dispose()
      detachLint()
      editor.dispose()
    }
  }, [setCursor])

  return (
    <Panel title="Editor" className="flex-1 border-r border-edge">
      <div ref={container} className="h-full w-full" />
    </Panel>
  )
}
