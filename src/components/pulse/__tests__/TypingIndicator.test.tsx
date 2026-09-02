import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TypingIndicator } from '../TypingIndicator';

const members = [
  { user_id: 'u1', user: { id: 'u1', prenom: 'Jean', nom: 'Dupont', avatar_url: null } },
  { user_id: 'u2', user: { id: 'u2', prenom: 'Marie', nom: 'Martin', avatar_url: null } },
  { user_id: 'u3', user: { id: 'u3', prenom: 'Luc', nom: 'B', avatar_url: null } },
] as any;

describe('TypingIndicator', () => {
  it('returns null when no one is typing', () => {
    const { container } = render(<TypingIndicator typingUserIds={[]} members={members} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows single user typing text', () => {
    render(<TypingIndicator typingUserIds={['u1']} members={members} />);
    expect(screen.getByText(/Jean écrit/)).toBeInTheDocument();
  });

  it('shows two users typing text', () => {
    render(<TypingIndicator typingUserIds={['u1', 'u2']} members={members} />);
    expect(screen.getByText(/Jean et Marie écrivent/)).toBeInTheDocument();
  });

  it('shows count for 3+ users', () => {
    render(<TypingIndicator typingUserIds={['u1', 'u2', 'u3']} members={members} />);
    expect(screen.getByText(/3 personnes écrivent/)).toBeInTheDocument();
  });

  it('renders avatar initials', () => {
    render(<TypingIndicator typingUserIds={['u1']} members={members} />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('shows +N for extra typing users', () => {
    render(<TypingIndicator typingUserIds={['u1', 'u2', 'u3']} members={members} />);
    expect(screen.getByText('+1')).toBeInTheDocument();
  });
});
