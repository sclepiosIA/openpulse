import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/components/email/EmailClassificationDashboard', () => ({
  EmailClassificationDashboard: () => <div data-testid="class-dash" />,
}));
vi.mock('@/components/email/ExcludedDomainsManager', () => ({
  ExcludedDomainsManager: () => <div />,
}));

import EmailClassificationAnalytics from '../EmailClassificationAnalytics';

describe('EmailClassificationAnalytics page', () => {
  it('renders title', () => {
    render(<MemoryRouter><EmailClassificationAnalytics /></MemoryRouter>);
    expect(screen.getByText(/Analytics de Classification/)).toBeInTheDocument();
  });

  it('renders classification dashboard', () => {
    render(<MemoryRouter><EmailClassificationAnalytics /></MemoryRouter>);
    expect(screen.getByTestId('class-dash')).toBeInTheDocument();
  });
});
