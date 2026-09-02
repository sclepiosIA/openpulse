import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockSupabaseModule } from '@/test-utils/supabaseMockFactory';

vi.mock('@/integrations/supabase/client', () => mockSupabaseModule());
vi.mock('@/hooks/crm/useGroupes', () => ({
  useGroupe: () => ({ data: { id: 'g1', nom: 'Groupe Test', type: 'GHT', region: 'IDF', progression_moyenne: 75.5, ca_total: 100000, nb_etablissements: 3 }, isLoading: false }),
  useDeleteGroupe: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/hooks/crm/useEtablissementGroupes', () => ({
  useEtablissementsInGroupe: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/crm/useContactsGroupe', () => ({
  useContactsGroupe: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/tasks/useTachesGroupe', () => ({
  useTachesGroupe: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/profile/useUserPreferences', () => ({
  useUserPreferences: () => ({
    toggleFavoriteGroupe: vi.fn(),
    isFavoriteGroupe: vi.fn(() => false),
    getPreference: vi.fn(),
    updatePreference: vi.fn(),
    toggleFavoriteEtablissement: vi.fn(),
    isFavoriteEtablissement: vi.fn(() => false),
    toggleFavoritePartenaire: vi.fn(),
    isFavoritePartenaire: vi.fn(() => false),
  }),
}));
vi.mock('@/lib/exportGroupesUtils', () => ({
  exportGroupesToPDF: vi.fn(),
}));
vi.mock('@/components/groupe/GroupeHeader', () => ({
  GroupeHeader: () => <div data-testid="groupe-header">Groupe Test</div>,
}));
vi.mock('@/components/groupe/GroupeConsolidatedView', () => ({
  GroupeConsolidatedView: () => <div />,
}));
vi.mock('@/components/groupe/GroupeEmailsTab', () => ({
  GroupeEmailsTab: () => <div />,
}));
vi.mock('@/components/groupe/GroupeEditDialog', () => ({
  GroupeEditDialog: () => null,
}));
vi.mock('@/components/EtablissementEditForm', () => ({
  EtablissementEditForm: () => null,
}));
vi.mock('@/components/groupe/GroupeDomainManager', () => ({
  GroupeDomainManager: () => null,
}));
vi.mock('@/components/groupe/GroupeAllTasksView', () => ({
  GroupeAllTasksView: () => null,
}));
vi.mock('@/components/groupe/GroupeEtablissementsTab', () => ({
  GroupeEtablissementsTab: () => <div />,
}));
vi.mock('@/components/groupe/GroupeContacts', () => ({
  GroupeContacts: () => <div />,
}));

import GroupeDetail from '../GroupeDetail';

describe('GroupeDetail page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/groupes/g1']}>
          <Routes>
            <Route path="/groupes/:id" element={<GroupeDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByTestId('groupe-header')).toBeInTheDocument();
  });
});
