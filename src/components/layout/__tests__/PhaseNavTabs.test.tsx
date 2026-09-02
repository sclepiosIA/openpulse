import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/prospects' }),
}));

import { PhaseNavTabs } from '../PhaseNavTabs';

describe('PhaseNavTabs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders 3 phase tabs', () => {
    render(<PhaseNavTabs activePhase="commercial" />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('navigates on click to inactive tab', () => {
    render(<PhaseNavTabs activePhase="commercial" />);
    // Click "Production" tab (3rd button)
    fireEvent.click(screen.getAllByRole('button')[2]);
    expect(mockNavigate).toHaveBeenCalledWith('/production');
  });

  it('does not navigate when clicking active tab', () => {
    render(<PhaseNavTabs activePhase="commercial" />);
    fireEvent.click(screen.getAllByRole('button')[0]); // already active
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows counts when provided', () => {
    render(<PhaseNavTabs activePhase="commercial" counts={{ commercial: 5, deploiement: 3, production: 12 }} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
