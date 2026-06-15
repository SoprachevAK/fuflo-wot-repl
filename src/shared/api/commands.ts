import { invoke, Channel } from '@tauri-apps/api/core'
import type { GameInfo, OutFrame, ServerEvent } from './dto'

// Tauri v2 maps camelCase JS keys to snake_case Rust params automatically.
export const api = {
  ping: () => invoke<string>('ping'),
  defaultBufferDir: () => invoke<string>('default_buffer_dir'),
  stubsDir: () => invoke<string>('stubs_dir'),
  writeStubs: (stubs: Record<string, string>) => invoke<string>('write_stubs', { stubs }),

  detectGames: () => invoke<GameInfo[]>('detect_games'),
  inspectGameDir: (dir: string) => invoke<GameInfo | null>('inspect_game_dir', { dir }),
  installAgent: (gameDir: string, modsVersion: string) =>
    invoke<string>('install_agent', { gameDir, modsVersion }),
  launchGame: (gameDir: string, exe: string) =>
    invoke<void>('launch_game', { gameDir, exe }),

  connect: (bufferDir: string, onEvent: Channel<ServerEvent>) =>
    invoke<void>('connect', { bufferDir, onEvent }),
  disconnect: () => invoke<void>('disconnect'),

  execCode: (code: string) => invoke<OutFrame>('exec_code', { code }),
  complete: (prefix: string) => invoke<OutFrame>('complete', { prefix }),
  inspect: (expr: string) => invoke<OutFrame>('inspect', { expr }),
  lintCode: (code: string) => invoke<OutFrame>('lint_code', { code }),
  dumpObject: (expr: string, depth = 2) => invoke<OutFrame>('dump_object', { expr, depth }),

  jediStart: (python: string, script: string, root: string, sysPath: string[]) =>
    invoke<unknown>('jedi_start', { python, script, root, sysPath }),
  jediComplete: (code: string, line: number, column: number) =>
    invoke<unknown>('jedi_complete', { code, line, column }),
  jediLint: (code: string) => invoke<unknown>('jedi_lint', { code }),
}
