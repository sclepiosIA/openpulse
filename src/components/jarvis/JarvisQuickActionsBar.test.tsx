/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisQuickActionsBar } from './JarvisQuickActionsBar';

const {
  mockVibrateSelection,
  mockExecuteQuickAction,
  mockUseJarvisUnifiedOptional,
  JARVIS_COLORS_STABLE,
} = vi.hoisted(() => ({
  mockVibrateSelection: vi.fn(),
  mockExecuteQuickAction: vi.fn(),
  mockUseJarvisUnifiedOptional: vi.fn(),
  JARVIS_COLORS_STABLE: {
    reminder: { icon: 'text-blue-500' },
    insight: { icon: 'text-violet-500' },
    opportunity: { icon: 'text-green-500' },
    risk: { icon: 'text-red-500' },
    prediction: { icon: 'text-amber-500' },
  },
}));

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected),
  };

  return {
    supabase: {
      from: vi.fn(() => builder),
    },
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
  ScrollBar: ({ orientation, className }: { orientation?: string; className?: string }) => (
    <div data-testid="scroll-bar" data-orientation={orientation} className={className} />
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/lib/haptics', () => ({
  vibrateSelection: mockVibrateSelection,
}));

vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  useJarvisUnifiedOptional: mockUseJarvisUnifiedOptional,
  JARVIS_COLORS: JARVIS_COLORS_STABLE,
}));

vi.mock('framer-motion', () => {
  const createPrimitive = (tag: keyof JSX.IntrinsicElements) => {
    const Comp = ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement(tag, props, children);
    return Comp;
  };

  return {
    motion: {
      div: createPrimitive('div'),
      span: createPrimitive('span'),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    Mail: Icon,
    ListTodo: Icon,
    BarChart3: Icon,
    Calendar: Icon,
    TrendingUp: Icon,
    Users: Icon,
    DollarSign: Icon,
    HelpCircle: Icon,
    Sparkles: Icon,
    ChevronRight: Icon,
  };
});

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

describe('JarvisQuickActionsBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseJarvisUnifiedOptional.mockReturnValue({
      executeQuickAction: mockExecuteQuickAction,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('monte correctement dans un wrapper QueryClientProvider via renderHook', () => {
    const { result } = renderHook(() => React.useState('ready'), { wrapper: createWrapper() });
    expect(result.current[0]).toBe('ready');
  });

  it('affiche les actions contextuelles du matin dans le bon ordre et respecte maxVisible', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 4, 1, 9, 0, 0));

    render(<JarvisQuickActionsBar maxVisible={4} />, { wrapper: createWrapper() });

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
    expect(buttons[0]).toHaveTextContent('Emails');
    expect(buttons[1]).toHaveTextContent('Agenda');
    expect(buttons[2]).toHaveTextContent('Tâches');
    expect(buttons[3]).toHaveTextContent('Pipeline');

    expect(buttons[0]).toHaveTextContent('📧');
    expect(buttons[1]).toHaveTextContent('📅');
    expect(buttons[2]).toHaveTextContent('✅');
    expect(buttons[3]).toHaveTextContent('📈');

    expect(screen.queryByText('Trésorerie')).not.toBeInTheDocument();
    expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
    expect(screen.getByTestId('scroll-bar')).toHaveAttribute('data-orientation', 'horizontal');
  });

  it('appelle onAction et la vibration au clic sans utiliser le contexte Jarvis', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 4, 1, 11, 0, 0));

    const onAction = vi.fn();

    render(<JarvisQuickActionsBar onAction={onAction} maxVisible={3} />, { wrapper: createWrapper() });

    const firstButton = screen.getAllByRole('button')[0];
    expect(firstButton).toHaveTextContent('Tâches');

    fireEvent.click(firstButton);

    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('Quelles sont mes tâches prioritaires ?');
    expect(mockExecuteQuickAction).not.toHaveBeenCalled();
  });

  it('utilise executeQuickAction du contexte quand onAction est absent', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 4, 1, 15, 0, 0));

    render(<JarvisQuickActionsBar maxVisible={2} />, { wrapper: createWrapper() });

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('Pipeline');
    expect(buttons[1]).toHaveTextContent('Emails');

    fireEvent.click(buttons[0]);

    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
    expect(mockExecuteQuickAction).toHaveBeenCalledTimes(1);
    expect(mockExecuteQuickAction).toHaveBeenCalledWith("Quel est l'état du pipeline commercial ?");
  });

  it('désactive les boutons quand disabled=true et empêche toute action', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 4, 1, 17, 0, 0));

    const onAction = vi.fn();

    render(<JarvisQuickActionsBar onAction={onAction} disabled maxVisible={2} />, {
      wrapper: createWrapper(),
    });

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toBeDisabled();
    expect(buttons[0]).toHaveTextContent('Stats');
    expect(buttons[1]).toBeDisabled();
    expect(buttons[1]).toHaveTextContent('Emails');

    fireEvent.click(buttons[0]);

    expect(mockVibrateSelection).not.toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
    expect(mockExecuteQuickAction).not.toHaveBeenCalled();
  });

  it('n échoue pas sans contexte Jarvis ni onAction et conserve le rendu attendu', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 4, 1, 13, 0, 0));
    mockUseJarvisUnifiedOptional.mockReturnValue(undefined);

    render(<JarvisQuickActionsBar maxVisible={2} className="custom-bar" />, {
      wrapper: createWrapper(),
    });

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('Emails');
    expect(buttons[1]).toHaveTextContent('Tâches');

    fireEvent.click(buttons[0]);

    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
    expect(mockExecuteQuickAction).not.toHaveBeenCalled();
    expect(screen.getByTestId('scroll-area').parentElement).toHaveClass('relative');
    expect(screen.getByTestId('scroll-area').parentElement).toHaveClass('custom-bar');
  });
});