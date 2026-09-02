import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,mock')) },
}));
vi.mock('@/components/layouts/MobileAppLayout', () => ({
  MobileAppLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/lib/debug', () => ({ debug: { log: vi.fn(), error: vi.fn() } }));

import MobileAppsInstall from '../MobileAppsInstall';

describe('MobileAppsInstall', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter><MobileAppsInstall /></MemoryRouter>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
