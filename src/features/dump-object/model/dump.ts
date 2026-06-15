import { api } from '@/shared/api'
import { consoleBus } from '@/entities/console'

interface DumpNode {
  name?: string
  kind?: string
  type?: string
  members?: DumpNode[]
}

function countNodes(node: DumpNode | undefined): number {
  if (!node) return 0
  return 1 + (node.members ?? []).reduce((n, m) => n + countNodes(m), 0)
}

/** Deep-introspect a live expression; runtime-informed stubs are persisted backend-side. */
export async function dumpLive(expr: string, depth = 2): Promise<void> {
  consoleBus.system(`dumping ${expr} (depth ${depth})...\n`)
  try {
    const frame = await api.dumpObject(expr, depth)
    if (frame.type !== 'dump') return
    const roots = (frame.roots as DumpNode[]) ?? []
    const total = roots.reduce((n, r) => n + countNodes(r), 0)
    const stubs = Object.keys(frame.stubs ?? {})
    const errs = (frame.errors as unknown[]) ?? []
    if (errs.length) {
      consoleBus.system(`dump error: ${JSON.stringify(errs)}\n`)
      return
    }
    consoleBus.system(
      `dumped ${total} live members; stubs: ${stubs.join(', ') || '(none)'}\n`,
    )
  } catch (error) {
    consoleBus.system(`dump failed: ${String(error)}\n`)
  }
}
