import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/email/useEmailAutocomplete', () => ({
  useEmailAutocomplete: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/shared/useDebounce', () => ({
  useDebounce: (val: string) => val,
}));

import { EmailForwardDialog } from '../EmailForwardDialog';

describe('EmailForwardDialog', () => {
  it('renders dialog when open', () => {
    render(<EmailForwardDialog open={true} onOpenChange={vi.fn()} onForward={vi.fn()} />);
    expect(screen.getByText('Transférer')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<EmailForwardDialog open={false} onOpenChange={vi.fn()} onForward={vi.fn()} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders recipient input', () => {
    render(<EmailForwardDialog open={true} onOpenChange={vi.fn()} onForward={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Rechercher un contact/)).toBeInTheDocument();
  });
});
