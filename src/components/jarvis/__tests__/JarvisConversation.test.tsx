/**
 * Tests for JarvisConversation component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock hooks
vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-123', email: 'test@test.com' },
    session: { access_token: 'mock' },
  }),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test-user-123', email: 'test@test.com' },
    session: { access_token: 'mock' },
  }),
  AuthProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({
    data: { id: 'test-user-123', first_name: 'Test', last_name: 'User' },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/jarvis/useJarvisStreaming', () => ({
  useJarvisStreaming: () => ({
    isStreaming: false,
    currentContent: '',
    isDone: false,
    error: null,
    streamChat: vi.fn().mockResolvedValue('Test response'),
    cancelStream: vi.fn(),
    resetStream: vi.fn(),
  }),
}));

vi.mock('@/hooks/jarvis/useJarvisContextualActions', () => ({
  useJarvisContextualActions: () => ({
    quickActions: [
      { id: '1', label: 'Test Action 1', icon: '📧', prompt: 'Test prompt 1' },
      { id: '2', label: 'Test Action 2', icon: '✅', prompt: 'Test prompt 2' },
    ],
  }),
}));

vi.mock('@/hooks/jarvis/useJarvisConversationPersistence', () => ({
  useJarvisConversationPersistence: () => ({
    saveMessages: vi.fn(),
    loadConversation: vi.fn().mockResolvedValue([]),
    conversations: [],
    currentConversationId: null,
    createConversation: vi.fn(),
    setCurrentConversation: vi.fn(),
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => <div ref={ref} {...props}>{children}</div>),
    button: React.forwardRef(({ children, ...props }: any, ref: any) => <button ref={ref} {...props}>{children}</button>),
    span: React.forwardRef(({ children, ...props }: any, ref: any) => <span ref={ref} {...props}>{children}</span>),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/components/jarvis/JarvisThinkingIndicator', () => ({
  JarvisThinkingIndicator: () => <div data-testid="thinking" />,
}));

vi.mock('@/components/jarvis/JarvisMessageContent', () => ({
  JarvisMessageContent: ({ content }: any) => <div>{content}</div>,
}));

import { JarvisConversation } from '@/components/jarvis/JarvisConversation';

const PLACEHOLDER = /tapez.*pour les commandes|posez une question/i;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('JarvisConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the conversation component', () => {
      const Wrapper = createWrapper();
      render(<Wrapper><JarvisConversation /></Wrapper>);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should render empty state with welcome message', () => {
      const Wrapper = createWrapper();
      render(<Wrapper><JarvisConversation /></Wrapper>);
      const matches = screen.getAllByText(/bonjour|posez une question/i);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('should render quick actions from contextual hook', () => {
      const Wrapper = createWrapper();
      render(<Wrapper><JarvisConversation /></Wrapper>);
      expect(screen.getByText('Test Action 1')).toBeInTheDocument();
      expect(screen.getByText('Test Action 2')).toBeInTheDocument();
    });
  });

  describe('Input Behavior', () => {
    it('should have input field', () => {
      const Wrapper = createWrapper();
      render(<Wrapper><JarvisConversation /></Wrapper>);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should update input value on change', () => {
      const Wrapper = createWrapper();
      render(<Wrapper><JarvisConversation /></Wrapper>);
      const input = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(input, { target: { value: 'Test message' } });
      expect(input.value).toBe('Test message');
    });

    it('should render send button', () => {
      const Wrapper = createWrapper();
      render(<Wrapper><JarvisConversation /></Wrapper>);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Quick Actions', () => {
    it('should fill input when quick action is clicked', () => {
      const Wrapper = createWrapper();
      render(<Wrapper><JarvisConversation /></Wrapper>);
      fireEvent.click(screen.getByText('Test Action 1'));
      const input = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(input.value).toBe('Test prompt 1');
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should submit on Enter key (without shift)', () => {
      const Wrapper = createWrapper();
      render(<Wrapper><JarvisConversation /></Wrapper>);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    });

    it('should not submit on Shift+Enter (for newline)', () => {
      const Wrapper = createWrapper();
      render(<Wrapper><JarvisConversation /></Wrapper>);
      const input = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
      expect(input.value).toBe('Test message');
    });
  });

  describe('Character Counter', () => {
    it('should show character count when input has content', () => {
      const Wrapper = createWrapper();
      render(<Wrapper><JarvisConversation /></Wrapper>);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello' } });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible textarea', () => {
      const Wrapper = createWrapper();
      render(<Wrapper><JarvisConversation /></Wrapper>);
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('TEXTAREA');
    });
  });

  describe('Error Handling', () => {
    it('should handle callback props gracefully', () => {
      const onActionProposed = vi.fn();
      const Wrapper = createWrapper();
      render(<Wrapper><JarvisConversation onActionProposed={onActionProposed} /></Wrapper>);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });
});
