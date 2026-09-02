import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/components/simulator', () => ({
  SimulatorContainer: () => <div data-testid="simulator">Simulator</div>,
}));

import SimulateurROI from '../SimulateurROI';

describe('SimulateurROI page', () => {
  it('renders title', () => {
    render(<SimulateurROI />);
    expect(screen.getByText(/Simulateur de Valorisation/)).toBeInTheDocument();
  });

  it('renders simulator container', () => {
    render(<SimulateurROI />);
    expect(screen.getByTestId('simulator')).toBeInTheDocument();
  });
});
