import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/pulse/usePulseMedia', () => ({
  usePulseMedia: () => ({
    isUploading: false,
    uploadProgress: 0,
    uploadFile: vi.fn(),
    maxFileSize: 10 * 1024 * 1024,
    allowedTypes: ['image/*', 'application/pdf'],
  }),
}));

import { FileUpload } from '../FileUpload';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('FileUpload', () => {
  it('renders upload button', () => {
    render(
      <QueryClientProvider client={qc}>
        <FileUpload conversationId="c1" />
      </QueryClientProvider>
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders disabled state', () => {
    render(
      <QueryClientProvider client={qc}>
        <FileUpload conversationId="c1" disabled />
      </QueryClientProvider>
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
