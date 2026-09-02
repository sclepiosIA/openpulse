import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailSuggestionCard } from '../EmailSuggestionCard';

describe('EmailSuggestionCard', () => {
  const suggestion = {
    id: 's1',
    suggestion_type: 'domain_match',
    match_confidence: 0.85,
    suggested_etablissement_id: 'e1',
    created_at: new Date().toISOString(),
    display_etab_name: 'CHU Bordeaux',
    display_etab_ville: 'Bordeaux',
    email_thread: {
      subject: 'Sujet du mail',
      ai_summary: 'Résumé IA',
      last_message_date: new Date().toISOString(),
    },
  };

  it('renders etablissement name', () => {
    render(
      <EmailSuggestionCard
        suggestion={suggestion}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        isAccepting={false}
        isRejecting={false}
      />
    );
    expect(screen.getByText('CHU Bordeaux')).toBeInTheDocument();
  });

  it('renders confidence score', () => {
    render(
      <EmailSuggestionCard
        suggestion={suggestion}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        isAccepting={false}
        isRejecting={false}
      />
    );
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('renders thread subject', () => {
    render(
      <EmailSuggestionCard
        suggestion={suggestion}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        isAccepting={false}
        isRejecting={false}
      />
    );
    expect(screen.getByText('Sujet du mail')).toBeInTheDocument();
  });
});
