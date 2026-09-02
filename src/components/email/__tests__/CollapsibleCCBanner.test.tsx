import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CollapsibleCCBanner } from '../CollapsibleCCBanner';

vi.mock('../EmailAvatar', () => ({
  EmailAvatar: ({ name, email }: any) => <span data-testid="avatar">{name || email}</span>,
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const w = (ui: React.ReactElement) => render(
  <QueryClientProvider client={qc}><TooltipProvider>{ui}</TooltipProvider></QueryClientProvider>
);

describe('CollapsibleCCBanner', () => {
  it('returns null for empty addresses', () => {
    const { container } = w(<CollapsibleCCBanner ccAddresses={null} />);
    expect(container.textContent).toBe('');
  });

  it('returns null for empty array', () => {
    const { container } = w(<CollapsibleCCBanner ccAddresses={[]} />);
    expect(container.textContent).toBe('');
  });

  it('renders CC count', () => {
    w(<CollapsibleCCBanner ccAddresses={['alice@test.com', 'bob@test.com']} />);
    expect(screen.getByText('2 en copie')).toBeInTheDocument();
  });

  it('renders CC label', () => {
    w(<CollapsibleCCBanner ccAddresses={['alice@test.com']} />);
    expect(screen.getByText('CC')).toBeInTheDocument();
  });

  it('renders BCC label when provided', () => {
    w(<CollapsibleCCBanner ccAddresses={['a@b.com']} bccAddresses={['c@d.com']} />);
    expect(screen.getByText('CCI')).toBeInTheDocument();
    expect(screen.getByText('2 en copie')).toBeInTheDocument();
  });

  it('parses string addresses with names', () => {
    w(<CollapsibleCCBanner ccAddresses="Alice <alice@test.com>, bob@test.com" />);
    expect(screen.getByText('2 en copie')).toBeInTheDocument();
  });

  it('parses object addresses', () => {
    w(<CollapsibleCCBanner ccAddresses={[{ email: 'test@t.com', name: 'Test User' }]} />);
    expect(screen.getByText('1 en copie')).toBeInTheDocument();
  });

  it('shows copy all button when expanded', () => {
    w(<CollapsibleCCBanner ccAddresses={['a@b.com']} />);
    expect(screen.getByText('Tout copier')).toBeInTheDocument();
  });
});
