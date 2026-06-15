import { api, type GameInfo } from '@/shared/api'
import { consoleBus } from '@/entities/console'
import { connect } from './connect'

export async function detectGames(): Promise<GameInfo[]> {
  try {
    return await api.detectGames()
  } catch {
    return []
  }
}

/** PJOrion-style one click: install the agent, optionally launch, then connect. */
export async function setupAndConnect(game: GameInfo, launch: boolean): Promise<void> {
  try {
    consoleBus.system(`installing agent into ${game.path} (mods/${game.modsVersion})\n`)
    const buffer = await api.installAgent(game.path, game.modsVersion)
    consoleBus.system('agent installed\n')
    if (launch) {
      consoleBus.system(`launching ${game.exe}\n`)
      await api.launchGame(game.path, game.exe)
    }
    await connect(buffer)
  } catch (error) {
    consoleBus.system(`setup failed: ${String(error)}\n`)
  }
}
