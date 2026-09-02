import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AttendeesSelector } from '../AttendeesSelector';

vi.mock('@/hooks/shared/useDebounce', () => ({
  useDebounce: (val: string) => val,
}));

vi.mock('@/hooks/search/useAttendeeSearch', () => ({
  useAttendeeSearch: () => ({ data: [], isLoading: false }),
}));

describe('AttendeesSelector', () => {
  it('renders label', () => {
    render(<AttendeesSelector value={[]} onChange={vi.fn()} />);
    expect(screen.getByText('Invités')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<AttendeesSelector value={[]} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Rechercher/i)).toBeInTheDocument();
  });

  it('renders selected attendees as badges', () => {
    const attendees = [
      { email: 'test@test.com', displayName: 'Jean Dupont', role: 'required' as const },
    ];
    render(<AttendeesSelector value={attendees} onChange={vi.fn()} />);
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
  });

  it('renders manual email input', () => {
    render(<AttendeesSelector value={[]} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/email externe/i)).toBeInTheDocument();
  });
});
