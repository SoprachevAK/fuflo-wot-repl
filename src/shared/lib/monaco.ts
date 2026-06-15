import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment
  }
}

// Python only needs the core editor worker (its grammar is Monarch, main-thread).
self.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}

monaco.editor.defineTheme('wms-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#0E1116',
    'editor.foreground': '#C9D3DF',
    'editorLineNumber.foreground': '#4C586A',
    'editorCursor.foreground': '#3FB9B0',
    'editorGutter.background': '#0E1116',
    'editor.lineHighlightBackground': '#151A21',
    'editorWidget.background': '#151A21',
    'editorWidget.border': '#232B36',
  },
})

export { monaco }
