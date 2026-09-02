import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RHAlerts } from '@/components/rh/RHAlerts';

vi.mock('@/hooks/hr/useRHAnalytics', () => ({
  useRHAnalytics: vi.fn(),
}));

vi.mock('@/hooks/hr/useRHKPIs', () => ({
  useRHKPIs: vi.fn(),
}));

import { useRHAnalytics } from '@/hooks/hr/useRHAnalytics';
import { useRHKPIs } from '@/hooks/hr/useRHKPIs';

const mockAnalytics = (overrides = {}) => ({
  turnover12Mois: { tauxTurnover: 8, entrees: 3, sorties: 2 },
  ancienneteMoyenne: 24,
  ...overrides,
});

const mockKPIs = (overrides = {}) => ({
  effectif_total: 10,
  effectif_actif: 10,
  taux_absenteisme: 3,
  ...overrides,
});

describe('RHAlerts', () => {
  it('should show loading skeleton', () => {
    (useRHAnalytics as any).mockReturnValue({ data: null, isLoading: true });
    (useRHKPIs as any).mockReturnValue({ data: null, isLoading: true });
    render(<RHAlerts />);
    expect(screen.getByText('Alertes et recommandations')).toBeInTheDocument();
  });

  it('should show "Aucune donnée" when no data', () => {
    (useRHAnalytics as any).mockReturnValue({ data: null, isLoading: false });
    (useRHKPIs as any).mockReturnValue({ data: null, isLoading: false });
    render(<RHAlerts />);
    expect(screen.getByText('Aucune donnée disponible')).toBeInTheDocument();
  });

  it('should show high absenteeism alert', () => {
    (useRHAnalytics as any).mockReturnValue({ data: mockAnalytics(), isLoading: false });
    (useRHKPIs as any).mockReturnValue({ data: mockKPIs({ taux_absenteisme: 8 }), isLoading: false });
    render(<RHAlerts />);
    expect(screen.getByText("Taux d'absentéisme élevé")).toBeInTheDocument();
  });

  it('should show positive absenteeism message', () => {
    (useRHAnalytics as any).mockReturnValue({ data: mockAnalytics(), isLoading: false });
    (useRHKPIs as any).mockReturnValue({ data: mockKPIs({ taux_absenteisme: 2 }), isLoading: false });
    render(<RHAlerts />);
    expect(screen.getByText("Excellent taux d'absentéisme")).toBeInTheDocument();
  });

  it('should show high turnover alert', () => {
    (useRHAnalytics as any).mockReturnValue({
      data: mockAnalytics({ turnover12Mois: { tauxTurnover: 20, entrees: 5, sorties: 8 } }),
      isLoading: false,
    });
    (useRHKPIs as any).mockReturnValue({ data: mockKPIs(), isLoading: false });
    render(<RHAlerts />);
    expect(screen.getByText('Turnover élevé')).toBeInTheDocument();
  });

  it('should show incomplete data alert', () => {
    (useRHAnalytics as any).mockReturnValue({ data: mockAnalytics(), isLoading: false });
    (useRHKPIs as any).mockReturnValue({ data: mockKPIs({ effectif_total: 12, effectif_actif: 10 }), isLoading: false });
    render(<RHAlerts />);
    expect(screen.getByText('Données salariales incomplètes')).toBeInTheDocument();
  });

  it('should show junior team alert', () => {
    (useRHAnalytics as any).mockReturnValue({ data: mockAnalytics({ ancienneteMoyenne: 6 }), isLoading: false });
    (useRHKPIs as any).mockReturnValue({ data: mockKPIs(), isLoading: false });
    render(<RHAlerts />);
    expect(screen.getByText('Équipe junior')).toBeInTheDocument();
  });
});
