import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { EtablissementsTableView } from '../EtablissementsTableView';

vi.mock('@/hooks/shared/useSmartNavigation', () => ({
  useSmartNavigation: () => ({ smartNavigate: vi.fn(), navigate: vi.fn() }),
}));

vi.mock('@/hooks/profile/useProfileAvatarByEmail', () => ({
  useProfileAvatarByEmail: () => ({ data: null, isLoading: false }),
}));

const etabs = [
  { id: 'e1', nom: 'CHU Lyon', ville: 'Lyon', statut: 'Production', logo_url: null, nombre_passages: 50000 },
  { id: 'e2', nom: 'Clinique Pasteur', ville: 'Paris', statut: 'Déploiement', logo_url: null, nombre_passages: 20000 },
] as any[];

describe('EtablissementsTableView', () => {
  it('renders table headers', () => {
    renderWithProviders(<EtablissementsTableView etablissements={etabs} />);
    expect(screen.getByText('Nom')).toBeInTheDocument();
    expect(screen.getByText('Ville')).toBeInTheDocument();
    expect(screen.getByText('Statut')).toBeInTheDocument();
  });

  it('renders etablissement rows', () => {
    renderWithProviders(<EtablissementsTableView etablissements={etabs} />);
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument();
    expect(screen.getByText('Clinique Pasteur')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    renderWithProviders(<EtablissementsTableView etablissements={[]} />);
    expect(screen.getByText(/Aucun/i)).toBeInTheDocument();
  });
});
