import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MailboxSelector } from '../MailboxSelector';

describe('MailboxSelector', () => {
  it('renders 3 mailbox buttons', () => {
    render(<MailboxSelector value="inbox" onChange={vi.fn()} />);
    expect(screen.getByText('Réception')).toBeInTheDocument();
    expect(screen.getByText('Envoyés')).toBeInTheDocument();
    expect(screen.getByText('Tous')).toBeInTheDocument();
  });

  it('calls onChange when clicking sent', () => {
    const onChange = vi.fn();
    render(<MailboxSelector value="inbox" onChange={onChange} />);
    fireEvent.click(screen.getByText('Envoyés'));
    expect(onChange).toHaveBeenCalledWith('sent');
  });

  it('calls onChange when clicking all', () => {
    const onChange = vi.fn();
    render(<MailboxSelector value="inbox" onChange={onChange} />);
    fireEvent.click(screen.getByText('Tous'));
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('shows inbox count when not active', () => {
    render(<MailboxSelector value="sent" onChange={vi.fn()} inboxCount={5} />);
    expect(screen.getByText('(5)')).toBeInTheDocument();
  });

  it('hides inbox count when active', () => {
    render(<MailboxSelector value="inbox" onChange={vi.fn()} inboxCount={5} />);
    expect(screen.queryByText('(5)')).not.toBeInTheDocument();
  });
});
