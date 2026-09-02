// Store global (Zustand) : module actif du shell, session, config,
// étape d'onboarding Drive.

import { create } from 'zustand'
import type { AppId } from '../apps/registry'
import type { ClientConfig, SessionInfo, Space } from '../api/types'

/** Étapes internes du module Drive (onboarding linéaire puis statut). */
export type Screen = 'login' | 'folder' | 'spaces' | 'status' | 'files' | 'settings'

interface AppStore {
  /** Module actif dans le shell Gestion Desktop (sidebar). */
  activeApp: AppId
  /** Étape courante du module Drive. */
  screen: Screen
  /** Panneau natif (Préférences / sync Drive) affiché au-dessus de la PWA. */
  panelOpen: boolean
  session: SessionInfo | null
  config: ClientConfig | null
  spaces: Space[]
  selectedSpaceIds: string[]

  setActiveApp: (app: AppId) => void
  setPanelOpen: (open: boolean) => void
  setScreen: (s: Screen) => void
  setSession: (s: SessionInfo | null) => void
  setConfig: (c: ClientConfig) => void
  setSpaces: (s: Space[]) => void
  toggleSpace: (id: string) => void
  setSelectedSpaceIds: (ids: string[]) => void
  reset: () => void
}

export const useAppStore = create<AppStore>((set) => ({
  activeApp: 'drive',
  screen: 'login',
  panelOpen: false,
  session: null,
  config: null,
  spaces: [],
  selectedSpaceIds: [],

  setActiveApp: (activeApp) => set({ activeApp }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setScreen: (screen) => set({ screen }),
  setSession: (session) => set({ session }),
  setConfig: (config) => set({ config, selectedSpaceIds: config.selected_space_ids }),
  setSpaces: (spaces) => set({ spaces }),
  toggleSpace: (id) =>
    set((st) => ({
      selectedSpaceIds: st.selectedSpaceIds.includes(id)
        ? st.selectedSpaceIds.filter((x) => x !== id)
        : [...st.selectedSpaceIds, id],
    })),
  setSelectedSpaceIds: (selectedSpaceIds) => set({ selectedSpaceIds }),
  reset: () => set({ screen: 'login', session: null, spaces: [], selectedSpaceIds: [] }),
}))
