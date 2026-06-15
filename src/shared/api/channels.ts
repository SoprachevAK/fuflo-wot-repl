import { Channel } from '@tauri-apps/api/core'
import type { ServerEvent } from './dto'

export function createServerChannel(
  onEvent: (event: ServerEvent) => void,
): Channel<ServerEvent> {
  const channel = new Channel<ServerEvent>()
  channel.onmessage = onEvent
  return channel
}
