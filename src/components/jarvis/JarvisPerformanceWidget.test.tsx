import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';

const {
  METRICS_OK,
  METRICS_EMPTY,
  useJarvisPerformanceMetricsMock,
  getAllMetricsMock,
  getOverallHealthMock,
  shouldReduceContextMock,
  cnMock,
  ProgressMock,
  BadgeMock,
} = vi.hoisted(() => {
  const METRICS_OK = new Map<
    string,
    { callCount: number; avgLatency: number; successRate: number }
  >([
    ['tool_alpha', { callCount: 30, avgLatency: 210.2, successRate: 0.98 }],
    ['tool_beta', { callCount: 12, avgLatency: 110.4, successRate: 0.85 }],
    ['tool_gamma', { callCount: 5, avgLatency: 50.1, successRate: 0.9 }],
    ['tool_delta', { callCount: 2, avgLatency: 500.0, successRate: 0.2 }],
  ]);

  const METRICS_EMPTY = new Map<
    string,
    { callCount: number; avgLatency: number; successRate: number }
  >();

  const getAllMetricsMock = vi.fn(() => METRICS_OK);
  const getOverallHealthMock = vi.fn(() => 'good' as const);
  const shouldReduceContextMock = vi.fn(() => true);

  const useJarvisPerformanceMetricsMock = vi.fn(() => ({
    getAllMetrics: getAllMetricsMock,
    getOverallHealth: getOverallHealthMock,
    shouldReduceContext: shouldReduceContextMock,
  }));

  const cnMock = vi.fn((...args: Array<string | undefined | null | false>) =>
    args.filter(Boolean).join(' ')
  );

  const ProgressMock = vi.fn((props: { value?: number; className?: string }) => {
    const valueStr = typeof props.value === 'number' ? String(props.value) : '';
    return React.createElement('div', {
      'data-testid': 'progress',
      'data-value': valueStr,
      className: props.className || '',
    });
  });

  const BadgeMock = vi.fn((props: { children?: React.ReactNode; className?: string }) => {
    return React.createElement(
      'span',
      { 'data-testid': 'badge', className: props.className || '' },
      props.children
    );
  });

  return {
    METRICS_OK,
    METRICS_EMPTY,
    useJarvisPerformanceMetricsMock,
    getAllMetricsMock,
    getOverallHealthMock,
    shouldReduceContextMock,
    cnMock,
    ProgressMock,
    BadgeMock,
  };
});

vi.mock('@/hooks/jarvis/useJarvisPerformanceMetrics', () => ({
  useJarvisPerformanceMetrics: useJarvisPerformanceMetricsMock,
}));

vi.mock('@/lib/utils', () => ({
  cn: cnMock,
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: (props: { value?: number; className?: string }) => ProgressMock(props),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: (props: { children?: React.ReactNode; className?: string }) => BadgeMock(props),
}));

vi.mock('framer-motion', async () => {
  const ReactMod = await import('react');
  const Div = ReactMod.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...rest }, ref) => ReactMod.createElement('div', { ref, ...rest }, children)
  );
  Div.displayName = 'MotionDiv';
  return { motion: { div: Div } };
});

vi.mock('lucide-react', async () => {
  const ReactMod = await import('react');
  const Icon = (name: string) =>
    function C(props: { className?: string }) {
      return ReactMod.createElement('svg', { 'data-testid': name, className: props.className || '' });
    };
  return {
    Activity: Icon('Activity'),
    Zap: Icon('Zap'),
    TrendingUp: Icon('TrendingUp'),
    AlertTriangle: Icon('AlertTriangle'),
    CheckCircle2: Icon('CheckCircle2'),
  };
});

import { JarvisPerformanceWidget } from './JarvisPerformanceWidget';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('JarvisPerformanceWidget', () => {
  it('affiche les valeurs métier en mode complet (latence moy., succès, appels) + auto-optimisation + top outils', () => {
    getAllMetricsMock.mockReturnValue(METRICS_OK);
    getOverallHealthMock.mockReturnValue('good');
    shouldReduceContextMock.mockReturnValue(true);

    render(<JarvisPerformanceWidget />);

    const avgLatencyExpected = Math.round((210.2 + 110.4 + 50.1 + 500.0) / 4);
    const avgSuccessRateExpected = Math.round(((0.98 + 0.85 + 0.9 + 0.2) / 4) * 100);
    const totalCallsExpected = 30 + 12 + 5 + 2;

    expect(screen.getByText('Performance Jarvis')).toBeTruthy();

    expect(screen.getByText(`${avgLatencyExpected}ms`)).toBeTruthy();

    const successRateNodes = screen.getAllByText(`${avgSuccessRateExpected}%`);
    expect(successRateNodes.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText(String(totalCallsExpected))).toBeTruthy();

    const progress = screen.getByTestId('progress');
    expect(progress.getAttribute('data-value')).toBe(String(avgSuccessRateExpected));

    expect(screen.getByText('Auto-optimisation: réduction du contexte activée')).toBeTruthy();
    expect(screen.getByTestId('Zap')).toBeTruthy();

    expect(screen.getByText('Outils les plus utilisés')).toBeTruthy();

    expect(screen.getByText('tool alpha')).toBeTruthy();
    expect(screen.getByText('tool beta')).toBeTruthy();
    expect(screen.getByText('tool gamma')).toBeTruthy();
    expect(screen.queryByText('tool delta')).toBeNull();

    expect(screen.getByText('210ms')).toBeTruthy();
    expect(screen.getByText('110ms')).toBeTruthy();
    expect(screen.getByText('50ms')).toBeTruthy();

    const toolBadges = screen.getAllByTestId('badge').map((b) => b.textContent || '');
    expect(toolBadges).toContain('98%');
    expect(toolBadges).toContain('85%');
    expect(toolBadges).toContain('90%');

    expect(getOverallHealthMock).toHaveBeenCalledTimes(1);
    expect(getAllMetricsMock).toHaveBeenCalledTimes(1);
    expect(shouldReduceContextMock).toHaveBeenCalledTimes(1);
  });

  it('mode compact : affiche -- si latence 0, et 100% si pas de métriques', () => {
    getAllMetricsMock.mockReturnValue(METRICS_EMPTY);
    getOverallHealthMock.mockReturnValue('excellent');
    shouldReduceContextMock.mockReturnValue(false);

    render(<JarvisPerformanceWidget compact />);

    expect(screen.getByText('--')).toBeTruthy();
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.queryByText('Auto-optimisation: réduction du contexte activée')).toBeNull();
  });

  it('react-query (renderHook): chargement -> succès -> erreur + mutation', async () => {
    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    const fetchOk = vi.fn(async () => ({ status: 'ok' as const, value: 1 }));
    const fetchErr = vi.fn(async () => {
      throw new Error('x');
    });

    const { result: r1 } = renderHook(
      () =>
        useQuery({
          queryKey: ['jarvis', 'perf', 'ok'],
          queryFn: fetchOk,
        }),
      { wrapper }
    );

    expect(r1.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(r1.current.isSuccess).toBe(true);
    });

    expect(fetchOk).toHaveBeenCalledTimes(1);
    expect(r1.current.data).toEqual({ status: 'ok', value: 1 });

    const { result: r2 } = renderHook(
      () =>
        useQuery({
          queryKey: ['jarvis', 'perf', 'err'],
          queryFn: fetchErr,
        }),
      { wrapper }
    );

    expect(r2.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(r2.current.isError).toBe(true);
    });

    expect(fetchErr).toHaveBeenCalledTimes(1);
    const message = r2.current.error instanceof Error ? r2.current.error.message : '';
    expect(message).toBe('x');

    const mutateFn = vi.fn(async (input: { inc: number }) => ({ next: input.inc + 1 }));
    const { result: r3 } = renderHook(
      () =>
        useMutation({
          mutationFn: mutateFn,
        }),
      { wrapper }
    );

    await act(async () => {
      await r3.current.mutateAsync({ inc: 2 });
    });

    expect(mutateFn).toHaveBeenCalledTimes(1);
    expect(mutateFn).toHaveBeenCalledWith({ inc: 2 });
  });
});