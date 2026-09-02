import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/hr/useRHMutations', () => ({
  useCreateDemandeFormation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

import { RHDemandeFormation } from '../RHDemandeFormation';

describe('RHDemandeFormation', () => {
  it('renders form title', () => {
    render(<RHDemandeFormation />);
    expect(screen.getByText('Demande de formation')).toBeInTheDocument();
  });

  it('renders titre input', () => {
    render(<RHDemandeFormation />);
    expect(screen.getByLabelText(/Titre de la formation/i)).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(<RHDemandeFormation />);
    expect(screen.getByText(/Soumettre la demande/i)).toBeInTheDocument();
  });
});
