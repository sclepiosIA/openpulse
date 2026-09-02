import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/components/ui/EntityAvatar', () => ({
  EntityAvatar: ({ name }: any) => <div data-testid="entity-avatar">{name}</div>,
}));

import { GroupeHeader } from '../GroupeHeader';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const groupe = {
  id: 'g1',
  nom: 'Groupe Hospitalier Nord',
  type: 'GHT',
  description: 'Un grand groupe',
  ville_siege: 'Paris',
  region: 'Île-de-France',
  email: 'contact@ghn.fr',
  telephone: '0100000000',
  logo_url: null,
  nombre_etablissements: 12,
  modules_deployes: ['urgences', 'pharmacie'],
};

const wrap = (ui: React.ReactElement) => (
  <QueryClientProvider client={qc}>
    <MemoryRouter>{ui}</MemoryRouter>
  </QueryClientProvider>
);

describe('GroupeHeader', () => {
  it('renders groupe name', () => {
    render(wrap(
      <GroupeHeader
        groupe={groupe}
        isFavorite={false}
        onToggleFavorite={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onExportPDF={vi.fn()}
      />
    ));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Groupe Hospitalier Nord');
  });

  it('renders location', () => {
    render(wrap(
      <GroupeHeader
        groupe={groupe}
        isFavorite={false}
        onToggleFavorite={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onExportPDF={vi.fn()}
      />
    ));
    expect(screen.getByText(/Paris.*Île-de-France/)).toBeInTheDocument();
  });

  it('renders etablissement count', () => {
    render(wrap(
      <GroupeHeader
        groupe={groupe}
        isFavorite={false}
        onToggleFavorite={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onExportPDF={vi.fn()}
      />
    ));
    const matches = screen.getAllByText(/12/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
