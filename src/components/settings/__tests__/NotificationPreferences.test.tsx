import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/notifications/useNotificationPreferences', () => ({
  useNotificationPreferences: () => ({
    preferences: {
      email_notifications: {
        ai_suggestions: { enabled: true, frequency: 'daily' },
        task_reminders: { enabled: false, frequency: 'weekly' },
        urgent_tasks: { enabled: true, threshold_days: 3 },
        establishment_updates: { enabled: true },
        team_mentions: { enabled: false },
      },
      in_app_notifications: {
        ai_suggestions: true,
        task_assignments: true,
        task_completions: false,
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
    isUpdating: false,
  }),
}));

vi.mock('@/components/notifications/PushPreferencesPanel', () => ({
  PushPreferencesPanel: () => <div data-testid="push-panel">Push</div>,
}));

import { NotificationPreferences } from '../NotificationPreferences';

describe('NotificationPreferences', () => {
  it('renders email notification section', () => {
    render(<NotificationPreferences />);
    expect(screen.getByText('Notifications par email')).toBeInTheDocument();
  });

  it('renders in-app notification section', () => {
    render(<NotificationPreferences />);
    expect(screen.getByText("Notifications dans l'application")).toBeInTheDocument();
  });

  it('renders quiet hours section', () => {
    render(<NotificationPreferences />);
    expect(screen.getByText('Heures de silence')).toBeInTheDocument();
  });

  it('renders save button', () => {
    render(<NotificationPreferences />);
    expect(screen.getByText('Enregistrer les préférences')).toBeInTheDocument();
  });

  it('renders push panel', () => {
    render(<NotificationPreferences />);
    expect(screen.getByTestId('push-panel')).toBeInTheDocument();
  });

  it('renders email notification switches', () => {
    render(<NotificationPreferences />);
    expect(screen.getAllByText('Suggestions IA').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Rappels de tâches')).toBeInTheDocument();
    expect(screen.getByText('Tâches urgentes')).toBeInTheDocument();
  });
});
