import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

vi.mock('@/components/documents/DocumentsPage', () => ({
  default: () => <div data-testid="docs-page" />,
}));
vi.mock('@/components/pwa/AppInstallPrompt', () => ({
  AppInstallPrompt: () => null,
}));

import MobileDocumentsApp from '../MobileDocumentsApp';

describe('MobileDocumentsApp', () => {
  it('renders without crashing', () => {
    const { container } = render(<MobileDocumentsApp />);
    expect(container.firstElementChild).toBeTruthy();
  });
});
