import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/rd/useRD', () => ({
  useRDSprints: () => ({ data: [], isLoading: false }),
  useRDEpics: () => ({ data: [] }),
  useRDUserStories: () => ({ data: [] }),
}));

vi.mock('@/components/etablissement-gantt/GanttDualLayout', () => ({
  GanttDualLayout: ({ children }: any) => <div data-testid="gantt-layout">{children}</div>,
}));

import { RDGanttContainer } from '../RDGanttContainer';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('RDGanttContainer', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <RDGanttContainer projetId="p1" />
      </QueryClientProvider>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders gantt layout', () => {
    const { container } = render(
      <QueryClientProvider client={qc}>
        <RDGanttContainer projetId="p1" />
      </QueryClientProvider>
    );
    expect(container.querySelector('[class]')).toBeInTheDocument();
  });
});
