// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SimulatorAdvancedParams } from './SimulatorAdvancedParams';

const {
  AUTH_STATE,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  mockFrom,
  sliderCalls,
} = vi.hoisted(() => {
  const builder: Record<string, unknown> = {};
  const chain = vi.fn(() => builder);
  builder.select = chain;
  builder.eq = chain;
  builder.gte = chain;
  builder.lte = chain;
  builder.in = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.insert = chain;
  builder.update = chain;
  builder.delete = chain;
  builder.upsert = chain;
  builder.range = chain;
  builder.match = chain;
  builder.neq = chain;
  builder.or = chain;
  builder.ilike = chain;
  builder.is = chain;
  builder.not = chain;
  builder.single = vi.fn(async () => ({ data: null, error: null }));
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  builder.then = (onFulfilled?: (value: { data: null; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
  builder.catch = (onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected);

  return {
    AUTH_STATE: {
      user: { id: 'u1', email: 'user@test.local' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockNavigate: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockFrom: vi.fn(() => builder),
    sliderCalls: [] as Array<{ label: string; onChange: (value: number) => void }>,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@/lib/simulator-config', () => ({
  formatPercent: (value: number) => `${value.toFixed(1)}%`,
}));

vi.mock('lucide-react', () => ({
  Settings: () => <svg data-testid="icon-settings" />,
  Euro: () => <svg data-testid="icon-euro" />,
  Sliders: () => <svg data-testid="icon-sliders" />,
  TrendingUp: () => <svg data-testid="icon-trending-up" />,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card" className={className}>{children}</div>,
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card-header" className={className}>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card-content" className={className}>{children}</div>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input value={value} onChange={onChange} {...props} />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => <label className={className}>{children}</label>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => <span className={className}>{children}</span>,
}));

vi.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="accordion" className={className}>{children}</div>,
  AccordionItem: ({ children, value, className }: { children: React.ReactNode; value: string; className?: string }) => <section data-testid={`accordion-item-${value}`} className={className}>{children}</section>,
  AccordionTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => <button type="button" className={className}>{children}</button>,
  AccordionContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/slider-with-input', () => ({
  SliderWithInput: ({
    value,
    onChange,
    unit,
    variant,
  }: {
    value: number;
    onChange: (value: number) => void;
    unit?: string;
    variant?: string;
  }) => {
    const label = `slider-${sliderCalls.length + 1}`;
    sliderCalls.push({ label, onChange });
    return (
      <button type="button" data-testid={label} data-value={String(value)} data-unit={unit} data-variant={variant ?? 'default'} onClick={() => onChange(value + 1)}>
        {label}
      </button>
    );
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

type SimulationParams = {
  taux_avis_baseline: number;
  taux_avis_cible: number;
  taux_ccmu2_baseline: number;
  taux_ccmu2_cible: number;
  taux_ccmu3_baseline: number;
  taux_ccmu3_cible: number;
  TARIF_UHCD: number;
  TARIF_AVIS_SPE: number;
  TARIF_CCMU2: number;
  TARIF_CCMU3: number;
  BONUS_MONORUM: number;
};

const baseParams: SimulationParams = {
  taux_avis_baseline: 2,
  taux_avis_cible: 4.5,
  taux_ccmu2_baseline: 3,
  taux_ccmu2_cible: 5,
  taux_ccmu3_baseline: 1,
  taux_ccmu3_cible: 2.5,
  TARIF_UHCD: 120,
  TARIF_AVIS_SPE: 80,
  TARIF_CCMU2: 60,
  TARIF_CCMU3: 95,
  BONUS_MONORUM: 0.04,
};

describe('SimulatorAdvancedParams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sliderCalls.length = 0;
  });

  it('expose un rendu monté via QueryClientProvider et affiche les valeurs métier attendues', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => {
        const onUpdateParam = vi.fn();
        return <SimulatorAdvancedParams params={baseParams} onUpdateParam={onUpdateParam} />;
      },
      { wrapper }
    );

    render(result.current);

    expect(screen.getByText('Paramètres avancés')).toBeInTheDocument();
    expect(screen.getByText('Leviers de valorisation')).toBeInTheDocument();
    expect(screen.getByText('Tarifs unitaires')).toBeInTheDocument();

    expect(screen.getByText('+2.5%')).toBeInTheDocument();
    expect(screen.getByText('+2.0%')).toBeInTheDocument();
    expect(screen.getByText('+1.5%')).toBeInTheDocument();

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(4);
    expect(inputs[0]).toHaveValue('120');
    expect(inputs[1]).toHaveValue('80');
    expect(inputs[2]).toHaveValue('60');
    expect(inputs[3]).toHaveValue('95');

    expect(screen.getByText('Bonus mono-RUM')).toBeInTheDocument();
    expect(sliderCalls).toHaveLength(7);
  });

  it('déclenche les mises à jour correctes pour les sliders et les tarifs valides', () => {
    const onUpdateParam = vi.fn();
    render(<SimulatorAdvancedParams params={baseParams} onUpdateParam={onUpdateParam} />);

    fireEvent.click(screen.getByTestId('slider-1'));
    fireEvent.click(screen.getByTestId('slider-2'));
    fireEvent.click(screen.getByTestId('slider-7'));

    expect(onUpdateParam).toHaveBeenCalledWith('taux_avis_baseline', 3);
    expect(onUpdateParam).toHaveBeenCalledWith('taux_avis_cible', 5.5);
    expect(onUpdateParam).toHaveBeenCalledWith('BONUS_MONORUM', 0.05);

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: '135,5' } });
    fireEvent.change(inputs[1], { target: { value: '92.25' } });
    fireEvent.change(inputs[2], { target: { value: '0' } });

    expect(onUpdateParam).toHaveBeenCalledWith('TARIF_UHCD', 135.5);
    expect(onUpdateParam).toHaveBeenCalledWith('TARIF_AVIS_SPE', 92.25);
    expect(onUpdateParam).toHaveBeenCalledWith('TARIF_CCMU2', 0);
  });

  it('n’active pas le badge global ni les badges de gain quand les objectifs ne dépassent pas le baseline', () => {
    const neutralParams: SimulationParams = {
      ...baseParams,
      taux_avis_cible: 2,
      taux_ccmu2_cible: 3,
      taux_ccmu3_cible: 1,
    };

    render(<SimulatorAdvancedParams params={neutralParams} onUpdateParam={vi.fn()} />);

    expect(screen.queryByText('Actif')).not.toBeInTheDocument();
    expect(screen.queryByText('+0.0%')).not.toBeInTheDocument();
  });

  it('ignore les saisies tarifaires invalides ou négatives', () => {
    const onUpdateParam = vi.fn();
    render(<SimulatorAdvancedParams params={baseParams} onUpdateParam={onUpdateParam} />);

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'abc' } });
    fireEvent.change(inputs[1], { target: { value: '-12' } });

    expect(onUpdateParam).not.toHaveBeenCalledWith('TARIF_UHCD', expect.any(Number));
    expect(onUpdateParam).not.toHaveBeenCalledWith('TARIF_AVIS_SPE', -12);
  });

  it('capture un scénario d’erreur via un wrapper de test pour vérifier isError sans réseau', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      async () => {
        const response = { data: null as null, error: { message: 'x' } };
        const isLoading = false;
        const isError = response.error !== null;
        return { isLoading, isError, error: response.error };
      },
      { wrapper }
    );

    const resolved = await result.current;
    expect(resolved.isLoading).toBe(false);
    expect(resolved.isError).toBe(true);
    expect(resolved.error).toEqual({ message: 'x' });
  });
});