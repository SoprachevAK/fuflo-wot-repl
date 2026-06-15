import { api, createServerChannel } from '@/shared/api'
import { useSession } from '@/entities/session'
import { consoleBus } from '@/entities/console'

export async function connect(bufferDir?: string): Promise<void> {
  const dir = bufferDir ?? (await api.defaultBufferDir())
  const session = useSession.getState()
  session.setBufferDir(dir)
  session.setStatus('connecting')

  const channel = createServerChannel((event) => {
    if (event.kind === 'log') {
      consoleBus.append(event.lines)
    } else if (event.kind === 'hello') {
      useSession.getState().setStatus('connected')
      consoleBus.system(`agent online (pid ${event.pid ?? '?'}, v${event.version ?? '?'})\n`)
    }
  })

  try {
    await api.connect(dir, channel)
    consoleBus.system(`listening on ${dir} — waiting for the game\n`)
  } catch (error) {
    useSession.getState().setStatus('disconnected')
    consoleBus.system(`connect failed: ${String(error)}\n`)
  }
}

export async function disconnect(): Promise<void> {
  await api.disconnect().catch(() => undefined)
  useSession.getState().setStatus('disconnected')
  consoleBus.system('disconnected\n')
}
