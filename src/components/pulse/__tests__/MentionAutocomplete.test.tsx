import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MentionAutocomplete } from '../MentionAutocomplete';

const users = [
  { id: 'u1', nom: 'Dupont', prenom: 'Jean' },
  { id: 'u2', nom: 'Martin', prenom: 'Marie' },
];

describe('MentionAutocomplete', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <MentionAutocomplete users={users} query="" position={{ top: 0, left: 0 }} onSelect={vi.fn()} onClose={vi.fn()} visible={false} />
    );
    expect(container.querySelector('[class]')).toBeNull();
  });

  it('renders filtered users when visible', () => {
    render(
      <MentionAutocomplete users={users} query="jean" position={{ top: 100, left: 50 }} onSelect={vi.fn()} onClose={vi.fn()} visible={true} />
    );
    expect(screen.getByText(/Jean/)).toBeInTheDocument();
    expect(screen.getByText(/Dupont/)).toBeInTheDocument();
  });

  it('shows no results for unmatched query', () => {
    render(
      <MentionAutocomplete users={users} query="zzz" position={{ top: 100, left: 50 }} onSelect={vi.fn()} onClose={vi.fn()} visible={true} />
    );
    expect(screen.queryByText(/Jean/)).not.toBeInTheDocument();
  });
});
