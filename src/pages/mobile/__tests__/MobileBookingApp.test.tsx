import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

vi.mock('@/components/pwa/AppInstallPrompt', () => ({
  AppInstallPrompt: () => null,
}));
vi.mock('@/pages/Booking', () => ({
  default: ({ isPWAMode }: any) => <div data-testid="booking">PWA:{String(isPWAMode)}</div>,
}));

import MobileBookingApp from '../MobileBookingApp';

describe('MobileBookingApp', () => {
  it('renders Booking with isPWAMode=true', () => {
    const { getByTestId } = render(<MobileBookingApp />);
    expect(getByTestId('booking').textContent).toContain('true');
  });
});
