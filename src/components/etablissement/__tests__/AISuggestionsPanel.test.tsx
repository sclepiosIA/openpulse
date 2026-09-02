import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockUseAISuggestions = vi.fn();

vi.mock('@/hooks/ai/useAISuggestions', () => ({
  useAISuggestions: (...args: any[]) => mockUseAISuggestions(...args),
  CRM_ACTION_TYPES: ['create_task', 'update_status'],
  OPERATIONAL_ACTION_TYPES: ['send_email'],
}));

import { AISuggestionsPanel } from '../AISuggestionsPanel';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const defaultReturn = {
  suggestions: [],
  suggestionGroups: [],
  isLoading: false,
  approveSuggestion: vi.fn(),
  rejectSuggestion: vi.fn(),
  approveSuggestionAndRejectSimilar: vi.fn(),
  isApproving: false,
  isRejecting: false,
};

describe('AISuggestionsPanel', () => {
  it('renders null when no suggestions', () => {
    mockUseAISuggestions.mockReturnValue(defaultReturn);
    const { container } = render(
      <QueryClientProvider client={qc}>
        <AISuggestionsPanel etablissementId="etab1" />
      </QueryClientProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders loading state', () => {
    mockUseAISuggestions.mockReturnValue({ ...defaultReturn, isLoading: true });
    render(
      <QueryClientProvider client={qc}>
        <AISuggestionsPanel etablissementId="etab1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
  });
});
