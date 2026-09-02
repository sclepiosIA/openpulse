import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisEntityReference } from './JarvisEntityReference';

const { ROWS, mockFrom } = vi.hoisted(() => ({
  ROWS: [{ id: 'row-1' }],
  mockFrom: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => navigateMock),
}));
const navigateMock = vi.fn();

vi.mock('@/components/search/AIEmailHoverCard', () => ({
  AIEmailHoverCard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ai-hover-wrapper">{children}</div>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('JarvisEntityReference', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    vi.clearAllMocks();
    window.dispatchEvent = vi.fn();
  });

  it('renders email type, wrapped by AIEmailHoverCard, and navigates on click', () => {
    render(
      <JarvisEntityReference type="email" entityId="123" title="Test Email" />,
      { wrapper }
    );

    // Ensure the AI hover wrapper is present
    expect(screen.getByTestId('ai-hover-wrapper')).toBeInTheDocument();

    // Click on the pill
    const button = screen.getByText('Test Email');
    fireEvent.click(button);

    // Expect navigation to email route
    expect(navigateMock).toHaveBeenCalledWith('/emails?thread=123');
    // Expect jarvis close event
    expect(window.dispatchEvent).toHaveBeenCalled();
  });

  it('navigates to ticket route on click for non-email type', () => {
    render(
      <JarvisEntityReference type="ticket" entityId="abc" title="Support Ticket" />,
      { wrapper }
    );

    const button = screen.getByText('Support Ticket');
    fireEvent.click(button);

    // Expect navigation to ticket route
    expect(navigateMock).toHaveBeenCalledWith('/support?ticket=abc');
    // Expect jarvis close event
    expect(window.dispatchEvent).toHaveBeenCalled();
  });
});