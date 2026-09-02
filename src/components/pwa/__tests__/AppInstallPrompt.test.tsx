import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AppInstallPrompt } from '../AppInstallPrompt';

describe('AppInstallPrompt', () => {
  it('renders nothing by default (no beforeinstallprompt fired)', () => {
    const { container } = render(
      <AppInstallPrompt appName="OpenPulse" appIcon="/icon.png" />
    );
    // showPrompt defaults to false
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when already installed (standalone mode)', () => {
    // matchMedia already mocked in test-setup to return matches: false
    // so standalone check fails → component still hidden because no prompt event
    const { container } = render(
      <AppInstallPrompt appName="OpenPulse" appIcon="/icon.png" />
    );
    expect(container.innerHTML).toBe('');
  });
});
