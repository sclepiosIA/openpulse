import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AttachmentsSection } from '../AttachmentsSection';

vi.mock('@/hooks/rd/useRDAttachments', () => ({
  useRDAttachments: () => ({ data: [], isLoading: false }),
  useUploadRDAttachment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteRDAttachment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGetAttachmentUrl: () => ({ mutateAsync: vi.fn() }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('AttachmentsSection', () => {
  it('renders upload button', () => {
    render(
      <QueryClientProvider client={qc}>
        <AttachmentsSection entityType="user_story" entityId="s1" />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Ajouter/)).toBeInTheDocument();
  });

  it('renders section title', () => {
    render(
      <QueryClientProvider client={qc}>
        <AttachmentsSection entityType="epic" entityId="e1" />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Pièces jointes/)).toBeInTheDocument();
  });

  it('shows empty state when no attachments', () => {
    render(
      <QueryClientProvider client={qc}>
        <AttachmentsSection entityType="projet" entityId="p1" />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Aucune pièce jointe/)).toBeInTheDocument();
  });
});
