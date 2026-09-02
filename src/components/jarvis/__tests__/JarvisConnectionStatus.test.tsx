import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('@/hooks/shared/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, isOffline: false }),
}));

import { JarvisConnectionStatus } from '../JarvisConnectionStatus';

describe('JarvisConnectionStatus', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <TooltipProvider>
        <JarvisConnectionStatus />
      </TooltipProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });

  it('accepts showLabel prop', () => {
    const { container } = render(
      <TooltipProvider>
        <JarvisConnectionStatus showLabel={true} />
      </TooltipProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
