import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/hooks/notifications/useNotifications', () => ({
  useNotificationRules: () => ({ data: [], isLoading: false }),
  useNotificationHistory: () => ({ data: [], isLoading: false }),
  useCreateNotificationRule: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateNotificationRule: () => ({ mutateAsync: vi.fn() }),
  useDeleteNotificationRule: () => ({ mutateAsync: vi.fn() }),
  useSendTestEmail: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/notifications/useNotificationPreferences', () => ({
  useNotificationPreferences: () => ({
    preferences: {
      email_notifications: {
        ai_suggestions: { enabled: true, frequency: 'daily' },
        task_reminders: { enabled: true, frequency: 'daily' },
        urgent_tasks: { enabled: true, threshold_days: 7 },
        establishment_updates: { enabled: true },
        team_mentions: { enabled: true },
      },
      in_app_notifications: {
        ai_suggestions: true,
        task_assignments: true,
        task_completions: true,
        establishment_status_changes: true,
        comments_mentions: true,
      },
      quiet_hours: {
        enabled: false,
        start_time: '20:00',
        end_time: '08:00',
      },
    },
    updatePreferences: vi.fn(),
    isLoading: false,
    isUpdating: false,
  }),
  NotificationPreferences: {},
}));
vi.mock('@/components/notifications/PushPreferencesPanel', () => ({
  PushPreferencesPanel: () => <div data-testid="push-panel" />,
}));

import GestionNotifications from '../GestionNotifications';

describe('GestionNotifications page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <GestionNotifications />
      </QueryClientProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
