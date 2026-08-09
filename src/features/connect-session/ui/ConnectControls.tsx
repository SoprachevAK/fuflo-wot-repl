import { useEffect, useState } from 'react'
import type { GameInfo } from '@/shared/api'
import { loadState } from '@/shared/lib'
import { useSession } from '@/entities/session'
import { connect, disconnect } from '../model/connect'
import { detectGames, pickGame, setupAndConnect, LAST_GAME_KEY } from '../model/setup'

const BTN =
  'h-7 rounded border border-edge px-3 text-[12px] text-fg transition-colors hover:border-live disabled:opacity-40'

function isGameInfo(value: unknown): value is GameInfo {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as GameInfo).path === 'string' &&
    typeof (value as GameInfo).version === 'string' &&
    typeof (value as GameInfo).modsVersion === 'string' &&
    typeof (value as GameInfo).exe === 'string'
  )
}

export function ConnectControls() {
  const status = useSession((s) => s.status)
  const [games, setGames] = useState<GameInfo[]>([])
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    void detectGames().then((detected) => {
      const saved = loadState<unknown>(LAST_GAME_KEY, null)
      if (!isGameInfo(saved)) {
        setGames(detected)
        return
      }
      const at = detected.findIndex((g) => g.path.toLowerCase() === saved.path.toLowerCase())
      if (at >= 0) {
        setGames(detected)
        setSelected(at)
      } else {
        setGames([...detected, saved])
        setSelected(detected.length)
      }
    })
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

  if (busy) {
    return (
      <button type="button" onClick={() => void disconnect()} className={BTN}>
        Cancel
      </button>
    )
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
        {busy ? 'Waiting for game…' : 'Launch Game'}
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
