import type { LogLine } from '@/shared/api'

const RESET = '\x1b[0m'
const fg = (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`
const bold = (s: string) => `\x1b[1m${s}`

const C = {
  timestamp: fg(106, 115, 125),
  category: fg(86, 200, 216),
  message: fg(201, 211, 223),
  info: fg(88, 166, 255),
  debug: fg(125, 135, 153),
  notice: fg(179, 146, 240),
  warning: fg(227, 179, 65),
  error: fg(240, 109, 109),
  critical: fg(255, 123, 114),
  input: fg(125, 211, 252),
  result: fg(86, 211, 100),
  system: fg(139, 148, 158),
}

type Severity = 'info' | 'debug' | 'notice' | 'warning' | 'error' | 'critical'

const SEVERITY: Record<string, Severity> = {
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'debug',
  NOTICE: 'notice',
  HOOK: 'notice',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
  HACK: 'critical',
}

// BigWorld's hook names (logInfo, logWarning, ...) -> the LEVEL token form.
function normalizeLevel(level: string | null | undefined): string | null {
  if (!level) return null
  const stripped = level.replace(/^log/, '')
  return stripped.toUpperCase()
}

const LINE = /^(?<ts>\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+:?\s+)?(?<lvl>(?:INFO|WARNING|ERROR|DEBUG|NOTICE|CRITICAL|TRACE|HACK|HOOK):?\s+)?(?<cat>(?:\[[^\]\n,]*\])+\s*)?(?<msg>.*)$/

// Whole-message tint only for levels a reader needs to notice; INFO/DEBUG/NOTICE
// keep the neutral message color so the console doesn't turn into a rainbow.
const TINTED: Record<Severity, boolean> = {
  info: false,
  debug: false,
  notice: false,
  warning: true,
  error: true,
  critical: true,
}

function paintLogLine(text: string, frameSeverity: Severity | null): string {
  const m = LINE.exec(text)
  if (!m || !m.groups) return frameSeverity ? C[frameSeverity] + text + RESET : text
  const { ts, lvl, cat, msg } = m.groups
  const tokenSeverity = lvl ? SEVERITY[lvl.replace(/[:\s]+$/, '')] : undefined
  const severity = tokenSeverity ?? frameSeverity ?? 'info'

  let out = ''
  if (ts) out += C.timestamp + ts + RESET
  if (lvl) out += bold(C[severity]) + lvl + RESET
  if (cat) out += C.category + cat + RESET
  if (msg) out += (TINTED[severity] ? C[severity] : C.message) + msg + RESET
  return out
}

export function paintLine(line: LogLine): string {
  const body = line.text.replace(/\r?\n/g, '\r\n')

  if (line.stream === 'input') return bold(C.input) + body + RESET
  if (line.stream === 'result') return C.result + body + RESET
  if (line.stream === 'system') return C.system + body + RESET
  if (line.stream === 'stderr' && !line.level) return C.error + body + RESET

  const severity = normalizeLevel(line.level)
  const frameSeverity = severity ? (SEVERITY[severity] ?? null) : null
  return body
    .split('\r\n')
    .map((segment, i, all) =>
      i < all.length - 1 ? paintLogLine(segment, frameSeverity) + '\r\n' : paintLogLine(segment, frameSeverity),
    )
    .join('')
}
