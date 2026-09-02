import React from 'react';
import { render, screen } from '@testing-library/react';
import MRRDashboard from './MRRDashboard';

const { mockUseMRRData, SUCCESS_DATA, EMPTY_DATA, LOADING_DATA, NEGATIVE_DATA } = vi.hoisted(() => {
  const SUCCESS_DATA = {
    currentMRR: 5000,
    arr: 60000,
    mrrVariation: 12.5,
    payingClients: 7,
    monthlyHistory: [
      { label: 'Jan 24', mrr: 4000 },
      { label: 'Fév 24', mrr: 5000 },
    ],
    topClients: [
      { id: 'c1', nom: 'Clinique Alpha', type_offre: 'Premium', mrr: 2000 },
      { id: 'c2', nom: 'EHPAD Beta', type_offre: null, mrr: 1500 },
    ],
    breakdown: [
      { type: 'Premium', mrr: 3000, count: 3 },
      { type: 'Standard', mrr: 2000, count: 4 },
    ],
    isLoading: false,
  };
  const EMPTY_DATA = {
    currentMRR: 0,
    arr: 0,
    mrrVariation: 0,
    payingClients: 0,
    monthlyHistory: [],
    topClients: [],
    breakdown: [],
    isLoading: false,
  };
  const LOADING_DATA = {
    currentMRR: 0,
    arr: 0,
    mrrVariation: 0,
    payingClients: 0,
    monthlyHistory: [],
    topClients: [],
    breakdown: [],
    isLoading: true,
  };
  const NEGATIVE_DATA = {
    ...SUCCESS_DATA,
    mrrVariation: -8.3,
  };
  return {
    mockUseMRRData: vi.fn(),
    SUCCESS_DATA,
    EMPTY_DATA,
    LOADING_DATA,
    NEGATIVE_DATA,
  };
});

vi.mock('@/hooks/analytics/useMRRData', () => ({
  useMRRData: mockUseMRRData,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  AreaChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

describe('MRRDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le message de chargement quand isLoading est true', () => {
    mockUseMRRData.mockReturnValue(LOADING_DATA);
    render(<MRRDashboard />);
    expect(screen.getByText('Chargement des données MRR…')).toBeTruthy();
    expect(screen.queryByText('MRR')).toBeNull();
  });

  it('affiche les KPI avec les valeurs métier formatées en euros', () => {
    mockUseMRRData.mockReturnValue(SUCCESS_DATA);
    render(<MRRDashboard />);

    expect(screen.getByText('MRR')).toBeTruthy();
    expect(screen.getByText('ARR')).toBeTruthy();
    expect(screen.getByText(/5\s000\s€/)).toBeTruthy();
    expect(screen.getByText(/60\s000\s€/)).toBeTruthy();
    expect(screen.getByText('+12.5%')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('Revenu mensuel récurrent')).toBeTruthy();
    expect(screen.getByText('Revenu annuel récurrent')).toBeTruthy();
    expect(screen.getByText('Établissements actifs')).toBeTruthy();
  });

  it('applique la classe positive sur la variation quand mrrVariation >= 0', () => {
    mockUseMRRData.mockReturnValue(SUCCESS_DATA);
    render(<MRRDashboard />);
    const variation = screen.getByText('+12.5%');
    expect(variation.className).toContain('text-emerald-600');
  });

  it('affiche la variation négative sans + et avec la classe rouge', () => {
    mockUseMRRData.mockReturnValue(NEGATIVE_DATA);
    render(<MRRDashboard />);
    const variation = screen.getByText('-8.3%');
    expect(variation.className).toContain('text-red-500');
  });

  it('affiche le top clients avec rang, nom, badge type_offre et MRR', () => {
    mockUseMRRData.mockReturnValue(SUCCESS_DATA);
    render(<MRRDashboard />);

    expect(screen.getByText('Top 10 clients par MRR')).toBeTruthy();
    expect(screen.getByText('1.')).toBeTruthy();
    expect(screen.getByText('Clinique Alpha')).toBeTruthy();
    expect(screen.getByText('2.')).toBeTruthy();
    expect(screen.getByText('EHPAD Beta')).toBeTruthy();
    expect(screen.getAllByText('Premium').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/1\s500\s€/)).toBeTruthy();
  });

  it('affiche la répartition par type avec montant et nombre de clients', () => {
    mockUseMRRData.mockReturnValue(SUCCESS_DATA);
    render(<MRRDashboard />);

    expect(screen.getByText("Répartition par type d'offre")).toBeTruthy();
    expect(screen.getByText('Standard')).toBeTruthy();
    expect(screen.getByText('(3 clients)')).toBeTruthy();
    expect(screen.getByText('(4 clients)')).toBeTruthy();
    expect(screen.getByText(/3\s000\s€/)).toBeTruthy();
  });

  it('affiche les messages vides quand topClients et breakdown sont vides', () => {
    mockUseMRRData.mockReturnValue(EMPTY_DATA);
    render(<MRRDashboard />);

    expect(screen.getByText('Aucun client actif')).toBeTruthy();
    expect(screen.getByText('Aucune donnée')).toBeTruthy();
    expect(screen.getByText('+0.0%')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('rend le conteneur de graphique avec le titre 12 mois glissants', () => {
    mockUseMRRData.mockReturnValue(SUCCESS_DATA);
    render(<MRRDashboard />);

    expect(screen.getByText('Évolution MRR — 12 mois glissants')).toBeTruthy();
    expect(screen.getByTestId('chart-container')).toBeTruthy();
  });
});