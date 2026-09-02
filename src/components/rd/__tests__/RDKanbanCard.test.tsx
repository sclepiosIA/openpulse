import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RDKanbanCard } from '../RDKanbanCard';
import { DndContext } from '@dnd-kit/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    }),
  },
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const baseStory = {
  id: 's1',
  titre: 'Implémenter login OAuth',
  description: 'Ajouter OAuth2 pour Google',
  priorite: 'high' as const,
  statut: 'in_progress' as const,
  points: 8,
  epic_id: 'e1',
  projet_id: 'p1',
  sprint_id: null,
  responsable_id: null,
  responsable: { prenom: 'Jean', nom: 'Dupont' },
  criteres_acceptation: ['CA1', 'CA2', 'CA3', 'CA4'],
  _count: { tasks: 5, done_tasks: 3 },
  date_debut: null,
  date_fin: null,
  ordre: 1,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const epics = [
  { id: 'e1', titre: 'Auth Epic', couleur: '#3b82f6', projet_id: 'p1', description: '', ordre: 1, created_at: '', updated_at: '' },
];

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={qc}>
      <DndContext>{ui}</DndContext>
    </QueryClientProvider>
  );

describe('RDKanbanCard', () => {
  it('renders story title', () => {
    wrap(<RDKanbanCard story={baseStory as any} projetId="p1" epics={epics as any} />);
    expect(screen.getByText('Implémenter login OAuth')).toBeInTheDocument();
  });

  it('renders epic badge', () => {
    wrap(<RDKanbanCard story={baseStory as any} projetId="p1" epics={epics as any} />);
    expect(screen.getByText('Auth Epic')).toBeInTheDocument();
  });

  it('renders points badge', () => {
    wrap(<RDKanbanCard story={baseStory as any} projetId="p1" epics={epics as any} />);
    expect(screen.getByText('8 pts')).toBeInTheDocument();
  });

  it('renders task progress', () => {
    wrap(<RDKanbanCard story={baseStory as any} projetId="p1" epics={epics as any} />);
    expect(screen.getByText('3/5')).toBeInTheDocument();
  });

  it('renders "Sans epic" when no epic', () => {
    wrap(<RDKanbanCard story={{ ...baseStory, epic_id: null } as any} projetId="p1" epics={epics as any} />);
    expect(screen.getByText('Sans epic')).toBeInTheDocument();
  });

  it('renders acceptance criteria count', () => {
    wrap(<RDKanbanCard story={baseStory as any} projetId="p1" epics={epics as any} />);
    expect(screen.getByText('4 CA')).toBeInTheDocument();
  });

  it('renders assignee initials', () => {
    wrap(<RDKanbanCard story={baseStory as any} projetId="p1" epics={epics as any} />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders description preview', () => {
    wrap(<RDKanbanCard story={baseStory as any} projetId="p1" epics={epics as any} />);
    expect(screen.getByText('Ajouter OAuth2 pour Google')).toBeInTheDocument();
  });
});
