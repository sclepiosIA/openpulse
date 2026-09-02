import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

vi.mock('@/pages/Calendrier', () => ({
  default: () => <div data-testid="calendrier" />,
}));
vi.mock('@/components/pwa/AppInstallPrompt', () => ({
  AppInstallPrompt: () => null,
}));

import MobileCalendarApp from '../MobileCalendarApp';

describe('MobileCalendarApp', () => {
  it('renders Calendrier component', () => {
    const { getByTestId } = render(<MobileCalendarApp />);
    expect(getByTestId('calendrier')).toBeInTheDocument();
  });
});
