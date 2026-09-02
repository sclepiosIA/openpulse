import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmailIntelligenceHub } from '../EmailIntelligenceHub';

vi.mock('@/hooks/email/useEmailDashboardStats', () => ({
  useEmailDashboardStats: () => ({
    data: {
      totalThreads: 10,
      unreadCount: 3,
      classifiedCount: 8,
      newProspects: { count: 0, total_ca: 0, prospects: [] },
      pendingSuggestions: { count: 0, avg_confidence: 0, suggestions: [] },
    },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/ai/useAISuggestions', () => ({
  useAISuggestions: () => ({
    suggestions: [],
    isLoading: false,
    approveSuggestion: vi.fn(),
    rejectSuggestion: vi.fn(),
    isApproving: false,
    isRejecting: false,
  }),
}));

vi.mock('@/hooks/crm/useEtablissementEmailSuggestions', () => ({
  useEtablissementEmailSuggestions: () => ({
    acceptSuggestion: vi.fn(),
    rejectSuggestion: vi.fn(),
    isAccepting: false,
    isRejecting: false,
  }),
}));

describe('EmailIntelligenceHub', () => {
  const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

  it('renders intelligence hub title', () => {
    wrap(<EmailIntelligenceHub />);
    expect(screen.getByText('Intelligence Email')).toBeInTheDocument();
  });

  it('renders tabs', () => {
    wrap(<EmailIntelligenceHub />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThanOrEqual(2);
  });
});
