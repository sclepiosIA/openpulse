import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CompactEstablishmentCard } from '../CompactEstablishmentCard';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const etab = {
  id: 'e1',
  nom: 'CHU Bordeaux',
  ville: 'Bordeaux',
  region: 'Nouvelle-Aquitaine',
  type: 'CHU',
  statut: 'Production',
  progression: 75,
  engagement_score: 82,
};

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );

describe('CompactEstablishmentCard', () => {
  it('renders etablissement name', () => {
    wrap(<CompactEstablishmentCard etablissement={etab} />);
    expect(screen.getByText('CHU Bordeaux')).toBeInTheDocument();
  });

  it('renders ville and region', () => {
    wrap(<CompactEstablishmentCard etablissement={etab} />);
    expect(screen.getByText('Bordeaux • Nouvelle-Aquitaine')).toBeInTheDocument();
  });

  it('renders type badge', () => {
    wrap(<CompactEstablishmentCard etablissement={etab} />);
    expect(screen.getByText('CHU')).toBeInTheDocument();
  });

  it('renders progression', () => {
    wrap(<CompactEstablishmentCard etablissement={etab} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders fiche button', () => {
    wrap(<CompactEstablishmentCard etablissement={etab} />);
    expect(screen.getByText('Fiche')).toBeInTheDocument();
  });

  it('renders next task when available', () => {
    const etabWithTasks = {
      ...etab,
      taches: [
        { id: 't1', titre: 'Appeler Dr Martin', statut: 'A faire', echeance: '2026-04-01', priorite: 'high' },
      ],
    };
    wrap(<CompactEstablishmentCard etablissement={etabWithTasks} />);
    expect(screen.getByText('Appeler Dr Martin')).toBeInTheDocument();
  });
});
