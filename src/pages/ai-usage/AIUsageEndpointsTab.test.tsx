import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AIUsageEndpointsTab } from './AIUsageEndpointsTab';

const { MODEL_CONFIG, formatCostMock } = vi.hoisted(() => {
  const MODEL_CONFIG = {
    'gpt-5.4': { label: 'GPT 5.4 Label', bgColor: 'bg-54', color: 'text-54' },
    'gpt-5.2': { label: 'GPT 5.2 Label', bgColor: 'bg-52', color: 'text-52' },
    'gpt-5-mini': { label: 'GPT 5 Mini Label', bgColor: 'bg-mini', color: 'text-mini' },
  };
  const formatCostMock = vi.fn((n: number) => `${n}€`);
  return { MODEL_CONFIG, formatCostMock };
});

// Mock internal libs and components used by the component under test
vi.mock('@/lib/aiRegistry', () => ({ MODEL_CONFIG }));
vi.mock('@/hooks/ai/useAIUsageStats', () => ({ formatCost: formatCostMock }));
vi.mock('@/lib/utils', () => ({ cn: (...parts: any[]) => parts.filter(Boolean).join(' ') }));

vi.mock('@/components/ui/card', () => {
  const Card = (props: any) => <div data-testid="Card">{props.children}</div>;
  const CardContent = (props: any) => <div data-testid="CardContent">{props.children}</div>;
  const CardHeader = (props: any) => <div data-testid="CardHeader">{props.children}</div>;
  const CardTitle = (props: any) => <div data-testid="CardTitle">{props.children}</div>;
  return { Card, CardContent, CardHeader, CardTitle };
});

vi.mock('@/components/ui/button', () => {
  const Button = (props: any) => (
    <button aria-disabled={props.disabled ? 'true' : 'false'} onClick={props.onClick} data-testid="Button">
      {props.children}
    </button>
  );
  return { Button };
});

vi.mock('@/components/ui/badge', () => {
  const Badge = (props: any) => <span data-testid="Badge" className={props.className}>{props.children}</span>;
  return { Badge };
});

vi.mock('@/components/ui/table', () => {
  const Table = (p: any) => <table data-testid="Table">{p.children}</table>;
  const TableBody = (p: any) => <tbody>{p.children}</tbody>;
  const TableCell = (p: any) => <td>{p.children}</td>;
  const TableHead = (p: any) => <th>{p.children}</th>;
  const TableHeader = (p: any) => <thead>{p.children}</thead>;
  const TableRow = (p: any) => <tr>{p.children}</tr>;
  return { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
});

vi.mock('lucide-react', () => {
  const Icon = ({ 'data-testid': tid }: any) => <svg data-testid={tid} />;
  return {
    RefreshCw: (props: any) => <Icon data-testid="RefreshCw" {...props} />,
    Activity: (props: any) => <Icon data-testid="Activity" {...props} />,
    Wifi: (props: any) => <Icon data-testid="Wifi" {...props} />,
    WifiOff: (props: any) => <Icon data-testid="WifiOff" {...props} />,
  };
});

// Stable sample date for assertions
const SAMPLE_DATE = new Date('2024-01-02T15:04:00Z');

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('AIUsageEndpointsTab component', () => {
  it('shows loading state: button disabled and Refresh icon when healthLoading is true', () => {
    const onTest = vi.fn();
    render(
      <Wrapper>
        <AIUsageEndpointsTab isMobile={false} healthLoading={true} healthData={null} stats={null} onTest={onTest} />
      </Wrapper>
    );

    const button = screen.getByTestId('Button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('RefreshCw')).toBeInTheDocument();
    expect(screen.queryByTestId('Activity')).toBeNull();
    expect(onTest).not.toHaveBeenCalled();
  });

  it('renders endpoint cards, metrics and top errors correctly when provided with data', () => {
    const onTest = vi.fn();
    const healthData = {
      endpoints: [
        { model: 'gpt-5.4', status: 'ok', latency_ms: 42 },
        { model: 'gpt-5.2', status: 'error', latency_ms: 120, error: 'Something went wrong' },
      ],
    };

    const stats = {
      callsByModel: [{ model: 'gpt-54', count: 10, cost: 2.5 }, { model: 'gpt-52', count: 5, cost: 1.2 }],
      errorsByModel: new Map([
        ['gpt-5.4', { count: 3 }],
        ['gpt-5.2', { count: 7 }],
      ]),
      topErrors: [
        { message: 'Timeout connecting to service', count: 4, lastSeen: SAMPLE_DATE.toISOString() },
      ],
    };

    render(
      <Wrapper>
        <AIUsageEndpointsTab isMobile={false} healthLoading={false} healthData={healthData} stats={stats as any} onTest={onTest} />
      </Wrapper>
    );

    // Titles from MODEL_CONFIG should appear
    const titles = screen.getAllByTestId('CardTitle').map(n => n.textContent);
    expect(titles).toContain(MODEL_CONFIG['gpt-5.4'].label);
    expect(titles).toContain(MODEL_CONFIG['gpt-5.2'].label);

    // For gpt-5.4 card: status "En ligne" and latency visible
    expect(screen.getByText('En ligne')).toBeInTheDocument();
    expect(screen.getByText('42ms')).toBeInTheDocument();

    // Calls count and formatted cost for gpt-5.4
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(formatCostMock).toHaveBeenCalledWith(2.5);
    expect(screen.getByText('2.5€')).toBeInTheDocument();

    // Errors count displayed
    expect(screen.getByText('3')).toBeInTheDocument();

    // Fallback badges text present
    const badgeTexts = screen.getAllByTestId('Badge').map(b => b.textContent || '');
    expect(badgeTexts).toEqual(expect.arrayContaining(['GPT-5.4', 'GPT-5.2', 'GPT-5 Mini']));

    // Top errors table renders message, count and formatted date
    expect(screen.getByText('Timeout connecting to service')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    const expectedDate = format(SAMPLE_DATE, 'dd/MM HH:mm', { locale: fr });
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
  });

  it('calls onTest when Tester button is clicked and shows Activity icon when not loading', () => {
    const onTest = vi.fn();
    render(
      <Wrapper>
        <AIUsageEndpointsTab isMobile={false} healthLoading={false} healthData={null} stats={null} onTest={onTest} />
      </Wrapper>
    );

    expect(screen.getByTestId('Activity')).toBeInTheDocument();
    const button = screen.getByTestId('Button');
    expect(button).toHaveAttribute('aria-disabled', 'false');
    fireEvent.click(button);
    expect(onTest).toHaveBeenCalledTimes(1);
  });

  it('does not render top errors card when stats indicates an error object (isError case)', () => {
    const onTest = vi.fn();
    // Provide an "error" shaped object but keep the arrays/maps expected by the component to avoid runtime crashes.
    const statsWithError = {
      data: null,
      error: { message: 'fetch failed' },
      callsByModel: [],
      errorsByModel: new Map(),
      topErrors: [],
    };

    render(
      <Wrapper>
        <AIUsageEndpointsTab isMobile={false} healthLoading={false} healthData={null} stats={statsWithError as any} onTest={onTest} />
      </Wrapper>
    );

    // The "Erreurs les plus fréquentes" CardTitle should not be present since topErrors is empty
    expect(screen.queryByText('Erreurs les plus fréquentes')).toBeNull();
  });

  it('provides a working renderHook wrapper with QueryClientProvider (sanity for hooks)', () => {
    const { result } = renderHook(() => ({ ok: true }), { wrapper: Wrapper });
    expect(result.current).toEqual({ ok: true });
  });
});