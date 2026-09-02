import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./PulseMarkdownRenderer', () => ({
  PulseMarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

import { TranscriptionSummaryCard } from '../TranscriptionSummaryCard';

describe('TranscriptionSummaryCard', () => {
  const baseMessage = {
    id: 'm1',
    conversation_id: 'c1',
    sender_id: 's1',
    content: 'Résumé de la réunion',
    created_at: '2026-03-10T10:00:00Z',
    metadata: {
      type: 'transcription_summary' as const,
      session_id: 'sess1',
      decisions_count: 3,
      next_steps_count: 2,
    },
  } as any;

  it('renders title', () => {
    render(
      <MemoryRouter>
        <TranscriptionSummaryCard message={baseMessage} />
      </MemoryRouter>
    );
    expect(screen.getByText('Compte-rendu de réunion')).toBeInTheDocument();
  });

  it('renders decisions badge', () => {
    render(
      <MemoryRouter>
        <TranscriptionSummaryCard message={baseMessage} />
      </MemoryRouter>
    );
    expect(screen.getByText('3 décisions')).toBeInTheDocument();
  });

  it('renders next steps badge', () => {
    render(
      <MemoryRouter>
        <TranscriptionSummaryCard message={baseMessage} />
      </MemoryRouter>
    );
    expect(screen.getByText(/2 étape/)).toBeInTheDocument();
  });
});
