import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

const { mockHook, initialMockHook } = vi.hoisted(() => {
  const initialMockHook = {
    periodes: [],
    isLoading: false,
    totalPrevuAnnuel: 120000,
    totalEncaisse: 80000,
    totalFacture: 30000,
    totalEnRetard: 10000,
    nbEnRetard: 2,
    nbPrevu: 12,
    nbEncaisse: 8,
    nbFacture: 3,
    tauxEncaissement: 67,
    prochainsVirements: [],
    paiementsAttendusAnnee: [],
    periodesEnRetard: [],
    evolution: [],
    statutPieData: [],
    currentYear: 2026,
    parStatut: {},
    detailPrevu: [],
    detailEncaisse: [],
    detailFacture: [],
    detailEnRetard: [],
  };

  return {
    initialMockHook,
    mockHook: { ...initialMockHook },
  };
});

vi.mock('@/hooks/billing/useAllFacturationPeriodes', () => ({
  useAllFacturationPeriodes: () => mockHook,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className = '', ...props }: any) => (
    <div data-testid="skeleton-loader" className={`animate-pulse ${className}`} {...props} />
  ),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => null,
  Bar: () => null,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import { FacturationDashboard } from '../FacturationDashboard';

describe('FacturationDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockHook, initialMockHook);
  });

  afterEach(() => {
    cleanup();
    Object.assign(mockHook, initialMockHook);
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals?.();
    vi.unstubAllEnvs?.();
  });

  it('renders the 4 KPI labels (Prévu / Encaissé / Facturé / En retard)', async () => {
    render(<FacturationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total annuel prévu')).toBeInTheDocument();
      expect(screen.getByText('Encaissé')).toBeInTheDocument();
      expect(screen.getByText('Facturé (à encaisser)')).toBeInTheDocument();
      expect(screen.getByText('En retard')).toBeInTheDocument();
    });
  });

  it('renders the tauxEncaissement from the hook', async () => {
    render(<FacturationDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/67% du prévu annuel/)).toBeInTheDocument();
    });
  });

  it('shows skeleton loaders when isLoading=true', async () => {
    mockHook.isLoading = true;

    const { container } = render(<FacturationDashboard />);

    await waitFor(() => {
      expect(
        screen.queryAllByTestId('skeleton-loader').length ||
          container.querySelectorAll('[class*="skeleton" i], .animate-pulse').length,
      ).toBeGreaterThan(0);
    });
  });
});