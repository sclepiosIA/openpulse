import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SupportKPIs } from '@/components/support/SupportKPIs';

vi.mock('@/hooks/support/useSupportTickets', () => ({
  useSupportStats: vi.fn(),
}));

import { useSupportStats } from '@/hooks/support/useSupportTickets';

describe('SupportKPIs', () => {
  it('should show loading skeletons', () => {
    (useSupportStats as any).mockReturnValue({ data: null, isLoading: true });
    const { container } = render(<SupportKPIs />);
    expect(container.querySelectorAll('.grid > *').length).toBe(6);
  });

  it('should render all 6 KPIs', () => {
    (useSupportStats as any).mockReturnValue({
      data: {
        total: 42,
        nouveau: 5,
        en_cours: 10,
        en_attente: 3,
        critique: 2,
        resolu: 22,
        sla_breached: 0,
        avg_resolution_hours: 4.5,
      },
      isLoading: false,
    });
    render(<SupportKPIs />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Total tickets')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Nouveaux')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('En cours')).toBeInTheDocument();
    expect(screen.getByText('22')).toBeInTheDocument();
    expect(screen.getByText('Résolus')).toBeInTheDocument();
  });

  it('should show SLA breached warning', () => {
    (useSupportStats as any).mockReturnValue({
      data: {
        total: 10, nouveau: 1, en_cours: 2, en_attente: 1, critique: 0, resolu: 6,
        sla_breached: 3,
        avg_resolution_hours: 8,
      },
      isLoading: false,
    });
    render(<SupportKPIs />);
    expect(screen.getByText('3 SLA dépassé(s)')).toBeInTheDocument();
  });

  it('should show average resolution time', () => {
    (useSupportStats as any).mockReturnValue({
      data: {
        total: 10, nouveau: 1, en_cours: 2, en_attente: 1, critique: 0, resolu: 6,
        sla_breached: 0,
        avg_resolution_hours: 12,
      },
      isLoading: false,
    });
    render(<SupportKPIs />);
    expect(screen.getByText('Temps moyen de résolution : 12h')).toBeInTheDocument();
  });

  it('should handle zero stats', () => {
    (useSupportStats as any).mockReturnValue({
      data: {
        total: 0, nouveau: 0, en_cours: 0, en_attente: 0, critique: 0, resolu: 0,
        sla_breached: 0,
        avg_resolution_hours: null,
      },
      isLoading: false,
    });
    render(<SupportKPIs />);
    expect(screen.getByText('Total tickets')).toBeInTheDocument();
  });
});
