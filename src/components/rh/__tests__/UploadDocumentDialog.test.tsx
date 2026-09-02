import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UploadDocumentDialog } from '../UploadDocumentDialog';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: { from: () => ({ upload: vi.fn() }) },
    from: () => ({ insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }) }),
  },
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('UploadDocumentDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    profileId: 'p1',
    profileName: 'Jean Dupont',
    onUpload: vi.fn(),
  };

  it('renders dialog title', () => {
    render(
      <QueryClientProvider client={qc}>
        <UploadDocumentDialog {...defaultProps} />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Ajouter un document/)).toBeInTheDocument();
  });

  it('renders form fields', () => {
    render(
      <QueryClientProvider client={qc}>
        <UploadDocumentDialog {...defaultProps} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Type de document')).toBeInTheDocument();
    expect(screen.getByText('Titre')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <QueryClientProvider client={qc}>
        <UploadDocumentDialog {...defaultProps} open={false} />
      </QueryClientProvider>
    );
    expect(screen.queryByText(/Ajouter un document/)).not.toBeInTheDocument();
  });
});
