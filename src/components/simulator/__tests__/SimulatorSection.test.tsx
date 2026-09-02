import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SimulatorSection } from '../SimulatorSection';

vi.mock('../SimulatorContainer', () => ({
  SimulatorContainer: (props: any) => (
    <div data-testid="simulator-container" data-mode={props.mode} data-etab={props.etablissementId}>
      Simulator
    </div>
  ),
}));

describe('SimulatorSection', () => {
  it('renders card with title', () => {
    render(<SimulatorSection etablissementId="e1" etablissementNom="CHU Lyon" />);
    expect(screen.getByText('Simulateur de valorisation des urgences')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<SimulatorSection etablissementId="e1" etablissementNom="CHU Lyon" />);
    expect(screen.getByText(/Configurez l'offre commerciale/)).toBeInTheDocument();
  });

  it('passes props to SimulatorContainer', () => {
    render(<SimulatorSection etablissementId="e1" etablissementNom="CHU Lyon" />);
    const container = screen.getByTestId('simulator-container');
    expect(container.dataset.mode).toBe('etablissement');
    expect(container.dataset.etab).toBe('e1');
  });
});
