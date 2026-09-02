import React from 'react';
import { render, fireEvent, waitFor, screen, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { vi } from 'vitest';

// Stable mocks and constants via vi.hoisted to avoid re-creation and TDZ issues
const {
  MOCK_CN,
  MOCK_VIBRATE,
  MOCK_LOCATION,
  MOCK_ON_SEND,
  MOCK_ON_LOAD,
  MOCK_CONVERSATIONS,
  ICONS,
  FETCH_SUCCESS,
  FETCH_ERROR
} = vi.hoisted(() => {
  const MOCK_VIBRATE = vi.fn();
  const MOCK_ON_SEND = vi.fn();
  const MOCK_ON_LOAD = vi.fn();

  // Simple cn implementation
  const MOCK_CN = (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' ');

  // Default location object; tests will override pathname as needed by mutating this object
  const MOCK_LOCATION = { pathname: '/' } as { pathname: string };

  // Simple icon factory returning React components rendering a span with data-testid
  const makeIcon = (name: string) => {
    const Comp: React.FC<any> = (props) =>
      React.createElement('svg', { 'data-testid': name, ...props }, null);
    return Comp;
  };

  const names = [
    'Sparkles',
    'MessageCircle',
    'Mail',
    'Calendar',
    'BarChart2',
    'FileText',
    'CheckCircle2',
    'Bell',
    'TrendingUp',
    'Users',
    'Zap',
    'Clock',
    'Sun',
    'Moon',
    'Sunrise',
    'Brain',
    'ArrowRight',
    'History'
  ];

  const ICONS: Record<string, React.FC<any>> = names.reduce((acc, n) => {
    acc[n] = makeIcon(n);
    return acc;
  }, {} as Record<string, React.FC<any>>);

  // Recent conversations stable array
  const MOCK_CONVERSATIONS = [
    { id: 'c1', title: 'Discussion 1', date: new Date(2021, 0, 15) },
    { id: 'c2', title: 'Discussion 2', date: new Date(2021, 1, 20) },
  ] as Array<{ id: string; title: string; date: Date }>;

  // Fetcher functions for react-query testing
  const FETCH_SUCCESS = vi.fn(async () => {
    return { value: 'ok' };
  });

  const FETCH_ERROR = vi.fn(async () => {
    throw new Error('x');
  });

  return {
    MOCK_CN,
    MOCK_VIBRATE,
    MOCK_LOCATION,
    MOCK_ON_SEND,
    MOCK_ON_LOAD,
    MOCK_CONVERSATIONS,
    ICONS,
    FETCH_SUCCESS,
    FETCH_ERROR
  };
});

// Mock '@/lib/utils' -> cn
vi.mock('@/lib/utils', () => {
  return {
    cn: (...args: any[]) => MOCK_CN(...args)
  };
});

// Mock '@/lib/haptics' -> vibrateSelection
vi.mock('@/lib/haptics', () => {
  return {
    vibrateSelection: MOCK_VIBRATE
  };
});

// Mock 'react-router-dom' -> useLocation
vi.mock('react-router-dom', () => {
  return {
    useLocation: () => MOCK_LOCATION
  };
});

// Mock 'framer-motion' to return simple React components that ignore motion-specific props
vi.mock('framer-motion', () => {
  const create = (tag: string) => {
    const Comp: React.FC<any> = (props) => {
      const { children, initial, animate, transition, whileHover, whileTap, ...rest } = props as any;
      return React.createElement(tag, rest, children);
    };
    return Comp;
  };
  return { motion: { div: create('div'), button: create('button'), p: create('p'), svg: create('svg') } };
});

// Mock 'lucide-react' icons to stable components from ICONS
vi.mock('lucide-react', () => {
  return {
    Sparkles: ICONS.Sparkles,
    MessageCircle: ICONS.MessageCircle,
    Mail: ICONS.Mail,
    Calendar: ICONS.Calendar,
    BarChart2: ICONS.BarChart2,
    FileText: ICONS.FileText,
    CheckCircle2: ICONS.CheckCircle2,
    Bell: ICONS.Bell,
    TrendingUp: ICONS.TrendingUp,
    Users: ICONS.Users,
    Zap: ICONS.Zap,
    Clock: ICONS.Clock,
    Sun: ICONS.Sun,
    Moon: ICONS.Moon,
    Sunrise: ICONS.Sunrise,
    Brain: ICONS.Brain,
    ArrowRight: ICONS.ArrowRight,
    History: ICONS.History,
  };
});

// Now import the component under test after mocks
import { JarvisEnhancedWelcome } from './JarvisEnhancedWelcome';

// Helper: create QueryClient wrapper as required by the rules
function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { Wrapper, qc };
}

describe('JarvisEnhancedWelcome component', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders morning greeting and contextual suggestions for /etablissements and sends prompt on suggestion click', async () => {
    const getHoursSpy = vi.spyOn(Date.prototype, 'getHours').mockReturnValue(9);

    // Set location to etablissements path
    MOCK_LOCATION.pathname = '/etablissements/42';

    const onSend = MOCK_ON_SEND;
    const onLoad = MOCK_ON_LOAD;

    const { Wrapper } = createWrapper();

    render(
      <JarvisEnhancedWelcome
        userName="Alice Dupont"
        onSendMessage={onSend}
        onLoadConversation={onLoad}
        recentConversations={[]}
        className="test-class"
      />,
      { wrapper: Wrapper }
    );

    // Greeting should include 'Bonjour' and first name 'Alice'
    expect(screen.getByText(/Bonjour, Alice/)).toBeTruthy();

    // Morning suggestions include 'Briefing matinal' and 'Emails urgents'
    expect(screen.getByText('Briefing matinal')).toBeTruthy();
    expect(screen.getByText('Emails urgents')).toBeTruthy();

    // Specific suggestion from etablissements should be present
    expect(screen.getByText('Pipeline commercial')).toBeTruthy();

    // Click pipeline suggestion and expect onSendMessage called with its prompt
    const pipelineButton = screen.getByText('Pipeline commercial');
    fireEvent.click(pipelineButton);
    expect(MOCK_VIBRATE).toHaveBeenCalled();
    expect(onSend).toHaveBeenCalledWith("Donne-moi l'état complet du pipeline commercial");

    getHoursSpy.mockRestore();
  });

  it('renders recent conversations and calls onLoadConversation on click', async () => {
    const getHoursSpy = vi.spyOn(Date.prototype, 'getHours').mockReturnValue(14);

    MOCK_LOCATION.pathname = '/somewhere';

    const onLoad = MOCK_ON_LOAD;

    const { Wrapper } = createWrapper();

    render(
      <JarvisEnhancedWelcome
        userName="Bob Martin"
        onLoadConversation={onLoad}
        recentConversations={MOCK_CONVERSATIONS}
      />,
      { wrapper: Wrapper }
    );

    // Should show header for recent conversations
    expect(screen.getByText('Conversations récentes')).toBeTruthy();

    // Titles of conversations are displayed (slice(0,3) so both appear)
    expect(screen.getByText('Discussion 1')).toBeTruthy();
    expect(screen.getByText('Discussion 2')).toBeTruthy();

    // Click the first conversation and ensure onLoadConversation is invoked with its id
    const convButton = screen.getByText('Discussion 1');
    fireEvent.click(convButton);
    expect(MOCK_VIBRATE).toHaveBeenCalled();
    expect(onLoad).toHaveBeenCalledWith('c1');

    getHoursSpy.mockRestore();
  });
});

describe('React Query hook flows (loading -> success / loading -> error) using renderHook', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('react-query successful fetch flow: isLoading then isSuccess', async () => {
    const fetcher = FETCH_SUCCESS;

    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useQuery({ queryKey: ['test-success'], queryFn: fetcher }), { wrapper: Wrapper });

    // Initially should be loading
    expect(result.current.isLoading).toBe(true);

    // Wait for success
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Validate returned data shape from our stable fetcher
    expect(result.current.data).toEqual({ value: 'ok' });
    expect(fetcher).toHaveBeenCalled();
  });

  it('react-query error flow: isError true and error message propagated', async () => {
    const fetcher = FETCH_ERROR;

    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useQuery({ queryKey: ['test-error'], queryFn: fetcher }), { wrapper: Wrapper });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for error
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Error should have message 'x'
    expect((result.current.error as Error).message).toBe('x');
    expect(fetcher).toHaveBeenCalled();
  });
});