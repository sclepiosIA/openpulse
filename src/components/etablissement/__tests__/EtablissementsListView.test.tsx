import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EtablissementsListView } from '../EtablissementsListView';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/hooks/shared/useSmartNavigation', () => ({
  useSmartNavigation: () => ({ smartNavigate: vi.fn(), navigate: vi.fn() }),
}));

vi.mock('@/hooks/profile/useProfileAvatarByEmail', () => ({
  useProfileAvatarByEmail: () => ({ data: null }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  },
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const etabs = [
  { id: 'e1', nom: 'CHU Lyon', ville: 'Lyon', statut: 'Production', logo_url: null },
  { id: 'e2', nom: 'Clinique Pasteur', ville: 'Paris', statut: 'Déploiement', logo_url: null },
] as any[];

describe('EtablissementsListView', () => {
  it('renders etablissements', () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <EtablissementsListView etablissements={etabs} />
        </QueryClientProvider>
      </MemoryRouter>
    );
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument();
    expect(screen.getByText('Clinique Pasteur')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <EtablissementsListView etablissements={[]} />
        </QueryClientProvider>
      </MemoryRouter>
    );
    expect(screen.getByText('Aucun établissement trouvé')).toBeInTheDocument();
  });
});
