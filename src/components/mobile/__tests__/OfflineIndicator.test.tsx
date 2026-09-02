import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineIndicator } from '../OfflineIndicator';

const mockOfflineStatus = { isOnline: true, isOffline: false, wasOffline: false };

vi.mock('@/hooks/shared/useOfflineStatus', () => ({
  useOfflineStatus: () => mockOfflineStatus,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('OfflineIndicator', () => {
  it('renders nothing when online', () => {
    const { container } = render(<OfflineIndicator />);
    expect(container.innerHTML).toBe('');
  });

  it('renders offline banner when offline', () => {
    mockOfflineStatus.isOnline = false;
    mockOfflineStatus.isOffline = true;
    render(<OfflineIndicator />);
    expect(screen.getByText('Hors ligne')).toBeInTheDocument();
    // Reset
    mockOfflineStatus.isOnline = true;
    mockOfflineStatus.isOffline = false;
  });
});
