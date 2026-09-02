import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SimulatorMainParams } from './SimulatorMainParams';

vi.mock('@/components/ui/card', () => {
  const MockCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-root" data-class={className}>{children}</div>
  );
  const MockCardHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" data-class={className}>{children}</div>
  );
  const MockCardContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" data-class={className}>{children}</div>
  );
  const MockCardTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" data-class={className}>{children}</div>
  );
  return {
    Card: MockCard,
    CardHeader: MockCardHeader,
    CardContent: MockCardContent,
    CardTitle: MockCardTitle,
  };
});

vi.mock('@/components/ui/input', () => {
  const MockInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input data-testid="passages-input" {...props} />
  );
  return { Input: MockInput };
});

vi.mock('@/components/ui/label', () => {
  const MockLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <label data-testid="ui-label" data-class={className}>{children}</label>
  );
  return { Label: MockLabel };
});

vi.mock('@/components/ui/slider-with-input', () => {
  const MockSliderWithInput = (props: any) => (
    <div>
      <div data-testid={`slider-${props.unit}-${props.min}-${props.max}`} />
      <button
        type="button"
        data-testid={`slider-change-${props.unit}-${props.min}-${props.max}`}
        onClick={() => props.onChange(props.value + (props.step ?? 1))}
      >
        change
      </button>
      {props.onSecondaryValueChange && (
        <button
          type="button"
          data-testid={`slider-secondary-change-${props.unit}-${props.min}-${props.max}`}
          onClick={() => props.onSecondaryValueChange(1000)}
        >
          secondary-change
        </button>
      )}
    </div>
  );
  return { SliderWithInput: MockSliderWithInput };
});

vi.mock('@/components/ui/tooltip', () => {
  const Provider = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const Tooltip = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const Trigger = ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>;
  const Content = ({ children }: { children: React.ReactNode; side?: string; className?: string }) => (
    <div>{children}</div>
  );
  return {
    TooltipProvider: Provider,
    Tooltip: Tooltip,
    TooltipTrigger: Trigger,
    TooltipContent: Content,
  };
});

const { formatNumberMock, formatPercentMock, cnMock } = vi.hoisted(() => {
  return {
    formatNumberMock: vi.fn((n: number) => n.toString()),
    formatPercentMock: vi.fn((n: number) => `${n.toFixed(1)} %`),
    cnMock: vi.fn((...args: string[]) => args.filter(Boolean).join(' ')),
  };
});

vi.mock('@/lib/simulator-config', () => ({
  formatNumber: formatNumberMock,
  formatPercent: formatPercentMock,
}));

vi.mock('lucide-react', () => {
  const Icon = (props: any) => <svg data-testid="icon" {...props} />;
  return {
    Building2: Icon,
    Users: Icon,
    TrendingUp: Icon,
    Activity: Icon,
    HelpCircle: Icon,
    ArrowRight: Icon,
  };
});

vi.mock('@/lib/utils', () => ({
  cn: cnMock,
}));

function createWrapper(children: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

type SimulationParams = {
  passages: number;
  baseline: number;
  cible: number;
  taux_mono: number;
};

describe('SimulatorMainParams', () => {
  const defaultParams: SimulationParams = {
    passages: 10000,
    baseline: 10,
    cible: 15,
    taux_mono: 70,
  };

  it('renders main texts and structure', () => {
    const onUpdateParam = vi.fn();
    render(
      createWrapper(
        <SimulatorMainParams params={defaultParams} onUpdateParam={onUpdateParam} />
      )
    );

    expect(screen.getByText('Paramètres de simulation')).toBeInTheDocument();
    expect(screen.getByText('Passages annuels aux urgences')).toBeInTheDocument();
    expect(screen.getByText('Évolution du taux UHCD')).toBeInTheDocument();
    expect(screen.getByText('Taux actuel')).toBeInTheDocument();
    expect(screen.getByText('Objectif cible')).toBeInTheDocument();
    expect(screen.getByText('Proportion UHCD mono-RUM')).toBeInTheDocument();
  });

  it('calls onUpdateParam when passages input changes with valid value', () => {
    const onUpdateParam = vi.fn();
    render(
      createWrapper(
        <SimulatorMainParams params={defaultParams} onUpdateParam={onUpdateParam} />
      )
    );

    const input = screen.getByTestId('passages-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12 345' } });

    expect(onUpdateParam).toHaveBeenCalledWith('passages', 12345);
  });

  it('does not call onUpdateParam when passages input is invalid', () => {
    const onUpdateParam = vi.fn();
    render(
      createWrapper(
        <SimulatorMainParams params={defaultParams} onUpdateParam={onUpdateParam} />
      )
    );

    const input = screen.getByTestId('passages-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });

    expect(onUpdateParam).not.toHaveBeenCalled();
  });

  it('updates baseline percentage when baseline slider primary value changes', () => {
    const onUpdateParam = vi.fn();
    render(
      createWrapper(
        <SimulatorMainParams params={defaultParams} onUpdateParam={onUpdateParam} />
      )
    );

    const changeButton = screen.getByTestId('slider-change-%-0-20');
    fireEvent.click(changeButton);

    expect(onUpdateParam).toHaveBeenCalledWith('baseline', defaultParams.baseline + 0.1);
  });

  it('updates cible percentage when cible slider primary value changes', () => {
    const onUpdateParam = vi.fn();
    render(
      createWrapper(
        <SimulatorMainParams params={defaultParams} onUpdateParam={onUpdateParam} />
      )
    );

    const changeButton = screen.getByTestId('slider-change-%-0-25');
    fireEvent.click(changeButton);

    expect(onUpdateParam).toHaveBeenCalledWith('cible', defaultParams.cible + 0.1);
  });

  it('updates taux_mono when mono-RUM slider primary value changes', () => {
    const onUpdateParam = vi.fn();
    render(
      createWrapper(
        <SimulatorMainParams params={defaultParams} onUpdateParam={onUpdateParam} />
      )
    );

    const changeButton = screen.getByTestId('slider-change-%-0-100');
    fireEvent.click(changeButton);

    expect(onUpdateParam).toHaveBeenCalledWith('taux_mono', defaultParams.taux_mono + 1);
  });

  it('updates baseline from absolute UHCD value with clamping between 0 and 20', () => {
    const onUpdateParam = vi.fn();
    const params: SimulationParams = {
      ...defaultParams,
      passages: 10000,
      baseline: 5,
    };
    render(
      createWrapper(
        <SimulatorMainParams params={params} onUpdateParam={onUpdateParam} />
      )
    );

    const secondaryButton = screen.getByTestId('slider-secondary-change-%-0-20');
    fireEvent.click(secondaryButton);

    const expectedTaux = (1000 / params.passages) * 100;
    const clamped = Math.min(20, Math.max(0, expectedTaux));

    expect(onUpdateParam).toHaveBeenCalledWith('baseline', clamped);
  });

  it('updates cible from absolute UHCD value with clamping between 0 and 25', () => {
    const onUpdateParam = vi.fn();
    const params: SimulationParams = {
      ...defaultParams,
      passages: 20000,
      cible: 10,
    };
    render(
      createWrapper(
        <SimulatorMainParams params={params} onUpdateParam={onUpdateParam} />
      )
    );

    const secondaryButton = screen.getByTestId('slider-secondary-change-%-0-25');
    fireEvent.click(secondaryButton);

    const expectedTaux = (1000 / params.passages) * 100;
    const clamped = Math.min(25, Math.max(0, expectedTaux));

    expect(onUpdateParam).toHaveBeenCalledWith('cible', clamped);
  });

  it('updates taux_mono from absolute mono-RUM value with clamping between 0 and 100', () => {
    const onUpdateParam = vi.fn();
    const params: SimulationParams = {
      ...defaultParams,
      passages: 10000,
      baseline: 10,
      taux_mono: 50,
    };
    render(
      createWrapper(
        <SimulatorMainParams params={params} onUpdateParam={onUpdateParam} />
      )
    );

    const baselineUhcd = Math.round(params.passages * (params.baseline / 100));
    const secondaryButton = screen.getByTestId('slider-secondary-change-%-0-100');
    fireEvent.click(secondaryButton);

    const expectedTaux = baselineUhcd > 0 ? (1000 / baselineUhcd) * 100 : 0;
    const clamped = Math.min(100, Math.max(0, expectedTaux));

    expect(onUpdateParam).toHaveBeenCalledWith('taux_mono', clamped);
  });

  it('uses cn to compute classnames for mono-RUM progress bar', () => {
    const onUpdateParam = vi.fn();
    const paramsHigh: SimulationParams = {
      ...defaultParams,
      taux_mono: 80,
    };
    render(
      createWrapper(
        <SimulatorMainParams params={paramsHigh} onUpdateParam={onUpdateParam} />
      )
    );

    // cn is called at least once with base classes and conditional class
    expect(cnMock).toHaveBeenCalled();
    const callArgs = cnMock.mock.calls[0];
    expect(callArgs[0]).toContain('h-full');
  });

  it('formats passages, baseline and cible percentages using helpers', () => {
    const onUpdateParam = vi.fn();
    render(
      createWrapper(
        <SimulatorMainParams params={defaultParams} onUpdateParam={onUpdateParam} />
      )
    );

    expect(formatNumberMock).toHaveBeenCalledWith(defaultParams.passages);
    expect(formatPercentMock).toHaveBeenCalledWith(defaultParams.baseline);
    expect(formatPercentMock).toHaveBeenCalledWith(defaultParams.cible);
  });
});