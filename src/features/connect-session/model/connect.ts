import { api, createServerChannel } from '@/shared/api'
import { useSession } from '@/entities/session'
import { consoleBus } from '@/entities/console'

let lastBufferDir = ''

export async function connect(bufferDir?: string): Promise<void> {
  const dir = bufferDir ?? (await api.defaultBufferDir())
  const session = useSession.getState()
  session.setIntentionalDisconnect(false)
  session.setBufferDir(dir)
  session.setStatus('connecting')
  lastBufferDir = dir

  const channel = createServerChannel((event) => {
    if (event.kind === 'log') {
      consoleBus.append(event.lines)
    } else if (event.kind === 'hello') {
      const s = useSession.getState()
      s.setStatus('connected')
      s.setHello(event)
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
  useSession.getState().setIntentionalDisconnect(true)
  await api.disconnect().catch(() => undefined)
  useSession.getState().setStatus('disconnected')
  consoleBus.system('disconnected\n')
}

export async function reconnect(): Promise<void> {
  const dir = lastBufferDir || useSession.getState().bufferDir
  if (!dir) {
    consoleBus.system('reconnect skipped: no known buffer dir\n')
    return
  }
  await connect(dir)
}

const RETRIES = 3
const CONNECT_WINDOW_MS = 5000

let reconnecting = false

function waitForConnected(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (useSession.getState().status === 'connected') return resolve(true)
    const timer = setTimeout(() => {
      unsub()
      resolve(false)
    }, timeoutMs)
    const unsub = useSession.subscribe((s) => {
      if (s.status === 'connected') {
        clearTimeout(timer)
        unsub()
        resolve(true)
      }
    })
  })
}

/**
 * Best-effort auto-reconnect: when the session drops to 'disconnected' without
 * the user having asked for it, retry connect() a few times. Only fires if a
 * 'disconnected' transition is actually observed; with no backend heartbeat a
 * game exit does not currently produce one (see report — deferred).
 */
useSession.subscribe((state, prev) => {
  if (prev.status === state.status) return
  if (state.status !== 'disconnected') return
  if (state.intentionalDisconnect) return
  const dir = lastBufferDir || state.bufferDir
  if (!dir) return
  if (reconnecting) return
  void runAutoReconnect(dir)
})

async function runAutoReconnect(dir: string): Promise<void> {
  reconnecting = true
  try {
    for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
      const s = useSession.getState()
      if (s.intentionalDisconnect) break
      if (s.status === 'connected') return
      consoleBus.system(`connection dropped — reconnect attempt ${attempt}/${RETRIES}\n`)
      await connect(dir)
      // connect() resolves before the agent's hello arrives, so wait for the
      // actual 'connected' transition rather than re-firing connect() blindly.
      if (await waitForConnected(CONNECT_WINDOW_MS)) {
        consoleBus.system('reconnected\n')
        return
      }
    }
    consoleBus.system(`auto-reconnect gave up after ${RETRIES} attempts\n`)
  } finally {
    reconnecting = false
  }
}
