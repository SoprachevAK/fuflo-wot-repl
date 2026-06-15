import { create } from 'zustand'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

interface SessionState {
  status: ConnectionStatus
  bufferDir: string
  agentVersion: string | null
  agentPid: number | null
  intentionalDisconnect: boolean
  setStatus: (status: ConnectionStatus) => void
  setBufferDir: (bufferDir: string) => void
  setHello: (hello: { version?: string | null; pid?: number | null }) => void
  setIntentionalDisconnect: (intentional: boolean) => void
}

export const useSession = create<SessionState>((set) => ({
  status: 'disconnected',
  bufferDir: '',
  agentVersion: null,
  agentPid: null,
  intentionalDisconnect: false,
  setStatus: (status) => set({ status }),
  setBufferDir: (bufferDir) => set({ bufferDir }),
  setHello: ({ version, pid }) =>
    set({ agentVersion: version ?? null, agentPid: pid ?? null }),
  setIntentionalDisconnect: (intentionalDisconnect) => set({ intentionalDisconnect }),
}))
