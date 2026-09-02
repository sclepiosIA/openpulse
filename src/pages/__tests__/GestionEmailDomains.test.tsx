import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/email/useEmailDomainMappings', () => ({
  useEmailDomainMappings: () => ({ data: [], isLoading: false }),
  useUpdateDomainMapping: () => ({ mutateAsync: vi.fn() }),
  useRemoveDomainMapping: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/hooks/email/useEmailSuggestionsPending', () => ({
  useEmailSuggestionsPending: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/components/email/EmailClassificationDashboard', () => ({
  EmailClassificationDashboard: () => <div />,
}));
vi.mock('@/components/email/EmailSuggestionsPendingWidget', () => ({
  EmailSuggestionsPendingWidget: () => <div />,
}));

import GestionEmailDomains from '../GestionEmailDomains';

describe('GestionEmailDomains page', () => {
  it('renders without crashing', () => {
    const { container } = render(<MemoryRouter><GestionEmailDomains /></MemoryRouter>);
    expect(container.firstElementChild).toBeTruthy();
  });
});
