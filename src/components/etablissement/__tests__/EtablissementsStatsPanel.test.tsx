import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EtablissementsStatsPanel } from '../EtablissementsStatsPanel';

const etablissements = [
  { id: '1', nom: 'CHU Test', statut: 'Production', region: 'Île-de-France', type: 'CHU', progression: 80 },
  { id: '2', nom: 'Clinique A', statut: 'Production', region: 'Île-de-France', type: 'Clinique', progression: 60 },
  { id: '3', nom: 'Hôpital B', statut: 'Prospect', region: 'PACA', type: 'CH', progression: 20 },
] as any;

describe('EtablissementsStatsPanel', () => {
  it('renders stats accordion', () => {
    render(
      <MemoryRouter>
        <EtablissementsStatsPanel etablissements={etablissements} />
      </MemoryRouter>
    );
    expect(screen.getByText(/Statistiques/i)).toBeInTheDocument();
  });

  it('renders container', () => {
    const { container } = render(
      <MemoryRouter>
        <EtablissementsStatsPanel etablissements={etablissements} />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
