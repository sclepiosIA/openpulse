import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/contracts/useContratTemplates', () => ({
  useContratTemplates: () => ({ data: [], isLoading: false }),
  useContratClauses: () => ({ data: [], isLoading: false }),
  useCreateClause: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateClause: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteClause: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../ClauseRichEditor', () => ({
  ClauseRichEditor: () => <div data-testid="clause-editor" />,
}));
vi.mock('../ClauseAIToolbar', () => ({
  ClauseAIToolbar: () => null,
}));
vi.mock('../TemplateEditorDialog', () => ({
  TemplateEditorDialog: () => null,
}));
vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: () => null,
}));
vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn() },
}));

import ContratsTemplates from '../ContratsTemplates';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('ContratsTemplates', () => {
  it('renders tabs', () => {
    render(
      <QueryClientProvider client={qc}>
        <ContratsTemplates />
      </QueryClientProvider>
    );
    const tabs = screen.getAllByText('Modèles de contrats');
    expect(tabs.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Clauses types')).toBeInTheDocument();
  });
});
