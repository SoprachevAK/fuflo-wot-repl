import { api, pickFolder, type GameInfo } from '@/shared/api'
import { consoleBus } from '@/entities/console'
import { connect } from './connect'

export async function detectGames(): Promise<GameInfo[]> {
  try {
    return await api.detectGames()
  } catch {
    return []
  }
}

/** Let the user pick a folder manually; validates it's a real WoT install. */
export async function pickGame(): Promise<GameInfo | null> {
  try {
    const dir = await pickFolder('Select your World of Tanks / Мир танков folder')
    if (!dir) return null
    const info = await api.inspectGameDir(dir)
    if (!info) {
      consoleBus.system(`not a WoT install (no Tanki.exe/WorldOfTanks.exe): ${dir}\n`)
      return null
    }
    return info
  } catch (error) {
    consoleBus.system(`folder pick failed: ${String(error)}\n`)
    return null
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
