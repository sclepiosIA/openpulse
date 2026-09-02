import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockGoToLevel = vi.fn();
const mockResetDrilldown = vi.fn();

vi.mock('@/hooks/analytics/useDrilldown', () => ({
  useDrilldown: () => ({
    breadcrumbs: [
      { label: 'Vue globale', level: 0 },
      { label: 'CHU Bordeaux', level: 1 },
      { label: 'Service A', level: 2 },
    ],
    goToLevel: mockGoToLevel,
    resetDrilldown: mockResetDrilldown,
  }),
}));

import { RapportsBreadcrumbs } from '../RapportsBreadcrumbs';

describe('RapportsBreadcrumbs', () => {
  it('renders all breadcrumb levels', () => {
    render(<RapportsBreadcrumbs />);
    expect(screen.getByText('Vue globale')).toBeInTheDocument();
    expect(screen.getByText('CHU Bordeaux')).toBeInTheDocument();
    expect(screen.getByText('Service A')).toBeInTheDocument();
  });

  it('renders reset button', () => {
    render(<RapportsBreadcrumbs />);
    expect(screen.getByText('Réinitialiser')).toBeInTheDocument();
  });

  it('calls resetDrilldown on reset click', () => {
    render(<RapportsBreadcrumbs />);
    fireEvent.click(screen.getByText('Réinitialiser'));
    expect(mockResetDrilldown).toHaveBeenCalled();
  });

  it('calls goToLevel on breadcrumb click', () => {
    render(<RapportsBreadcrumbs />);
    fireEvent.click(screen.getByText('CHU Bordeaux'));
    expect(mockGoToLevel).toHaveBeenCalledWith(1);
  });
});
