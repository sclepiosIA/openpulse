import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NotesWidget } from '../NotesWidget'

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))

// Référence STABLE pour `data` : sinon les useEffect `[notes]` de NotesWidget
// se relancent à chaque rendu (setState) → boucle infinie / hang CPU.
// En production, react-query renvoie une référence stable : pas de boucle.
const { STABLE_NOTES } = vi.hoisted(() => ({
  STABLE_NOTES: [
    {
      id: 'n1',
      title: 'Ma note 1',
      tab_name: 'Ma note 1',
      content: '<p>Contenu</p>',
      order_index: 0,
      position: 0,
      user_id: 'u1',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ],
}))

vi.mock('@/hooks/dashboard/useDashboardNotes', () => ({
  useDashboardNotes: () => ({ data: STABLE_NOTES, isLoading: false }),
  useCreateNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteNote: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

// Chemin relatif au COMPOSANT mocké (depuis __tests__/, remonter d'un niveau),
// sinon le mock ne s'applique pas et le vrai éditeur TipTap est chargé.
vi.mock('../NotesRichEditor', () => ({
  NotesRichEditor: ({ content }: { content?: string }) => <div data-testid="editor">{content}</div>,
}))

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>
    <TooltipProvider>{children}</TooltipProvider>
  </QueryClientProvider>
)

describe('NotesWidget', () => {
  it('renders notes title', () => {
    render(<NotesWidget />, { wrapper: Wrapper })
    expect(screen.getByText('Notes')).toBeInTheDocument()
  })

  it('renders note tab', () => {
    render(<NotesWidget />, { wrapper: Wrapper })
    expect(screen.getByText('Ma note 1')).toBeInTheDocument()
  })

  it('renders add button', () => {
    const { container } = render(<NotesWidget />, { wrapper: Wrapper })
    const addBtn = container.querySelector('.lucide-plus')
    expect(addBtn).toBeInTheDocument()
  })

  it('renders editor', () => {
    render(<NotesWidget />, { wrapper: Wrapper })
    expect(screen.getByTestId('editor')).toBeInTheDocument()
  })
})
