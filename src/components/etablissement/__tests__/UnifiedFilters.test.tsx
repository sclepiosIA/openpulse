import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UnifiedFilters } from '../UnifiedFilters';

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('UnifiedFilters', () => {
  const etablissements = [
    { id: 'e1', nom: 'CHU Lyon', statut: 'Production', created_at: '2026-01-01' },
    { id: 'e2', nom: 'CHU Bordeaux', statut: 'Prospect', created_at: '2026-01-01' },
  ] as any[];

  it('renders main filter tabs', () => {
    wrap(<UnifiedFilters etablissements={etablissements} allCount={2} />);
    expect(screen.getByText('Tous')).toBeInTheDocument();
    expect(screen.getByText('Prospects')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('renders deploiement tab', () => {
    wrap(<UnifiedFilters etablissements={etablissements} allCount={2} />);
    expect(screen.getByText('Déploiement')).toBeInTheDocument();
  });

  it('renders tabs-only variant', () => {
    wrap(<UnifiedFilters etablissements={etablissements} allCount={2} variant="tabs-only" />);
    expect(screen.getByText('Tous')).toBeInTheDocument();
  });

  it('renders with empty data', () => {
    wrap(<UnifiedFilters etablissements={[]} allCount={0} />);
    expect(screen.getByText('Tous')).toBeInTheDocument();
  });
});
