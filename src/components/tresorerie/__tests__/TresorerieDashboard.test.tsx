import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TresorerieDashboard } from '../TresorerieDashboard';

// Mock hooks
const mockRevenus = [
  { id: '1', mois: '2026-02-01', montant_prevu: 10000, montant_paye: 10000, statut: 'paye', date_facture: '2026-01-15' },
  { id: '2', mois: '2026-02-01', montant_prevu: 5000, montant_paye: null, statut: 'facture', date_facture: '2025-12-01' },
  { id: '3', mois: '2026-01-01', montant_prevu: 8000, montant_paye: 8000, statut: 'paye', date_facture: '2025-12-20' },
];

const mockDepenses = [
  { id: 'd1', date_prevue: '2026-02-10', montant: 3000, statut: 'paye', categorie: 'salaires' },
  { id: 'd2', date_prevue: '2026-02-15', montant: 2000, statut: 'en_attente', categorie: 'loyer' },
  { id: 'd3', date_prevue: '2026-01-05', montant: 1500, statut: 'en_attente', categorie: 'divers' }, // en retard
];

vi.mock('@/hooks/tresorerie/useTresorerieRevenus', () => ({
  useTresorerieRevenus: () => ({
    revenus: mockRevenus,
    isLoading: false,
    marquerPaye: vi.fn(),
    isUpdating: false,
  }),
}));

vi.mock('@/hooks/tresorerie/useTresorerieDepenses', () => ({
  useTresorerieDepenses: () => ({
    depenses: mockDepenses,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/tresorerie/useQontoTransactions', () => ({
  useQontoTransactions: () => ({
    connection: { bank_accounts: [{ balance: 50000 }], last_sync_at: '2026-02-14T10:00:00Z' },
    transactions: [
      { id: 't1', type_operation: 'credit', reconcilie: false },
      { id: 't2', type_operation: 'credit', reconcilie: true },
    ],
    sync: vi.fn(),
    isSyncing: false,
  }),
}));

vi.mock('@/hooks/tresorerie/useQontoClientInvoices', () => ({
  useQontoClientInvoices: () => ({
    invoices: [],
    totalAEncaisser: 7500,
    isLoading: false,
  }),
}));

// Mock recharts to avoid canvas/SVG issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  ComposedChart: ({ children }: any) => <div data-testid="composed-chart">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Bar: () => <div />,
  Line: () => <div />,
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  BarChart: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../QontoAEncaisserDetailDialog', () => ({
  QontoAEncaisserDetailDialog: () => <div data-testid="a-encaisser-dialog" />,
}));

describe('TresorerieDashboard', () => {
  const onNavigateToTab = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dashboard container', () => {
    render(<TresorerieDashboard onNavigateToTab={onNavigateToTab} />);
    expect(screen.getByTestId('tresorerie-dashboard')).toBeInTheDocument();
  });

  it('displays Qonto balance', () => {
    render(<TresorerieDashboard onNavigateToTab={onNavigateToTab} />);
    expect(screen.getByText('Solde Qonto')).toBeInTheDocument();
    // 50000€ formatted
    expect(screen.getByText(/50[\s\u202f]000/)).toBeInTheDocument();
  });

  it('shows KPI cards', () => {
    render(<TresorerieDashboard onNavigateToTab={onNavigateToTab} />);
    expect(screen.getByText('Revenus du mois')).toBeInTheDocument();
    expect(screen.getByText('Dépenses du mois')).toBeInTheDocument();
    expect(screen.getByText('Flux de trésorerie')).toBeInTheDocument();
    expect(screen.getByText('À encaisser')).toBeInTheDocument();
    expect(screen.getByText('À payer')).toBeInTheDocument();
    expect(screen.getByText('Solde calculé')).toBeInTheDocument();
  });

  it('displays revenue of the month correctly', () => {
    render(<TresorerieDashboard onNavigateToTab={onNavigateToTab} />);
    // Feb 2026 revenus: 10000 + 5000 = 15000 — appears in KPI + cashflow, use getAllByText
    const matches = screen.getAllByText(/15[\s\u202f]000/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('shows summary cards at bottom', () => {
    render(<TresorerieDashboard onNavigateToTab={onNavigateToTab} />);
    expect(screen.getByText('Factures encaissées')).toBeInTheDocument();
    expect(screen.getByText('En attente de paiement')).toBeInTheDocument();
    expect(screen.getByText('Dépenses en retard')).toBeInTheDocument();
  });

  it('displays late expense alert', () => {
    render(<TresorerieDashboard onNavigateToTab={onNavigateToTab} />);
    // d3 is late — alert banner + summary card both mention it
    const matches = screen.getAllByText(/dépense.*en retard/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('shows sync button', () => {
    render(<TresorerieDashboard onNavigateToTab={onNavigateToTab} />);
    expect(screen.getByText('Synchroniser')).toBeInTheDocument();
  });

  it('renders charts', () => {
    render(<TresorerieDashboard onNavigateToTab={onNavigateToTab} />);
    expect(screen.getByText('Évolution sur 6 mois')).toBeInTheDocument();
    expect(screen.getByText('Tendance du cashflow')).toBeInTheDocument();
  });

  // Test mort supprimé (audit AUDIT_TESTS_2026-06-02 §3.1) :
  // l'ancien `it('shows loading state when data is loading')` n'avait
  // aucun `expect()` actif — `vi.doMock` après le 1er import du composant
  // est sans effet. Le chemin loading sera couvert par un test dédié
  // (mock à la racine du module via `vi.hoisted`).
});
