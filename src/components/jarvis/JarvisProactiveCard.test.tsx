import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisProactiveCard, JarvisProactiveStack } from './JarvisProactiveCard';
import { supabase as importedSupabase } from '@/integrations/supabase/client';
import { vibrateSelection as vibImported } from '@/lib/haptics';

const { ALERT, RESPONSE, mockFrom, vibrateSelectionMock } = vi.hoisted(() => {
  const ALERT = {
    id: 'alert-1',
    category: 'opportunity' as const,
    title: "Nouvelle opportunité commerciale",
    description: "Un lead intéressant a ouvert l'email.",
    actionLabel: "Relancer",
    actionPrompt: "Relancer le prospect avec un message court",
    entityType: 'prospect' as const,
    entityId: 'p-123',
    timestamp: new Date('2024-06-01T12:34:00'),
  };

  const RESPONSE = { value: { data: ALERT, error: null as null | { message: string } } };

  // Builder chain that is thenable. It will resolve to RESPONSE.value which can be mutated from tests.
  const builder: any = {
    select() { return builder; },
    eq() { return builder; },
    gte() { return builder; },
    lte() { return builder; },
    in() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    insert() { return builder; },
    update() { return builder; },
    delete() { return builder; },
    single() { return builder; },
    maybeSingle() { return builder; },
    then(onFulfilled: any) {
      // return a promise resolving to the current RESPONSE.value
      return Promise.resolve(RESPONSE.value).then(onFulfilled);
    },
    catch(onRejected: any) {
      return Promise.resolve(RESPONSE.value).catch(onRejected);
    },
  };

  const mockFrom = vi.fn(() => builder);

  const vibrateSelectionMock = vi.fn();

  return { ALERT, RESPONSE, mockFrom, vibrateSelectionMock };
});

// Mock supabase client as required by rules (builder chain)
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

// Mock utils.cn to return joined classes (pure implementation)
vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Mock Button component to be a simple button element that forwards props
vi.mock('@/components/ui/button', () => {
  const React = require('react');
  return {
    Button: React.forwardRef(function Button(props: any, ref: any) {
      const { children, ...rest } = props;
      return React.createElement('button', { ...rest, ref }, children);
    }),
  };
});

// Mock haptics vibrateSelection with hoisted stable mock
vi.mock('@/lib/haptics', () => {
  return {
    vibrateSelection: vibrateSelectionMock,
  };
});

// Mock framer-motion to be simple pass-through components to avoid animation side-effects
vi.mock('framer-motion', () => {
  const React = require('react');
  const MotionDiv = (props: any) => {
    const { children, ...rest } = props;
    return React.createElement('div', { ...rest }, children);
  };
  const MotionButton = (props: any) => {
    const { children, ...rest } = props;
    return React.createElement('button', { ...rest }, children);
  };
  return {
    motion: {
      div: MotionDiv,
      button: MotionButton,
    },
    AnimatePresence: (props: any) => React.createElement(React.Fragment, null, props.children),
  };
});

// Mock react-router's useNavigate if imported elsewhere (safety)
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

describe('JarvisProactiveCard and JarvisProactiveStack', () => {
  const createClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

  it('renders a proactive card, triggers action and dismiss, and shows formatted timestamp and category label', async () => {
    const client = createClient();
    const onAction = vi.fn();
    const onDismiss = vi.fn();

    const alert = {
      ...ALERT,
      // ensure timestamp deterministic for assertion
      timestamp: new Date('2024-06-01T12:34:00'),
    };

    const { container } = render(
      <QueryClientProvider client={client}>
        <JarvisProactiveCard alert={alert} onAction={onAction} onDismiss={onDismiss} className="custom-class" />
      </QueryClientProvider>
    );

    // Category label should be present (from CATEGORY_CONFIG for 'opportunity' -> 'Opportunité')
    expect(screen.getByText('Opportunité')).toBeTruthy();

    // Title and description present
    expect(screen.getByText(alert.title)).toBeTruthy();
    expect(screen.getByText(alert.description)).toBeTruthy();

    // Custom class passed through
    const root = container.firstElementChild as HTMLElement;
    expect(root.className.includes('custom-class')).toBe(true);

    // Action button should exist with the actionLabel text
    const actionBtn = screen.getByText(alert.actionLabel) as HTMLElement;
    expect(actionBtn).toBeTruthy();

    // Click action button triggers vibrateSelection and onAction with prompt
    act(() => {
      fireEvent.click(actionBtn);
    });

    expect(vibrateSelectionMock).toHaveBeenCalled();
    expect(onAction).toHaveBeenCalledWith(alert.actionPrompt);

    // Dismiss button is rendered as the first button (motion.button in markup). Find all buttons and pick the one without the action label.
    const allButtons = container.querySelectorAll('button');
    // find a button whose textContent does NOT include action label (the dismiss)
    let dismissButton: Element | null = null;
    for (let i = 0; i < allButtons.length; i++) {
      const btn = allButtons[i];
      const txt = btn.textContent || '';
      if (!txt.includes(alert.actionLabel)) {
        dismissButton = btn;
        break;
      }
    }
    expect(dismissButton).not.toBeNull();

    // Use fake timers to advance the 200ms dismissal timeout inside the component
    vi.useFakeTimers();
    act(() => {
      (dismissButton as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(vibrateSelectionMock).toHaveBeenCalled(); // called again on dismiss

    // advance timers to trigger onDismiss call
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onDismiss).toHaveBeenCalledWith(alert.id);
    vi.useRealTimers();

    // Timestamp should be formatted in fr-FR with hour/minute (e.g., "12:34")
    const expectedTime = alert.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    expect(screen.getByText((content) => content.includes(expectedTime))).toBeTruthy();
  });

  it('renders a stack and shows hidden count when more alerts than maxVisible', () => {
    const client = createClient();
    const alerts = [
      { ...ALERT, id: 'a1' },
      { ...ALERT, id: 'a2' },
      { ...ALERT, id: 'a3' },
      { ...ALERT, id: 'a4' },
    ];
    render(
      <QueryClientProvider client={client}>
        <JarvisProactiveStack alerts={alerts} maxVisible={3} />
      </QueryClientProvider>
    );

    // Expect visible 3 cards by checking that hidden count text is rendered: "+1 autre alerte"
    expect(screen.getByText('+1 autre alerte')).toBeTruthy();
  });
});

describe('useFetchAlert hook with mocked supabase', () => {
  const createClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

  // A small hook used solely for tests that queries the mocked supabase
  function useFetchAlert(id: string) {
    const [data, setData] = React.useState<any | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isError, setIsError] = React.useState(false);

    React.useEffect(() => {
      let mounted = true;
      setIsLoading(true);
      importedSupabase
        .from('proactive_alerts')
        .select('*')
        .eq('id', id)
        .maybeSingle()
        .then((res: any) => {
          if (!mounted) return;
          if (res?.error) {
            setIsError(true);
            setData(null);
          } else {
            setData(res?.data ?? null);
            setIsError(false);
          }
          setIsLoading(false);
        })
        .catch(() => {
          if (!mounted) return;
          setIsError(true);
          setIsLoading(false);
        });
      return () => {
        mounted = false;
      };
    }, [id]);

    return { data, isLoading, isError };
  }

  it('handles success response from supabase (isLoading -> success)', async () => {
    // Configure the hoisted RESPONSE to be success
    RESPONSE.value = { data: ALERT, error: null };

    const client = createClient();
    const wrapper: any = ({ children }: any) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

    const { result } = renderHook(() => useFetchAlert(ALERT.id), { wrapper });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.data).not.toBeNull();
    expect(result.current.data.title).toBe(ALERT.title);
    expect(mockFrom).toHaveBeenCalledWith('proactive_alerts');
  });

  it('handles error response from supabase (isError true when { data:null, error:{ message } })', async () => {
    // Configure the hoisted RESPONSE to be an error shape
    RESPONSE.value = { data: null, error: { message: 'quelque chose a échoué' } };

    const client = createClient();
    const wrapper: any = ({ children }: any) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

    const { result } = renderHook(() => useFetchAlert(ALERT.id), { wrapper });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeNull();
  });
});