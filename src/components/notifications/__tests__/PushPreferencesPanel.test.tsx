import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PushPreferencesPanel } from '../PushPreferencesPanel';

const mockUsePush = vi.fn();

vi.mock('@/hooks/notifications/usePushNotifications', () => ({
  usePushNotifications: () => mockUsePush(),
}));

vi.mock('@/hooks/shared/useAppConfig', () => ({
  useProductionUrl: () => 'https://gestion.exploitant.example.org',
}));

describe('PushPreferencesPanel', () => {
  it('shows aperçu tiers message', () => {
    mockUsePush.mockReturnValue({
      isSupported: true,
      permission: 'default',
      isSubscribed: false,
      isLoading: false,
      preferences: null,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      updatePreferences: vi.fn(),
      sendTestNotification: vi.fn(),
      isSendingTest: false,
      isIOSSafari: false,
      isIOSPWA: false,
      iosWebPushSupported: false,
      needsPWAInstall: false,
      isApercuTiersPreview: true,
    });
    render(<PushPreferencesPanel />);
    expect(screen.getByText('un aperçu tiers')).toBeInTheDocument();
    expect(screen.getByText(/Testez sur le site déployé/)).toBeInTheDocument();
  });

  it('shows loading skeleton', () => {
    mockUsePush.mockReturnValue({
      isSupported: true,
      permission: 'default',
      isSubscribed: false,
      isLoading: true,
      preferences: null,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      updatePreferences: vi.fn(),
      sendTestNotification: vi.fn(),
      isSendingTest: false,
      isIOSSafari: false,
      isIOSPWA: false,
      iosWebPushSupported: false,
      needsPWAInstall: false,
      isApercuTiersPreview: false,
    });
    render(<PushPreferencesPanel />);
    expect(screen.getByText('Notifications Push')).toBeInTheDocument();
  });

  it('shows not supported message', () => {
    mockUsePush.mockReturnValue({
      isSupported: false,
      permission: 'default',
      isSubscribed: false,
      isLoading: false,
      preferences: null,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      updatePreferences: vi.fn(),
      sendTestNotification: vi.fn(),
      isSendingTest: false,
      isIOSSafari: false,
      isIOSPWA: false,
      iosWebPushSupported: false,
      needsPWAInstall: false,
      isApercuTiersPreview: false,
    });
    render(<PushPreferencesPanel />);
    expect(screen.getByText(/pas supportées/)).toBeInTheDocument();
  });

  it('shows denied message', () => {
    mockUsePush.mockReturnValue({
      isSupported: true,
      permission: 'denied',
      isSubscribed: false,
      isLoading: false,
      preferences: null,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      updatePreferences: vi.fn(),
      sendTestNotification: vi.fn(),
      isSendingTest: false,
      isIOSSafari: false,
      isIOSPWA: false,
      iosWebPushSupported: false,
      needsPWAInstall: false,
      isApercuTiersPreview: false,
    });
    render(<PushPreferencesPanel />);
    expect(screen.getByText('Notifications bloquées')).toBeInTheDocument();
  });

  it('shows PWA install instructions on iOS', () => {
    mockUsePush.mockReturnValue({
      isSupported: true,
      permission: 'default',
      isSubscribed: false,
      isLoading: false,
      preferences: null,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      updatePreferences: vi.fn(),
      sendTestNotification: vi.fn(),
      isSendingTest: false,
      isIOSSafari: true,
      isIOSPWA: false,
      iosWebPushSupported: true,
      needsPWAInstall: true,
      isApercuTiersPreview: false,
    });
    render(<PushPreferencesPanel />);
    expect(screen.getByText('Installation requise sur iOS')).toBeInTheDocument();
  });

  it('shows activate button when not subscribed', () => {
    mockUsePush.mockReturnValue({
      isSupported: true,
      permission: 'default',
      isSubscribed: false,
      isLoading: false,
      preferences: null,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      updatePreferences: vi.fn(),
      sendTestNotification: vi.fn(),
      isSendingTest: false,
      isIOSSafari: false,
      isIOSPWA: false,
      iosWebPushSupported: false,
      needsPWAInstall: false,
      isApercuTiersPreview: false,
    });
    render(<PushPreferencesPanel />);
    expect(screen.getByText('Activer')).toBeInTheDocument();
    expect(screen.getByText('Notifications désactivées')).toBeInTheDocument();
  });

  it('shows preferences when subscribed', () => {
    mockUsePush.mockReturnValue({
      isSupported: true,
      permission: 'granted',
      isSubscribed: true,
      isLoading: false,
      preferences: {
        email_notifications: true,
        task_notifications: true,
        ai_suggestions: false,
        calendar_reminders: true,
        treasury_alerts: false,
        quiet_hours_start: null,
        quiet_hours_end: null,
      },
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      updatePreferences: vi.fn(),
      sendTestNotification: vi.fn(),
      isSendingTest: false,
      isIOSSafari: false,
      isIOSPWA: false,
      iosWebPushSupported: false,
      needsPWAInstall: false,
      isApercuTiersPreview: false,
    });
    render(<PushPreferencesPanel />);
    expect(screen.getByText('Notifications activées')).toBeInTheDocument();
    expect(screen.getByText('Désactiver')).toBeInTheDocument();
    expect(screen.getByText('Nouveaux emails')).toBeInTheDocument();
    expect(screen.getByText('Tâches assignées')).toBeInTheDocument();
    expect(screen.getByText('Suggestions IA')).toBeInTheDocument();
    expect(screen.getByText('Rappels calendrier')).toBeInTheDocument();
    expect(screen.getByText('Alertes trésorerie')).toBeInTheDocument();
    expect(screen.getByText('Tester')).toBeInTheDocument();
  });
});
