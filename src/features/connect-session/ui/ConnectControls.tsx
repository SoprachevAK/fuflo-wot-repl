import { useEffect, useState } from 'react'
import type { GameInfo } from '@/shared/api'
import { useSession } from '@/entities/session'
import { connect, disconnect } from '../model/connect'
import { detectGames, pickGame, setupAndConnect } from '../model/setup'

const BTN =
  'h-7 rounded border border-edge px-3 text-[12px] text-fg transition-colors hover:border-live disabled:opacity-40'

export function ConnectControls() {
  const status = useSession((s) => s.status)
  const [games, setGames] = useState<GameInfo[]>([])
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    void detectGames().then(setGames)
  }, [])

  const connected = status === 'connected'
  const busy = status === 'connecting'
  const game = games[selected]

  const onBrowse = async () => {
    const info = await pickGame()
    if (!info) return
    setGames((prev) => {
      const at = prev.findIndex((g) => g.path.toLowerCase() === info.path.toLowerCase())
      if (at >= 0) {
        setSelected(at)
        return prev
      }
      setSelected(prev.length)
      return [...prev, info]
    })
  }

  if (connected) {
    return (
      <button type="button" onClick={() => void disconnect()} className={BTN}>
        Disconnect
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {games.length > 0 ? (
        <select
          value={selected}
          onChange={(e) => setSelected(Number(e.target.value))}
          className="h-7 max-w-72 rounded border border-edge bg-elevated px-2 text-[12px] text-fg outline-none focus:border-live"
        >
          {games.map((g, i) => (
            <option key={g.path} value={i}>
              {g.path.split(/[\\/]/).pop()} · {g.version}
              {g.installed ? ' · installed' : ''}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-[12px] text-faint">no client detected</span>
      )}
      <button type="button" onClick={() => void onBrowse()} disabled={busy} className={BTN} title="Pick the game folder manually">
        Browse…
      </button>
      <button
        type="button"
        onClick={() => game && void setupAndConnect(game, true)}
        disabled={!game || busy}
        className={`${BTN} border-live/40`}
      >
        {busy ? 'Waiting for game…' : 'Set up & launch'}
      </button>
      <button
        type="button"
        onClick={() => void connect()}
        disabled={busy}
        className={BTN}
        title="Connect to an already-running client"
      >
        Connect
      </button>
    </div>
  )
}
