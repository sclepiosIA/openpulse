import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-pdf', () => ({
  Document: () => <div />,
  Page: () => <div />,
  pdfjs: { version: '9.9.9-test', GlobalWorkerOptions: { workerSrc: '' } },
}));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '' }));
vi.mock('@/hooks/crm/usePartenaires', () => ({
  usePartenaire: () => ({ data: null, isLoading: true }),
  useDeletePartenaire: () => ({ mutateAsync: vi.fn() }),
}));

import PartenaireDetail from '../PartenaireDetail';

describe('PartenaireDetail page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders loading state', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/partenaires/p1']}>
          <Routes>
            <Route path="/partenaires/:id" element={<PartenaireDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });
});
