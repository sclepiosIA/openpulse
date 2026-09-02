import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PollInlineCard } from '../PollInlineCard';

const mockPoll = {
  id: 'p1',
  question: 'Quel framework préférez-vous ?',
  is_multiple_choice: false,
  is_anonymous: true,
  ends_at: null,
  total_votes: 5,
  my_votes: ['opt1'],
  options: [
    { id: 'opt1', text: 'React', vote_count: 3 },
    { id: 'opt2', text: 'Vue', vote_count: 2 },
  ],
};

vi.mock('@/hooks/pulse/usePulsePolls', () => ({
  usePulsePoll: () => ({ data: mockPoll, isLoading: false, error: null }),
  useVotePoll: () => ({ mutate: vi.fn(), isPending: false }),
  useUnvotePoll: () => ({ mutate: vi.fn(), isPending: false }),
}));

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('PollInlineCard', () => {
  it('renders poll question', () => {
    render(
      <QueryClientProvider client={qc}>
        <PollInlineCard pollId="p1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('Quel framework préférez-vous ?')).toBeInTheDocument();
  });

  it('renders options', () => {
    render(
      <QueryClientProvider client={qc}>
        <PollInlineCard pollId="p1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Vue')).toBeInTheDocument();
  });

  it('shows vote count', () => {
    render(
      <QueryClientProvider client={qc}>
        <PollInlineCard pollId="p1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('5 votes')).toBeInTheDocument();
  });

  it('shows anonymous badge', () => {
    render(
      <QueryClientProvider client={qc}>
        <PollInlineCard pollId="p1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('Anonyme')).toBeInTheDocument();
  });

  it('shows percentages when voted', () => {
    render(
      <QueryClientProvider client={qc}>
        <PollInlineCard pollId="p1" />
      </QueryClientProvider>
    );
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });
});
