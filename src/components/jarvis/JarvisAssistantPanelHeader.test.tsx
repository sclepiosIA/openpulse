const {
  mockVibrate,
  jarvisLogoPath,
  mockSetIsImmersive,
  mockTriggerProactiveScan,
  mockHandleNewConversation,
  mockSetShowHistory,
  mockOnClose,
  mockSetActiveTab,
  mockApiSuccess,
  mockApiError,
  mockMutate,
} = vi.hoisted(() => ({
  mockVibrate: vi.fn(),
  jarvisLogoPath: '/assets/jarvis-logo-mock.png',
  mockSetIsImmersive: vi.fn(),
  mockTriggerProactiveScan: vi.fn(),
  mockHandleNewConversation: vi.fn(),
  mockSetShowHistory: vi.fn(),
  mockOnClose: vi.fn(),
  mockSetActiveTab: vi.fn(),
  mockApiSuccess: vi.fn(() => Promise.resolve({ data: { value: 'ok' } })),
  mockApiError: vi.fn(() => Promise.resolve({ data: null, error: { message: 'x' } })),
  mockMutate: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('framer-motion', () => {
  const create = (tag) => {
    // simple passthrough component that renders the underlying tag and forwards props
    // include displayName to help debugging
    const Comp = ({ children, ...props }) => {
      return React.createElement(tag, props, children);
    };
    Comp.displayName = `Motion(${tag})`;
    return Comp;
  };
  return {
    motion: {
      div: create('div'),
      button: create('button'),
      span: create('span'),
    },
  };
});

vi.mock('lucide-react', () => {
  const Icon = (name) => {
    const Comp = ({ className, ...props }) =>
      React.createElement('svg', { 'data-icon': name, className: className ?? '', ...props });
    Comp.displayName = `Icon(${name})`;
    return Comp;
  };
  return {
    X: Icon('X'),
    Sparkles: Icon('Sparkles'),
    Zap: Icon('Zap'),
    RefreshCw: Icon('RefreshCw'),
    History: Icon('History'),
    Plus: Icon('Plus'),
    // export type LucideIcon isn't needed at runtime
  };
});

vi.mock('@/components/ui/button', () => {
  const Button = ({ children, asChild, ...props }) => {
    // asChild is ignored; render as button by default
    return React.createElement('button', { ...props }, children);
  };
  return { Button };
});

vi.mock('@/components/ui/badge', () => {
  const Badge = ({ children, ...props }) => React.createElement('span', { ...props }, children);
  return { Badge };
});

vi.mock('@/components/ui/tooltip', () => {
  const Tooltip = ({ children }) => React.createElement(React.Fragment, null, children);
  const TooltipTrigger = ({ children }) => React.createElement(React.Fragment, null, children);
  const TooltipContent = ({ children }) => React.createElement('div', null, children);
  return { Tooltip, TooltipTrigger, TooltipContent };
});

vi.mock('@/lib/utils', () => {
  return { cn: (...args) => args.filter(Boolean).join(' ') };
});

vi.mock('./JarvisImmersiveMode', () => {
  const ImmersiveToggle = ({ isImmersive, onToggle, className }) =>
    React.createElement(
      'button',
      {
        'data-testid': 'immersive-toggle',
        onClick: onToggle,
        className,
        type: 'button',
      },
      isImmersive ? 'immersive-on' : 'immersive-off',
    );
  return { ImmersiveToggle };
});

vi.mock('@/lib/haptics', () => {
  return { vibrateSelection: mockVibrate };
});

vi.mock('@/assets/jarvis-logo.png', () => {
  return { default: jarvisLogoPath };
});

// import React after setting up mocks
import React from 'react';
import { render, screen, fireEvent, waitFor, act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisAssistantPanelHeader } from './JarvisAssistantPanelHeader';

beforeEach(() => {
  vi.clearAllMocks();
});

const createQueryClientProviderWrapper = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  const Wrapper = ({ children }) => React.createElement(QueryClientProvider, { client: qc }, children);
  return Wrapper;
};

describe('JarvisAssistantPanelHeader UI behaviour', () => {
  it('renders header with logo, badges and calls callbacks on button clicks', async () => {
    render(
      React.createElement(JarvisAssistantPanelHeader, {
        shouldAnimate: true,
        isEnabled: true,
        pendingCount: 2,
        isImmersive: false,
        setIsImmersive: mockSetIsImmersive,
        isScanning: false,
        triggerProactiveScan: mockTriggerProactiveScan,
        handleNewConversation: mockHandleNewConversation,
        setShowHistory: mockSetShowHistory,
        onClose: mockOnClose,
        tabs: [
          { id: 'chat', label: 'Chat', icon: () => React.createElement('svg', { 'data-icon': 'Chat' }) },
          { id: 'actions', label: 'Actions', icon: () => React.createElement('svg', { 'data-icon': 'Actions' }) },
        ],
        activeTab: 'chat',
        setActiveTab: mockSetActiveTab,
      }),
    );

    // Brand and badge presence
    expect(screen.getByText('JARVIS')).toBeTruthy();
    expect(screen.getByText('GPT-5')).toBeTruthy();

    // Logo src uses mocked asset path
    const img = screen.getByAltText('Jarvis');
    expect(img).toBeTruthy();
    expect(img).toHaveAttribute('src', jarvisLogoPath);

    // Pending actions big badge
    expect(screen.getByText('2 actions')).toBeTruthy();

    // Proactive scan button triggers provided callback
    const refreshButton = screen.getByLabelText('Actualiser');
    fireEvent.click(refreshButton);
    expect(mockTriggerProactiveScan).toHaveBeenCalledTimes(1);

    // New conversation button triggers callback
    const addButton = screen.getByLabelText('Ajouter');
    fireEvent.click(addButton);
    expect(mockHandleNewConversation).toHaveBeenCalledTimes(1);

    // History button sets show history true
    const historyButton = screen.getByLabelText('Historique des conversations');
    fireEvent.click(historyButton);
    expect(mockSetShowHistory).toHaveBeenCalledTimes(1);
    expect(mockSetShowHistory).toHaveBeenCalledWith(true);

    // Close button present and triggers onClose
    const closeButton = screen.getByLabelText('Fermer');
    expect(closeButton).toBeTruthy();
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // Immersive toggle triggers vibrateSelection and setIsImmersive with toggled value
    const immersiveToggle = screen.getByTestId('immersive-toggle');
    fireEvent.click(immersiveToggle);
    expect(mockVibrate).toHaveBeenCalledTimes(1);
    expect(mockSetIsImmersive).toHaveBeenCalledTimes(1);
    expect(mockSetIsImmersive).toHaveBeenCalledWith(true);

    // Tabs: clicking 'Actions' should call setActiveTab with 'actions'
    const actionsTab = screen.getByText('Actions');
    fireEvent.click(actionsTab);
    expect(mockSetActiveTab).toHaveBeenCalledTimes(1);
    expect(mockSetActiveTab).toHaveBeenCalledWith('actions');
  });

  it('hides pending badges when pendingCount is 0 and shows scanning state on icon', () => {
    render(
      React.createElement(JarvisAssistantPanelHeader, {
        shouldAnimate: false,
        isEnabled: false,
        pendingCount: 0,
        isImmersive: false,
        setIsImmersive: mockSetIsImmersive,
        isScanning: true,
        triggerProactiveScan: mockTriggerProactiveScan,
        handleNewConversation: mockHandleNewConversation,
        setShowHistory: mockSetShowHistory,
        tabs: [{ id: 'chat', label: 'Chat', icon: () => React.createElement('svg', { 'data-icon': 'Chat' }) }],
        activeTab: 'chat',
        setActiveTab: mockSetActiveTab,
      }),
    );

    // No "actions" badge present when pendingCount is 0
    expect(screen.queryByText(/action/)).toBeNull();

    // The refresh icon receives animate-spin class when isScanning true
    const refreshIcon = document.querySelector('[data-icon="RefreshCw"]');
    expect(refreshIcon).toBeTruthy();
    const classList = refreshIcon.getAttribute('class') ?? '';
    expect(classList.includes('animate-spin')).toBe(true);
  });
});

describe('Standalone hook-like tests via renderHook with QueryClientProvider', () => {
  it('handles loading -> success state for a fake query hook', async () => {
    const Wrapper = createQueryClientProviderWrapper();

    const useFakeQuery = (shouldSucceed = true) => {
      const [state, setState] = React.useState({ isLoading: true, data: null, error: null });
      React.useEffect(() => {
        let mounted = true;
        (async () => {
          const res = shouldSucceed ? await mockApiSuccess() : await mockApiError();
          if (!mounted) return;
          if (res.error) {
            setState({ isLoading: false, data: null, error: res.error });
          } else {
            setState({ isLoading: false, data: res.data, error: null });
          }
        })();
        return () => {
          mounted = false;
        };
      }, [shouldSucceed]);
      return state;
    };

    const { result } = renderHook(({ succeed }) => useFakeQuery(succeed), {
      initialProps: { succeed: true },
      wrapper: Wrapper,
    });

    // initial loading
    expect(result.current.isLoading).toBe(true);

    // wait for resolution
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ value: 'ok' });
    expect(result.current.error).toBeNull();
    expect(mockApiSuccess).toHaveBeenCalled();
  });

  it('handles error result as isError for a fake query hook', async () => {
    const Wrapper = createQueryClientProviderWrapper();

    const useFakeQuery = (shouldSucceed = true) => {
      const [state, setState] = React.useState({ isLoading: true, data: null, error: null });
      React.useEffect(() => {
        let mounted = true;
        (async () => {
          const res = shouldSucceed ? await mockApiSuccess() : await mockApiError();
          if (!mounted) return;
          if (res.error) {
            setState({ isLoading: false, data: null, error: res.error });
          } else {
            setState({ isLoading: false, data: res.data, error: null });
          }
        })();
        return () => {
          mounted = false;
        };
      }, [shouldSucceed]);
      return state;
    };

    const { result } = renderHook(({ succeed }) => useFakeQuery(succeed), {
      initialProps: { succeed: false },
      wrapper: Wrapper,
    });

    // initial loading
    expect(result.current.isLoading).toBe(true);

    // wait for resolution to error
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual({ message: 'x' });
    expect(mockApiError).toHaveBeenCalled();
  });

  it('calls mutation function with correct payload', async () => {
    const Wrapper = createQueryClientProviderWrapper();

    const useFakeMutation = () => {
      const mutate = async (payload) => {
        return await mockMutate(payload);
      };
      return { mutate };
    };

    const { result } = renderHook(() => useFakeMutation(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutate({ id: '1', name: 'test' });
    });

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith({ id: '1', name: 'test' });
  });
});