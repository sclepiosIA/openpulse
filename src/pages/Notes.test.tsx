import '@testing-library/jest-dom/vitest'
import type { PropsWithChildren } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  boards: [
    {
      id: 'board-1',
      owner_id: 'user-1',
      title: 'Plan produit',
      scene: { elements: [] },
    },
  ],
  isLoading: false,
}))

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('@/hooks/shared/useUserRole', () => ({
  useUserRole: () => ({ role: 'direction', isAdmin: true }),
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/hooks/whiteboards/useWhiteboardList', () => ({
  useWhiteboardList: () => ({ data: state.boards, isLoading: state.isLoading }),
}))

vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({ title, actions }: { title: string; actions: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}))

vi.mock('@/components/whiteboard/WhiteboardBoardList', () => ({
  WhiteboardBoardList: () => <aside>Liste des tableaux</aside>,
}))

vi.mock('@/components/whiteboard/WhiteboardCanvas', () => ({
  WhiteboardCanvas: ({ whiteboard }: { whiteboard: { title: string } }) => (
    <section>Canvas {whiteboard.title}</section>
  ),
}))

vi.mock('@/components/whiteboard/PresentationStudio', () => ({
  PresentationStudio: () => <section>Studio de présentation</section>,
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SelectContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SelectItem: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SelectTrigger: ({ children }: PropsWithChildren) => <button>{children}</button>,
  SelectValue: () => null,
}))

import Notes from './Notes'

describe('Notes', () => {
  beforeEach(() => {
    state.boards = [
      {
        id: 'board-1',
        owner_id: 'user-1',
        title: 'Plan produit',
        scene: { elements: [] },
      },
    ]
    state.isLoading = false
  })

  it('affiche le tableau blanc actif et ses périmètres', async () => {
    render(<Notes />)

    expect(screen.getByRole('heading', { name: 'Tableau blanc' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mes tableaux' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tableaux équipe' })).toBeInTheDocument()
    expect(screen.getByText('Liste des tableaux')).toBeInTheDocument()
    expect(await screen.findByText('Canvas Plan produit')).toBeInTheDocument()
  })

  it('ouvre le studio de présentation depuis son onglet', async () => {
    render(<Notes />)

    fireEvent.click(screen.getByRole('button', { name: 'Présentations' }))

    expect(await screen.findByText('Studio de présentation')).toBeInTheDocument()
    expect(screen.queryByText('Liste des tableaux')).not.toBeInTheDocument()
  })
})