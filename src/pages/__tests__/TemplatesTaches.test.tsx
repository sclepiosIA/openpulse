import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/tasks/useModelesTaches', () => ({
  useAllModelesTaches: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/catalogue/useCategories', () => ({
  useCategories: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/jarvis/useJarvisMemory', () => ({
  useJarvisMemory: () => ({ memories: [], isLoading: false }),
}));
vi.mock('@/components/templates-taches/TemplateTaskList', () => ({
  TemplateTaskList: () => <div data-testid="template-list" />,
}));
vi.mock('@/components/templates-taches/CreateTemplateDialog', () => ({
  CreateTemplateDialog: () => null,
}));
vi.mock('@/components/templates-taches/PhaseCategories', () => ({
  PhaseCategories: () => <div />,
}));
vi.mock('@/components/jarvis/JarvisMemoryManager', () => ({
  JarvisMemoryManager: () => null,
}));

import TemplatesTaches from '../TemplatesTaches';

describe('TemplatesTaches page', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter><TemplatesTaches /></MemoryRouter>
      </QueryClientProvider>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
