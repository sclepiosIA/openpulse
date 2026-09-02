import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const mockNotifications = [
  {
    id: 'n1',
    title: 'Nouvelle tâche',
    message: 'Vous avez été assigné à une tâche',
    type: 'task_assignment',
    is_read: false,
    created_at: new Date().toISOString(),
    related_type: null,
    related_id: null,
  },
  {
    id: 'n2',
    title: 'Suggestion IA',
    message: 'Jarvis a une suggestion',
    type: 'ai_suggestion',
    is_read: true,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    related_type: null,
    related_id: null,
  },
];

vi.mock('@/hooks/dashboard/useInAppNotifications', () => ({
  useInAppNotifications: () => ({
    notifications: mockNotifications,
    unreadCount: 1,
    isLoading: false,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
  }),
}));

vi.mock('@/hooks/notifications/useNotificationTest', () => ({
  useNotificationTest: () => ({
    createTestNotification: vi.fn(),
    isCreating: false,
  }),
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

describe('NotificationBadge', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  const renderNotifBadge = async (props = {}) => {
    const { NotificationBadge } = await import('@/components/layout/NotificationBadge');
    return render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(MemoryRouter, null,
          React.createElement(NotificationBadge, props)
        )
      )
    );
  };

  it('should render bell icon', async () => {
    await renderNotifBadge();
    // The Bell icon renders as an SVG
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should show unread count badge', async () => {
    await renderNotifBadge();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should accept ghost-white variant', async () => {
    await renderNotifBadge({ variant: 'ghost-white' });
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });
});
