import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JarvisProactiveNudge } from './JarvisProactiveNudge';

const {
  TRIGGER_DATE,
  TRIGGERS,
  PRED_HIGH,
  PRED_LOW,
  mockUseJarvisSmartTriggers,
  mockUseJarvisIntentPrediction,
  mockUseJarvisUnifiedOptional,
  mockDismissTrigger,
  mockDismissPrediction,
  mockExecuteQuickAction,
  mockFrom,
} = vi.hoisted(() => {
  const TRIGGER_DATE = new Date('2024-01-01T00:00:00.000Z');
  const TRIGGERS = [
    {
      id: 'tr1',
      type: 'reminder',
      source: 'system',
      title: 'Backup pending',
      message: 'Please backup your data',
      priority: 2,
      actionLabel: 'Do backup',
      actionCommand: 'backup now',
      entityType: 'file',
      entityId: 'f1',
      timestamp: TRIGGER_DATE,
      expiresAt: null,
      autoDismissSeconds: 0,
    },
  ];
  const PRED_HIGH = {
    id: 'pred1',
    confidence: 0.9,
    suggestedPrompt: 'Show current status',
  };
  const PRED_LOW = {
    id: 'pred2',
    confidence: 0.5,
    suggestedPrompt: 'Low confidence prompt',
  };

  const mockDismissTrigger = vi.fn();
  const mockDismissPrediction = vi.fn();
  const mockExecuteQuickAction = vi.fn();

  const mockUseJarvisSmartTriggers = vi.fn();
  const mockUseJarvisIntentPrediction = vi.fn();
  const mockUseJarvisUnifiedOptional = vi.fn();

  // Supabase mock builder
  const createBuilder = () => {
    const builder: any = {
      _data: [],
      _error: null,
      select() { return builder; },
      eq() { return builder; },
      gte() { return builder; },
      lte() { return builder; },
      in() { return builder; },
      order() { return builder; },
      limit() { return builder; },
      insert() { return Promise.resolve({ data: builder._data, error: builder._error }); },
      update() { return Promise.resolve({ data: builder._data, error: builder._error }); },
      delete() { return Promise.resolve({ data: builder._data, error: builder._error }); },
      single() { return Promise.resolve({ data: builder._data?.[0] ?? null, error: builder._error }); },
      maybeSingle() { return Promise.resolve({ data: builder._data?.[0] ?? null, error: builder._error }); },
      then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        return Promise.resolve({ data: builder._data, error: builder._error }).then(onFulfilled, onRejected);
      },
      catch(onRejected: (e: unknown) => unknown) {
        return Promise.resolve({ data: builder._data, error: builder._error }).catch(onRejected);
      },
    };
    return builder;
  };

  const mockFrom = vi.fn(() => createBuilder());

  return {
    TRIGGER_DATE,
    TRIGGERS,
    PRED_HIGH,
    PRED_LOW,
    mockUseJarvisSmartTriggers,
    mockUseJarvisIntentPrediction,
    mockUseJarvisUnifiedOptional,
    mockDismissTrigger,
    mockDismissPrediction,
    mockExecuteQuickAction,
    mockFrom,
  };
});

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock('framer-motion', () => {
  const MotionDiv = ({ children, ...rest }: { children?: React.ReactNode }) => <div {...rest}>{children}</div>;
  const MotionButton = ({ children, ...rest }: { children?: React.ReactNode }) => <button {...rest}>{children}</button>;
  return {
    motion: {
      div: MotionDiv,
      button: MotionButton,
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('lucide-react', () => {
  const Icon = (props: Record<string, unknown>) => <svg data-testid="icon" {...props} />;
  return {
    Sparkles: Icon,
    X: Icon,
  };
});

vi.mock('@/components/ui/button', () => {
  const Button = ({
    children,
    onClick,
    className,
    'aria-label': ariaLabel,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
    'aria-label'?: string;
  }) => (
    <button className={className} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  );
  return { Button };
});

vi.mock('@/lib/utils', () => {
  const cn = (...args: Array<unknown>): string => args.filter(Boolean).join(' ');
  return { cn };
});

vi.mock('@/contexts/JarvisUnifiedContext', () => {
  return {
    useJarvisUnifiedOptional: (...args: unknown[]) => mockUseJarvisUnifiedOptional(...args),
    JARVIS_ANIMATIONS: { slideUp: {}, scale: {} },
  };
});

vi.mock('@/hooks/jarvis/useJarvisSmartTriggers', () => {
  return {
    useJarvisSmartTriggers: (...args: unknown[]) => mockUseJarvisSmartTriggers(...args),
  };
});

vi.mock('@/hooks/jarvis/useJarvisIntentPrediction', () => {
  return {
    useJarvisIntentPrediction: (...args: unknown[]) => mockUseJarvisIntentPrediction(...args),
  };
});

interface MockAlert {
  id: string;
  title?: string;
  message?: string;
  actionCommand?: string;
  source?: string;
}

vi.mock('./JarvisAlertCard', () => {
  const JarvisAlertCard = ({
    alert,
    onAction,
    onDismiss,
  }: {
    alert: MockAlert;
    onAction: (cmd: string) => void;
    onDismiss: () => void;
  }) => (
    <div data-testid={`jarvis-alert-card-${alert.id}`}>
      <div>{alert.title}</div>
      <div>{alert.message}</div>
      <button data-testid={`alert-action-${alert.id}`} onClick={() => onAction(alert.actionCommand ?? '')}>
        action
      </button>
      <button data-testid={`alert-dismiss-${alert.id}`} onClick={() => onDismiss()}>
        dismiss
      </button>
    </div>
  );
  return { JarvisAlertCard };
});

describe('JarvisProactiveNudge', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseJarvisUnifiedOptional.mockReturnValue({
      isPanelOpen: false,
      isProcessingInBackground: false,
      executeQuickAction: mockExecuteQuickAction,
    });

    mockUseJarvisSmartTriggers.mockReturnValue({
      triggers: [],
      dismissTrigger: mockDismissTrigger,
      hasUrgent: false,
    });

    mockUseJarvisIntentPrediction.mockReturnValue({
      topPrediction: null,
      dismissPrediction: mockDismissPrediction,
    });
  });

  it('renders nothing when there are no alerts', () => {
    render(<JarvisProactiveNudge />);
    expect(screen.queryByText(/suggestion/)).toBeNull();
    expect(screen.queryByText('Jarvis suggère')).toBeNull();
  });

  it('auto-expands on urgent trigger and allows executing quick action via context', async () => {
    mockUseJarvisSmartTriggers.mockReturnValue({
      triggers: TRIGGERS,
      dismissTrigger: mockDismissTrigger,
      hasUrgent: true,
    });

    mockUseJarvisIntentPrediction.mockReturnValue({
      topPrediction: PRED_LOW, // ignored due to low confidence
      dismissPrediction: mockDismissPrediction,
    });

    render(<JarvisProactiveNudge />);

    // Expanded header visible due to urgent
    expect(screen.getByText('Jarvis suggère')).toBeInTheDocument();
    // Our mocked card shows title
    expect(screen.getByText('Backup pending')).toBeInTheDocument();

    // Click action on the trigger card
    const actionBtn = screen.getByTestId('alert-action-tr1');
    await userEvent.click(actionBtn);
    expect(mockExecuteQuickAction).toHaveBeenCalledTimes(1);
    expect(mockExecuteQuickAction).toHaveBeenCalledWith('backup now');

    // After action, widget collapses showing indicator with 1 suggestion
    expect(await screen.findByText('1 suggestion')).toBeInTheDocument();

    // Re-expand by clicking the collapsed indicator
    await userEvent.click(screen.getByText('1 suggestion'));
    expect(screen.getByText('Jarvis suggère')).toBeInTheDocument();
  });

  it('uses onAskJarvis when provided and no context, and can dismiss prediction', async () => {
    const onAskJarvis = vi.fn();

    // No context provided to force onAskJarvis usage
    mockUseJarvisUnifiedOptional.mockReturnValue(undefined);

    mockUseJarvisSmartTriggers.mockReturnValue({
      triggers: [],
      dismissTrigger: mockDismissTrigger,
      hasUrgent: false,
    });

    mockUseJarvisIntentPrediction.mockReturnValue({
      topPrediction: PRED_HIGH,
      dismissPrediction: mockDismissPrediction,
    });

    render(<JarvisProactiveNudge onAskJarvis={onAskJarvis} />);

    // Initially collapsed with 1 suggestion
    const collapsed = await screen.findByText('1 suggestion');
    expect(collapsed).toBeInTheDocument();

    // Expand
    await userEvent.click(collapsed);
    expect(screen.getByText('Jarvis suggère')).toBeInTheDocument();

    // Action should call onAskJarvis with the suggested prompt
    const actBtn = screen.getByTestId('alert-action-pred1');
    await userEvent.click(actBtn);
    expect(onAskJarvis).toHaveBeenCalledTimes(1);
    expect(onAskJarvis).toHaveBeenCalledWith('Show current status');

    // After action, the widget collapses; re-expand to access dismiss
    const collapsedAfterAction = await screen.findByText('1 suggestion');
    await userEvent.click(collapsedAfterAction);
    expect(screen.getByText('Jarvis suggère')).toBeInTheDocument();

    // Dismiss prediction
    const dismissBtn = screen.getByTestId('alert-dismiss-pred1');
    await userEvent.click(dismissBtn);
    expect(mockDismissPrediction).toHaveBeenCalledTimes(1);
    expect(mockDismissPrediction).toHaveBeenCalledWith('pred1');

    // After dismissal, there should be no suggestions left
    expect(screen.queryByText(/suggestion/)).toBeNull();
    expect(screen.queryByText('Jarvis suggère')).toBeNull();
  });

  it('calls hooks with expected options based on context flags', () => {
    mockUseJarvisUnifiedOptional.mockReturnValue({
      isPanelOpen: true,
      isProcessingInBackground: true,
      executeQuickAction: mockExecuteQuickAction,
    });

    mockUseJarvisSmartTriggers.mockReturnValue({
      triggers: [],
      dismissTrigger: mockDismissTrigger,
      hasUrgent: false,
    });

    mockUseJarvisIntentPrediction.mockReturnValue({
      topPrediction: null,
      dismissPrediction: mockDismissPrediction,
    });

    render(<JarvisProactiveNudge />);

    // useJarvisSmartTriggers receives enabled: !isPanelOpen and isStreaming: isProcessingInBackground
    expect(mockUseJarvisSmartTriggers).toHaveBeenCalledTimes(1);
    expect(mockUseJarvisSmartTriggers).toHaveBeenCalledWith({ enabled: false, isStreaming: true });

    // useJarvisIntentPrediction receives enabled: !isPanelOpen
    expect(mockUseJarvisIntentPrediction).toHaveBeenCalledTimes(1);
    expect(mockUseJarvisIntentPrediction).toHaveBeenCalledWith({ enabled: false });
  });

  it('dismisses a trigger and unmounts when no alerts remain', async () => {
    mockUseJarvisUnifiedOptional.mockReturnValue({
      isPanelOpen: false,
      isProcessingInBackground: false,
      executeQuickAction: mockExecuteQuickAction,
    });

    mockUseJarvisSmartTriggers.mockReturnValue({
      triggers: TRIGGERS,
      dismissTrigger: mockDismissTrigger,
      hasUrgent: false,
    });

    mockUseJarvisIntentPrediction.mockReturnValue({
      topPrediction: null,
      dismissPrediction: mockDismissPrediction,
    });

    render(<JarvisProactiveNudge />);

    // Collapsed (no urgent), shows suggestion count
    const collapsed = await screen.findByText('1 suggestion');
    await userEvent.click(collapsed);

    // Dismiss the only trigger
    const dismissBtn = screen.getByTestId('alert-dismiss-tr1');
    await userEvent.click(dismissBtn);

    expect(mockDismissTrigger).toHaveBeenCalledTimes(1);
    expect(mockDismissTrigger).toHaveBeenCalledWith('tr1');

    // Should now unmount (no more alerts)
    expect(screen.queryByText(/suggestion/)).toBeNull();
    expect(screen.queryByText('Jarvis suggère')).toBeNull();
  });
});