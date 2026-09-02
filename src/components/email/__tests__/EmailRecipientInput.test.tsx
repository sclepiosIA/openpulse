import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/email/useEmailAutocomplete', () => ({
  useEmailAutocomplete: () => ({ data: [] }),
}));

import { EmailRecipientInput } from '../EmailRecipientInput';

describe('EmailRecipientInput', () => {
  it('renders placeholder', () => {
    render(<EmailRecipientInput value={[]} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Ajouter un destinataire...')).toBeInTheDocument();
  });

  it('renders custom placeholder', () => {
    render(<EmailRecipientInput value={[]} onChange={vi.fn()} placeholder="CC..." />);
    expect(screen.getByPlaceholderText('CC...')).toBeInTheDocument();
  });

  it('renders existing email badges', () => {
    render(<EmailRecipientInput value={['test@example.com']} onChange={vi.fn()} />);
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<EmailRecipientInput value={[]} onChange={vi.fn()} label="Destinataires" />);
    expect(screen.getByText('Destinataires')).toBeInTheDocument();
  });
});
