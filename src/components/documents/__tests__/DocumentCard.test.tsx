import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DocumentCard } from '../DocumentCard';

vi.mock('@/hooks/documents/useDocumentUpload', () => ({
  useDocumentDownload: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/documents/useDocuments', () => ({
  useDeleteDocument: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// AuthProvider mock — Share/Move dialogs in DocumentCard call useAuth().
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: { id: 'u1', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: { id: 'u1', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// useAuth from @/hooks/shared/useAuth re-exports from AuthProvider, so mock it too.
vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@test.com' },
    session: { access_token: 'mock-token' },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const doc = {
  id: 'd1',
  nom: 'rapport-annuel.pdf',
  taille: 1024 * 500,
  mime_type: 'application/pdf',
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  storage_path: 'docs/rapport.pdf',
  uploaded_by: 'u1',
  categorie: 'rapport',
  tags: ['finance'],
  est_archive: false,
  est_favori: false,
  versions_count: 1,
  folder_id: null,
  etablissement_id: null,
  description: null,
};

describe('DocumentCard', () => {
  it('renders card container', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <DocumentCard document={doc as any} onPreview={vi.fn()} />
      </QueryClientProvider>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders tags', () => {
    render(
      <QueryClientProvider client={qc}>
        <DocumentCard document={doc as any} onPreview={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.getByText('finance')).toBeInTheDocument();
  });

  it('renders relative date', () => {
    render(
      <QueryClientProvider client={qc}>
        <DocumentCard document={doc as any} onPreview={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.getByText(/il y a/)).toBeInTheDocument();
  });

  it('renders dropdown menu trigger', () => {
    render(
      <QueryClientProvider client={qc}>
        <DocumentCard document={doc as any} onPreview={vi.fn()} />
      </QueryClientProvider>
    );
    // The card renders at least one action button (dropdown trigger).
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });
});
