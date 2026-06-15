import { create } from 'zustand'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

interface SessionState {
  status: ConnectionStatus
  bufferDir: string
  setStatus: (status: ConnectionStatus) => void
  setBufferDir: (bufferDir: string) => void
}

export const useSession = create<SessionState>((set) => ({
  status: 'disconnected',
  bufferDir: '',
  setStatus: (status) => set({ status }),
  setBufferDir: (bufferDir) => set({ bufferDir }),
}))
