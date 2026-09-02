import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailAISummaryCard } from '../EmailAISummaryCard';

describe('EmailAISummaryCard', () => {
  it('renders nothing when no summary', () => {
    const { container } = render(<EmailAISummaryCard thread={{}} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders summary text', () => {
    render(<EmailAISummaryCard thread={{ ai_summary: 'Résumé du thread concernant le déploiement.' }} />);
    expect(screen.getByText('Résumé IA')).toBeInTheDocument();
    expect(screen.getByText(/Résumé du thread/)).toBeInTheDocument();
  });

  it('renders suggested actions', () => {
    render(
      <EmailAISummaryCard
        thread={{
          ai_summary: 'Un résumé.',
          suggested_actions: ['Planifier un appel', 'Envoyer un devis'],
        }}
      />
    );
    expect(screen.getByText('Planifier un appel')).toBeInTheDocument();
    expect(screen.getByText('Envoyer un devis')).toBeInTheDocument();
  });
});
