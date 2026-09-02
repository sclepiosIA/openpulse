import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JarvisGlobalAlertIndicator } from './JarvisGlobalAlertIndicator';

const { ALERTS, mockFrom, mockMarkAsRead, mockDismiss } = vi.hoisted(() => ({
  ALERTS: [
    { id: 'alert1', title: 'Critical issue', message: 'Something critical', priority: 'high', read: false },
    { id: 'alert2', title: 'Info', message: 'Just info', priority: 'low', read: true },
  ],
  mockFrom: vi.fn(),
  mockMarkAsRead: vi.fn(),
  mockDismiss: vi.fn(),
}));

vi.mock('@/hooks/jarvis/useJarvisProactiveAlerts', () => ({
  useJarvisProactiveAlerts: () => ({
    alerts: ALERTS,
    unreadCount: ALERTS.filter(a => !a.read && (a.priority === 'critical' || a.priority === 'high')).length,
    markAsRead: mockMarkAsRead,
    dismissAlert: mockDismiss,
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: {
          queries: { retry: 0, gcTime: 0 },
          mutations: { retry: 0 },
        },
      })
    }
  >
    {children}
  </QueryClientProvider>
);

describe('JarvisGlobalAlertIndicator', () => {
  beforeEach(() => {
    mockMarkAsRead.mockReset();
    mockDismiss.mockReset();
  });

  it('renders an alert when there is a critical/high unread alert', () => {
    render(<JarvisGlobalAlertIndicator onOpenJarvis={vi.fn()} />, { wrapper });

    // Most urgent alert should be shown
    expect(screen.queryByText('Critical issue')).not.toBeNull();
  });

  it('triggers actions for details and dismiss', async () => {
    const onOpenJarvis = vi.fn();

    render(<JarvisGlobalAlertIndicator onOpenJarvis={onOpenJarvis} />, { wrapper });

    // Click on "Voir les détails" to mark as read and open
    const detailsButton = screen.getByRole('button', { name: /Voir les détails →/i });
    await fireEvent.click(detailsButton);

    expect(mockMarkAsRead).toHaveBeenCalledWith('alert1');
    expect(onOpenJarvis).toHaveBeenCalled();

    // Close/dismiss should mark as read for that alert
    const closeButton = screen.getByRole('button', { name: /Fermer/i });
    await fireEvent.click(closeButton);

    // After dismiss, markAsRead should have been called again for the same alert
    expect(mockMarkAsRead).toHaveBeenCalledWith('alert1');

    // After dismiss, the alert should no longer be in the document
    await waitFor(() => {
      expect(screen.queryByText('Critical issue')).toBeNull();
    });
  });
});