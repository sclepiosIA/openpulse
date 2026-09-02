import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/hooks/email/useEmailAnalytics', () => ({
  useEmailAnalytics: () => ({
    volumeData: [{ date: '2026-03-01', received: 10, sent: 5 }],
    commercialData: {
      suggestions: { accepted: 10, rejected: 3, pending: 5 },
      topContacts: [],
    },
    aiQualityData: {
      recentLogs: [{ processed_at: '2026-03-01', total_tokens: 200, processing_duration_ms: 1500, success: true }],
      totalProcessed: 100,
      successRate: 95,
    },
    threadsData: { total: 50, unread: 5 },
    isLoading: false,
  }),
}));

import EmailAnalytics from '../EmailAnalytics';

describe('EmailAnalytics page', () => {
  it('renders without crashing', () => {
    const { container } = render(<EmailAnalytics />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('renders page title', () => {
    render(<EmailAnalytics />);
    expect(screen.getByText('Analytics des Communications')).toBeInTheDocument();
  });
});
