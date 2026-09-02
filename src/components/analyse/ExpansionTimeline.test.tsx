/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { ExpansionTimeline } from './ExpansionTimeline';

const { STABLE_AUTH } = vi.hoisted(() => ({
  STABLE_AUTH: {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>
      {children}
    </h2>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
  }) => (
    <span data-testid="badge" data-variant={variant ?? ''} className={className}>
      {children}
    </span>
  ),
}));

vi.mock('lucide-react', () => ({
  Calendar: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="calendar-icon" {...props} />,
  TrendingUp: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="trending-icon" {...props} />,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => STABLE_AUTH,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => STABLE_AUTH,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => STABLE_AUTH,
}));

describe('ExpansionTimeline', () => {
  it("affiche l'état vide quand aucune date de signature n'est disponible", () => {
    render(
      <ExpansionTimeline
        etablissements={[
          { id: '1', ville: 'Paris', region: 'Île-de-France', date_signature: null },
          { id: '2', ville: 'Lyon', region: 'Auvergne-Rhône-Alpes' },
        ]}
      />,
    );

    expect(screen.getByText("Timeline d'Expansion")).toBeInTheDocument();
    expect(screen.getByText('Aucune donnée de date de signature disponible')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-icon')).toBeInTheDocument();
    expect(screen.queryByText(/nouveaux/)).not.toBeInTheDocument();
  });

  it('regroupe par année, trie du plus récent au plus ancien et affiche régions + villes avec limites', () => {
    const etablissements = [
      { id: 'e1', ville: 'Paris', region: 'Île-de-France', date_signature: '2024-01-15' },
      { id: 'e2', ville: 'Lyon', region: 'Auvergne-Rhône-Alpes', date_signature: '2024-03-10' },
      { id: 'e3', ville: 'Marseille', region: 'Provence-Alpes-Côte d’Azur', date_signature: '2024-04-12' },
      { id: 'e4', ville: 'Lille', region: 'Hauts-de-France', date_signature: '2024-05-20' },
      { id: 'e5', ville: 'Bordeaux', region: 'Nouvelle-Aquitaine', date_signature: '2024-06-18' },
      { id: 'e6', ville: 'Nantes', region: 'Pays de la Loire', date_signature: '2024-07-08' },
      { id: 'e7', ville: 'Nice', region: 'Provence-Alpes-Côte d’Azur', date_signature: '2023-02-11' },
      { id: 'e8', ville: 'Toulouse', region: 'Occitanie', date_signature: '2023-09-01' },
      { id: 'e9', ville: 'Rouen', region: 'Normandie', date_signature: null },
    ];

    render(<ExpansionTimeline etablissements={etablissements} />);

    expect(screen.getByText("Timeline d'Expansion")).toBeInTheDocument();

    const year2024 = screen.getByRole('heading', { name: '2024' });
    const year2023 = screen.getByRole('heading', { name: '2023' });
    const headings = screen.getAllByRole('heading');

    expect(headings[1]).toHaveTextContent('2024');
    expect(headings[2]).toHaveTextContent('2023');

    const section2024 = year2024.closest('.flex-1');
    const section2023 = year2023.closest('.flex-1');

    expect(section2024).not.toBeNull();
    expect(section2023).not.toBeNull();

    if (section2024 && section2023) {
      expect(within(section2024).getByText('6 nouveaux')).toBeInTheDocument();
      expect(
        within(section2024).getByText('6 régions : Île-de-France, Auvergne-Rhône-Alpes, Provence-Alpes-Côte d’Azur +3'),
      ).toBeInTheDocument();

      expect(within(section2024).getByText('Paris')).toBeInTheDocument();
      expect(within(section2024).getByText('Lyon')).toBeInTheDocument();
      expect(within(section2024).getByText('Marseille')).toBeInTheDocument();
      expect(within(section2024).getByText('Lille')).toBeInTheDocument();
      expect(within(section2024).getByText('Bordeaux')).toBeInTheDocument();
      expect(within(section2024).getByText('+1')).toBeInTheDocument();
      expect(within(section2024).queryByText('Nantes')).not.toBeInTheDocument();

      expect(within(section2023).getByText('2 nouveaux')).toBeInTheDocument();
      expect(within(section2023).getByText('2 régions : Provence-Alpes-Côte d’Azur, Occitanie')).toBeInTheDocument();
      expect(within(section2023).getByText('Nice')).toBeInTheDocument();
      expect(within(section2023).getByText('Toulouse')).toBeInTheDocument();
    }

    expect(screen.getAllByTestId('trending-icon')).toHaveLength(2);
  });

  it("gère correctement le singulier pour une seule région et n'affiche pas de compteur supplémentaire si 5 villes ou moins", () => {
    const etablissements = [
      { id: 'a1', ville: 'Paris', region: 'Île-de-France', date_signature: '2022-01-01' },
      { id: 'a2', ville: 'Versailles', region: 'Île-de-France', date_signature: '2022-02-01' },
      { id: 'a3', ville: 'Nanterre', region: 'Île-de-France', date_signature: '2022-03-01' },
    ];

    render(<ExpansionTimeline etablissements={etablissements} />);

    const section2022 = screen.getByRole('heading', { name: '2022' }).closest('.flex-1');

    expect(section2022).not.toBeNull();

    if (section2022) {
      expect(within(section2022).getByText('3 nouveaux')).toBeInTheDocument();
      expect(within(section2022).getByText('1 région : Île-de-France')).toBeInTheDocument();
      expect(within(section2022).getByText('Paris')).toBeInTheDocument();
      expect(within(section2022).getByText('Versailles')).toBeInTheDocument();
      expect(within(section2022).getByText('Nanterre')).toBeInTheDocument();
      expect(within(section2022).queryByText(/^\+\d+$/)).not.toBeInTheDocument();
    }
  });
});