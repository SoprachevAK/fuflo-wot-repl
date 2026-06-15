import type { LogLine } from '@/shared/api'

export const TERMINAL_COLOR: Record<string, string> = {
  stderr: '\x1b[31m',
  log: '\x1b[36m',
  result: '\x1b[32m',
  system: '\x1b[90m',
  input: '\x1b[37m',
}
const RESET = '\x1b[0m'

export function paintLine(line: LogLine): string {
  const body = line.text.replace(/\r?\n/g, '\r\n')
  const color = TERMINAL_COLOR[line.stream]
  return color ? `${color}${body}${RESET}` : body
}
