import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RapportsEtablissementMobileCard } from '../RapportsEtablissementMobileCard';

describe('RapportsEtablissementMobileCard', () => {
  const etab = {
    id: 'e1',
    nom: 'CHU Test',
    type: 'CHU',
    ca_total: 50000,
    taux_adoption: 75,
    satisfaction_moyenne: 4.5,
    nb_formations: 3,
  } as any;

  it('renders etablissement name', () => {
    render(<RapportsEtablissementMobileCard etablissement={etab} />);
    expect(screen.getByText('CHU Test')).toBeInTheDocument();
  });
});
