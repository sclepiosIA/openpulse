/* @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChurnFactorBars } from './ChurnFactorBars';

const { progressSpy } = vi.hoisted(() => ({
  progressSpy: vi.fn(),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value?: number; className?: string }) => {
    progressSpy({ value, className });
    return (
      <div
        data-testid="progress"
        data-value={String(value ?? '')}
        className={className}
      />
    );
  },
}));

describe('ChurnFactorBars', () => {
  beforeEach(() => {
    progressSpy.mockClear();
  });

  it('renders all churn factors with correct labels, value texts, scores and progress percentages', () => {
    render(
      <ChurnFactorBars
        factors={{
          open_tickets: 5,
          emails_30d: 0,
          unpaid_invoices: 1,
          days_since_last_interaction: 61,
        }}
      />
    );

    expect(screen.getByText('🎫 Tickets ouverts')).toBeInTheDocument();
    expect(screen.getByText('5 tickets ·')).toBeInTheDocument();
    expect(screen.getByText('30/30')).toBeInTheDocument();

    expect(screen.getByText('📧 Emails 30j')).toBeInTheDocument();
    expect(screen.getByText('0 échange ·')).toBeInTheDocument();
    expect(screen.getByText('25/25')).toBeInTheDocument();

    expect(screen.getByText('💸 Impayés')).toBeInTheDocument();
    expect(screen.getByText('1 facture ·')).toBeInTheDocument();
    expect(screen.getByText('10/25')).toBeInTheDocument();

    expect(screen.getByText('⏰ Dernière interaction')).toBeInTheDocument();
    expect(screen.getByText('61j ·')).toBeInTheDocument();
    expect(screen.getByText('20/20')).toBeInTheDocument();

    expect(progressSpy).toHaveBeenCalledTimes(4);
    expect(progressSpy).toHaveBeenNthCalledWith(1, { value: 100, className: 'h-2' });
    expect(progressSpy).toHaveBeenNthCalledWith(2, { value: 100, className: 'h-2' });
    expect(progressSpy).toHaveBeenNthCalledWith(3, { value: 40, className: 'h-2' });
    expect(progressSpy).toHaveBeenNthCalledWith(4, { value: 100, className: 'h-2' });
  });

  it('uses defaults and threshold logic correctly for missing or lower values', () => {
    render(
      <ChurnFactorBars
        factors={{
          open_tickets: 3,
          emails_30d: 2,
          unpaid_invoices: 2,
          days_since_last_interaction: 45,
        }}
      />
    );

    expect(screen.getByText('3 tickets ·')).toBeInTheDocument();
    expect(screen.getByText('15/30')).toBeInTheDocument();

    expect(screen.getByText('2 échanges ·')).toBeInTheDocument();
    expect(screen.getByText('10/25')).toBeInTheDocument();

    expect(screen.getByText('2 factures ·')).toBeInTheDocument();
    expect(screen.getByText('25/25')).toBeInTheDocument();

    expect(screen.getByText('45j ·')).toBeInTheDocument();
    expect(screen.getByText('10/20')).toBeInTheDocument();

    expect(progressSpy).toHaveBeenNthCalledWith(1, { value: 50, className: 'h-2' });
    expect(progressSpy).toHaveBeenNthCalledWith(2, { value: 40, className: 'h-2' });
    expect(progressSpy).toHaveBeenNthCalledWith(3, { value: 100, className: 'h-2' });
    expect(progressSpy).toHaveBeenNthCalledWith(4, { value: 50, className: 'h-2' });
  });

  it('falls back to zero and renders "jamais" for very large last interaction values', () => {
    render(<ChurnFactorBars factors={{ days_since_last_interaction: 999 }} />);

    expect(screen.getByText('🎫 Tickets ouverts')).toBeInTheDocument();
    expect(screen.getByText('0 ticket ·')).toBeInTheDocument();
    expect(screen.getAllByText('0/30')).toHaveLength(1);

    expect(screen.getByText('📧 Emails 30j')).toBeInTheDocument();
    expect(screen.getByText('0 échange ·')).toBeInTheDocument();
    expect(screen.getByText('25/25')).toBeInTheDocument();

    expect(screen.getByText('💸 Impayés')).toBeInTheDocument();
    expect(screen.getByText('0 facture ·')).toBeInTheDocument();
    expect(screen.getByText('0/25')).toBeInTheDocument();

    expect(screen.getByText('⏰ Dernière interaction')).toBeInTheDocument();
    expect(screen.getByText('jamais ·')).toBeInTheDocument();
    expect(screen.getByText('20/20')).toBeInTheDocument();

    expect(progressSpy).toHaveBeenNthCalledWith(1, { value: 0, className: 'h-2' });
    expect(progressSpy).toHaveBeenNthCalledWith(2, { value: 100, className: 'h-2' });
    expect(progressSpy).toHaveBeenNthCalledWith(3, { value: 0, className: 'h-2' });
    expect(progressSpy).toHaveBeenNthCalledWith(4, { value: 100, className: 'h-2' });
  });
});