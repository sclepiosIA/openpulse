import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreateUserStoryDialog } from '../CreateUserStoryDialog'
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/hooks/rd/useRD', () => ({
  useCreateRDUserStory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRDEpics: () => ({ data: [{ id: 'e1', titre: 'Epic Auth', couleur: '#6366f1' }] }),
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({ data: [] }),
}))

vi.mock('@/hooks/rd/useClientEtablissementsForRD', () => ({
  useClientEtablissementsForRD: () => ({ data: [] }),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn() },
}))

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)

describe('CreateUserStoryDialog', () => {
  it('renders nothing when closed', () => {
    wrap(<CreateUserStoryDialog open={false} onOpenChange={vi.fn()} projetId="p1" />)
    expect(screen.queryByText('Nouvelle User Story')).not.toBeInTheDocument()
  })

  it('renders dialog title when open', () => {
    wrap(<CreateUserStoryDialog open={true} onOpenChange={vi.fn()} projetId="p1" />)
    expect(screen.getByText('Nouvelle User Story')).toBeInTheDocument()
  })

  it('renders titre and description fields', () => {
    wrap(<CreateUserStoryDialog open={true} onOpenChange={vi.fn()} projetId="p1" />)
    expect(screen.getByLabelText(/^Titre/)).toBeInTheDocument()
    // Le label "Description" est présent (associé au RichTextEditor qui n'est pas un input standard)
    expect(screen.getByText('Description')).toBeInTheDocument()
  })

  it('renders priority select', () => {
    wrap(<CreateUserStoryDialog open={true} onOpenChange={vi.fn()} projetId="p1" />)
    expect(screen.getByText('Priorité')).toBeInTheDocument()
  })

  it('renders submit button', () => {
    wrap(<CreateUserStoryDialog open={true} onOpenChange={vi.fn()} projetId="p1" />)
    expect(screen.getByText('Créer')).toBeInTheDocument()
  })
})
