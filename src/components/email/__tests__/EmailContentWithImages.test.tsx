import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { EmailContentWithImages } from '../EmailContentWithImages';

vi.mock('@/hooks/email/useThreadImages', () => ({
  useMessageAttachments: () => ({
    attachments: [],
    resolveCid: () => null,
    isLoading: false,
  }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('EmailContentWithImages', () => {
  it('renders HTML content', () => {
    render(
      <QueryClientProvider client={qc}>
        <EmailContentWithImages htmlContent="<p>Bonjour le monde</p>" messageId="m1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('Bonjour le monde')).toBeInTheDocument();
  });

  it('renders text content as fallback', () => {
    render(
      <QueryClientProvider client={qc}>
        <EmailContentWithImages textContent="Texte brut ici" messageId="m2" />
      </QueryClientProvider>
    );
    expect(screen.getByText('Texte brut ici')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <EmailContentWithImages htmlContent="<p>Test</p>" messageId="m3" className="my-cls" />
      </QueryClientProvider>
    );
    expect(container.querySelector('.my-cls')).toBeInTheDocument();
  });

  it('renders empty when no content', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <EmailContentWithImages messageId="m4" />
      </QueryClientProvider>
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
