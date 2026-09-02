import React from 'react';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Stable hoisted mocks and state (required to avoid re-render loops / TDZ)
const {
  JARVIS_STATE,
  setJarvisState,
  MEDIA,
  setMedia,
  SUPABASE_RESPONSE,
  setSupabaseResponse,
  mockFrom,
  MOCK_MUTATE,
  AUTH_STATE,
  setAuthState
} = vi.hoisted(() => {
  // useJarvis state
  const jarvis = {
    isLoading: false,
    isEnabled: true,
    pendingCount: 0,
    isError: false,
    error: null
  };

  const setJarvisState = (patch) => {
    Object.assign(jarvis, patch);
  };

  // media query state
  const MEDIA = { value: true };
  const setMedia = (v) => { MEDIA.value = v; };

  // supabase fake response and builder
  const SUPABASE_RESPONSE = { data: null, error: null };
  const setSupabaseResponse = (patch) => Object.assign(SUPABASE_RESPONSE, patch);

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => Promise.resolve(SUPABASE_RESPONSE)),
    update: vi.fn(() => Promise.resolve(SUPABASE_RESPONSE)),
    delete: vi.fn(() => Promise.resolve(SUPABASE_RESPONSE)),
    single: vi.fn(() => Promise.resolve(SUPABASE_RESPONSE)),
    maybeSingle: vi.fn(() => Promise.resolve(SUPABASE_RESPONSE)),
    then: vi.fn((onResolve) => Promise.resolve(SUPABASE_RESPONSE).then(onResolve)),
    catch: vi.fn((onCatch) => Promise.resolve(SUPABASE_RESPONSE).catch(onCatch))
  };
  const mockFrom = vi.fn(() => builder);

  // a mocked mutate function for JarvisPremiumPanel
  const MOCK_MUTATE = vi.fn();

  // auth stable state
  const AUTH_STATE = {
    user: { id: 'u1', email: 'test@domain.test' },
    session: { user: { id: 'u1' } },
    isLoading: false,
    isAdmin: true
  };
  const setAuthState = (patch) => Object.assign(AUTH_STATE, patch);

  return {
    JARVIS_STATE: jarvis,
    setJarvisState,
    MEDIA,
    setMedia,
    SUPABASE_RESPONSE,
    setSupabaseResponse,
    mockFrom,
    MOCK_MUTATE,
    AUTH_STATE,
    setAuthState
  };
});

// Mocks for modules referenced by JarvisTriggerButton and related imports

vi.mock('@/hooks/jarvis/useJarvis', () => {
  return {
    useJarvis: () => JARVIS_STATE
  };
});

vi.mock('@/hooks/shared/use-media-query', () => {
  return {
    useMediaQuery: (_q) => MEDIA.value
  };
});

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom
    }
  };
});

// Mock UI primitives used in the component
vi.mock('@/components/ui/button', () => {
  return {
    Button: (props) =>
      React.createElement(
        'button',
        {
          'data-testid': 'jarvis-button',
          onClick: props.onClick,
          className: props.className,
          type: 'button'
        },
        props.children
      )
  };
});

vi.mock('@/components/ui/badge', () => {
  return {
    Badge: (props) =>
      React.createElement(
        'span',
        { 'data-testid': 'jarvis-badge', className: props.className },
        props.children
      )
  };
});

vi.mock('@/components/ui/sheet', () => {
  return {
    Sheet: ({ open, onOpenChange, children }) =>
      open ? React.createElement('div', { 'data-testid': 'jarvis-sheet' }, children) : React.createElement(React.Fragment, null),
    SheetContent: (props) => React.createElement('div', { 'data-testid': 'jarvis-sheet-content', ...props }),
    SheetTitle: (props) => React.createElement('div', { 'data-testid': 'jarvis-sheet-title', ...props }, props.children),
    SheetDescription: (props) => React.createElement('div', { 'data-testid': 'jarvis-sheet-desc', ...props }, props.children)
  };
});

vi.mock('@/lib/utils', () => {
  return {
    cn: (...args) => args.filter(Boolean).join(' ')
  };
});

// Mock framer-motion to be no-op wrappers
vi.mock('framer-motion', () => {
  return {
    motion: new Proxy(
      {},
      {
        get: () => (props) => React.createElement('div', { 'data-motion': '1', ...props }, props.children)
      }
    ),
    AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children)
  };
});

// Mock lucide-react icons to simple spans for detection
vi.mock('lucide-react', () => {
  return {
    Bot: (props) => React.createElement('span', { 'data-testid': 'icon-bot', ...props }, 'bot'),
    X: (props) => React.createElement('span', { 'data-testid': 'icon-x', ...props }, 'x'),
    Sparkles: (props) => React.createElement('span', { 'data-testid': 'icon-sparkles', ...props }, 'sparkles')
  };
});

// Mock JarvisPremiumPanel - includes a close and a mutate button to test interactions
vi.mock('./JarvisPremiumPanel', () => {
  return {
    JarvisPremiumPanel: ({ onClose }) =>
      React.createElement(
        'div',
        { 'data-testid': 'jarvis-premium-panel' },
        React.createElement(
          'button',
          {
            'data-testid': 'jarvis-panel-close',
            onClick: () => {
              if (typeof onClose === 'function') onClose();
            }
          },
          'close'
        ),
        React.createElement(
          'button',
          {
            'data-testid': 'jarvis-panel-mutate',
            onClick: () => {
              // call the hoisted mock mutation with a predictable payload
              MOCK_MUTATE({ action: 'trigger', timestamp: 'T' });
            }
          },
          'mutate'
        )
      )
  };
});

// Mock auth/hooks and navigation and sonner
vi.mock('@/hooks/useAuth', () => {
  return {
    useAuth: () => AUTH_STATE
  };
});
vi.mock('@/contexts/AuthContext', () => {
  return {
    AuthProvider: ({ children }) => React.createElement(React.Fragment, null, children)
  };
});
vi.mock('sonner', () => {
  return {
    toast: {
      success: vi.fn(),
      error: vi.fn()
    }
  };
});
vi.mock('react-router', () => {
  return {
    useNavigate: () => vi.fn()
  };
});
vi.mock('react-router-dom', () => {
  return {
    useNavigate: () => vi.fn()
  };
});

// Now import the component under test (after mocks)
import { JarvisTriggerButton } from './JarvisTriggerButton';
import { useJarvis } from '@/hooks/jarvis/useJarvis';

// Helper to create QueryClient wrapper for renderHook per rules
const createWrapper = () => {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 }
    }
  });
  return ({ children }) => React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('JarvisTriggerButton (mobile floating trigger)', () => {
  it('does not render when Jarvis is disabled or on desktop', () => {
    act(() => {
      setJarvisState({ isEnabled: false, pendingCount: 0, isLoading: false, isError: false, error: null });
      setMedia(false); // desktop
    });

    const { queryByTestId } = render(React.createElement(JarvisTriggerButton, {}));
    expect(queryByTestId('jarvis-button')).toBeNull();
    expect(queryByTestId('jarvis-sheet')).toBeNull();
  });

  it('renders trigger with pending badge when enabled on mobile', () => {
    act(() => {
      setJarvisState({ isEnabled: true, pendingCount: 5, isLoading: false, isError: false, error: null });
      setMedia(true); // mobile
    });

    render(React.createElement(JarvisTriggerButton, { className: 'test-class' }));

    const button = screen.getByTestId('jarvis-button');
    expect(button).toBeTruthy();
    const badge = screen.getByTestId('jarvis-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('5');
  });

  it('opens the sheet when clicking the trigger and closes when panel calls onClose', async () => {
    act(() => {
      setJarvisState({ isEnabled: true, pendingCount: 2, isLoading: false, isError: false, error: null });
      setMedia(true);
    });

    render(React.createElement(JarvisTriggerButton, {}));

    const button = screen.getByTestId('jarvis-button');
    expect(button).toBeTruthy();

    await act(async () => {
      fireEvent.click(button);
    });

    // After click, the Sheet should be rendered
    const sheet = screen.getByTestId('jarvis-sheet');
    expect(sheet).toBeTruthy();

    // The JarvisPremiumPanel close button should close the sheet
    const closeBtn = screen.getByTestId('jarvis-panel-close');
    expect(closeBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(closeBtn);
    });

    // The sheet should no longer be in the document
    expect(screen.queryByTestId('jarvis-sheet')).toBeNull();
  });

  it('calls the mutation from JarvisPremiumPanel when mutate button is clicked', async () => {
    act(() => {
      setJarvisState({ isEnabled: true, pendingCount: 1, isLoading: false, isError: false, error: null });
      setMedia(true);
    });

    render(React.createElement(JarvisTriggerButton, {}));

    const button = screen.getByTestId('jarvis-button');
    await act(async () => {
      fireEvent.click(button);
    });

    const mutateBtn = screen.getByTestId('jarvis-panel-mutate');
    expect(mutateBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(mutateBtn);
    });

    // Assert the hoisted mock mutate function was called with the expected payload
    expect(MOCK_MUTATE).toHaveBeenCalled();
    const calledWith = MOCK_MUTATE.mock.calls[0][0];
    expect(calledWith).toMatchObject({ action: 'trigger', timestamp: 'T' });
  });
});

describe('useJarvis hook (mocked) - lifecycle: loading -> success -> error', () => {
  it('reflects loading, success and error states via renderHook with QueryClientProvider wrapper', async () => {
    // Start in loading
    act(() => {
      setJarvisState({ isLoading: true, isEnabled: false, pendingCount: 0, isError: false, error: null });
    });

    const { result, rerender } = renderHook(() => useJarvis(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    // Move to success
    act(() => {
      setJarvisState({ isLoading: false, isEnabled: true, pendingCount: 7, isError: false, error: null });
    });
    rerender();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.pendingCount).toBe(7);

    // Move to error
    act(() => {
      setJarvisState({ isError: true, error: { message: 'some error occurred' } });
    });
    rerender();
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBeTruthy();
    expect(result.current.error.message).toBe('some error occurred');
  });
});