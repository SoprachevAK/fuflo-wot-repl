import { useSession, type ConnectionStatus } from '../model/store'

const DOT: Record<ConnectionStatus, string> = {
  disconnected: 'bg-faint',
  connecting: 'bg-warn animate-pulse',
  connected: 'bg-live',
}

const LABEL: Record<ConnectionStatus, string> = {
  disconnected: 'Disconnected',
  connecting: 'Waiting for game',
  connected: 'Connected',
}

export function ConnectionBadge() {
  const status = useSession((s) => s.status)
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-1.5 rounded-full ${DOT[status]}`} />
      {LABEL[status]}
    </span>
  )
}
