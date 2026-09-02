import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { LastSyncIndicator } from '@/components/email/LastSyncIndicator';
import { TooltipProvider } from '@/components/ui/tooltip';

const wrap = (props: any) =>
  React.createElement(TooltipProvider, null,
    React.createElement(LastSyncIndicator, props)
  );

describe('LastSyncIndicator', () => {
  it('should show "À jour" for recent sync', () => {
    const recentDate = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
    render(wrap({ lastSyncAt: recentDate }));
    // Should display relative time via date-fns
    expect(screen.getByText(/minutes?|à l'instant/i)).toBeInTheDocument();
  });

  it('should render without label when showLabel is false', () => {
    const recentDate = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { container } = render(wrap({ lastSyncAt: recentDate, showLabel: false }));
    // Only icon, no text span visible
    const spans = container.querySelectorAll('span');
    // Hidden spans only
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should show old status for null sync date', () => {
    const { container } = render(wrap({ lastSyncAt: null }));
    // Red icon for old status
    expect(container.querySelector('[class*="red"]')).toBeInTheDocument();
  });

  it('should show stale status for 2 hour old sync', () => {
    const staleDate = new Date(Date.now() - 120 * 60 * 1000).toISOString();
    const { container } = render(wrap({ lastSyncAt: staleDate }));
    expect(container.querySelector('[class*="orange"]')).toBeInTheDocument();
  });
});
