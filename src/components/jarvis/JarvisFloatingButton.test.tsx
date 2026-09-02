import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

// Stable mocks and constants to avoid hoisting/react re-render traps
const {
  mockUseJarvis,
  mockUseJarvisProactiveAlerts,
  mockVibrateSelection,
  mockJarvisPremiumOnCloseHandler,
} = vi.hoisted(() => {
  return {
    mockUseJarvis: vi.fn(() => ({ pendingCount: 0, isTyping: false })),
    mockUseJarvisProactiveAlerts: vi.fn(() => ({ unreadCount: 0 })),
    mockVibrateSelection: vi.fn(),
    mockJarvisPremiumOnCloseHandler: vi.fn(),
  };
});

// Mock framer-motion to render plain DOM elements (preserve props and children)
vi.mock('framer-motion', () => {
  const create = (tag) => {
    // forward all props to the underlying DOM element for assertions
    return ({ children, ...props }) => {
      return React.createElement(tag, { ...props }, children);
    };
  };
  return {
    motion: {
      div: create('div'),
      button: create('button'),
      span: create('span'),
    },
    AnimatePresence: ({ children }) => React.createElement(React.Fragment, null, children),
  };
});

// Mock lucide-react Brain icon
vi.mock('lucide-react', () => {
  return {
    Brain: ({ className }) => React.createElement('svg', { 'data-testid': 'brain-icon', className }),
  };
});

// Mock utils.cn as simple joiner
vi.mock('@/lib/utils', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));

// Mock haptics
vi.mock('@/lib/haptics', () => ({
  vibrateSelection: (...args) => mockVibrateSelection(...args),
}));

// Mock hooks for jarvis
vi.mock('@/hooks/jarvis/useJarvis', () => ({
  useJarvis: () => mockUseJarvis(),
}));

vi.mock('@/hooks/jarvis/useJarvisProactiveAlerts', () => ({
  useJarvisProactiveAlerts: () => mockUseJarvisProactiveAlerts(),
}));

// Mock Sheet and SheetContent
vi.mock('@/components/ui/sheet', () => {
  const React = require('react');
  return {
    Sheet: ({ open, onOpenChange, children }) =>
      open ? React.createElement('div', { 'data-testid': 'sheet', 'data-open': 'true' }, children) : null,
    SheetContent: ({ children, ...props }) =>
      React.createElement('div', { 'data-testid': 'sheet-content', ...props }, children),
  };
});

// Mock JarvisPremiumPanel (component under same folder)
vi.mock('./JarvisPremiumPanel', () => {
  const React = require('react');
  return {
    JarvisPremiumPanel: ({ onClose, className }) =>
      React.createElement(
        'div',
        { 'data-testid': 'premium-panel', className },
        React.createElement('button', {
          'data-testid': 'premium-close',
          onClick: () => {
            // record and call provided onClose
            mockJarvisPremiumOnCloseHandler();
            if (typeof onClose === 'function') onClose();
          },
        }, 'Close')
      ),
  };
});

// Mock asset import
vi.mock('@/assets/jarvis-logo.png', () => ({
  default: 'jarvis-logo-mock',
}));

// Mock design system animations
vi.mock('./JarvisDesignSystem', () => ({
  JARVIS_ANIMATIONS: {
    spring: {
      bouncy: { type: 'spring', damping: 10 },
      smooth: { type: 'spring', damping: 20 },
    },
  },
}));

// Import the component under test AFTER mocks
import { JarvisFloatingButton } from './JarvisFloatingButton';
import { useJarvis } from '@/hooks/jarvis/useJarvis';
import { useJarvisProactiveAlerts } from '@/hooks/jarvis/useJarvisProactiveAlerts';

// QueryClient wrapper required by rules
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = createTestQueryClient();
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('JarvisFloatingButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // reset default stable mocks
    mockUseJarvis.mockReturnValue({ pendingCount: 0, isTyping: false });
    mockUseJarvisProactiveAlerts.mockReturnValue({ unreadCount: 0 });
  });

  it('renders without badge, opens sheet on click and vibrates, then closes sheet when panel requests close', async () => {
    // ensure initial hook values: no pending/unread
    mockUseJarvis.mockReturnValue({ pendingCount: 0, isTyping: false });
    mockUseJarvisProactiveAlerts.mockReturnValue({ unreadCount: 0 });

    const qc = createTestQueryClient();
    const { container } = render(
      React.createElement(QueryClientProvider, { client: qc }, React.createElement(JarvisFloatingButton, null))
    );

    // button should be present
    const button = container.querySelector('button');
    expect(button).toBeTruthy();

    // No badge present
    const badge = container.querySelector('.bg-destructive');
    expect(badge).toBeNull();

    // Click the button to open sheet
    await act(async () => {
      if (!button) throw new Error('button not found');
      fireEvent.click(button);
    });

    // vibrateSelection should have been called
    expect(mockVibrateSelection).toHaveBeenCalled();

    // JarvisPremiumPanel should be rendered inside sheet
    const panel = screen.queryByTestId('premium-panel');
    expect(panel).toBeTruthy();

    // Now click the close button inside panel
    const closeBtn = screen.getByTestId('premium-close');
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    // ensure our panel's onClose handler record was called
    expect(mockJarvisPremiumOnCloseHandler).toHaveBeenCalled();

    // After close, the sheet content should not be present
    expect(screen.queryByTestId('premium-panel')).toBeNull();
  });

  it('shows combined badge when there are unread and pending counts, shows typing state and hover label', async () => {
    // set counts and typing
    mockUseJarvis.mockReturnValue({ pendingCount: 2, isTyping: true });
    mockUseJarvisProactiveAlerts.mockReturnValue({ unreadCount: 5 });

    const qc = createTestQueryClient();
    const { container } = render(
      React.createElement(QueryClientProvider, { client: qc }, React.createElement(JarvisFloatingButton, null))
    );

    // Badge should show total 7
    const badgeElement = screen.getByText('7');
    expect(badgeElement).toBeTruthy();

    // Status indicator should have amber class for typing
    const status = container.querySelector('.bg-amber-500');
    expect(status).toBeTruthy();

    // Hover label appears on mouse enter and shows 'En réflexion...' because isTyping true
    const button = container.querySelector('button');
    expect(button).toBeTruthy();

    await act(async () => {
      if (!button) throw new Error('button not found');
      fireEvent.mouseEnter(button);
    });

    // The hover label should show the typing message
    const hoverText = screen.getByText('En réflexion...');
    expect(hoverText).toBeTruthy();

    // Hide hover
    await act(async () => {
      if (!button) throw new Error('button not found');
      fireEvent.mouseLeave(button);
    });

    // After mouse leave, the hover text should no longer be present
    expect(screen.queryByText('En réflexion...')).toBeNull();
  });

  it('exposes hook-like states for useJarvisProactiveAlerts: loading -> success -> error via renderHook with QueryClientProvider wrapper', async () => {
    // Prepare three different sequential return values for the mocked hook
    mockUseJarvisProactiveAlerts.mockReturnValueOnce({ unreadCount: 0, isLoading: true });
    // First renderHook: loading state
    const qc = createTestQueryClient();
    const { result: r1 } = renderHook(() => useJarvisProactiveAlerts(), { wrapper: (props) => React.createElement(QueryClientProvider, { client: qc }, props.children) });
    expect(r1.current.isLoading).toBe(true);

    // Next, simulate a successful fetch with unreadCount = 3
    mockUseJarvisProactiveAlerts.mockReturnValueOnce({ unreadCount: 3, isLoading: false });
    const { result: r2 } = renderHook(() => useJarvisProactiveAlerts(), { wrapper: (props) => React.createElement(QueryClientProvider, { client: qc }, props.children) });
    expect(r2.current.unreadCount).toBe(3);
    expect(r2.current.isLoading).toBe(false);

    // Finally simulate an error state
    const errorObj = { message: 'upstream failure' };
    mockUseJarvisProactiveAlerts.mockReturnValueOnce({ unreadCount: null, error: errorObj, isError: true });
    const { result: r3 } = renderHook(() => useJarvisProactiveAlerts(), { wrapper: (props) => React.createElement(QueryClientProvider, { client: qc }, props.children) });
    expect(r3.current.isError).toBe(true);
    expect(r3.current.error).toBe(errorObj);
  });
});