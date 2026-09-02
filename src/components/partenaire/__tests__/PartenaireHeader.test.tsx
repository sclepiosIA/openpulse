import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/components/ui/EntityAvatar', () => ({
  EntityAvatar: ({ name }: any) => <div data-testid="avatar">{name}</div>,
}));
vi.mock('@/components/ui/partenaire-badge', () => ({
  PartenaireBadge: () => <span data-testid="badge" />,
}));
vi.mock('@/components/etablissement/QuickActionsBar', () => ({
  QuickActionsBar: ({ onEdit }: any) => <button onClick={onEdit}>Edit</button>,
}));

import { PartenaireHeader } from '../PartenaireHeader';

describe('PartenaireHeader', () => {
  const partenaire = {
    id: '1',
    nom: 'ACME Corp',
    type_partenaire: 'fournisseur',
    ville: 'Paris',
    statut_relation: 'Actif',
    email: 'a@acme.com',
    telephone: '0612345678',
  };
  const onEdit = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it('renders partenaire name in heading', () => {
    render(
      <MemoryRouter>
        <PartenaireHeader partenaire={partenaire} onEdit={onEdit} onDelete={onDelete} />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ACME Corp');
  });

  it('renders city', () => {
    render(
      <MemoryRouter>
        <PartenaireHeader partenaire={partenaire} onEdit={onEdit} onDelete={onDelete} />
      </MemoryRouter>
    );
    expect(screen.getByText('Paris')).toBeInTheDocument();
  });

  it('renders contacts count', () => {
    render(
      <MemoryRouter>
        <PartenaireHeader partenaire={partenaire} contactsCount={5} onEdit={onEdit} onDelete={onDelete} />
      </MemoryRouter>
    );
    expect(screen.getByText(/5 contacts/)).toBeInTheDocument();
  });

  it('shows delete confirmation dialog on delete click', () => {
    render(
      <MemoryRouter>
        <PartenaireHeader partenaire={partenaire} onEdit={onEdit} onDelete={onDelete} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTitle('Supprimer'));
    expect(screen.getByText('Confirmer la suppression')).toBeInTheDocument();
  });

  it('renders breadcrumb navigation', () => {
    render(
      <MemoryRouter>
        <PartenaireHeader partenaire={partenaire} onEdit={onEdit} onDelete={onDelete} />
      </MemoryRouter>
    );
    expect(screen.getByText('Partenaires')).toBeInTheDocument();
  });
});
