import React from 'react';
import { render, screen, renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useScoreHistory } from '@/hooks/crm/useBehavioralScore';
import { ProspectSparkline } from './ProspectSparkline';

const { LOADING, SUCCESS, EMPTY, ERROR, current, mockUseScoreHistory } = vi.hoisted(() => {
  const LOADING = { data: undefined, isLoading: true, isError: false as boolean };
  const SUCCESS = {
    data: [
      { computed_at: '2024-03-15T15:00:00.000Z', score: 40 },
      { computed_at: '2024-03-16T15:00:00.000Z', score: 55 },
    ],
    isLoading: false,
    isError: false as boolean,
  };
  const EMPTY = { data: [] as Array<{ computed_at: string; score: number }>, isLoading: false, isError: false as boolean };
  const ERROR = { data: null as null, isLoading: false, isError: true as boolean, error: { message: 'x' } };
  const current = { ref: LOADING as { data: unknown; isLoading: boolean; isError: boolean; error?: { message: string } } };
  const mockUseScoreHistory = vi.fn(() => current.ref);
  return { LOADING, SUCCESS, EMPTY, ERROR, current, mockUseScoreHistory };
});

vi.mock('@/hooks/crm/useBehavioralScore', () => ({
  useScoreHistory: mockUseScoreHistory,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="skeleton" {...props} />,
}));

vi.mock('recharts', () => {
  const ResponsiveContainer = ({ children }: { children: React.ReactNode }) => <div data-testid="responsive">{children}</div>;
  const AreaChart = ({ data, children }: { data: unknown; children?: React.ReactNode }) => (
    <div data-testid="areachart">
      <div data-testid="areachart-data">{JSON.stringify(data)}</div>
      {children}
    </div>
  );
  const Area = () => <div data-testid="area" />;
  const Tooltip = () => null;
  return { ResponsiveContainer, AreaChart, Area, Tooltip };
});

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('ProspectSparkline', () => {
  it('affiche le Skeleton pendant le chargement et appelle le hook avec les valeurs par défaut', () => {
    current.ref = LOADING;
    render(<ProspectSparkline etablissementId="e1" height={80} />);
    const sk = screen.getByTestId('skeleton');
    expect(sk).toBeTruthy();
    expect((sk as HTMLDivElement).style.height).toBe('80px');
    expect(mockUseScoreHistory).toHaveBeenCalledTimes(1);
    expect(mockUseScoreHistory).toHaveBeenCalledWith('e1', 30);
  });

  it('rend le graphique avec les labels formatés et les scores en cas de succès', () => {
    current.ref = SUCCESS;
    render(<ProspectSparkline etablissementId="e1" />);
    const dataNode = screen.getByTestId('areachart-data');
    const parsed = JSON.parse(dataNode.textContent || '[]') as Array<{ label: string; score: number }>;
    expect(parsed.length).toBe(2);
    expect(parsed[0].label).toBe('15 mars');
    expect(parsed[0].score).toBe(40);
    expect(parsed[1].label).toBe('16 mars');
    expect(parsed[1].score).toBe(55);
  });

  it("affiche le message d'absence d'historique en cas d'erreur (data null)", () => {
    current.ref = ERROR;
    render(<ProspectSparkline etablissementId="e1" height={90} />);
    const msg = screen.getByText("Pas d'historique");
    expect(msg).toBeTruthy();
    expect((msg as HTMLDivElement).style.height).toBe('90px');
    expect(screen.queryByTestId('areachart-data')).toBeNull();
  });

  it('appelle le hook avec un nombre de jours personnalisé', () => {
    current.ref = LOADING;
    render(<ProspectSparkline etablissementId="e1" days={7} />);
    expect(mockUseScoreHistory).toHaveBeenCalledWith('e1', 7);
  });
});

describe('useScoreHistory mocked hook with QueryClientProvider wrapper', () => {
  it('retourne la référence stable', async () => {
    const wrapper = createWrapper();
    current.ref = EMPTY;
    const { result } = renderHook(() => useScoreHistory('eX', 14), { wrapper });
    expect(result.current).toBe(EMPTY);
    await act(async () => {});
  });
});