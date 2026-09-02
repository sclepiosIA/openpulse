import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import MobileAppInstallPage from '../MobileAppInstallPage';

describe('MobileAppInstallPage', () => {
  it('redirects for unknown app', () => {
    render(
      <MemoryRouter initialEntries={['/m/install/unknown']}>
        <Routes>
          <Route path="/m/install/:app" element={<MobileAppInstallPage />} />
          <Route path="/m/install" element={<div data-testid="redirect">redirect</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('redirect')).toBeInTheDocument();
  });

  it('renders install page for todos app', () => {
    render(
      <MemoryRouter initialEntries={['/m/install/todos']}>
        <Routes>
          <Route path="/m/install/:app" element={<MobileAppInstallPage />} />
          <Route path="/m/install" element={<div>redirect</div>} />
        </Routes>
      </MemoryRouter>
    );
    // Should not redirect for valid app
    expect(screen.queryByText('redirect')).toBeNull();
  });
});
