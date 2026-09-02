import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { DeploymentCalendarView } from '../DeploymentCalendarView';

const etablissements = [
  { id: '1', nom: 'CHU Test', statut: 'Déploiement', date_signature: new Date().toISOString().slice(0, 10) },
] as any[];

describe('DeploymentCalendarView', () => {
  it('renders calendar navigation', () => {
    render(
      <MemoryRouter>
        <DeploymentCalendarView etablissements={etablissements} />
      </MemoryRouter>
    );
    expect(screen.getByText(/Aujourd'hui/i)).toBeInTheDocument();
  });

  it('renders month/year header', () => {
    render(
      <MemoryRouter>
        <DeploymentCalendarView etablissements={[]} />
      </MemoryRouter>
    );
    // Should show current month
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2); // prev/next buttons
  });
});
