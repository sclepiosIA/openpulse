import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileEstablishmentCard } from '../MobileEstablishmentCard';

const etab = {
  id: 'e1',
  nom: 'CHU Lyon',
  ville: 'Lyon',
  statut: 'Production',
  logo_url: null,
  health_score: 80,
  nombre_passages: 50000,
  taches: [],
};

describe('MobileEstablishmentCard', () => {
  it('renders etablissement name', () => {
    render(
      <MemoryRouter>
        <MobileEstablishmentCard etablissement={etab} />
      </MemoryRouter>
    );
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(
      <MemoryRouter>
        <MobileEstablishmentCard etablissement={etab} />
      </MemoryRouter>
    );
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('renders initials avatar', () => {
    render(
      <MemoryRouter>
        <MobileEstablishmentCard etablissement={etab} />
      </MemoryRouter>
    );
    expect(screen.getByText('CL')).toBeInTheDocument();
  });
});
