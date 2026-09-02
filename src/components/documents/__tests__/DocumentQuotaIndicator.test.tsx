import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocumentQuotaIndicator } from '../DocumentQuotaIndicator';

vi.mock('@/hooks/documents/useDocumentQuota', () => ({
  useDocumentQuota: () => ({
    data: {
      usage_percentage: 80,
      formatted_used: '800 MB',
      formatted_quota: '1 GB',
    },
    isLoading: false,
  }),
}));

describe('DocumentQuotaIndicator', () => {
  it('renders storage label', () => {
    render(<DocumentQuotaIndicator />);
    expect(screen.getByText('Stockage')).toBeInTheDocument();
  });

  it('renders used/quota text', () => {
    render(<DocumentQuotaIndicator />);
    expect(screen.getByText('800 MB / 1 GB')).toBeInTheDocument();
  });

  it('shows warning when usage >= 75%', () => {
    render(<DocumentQuotaIndicator />);
    expect(screen.getByText('Espace de stockage limité')).toBeInTheDocument();
  });

  it('hides warning when showDetails is false', () => {
    render(<DocumentQuotaIndicator showDetails={false} />);
    expect(screen.queryByText('Espace de stockage limité')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<DocumentQuotaIndicator className="my-cls" />);
    expect(container.querySelector('.my-cls')).toBeInTheDocument();
  });
});
