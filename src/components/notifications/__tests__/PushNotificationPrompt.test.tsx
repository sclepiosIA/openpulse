import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PushNotificationPrompt } from '../PushNotificationPrompt';

const mockUsePush = vi.fn();

vi.mock('@/hooks/notifications/usePushNotifications', () => ({
  usePushNotifications: () => mockUsePush(),
}));

// Ensure 'Notification' exists for the supportedness check
beforeEach(() => {
  localStorage.clear();
  // @ts-expect-error jsdom does not ship Notification
  if (!('Notification' in window)) window.Notification = function () {} as never;
});

describe('PushNotificationPrompt — null states', () => {
  it.each([
    ['not supported', { isSupported: false, permission: 'default', isSubscribed: false }],
    ['already subscribed', { isSupported: true, permission: 'granted', isSubscribed: true }],
    ['permission denied', { isSupported: true, permission: 'denied', isSubscribed: false }],
    ['aperçu tiers', { isSupported: true, permission: 'default', isSubscribed: false, isApercuTiersPreview: true }],
  ])('returns null when %s', (_label, partial) => {
    mockUsePush.mockReturnValue({
      isLoading: false,
      subscribe: vi.fn(),
      isApercuTiersPreview: false,
      ...partial,
    });
    const { container } = render(<PushNotificationPrompt />);
    expect(container.firstChild).toBeNull();
  });
});

describe('PushNotificationPrompt — visible banner', () => {
  it('shows the banner with title, description and Activer button after the 3s delay', async () => {
    const subscribe = vi.fn().mockResolvedValue(true);
    mockUsePush.mockReturnValue({
      isSupported: true,
      permission: 'default',
      isSubscribed: false,
      isLoading: false,
      subscribe,
      isApercuTiersPreview: false,
    });

    render(<PushNotificationPrompt />);
    expect(screen.queryByRole('dialog')).toBeNull();

    await waitFor(
      () => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      },
      { timeout: 4000, interval: 200 },
    );
    expect(screen.getByText('Activer les notifications push ?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fermer/i })).toBeInTheDocument();
  }, 10000);
});
